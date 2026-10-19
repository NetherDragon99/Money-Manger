import { Account, Category, AppSettings } from '../types';

export const DEFAULT_ACCOUNTS: Account[] = [
  {
    id: 'default_cash',
    name: 'Cash Wallet',
    icon: '💵',
    balance: 0,
    isPrivate: false,
    customMonthStartDay: 'default',
    notes: 'Daily cash and wallet balance',
  },
];

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
  themeMode: 'dark',
  currencySymbol: '£',
  userProfile: {
    name: 'My Profile',
    avatarEmoji: '👤',
  },
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
