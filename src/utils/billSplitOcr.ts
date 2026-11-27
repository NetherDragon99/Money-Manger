import { get, ref } from 'firebase/database';
import { BillExtra, BillItem } from '../types';
import { generateBillId, toMinor } from './billSplitEngine';
import { app, auth, ensureFirebaseAuth, rtdb } from './firebase';

export interface OcrExtractedItem {
  id: string;
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OcrExtractedExtra {
  id: string;
  kind: BillExtra['kind'];
  label: string;
  valueType: 'percent' | 'fixed';
  value: number;
  sign: 1 | -1;
  selected: boolean;
}

export interface OcrReceiptResult {
  title?: string;
  items: OcrExtractedItem[];
  extras: OcrExtractedExtra[];
  statedTotal?: number;
  engineUsed: 'firebase_ai' | 'proxy';
}

export type OcrErrorCode = 'offline' | 'not_enabled' | 'no_items' | 'failed';

export class OcrScanError extends Error {
  code: OcrErrorCode;
  constructor(code: OcrErrorCode, message?: string) {
    super(message || code);
    this.code = code;
  }
}

function normalizeDigits(str: string): string {
  const arabicIndic = '٠١٢٣٤٥٦٧٨٩';
  const extIndic = '۰۱۲۳۴۵۶۷۸۹';
  return str
    .replace(/[٠-٩]/g, (d) => String(arabicIndic.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(extIndic.indexOf(d)));
}

export async function compressReceiptImage(
  file: File
): Promise<{ base64: string; mimeType: string; previewDataUrl: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed reading image file'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Invalid image file'));
    image.src = dataUrl;
  });

  const maxDim = 1600;
  let targetW = img.naturalWidth || img.width || 1000;
  let targetH = img.naturalHeight || img.height || 1000;
  if (targetW > maxDim || targetH > maxDim) {
    if (targetW >= targetH) {
      targetH = Math.round((targetH * maxDim) / targetW);
      targetW = maxDim;
    } else {
      targetW = Math.round((targetW * maxDim) / targetH);
      targetH = maxDim;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, targetW);
  canvas.height = Math.max(1, targetH);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const rawBase64 = dataUrl.split(',')[1] || '';
    return { base64: rawBase64, mimeType: file.type || 'image/jpeg', previewDataUrl: dataUrl };
  }

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
  const base64 = compressedDataUrl.split(',')[1] || '';
  return {
    base64,
    mimeType: 'image/jpeg',
    previewDataUrl: compressedDataUrl,
  };
}

interface RuntimeOcrConfig {
  ocr_model?: string;
  ocr_proxy_url?: string;
}

async function fetchRuntimeOcrConfig(): Promise<RuntimeOcrConfig> {
  try {
    await ensureFirebaseAuth();
    const snap = await get(ref(rtdb, 'app_config'));
    if (snap.exists() && snap.val()) {
      const val = snap.val();
      return {
        ocr_model: typeof val.ocr_model === 'string' ? val.ocr_model.trim() : undefined,
        ocr_proxy_url: typeof val.ocr_proxy_url === 'string' ? val.ocr_proxy_url.trim() : undefined,
      };
    }
  } catch {
    // Offline or restricted app_config: proceed with defaults
  }
  return {};
}

