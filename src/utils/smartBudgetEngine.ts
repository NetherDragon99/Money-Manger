/**
 * Smart Budget Engine
 *
 * PURE, typed, dependency-free mathematical engine for solv's personal financial tracking:
 * - Integer minor-units currency math (round half up)
 * - Local midnight day boundaries & 28-31 day salary cycle (configurable start day 1-31 or auto-detected)
 * - 5 distinct budget pools: Savings, Fixed Obligations, Outings, One-Off (Exceptional), Daily Safe-to-Spend
 * - Live dynamic public-income rebalancing (extra public income / private transfers flow directly into Daily Spending)
 * - Isolated per-cycle manual (+/-) progress adjustments per pool (zero unintended daily spillover)
 * - Direct One-Off integration with selectable uncovered funding source (Daily / Savings / Outings)
 * - Real-time spending attribution, explicit pool precedence, & multi-currency exclusion
 * - Weighted daily allowance calculation, anomaly detection & rebalance scenarios
 */

import type {
  Transaction,
  Account,
  PoolAllocationConfig,
  SmartBudgetCycleOverride,
  BudgetAdjustment,
  ExpenseBudgetPool,
  FromTodayConfig,
  OneOffFundingSource,
  SmartBudgetPoolKey,
} from '../types/index.ts';

// ============================================================================
// NAMED CONSTANTS FOR ANOMALY DETECTION & CALM HEADS-UP THRESHOLD
// ============================================================================

export const ANOMALY_POOL_DRAIN_RATIO = 0.25;
export const ANOMALY_MILESTONE_DAYS = [7, 14, 21] as const;
export const ANOMALY_BURN_DEVIATION_THRESHOLD = 0.15;
export const DEFAULT_HEADS_UP_THRESHOLD_RATIO = 0.7;

export function normalizeExpenseBudgetPool(
  rawPool?: string | null,
  isRecurring?: boolean
): ExpenseBudgetPool {
  if (rawPool === 'savings') return 'savings';
  if (rawPool === 'emergency' || rawPool === 'oneoff') return 'oneoff';
  if (rawPool === 'fixed') return 'fixed';
  if (rawPool === 'outings') return 'outings';
  if (rawPool === 'daily') return 'daily';
  return isRecurring ? 'fixed' : 'daily';
}

export function isSavingsTransaction(
  tx: Transaction,
  _categories?: any[],
  _fixedCategoryIds?: string[]
): boolean {
  if (!tx) return false;
  if (tx.isAdjustment || tx.isUneditable) return false;
  const desc = (tx.description || '').toLowerCase();
  if (desc.includes('manual balance adjustment') || desc.includes('تسوية رصيد')) return false;

  // Income transactions are NEVER savings expense allocations
  if (tx.type === 'income') return false;

  // For expense transactions: explicit non-savings pool ALWAYS takes precedence over fuzzy category/description matching
  if (tx.type === 'expense') {
    const rawPool = tx.budgetPool as string | undefined;
    if (rawPool === 'savings') return true;
    if (
      rawPool === 'daily' ||
      rawPool === 'fixed' ||
      rawPool === 'outings' ||
      rawPool === 'oneoff' ||
      rawPool === 'emergency'
    ) {
      return false;
    }
  }

  // (a) Transfer with Savings / Investment Allocation toggle enabled
  if (tx.type === 'transfer' || Boolean(tx.toAccountId)) {
    if (
      tx.isSavingsAllocation === true ||
      (tx as any).isSavings === true ||
      (tx as any).isSaving === true ||
      (tx.budgetPool as string) === 'savings'
    ) {
      return true;
    }
  }

  // (b) Explicit savings flag
  if (
    (tx.budgetPool as string) === 'savings' ||
    tx.isSavingsAllocation === true ||
    (tx as any).isSavings === true ||
    (tx as any).isSaving === true
  ) {
    return true;
  }

  // (c) Fallback keyword matching ONLY when no explicit pool was picked
  const catName = (tx.categoryName || '').toLowerCase();
  const note = (tx.note || '').toLowerCase();
  const isSavingsCat =
    catName.includes('saving') ||
    catName.includes('investment') ||
    catName.includes('ادخار') ||
    catName.includes('توفير') ||
    catName.includes('استثمار') ||
    catName.includes('invest');

  if (isSavingsCat) {
    if (
      desc.includes('saving') ||
      desc.includes('ادخار') ||
      desc.includes('توفير') ||
      desc.includes('استثمار') ||
      desc.includes('invest') ||
      note.includes('saving') ||
      note.includes('ادخار') ||
      note.includes('توفير') ||
      note.includes('استثمار') ||
      note.includes('invest') ||
      tx.type === 'transfer'
    ) {
      return true;
    }
  }

  return false;
}

export function getTransactionBudgetPool(
  tx: Transaction,
  fixedCategoryIds?: string[],
  categories?: any[]
): 'savings' | 'fixed' | 'outings' | 'daily' | 'oneoff' | null {
  if (!tx) return null;
  if (tx.isAdjustment || tx.isUneditable) return null;
  const desc = (tx.description || '').toLowerCase();
  if (desc.includes('manual balance adjustment') || desc.includes('تسوية رصيد')) return null;

  // Income transactions do not belong to expense pools
  if (tx.type === 'income') {
    return null;
  }

  // Transfers belong to savings ONLY when flagged as savings
  if (tx.type === 'transfer' || Boolean(tx.toAccountId)) {
    return isSavingsTransaction(tx, categories, fixedCategoryIds) ? 'savings' : null;
  }

  // 1. Explicit pool assignment on expenses ALWAYS wins
  const rawPool = tx.budgetPool as string | undefined;
  if (rawPool === 'savings') return 'savings';
  if (rawPool === 'outings') return 'outings';
  if (rawPool === 'oneoff' || rawPool === 'emergency') return 'oneoff';
  if (rawPool === 'fixed') return 'fixed';
  if (rawPool === 'daily') return 'daily';

  // 2. Savings condition fallback
  if (isSavingsTransaction(tx, categories, fixedCategoryIds)) {
    return 'savings';
  }

  // 3. Recurring generated or in fixedCategoryIds
  const fixedSet = new Set(fixedCategoryIds || []);
  if (
    tx.isFromRecurring ||
    Boolean(tx.recurringRuleId) ||
    (tx.categoryId && fixedSet.has(tx.categoryId))
  ) {
    return 'fixed';
  }

  // 4. Default for expense transactions
  if (tx.type === 'expense') {
    return 'daily';
  }

  return null;
}

export function isSavingsOrInvestmentRole(role?: string): boolean {
  if (!role) return false;
  const r = role.toLowerCase().trim();
  return r === 'savings' || r === 'saving' || r === 'investment' || r === 'investing';
}

export function isSpendingOrCustomiseRole(role?: string): boolean {
  if (!role) return true;
  const r = role.toLowerCase().trim();
  return (r === 'spending' || r === 'customise') && !isSavingsOrInvestmentRole(r);
}

const SMART_BUDGET_DAILY_NOTIF_STORAGE_KEY = 'mm_sb_daily_notif_cap_v1';

export function canSendSmartBudgetNotificationToday(
  notificationType: string,
  now: Date = new Date()
): boolean {
  try {
    const todayStr = formatLocalDate(now);
    const raw = localStorage.getItem(SMART_BUDGET_DAILY_NOTIF_STORAGE_KEY);
    if (!raw) return true;
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed[notificationType] !== todayStr;
  } catch {
    return true;
  }
}

