import { BillExtra, BillItem } from '../types';
import { generateBillId, toMinor } from './billSplitEngine';

export interface ParsedReceiptLineItem {
  id: string;
  name: string;
  qty: number;
  /** Value parsed directly from text (interpretation depends on priceMode in preview) */
  rawAmountMinor: number;
}

export interface ParsedReceiptResult {
  items: ParsedReceiptLineItem[];
  extras: BillExtra[];
  statedTotalMinor?: number;
  unparsedLines: string[];
}

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const EASTERN_ARABIC = '۰۱۲۳۴۵۶۷۸۹';

/**
 * Normalizes Arabic-Indic / Eastern Arabic numerals, Arabic decimal/thousand separators,
 * multiplication symbols (×, ✕, *), and currency words so any Arabic or English receipt
 * line parses reliably.
 */
export function normalizeReceiptText(raw: string): string {
  let out = raw || '';
  out = out.replace(/[٠-٩]/g, (ch) => String(ARABIC_INDIC.indexOf(ch)));
  out = out.replace(/[۰-۹]/g, (ch) => String(EASTERN_ARABIC.indexOf(ch)));
  out = out
    .replace(/٫/g, '.')
    .replace(/،/g, ',')
    .replace(/[×✕✖]/g, ' x ')
    .replace(/٪/g, '%')
    .replace(/\b(EGP|LE|L\.E\.|SAR|USD|AED|EUR|GBP)\b/gi, ' ')
    .replace(/(^|[\s\d])(ج\.م\.?|جنيه|ريال|درهم)(?=$|[\s\d])/g, '$1 ')
    .replace(/[£$]/g, ' ');
  return out;
}

