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
  engineUsed: 'gemini_api' | 'firebase_ai' | 'proxy';
}

export type OcrErrorCode = 'offline' | 'not_enabled' | 'no_items' | 'rate_limit' | 'failed';

export class OcrScanError extends Error {
  code: OcrErrorCode;
  constructor(code: OcrErrorCode, message?: string) {
    super(message || code);
    this.code = code;
  }
}

const DEFAULT_OCR_MODELS = [
  'gemini-3-flash-preview',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-flash-latest',
];

const MODEL_REQUEST_TIMEOUT_MS = 18000;

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

  // Preserve crisp Arabic/small receipt print on long vertical thermal receipts
  const maxDim = 2048;
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
  const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
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
  gemini_api_key?: string;
}

// Keep runtime config strictly in memory for the current session (never written to storage/backups/logs)
let cachedRuntimeConfig: { value: RuntimeOcrConfig; fetchedAt: number } | null = null;
const CONFIG_CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchRuntimeOcrConfig(): Promise<RuntimeOcrConfig> {
  if (
    cachedRuntimeConfig &&
    Date.now() - cachedRuntimeConfig.fetchedAt < CONFIG_CACHE_TTL_MS &&
    (cachedRuntimeConfig.value.gemini_api_key || cachedRuntimeConfig.value.ocr_proxy_url)
  ) {
    return cachedRuntimeConfig.value;
  }

  try {
    if (typeof auth.authStateReady === 'function') {
      await auth.authStateReady();
    }
    await ensureFirebaseAuth();
    const snap = await get(ref(rtdb, 'app_config'));
    if (snap.exists() && snap.val()) {
      const val = snap.val();
      const rawKey =
        (typeof val?.gemini?.apiKey === 'string' && val.gemini.apiKey.trim()) ||
        (typeof val?.gemini_api_key === 'string' && val.gemini_api_key.trim()) ||
        (typeof val?.ocr_api_key === 'string' && val.ocr_api_key.trim()) ||
        undefined;
      const rawModel =
        (typeof val?.ocr_model === 'string' && val.ocr_model.trim()) ||
        (typeof val?.gemini?.ocrModel === 'string' && val.gemini.ocrModel.trim()) ||
        undefined;
      const rawProxy =
        (typeof val?.ocr_proxy_url === 'string' && val.ocr_proxy_url.trim()) ||
        (typeof val?.gemini?.proxyUrl === 'string' && val.gemini.proxyUrl.trim()) ||
        undefined;

      const resolved: RuntimeOcrConfig = {
        ocr_model: rawModel,
        ocr_proxy_url: rawProxy,
        gemini_api_key: rawKey,
      };
      cachedRuntimeConfig = { value: resolved, fetchedAt: Date.now() };
      return resolved;
    }
  } catch {
    // Offline or restricted app_config: proceed with fallback engines
  }
  return {};
}

export function extractJsonFromModelText(rawText: string): any {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) {
    throw new Error('Empty AI response');
  }
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
    }
    throw new Error('Malformed JSON from AI response');
  }
}