export function markSmartBudgetNotificationSentToday(
  notificationType: string,
  now: Date = new Date()
): void {
  try {
    const todayStr = formatLocalDate(now);
    const raw = localStorage.getItem(SMART_BUDGET_DAILY_NOTIF_STORAGE_KEY);
    const parsed: Record<string, string> = raw ? JSON.parse(raw) : {};
    parsed[notificationType] = todayStr;
    localStorage.setItem(SMART_BUDGET_DAILY_NOTIF_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore storage errors
  }
}

// ============================================================================
// TYPES & CONFIGURATION INTERFACES
// ============================================================================

export type BudgetPoolType = 'savings' | 'fixed' | 'outings' | 'oneoff' | 'daily';

export type SavingsConfig =
  | { type: 'percent'; value: number }
  | { type: 'fixed'; value: number };

export type RolloverSetting = 'spread' | 'sweep_to_savings';

export interface SmartBudgetConfig {
  startDay?: number | 'auto';
  cycleStartMode?: 'calendar_month' | 'app_default' | 'from_today' | 'custom' | string;
  customStartDay?: number;
  customStartDate?: string;
  plannedIncome?: number;
  savings?: SavingsConfig;
  plannedFixedObligations?: number;
  fixedCategoryIds?: string[];
  outingsBudget?: number;
  oneOffBudget?: number;
  oneOffFundingSource?: OneOffFundingSource;
  weekdayWeights?: Partial<Record<number, number>>;
  rolloverSetting?: RolloverSetting;
  baseCurrency?: string;
  includedAccountIds?: string[];
  includePrivateAccounts?: boolean;
  minorPerMajor?: number;
  headsUpThresholdRatio?: number;
  poolsConfig?: {
    savings: PoolAllocationConfig;
    fixed: PoolAllocationConfig;
    outings: PoolAllocationConfig;
    oneoff?: PoolAllocationConfig;
  };
  overrides?: Record<string, SmartBudgetCycleOverride>;
  adjustments?: Record<string, BudgetAdjustment>;
  calculationMode?: 'full_cycle' | 'from_today';
  fromTodayConfig?: FromTodayConfig;
  isPaused?: boolean;
  manualProgressAdjustments?: Partial<Record<SmartBudgetPoolKey, number>>;
}

export interface CycleInfo {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  cycleKey: string; // YYYY-MM-DD
  startDay: number;
  effectiveStartDay: number;
  length: number;
  label: string;
}

export interface PoolSpendingStatus {
  allocatedMinor: number;
  spentMinor: number;
  remainingMinor: number;
  trackedSpentMinor: number;
  manualAdjustmentMinor: number;
  allocated: number;
  spent: number;
  remaining: number;
  trackedSpent: number;
  manualAdjustment: number;
  transactions?: Transaction[];
}

export interface OneOffPoolStatus extends PoolSpendingStatus {
  coveredByEmergencyCreditMinor: number;
  coveredByEmergencyCredit: number;
  uncoveredExcessMinor: number;
  uncoveredExcess: number;
  fundingSource: OneOffFundingSource;
}

export interface SavingsPoolStatus extends PoolSpendingStatus {
  depositedMinor: number;
  withdrawnMinor: number;
  trackedNetSavedMinor: number;
  netSavedMinor: number;
  absorbedOneOffMinor: number;
  deposited: number;
  withdrawn: number;
  trackedNetSaved: number;
  netSaved: number;
  absorbedOneOff: number;
  progressPercent: number;
  emergencyCreditMinor: number;
  emergencyCredit: number;
  remainingEmergencyCreditMinor: number;
  remainingEmergencyCredit: number;
  transactions?: Transaction[];
}

export type DailyAllowanceState = 'normal' | 'heads_up' | 'true_deficit';

export interface DailyAllowanceStatus {
  asOfDate: string;
  cycleDayIndex: number;
  cycleLength: number;
  remainingDaysInCycle: number;
  weightToday: number;
  sumRemainingWeights: number;
  dailyPoolAllocatedMinor: number;
  dailyPoolSpentBeforeTodayMinor: number;
  dailyPoolRemainingAtStartOfTodayMinor: number;
  dailyPoolRemainingAfterTodayMinor: number;
  plannedDailyAllowanceMinor: number;
  upcomingDailyAllowanceMinor: number;
  spilledFromFixedMinor: number;
  spilledFromOutingsMinor: number;
  spilledFromOneOffMinor: number;
  totalSpilledToDailyMinor: number;
  todayAllowanceMinor: number;
  todaySpentMinor: number;
  todayRemainingMinor: number;
  overBudgetByMinor: number;
  todayAllowance: number;
  todaySpent: number;
  todayRemaining: number;
  overBudgetBy: number;
  plannedDailyAllowance: number;
  upcomingDailyAllowance: number;
  dailyPoolRemainingAfterToday: number;
  spilledFromFixed: number;
  spilledFromOutings: number;
  spilledFromOneOff: number;
  totalSpilledToDaily: number;
  headsUpThresholdRatio: number;
  allowanceState: DailyAllowanceState;
}

export interface BudgetAnomaly {
  type: 'pool_drain' | 'milestone_overburn' | 'burn_rate_deviation';
  severity: 'warning' | 'critical';
  message: { en: string; ar: string };
  transactionId?: string;
  amount?: number;
  details?: Record<string, any>;
}

export interface RebalanceScenario {
  id: 'A' | 'B' | 'C' | 'outings' | 'savings' | 'fixed' | string;
  sourceKey: 'outings' | 'savings' | 'fixed';
  sourceName: { en: string; ar: string };
  sourceAvailableMinor: number;
  sourceAvailable: number;
  name: { en: string; ar: string };
  description: { en: string; ar: string };
  isAvailable: boolean;
  unavailableReason?: { en: string; ar: string };
  beforeDailyAllowance: number;
  afterDailyAllowance: number;
  deficitMinor: number;
  deficit: number;
  absorbedFromSavingsMinor: number;
  trimmedFromOutingsMinor: number;
  trimmedFromFixedMinor: number;
  spilledToDailyMinor: number;
  unabsorbedDeficitMinor: number;
}

export interface OverspendCategorySummary {
  categoryId: string;
  amountMinor: number;
  amount: number;
  count: number;
  pool: 'daily' | 'outings';
}

export interface SmartBudgetEvaluation {
  cycle: CycleInfo;
  baseCurrency: string;
  excludedCurrencies: string[];
  isPaused: boolean;
  calculationMode: 'full_cycle' | 'from_today';
  fromTodayConfig?: FromTodayConfig;
  pools: {
    savings: SavingsPoolStatus;
    fixed: PoolSpendingStatus;
    outings: PoolSpendingStatus;
    oneoff: OneOffPoolStatus;
    daily: PoolSpendingStatus;
    total: {
      incomeMinor: number;
      income: number;
      plannedBaseIncomeMinor: number;
      plannedBaseIncome: number;
      dynamicPublicIncomeDeltaMinor: number;
      dynamicPublicIncomeDelta: number;
      spentMinor: number;
      spent: number;
      remainingMinor: number;
      remaining: number;
    };
  };
  dailyStatus: DailyAllowanceStatus;
  anomalies: BudgetAnomaly[];
  rebalanceScenarios: {
    hasDeficit: boolean;
    deficitMinor: number;
    deficit: number;
    scenarios: RebalanceScenario[];
    scenarioA: RebalanceScenario;
    scenarioB: RebalanceScenario;
    scenarioC: RebalanceScenario;
  };
  topOverspendCategories: OverspendCategorySummary[];
  projectedDailyAllowanceAfterSpend: (
    amount: number,
    pool?: ExpenseBudgetPool | 'emergency',
    onDate?: string | Date
  ) => number;
}

// ============================================================================
// PURE UTILITY MATH & DATE FUNCTIONS
// ============================================================================

export function roundHalfUp(val: number): number {
  return Math.floor(val + 0.5);
}

export function toMinorUnits(amount: number, minorPerMajor = 100): number {
  return roundHalfUp(amount * minorPerMajor);
}

export function toMajorUnits(minor: number, minorPerMajor = 100): number {
  return minor / minorPerMajor;
}

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseLocalDate(input: string | Date): Date {
  if (input instanceof Date) {
    return new Date(input.getFullYear(), input.getMonth(), input.getDate(), 0, 0, 0, 0);
  }
  const clean = input.split('T')[0].trim();
  const parts = clean.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  return new Date(y, m, d, 0, 0, 0, 0);
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, 0, 0, 0, 0);
}

export function getDaysInCalendarMonth(year: number, monthZeroIndexed: number): number {
  return new Date(year, monthZeroIndexed + 1, 0).getDate();
}

export function clampDayToMonth(year: number, monthZeroIndexed: number, startDay: number): number {
  const normalizedTarget = Math.min(31, Math.max(1, Math.floor(startDay || 1)));
  const maxDays = getDaysInCalendarMonth(year, monthZeroIndexed);
  return Math.min(normalizedTarget, maxDays);
}

export function diffCalendarDays(start: Date, end: Date): number {
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0);
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 0, 0, 0, 0);
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return e.getDate() - s.getDate();
  }
  const sign = e >= s ? 1 : -1;
  let cur = sign === 1 ? s : e;
  const target = sign === 1 ? e : s;
  let days = 0;
  while (
    cur.getFullYear() < target.getFullYear() ||
    (cur.getFullYear() === target.getFullYear() && cur.getMonth() < target.getMonth())
  ) {
    const daysInCurMonth = getDaysInCalendarMonth(cur.getFullYear(), cur.getMonth());
    days += daysInCurMonth - cur.getDate() + 1;
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1, 0, 0, 0, 0);
  }
  days += target.getDate() - cur.getDate();
  return sign * days;
}

export function getSalaryCycleRange(
  refDate: string | Date,
  startDay: number,
  customStartDate?: string
): CycleInfo {
  if (customStartDate && /^\d{4}-\d{2}-\d{2}$/.test(customStartDate)) {
    const customStart = parseLocalDate(customStartDate);
    const configuredStartDay = customStart.getDate();
    const nextMonth = new Date(customStart.getFullYear(), customStart.getMonth() + 1, 1, 0, 0, 0, 0);
    const nextMonthClampedDay = clampDayToMonth(nextMonth.getFullYear(), nextMonth.getMonth(), configuredStartDay);
    const nextCycleStart = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), nextMonthClampedDay, 0, 0, 0, 0);
    const cycleEnd = new Date(nextCycleStart.getFullYear(), nextCycleStart.getMonth(), nextCycleStart.getDate() - 1, 0, 0, 0, 0);
    const length = diffCalendarDays(customStart, cycleEnd) + 1;

    const startStr = formatLocalDate(customStart);
    const endStr = formatLocalDate(cycleEnd);

    const startMonthName = customStart.toLocaleDateString('en-US', { month: 'short' });
    const endMonthName = cycleEnd.toLocaleDateString('en-US', { month: 'short' });
    const label =
      startMonthName === endMonthName
        ? `${startMonthName} ${customStart.getFullYear()}`
        : `${startMonthName} - ${endMonthName} ${cycleEnd.getFullYear()}`;

    return {
      startDate: startStr,
      endDate: endStr,
      cycleKey: startStr,
      startDay: configuredStartDay,
      effectiveStartDay: configuredStartDay,
      length,
      label,
    };
  }

  const configuredStartDay = Math.min(31, Math.max(1, Math.floor(startDay || 1)));
  const ref = parseLocalDate(refDate);

  const year = ref.getFullYear();
  const month = ref.getMonth();
  const date = ref.getDate();

  const thisMonthStartDay = clampDayToMonth(year, month, configuredStartDay);

  let cycleStart: Date;
  let nextCycleStart: Date;
  let effectiveStartDay: number;

  if (date >= thisMonthStartDay) {
    effectiveStartDay = thisMonthStartDay;
    cycleStart = new Date(year, month, thisMonthStartDay, 0, 0, 0, 0);
    const nextMonthFirst = new Date(year, month + 1, 1, 0, 0, 0, 0);
    const nextYear = nextMonthFirst.getFullYear();
    const nextMonth = nextMonthFirst.getMonth();
    const nextMonthStartDay = clampDayToMonth(nextYear, nextMonth, configuredStartDay);
    nextCycleStart = new Date(nextYear, nextMonth, nextMonthStartDay, 0, 0, 0, 0);
  } else {
    const prevMonthFirst = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const prevYear = prevMonthFirst.getFullYear();
    const prevMonth = prevMonthFirst.getMonth();
    const prevMonthStartDay = clampDayToMonth(prevYear, prevMonth, configuredStartDay);
    effectiveStartDay = prevMonthStartDay;
    cycleStart = new Date(prevYear, prevMonth, prevMonthStartDay, 0, 0, 0, 0);
    nextCycleStart = new Date(year, month, thisMonthStartDay, 0, 0, 0, 0);
  }

  const cycleEnd = new Date(
    nextCycleStart.getFullYear(),
    nextCycleStart.getMonth(),
    nextCycleStart.getDate() - 1,
    0,
    0,
    0,
    0
  );
  const length = diffCalendarDays(cycleStart, cycleEnd) + 1;

  const startStr = formatLocalDate(cycleStart);
  const endStr = formatLocalDate(cycleEnd);

  const startMonthName = cycleStart.toLocaleDateString('en-US', { month: 'short' });
  const endMonthName = cycleEnd.toLocaleDateString('en-US', { month: 'short' });
  const label =
    startMonthName === endMonthName
      ? `${startMonthName} ${cycleStart.getFullYear()}`
      : `${startMonthName} - ${endMonthName} ${cycleEnd.getFullYear()}`;

  return {
    startDate: startStr,
    endDate: endStr,
    cycleKey: startStr,
    startDay: configuredStartDay,
    effectiveStartDay,
    length,
    label,
  };
}

export function resolveCycleOverride(
  overrides: Record<string, SmartBudgetCycleOverride> | undefined,
  cycleStartDate: string
): SmartBudgetCycleOverride | undefined {
  if (!overrides || !cycleStartDate) return undefined;
  if (overrides[cycleStartDate]) return overrides[cycleStartDate];
  const monthPrefix = cycleStartDate.slice(0, 7);
  if (overrides[monthPrefix]) return overrides[monthPrefix];
  return undefined;
}