function parseNumberToken(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

const TOTAL_KEYWORDS = /^(total|grand\s*total|net\s*total|amount\s*due|balance\s*due|الاجمالي|الإجمالي|اجمالي|إجمالي|المجموع|الصافي\s*المطلوب|المطلوب|الحساب)/i;
const SUBTOTAL_KEYWORDS = /^(sub\s*total|subtotal|قبل\s*الضريبة|المجموع\s*الفرعي)/i;
const SERVICE_KEYWORDS = /(service|srv|خدمة|الخدمة|خدمه)/i;
const TAX_KEYWORDS = /(vat|tax|ضريبة|الضريبة|ضريبه|قيمة\s*مضافة|ق\.م)/i;
const DELIVERY_KEYWORDS = /(delivery|shipping|توصيل|التوصيل|دليفري|ديليفري)/i;
const TIP_KEYWORDS = /(tip|gratuity|بخشيش|إكرامية|اكرامية)/i;
const DISCOUNT_KEYWORDS = /(discount|promo|coupon|خصم|الخصم)/i;

function makeExtraId(kind: string, idx: number): string {
  return `extra_parsed_${kind}_${idx}_${generateBillId().slice(0, 6)}`;
}

/**
 * Parses pasted multi-line receipt text (Arabic or English) into candidate items, extras, and total.
 */
export function parseBillText(rawText: string): ParsedReceiptResult {
  const normalized = normalizeReceiptText(rawText);
  const lines = normalized
    .split(/\r?\n/)
    .map((l) => l.replace(/\.{2,}|_{2,}|-{3,}/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const items: ParsedReceiptLineItem[] = [];
  const extras: BillExtra[] = [];
  const unparsedLines: string[] = [];
  let statedTotalMinor: number | undefined;

  lines.forEach((line, idx) => {
    // 1. Subtotal line -> informational, skip adding as item
    if (SUBTOTAL_KEYWORDS.test(line)) {
      return;
    }

    // 2. Total line
    if (TOTAL_KEYWORDS.test(line)) {
      const numMatch = line.match(/(\d+(?:,\d{3})*(?:\.\d{1,2})?)\s*$/);
      if (numMatch) {
        const val = parseNumberToken(numMatch[1]);
        if (val !== null && val > 0) {
          statedTotalMinor = toMinor(val);
          return;
        }
      }
    }

    // 3. Check for service / tax / delivery / tip / discount lines
    const pctMatch = line.match(/(-?\d+(?:\.\d{1,2})?)\s*%/);
    const trailingNumMatch = line.match(/(-?\d+(?:,\d{3})*(?:\.\d{1,2})?)\s*$/);

    const detectExtraKind = (): { kind: BillExtra['kind']; sign: 1 | -1; defaultDist: BillExtra['distribution']; defaultLabel: string } | null => {
      if (SERVICE_KEYWORDS.test(line)) return { kind: 'service', sign: 1, defaultDist: 'proportional', defaultLabel: 'Service' };
      if (TAX_KEYWORDS.test(line)) return { kind: 'tax', sign: 1, defaultDist: 'proportional', defaultLabel: 'VAT / Tax' };
      if (DELIVERY_KEYWORDS.test(line)) return { kind: 'delivery', sign: 1, defaultDist: 'equal', defaultLabel: 'Delivery' };
      if (TIP_KEYWORDS.test(line)) return { kind: 'tip', sign: 1, defaultDist: 'proportional', defaultLabel: 'Tip' };
      if (DISCOUNT_KEYWORDS.test(line)) return { kind: 'discount', sign: -1, defaultDist: 'proportional', defaultLabel: 'Discount' };
      return null;
    };

    const extraMeta = detectExtraKind();
    if (extraMeta && (pctMatch || trailingNumMatch)) {
      if (pctMatch && !trailingNumMatch) {
        const pct = Math.abs(parseNumberToken(pctMatch[1]) || 0);
        if (pct > 0) {
          extras.push({
            id: makeExtraId(extraMeta.kind, idx),
            kind: extraMeta.kind,
            label: extraMeta.defaultLabel,
            valueType: 'percent',
            value: pct,
            base: extraMeta.kind === 'tax' && extras.some((e) => e.kind === 'service') ? 'subtotal_plus_previous' : 'subtotal',
            sign: extraMeta.sign,
            distribution: extraMeta.defaultDist,
            exemptPersonIds: [],
            customAmountsMinor: {},
            exemptMode: 'redistribute',
          });
          return;
        }
      } else if (pctMatch && trailingNumMatch) {
        // e.g. "Service 12% 48.00" -> use percent 12% accurately
        const pct = Math.abs(parseNumberToken(pctMatch[1]) || 0);
        if (pct > 0) {
          extras.push({
            id: makeExtraId(extraMeta.kind, idx),
            kind: extraMeta.kind,
            label: `${extraMeta.defaultLabel} ${pct}%`,
            valueType: 'percent',
            value: pct,
            base: extraMeta.kind === 'tax' && extras.some((e) => e.kind === 'service') ? 'subtotal_plus_previous' : 'subtotal',
            sign: extraMeta.sign,
            distribution: extraMeta.defaultDist,
            exemptPersonIds: [],
            customAmountsMinor: {},
            exemptMode: 'redistribute',
          });
          return;
        }
      } else if (trailingNumMatch) {
        const fixed = Math.abs(parseNumberToken(trailingNumMatch[1]) || 0);
        if (fixed > 0) {
          extras.push({
            id: makeExtraId(extraMeta.kind, idx),
            kind: extraMeta.kind,
            label: extraMeta.defaultLabel,
            valueType: 'fixed',
            value: toMinor(fixed),
            base: 'subtotal',
            sign: extraMeta.sign,
            distribution: extraMeta.defaultDist,
            exemptPersonIds: [],
            customAmountsMinor: {},
            exemptMode: 'redistribute',
          });
          return;
        }
      }
    }

    // 4. Item line patterns:
    // Pattern A: "كشري 45 x 2" or "Pepsi 20 x4" -> price then qty
    const priceThenQty = line.match(/^(.+?)\s+(\d+(?:,\d{3})*(?:\.\d{1,2})?)\s*[x*]\s*(\d+(?:\.\d{1,2})?)$/i);
    if (priceThenQty) {
      const name = priceThenQty[1].trim();
      const price = parseNumberToken(priceThenQty[2]);
      const qty = parseNumberToken(priceThenQty[3]);
      if (name && price !== null && qty !== null && price > 0 && qty > 0) {
        items.push({ id: `parsed_${idx}_${generateBillId().slice(0, 6)}`, name, qty, rawAmountMinor: toMinor(price) });
        return;
      }
    }

    // Pattern B: "2x Pizza 90" or "2 Pizza 90" or "2 * برجر 120" -> qty first, name, price last
    const qtyFirst = line.match(/^(\d+(?:\.\d{1,2})?)\s*[x*]?\s+(.+?)\s+(\d+(?:,\d{3})*(?:\.\d{1,2})?)$/i);
    if (qtyFirst) {
      const qty = parseNumberToken(qtyFirst[1]);
      const name = qtyFirst[2].trim();
      const price = parseNumberToken(qtyFirst[3]);
      if (name && price !== null && qty !== null && price > 0 && qty > 0 && /[A-Za-z\u0600-\u06FF]/.test(name)) {
        items.push({ id: `parsed_${idx}_${generateBillId().slice(0, 6)}`, name, qty, rawAmountMinor: toMinor(price) });
        return;
      }
    }

    // Pattern C: "Pizza x3 270" -> name, qty marker, price
    const midQty = line.match(/^(.+?)\s+[x*]\s*(\d+(?:\.\d{1,2})?)\s+(\d+(?:,\d{3})*(?:\.\d{1,2})?)$/i);
    if (midQty) {
      const name = midQty[1].trim();
      const qty = parseNumberToken(midQty[2]);
      const price = parseNumberToken(midQty[3]);
      if (name && price !== null && qty !== null && price > 0 && qty > 0) {
        items.push({ id: `parsed_${idx}_${generateBillId().slice(0, 6)}`, name, qty, rawAmountMinor: toMinor(price) });
        return;
      }
    }

    // Pattern D: Simple "Name 120" or "Name - 120.50"
    const simpleLine = line.match(/^(.+?)\s*[:\-–]?\s+(\d+(?:,\d{3})*(?:\.\d{1,2})?)$/);
    if (simpleLine) {
      const name = simpleLine[1].replace(/[:\-–]+$/, '').trim();
      const price = parseNumberToken(simpleLine[2]);
      if (name && price !== null && price > 0 && /[A-Za-z\u0600-\u06FF]/.test(name)) {
        items.push({ id: `parsed_${idx}_${generateBillId().slice(0, 6)}`, name, qty: 1, rawAmountMinor: toMinor(price) });
        return;
      }
    }

    unparsedLines.push(line);
  });

  return {
    items,
    extras,
    statedTotalMinor,
    unparsedLines,
  };
}

export function buildItemsFromParsed(
  parsedItems: ParsedReceiptLineItem[],
  priceMode: 'unit' | 'line_total'
): BillItem[] {
  return parsedItems.map((p) => {
    const qty = p.qty > 0 ? p.qty : 1;
    const unitPriceMinor =
      priceMode === 'line_total' && qty > 0
        ? Math.round(p.rawAmountMinor / qty)
        : Math.round(p.rawAmountMinor);
    return {
      id: `item_${generateBillId().slice(0, 10)}`,
      name: p.name,
      qty,
      unitPriceMinor,
      mode: 'everyone',
      claims: {},
    };
  });
}