export function normalizeParsedPayload(
  raw: any,
  engineUsed: OcrReceiptResult['engineUsed']
): OcrReceiptResult {
  const rawItems = Array.isArray(raw?.items) ? raw.items : [];
  const items: OcrExtractedItem[] = [];

  for (const row of rawItems) {
    if (!row) continue;
    const name = String(row.name || '').trim();
    if (!name) continue;
    const qtyNum = Number(normalizeDigits(String(row.qty ?? 1)).replace(/,/g, ''));
    const qty = Number.isFinite(qtyNum) && qtyNum > 0 ? Math.round(qtyNum * 100) / 100 : 1;
    let unitPrice = Number(normalizeDigits(String(row.unitPrice ?? 0)).replace(/,/g, ''));
    let lineTotal = Number(normalizeDigits(String(row.lineTotal ?? 0)).replace(/,/g, ''));
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
    const val = Number(normalizeDigits(String(ex.value ?? 0)).replace(/,/g, ''));
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
    const parsedTotal = Number(normalizeDigits(String(raw.statedTotal)).replace(/,/g, ''));
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
1. "title": Restaurant or store name if clearly visible (or null).
2. "items": Every purchased line item. Do NOT include Subtotal, Service charge, VAT/Tax, Delivery, Tips, Discount, or Grand Total inside "items". Preserve Arabic names cleanly. For each item provide:
   - "name": concise item name
   - "qty": numeric quantity (default 1)
   - "unitPrice": numeric price for 1 unit (if receipt only shows line total, compute lineTotal / qty)
   - "lineTotal": numeric total price for that line
3. "extras": Taxes, service charges (e.g. 12% الخدمة), VAT (e.g. 14% ضريبة القيمة المضافة), delivery fee, tip, or discounts (sign: -1 for discount, 1 otherwise). If a percentage is printed (like 12% or 14%), set valueType="percent" and value=12/14; otherwise set valueType="fixed" and numeric amount.
4. "statedTotal": The final grand total printed at the bottom (الإجمالي النهائي / Total / Grand Total). Normalize Arabic-Indic digits (٠-٩) to Western digits. If this image is not a receipt or no readable items are visible, return an empty "items" array.`;

const GEMINI_REST_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING', nullable: true },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          qty: { type: 'NUMBER' },
          unitPrice: { type: 'NUMBER' },
          lineTotal: { type: 'NUMBER' },
        },
        required: ['name', 'qty', 'unitPrice', 'lineTotal'],
      },
    },
    extras: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          kind: {
            type: 'STRING',
            enum: ['service', 'tax', 'delivery', 'tip', 'discount', 'custom'],
          },
          label: { type: 'STRING' },
          valueType: { type: 'STRING', enum: ['percent', 'fixed'] },
          value: { type: 'NUMBER' },
          sign: { type: 'INTEGER' },
        },
        required: ['kind', 'label', 'valueType', 'value', 'sign'],
      },
    },
    statedTotal: { type: 'NUMBER', nullable: true },
  },
  required: ['items'],
};

function buildModelCascade(preferredModel?: string): string[] {
  const list: string[] = [];
  if (preferredModel) {
    const cleaned = preferredModel.replace(/^models\//i, '').trim();
    if (cleaned) list.push(cleaned);
  }
  for (const m of DEFAULT_OCR_MODELS) {
    if (!list.includes(m)) list.push(m);
  }
  return list;
}

interface EngineFailureMeta {
  sawRateLimit: boolean;
  sawNotEnabled: boolean;
  lastErrorMessage: string;
}

function recordErrorMeta(meta: EngineFailureMeta, err: any, httpStatus?: number): void {
  const msg = String(err?.code || err?.message || err || '').toLowerCase();
  if (
    httpStatus === 429 ||
    httpStatus === 503 ||
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('high demand') ||
    msg.includes('unavailable') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota')
  ) {
    meta.sawRateLimit = true;
  }
  if (
    httpStatus === 401 ||
    httpStatus === 403 ||
    msg.includes('app check') ||
    msg.includes('api-not-enabled') ||
    msg.includes('permission') ||
    msg.includes('forbidden') ||
    msg.includes('unauthorized') ||
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('not been used in project')
  ) {
    meta.sawNotEnabled = true;
  }
  if (err?.message) {
    meta.lastErrorMessage = String(err.message);
  }
}

async function scanViaGeminiRestApi(
  compressed: { base64: string; mimeType: string },
  apiKey: string,
  models: string[],
  meta: EngineFailureMeta
): Promise<OcrReceiptResult | null> {
  for (const modelName of models) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MODEL_REQUEST_TIMEOUT_MS);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        modelName
      )}:generateContent`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: RECEIPT_OCR_PROMPT },
                {
                  inline_data: {
                    mime_type: compressed.mimeType,
                    data: compressed.base64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
            responseSchema: GEMINI_REST_RESPONSE_SCHEMA,
          },
        }),
      });

      if (!resp.ok) {
        const errBody = await resp.text().catch(() => '');
        recordErrorMeta(meta, new Error(`Gemini HTTP ${resp.status}: ${errBody.slice(0, 240)}`), resp.status);
        // Invalid/blocked key won't succeed on other models -> bail out to fallback engines
        if (resp.status === 401 || resp.status === 403) {
          return null;
        }
        // Retry next model on 404 (deprecated), 429 (quota), 5xx (temporary high demand)
        if (resp.status === 404 || resp.status === 429 || resp.status >= 500) {
          continue;
        }
        // Other 4xx (e.g. schema incompatibility on a preview model): try next model
        continue;
      }

      const data = await resp.json();
      const parts: any[] = data?.candidates?.[0]?.content?.parts || [];
      const text = parts
        .filter((p) => !p?.thought && typeof p?.text === 'string')
        .map((p) => p.text)
        .join('')
        .trim();

      if (!text) {
        continue;
      }

      const parsed = extractJsonFromModelText(text);
      return normalizeParsedPayload(parsed, 'gemini_api');
    } catch (err: any) {
      if (err instanceof OcrScanError) throw err;
      recordErrorMeta(meta, err);
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

async function scanViaFirebaseAi(
  compressed: { base64: string; mimeType: string },
  models: string[],
  meta: EngineFailureMeta
): Promise<OcrReceiptResult | null> {
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

    for (const modelName of models) {
      try {
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
        const parsed = extractJsonFromModelText(jsonText);
        return normalizeParsedPayload(parsed, 'firebase_ai');
      } catch (err: any) {
        if (err instanceof OcrScanError) throw err;
        recordErrorMeta(meta, err);
        const codeStr = String(err?.code || err?.message || '').toLowerCase();
        // Auth / App Check / Project enablement error will fail for every model -> stop looping
        if (
          codeStr.includes('app check') ||
          codeStr.includes('401') ||
          codeStr.includes('403') ||
          codeStr.includes('api-not-enabled') ||
          codeStr.includes('permission') ||
          codeStr.includes('unauthorized')
        ) {
          return null;
        }
      }
    }
  } catch (err: any) {
    if (err instanceof OcrScanError) throw err;
    recordErrorMeta(meta, err);
  }
  return null;
}

