export type TransactionType = 'expense' | 'income' | 'transfer';

export interface Account {
  id: string;
  name: string;
  icon: string; // Emoji
  balance: number; // Current balance
  isPrivate: boolean; // if true, exclude from Home & Insights totals; if false, include in Public totals
  customMonthStartDay: number | 'default'; // 1-31 or 'default'
  notes: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string; // Emoji
  type: 'expense' | 'income';
  budgetLimit: number; // 0 means no budget
  orderIndex?: number;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm or ''
  accountId: string; // Source account (or primary account)
  toAccountId?: string; // Destination account for transfers
  categoryId?: string;
  categoryName?: string;
  categoryIcon?: string;
  description: string;
  isUneditable?: boolean; // For automatic manual balance adjustments
  createdAt: number;
}

export type WeekStartDay = 'saturday' | 'sunday' | 'monday';

export type PeriodFilterType =
  | 'all_time'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'calendar_month'
  | 'custom';

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
}

export interface AdvancedFilter {
  accountIds: string[];
  categoryIds: string[];
  minAmount?: number;
  maxAmount?: number;
  type: 'all' | 'expense' | 'income' | 'transfer';
}

export interface UserProfile {
  name: string;
  avatarEmoji: string;
}

export interface AppSettings {
  weekStartDay: WeekStartDay;
  defaultMonthStartDay: number; // 1 to 31 (default: 1)
  language: 'en' | 'ar';
  themeMode: 'dark' | 'light';
  currencySymbol: string;
  userProfile: UserProfile;
  categoryOrder?: string[];
  resetStartDate?: string; // ISO date/time if reset period counter was triggered
}

export interface AppData {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  settings: AppSettings;
}

export interface HistoricalBalanceResult {
  balanceBefore: number;
  transactionAmount: number; // signed
  balanceAfter: number;
}