export function migrateSmartBudgetSettingsToUnifiedCycle(
  smartBudget: any,
  globalMonthStartDay: number
): { migrated: any; changed: boolean } {
  const normalizedGlobalDay = Math.min(31, Math.max(1, Math.floor(globalMonthStartDay || 1)));
  if (!smartBudget) return { migrated: undefined, changed: false };

  let changed = false;
  const nextBaseline = { ...(smartBudget.baseline || {}) };
  if (nextBaseline.startDay !== normalizedGlobalDay) {
    nextBaseline.startDay = normalizedGlobalDay;
    changed = true;
  }

  let nextOverrides: Record<string, SmartBudgetCycleOverride> | undefined = undefined;
  if (smartBudget.overrides && typeof smartBudget.overrides === 'object') {
    nextOverrides = {};
    for (const [key, val] of Object.entries(smartBudget.overrides)) {
      if (/^\d{4}-\d{2}$/.test(key)) {
        const [yStr, mStr] = key.split('-');
        const y = parseInt(yStr, 10);
        const mZero = parseInt(mStr, 10) - 1;
        const clampedDay = clampDayToMonth(y, mZero, normalizedGlobalDay);
        const fullKey = `${yStr}-${mStr}-${pad2(clampedDay)}`;
        nextOverrides[fullKey] = val as SmartBudgetCycleOverride;
        changed = true;
      } else {
        nextOverrides[key] = val as SmartBudgetCycleOverride;
      }
    }
  }

  if (!changed) return { migrated: smartBudget, changed: false };

  return {
    migrated: {
      ...smartBudget,
      baseline: nextBaseline,
      ...(nextOverrides ? { overrides: nextOverrides } : {}),
      updatedAt: smartBudget.updatedAt || Date.now(),
    },
    changed: true,
  };
}

export function autoDetectSalaryDay(
  transactions: Transaction[],
  defaultStartDay = 1
): number {
  const normalizedDefault = Math.min(31, Math.max(1, Math.floor(defaultStartDay || 1)));
  if (!transactions || transactions.length === 0) return normalizedDefault;

  const salaryTxs = transactions.filter((t) => {
    if (t.type !== 'income') return false;
    if (t.isSalary) return true;
    const text = `${t.description || ''} ${t.categoryName || ''} ${t.note || ''}`.toLowerCase();
    return text.includes('salary') || text.includes('مرتب') || text.includes('راتب');
  });

  if (salaryTxs.length === 0) return normalizedDefault;

  salaryTxs.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));

  const latest = salaryTxs[0];
  const parsed = parseLocalDate(latest.date);
  const detectedDay = parsed.getDate();
  return Math.min(31, Math.max(1, detectedDay));
}

export function normalizeCurrencyCodeOrSymbol(curr?: string): string {
  const c = (curr || 'EGP').trim().toUpperCase();
  if (c === '£' || c === 'EGP' || c === 'LE' || c === 'L.E' || c === 'ج.م' || c === 'ج.م.') {
    return 'EGP';
  }
  if (c === '$' || c === 'USD') return 'USD';
  if (c === '€' || c === 'EUR') return 'EUR';
  return c;
}

function isSalaryLikeIncome(tx: Transaction): boolean {
  if (tx.isSalary) return true;
  const text = `${tx.description || ''} ${tx.categoryName || ''} ${tx.note || ''}`.toLowerCase();
  return text.includes('salary') || text.includes('راتب') || text.includes('مرتب');
}

// ============================================================================
// PURE SMART BUDGET ENGINE MAIN EVALUATION
// ============================================================================

