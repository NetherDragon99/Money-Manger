/**
 * Global Number & Currency Formatting Utilities
 * Standard thousands separators using en-US grouping commas (e.g. 10,000 and 1,000,000).
 * Safe parsing functions that strip grouping commas first.
 */

import React from 'react';
import { Transaction } from '../types';

/**
 * Formats a number or string with thousands separators using en-US grouping commas.
 * Preserves decimals if present or rounds to fixed decimals if specified.
 */
export function formatNumberWithCommas(
  amount: number | string | null | undefined,
  decimals?: number
): string {
  if (amount === undefined || amount === null || amount === '') return '0';
  const cleanStr = typeof amount === 'number' ? amount.toString() : String(amount).replace(/,/g, '').trim();
  const num = typeof amount === 'number' ? amount : parseFloat(cleanStr);
  if (isNaN(num)) return '0';

  const isNeg = num < 0;
  const absNum = Math.abs(num);
  let [intPart, decPart] = (decimals !== undefined ? absNum.toFixed(decimals) : absNum.toString()).split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = isNeg ? '-' : '';
  return decPart !== undefined ? `${sign}${formattedInt}.${decPart}` : `${sign}${formattedInt}`;
}

/**
 * Formats a live raw input string into comma-separated format without losing trailing dots or partial input.
 */
export function formatDisplayNumber(str: string | number | null | undefined): string {
  if (str === null || str === undefined || str === '') return '0';
  const s = String(str).replace(/,/g, '').trim();
  if (s === '') return '0';
  const isNeg = s.startsWith('-');
  const unsigned = isNeg ? s.slice(1) : s;
  const [intPart, decPart] = unsigned.split('.');
  const formattedInt = (intPart || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = isNeg ? '-' : '';
  return decPart !== undefined ? `${sign}${formattedInt}.${decPart}` : `${sign}${formattedInt}`;
}

/**
 * Safely parses any number, string, or comma-formatted amount into a clean plain number.
 * Always strips commas first so "10,000" is never parsed as 10.
 */
export function parseFormattedNumber(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const clean = String(val).replace(/,/g, '').trim();
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Strips all commas and non-numeric chars from an input string, preserving one decimal dot and optional leading minus.
 */
export function cleanNumericString(val: string, allowNegative = false): string {
  if (!val) return '';
  let cleaned = String(val).replace(/,/g, '');
  if (allowNegative) {
    const isNeg = cleaned.startsWith('-');
    cleaned = (isNeg ? '-' : '') + cleaned.replace(/[^0-9.]/g, '');
  } else {
    cleaned = cleaned.replace(/[^0-9.]/g, '');
  }
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    cleaned = parts[0] + '.' + parts.slice(1).join('');
  }
  return cleaned;
}

/**
 * Handles text input change while preserving caret position and applying grouping commas.
 */
export function handleNumericInputChange(
  e: React.ChangeEvent<HTMLInputElement>,
  onChange: (cleanVal: string, formattedVal: string) => void,
  allowNegative = false
) {
  const input = e.target;
  const rawValue = input.value;
  const selectionStart = input.selectionStart || 0;
  const beforeCursor = rawValue.slice(0, selectionStart);
  const nonCommasBefore = beforeCursor.replace(/,/g, '').length;

  let cleaned = cleanNumericString(rawValue, allowNegative);

  // Prevent leading zeros unless followed by decimal point (e.g. "05" -> "5")
  if (cleaned.length > 1 && cleaned.startsWith('0') && !cleaned.startsWith('0.')) {
    cleaned = cleaned.replace(/^0+/, '') || '0';
  } else if (cleaned.length > 2 && cleaned.startsWith('-0') && !cleaned.startsWith('-0.')) {
    cleaned = '-' + (cleaned.slice(1).replace(/^0+/, '') || '0');
  }

  const [intPart, decPart] = cleaned.split('.');
  const isNeg = intPart.startsWith('-');
  const pureInt = isNeg ? intPart.slice(1) : intPart;
  const formattedInt = pureInt.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const formatted = (isNeg ? '-' : '') + (decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt);

  onChange(cleaned, formatted);

  // Preserve caret position smoothly
  requestAnimationFrame(() => {
    if (!input) return;
    let newCursor = 0;
    let counted = 0;
    for (let i = 0; i < input.value.length; i++) {
      if (input.value[i] !== ',') {
        counted++;
      }
      if (counted === nonCommasBefore) {
        newCursor = i + 1;
        break;
      }
    }
    if (nonCommasBefore === 0) newCursor = 0;
    input.setSelectionRange(newCursor, newCursor);
  });
}

/**
 * Checks whether a transaction is a manual balance adjustment.
 * Checks isAdjustment flag, ID prefix, and bilingual category / description strings.
 */
export function isManualAdjustment(tx?: Partial<Transaction> | null): boolean {
  if (!tx) return false;
  if ((tx as any).isAdjustment) return true;
  if (tx.id && typeof tx.id === 'string' && tx.id.startsWith('tx_adj_')) return true;
  const catName = (tx.categoryName || '').trim().toLowerCase();
  if (catName === 'manual adjustment' || catName === 'تعديل يدوي') return true;
  const desc = (tx.description || '').trim().toLowerCase();
  if (desc.startsWith('manual adjustment') || desc.startsWith('تعديل يدوي')) return true;
  return false;
}
