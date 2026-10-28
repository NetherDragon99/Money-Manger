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
  color?: string;
  updatedAt?: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string; // Emoji
  type: 'expense' | 'income';
  budgetLimit: number; // 0 means no budget
  orderIndex?: number;
  updatedAt?: number;
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
  isAdjustment?: boolean; // Tag for manual balance adjustments
  isFromRecurring?: boolean; // Tag for automated recurring transactions
  recurringRuleId?: string; // ID of the generating recurring rule
  isIndividuallyEdited?: boolean; // Flag when a generated recurring occurrence was individually edited
  createdAt: number;
  updatedAt?: number;
  fromBalanceBefore?: number;
  fromBalanceAfter?: number;
  toBalanceBefore?: number;
  toBalanceAfter?: number;
  fromAccountName?: string;
  fromAccountIcon?: string;
  toAccountName?: string;
  toAccountIcon?: string;
  note?: string;
  balanceBefore?: number;
  balanceAfter?: number;
  sender16Id?: string;
  shareId?: string;
  excludedShareIds?: string[]; // IDs of shared spaces where this transaction was deleted by owner and should not be propagated
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
  photoURL?: string;
  numericId?: string;
  uid?: string;
  driveAccessGranted?: boolean;
  drivePromptResolved?: boolean;
  updatedAt?: number;
}

export interface AdvancedScheduleConfig {
  isAdvanced?: boolean;
  scheduleType?: 'multiple_times_daily' | 'weekly_days' | 'monthly_days' | 'advanced' | string;
  useWeekdayFilter?: boolean;
  daysOfWeek?: number[];
  intervalWeeks?: number; // 1 to 12 (default: 1), anchored to the rule's start week
  useMonthDayFilter?: boolean;
  daysOfMonth?: number[];
  timesOfDay?: string[];
  defaultTimes?: string[];
  unifiedTime?: string;
  customDayTimes?: Record<number, string>;
  weekdayTimes?: Record<number, string[]>;
  monthDayTimes?: Record<number, string[]>;
  hasCustomTimes?: boolean;
  timeOfMonth?: string;
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
  startTime?: string;
  nextRun?: number;
  lastRun?: number;
  effectiveFrom?: number;
  useWeekdayFilter?: boolean;
  useMonthDayFilter?: boolean;
  advancedSchedule?: AdvancedScheduleConfig;
  autoProcess: boolean;
  createdAt: number;
  lastProcessedDate?: string;
  updatedAt?: number;
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
  updatedAt?: number;
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



export interface Budget {
  id: string;
  categoryId?: string;
  amount: number;
  month?: string; // YYYY-MM
  updatedAt?: number;
}

export interface Tombstone {
  id: string;
  collection: 'transactions' | 'recurring' | 'accounts' | 'categories' | 'budgets' | string;
  deletedAt: number;
}


export interface GranularDirtyQueueItem {
  collection: 'transactions' | 'recurring' | 'accounts' | 'categories' | 'budgets' | 'settings' | 'profile' | string;
  id: string;
  action: 'upsert' | 'delete';
  data?: any;
  updatedAt: number;
}


export type SyncState = 'syncing' | 'synced' | 'offline' | 'awaiting_choice';

export interface SyncStatus {
  state: SyncState;
  lastSyncedAt: number | null;
  dirtyCount: number;
  text: {
    en: string;
    ar: string;
  };
}


export interface ReleaseNote {
  version: string;
  releaseDate: string;
  title: { en: string; ar: string };
  highlights: { en: string[]; ar: string[] };
}

export interface FeatureItem {
  id: string;
  icon: string;
  category: 'core' | 'finance' | 'pwa' | 'customization';
  title: { en: string; ar: string };
  subtitle: { en: string; ar: string }; // 2-to-5-word summary subtitle (Grid Only)
  description: { en: string; ar: string }; // Thorough practical description
  whereToFind?: { en: string; ar: string }; // Dedicated "Where to Find It" path & location
  howToUse: { en: string[]; ar: string[] }; // Step-by-step practical guide
  proTip?: { en: string; ar: string }; // Strictly optional genuine helpful tip
}
