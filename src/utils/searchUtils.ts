/**
 * Shared Transaction Search & Text Normalization Utilities
 * Normalizes Arabic (diacritics/tatweel/letter variants) and English text for flawless search across all views.
 */

import { Account, Category, Transaction } from '../types';

export interface TransactionSearchContext {
  accounts?: Account[];
  categories?: Category[];
  currencySymbol?: string;
}

/**
 * Normalizes text for search comparisons:
 * - Trims and lowercases
 * - Strips Arabic diacritics (tashkeel: fathatan, dammatan, kasratan, fatha, damma, kasra, shadda, sukun, etc.)
 * - Strips Arabic tatweel / kashida (ـ)
 * - Unifies Arabic letter variants:
 *     أ, إ, آ, ٱ -> ا
 *     ى -> ي
 *     ة -> ه
 */
export function normalizeSearchText(text?: string | null): string {
  if (text === undefined || text === null) return '';
  return text
    .toString()
    .trim()
    .toLowerCase()
    // Strip Arabic diacritics / tashkeel and tatweel
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    // Unify Alef forms
    .replace(/[أإآٱ]/g, 'ا')
    // Unify Alef Maksura to Ya
    .replace(/ى/g, 'ي')
    // Unify Ta Marbuta to Ha
    .replace(/ة/g, 'ه');
}

/**
 * Evaluates whether a transaction matches a search query.
 * Matches against:
 * 1. Comments / Notes / Descriptions: tx.note, tx.comment, tx.description, tx.title (optional chaining)
 * 2. Category name: tx.categoryName and looked-up category name
 * 3. Account name: tx.fromAccountName, tx.toAccountName, and looked-up source/destination account names
 * 4. Amount: raw amount and formatted numbers (with currency symbols, commas, decimals)
 *
 * An empty query returns true (returns all transactions).
 */
export function matchesTransactionSearch(
  tx: Transaction | any,
  query?: string | null,
  context?: TransactionSearchContext
): boolean {
  if (!query || !query.trim()) return true;

  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  // 1. Comments / Notes / Descriptions / Titles (accessed safely via optional chaining)
  const commentFields = [
    tx?.note,
    tx?.comment,
    tx?.description,
    tx?.title,
  ];

  // 2. Category Name
  let resolvedCategoryName = tx?.categoryName;
  if (!resolvedCategoryName && context?.categories && tx?.categoryId) {
    const foundCat = context.categories.find((c) => c.id === tx.categoryId);
    if (foundCat) resolvedCategoryName = foundCat.name;
  }
  const categoryFields = [
    tx?.categoryName,
    resolvedCategoryName,
  ];

  // 3. Account Name (including fromAccountName and toAccountName for transfers)
  let resolvedSourceName = tx?.fromAccountName;
  let resolvedDestName = tx?.toAccountName;

  if (context?.accounts) {
    if (tx?.accountId) {
      const srcAcc = context.accounts.find((a) => a.id === tx.accountId);
      if (srcAcc) resolvedSourceName = srcAcc.name;
    }
    if (tx?.toAccountId) {
      const dstAcc = context.accounts.find((a) => a.id === tx.toAccountId);
      if (dstAcc) resolvedDestName = dstAcc.name;
    }
  }

  const accountFields = [
    tx?.fromAccountName,
    tx?.toAccountName,
    resolvedSourceName,
    resolvedDestName,
  ];

  // 4. Amount (Raw and Formatted)
  const amountFields: string[] = [];
  if (tx?.amount !== undefined && tx?.amount !== null && !isNaN(Number(tx.amount))) {
    const num = Number(tx.amount);
    const rawAmt = tx.amount.toString();
    const formattedAmt = num.toLocaleString();
    const fixedAmt = num.toFixed(2);
    amountFields.push(rawAmt, formattedAmt, fixedAmt);

    if (context?.currencySymbol) {
      const sym = context.currencySymbol;
      amountFields.push(
        `${sym}${rawAmt}`,
        `${sym} ${rawAmt}`,
        `${sym}${formattedAmt}`,
        `${sym} ${formattedAmt}`,
        `${rawAmt}${sym}`,
        `${rawAmt} ${sym}`,
        `${formattedAmt}${sym}`,
        `${formattedAmt} ${sym}`
      );
    }
  }

  // 5. Date (optional date search support)
  const dateFields = [tx?.date];

  // Check if any field matches the normalized query
  const allTargets = [
    ...commentFields,
    ...categoryFields,
    ...accountFields,
    ...amountFields,
    ...dateFields,
  ];

  return allTargets.some((target) => {
    if (!target) return false;
    const normalizedTarget = normalizeSearchText(target);
    return normalizedTarget.includes(normalizedQuery);
  });
}

/**
 * Filter an array of transactions by search query using normalized matching.
 * An empty query returns all transactions untouched.
 */
export function filterTransactionsBySearch<T = any>(
  transactions: T[],
  query?: string | null,
  context?: TransactionSearchContext
): T[] {
  if (!query || !query.trim()) return transactions;
  return transactions.filter((tx) => matchesTransactionSearch(tx, query, context));
}
