import {
  Category,
  DefaultTransferFeeRule,
  InstaPayFeePreset,
  ManualFeeInputType,
  Transaction,
  TransferFeeMode,
  TransferFeeSettings,
} from '../types';

export const BANK_FEES_CATEGORY_ID = 'cat_bank_transfer_fees';
export const BANK_FEES_CATEGORY_NAME_EN = 'Bank Fees / Transfer Commissions';
export const BANK_FEES_CATEGORY_NAME_AR = 'مصاريف بنكية وعمولات تحويل';
export const BANK_FEES_CATEGORY_ICON = '🏦';

export const DEFAULT_INSTAPAY_PRESET: InstaPayFeePreset = {
  ratePercent: 0.1,
  minFee: 0.5,
  maxFee: 20.0,
};

export const DEFAULT_TRANSFER_FEE_RULE: DefaultTransferFeeRule = {
  enabled: false,
  ruleType: 'none',
  ratePercent: 0.1,
  minCap: 0.5,
  maxCap: 20.0,
  fixedAmount: 0,
};

export const DEFAULT_TRANSFER_FEE_SETTINGS: TransferFeeSettings = {
  instaPayPreset: { ...DEFAULT_INSTAPAY_PRESET },
  defaultRule: { ...DEFAULT_TRANSFER_FEE_RULE },
};

/**
 * Rounds a positive value half-up to 0.01 (2 decimal places).
 */
export function roundHalfUpToCents(val: number): number {
  if (!Number.isFinite(val) || val <= 0) return 0;
  return Math.floor(val * 100 + 0.5) / 100;
}

/**
 * Resolves the active TransferFeeSettings with safe defaults.
 */
export function resolveTransferFeeSettings(
  settings?: Partial<TransferFeeSettings> | null,
): TransferFeeSettings {
  const ip = settings?.instaPayPreset;
  const dr = settings?.defaultRule;
  return {
    instaPayPreset: {
      ratePercent:
        typeof ip?.ratePercent === 'number' && Number.isFinite(ip.ratePercent) && ip.ratePercent >= 0
          ? ip.ratePercent
          : DEFAULT_INSTAPAY_PRESET.ratePercent,
      minFee:
        typeof ip?.minFee === 'number' && Number.isFinite(ip.minFee) && ip.minFee >= 0
          ? ip.minFee
          : DEFAULT_INSTAPAY_PRESET.minFee,
      maxFee:
        typeof ip?.maxFee === 'number' && Number.isFinite(ip.maxFee) && ip.maxFee >= 0
          ? ip.maxFee
          : DEFAULT_INSTAPAY_PRESET.maxFee,
    },
    defaultRule: {
      enabled: Boolean(dr?.enabled && dr?.ruleType && dr.ruleType !== 'none'),
      ruleType: dr?.ruleType || 'none',
      ratePercent:
        typeof dr?.ratePercent === 'number' && Number.isFinite(dr.ratePercent) && dr.ratePercent >= 0
          ? dr.ratePercent
          : DEFAULT_TRANSFER_FEE_RULE.ratePercent,
      minCap:
        typeof dr?.minCap === 'number' && Number.isFinite(dr.minCap) && dr.minCap >= 0
          ? dr.minCap
          : DEFAULT_TRANSFER_FEE_RULE.minCap,
      maxCap:
        typeof dr?.maxCap === 'number' && Number.isFinite(dr.maxCap) && dr.maxCap >= 0
          ? dr.maxCap
          : DEFAULT_TRANSFER_FEE_RULE.maxCap,
      fixedAmount:
        typeof dr?.fixedAmount === 'number' && Number.isFinite(dr.fixedAmount) && dr.fixedAmount >= 0
          ? dr.fixedAmount
          : DEFAULT_TRANSFER_FEE_RULE.fixedAmount,
    },
  };
}

/**
 * Calculates InstaPay fee: rate% of transfer amount (default 0.1%),
 * clamped to [minFee, maxFee] (default [0.50, 20.00]), rounded half-up to 0.01.
 */
