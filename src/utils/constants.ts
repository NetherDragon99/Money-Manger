import { Account, Category, AppSettings, ResolvedMessageLanguage } from '../types';
import { DEFAULT_TRANSFER_FEE_SETTINGS } from './transferFee';

export function resolveMessageLanguage(
  settings?: Pick<AppSettings, 'language' | 'messageLanguage'> | null
): ResolvedMessageLanguage {
  const mode = settings?.messageLanguage || 'app';
  if (mode === 'en') return 'en';
  if (mode === 'ar_eg') return 'ar_eg';
  return settings?.language === 'ar' ? 'ar_eg' : 'en';
}

export const DEFAULT_TOAST_DURATION_SECONDS = 5;
export const MIN_TOAST_DURATION_SECONDS = 3;
export const MAX_TOAST_DURATION_SECONDS = 15;
export const IMPORTANT_TOAST_MIN_MS = 7000;

export function resolveToastDismissMs(
  settings?: Pick<AppSettings, 'toastDurationSeconds' | 'toastManualDismissOnly'> | null,
  options?: { hasAction?: boolean; explicitDuration?: number }
): number | null {
  if (settings?.toastManualDismissOnly) {
    return null;
  }
  const rawSec =
    typeof settings?.toastDurationSeconds === 'number' && !Number.isNaN(settings.toastDurationSeconds)
      ? settings.toastDurationSeconds
      : DEFAULT_TOAST_DURATION_SECONDS;
  const clampedSec = Math.min(
    MAX_TOAST_DURATION_SECONDS,
    Math.max(MIN_TOAST_DURATION_SECONDS, Math.round(rawSec))
  );
  const baseMs = clampedSec * 1000;
  const explicitMs =
    typeof options?.explicitDuration === 'number' && options.explicitDuration > 0
      ? options.explicitDuration
      : 0;
  if (options?.hasAction) {
    return Math.max(baseMs, IMPORTANT_TOAST_MIN_MS, explicitMs);
  }
  if (explicitMs > 0) {
    return Math.max(baseMs, explicitMs);
  }
  return baseMs;
}

export const DEFAULT_ACCOUNTS: Account[] = [
  {
    id: 'default_cash',
    name: 'Cash Wallet',
    icon: '💵',
    balance: 0,
    isPrivate: false,
    customMonthStartDay: 'default',
    notes: 'Daily cash and wallet balance',
    accountRole: 'spending',
  },
];

export const LEGACY_SEEDED_EXPENSE_CATEGORY_TYPO = 'Daily express';
export const CORRECTED_SEEDED_EXPENSE_CATEGORY_NAME = 'Daily Expenses';

export const DEFAULT_EXPENSE_CATEGORIES: Array<{ name: string; icon: string }> = [
  { name: 'Groceries & Supermarket', icon: '🍲' },
  { name: 'Dining & Restaurants', icon: '🍔' },
  { name: 'Housing & Rent', icon: '🏠' },
  { name: 'Bills & Utilities', icon: '💡' },
  { name: 'Public Transportation', icon: '🚕' },
  { name: 'Fuel & Car Maintenance', icon: '⛽' },
  { name: 'Shopping & Clothes', icon: '🛍️' },
  { name: 'Health & Pharmacy', icon: '💊' },
  { name: 'Gym & Sports', icon: '🏋️' },
  { name: 'Entertainment & Games', icon: '🎮' },
  { name: 'Electronics & Software', icon: '💻' },
  { name: 'Education & Books', icon: '📚' },
  { name: 'Travel & Vacations', icon: '✈️' },
  { name: 'Personal Care & Beauty', icon: '🧴' },
  { name: 'Gifts & Donations', icon: '🎁' },
  { name: 'Other Expenses', icon: '📦' },
];

export const DEFAULT_INCOME_CATEGORIES: Array<{ name: string; icon: string }> = [
  { name: 'Salary', icon: '💰' },
  { name: 'Freelance & Side Hustle', icon: '💼' },
  { name: 'Investments & Dividends', icon: '📈' },
  { name: 'Bonus & Grants', icon: '🎉' },
  { name: 'Gift Received', icon: '🎁' },
  { name: 'Other Income', icon: '➕' },
];

