import { Account, Category, AppSettings } from '../types';

export const DEFAULT_ACCOUNTS: Account[] = [
  {
    id: 'default_cash',
    name: 'Cash',
    icon: '💵',
    balance: 0,
    isPrivate: false,
    customMonthStartDay: 'default',
    notes: '',
  },
];

export const DEFAULT_EXPENSE_CATEGORIES: Array<{ name: string; icon: string }> = [
  { name: 'Work transportation', icon: '🚌' },
  { name: 'Daily express', icon: '🥐' },
  { name: 'Meal', icon: '🍔' },
  { name: 'Social', icon: '👥' },
  { name: 'Telephone', icon: '📞' },
  { name: 'Fuel', icon: '⛽' },
  { name: 'Shopping', icon: '🛍️' },
  { name: 'Others', icon: '🚫' },
  { name: 'Food', icon: '🍲' },
  { name: 'Fruit', icon: '🍎' },
  { name: 'Transportation', icon: '🚕' },
  { name: 'Vegetable', icon: '🥦' },
  { name: 'Entertainment', icon: '🎮' },
  { name: 'Beauty', icon: '💄' },
  { name: 'Sport', icon: '⚽' },
  { name: 'Clothing', icon: '👕' },
  { name: 'Health', icon: '💊' },
  { name: 'Pet', icon: '🐾' },
  { name: 'GYM', icon: '💪' },
  { name: 'Reading', icon: '📚' },
  { name: 'Housing', icon: '🏠' },
  { name: 'Car', icon: '🚗' },
  { name: 'Repair', icon: '🛠️' },
  { name: 'Personal Insurance', icon: '🛡️' },
  { name: 'Personal care products', icon: '🧴' },
  { name: 'Education', icon: '🎓' },
  { name: 'Electronic', icon: '💻' },
  { name: 'Gift', icon: '🎁' },
  { name: 'Donate', icon: '🤝' },
  { name: 'Travel', icon: '✈️' },
  { name: 'Bills & Utilities', icon: '💡' },
  { name: 'Finance', icon: '📈' },
  { name: 'Fitness', icon: '🏃' },
  { name: 'Music', icon: '🎧' },
  { name: 'Productivity', icon: '⚡' },
  { name: 'Parking', icon: '🅿️' },
  { name: 'Rent & Mortgage', icon: '🔑' },
  { name: 'Loan Payments', icon: '💰' },
  { name: 'Bank Fees', icon: '🏦' },
  { name: 'Tax', icon: '🏛️' },
];

export const DEFAULT_INCOME_CATEGORIES: Array<{ name: string; icon: string }> = [
  { name: 'Salary', icon: '💵' },
  { name: 'Bonus', icon: '🎉' },
  { name: 'Investment', icon: '📊' },
  { name: 'Freelance', icon: '💼' },
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
  ENTERTAINMENT: ['🎮', '🎬', '🎟️', '🎧', '🎸', '🎹', '🎨', '🎲', '🎳', '🎪', '🎤', '🎯', '🪄', '🎭'],
  FOOD: ['🍔', '🍕', '🍣', '🍲', '🥐', '🍟', '🥪', '🥗', '☕', '🍺', '🍷', '🍎', '🥦', '🍓', '🍰'],
  SHOPPING: ['🛍️', '🛒', '👕', '👗', '👟', '👠', '👒', '💄', '💍', '🕶️', '📦', '🏷️', '💎', '⌚'],
  LIFE: ['🏠', '🛋️', '🔑', '🧹', '🪴', '💡', '🚿', '🧺', '🐾', '🐱', '🐶', '👶', '🍼', '🛌'],
  PERSONAL: ['👤', '🧑‍💻', '💆', '💈', '🧴', '💅', '✨', '🧘', '🧖', '❤️', '💍', '🎁', '🕶️', '🪒'],
  EDUCATION: ['🎓', '📚', '📖', '✏️', '📝', '📐', '🔬', '💻', '🏫', '📜', '🎒', '🧠', '💡', '🔍'],
  FESTIVAL: ['🎉', '🎂', '🎄', '🎃', '🎆', '🎈', '🎊', '🎁', '💐', '🥂', '🍾', '🏮', '✨', '⭐'],
  OFFICE: ['💼', '📁', '🖨️', '📊', '📈', '📉', '📎', '📌', '🗓️', '📅', '✉️', '📮', '📠', '✒️'],
  TRANSPORTATION: ['🚌', '🚕', '🚗', '🚇', '🚆', '✈️', '🚲', '🛴', '⛽', '🅿️', '🛳️', '🚁', '🏍️', '🚢'],
  HEALTH: ['💊', '🩺', '🏥', '🩹', '💉', '🦷', '🏃', '💪', '🏋️', '🏊', '🚴', '🍏', '🧼', '🚑'],
  TRAVEL: ['✈️', '🏝️', '🏖️', '🏨', '🧳', '🗺️', '🗽', '🏔️', '🏕️', '⛺', '🚂', '🛳️', 'passport', '🧭'],
  FINANCE: ['💵', '💰', '💳', '🏦', '💎', '🪙', '📈', '🏛️', '🧾', '🪙', '💹', '💸', '💼', '🏷️'],
  OTHERS: ['⚙️', '🛠️', '🛡️', '🚫', '➕', '❓', '🔔', '🔒', '📦', '🌐', '⭐', '🔥', '⚡', '💡'],
};