export async function scanReceiptWithAi(
  compressed: { base64: string; mimeType: string }
): Promise<OcrReceiptResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new OcrScanError('offline', 'Internet connection is required for camera scanning');
  }

  if (!compressed?.base64) {
    throw new OcrScanError('failed', 'Invalid receipt image data');
  }

  const config = await fetchRuntimeOcrConfig();
  const models = buildModelCascade(config.ocr_model);
  const failureMeta: EngineFailureMeta = {
    sawRateLimit: false,
    sawNotEnabled: false,
    lastErrorMessage: '',
  };

  // 1. Primary: Direct Gemini Vision API using runtime RTDB app_config/gemini/apiKey
  if (config.gemini_api_key) {
    const restResult = await scanViaGeminiRestApi(
      compressed,
      config.gemini_api_key,
      models,
      failureMeta
    );
    if (restResult) return restResult;
  }

  // 2. Secondary: Optional backend proxy configured via RTDB app_config/ocr_proxy_url
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
      if (!resp.ok) {
        recordErrorMeta(failureMeta, new Error(`Proxy HTTP ${resp.status}`), resp.status);
      } else {
        const json = await resp.json();
        return normalizeParsedPayload(json, 'proxy');
      }
    } catch (proxyErr: any) {
      if (proxyErr instanceof OcrScanError) throw proxyErr;
      recordErrorMeta(failureMeta, proxyErr);
    }
  }

  // 3. Fallback: Firebase AI Logic SDK (works whenever App Check is configured or unenforced)
  const firebaseAiResult = await scanViaFirebaseAi(compressed, models, failureMeta);
  if (firebaseAiResult) return firebaseAiResult;

  if (failureMeta.sawRateLimit) {
    throw new OcrScanError(
      'rate_limit',
      'AI receipt reader is experiencing high demand right now. Please try again in a moment.'
    );
  }

  if (failureMeta.sawNotEnabled) {
    throw new OcrScanError(
      'not_enabled',
      'Smart camera scanning is not enabled or authorized for this project yet.'
    );
  }

  throw new OcrScanError('failed', failureMeta.lastErrorMessage || 'Failed to scan receipt');
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