function normalizeParsedPayload(raw: any, engineUsed: 'firebase_ai' | 'proxy'): OcrReceiptResult {
  const rawItems = Array.isArray(raw?.items) ? raw.items : [];
  const items: OcrExtractedItem[] = [];

  for (const row of rawItems) {
    if (!row) continue;
    const name = String(row.name || '').trim();
    if (!name) continue;
    const qtyNum = Number(normalizeDigits(String(row.qty ?? 1)));
    const qty = Number.isFinite(qtyNum) && qtyNum > 0 ? Math.round(qtyNum * 100) / 100 : 1;
    let unitPrice = Number(normalizeDigits(String(row.unitPrice ?? 0)));
    let lineTotal = Number(normalizeDigits(String(row.lineTotal ?? 0)));
    if (!Number.isFinite(unitPrice) || unitPrice < 0) unitPrice = 0;
    if (!Number.isFinite(lineTotal) || lineTotal < 0) lineTotal = 0;
    if (unitPrice === 0 && lineTotal > 0) unitPrice = Math.round((lineTotal / qty) * 100) / 100;
    if (lineTotal === 0 && unitPrice > 0) lineTotal = Math.round(unitPrice * qty * 100) / 100;
    if (unitPrice <= 0 && lineTotal <= 0) continue;

    items.push({
      id: `ocr_${generateBillId().slice(0, 8)}`,
      name,
      qty,
      unitPrice,
      lineTotal,
    });
  }

  const rawExtras = Array.isArray(raw?.extras) ? raw.extras : [];
  const extras: OcrExtractedExtra[] = [];
  const validKinds: BillExtra['kind'][] = ['service', 'tax', 'delivery', 'tip', 'discount', 'custom'];

  for (const ex of rawExtras) {
    if (!ex) continue;
    const val = Number(normalizeDigits(String(ex.value ?? 0)));
    if (!Number.isFinite(val) || val <= 0) continue;
    const kind: BillExtra['kind'] = validKinds.includes(ex.kind) ? ex.kind : 'custom';
    const valueType: 'percent' | 'fixed' = ex.valueType === 'percent' ? 'percent' : 'fixed';
    const sign: 1 | -1 = ex.sign === -1 || kind === 'discount' ? -1 : 1;
    const label = String(ex.label || kind).trim();
    extras.push({
      id: `ocr_ex_${generateBillId().slice(0, 8)}`,
      kind,
      label,
      valueType,
      value: val,
      sign,
      selected: true,
    });
  }

  let statedTotal: number | undefined;
  if (raw?.statedTotal !== undefined && raw?.statedTotal !== null) {
    const parsedTotal = Number(normalizeDigits(String(raw.statedTotal)));
    if (Number.isFinite(parsedTotal) && parsedTotal > 0) {
      statedTotal = Math.round(parsedTotal * 100) / 100;
    }
  }

  const title = typeof raw?.title === 'string' && raw.title.trim() ? raw.title.trim() : undefined;

  if (items.length === 0) {
    throw new OcrScanError('no_items', 'No readable items found on receipt');
  }

  return {
    title,
    items,
    extras,
    statedTotal,
    engineUsed,
  };
}

const RECEIPT_OCR_PROMPT = `Analyze this restaurant, cafe, delivery, or grocery receipt image carefully (supports Arabic and English receipts, including Egyptian pounds EGP).
Extract:
1. "title": Restaurant or store name if clearly visible.
2. "items": Every purchased line item. Do NOT include Subtotal, Service charge, VAT/Tax, Delivery, Tips, Discount, or Grand Total inside "items". Preserve Arabic names cleanly. For each item provide:
   - "name": concise item name
   - "qty": numeric quantity (default 1)
   - "unitPrice": numeric price for 1 unit (if receipt only shows line total, compute lineTotal / qty)
   - "lineTotal": numeric total price for that line
3. "extras": Taxes, service charges (e.g. 12% الخدمة), VAT (e.g. 14% ضريبة القيمة المضافة), delivery fee, tip, or discounts (sign: -1 for discount, 1 otherwise). If a percentage is printed (like 12% or 14%), set valueType="percent" and value=12/14; otherwise set valueType="fixed" and numeric amount.
4. "statedTotal": The final grand total printed at the bottom (الإجمالي النهائي / Total / Grand Total). Normalize Arabic-Indic digits (٠-٩) to Western digits.`;

