export type TransactionType = 'expense' | 'income' | 'transfer';
export type TabType = 'home' | 'budget' | 'insights' | 'accounts' | 'calculator';

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
  fromBalanceBefore?: number;
  fromBalanceAfter?: number;
  toBalanceBefore?: number;
  toBalanceAfter?: number;
  balanceBefore?: number;
  balanceAfter?: number;
}

export type WeekStartDay = 'saturday' | 'sunday' | 'monday';

export type PeriodFilterType =
  | 'app_month'
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
  searchQuery?: string;
}

export interface UserProfile {
  name: string;
  avatarEmoji: string;
  customAvatarUrl?: string;
  numericId?: string;
  uid?: string;
}

export type RecurringFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';

export interface RecurringTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  accountId: string;
  toAccountId?: string;
  categoryId?: string;
  categoryName?: string;
  categoryIcon?: string;
  frequency: RecurringFrequency;
  startDate: string; // YYYY-MM-DD
  nextDueDate: string; // YYYY-MM-DD
  autoProcess: boolean;
  createdAt: number;
  lastProcessedDate?: string;
}

export interface SecuritySettings {
  isLockEnabled: boolean;
  pinHash: string; // Stored 4-digit PIN hash
  isBiometricEnabled: boolean;
  requireLockOnResume: boolean;
}

export interface AppSettings {
  weekStartDay: WeekStartDay;
  defaultMonthStartDay: number; // 1 to 31 (default: 1)
  language: 'en' | 'ar';
  themeMode: 'dark' | 'light';
  currencySymbol: string;
  userProfile: UserProfile;
  categoryOrder?: string[];
  accountOrder?: string[];
  resetStartDate?: string; // ISO date/time if reset period counter was triggered
  budgetAlertsEnabled?: boolean;
  budgetAlertThreshold?: number; // default 80
  security?: SecuritySettings;
}

export interface AppData {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  settings: AppSettings;
  recurringTransactions?: RecurringTransaction[];
}

export interface HistoricalBalanceResult {
  balanceBefore: number;
  transactionAmount: number; // signed
  balanceAfter: number;
}

export interface TransferBalancesResult {
  fromAccountName: string;
  fromAccountIcon?: string;
  fromBalanceBefore: number;
  fromBalanceAfter: number;
  toAccountName: string;
  toAccountIcon?: string;
  toBalanceBefore: number;
  toBalanceAfter: number;
  amount: number;
}