export function evaluateSmartBudget(
  transactions: Transaction[],
  accounts: Account[],
  config: SmartBudgetConfig = {},
  asOf: string | Date = new Date()
): SmartBudgetEvaluation {
  const minorFactor = config.minorPerMajor || 100;
  const asOfDate = parseLocalDate(asOf);
  const asOfStr = formatLocalDate(asOfDate);

  // 1. Resolve Unified Cycle Start Day & Range (1-31 with month-end clamping)
  let cycleStartDay = 1;
  const startMode = config.cycleStartMode;
  if (startMode === 'calendar_month') {
    cycleStartDay = 1;
  } else if (startMode === 'app_default') {
    cycleStartDay = typeof config.startDay === 'number' ? config.startDay : 1;
  } else if (startMode === 'custom' && typeof config.customStartDay === 'number') {
    cycleStartDay = Math.min(31, Math.max(1, Math.floor(config.customStartDay)));
  } else if (config.startDay === 'auto') {
    cycleStartDay = autoDetectSalaryDay(transactions, 1);
  } else if (typeof config.startDay === 'number') {
    cycleStartDay = Math.min(31, Math.max(1, Math.floor(config.startDay)));
  }

  const cycle = getSalaryCycleRange(
    asOfDate,
    cycleStartDay,
    startMode === 'custom' ? config.customStartDate : undefined
  );
  const cycleStart = parseLocalDate(cycle.startDate);
  const cycleEnd = parseLocalDate(cycle.endDate);

  // Apply active cycle override (keyed by cycle.startDate 'YYYY-MM-DD') if present
  const cycleOverride = resolveCycleOverride(config.overrides, cycle.startDate);
  const effectiveConfig: SmartBudgetConfig = cycleOverride
    ? { ...config, ...cycleOverride }
    : config;

  // 2. Base Currency & Public Account Filtering
  const baseCurrency = effectiveConfig.baseCurrency || accounts[0]?.currency || 'EGP';
  const normalizedBaseCurr = normalizeCurrencyCodeOrSymbol(baseCurrency);
  const includePrivate = Boolean(effectiveConfig.includePrivateAccounts);

  const accountMap = new Map<string, Account>();
  for (const acc of accounts) {
    accountMap.set(acc.id, acc);
  }

  const isPublicBaseCurrencyAccount = (acc?: Account): boolean => {
    if (!acc) return false;
    if (acc.isPrivate && !includePrivate) return false;
    if (acc.currency && normalizeCurrencyCodeOrSymbol(acc.currency) !== normalizedBaseCurr) return false;
    return true;
  };

  const excludedCurrenciesSet = new Set<string>();
  for (const acc of accounts) {
    if (acc.isPrivate && !includePrivate) continue;
    if (acc.currency && normalizeCurrencyCodeOrSymbol(acc.currency) !== normalizedBaseCurr) {
      excludedCurrenciesSet.add(acc.currency);
    }
  }

  const calculationMode: 'full_cycle' | 'from_today' = effectiveConfig.calculationMode || 'full_cycle';
  const isPaused = Boolean(effectiveConfig.isPaused);
  const includedAccountSet =
    calculationMode === 'from_today' &&
    effectiveConfig.includedAccountIds &&
    effectiveConfig.includedAccountIds.length > 0
      ? new Set(effectiveConfig.includedAccountIds)
      : null;

  let fromDateStr = cycle.startDate;
  let remainingMoneyMinor: number | null = null;
  let evaluatedFromTodayConfig: FromTodayConfig | undefined = undefined;
  let fromTodayDynamicDeltaMinor = 0;

  if (calculationMode === 'from_today') {
    const rawFromDate = effectiveConfig.fromTodayConfig?.fromDate || asOfStr;
    fromDateStr =
      rawFromDate < cycle.startDate
        ? cycle.startDate
        : rawFromDate > cycle.endDate
        ? cycle.endDate
        : rawFromDate;

    // Live Public Account Linkage:
    // Automatically excludes Private accounts (even if previously listed) unless includePrivateAccounts is enabled.
    const primaryPublicAccounts = accounts.filter((a) => isPublicBaseCurrencyAccount(a));
    const spendingAccounts = primaryPublicAccounts.filter((a) => isSpendingOrCustomiseRole(a.accountRole));
    const defaultAccounts = spendingAccounts.length > 0 ? spendingAccounts : primaryPublicAccounts;

    const configuredLinkedIds = effectiveConfig.fromTodayConfig?.linkedAccountIds;
    const effectiveLinkedAccounts =
      configuredLinkedIds && configuredLinkedIds.length > 0
        ? accounts.filter((a) => configuredLinkedIds.includes(a.id) && isPublicBaseCurrencyAccount(a))
        : defaultAccounts;

    const linkedAccountSet = new Set(effectiveLinkedAccounts.map((a) => a.id));
    let todayOutflowMinor = 0;
    let todayInflowMinor = 0;
    let trackedBudgetOutflowsFromLinkedMinor = 0;
    let fromTodayExtraIncomeMinor = 0;
    let fromTodayPrivateTransferDeltaMinor = 0;

    for (const tx of transactions) {
      if (!tx || !tx.date) continue;
      const cleanTxDate = tx.date.split('T')[0].trim();
      if (cleanTxDate < fromDateStr || cleanTxDate > cycle.endDate) continue;

      if (tx.isAdjustment || tx.isUneditable) continue;
      const desc = (tx.description || '').toLowerCase();
      if (desc.includes('manual balance adjustment') || desc.includes('تسوية رصيد')) continue;

      const tax = typeof tx.taxAmount === 'number' && !isNaN(tx.taxAmount) ? Math.max(0, tx.taxAmount) : 0;
      const isTransfer = tx.type === 'transfer' || Boolean(tx.toAccountId);

      // Preserve cash-conservation for all tracked budget outflows since fromDateStr:
      // current account balances already deducted these outflows, so add them back to form
      // the live cycle-funded pool before deducting pool allocations & tracked spends once.
      if (tx.type === 'expense' && linkedAccountSet.has(tx.accountId)) {
        trackedBudgetOutflowsFromLinkedMinor += Math.max(0, toMinorUnits((tx.amount || 0) + tax, minorFactor));
      } else if (isTransfer && tx.toAccountId && tx.accountId !== tx.toAccountId) {
        const fromIsLinked = linkedAccountSet.has(tx.accountId);
        const toIsLinked = linkedAccountSet.has(tx.toAccountId);
        const principalMinor = Math.max(0, toMinorUnits(tx.amount || 0, minorFactor));
        if (
          fromIsLinked &&
          !toIsLinked &&
          isSavingsTransaction(tx, undefined, effectiveConfig.fixedCategoryIds)
        ) {
          trackedBudgetOutflowsFromLinkedMinor += principalMinor;
        }
        // Track non-savings shifts between Private (or unlinked non-savings) and Linked Public accounts for badge telemetry
        if (!isSavingsTransaction(tx, undefined, effectiveConfig.fixedCategoryIds)) {
          const fromAcc = accountMap.get(tx.accountId);
          const toAcc = accountMap.get(tx.toAccountId);
          const fromIsPublic = isPublicBaseCurrencyAccount(fromAcc);
          const toIsPublic = isPublicBaseCurrencyAccount(toAcc);
          if (!fromIsPublic && toIsLinked) {
            fromTodayPrivateTransferDeltaMinor += principalMinor;
          } else if (fromIsLinked && toAcc?.isPrivate && !toIsPublic) {
            fromTodayPrivateTransferDeltaMinor -= principalMinor;
          }
        }
      } else if (tx.type === 'income' && linkedAccountSet.has(tx.accountId)) {
        if (!isSalaryLikeIncome(tx)) {
          fromTodayExtraIncomeMinor += Math.max(0, toMinorUnits((tx.amount || 0) + tax, minorFactor));
        }
      }

      if (cleanTxDate === asOfStr) {
        if (isTransfer) {
          if (!tx.toAccountId || tx.accountId === tx.toAccountId) continue;
          const fromIsLinked = linkedAccountSet.has(tx.accountId);
          const toIsLinked = linkedAccountSet.has(tx.toAccountId);
          const principalMinor = Math.max(0, toMinorUnits(tx.amount || 0, minorFactor));
          const feeMinor = Math.max(0, toMinorUnits(tx.transferFee || 0, minorFactor));

          if (fromIsLinked && toIsLinked) {
            if (feeMinor > 0) todayOutflowMinor += feeMinor;
          } else if (fromIsLinked && !toIsLinked) {
            todayOutflowMinor += principalMinor + feeMinor;
          } else if (!fromIsLinked && toIsLinked) {
            todayInflowMinor += principalMinor;
          }
        } else if (tx.type === 'expense') {
          if (linkedAccountSet.has(tx.accountId)) {
            todayOutflowMinor += Math.max(0, toMinorUnits((tx.amount || 0) + tax, minorFactor));
          }
        } else if (tx.type === 'income') {
          if (linkedAccountSet.has(tx.accountId)) {
            todayInflowMinor += Math.max(0, toMinorUnits((tx.amount || 0) + tax, minorFactor));
          }
        }
      }
    }

    const todayLinkedNetOutflowMinor = Math.max(0, todayOutflowMinor - todayInflowMinor);

    // ALWAYS compute live balance dynamically from current linked account balances + manual adjustment
    // (Never freeze stale remainingMoneyMinor so any income/edit/private-move rebalances immediately!)
    const linkedBalancesSum = effectiveLinkedAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);
    const manualAdj = Number(effectiveConfig.fromTodayConfig?.manualAdjustment) || 0;
    const manualAdjMinor = toMinorUnits(manualAdj, minorFactor);
    const currentLiveBalanceMinor = Math.max(0, toMinorUnits(linkedBalancesSum, minorFactor) + manualAdjMinor);
    const cycleFundedMinor = Math.max(0, currentLiveBalanceMinor + trackedBudgetOutflowsFromLinkedMinor);

    remainingMoneyMinor = cycleFundedMinor;
    fromTodayDynamicDeltaMinor = fromTodayExtraIncomeMinor + fromTodayPrivateTransferDeltaMinor;

    evaluatedFromTodayConfig = {
      fromDate: fromDateStr,
      linkedAccountIds: effectiveLinkedAccounts.map((a) => a.id),
      manualAdjustment: manualAdj,
      remainingMoney: currentLiveBalanceMinor / minorFactor,
      remainingMoneyMinor: currentLiveBalanceMinor,
      startOfDayBudgetMinor: cycleFundedMinor,
      todayLinkedNetOutflowMinor,
    };
  }

  // 3. Cycle Transactions Scan (Spending, Savings, One-Off, & Public Income Deltas)
  const cycleTxs: Transaction[] = [];
  const savingsTransactions: Transaction[] = [];
  const fixedTransactions: Transaction[] = [];
  const outingsTransactions: Transaction[] = [];
  const oneOffTransactions: Transaction[] = [];
  const dailyTransactions: Transaction[] = [];

  let savingsDepositedMinor = 0;
  let savingsWithdrawnMinor = 0;
  let emergencyCreditMinor = 0;

  let salaryIncomeInCycleMinor = 0;
  let extraPublicIncomeMinor = 0;
  let netPrivateTransferDeltaMinor = 0;

  const adjustmentsMap = effectiveConfig.adjustments || config.adjustments || {};

  for (const tx of transactions) {
    if (!tx || !tx.date) continue;
    const cleanTxDate = tx.date.split('T')[0].trim();
    if (cleanTxDate < cycle.startDate || cleanTxDate > cycle.endDate) continue;

    const acc = accountMap.get(tx.accountId);
    if (acc?.currency && normalizeCurrencyCodeOrSymbol(acc.currency) !== normalizedBaseCurr) {
      excludedCurrenciesSet.add(acc.currency);
      continue;
    }

    if (tx.isAdjustment || tx.isUneditable) continue;
    const desc = (tx.description || '').toLowerCase();
    if (desc.includes('manual balance adjustment') || desc.includes('تسوية رصيد')) continue;

    // Public Income scanning (for dynamic full_cycle rebalancing)
    if (tx.type === 'income') {
      if (acc && isPublicBaseCurrencyAccount(acc)) {
        const tax = typeof tx.taxAmount === 'number' && !isNaN(tx.taxAmount) ? Math.max(0, tx.taxAmount) : 0;
        const netIncomeMinor = Math.max(0, toMinorUnits((tx.amount || 0) - 0 + tax, minorFactor));
        if (isSalaryLikeIncome(tx)) {
          salaryIncomeInCycleMinor += netIncomeMinor;
        } else {
          extraPublicIncomeMinor += netIncomeMinor;
        }
      }
      continue;
    }

    // Savings deposit check
    if (isSavingsTransaction(tx, undefined, effectiveConfig.fixedCategoryIds)) {
      const tax = typeof tx.taxAmount === 'number' && !isNaN(tx.taxAmount) ? Math.max(0, tx.taxAmount) : 0;
      const effectiveAmount = (tx.amount || 0) + (tx.type === 'expense' ? tax : 0);
      const principalMinor = Math.max(0, toMinorUnits(effectiveAmount, minorFactor));
      if (principalMinor > 0) {
        savingsDepositedMinor += principalMinor;
        savingsTransactions.push(tx);
      }
      continue;
    }

    // Internal transfers (never counted as expenses)
    if (tx.type === 'transfer' || Boolean(tx.toAccountId)) {
      if (!tx.toAccountId || tx.accountId === tx.toAccountId) continue;

      const toAcc = accountMap.get(tx.toAccountId);
      if (toAcc?.currency && normalizeCurrencyCodeOrSymbol(toAcc.currency) !== normalizedBaseCurr) {
        excludedCurrenciesSet.add(toAcc.currency);
        continue;
      }

      const principalMinor = Math.max(0, toMinorUnits(tx.amount || 0, minorFactor));
      if (principalMinor <= 0) continue;

      const fromRole = acc?.accountRole || 'spending';
      const toRole = toAcc?.accountRole || 'spending';

      const linkedAdj: BudgetAdjustment | undefined =
        (tx.linkedAdjustmentId && adjustmentsMap[tx.linkedAdjustmentId]) ||
        adjustmentsMap[`adj_tx_${tx.id}`] ||
        tx.budgetAdjustment;

      const isWithdrawalFromSavingsToSpending =
        (isSavingsOrInvestmentRole(fromRole) && isSpendingOrCustomiseRole(toRole)) ||
        Boolean(tx.savingsWithdrawalChoice) ||
        Boolean(linkedAdj);

      if (isWithdrawalFromSavingsToSpending) {
        const adjMinor = linkedAdj?.amountMinor !== undefined ? linkedAdj.amountMinor : principalMinor;
        savingsWithdrawnMinor += adjMinor;
        savingsTransactions.push(tx);

        const choice = linkedAdj?.choice || tx.savingsWithdrawalChoice || 'just_moving';
        if (choice === 'emergency_expense') {
          emergencyCreditMinor += adjMinor;
        }
      } else if (
        tx.isSavingsAllocation === true ||
        (tx as any).isSavings === true ||
        (tx as any).isSaving === true ||
        tx.budgetPool === 'savings'
      ) {
        savingsDepositedMinor += principalMinor;
        savingsTransactions.push(tx);
      } else {
        // Track Public <-> Private shifts dynamically in full_cycle mode
        const fromIsPublic = isPublicBaseCurrencyAccount(acc);
        const toIsPublic = isPublicBaseCurrencyAccount(toAcc);
        if (!fromIsPublic && toIsPublic) {
          netPrivateTransferDeltaMinor += principalMinor;
        } else if (fromIsPublic && !toIsPublic) {
          netPrivateTransferDeltaMinor -= principalMinor;
        }
      }

      continue;
    }

    // Expense transactions
    if (calculationMode === 'from_today' && cleanTxDate < fromDateStr) continue;

    if (acc) {
      if (includedAccountSet && !includedAccountSet.has(acc.id)) continue;
      if (acc.isPrivate && !includePrivate) continue;
    }

    if (tx.type === 'expense') {
      cycleTxs.push({ ...tx, date: cleanTxDate });
    }
  }

  // Determine Cycle Total Income
  const plannedBaseIncomeMinor =
    calculationMode === 'from_today'
      ? Math.max(0, remainingMoneyMinor ?? 0)
      : Math.max(0, toMinorUnits(effectiveConfig.plannedIncome || 0, minorFactor));

  let dynamicPublicIncomeDeltaMinor = 0;
  let cycleIncomeMinor = plannedBaseIncomeMinor;

  if (calculationMode === 'from_today') {
    // cycleIncomeMinor already reflects live linked public account balances; expose delta for UI telemetry
    dynamicPublicIncomeDeltaMinor = fromTodayDynamicDeltaMinor;
  } else if (calculationMode === 'full_cycle') {
    if (plannedBaseIncomeMinor > 0) {
      dynamicPublicIncomeDeltaMinor = extraPublicIncomeMinor + netPrivateTransferDeltaMinor;
      cycleIncomeMinor = Math.max(0, plannedBaseIncomeMinor + dynamicPublicIncomeDeltaMinor);
    } else {
      dynamicPublicIncomeDeltaMinor =
        salaryIncomeInCycleMinor + extraPublicIncomeMinor + netPrivateTransferDeltaMinor;
      cycleIncomeMinor = Math.max(0, dynamicPublicIncomeDeltaMinor);
    }
  }

  // 4. Split Income Into 5 Pools (Fixed EGP amounts for Savings, Bills, Outings, One-Off; Daily = Remainder)
  let rawSavingsMinor = 0;
  if (effectiveConfig.poolsConfig?.savings?.minorUnits != null) {
    rawSavingsMinor = Math.max(0, effectiveConfig.poolsConfig.savings.minorUnits);
  } else if (effectiveConfig.savings?.type === 'fixed') {
    rawSavingsMinor = Math.max(0, toMinorUnits(effectiveConfig.savings.value, minorFactor));
  } else if (effectiveConfig.savings?.type === 'percent') {
    rawSavingsMinor = Math.max(0, roundHalfUp(cycleIncomeMinor * (effectiveConfig.savings.value / 100)));
  } else if (effectiveConfig.poolsConfig?.savings?.percent != null) {
    rawSavingsMinor = Math.max(0, roundHalfUp(cycleIncomeMinor * (effectiveConfig.poolsConfig.savings.percent / 100)));
  }

  let rawFixedMinor = 0;
  if (effectiveConfig.poolsConfig?.fixed?.minorUnits != null) {
    rawFixedMinor = Math.max(0, effectiveConfig.poolsConfig.fixed.minorUnits);
  } else if (typeof effectiveConfig.plannedFixedObligations === 'number') {
    rawFixedMinor = Math.max(0, toMinorUnits(effectiveConfig.plannedFixedObligations, minorFactor));
  } else if (effectiveConfig.poolsConfig?.fixed?.percent != null) {
    rawFixedMinor = Math.max(0, roundHalfUp(cycleIncomeMinor * (effectiveConfig.poolsConfig.fixed.percent / 100)));
  }

  let rawOutingsMinor = 0;
  if (effectiveConfig.poolsConfig?.outings?.minorUnits != null) {
    rawOutingsMinor = Math.max(0, effectiveConfig.poolsConfig.outings.minorUnits);
  } else if (typeof effectiveConfig.outingsBudget === 'number') {
    rawOutingsMinor = Math.max(0, toMinorUnits(effectiveConfig.outingsBudget, minorFactor));
  } else if (effectiveConfig.poolsConfig?.outings?.percent != null) {
    rawOutingsMinor = Math.max(0, roundHalfUp(cycleIncomeMinor * (effectiveConfig.poolsConfig.outings.percent / 100)));
  }

  let rawOneOffMinor = 0;
  if (effectiveConfig.poolsConfig?.oneoff?.minorUnits != null) {
    rawOneOffMinor = Math.max(0, effectiveConfig.poolsConfig.oneoff.minorUnits);
  } else if (typeof effectiveConfig.oneOffBudget === 'number') {
    rawOneOffMinor = Math.max(0, toMinorUnits(effectiveConfig.oneOffBudget, minorFactor));
  } else if (effectiveConfig.poolsConfig?.oneoff?.percent != null) {
    rawOneOffMinor = Math.max(0, roundHalfUp(cycleIncomeMinor * (effectiveConfig.poolsConfig.oneoff.percent / 100)));
  }

  const savingsMinor = Math.min(cycleIncomeMinor, rawSavingsMinor);
  const fixedMinor = Math.min(Math.max(0, cycleIncomeMinor - savingsMinor), rawFixedMinor);
  const outingsMinor = Math.min(Math.max(0, cycleIncomeMinor - savingsMinor - fixedMinor), rawOutingsMinor);
  const oneOffMinor = Math.min(
    Math.max(0, cycleIncomeMinor - savingsMinor - fixedMinor - outingsMinor),
    rawOneOffMinor
  );

  // Daily Spending absorbs 100% of any public income delta
  const dailyMinor = Math.max(0, cycleIncomeMinor - (savingsMinor + fixedMinor + outingsMinor + oneOffMinor));

  // 5. Attribute Expenses to Pools ('daily' | 'fixed' | 'outings' | 'oneoff')
  const fixedCategorySet = new Set(effectiveConfig.fixedCategoryIds || []);
  const oneOffFundingSource: OneOffFundingSource = effectiveConfig.oneOffFundingSource || 'daily';

  let fixedTrackedSpentMinor = 0;
  let fixedSpentBeforeTodayMinor = 0;
  let outingsTrackedSpentMinor = 0;
  let outingsSpentBeforeTodayMinor = 0;
  let oneOffTrackedSpentMinor = 0;
  let oneOffSpentBeforeTodayMinor = 0;
  let dailyTrackedSpentMinor = 0;

  const dailySpentByDate: Record<string, number> = {};
  let dailySpentBeforeTodayMinor = 0;
  let todayDailySpentMinor = 0;
  const discretionaryCatTotals: Record<string, { totalMinor: number; count: number; pool: 'daily' | 'outings' }> = {};

  const sortedCycleTxs = [...cycleTxs].sort(
    (a, b) => (a.date || '').localeCompare(b.date || '') || (a.createdAt || 0) - (b.createdAt || 0)
  );

  for (const tx of sortedCycleTxs) {
    const tax = typeof tx.taxAmount === 'number' && !isNaN(tx.taxAmount) ? Math.max(0, tx.taxAmount) : 0;
    const effectiveTotal = (tx.amount || 0) + tax;
    const amtMinor = toMinorUnits(effectiveTotal, minorFactor);
    const txDate = tx.date;
    const resolvedPool = getTransactionBudgetPool(tx, effectiveConfig.fixedCategoryIds);

    if (resolvedPool === 'outings') {
      outingsTransactions.push(tx);
      outingsTrackedSpentMinor += amtMinor;
      if (txDate < asOfStr) outingsSpentBeforeTodayMinor += amtMinor;
      const catId = tx.categoryId || 'uncategorized';
      if (!discretionaryCatTotals[catId]) {
        discretionaryCatTotals[catId] = { totalMinor: 0, count: 0, pool: 'outings' };
      }
      discretionaryCatTotals[catId].totalMinor += amtMinor;
      discretionaryCatTotals[catId].count += 1;
    } else if (resolvedPool === 'oneoff') {
      oneOffTransactions.push(tx);
      oneOffTrackedSpentMinor += amtMinor;
      if (txDate < asOfStr) oneOffSpentBeforeTodayMinor += amtMinor;
    } else if (resolvedPool === 'fixed') {
      fixedTransactions.push(tx);
      fixedTrackedSpentMinor += amtMinor;
      if (txDate < asOfStr) fixedSpentBeforeTodayMinor += amtMinor;
    } else {
      // 'daily' (or explicit/default expense)
      dailyTransactions.push(tx);
      dailyTrackedSpentMinor += amtMinor;
      dailySpentByDate[txDate] = (dailySpentByDate[txDate] || 0) + amtMinor;
      if (txDate === asOfStr) todayDailySpentMinor += amtMinor;
      else if (txDate < asOfStr) dailySpentBeforeTodayMinor += amtMinor;
      const catId = tx.categoryId || 'uncategorized';
      if (!discretionaryCatTotals[catId]) {
        discretionaryCatTotals[catId] = { totalMinor: 0, count: 0, pool: 'daily' };
      }
      discretionaryCatTotals[catId].totalMinor += amtMinor;
      discretionaryCatTotals[catId].count += 1;
    }
  }

  // Emergency credit offset for One-Off expenses
  const oneOffCoveredByEmergencyCreditMinor = Math.min(oneOffTrackedSpentMinor, emergencyCreditMinor);
  const remainingEmergencyCreditMinor = Math.max(0, emergencyCreditMinor - oneOffCoveredByEmergencyCreditMinor);
  const oneOffCoveredBeforeTodayMinor = Math.min(oneOffSpentBeforeTodayMinor, emergencyCreditMinor);

  const oneOffUncoveredExcessMinor = Math.max(
    0,
    oneOffTrackedSpentMinor - oneOffMinor - oneOffCoveredByEmergencyCreditMinor
  );
  const oneOffUncoveredBeforeTodayMinor = Math.max(
    0,
    oneOffSpentBeforeTodayMinor - oneOffMinor - oneOffCoveredBeforeTodayMinor
  );

  // Route uncovered One-Off excess per user's chosen funding source
  let spilledFromOneOffToDailyMinor = 0;
  let spilledFromOneOffBeforeTodayMinor = 0;
  let outingsEffectiveForSpillMinor = outingsTrackedSpentMinor;
  let outingsEffectiveBeforeTodayForSpillMinor = outingsSpentBeforeTodayMinor;
  let savingsAbsorbedOneOffMinor = 0;

  if (oneOffUncoveredExcessMinor > 0) {
    if (oneOffFundingSource === 'daily') {
      spilledFromOneOffToDailyMinor = oneOffUncoveredExcessMinor;
      spilledFromOneOffBeforeTodayMinor = oneOffUncoveredBeforeTodayMinor;
    } else if (oneOffFundingSource === 'outings') {
      outingsEffectiveForSpillMinor += oneOffUncoveredExcessMinor;
      outingsEffectiveBeforeTodayForSpillMinor += oneOffUncoveredBeforeTodayMinor;
    } else if (oneOffFundingSource === 'savings') {
      const availableSavingsCushionMinor = Math.max(
        0,
        Math.max(savingsMinor, savingsDepositedMinor) - savingsWithdrawnMinor
      );
      const absorbedMinor = Math.min(oneOffUncoveredExcessMinor, availableSavingsCushionMinor);
      savingsAbsorbedOneOffMinor = absorbedMinor;
      const unabsorbableRemainderMinor = Math.max(0, oneOffUncoveredExcessMinor - absorbedMinor);
      if (unabsorbableRemainderMinor > 0) {
        spilledFromOneOffToDailyMinor = unabsorbableRemainderMinor;
        spilledFromOneOffBeforeTodayMinor = Math.min(unabsorbableRemainderMinor, oneOffUncoveredBeforeTodayMinor);
      }
    }
  }

  // Spillover from Fixed, Outings, and One-Off into Daily (purely from tracked transactions)
  const fixedOverspendBeforeTodayMinor = Math.max(0, fixedSpentBeforeTodayMinor - fixedMinor);
  const outingsOverspendBeforeTodayMinor = Math.max(0, outingsEffectiveBeforeTodayForSpillMinor - outingsMinor);
  const spilledBeforeTodayMinor =
    fixedOverspendBeforeTodayMinor + outingsOverspendBeforeTodayMinor + spilledFromOneOffBeforeTodayMinor;

  const spilledFromFixedMinor = Math.max(0, fixedTrackedSpentMinor - fixedMinor);
  const spilledFromOutingsMinor = Math.max(0, outingsEffectiveForSpillMinor - outingsMinor);
  const totalSpilledToDailyMinor = spilledFromFixedMinor + spilledFromOutingsMinor + spilledFromOneOffToDailyMinor;
  const spilledTodayMinor = Math.max(0, totalSpilledToDailyMinor - spilledBeforeTodayMinor);

  // 6. Day Weights & Remaining Days in Cycle
  const weekdayWeights = { ...effectiveConfig.weekdayWeights };
  const getWeightForDate = (d: Date): number => {
    const dayOfWeek = d.getDay();
    const w = weekdayWeights[dayOfWeek];
    if (typeof w === 'number' && !isNaN(w)) {
      return Math.min(3.0, Math.max(1.0, w));
    }
    return 1.0;
  };

  const allCycleDates: Date[] = [];
  let cur = new Date(cycleStart.getFullYear(), cycleStart.getMonth(), cycleStart.getDate(), 0, 0, 0, 0);
  while (cur <= cycleEnd) {
    allCycleDates.push(new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 0, 0, 0, 0));
    cur = addDays(cur, 1);
  }

  const cycleLength = allCycleDates.length;
  const cycleDayIndex = Math.min(cycleLength, Math.max(1, diffCalendarDays(cycleStart, asOfDate) + 1));
  const remainingDates = allCycleDates.filter((d) => formatLocalDate(d) >= asOfStr);
  const remainingDaysInCycle = remainingDates.length;

  const weightToday = getWeightForDate(asOfDate);
  const sumRemainingWeights = remainingDates.reduce((acc, d) => acc + getWeightForDate(d), 0);
  const sumTotalWeights = allCycleDates.reduce((acc, d) => acc + getWeightForDate(d), 0);

  const activeDates =
    calculationMode === 'from_today'
      ? allCycleDates.filter((d) => formatLocalDate(d) >= fromDateStr)
      : allCycleDates;

  const activeDaysCount = activeDates.length;
  const plannedDailyAllowanceMinor = activeDaysCount > 0 ? roundHalfUp(dailyMinor / activeDaysCount) : 0;

  // 7. Calculate Today's Baseline Allowance & Upcoming Daily Allowance
  const rollover = effectiveConfig.rolloverSetting || 'spread';
  const effectiveDailySpentBeforeTodayMinor = dailySpentBeforeTodayMinor + spilledBeforeTodayMinor;
  let dailyPoolRemainingAtStartOfTodayMinor: number;

  if (calculationMode === 'from_today') {
    dailyPoolRemainingAtStartOfTodayMinor = dailyMinor - effectiveDailySpentBeforeTodayMinor;
  } else if (rollover === 'sweep_to_savings') {
    let poolSimMinor = Math.max(0, dailyMinor - spilledBeforeTodayMinor);
    for (let i = 0; i < allCycleDates.length; i++) {
      const d = allCycleDates[i];
      const dStr = formatLocalDate(d);
      if (dStr >= asOfStr) break;

      const remDaysAtD = allCycleDates.length - i;
      const allowD = remDaysAtD > 0 ? roundHalfUp(Math.max(0, poolSimMinor) / remDaysAtD) : 0;
      const spentD = dailySpentByDate[dStr] || 0;

      if (spentD <= allowD) {
        poolSimMinor = Math.max(0, poolSimMinor - allowD);
      } else {
        poolSimMinor = poolSimMinor - spentD;
      }
    }
    dailyPoolRemainingAtStartOfTodayMinor = poolSimMinor;
  } else {
    dailyPoolRemainingAtStartOfTodayMinor = dailyMinor - effectiveDailySpentBeforeTodayMinor;
  }

  const remainingDays = Math.max(1, remainingDaysInCycle);
  const poolForTodayMinor = dailyPoolRemainingAtStartOfTodayMinor;

  let todayAllowanceMinor = 0;
  if (remainingDays > 0 && poolForTodayMinor > 0) {
    todayAllowanceMinor = roundHalfUp(poolForTodayMinor / remainingDays);
  }

  const todaySpentMinor = todayDailySpentMinor + spilledTodayMinor;
  const todayRemainingMinor = todayAllowanceMinor - todaySpentMinor;
  const overBudgetByMinor = todayRemainingMinor < 0 ? Math.abs(todayRemainingMinor) : 0;

  const dailyPoolRemainingAfterTodayMinor = dailyPoolRemainingAtStartOfTodayMinor - todaySpentMinor;
  const effectiveDailyTrackedSpentMinor = dailyTrackedSpentMinor + totalSpilledToDailyMinor;
  const effectiveDailyRemainingMinor = dailyMinor - effectiveDailyTrackedSpentMinor;

  let upcomingDailyAllowanceMinor = 0;
  if (remainingDaysInCycle > 1 && dailyPoolRemainingAfterTodayMinor > 0) {
    upcomingDailyAllowanceMinor = roundHalfUp(
      dailyPoolRemainingAfterTodayMinor / (remainingDaysInCycle - 1)
    );
  } else {
    upcomingDailyAllowanceMinor = Math.max(0, todayRemainingMinor);
  }

  const rawThreshold = effectiveConfig.headsUpThresholdRatio ?? DEFAULT_HEADS_UP_THRESHOLD_RATIO;
  const headsUpThresholdRatio = Math.min(0.95, Math.max(0.3, rawThreshold));

  const totalTrackedCycleSpendMinor =
    fixedTrackedSpentMinor + outingsTrackedSpentMinor + oneOffUncoveredExcessMinor + dailyTrackedSpentMinor;
  const isDailyPoolExhausted =
    dailyMinor > 0
      ? effectiveDailyRemainingMinor < 0 ||
        (effectiveDailyRemainingMinor === 0 && (overBudgetByMinor > 0 || remainingDaysInCycle > 1))
      : effectiveDailyTrackedSpentMinor > 0;
  const isTotalIncomeExceeded = cycleIncomeMinor > 0 && totalTrackedCycleSpendMinor > cycleIncomeMinor;

  let allowanceState: DailyAllowanceState = 'normal';
  if (isDailyPoolExhausted || isTotalIncomeExceeded) {
    allowanceState = 'true_deficit';
  } else if (
    overBudgetByMinor > 0 ||
    (plannedDailyAllowanceMinor > 0 &&
      upcomingDailyAllowanceMinor < roundHalfUp(plannedDailyAllowanceMinor * headsUpThresholdRatio))
  ) {
    allowanceState = 'heads_up';
  }

  // 8. Projected Daily Allowance Helper (now accurately projects One-Off too!)
  const projectedDailyAllowanceAfterSpend = (
    amountMajor: number,
    pool: ExpenseBudgetPool | 'emergency' = 'daily',
    onDateInput: string | Date = asOfDate
  ): number => {
    const normalizedPool = normalizeExpenseBudgetPool(pool);
    const spendMinor = toMinorUnits(Math.max(0, amountMajor), minorFactor);
    let additionalDailyImpactMinor = 0;

    if (normalizedPool === 'daily') {
      additionalDailyImpactMinor = spendMinor;
    } else if (normalizedPool === 'outings') {
      const outingsRemBeforeSpend = Math.max(0, outingsMinor - outingsEffectiveForSpillMinor);
      additionalDailyImpactMinor = Math.max(0, spendMinor - outingsRemBeforeSpend);
    } else if (normalizedPool === 'fixed') {
      const fixedRemBeforeSpend = Math.max(0, fixedMinor - fixedTrackedSpentMinor);
      additionalDailyImpactMinor = Math.max(0, spendMinor - fixedRemBeforeSpend);
    } else if (normalizedPool === 'oneoff') {
      // Account for emergency credit first, then remaining One-Off allocation, then oneOffFundingSource
      const coveredByCredit = Math.min(spendMinor, remainingEmergencyCreditMinor);
      const afterCreditMinor = spendMinor - coveredByCredit;
      const oneOffAllocRemMinor = Math.max(0, oneOffMinor - Math.max(0, oneOffTrackedSpentMinor - oneOffCoveredByEmergencyCreditMinor));
      const newUncoveredMinor = Math.max(0, afterCreditMinor - oneOffAllocRemMinor);

      if (newUncoveredMinor > 0) {
        if (oneOffFundingSource === 'daily') {
          additionalDailyImpactMinor = newUncoveredMinor;
        } else if (oneOffFundingSource === 'outings') {
          const outingsRemBefore = Math.max(0, outingsMinor - outingsEffectiveForSpillMinor);
          additionalDailyImpactMinor = Math.max(0, newUncoveredMinor - outingsRemBefore);
        } else if (oneOffFundingSource === 'savings') {
          const savRemMinor = Math.max(
            0,
            Math.max(savingsMinor, savingsDepositedMinor) - savingsWithdrawnMinor - savingsAbsorbedOneOffMinor
          );
          additionalDailyImpactMinor = Math.max(0, newUncoveredMinor - savRemMinor);
        }
      }
    }

    if (additionalDailyImpactMinor <= 0) {
      return toMajorUnits(
        remainingDaysInCycle > 1 ? upcomingDailyAllowanceMinor : Math.max(0, todayRemainingMinor),
        minorFactor
      );
    }

    if (remainingDaysInCycle <= 1) {
      return toMajorUnits(Math.max(0, todayRemainingMinor - additionalDailyImpactMinor), minorFactor);
    }

    const newPoolRem = dailyPoolRemainingAtStartOfTodayMinor - todaySpentMinor - additionalDailyImpactMinor;
    if (newPoolRem <= 0) return 0;

    const tomorrowDate = addDays(parseLocalDate(onDateInput), 1);
    const remTomorrow = allCycleDates.filter((d) => formatLocalDate(d) >= formatLocalDate(tomorrowDate));
    if (remTomorrow.length === 0) return 0;

    const projectedTomorrowMinor = roundHalfUp(Math.max(0, newPoolRem) / remTomorrow.length);
    return toMajorUnits(projectedTomorrowMinor, minorFactor);
  };

  // 9. Anomaly Detection
  const anomalies: BudgetAnomaly[] = [];
  for (const tx of cycleTxs) {
    const tax = typeof tx.taxAmount === 'number' && !isNaN(tx.taxAmount) ? Math.max(0, tx.taxAmount) : 0;
    const effectiveTotal = (tx.amount || 0) + tax;
    const amtMinor = toMinorUnits(effectiveTotal, minorFactor);
    const targetPool = getTransactionBudgetPool(tx, effectiveConfig.fixedCategoryIds);

    if (targetPool === 'daily' && dailyMinor > 0 && amtMinor > ANOMALY_POOL_DRAIN_RATIO * dailyMinor) {
      anomalies.push({
        type: 'pool_drain',
        severity: 'critical',
        message: {
          en: `Expense of ${toMajorUnits(amtMinor, minorFactor)} uses over 25% of the monthly Daily Spending pool.`,
          ar: `المصروف بقيمة ${toMajorUnits(amtMinor, minorFactor)} يستهلك أكثر من 25% من ميزانية المصروف اليومي للشهر.`,
        },
        transactionId: tx.id,
        amount: toMajorUnits(amtMinor, minorFactor),
      });
    } else if (targetPool === 'outings' && outingsMinor > 0 && amtMinor > ANOMALY_POOL_DRAIN_RATIO * outingsMinor) {
      anomalies.push({
        type: 'pool_drain',
        severity: 'warning',
        message: {
          en: `Outing expense of ${toMajorUnits(amtMinor, minorFactor)} uses over 25% of the Outings pool.`,
          ar: `مصروف الخروجات بقيمة ${toMajorUnits(amtMinor, minorFactor)} يستهلك أكثر من 25% من ميزانية الخروجات.`,
        },
        transactionId: tx.id,
        amount: toMajorUnits(amtMinor, minorFactor),
      });
    }
  }

  if (sumTotalWeights > 0 && dailyMinor > 0) {
    const elapsedDates = allCycleDates.filter((d) => formatLocalDate(d) <= asOfStr);
    const sumElapsedWeights = elapsedDates.reduce((acc, d) => acc + getWeightForDate(d), 0);
    const expectedBurnRatio = sumElapsedWeights / sumTotalWeights;
    const actualBurnRatio = effectiveDailyTrackedSpentMinor / dailyMinor;
    const deviation = actualBurnRatio - expectedBurnRatio;

    const isMilestone = (ANOMALY_MILESTONE_DAYS as readonly number[]).includes(cycleDayIndex);

    if (deviation > ANOMALY_BURN_DEVIATION_THRESHOLD || (isMilestone && deviation > 0.1)) {
      anomalies.push({
        type: isMilestone ? 'milestone_overburn' : 'burn_rate_deviation',
        severity: deviation > 0.25 ? 'critical' : 'warning',
        message: {
          en: `Spending pace is ${Math.round(deviation * 100)}% ahead of the planned schedule at Day ${cycleDayIndex}.`,
          ar: `معدل الصرف متقدم بنسبة ${Math.round(deviation * 100)}% عن المعدل المخطط في اليوم ${cycleDayIndex} من الدورة.`,
        },
        details: {
          cycleDayIndex,
          expectedBurnPercent: Math.round(expectedBurnRatio * 100),
          actualBurnPercent: Math.round(actualBurnRatio * 100),
          deviationPercent: Math.round(deviation * 100),
        },
      });
    }
  }

  // 10. Manual Per-Cycle Progress Adjustments (Strictly Isolated per Pool — Zero Daily Spillover!)
  const manualProgressMap =
    cycleOverride?.manualProgressAdjustments || effectiveConfig.manualProgressAdjustments || {};
  const savingsManualMinor = Math.trunc(manualProgressMap.savings || 0);
  const fixedManualMinor = Math.trunc(manualProgressMap.fixed || 0);
  const outingsManualMinor = Math.trunc(manualProgressMap.outings || 0);
  const oneOffManualMinor = Math.trunc(manualProgressMap.oneoff || 0);
  const dailyManualMinor = Math.trunc(manualProgressMap.daily || 0);

  const trackedNetSavedMinor = Math.max(0, savingsDepositedMinor - savingsWithdrawnMinor - savingsAbsorbedOneOffMinor);
  const displayNetSavedMinor = Math.max(0, trackedNetSavedMinor + savingsManualMinor);
  const savingsRemainingMinor = Math.max(0, savingsMinor - displayNetSavedMinor);
  const savingsProgressPercent =
    savingsMinor > 0
      ? Math.min(100, Math.max(0, roundHalfUp((displayNetSavedMinor / savingsMinor) * 100)))
      : displayNetSavedMinor > 0
      ? 100
      : 0;

  const fixedDisplaySpentMinor = Math.max(0, fixedTrackedSpentMinor + fixedManualMinor);
  const fixedDisplayRemainingMinor = fixedMinor - fixedDisplaySpentMinor;

  const outingsDisplaySpentMinor = Math.max(0, outingsTrackedSpentMinor + outingsManualMinor);
  const outingsDisplayRemainingMinor = outingsMinor - outingsDisplaySpentMinor;

  const oneOffDisplaySpentMinor = Math.max(0, oneOffTrackedSpentMinor + oneOffManualMinor);
  const oneOffDisplayRemainingMinor = oneOffMinor - oneOffDisplaySpentMinor;

  const dailyDisplaySpentMinor = Math.max(0, effectiveDailyTrackedSpentMinor + dailyManualMinor);
  const dailyDisplayRemainingMinor = dailyMinor - dailyDisplaySpentMinor;

  // 11. Rebalance Scenarios (based purely on tracked transaction deficits)
  const unclampedDailyPoolRemainingMinor = dailyMinor - effectiveDailyTrackedSpentMinor;
  const dailyDeficitMinor = -unclampedDailyPoolRemainingMinor;
  const cycleIncomeDeficitMinor = totalTrackedCycleSpendMinor - cycleIncomeMinor;
  const cycleDeficitMinor = Math.max(0, dailyDeficitMinor, cycleIncomeDeficitMinor);
  const cycleDeficitMajor = toMajorUnits(cycleDeficitMinor, minorFactor);
  const hasDeficit = cycleDeficitMinor > 0 && cycleDeficitMajor >= 0.01;

  const unspentOutingsMinor = Math.max(0, outingsMinor - outingsEffectiveForSpillMinor);
  const unfulfilledSavingsMinor = Math.max(
    0,
    savingsMinor - savingsWithdrawnMinor - savingsAbsorbedOneOffMinor
  );
  const unspentBillsMinor = Math.max(0, fixedMinor - fixedTrackedSpentMinor);

  const beforeDailyAllowanceMajor = toMajorUnits(
    remainingDaysInCycle > 1 ? upcomingDailyAllowanceMinor : Math.max(0, todayRemainingMinor),
    minorFactor
  );

  // Scenario B: Trim Outings
  const canOutingsCover = unspentOutingsMinor >= cycleDeficitMinor;
  const isOutingsAvailable = hasDeficit && canOutingsCover && unspentOutingsMinor > 0;
  const trimmedFromOutingsMinor = isOutingsAvailable ? cycleDeficitMinor : unspentOutingsMinor;
  let scenB_afterDailyAllowanceMinor = 0;
  if (isOutingsAvailable) {
    const poolAfterRebalance = dailyPoolRemainingAfterTodayMinor + trimmedFromOutingsMinor;
    if (remainingDaysInCycle > 1 && poolAfterRebalance > 0) {
      scenB_afterDailyAllowanceMinor = roundHalfUp(poolAfterRebalance / (remainingDaysInCycle - 1));
    } else if (poolAfterRebalance > 0) {
      scenB_afterDailyAllowanceMinor = poolAfterRebalance;
    }
  }

  const scenarioB: RebalanceScenario = {
    id: 'B',
    sourceKey: 'outings',
    sourceName: { en: 'Unspent Outings', ar: 'الخروجات غير المستهلكة' },
    sourceAvailableMinor: unspentOutingsMinor,
    sourceAvailable: toMajorUnits(unspentOutingsMinor, minorFactor),
    name: { en: 'Option 1: Trim Outings', ar: 'الخيار 1: تقليل الخروجات' },
    description: {
      en: 'Cover the extra spending by taking a little from Outings, keeping your savings and daily spending safe.',
      ar: 'تغطية الفارق من ميزانية الخروجات مع حماية مدخراتك ومصروفك اليومي.',
    },
    isAvailable: isOutingsAvailable,
    unavailableReason: !hasDeficit
      ? undefined
      : unspentOutingsMinor === 0
      ? { en: 'No remaining outings budget to trim.', ar: 'ميزانية الخروجات استُنفدت بالفعل ولا يمكن التضحية بها.' }
      : !canOutingsCover
      ? {
          en: `Available Outings (${toMajorUnits(unspentOutingsMinor, minorFactor)}) cannot cover deficit (${cycleDeficitMajor}).`,
          ar: `رصيد الخروجات المتاح (${toMajorUnits(unspentOutingsMinor, minorFactor)}) لا يكفي لتغطية العجز (${cycleDeficitMajor}).`,
        }
      : undefined,
    beforeDailyAllowance: beforeDailyAllowanceMajor,
    afterDailyAllowance: toMajorUnits(scenB_afterDailyAllowanceMinor, minorFactor),
    deficitMinor: cycleDeficitMinor,
    deficit: cycleDeficitMajor,
    absorbedFromSavingsMinor: 0,
    trimmedFromOutingsMinor,
    trimmedFromFixedMinor: 0,
    spilledToDailyMinor: 0,
    unabsorbedDeficitMinor: isOutingsAvailable ? 0 : Math.max(0, cycleDeficitMinor - unspentOutingsMinor),
  };

  // Scenario C: Use Savings Cushion
  const canSavingsCover = unfulfilledSavingsMinor >= cycleDeficitMinor;
  const isSavingsAvailable = hasDeficit && canSavingsCover && unfulfilledSavingsMinor > 0;
  const absorbedFromSavingsMinor = isSavingsAvailable ? cycleDeficitMinor : unfulfilledSavingsMinor;
  let scenC_afterDailyAllowanceMinor = 0;
  if (isSavingsAvailable) {
    const poolAfterRebalance = dailyPoolRemainingAfterTodayMinor + absorbedFromSavingsMinor;
    if (remainingDaysInCycle > 1 && poolAfterRebalance > 0) {
      scenC_afterDailyAllowanceMinor = roundHalfUp(poolAfterRebalance / (remainingDaysInCycle - 1));
    } else if (poolAfterRebalance > 0) {
      scenC_afterDailyAllowanceMinor = poolAfterRebalance;
    }
  }

  const scenarioC: RebalanceScenario = {
    id: 'C',
    sourceKey: 'savings',
    sourceName: { en: 'Savings Cushion', ar: 'وسادة التحويش' },
    sourceAvailableMinor: unfulfilledSavingsMinor,
    sourceAvailable: toMajorUnits(unfulfilledSavingsMinor, minorFactor),
    name: { en: 'Option 2: Use Savings Cushion', ar: 'الخيار 2: استخدام وسادة الادخار' },
    description: {
      en: 'Use a small part of savings so your daily allowance stays comfortable.',
      ar: 'تغطية الفارق من المدخرات للحفاظ على راحة المصروف اليومي.',
    },
    isAvailable: isSavingsAvailable,
    unavailableReason: !hasDeficit
      ? undefined
      : unfulfilledSavingsMinor === 0
      ? { en: 'No available savings cushion to absorb deficit.', ar: 'لا يوجد رصيد تحويش متاح لامتصاص العجز.' }
      : !canSavingsCover
      ? {
          en: `Available Savings (${toMajorUnits(unfulfilledSavingsMinor, minorFactor)}) cannot cover deficit (${cycleDeficitMajor}).`,
          ar: `رصيد التحويش المتاح (${toMajorUnits(unfulfilledSavingsMinor, minorFactor)}) لا يكفي لتغطية العجز (${cycleDeficitMajor}).`,
        }
      : undefined,
    beforeDailyAllowance: beforeDailyAllowanceMajor,
    afterDailyAllowance: toMajorUnits(scenC_afterDailyAllowanceMinor, minorFactor),
    deficitMinor: cycleDeficitMinor,
    deficit: cycleDeficitMajor,
    absorbedFromSavingsMinor,
    trimmedFromOutingsMinor: 0,
    trimmedFromFixedMinor: 0,
    spilledToDailyMinor: 0,
    unabsorbedDeficitMinor: isSavingsAvailable ? 0 : Math.max(0, cycleDeficitMinor - unfulfilledSavingsMinor),
  };

  // Scenario A: Use Unspent Bills & Fixed
  const canBillsCover = unspentBillsMinor >= cycleDeficitMinor;
  const isBillsAvailable = hasDeficit && canBillsCover && unspentBillsMinor > 0;
  const trimmedFromFixedMinor = isBillsAvailable ? cycleDeficitMinor : unspentBillsMinor;
  let scenA_afterDailyAllowanceMinor = 0;
  if (isBillsAvailable) {
    const poolAfterRebalance = dailyPoolRemainingAfterTodayMinor + trimmedFromFixedMinor;
    if (remainingDaysInCycle > 1 && poolAfterRebalance > 0) {
      scenA_afterDailyAllowanceMinor = roundHalfUp(poolAfterRebalance / (remainingDaysInCycle - 1));
    } else if (poolAfterRebalance > 0) {
      scenA_afterDailyAllowanceMinor = poolAfterRebalance;
    }
  }

  const scenarioA: RebalanceScenario = {
    id: 'A',
    sourceKey: 'fixed',
    sourceName: { en: 'Unspent Bills & Fixed', ar: 'الفواتير والالتزامات غير المستهلكة' },
    sourceAvailableMinor: unspentBillsMinor,
    sourceAvailable: toMajorUnits(unspentBillsMinor, minorFactor),
    name: { en: 'Option 3: Use Unspent Bills & Fixed', ar: 'الخيار 3: استخدام فائض الفواتير والالتزامات' },
    description: {
      en: 'Use unspent funds from your Bills & Fixed pool to cover the daily deficit, keeping your savings safe.',
      ar: 'استخدام الفائض من ميزانية الفواتير والالتزامات غير المستهلكة لتغطية العجز مع حماية مدخراتك.',
    },
    isAvailable: isBillsAvailable,
    unavailableReason: !hasDeficit
      ? undefined
      : unspentBillsMinor === 0
      ? { en: 'No unspent bills budget available.', ar: 'لا يوجد فائض في ميزانية الفواتير والالتزامات.' }
      : !canBillsCover
      ? {
          en: `Available Bills budget (${toMajorUnits(unspentBillsMinor, minorFactor)}) cannot cover deficit (${cycleDeficitMajor}).`,
          ar: `رصيد الفواتير المتاح (${toMajorUnits(unspentBillsMinor, minorFactor)}) لا يكفي لتغطية العجز (${cycleDeficitMajor}).`,
        }
      : undefined,
    beforeDailyAllowance: beforeDailyAllowanceMajor,
    afterDailyAllowance: toMajorUnits(scenA_afterDailyAllowanceMinor, minorFactor),
    deficitMinor: cycleDeficitMinor,
    deficit: cycleDeficitMajor,
    absorbedFromSavingsMinor: 0,
    trimmedFromOutingsMinor: 0,
    trimmedFromFixedMinor,
    spilledToDailyMinor: 0,
    unabsorbedDeficitMinor: isBillsAvailable ? 0 : Math.max(0, cycleDeficitMinor - unspentBillsMinor),
  };

  const scenarios: RebalanceScenario[] = hasDeficit ? [scenarioB, scenarioC, scenarioA] : [];

  const topOverspendCategories: OverspendCategorySummary[] = Object.entries(discretionaryCatTotals)
    .sort(([, a], [, b]) => b.totalMinor - a.totalMinor)
    .slice(0, 3)
    .map(([categoryId, data]) => ({
      categoryId,
      amountMinor: data.totalMinor,
      amount: toMajorUnits(data.totalMinor, minorFactor),
      count: data.count,
      pool: data.pool,
    }));

  const totalSpentMinor =
    fixedTrackedSpentMinor +
    outingsTrackedSpentMinor +
    oneOffUncoveredExcessMinor +
    dailyTrackedSpentMinor;
  const totalRemMinor = cycleIncomeMinor - totalSpentMinor;

  return {
    cycle,
    baseCurrency,
    excludedCurrencies: Array.from(excludedCurrenciesSet),
    isPaused,
    calculationMode,
    fromTodayConfig: evaluatedFromTodayConfig || effectiveConfig.fromTodayConfig,
    pools: {
      savings: {
        allocatedMinor: savingsMinor,
        spentMinor: displayNetSavedMinor,
        remainingMinor: savingsRemainingMinor,
        trackedSpentMinor: trackedNetSavedMinor,
        manualAdjustmentMinor: savingsManualMinor,
        allocated: toMajorUnits(savingsMinor, minorFactor),
        spent: toMajorUnits(displayNetSavedMinor, minorFactor),
        remaining: toMajorUnits(savingsRemainingMinor, minorFactor),
        trackedSpent: toMajorUnits(trackedNetSavedMinor, minorFactor),
        manualAdjustment: toMajorUnits(savingsManualMinor, minorFactor),
        depositedMinor: savingsDepositedMinor,
        withdrawnMinor: savingsWithdrawnMinor,
        trackedNetSavedMinor,
        netSavedMinor: displayNetSavedMinor,
        absorbedOneOffMinor: savingsAbsorbedOneOffMinor,
        deposited: toMajorUnits(savingsDepositedMinor, minorFactor),
        withdrawn: toMajorUnits(savingsWithdrawnMinor, minorFactor),
        trackedNetSaved: toMajorUnits(trackedNetSavedMinor, minorFactor),
        netSaved: toMajorUnits(displayNetSavedMinor, minorFactor),
        absorbedOneOff: toMajorUnits(savingsAbsorbedOneOffMinor, minorFactor),
        progressPercent: savingsProgressPercent,
        emergencyCreditMinor,
        emergencyCredit: toMajorUnits(emergencyCreditMinor, minorFactor),
        remainingEmergencyCreditMinor,
        remainingEmergencyCredit: toMajorUnits(remainingEmergencyCreditMinor, minorFactor),
        transactions: savingsTransactions,
      },
      fixed: {
        allocatedMinor: fixedMinor,
        spentMinor: fixedDisplaySpentMinor,
        remainingMinor: fixedDisplayRemainingMinor,
        trackedSpentMinor: fixedTrackedSpentMinor,
        manualAdjustmentMinor: fixedManualMinor,
        allocated: toMajorUnits(fixedMinor, minorFactor),
        spent: toMajorUnits(fixedDisplaySpentMinor, minorFactor),
        remaining: toMajorUnits(fixedDisplayRemainingMinor, minorFactor),
        trackedSpent: toMajorUnits(fixedTrackedSpentMinor, minorFactor),
        manualAdjustment: toMajorUnits(fixedManualMinor, minorFactor),
        transactions: fixedTransactions,
      },
      outings: {
        allocatedMinor: outingsMinor,
        spentMinor: outingsDisplaySpentMinor,
        remainingMinor: outingsDisplayRemainingMinor,
        trackedSpentMinor: outingsTrackedSpentMinor,
        manualAdjustmentMinor: outingsManualMinor,
        allocated: toMajorUnits(outingsMinor, minorFactor),
        spent: toMajorUnits(outingsDisplaySpentMinor, minorFactor),
        remaining: toMajorUnits(outingsDisplayRemainingMinor, minorFactor),
        trackedSpent: toMajorUnits(outingsTrackedSpentMinor, minorFactor),
        manualAdjustment: toMajorUnits(outingsManualMinor, minorFactor),
        transactions: outingsTransactions,
      },
      oneoff: {
        allocatedMinor: oneOffMinor,
        spentMinor: oneOffDisplaySpentMinor,
        remainingMinor: oneOffDisplayRemainingMinor,
        trackedSpentMinor: oneOffTrackedSpentMinor,
        manualAdjustmentMinor: oneOffManualMinor,
        allocated: toMajorUnits(oneOffMinor, minorFactor),
        spent: toMajorUnits(oneOffDisplaySpentMinor, minorFactor),
        remaining: toMajorUnits(oneOffDisplayRemainingMinor, minorFactor),
        trackedSpent: toMajorUnits(oneOffTrackedSpentMinor, minorFactor),
        manualAdjustment: toMajorUnits(oneOffManualMinor, minorFactor),
        coveredByEmergencyCreditMinor: oneOffCoveredByEmergencyCreditMinor,
        coveredByEmergencyCredit: toMajorUnits(oneOffCoveredByEmergencyCreditMinor, minorFactor),
        uncoveredExcessMinor: oneOffUncoveredExcessMinor,
        uncoveredExcess: toMajorUnits(oneOffUncoveredExcessMinor, minorFactor),
        fundingSource: oneOffFundingSource,
        transactions: oneOffTransactions,
      },
      daily: {
        allocatedMinor: dailyMinor,
        spentMinor: dailyDisplaySpentMinor,
        remainingMinor: dailyDisplayRemainingMinor,
        trackedSpentMinor: effectiveDailyTrackedSpentMinor,
        manualAdjustmentMinor: dailyManualMinor,
        allocated: toMajorUnits(dailyMinor, minorFactor),
        spent: toMajorUnits(dailyDisplaySpentMinor, minorFactor),
        remaining: toMajorUnits(dailyDisplayRemainingMinor, minorFactor),
        trackedSpent: toMajorUnits(effectiveDailyTrackedSpentMinor, minorFactor),
        manualAdjustment: toMajorUnits(dailyManualMinor, minorFactor),
        transactions: dailyTransactions,
      },
      total: {
        incomeMinor: cycleIncomeMinor,
        income: toMajorUnits(cycleIncomeMinor, minorFactor),
        plannedBaseIncomeMinor,
        plannedBaseIncome: toMajorUnits(plannedBaseIncomeMinor, minorFactor),
        dynamicPublicIncomeDeltaMinor,
        dynamicPublicIncomeDelta: toMajorUnits(dynamicPublicIncomeDeltaMinor, minorFactor),
        spentMinor: totalSpentMinor,
        spent: toMajorUnits(totalSpentMinor, minorFactor),
        remainingMinor: totalRemMinor,
        remaining: toMajorUnits(totalRemMinor, minorFactor),
      },
    },
    dailyStatus: {
      asOfDate: asOfStr,
      cycleDayIndex,
      cycleLength,
      remainingDaysInCycle,
      weightToday,
      sumRemainingWeights,
      dailyPoolAllocatedMinor: dailyMinor,
      dailyPoolSpentBeforeTodayMinor: effectiveDailySpentBeforeTodayMinor,
      dailyPoolRemainingAtStartOfTodayMinor,
      dailyPoolRemainingAfterTodayMinor,
      plannedDailyAllowanceMinor,
      upcomingDailyAllowanceMinor,
      spilledFromFixedMinor,
      spilledFromOutingsMinor,
      spilledFromOneOffMinor: spilledFromOneOffToDailyMinor,
      totalSpilledToDailyMinor,
      todayAllowanceMinor,
      todaySpentMinor,
      todayRemainingMinor,
      overBudgetByMinor,
      todayAllowance: toMajorUnits(todayAllowanceMinor, minorFactor),
      todaySpent: toMajorUnits(todaySpentMinor, minorFactor),
      todayRemaining: toMajorUnits(todayRemainingMinor, minorFactor),
      overBudgetBy: toMajorUnits(overBudgetByMinor, minorFactor),
      plannedDailyAllowance: toMajorUnits(plannedDailyAllowanceMinor, minorFactor),
      upcomingDailyAllowance: toMajorUnits(upcomingDailyAllowanceMinor, minorFactor),
      dailyPoolRemainingAfterToday: toMajorUnits(dailyPoolRemainingAfterTodayMinor, minorFactor),
      spilledFromFixed: toMajorUnits(spilledFromFixedMinor, minorFactor),
      spilledFromOutings: toMajorUnits(spilledFromOutingsMinor, minorFactor),
      spilledFromOneOff: toMajorUnits(spilledFromOneOffToDailyMinor, minorFactor),
      totalSpilledToDaily: toMajorUnits(totalSpilledToDailyMinor, minorFactor),
      headsUpThresholdRatio,
      allowanceState: isPaused ? 'normal' : allowanceState,
    },
    anomalies: isPaused ? [] : anomalies,
    rebalanceScenarios: {
      hasDeficit: isPaused ? false : hasDeficit,
      deficitMinor: isPaused ? 0 : cycleDeficitMinor,
      deficit: isPaused ? 0 : cycleDeficitMajor,
      scenarios: isPaused ? [] : scenarios,
      scenarioA,
      scenarioB,
      scenarioC,
    },
    topOverspendCategories,
    projectedDailyAllowanceAfterSpend,
  };
}