export const INITIAL_CATEGORIES: Category[] = [
  ...DEFAULT_EXPENSE_CATEGORIES.map((cat, index) => ({
    id: `cat_exp_${index + 1}`,
    name: cat.name,
    icon: cat.icon,
    type: 'expense' as const,
    budgetLimit: 0,
    orderIndex: index,
  })),
  ...DEFAULT_INCOME_CATEGORIES.map((cat, index) => ({
    id: `cat_inc_${index + 1}`,
    name: cat.name,
    icon: cat.icon,
    type: 'income' as const,
    budgetLimit: 0,
    orderIndex: DEFAULT_EXPENSE_CATEGORIES.length + index,
  })),
];

export const DEFAULT_SETTINGS: AppSettings = {
  weekStartDay: 'sunday',
  defaultMonthStartDay: 1,
  language: 'en',
  messageLanguage: 'app',
  themeMode: 'system',
  toastDurationSeconds: DEFAULT_TOAST_DURATION_SECONDS,
  toastManualDismissOnly: false,
  currencySymbol: '£',
  userProfile: {
    name: 'My Profile',
    avatarEmoji: '👤',
  },
  smartBudget: {
    baseline: {
      isPaused: true,
    },
    updatedAt: 0,
  },
  transferFeeSettings: DEFAULT_TRANSFER_FEE_SETTINGS,
};

export const EMOJI_PICKER_GROUPS: Record<string, string[]> = {
  'Finance & Accounts': [
    '🏦', '🏧', '👛', '🪙', '💵', '💶', '💷', '💴', '💳', '🔒',
    '🗄️', '🐷', '💰', '📈', '📉', '💎', '🧾', '🏛️', '⚖️', '💼',
    '💹', '🛡️', '🏷️', '📊', '💸', '🔑', '📦', '🧮', '🥇', '🥈',
    '🥉', '⭐'
  ],
  'Food & Dining': [
    '🍔', '🍕', '🍣', '🍲', '🥐', '🍟', '🥪', '🥗', '☕', '🍺',
    '🍷', '🍎', '🥦', '🍓', '🍰', '🥞', '🍩', '🥑', '🌮', '🥩',
    '🍜', '🍛', '🍱', '🍦', '🧃', '🍵', '🥂', '🍿', '🧁', '🍪',
    '🧆', '🥙', '🌭', '🍳', '🥖', '🍉'
  ],
  'Shopping & Lifestyle': [
    '🛍️', '🛒', '👕', '👗', '👟', '👠', '👒', '💄', '💍', '🕶️',
    '📦', '⌚', '🧥', '🩳', '👜', '🎒', '🧦', '🧣', '👛', '📿',
    '🧴', '💈', '🪒', '✂️', '🎁', '🎮', '🎬', '🎟️', '🎧', '🎸',
    '🎹', '🎨', '🎲', '🎳', '🎤', '🎯'
  ],
  'Housing & Utilities': [
    '🏠', '🏢', '🛋️', '🔑', '🧹', '🪴', '💡', '🚿', '🧺', '🐾',
    '🐱', '🐶', '🛌', '🚪', '🪟', '🪑', '🛁', '🔧', '🔨', '🪛',
    '🧯', '🧱', '📡', '🔌', '🔋', '💧', '❄️', '☀️', '📶', '🗑️',
    '🏡', '🧽'
  ],
  'Transport & Travel': [
    '🚌', '🚕', '🚗', '🚇', '🚆', '✈️', '🚲', '🛴', '⛽', '🅿️',
    '🛳️', '🚁', '🏍️', '🚢', '🏎️', '🚙', '🚊', '⛵', '🚤', '🚀',
    '🚏', '🛣️', '🚥', '🎫', '🧳', '🛞', '🗺️', '🏝️', '🏖️', '🏨',
    '🛂', '🧭'
  ],
  'Health, Education & Family': [
    '💊', '🩺', '🏥', '🩹', '💉', '🦷', '🏃', '💪', '🏋️', '🏊',
    '🚴', '🍏', '🧼', '🚑', '🧘', '👶', '🍼', '🎓', '📚', '📖',
    '✏️', '📝', '🔬', '💻', '🏫', '🎒', '🧠', '📁', '🖨️', '📅',
    '🧑‍🧑‍🧒', '🧸'
  ],
};