export function calculateInstaPayFee(
  transferAmount: number,
  preset?: Partial<InstaPayFeePreset>,
): number {
  if (!Number.isFinite(transferAmount) || transferAmount <= 0) return 0;
  const rate =
    typeof preset?.ratePercent === 'number' && Number.isFinite(preset.ratePercent) && preset.ratePercent >= 0
      ? preset.ratePercent
      : DEFAULT_INSTAPAY_PRESET.ratePercent;
  const minFee =
    typeof preset?.minFee === 'number' && Number.isFinite(preset.minFee) && preset.minFee >= 0
      ? preset.minFee
      : DEFAULT_INSTAPAY_PRESET.minFee;
  const maxFee =
    typeof preset?.maxFee === 'number' && Number.isFinite(preset.maxFee) && preset.maxFee >= 0
      ? preset.maxFee
      : DEFAULT_INSTAPAY_PRESET.maxFee;

  const effectiveMax = maxFee > 0 && maxFee >= minFee ? maxFee : Math.max(minFee, maxFee);
  const rawFee = (transferAmount * rate) / 100;
  const clamped = Math.min(effectiveMax > 0 ? effectiveMax : rawFee, Math.max(minFee, rawFee));
  return roundHalfUpToCents(clamped);
}

/**
 * Calculates manual transfer fee from either a direct amount or a percentage,
 * rounded half-up to 0.01.
 */
export function calculateManualTransferFee(
  transferAmount: number,
  inputType: ManualFeeInputType,
  rawValue: number,
): number {
  if (!Number.isFinite(rawValue) || rawValue <= 0) return 0;
  if (inputType === 'percent') {
    if (!Number.isFinite(transferAmount) || transferAmount <= 0) return 0;
    return roundHalfUpToCents((transferAmount * rawValue) / 100);
  }
  return roundHalfUpToCents(rawValue);
}

/**
 * Calculates transfer fee using the user's configured default rule in Settings.
 */
export function calculateRuleTransferFee(
  transferAmount: number,
  rule?: Partial<DefaultTransferFeeRule>,
  instaPayPreset?: Partial<InstaPayFeePreset>,
): number {
  if (!Number.isFinite(transferAmount) || transferAmount <= 0) return 0;
  if (!rule || !rule.enabled || !rule.ruleType || rule.ruleType === 'none') return 0;

  if (rule.ruleType === 'instapay') {
    return calculateInstaPayFee(transferAmount, instaPayPreset);
  }
  if (rule.ruleType === 'fixed') {
    return roundHalfUpToCents(rule.fixedAmount ?? 0);
  }
  if (rule.ruleType === 'percent_caps') {
    const rate = Math.max(0, rule.ratePercent ?? 0);
    const minCap = Math.max(0, rule.minCap ?? 0);
    const maxCap = Math.max(0, rule.maxCap ?? 0);
    const raw = (transferAmount * rate) / 100;
    let clamped = Math.max(minCap, raw);
    if (maxCap > 0 && maxCap >= minCap) {
      clamped = Math.min(maxCap, clamped);
    }
    return roundHalfUpToCents(clamped);
  }
  return 0;
}

/**
 * Computes the effective transfer fee for any TransferFeeMode.
 */
export function computeTransferFee(params: {
  transferAmount: number;
  mode: TransferFeeMode;
  manualInputType?: ManualFeeInputType;
  manualRawValue?: number;
  feeSettings?: Partial<TransferFeeSettings> | null;
}): number {
  const { transferAmount, mode, manualInputType = 'amount', manualRawValue = 0, feeSettings } = params;
  if (!Number.isFinite(transferAmount) || transferAmount <= 0 || mode === 'none') return 0;
  const resolved = resolveTransferFeeSettings(feeSettings);
  if (mode === 'instapay') {
    return calculateInstaPayFee(transferAmount, resolved.instaPayPreset);
  }
  if (mode === 'manual') {
    return calculateManualTransferFee(transferAmount, manualInputType, manualRawValue);
  }
  if (mode === 'default_rule') {
    return calculateRuleTransferFee(transferAmount, resolved.defaultRule, resolved.instaPayPreset);
  }
  return 0;
}

