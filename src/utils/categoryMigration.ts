import { Category, Transaction, RecurringTransaction } from '../types';

export const LEGACY_SEEDED_EXPENSE_CATEGORY_TYPO = 'Daily express';
export const CORRECTED_SEEDED_EXPENSE_CATEGORY_NAME = 'Daily Expenses';

/**
 * Checks whether a category strictly matches the legacy seeded default category that had the typo.
 * The original seeded default was:
 * - type: 'expense'
 * - name: 'Daily express' (case-insensitive trim)
 * - icon: '🥐' (croissant) OR seeded id 'cat_exp_2'
 */
export function isStrictSeededDailyExpressCategory(cat: Category | null | undefined): boolean {
  if (!cat || cat.type !== 'expense') return false;
  const trimmed = (cat.name || '').trim().toLowerCase();
  if (trimmed !== 'daily express') return false;

  // Strictly matches seeded default: id was cat_exp_2 or icon was the default '🥐'
  return cat.id === 'cat_exp_2' || cat.icon === '🥐';
}

export interface CategoryTypoMigrationResult {
  categories: Category[];
  transactions: Transaction[];
  recurringTransactions: RecurringTransaction[];
  hasChanges: boolean;
  migratedCategoryIds: string[];
}

/**
 * Migrates user categories, transactions, and recurring transactions to rename
 * 'Daily express' to 'Daily Expenses' ONLY if it strictly matches the seeded default.
 * Stamps updatedAt with nowMs on all modified entities for reliable sync propagation.
 */
export function migrateCategoryTypo(
  rawCategories: Category[],
  rawTransactions: Transaction[],
  rawRecurring: RecurringTransaction[],
  nowMs: number = Date.now()
): CategoryTypoMigrationResult {
  const targetCategoryIds = new Set<string>();
  let categoriesChanged = false;

  const migratedCategories = rawCategories.map((cat) => {
    if (isStrictSeededDailyExpressCategory(cat)) {
      targetCategoryIds.add(cat.id);
      categoriesChanged = true;
      return {
        ...cat,
        name: CORRECTED_SEEDED_EXPENSE_CATEGORY_NAME,
        updatedAt: nowMs,
      };
    }
    return cat;
  });

  let txsChanged = false;
  const migratedTransactions = rawTransactions.map((tx) => {
    const matchesTargetId = tx.categoryId ? targetCategoryIds.has(tx.categoryId) : false;
    const matchesTypoName = Boolean(tx.categoryName && tx.categoryName.trim().toLowerCase() === 'daily express');

    if (matchesTargetId || matchesTypoName) {
      txsChanged = true;
      return {
        ...tx,
        categoryName: CORRECTED_SEEDED_EXPENSE_CATEGORY_NAME,
        updatedAt: nowMs,
      };
    }
    return tx;
  });

  let rulesChanged = false;
  const migratedRecurring = rawRecurring.map((rule) => {
    const matchesTargetId = rule.categoryId ? targetCategoryIds.has(rule.categoryId) : false;
    const matchesTypoName = Boolean(rule.categoryName && rule.categoryName.trim().toLowerCase() === 'daily express');

    if (matchesTargetId || matchesTypoName) {
      rulesChanged = true;
      return {
        ...rule,
        categoryName: CORRECTED_SEEDED_EXPENSE_CATEGORY_NAME,
        updatedAt: nowMs,
      };
    }
    return rule;
  });

  return {
    categories: categoriesChanged ? migratedCategories : rawCategories,
    transactions: txsChanged ? migratedTransactions : rawTransactions,
    recurringTransactions: rulesChanged ? migratedRecurring : rawRecurring,
    hasChanges: categoriesChanged || txsChanged || rulesChanged,
    migratedCategoryIds: Array.from(targetCategoryIds),
  };
}