export async function scanReceiptWithAi(
  compressed: { base64: string; mimeType: string }
): Promise<OcrReceiptResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new OcrScanError('offline', 'Internet connection is required for camera scanning');
  }

  const config = await fetchRuntimeOcrConfig();
  const modelName = config.ocr_model || 'gemini-2.5-flash';

  try {
    const { getAI, getGenerativeModel, GoogleAIBackend, Schema } = await import('firebase/ai');
    const ai = getAI(app, { backend: new GoogleAIBackend() });

    const responseSchema = Schema.object({
      properties: {
        title: Schema.string({ nullable: true }),
        items: Schema.array({
          items: Schema.object({
            properties: {
              name: Schema.string(),
              qty: Schema.number(),
              unitPrice: Schema.number(),
              lineTotal: Schema.number(),
            },
          }),
        }),
        extras: Schema.array({
          items: Schema.object({
            properties: {
              kind: Schema.enumString({
                enum: ['service', 'tax', 'delivery', 'tip', 'discount', 'custom'],
              }),
              label: Schema.string(),
              valueType: Schema.enumString({ enum: ['percent', 'fixed'] }),
              value: Schema.number(),
              sign: Schema.integer(),
            },
          }),
        }),
        statedTotal: Schema.number({ nullable: true }),
      },
      optionalProperties: ['title', 'extras', 'statedTotal'],
    });

    const model = getGenerativeModel(ai, {
      model: modelName,
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema,
      },
    });

    const res = await model.generateContent([
      RECEIPT_OCR_PROMPT,
      {
        type: 'inlineData',
        inlineData: {
          data: compressed.base64,
          mimeType: compressed.mimeType,
        },
      },
    ]);

    const jsonText = res.response.text();
    const parsed = JSON.parse(jsonText);
    return normalizeParsedPayload(parsed, 'firebase_ai');
  } catch (err: any) {
    if (err instanceof OcrScanError) throw err;

    const codeStr = String(err?.code || err?.message || '').toLowerCase();
    const isNotEnabled =
      codeStr.includes('api-not-enabled') ||
      codeStr.includes('permission') ||
      codeStr.includes('forbidden') ||
      codeStr.includes('403') ||
      codeStr.includes('not been used in project');

    // Optional Apps Script / backend proxy fallback configured via RTDB app_config/ocr_proxy_url
    if (config.ocr_proxy_url) {
      try {
        const idToken = await auth.currentUser?.getIdToken().catch(() => undefined);
        const resp = await fetch(config.ocr_proxy_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: compressed.base64,
            mimeType: compressed.mimeType,
            idToken,
          }),
        });
        if (!resp.ok) throw new Error(`Proxy HTTP ${resp.status}`);
        const json = await resp.json();
        return normalizeParsedPayload(json, 'proxy');
      } catch (proxyErr) {
        if (proxyErr instanceof OcrScanError) throw proxyErr;
      }
    }

    if (isNotEnabled) {
      throw new OcrScanError(
        'not_enabled',
        'Firebase AI Logic is not enabled yet for this project in Firebase Console'
      );
    }

    throw new OcrScanError('failed', err?.message || 'Failed to scan receipt');
  }
}

export function buildBillEntriesFromOcr(
  items: OcrExtractedItem[],
  extras: OcrExtractedExtra[],
  priceMode: 'unit' | 'line_total'
): { items: BillItem[]; extras: BillExtra[] } {
  const billItems: BillItem[] = items
    .filter((it) => it.name.trim() && (it.unitPrice > 0 || it.lineTotal > 0))
    .map((it) => {
      const qty = it.qty > 0 ? it.qty : 1;
      const unitMinor =
        priceMode === 'unit'
          ? toMinor(it.unitPrice > 0 ? it.unitPrice : it.lineTotal / qty)
          : toMinor((it.lineTotal > 0 ? it.lineTotal : it.unitPrice) / qty);
      return {
        id: `item_${generateBillId().slice(0, 8)}`,
        name: it.name.trim(),
        unitPriceMinor: Math.max(0, unitMinor),
        qty,
        mode: 'equal_among',
        claims: {},
        equalAmong: [],
      };
    });

  const billExtras: BillExtra[] = extras
    .filter((ex) => ex.selected && ex.value > 0)
    .map((ex) => ({
      id: `extra_${generateBillId().slice(0, 8)}`,
      kind: ex.kind,
      label: ex.label,
      valueType: ex.valueType,
      value: ex.valueType === 'percent' ? ex.value : toMinor(ex.value),
      base: ex.kind === 'tax' ? 'subtotal_plus_previous' : 'subtotal',
      sign: ex.sign,
      distribution: 'proportional',
      exemptPersonIds: [],
      customAmountsMinor: {},
      exemptMode: 'redistribute',
    }));

  return { items: billItems, extras: billExtras };
}