/**
 * Ensures the "Bank Fees / Transfer Commissions" ("مصاريف بنكية وعمولات تحويل")
 * expense category exists in the category list.
 */
export function ensureBankFeesCategory(
  categories: Category[],
  language: 'en' | 'ar' = 'en',
): { category: Category; updatedCategories: Category[]; created: boolean } {
  const existing = categories.find(
    (c) =>
      c.id === BANK_FEES_CATEGORY_ID ||
      (c.type === 'expense' &&
        (c.name.trim().toLowerCase() === BANK_FEES_CATEGORY_NAME_EN.toLowerCase() ||
          c.name.trim() === BANK_FEES_CATEGORY_NAME_AR)),
  );
  if (existing) {
    return { category: existing, updatedCategories: categories, created: false };
  }
  const now = Date.now();
  const expenseCount = categories.filter((c) => c.type === 'expense').length;
  const newCategory: Category = {
    id: BANK_FEES_CATEGORY_ID,
    name: language === 'ar' ? BANK_FEES_CATEGORY_NAME_AR : BANK_FEES_CATEGORY_NAME_EN,
    icon: BANK_FEES_CATEGORY_ICON,
    type: 'expense',
    budgetLimit: 0,
    orderIndex: expenseCount,
    updatedAt: now,
  };
  return {
    category: newCategory,
    updatedCategories: [...categories, newCategory],
    created: true,
  };
}

/**
 * Builds the deterministic linked fee Expense transaction for a parent Transfer transaction.
 */
export function buildLinkedTransferFeeTransaction(
  parentTransfer: Transaction,
  feeCategory: Category,
  language: 'en' | 'ar' = 'en',
  existingFeeTx?: Transaction,
): Transaction {
  const feeAmount = roundHalfUpToCents(parentTransfer.transferFee || 0);
  const feeTxId = existingFeeTx?.id || parentTransfer.linkedFeeTxId || `tx_fee_${parentTransfer.id}`;
  const isInstaPay = parentTransfer.transferFeeMode === 'instapay';
  const defaultDescEn = isInstaPay
    ? `InstaPay Transfer Fee${parentTransfer.description ? ` (${parentTransfer.description})` : ''}`
    : `Transfer Fee${parentTransfer.description ? ` (${parentTransfer.description})` : ''}`;
  const defaultDescAr = isInstaPay
    ? `رسوم تحويل إنستا باي${parentTransfer.description ? ` (${parentTransfer.description})` : ''}`
    : `رسوم تحويل${parentTransfer.description ? ` (${parentTransfer.description})` : ''}`;

  const rawPool = (parentTransfer.transferFeeBudgetPool || existingFeeTx?.budgetPool || 'daily') as string;
  const pool: 'daily' | 'fixed' | 'outings' | 'oneoff' =
    rawPool === 'emergency'
      ? 'oneoff'
      : rawPool === 'fixed' || rawPool === 'outings' || rawPool === 'oneoff'
      ? rawPool
      : 'daily';

  return {
    id: feeTxId,
    type: 'expense',
    amount: feeAmount,
    date: parentTransfer.date,
    time: parentTransfer.time || '',
    accountId: parentTransfer.accountId,
    categoryId: feeCategory.id,
    categoryName: feeCategory.name,
    categoryIcon: feeCategory.icon,
    description: language === 'ar' ? defaultDescAr : defaultDescEn,
    budgetPool: pool,
    feeOfTransferId: parentTransfer.id,
    isFromRecurring: parentTransfer.isFromRecurring,
    recurringRuleId: parentTransfer.recurringRuleId,
    createdAt: existingFeeTx?.createdAt ?? parentTransfer.createdAt + 1,
    updatedAt: Date.now(),
  };
}
