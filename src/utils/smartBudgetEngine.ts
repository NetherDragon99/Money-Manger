/**
 * Smart Budget Engine
 * 
 * PURE, typed, dependency-free mathematical engine for personal financial tracking:
 * - Integer minor-units currency math (round half up, with remainders assigned to Daily pool)
 * - Local midnight day boundaries & 28-31 day salary cycle (configurable start day 1-31 or auto-detected)
 * - 4 distinct budget pools: Savings, Fixed Obligations, Outings & Special Days, Daily Safe-to-Spend
 * - Real spending attribution, multi-currency segregation & exclusion
 * - Savings / Investment transfer principal tracking & reversible withdrawal adjustments
 * - Weighted daily allowance calculation with rollover or sweep-to-savings
 * - Anomaly detection with named constants (spending spikes, pool drains, milestone burn checks)
 * - 3 non-destructive rebalance scenarios (Protect Savings, Trim Outings, Emergency Savings Absorption)
 */

import type {
  Transaction,
  Account,
  PoolAllocationConfig,
  SmartBudgetCycleOverride,
  SmartBudgetSettings,
  BudgetAdjustment,
  ExpenseBudgetPool,
  FromTodayConfig,
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
  if (rawPool === 'emergency' || rawPool === 'oneoff') return 'oneoff';
  if (rawPool === 'fixed') return 'fixed';
  if (rawPool === 'outings') return 'outings';
  if (rawPool === 'daily') return 'daily';
  return isRecurring ? 'fixed' : 'daily';
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

export type BudgetPoolType = 'savings' | 'fixed' | 'outings' | 'daily';

export type SavingsConfig =
  | { type: 'percent'; value: number }
  | { type: 'fixed'; value: number };

export type RolloverSetting = 'spread' | 'sweep_to_savings';

export interface SmartBudgetConfig {
  /** Day of month cycle starts (1-31, synced to global App Month start day) */
  startDay?: number | 'auto';
  /** Manual planned cycle income in major units */
  plannedIncome?: number;
  /** Savings target configuration */
  savings?: SavingsConfig;
  /** Planned fixed obligations in major units (or calculated from recurring) */
  plannedFixedObligations?: number;
  /** Category IDs classified as fixed obligations */
  fixedCategoryIds?: string[];
  /** Outings pool budget in major units */
  outingsBudget?: number;
  /** Day of week weights (0=Sun, 1=Mon, ..., 6=Sat). Range 1.0 to 3.0. Default: 1.0 */
  weekdayWeights?: Partial<Record<number, number>>;
  /** Rollover mode for unspent daily allowance */
  rolloverSetting?: RolloverSetting;
  /** Base currency symbol or code (e.g. 'EGP', '£', 'USD') */
  baseCurrency?: string;
  /** Account IDs to include (defaults to all included accounts) */
  includedAccountIds?: string[];
  /** Whether to include private accounts (default: false) */
  includePrivateAccounts?: boolean;
  /** Minor units per major unit (default: 100 for cents/piastres) */
  minorPerMajor?: number;
  /** Fraction of planned daily allowance below which upcoming days show a calm Heads-up state (default: 0.7) */
  headsUpThresholdRatio?: number;
  /** Dual-input bidirectional pool configurations */
  poolsConfig?: {
    savings: PoolAllocationConfig;
    fixed: PoolAllocationConfig;
    outings: PoolAllocationConfig;
  };
  /** Cycle overrides keyed by cycle startDate 'YYYY-MM-DD' */
  overrides?: Record<string, SmartBudgetCycleOverride>;
  /** Linked budget adjustments from savings/investment withdrawals */
  adjustments?: Record<string, BudgetAdjustment>;
  /** Per-cycle calculation mode */
  calculationMode?: 'full_cycle' | 'from_today';
  /** Configuration for 'from_today' calculation mode */
  fromTodayConfig?: FromTodayConfig;
  /** Whether Smart Budget is paused for this cycle */
  isPaused?: boolean;
}

export interface CycleInfo {
  startDate: string; // YYYY-MM-DD (also serves as canonical cycle key)
  endDate: string; // YYYY-MM-DD
  cycleKey: string; // YYYY-MM-DD (same as startDate)
  startDay: number; // 1-31 (configured start day)
  effectiveStartDay: number; // 1-31 (clamped to actual start month length)
  length: number; // 28-31
  label: string;
}

export interface PoolSpendingStatus {
  allocatedMinor: number;
  spentMinor: number;
  remainingMinor: number;
  allocated: number;
  spent: number;
  remaining: number;
}

export interface SavingsPoolStatus extends PoolSpendingStatus {
  /** Principal deposited into savings/investment via transfers with isSavingsAllocation = true */
  depositedMinor: number;
  /** Principal withdrawn from savings/investment to spending accounts in this cycle */
  withdrawnMinor: number;
  /** Net saved in this cycle (depositedMinor - withdrawnMinor) */
  netSavedMinor: number;
  deposited: number;
  withdrawn: number;
  netSaved: number;
  /** Progress percentage toward the cycle savings target (0 to 100) */
  progressPercent: number;
  /** Total emergency credit created by Option 1 withdrawals in this cycle */
  emergencyCreditMinor: number;
  emergencyCredit: number;
  /** Remaining emergency credit after offsetting 'oneoff'/'emergency' expenses */
  remainingEmergencyCreditMinor: number;
  remainingEmergencyCredit: number;
}

export type DailyAllowanceState = 'normal' | 'heads_up' | 'true_deficit';

export interface DailyAllowanceStatus {
  asOfDate: string; // YYYY-MM-DD
  cycleDayIndex: number; // 1-based index in cycle (e.g. 1 to 31)
  cycleLength: number; // Total days in this cycle
  remainingDaysInCycle: number; // Remaining days including today
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
  totalSpilledToDailyMinor: number;
  todayAllowanceMinor: number;
  todaySpentMinor: number;
  todayRemainingMinor: number;
  overBudgetByMinor: number; // Negative remaining clamped to 0
  todayAllowance: number;
  todaySpent: number;
  todayRemaining: number;
  overBudgetBy: number;
  plannedDailyAllowance: number;
  upcomingDailyAllowance: number;
  dailyPoolRemainingAfterToday: number;
  spilledFromFixed: number;
  spilledFromOutings: number;
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
    daily: PoolSpendingStatus;
    total: {
      incomeMinor: number;
      income: number;
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
    scenarioA: RebalanceScenario; // Option 3: Fixed Bills
    scenarioB: RebalanceScenario; // Option 1: Trim Outings
    scenarioC: RebalanceScenario; // Option 2: Use Savings Cushion
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

/**
 * Rounds half up to nearest integer (banker's / commercial standard)
 */
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

/**
 * Returns the actual number of calendar days (28, 29, 30, or 31) in a given local month.
 */
export function getDaysInCalendarMonth(year: number, monthZeroIndexed: number): number {
  return new Date(year, monthZeroIndexed + 1, 0).getDate();
}

/**
 * Clamps a configured cycle start day (1-31) to the actual last day of shorter months
 * (28/29 in Feb, 30 in Apr/Jun/Sep/Nov).
 */
export function clampDayToMonth(year: number, monthZeroIndexed: number, startDay: number): number {
  const normalizedTarget = Math.min(31, Math.max(1, Math.floor(startDay || 1)));
  const maxDays = getDaysInCalendarMonth(year, monthZeroIndexed);
  return Math.min(normalizedTarget, maxDays);
}

/**
 * Computes exact calendar day difference between two dates using real local calendar
 * date components (year, month, day) in the device local timezone (DST-safe).
 */
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

/**
 * Resolves the unified financial cycle range [startDate, endDate] for any startDay (1-31).
 * Clamps start days 29-31 to the actual last day of shorter months (28/29 in Feb, 30 in Apr/Jun/Sep/Nov)
 * and computes total cycle days (28, 29, 30, or 31) using real local calendar date components.
 */
export function getSalaryCycleRange(
  refDate: string | Date,
  startDay: number
): CycleInfo {
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

/**
 * Resolves the active cycle override keyed by cycle start date ('YYYY-MM-DD'),
 * with transparent fallback for legacy 'YYYY-MM' keys.
 */
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

/**
 * Migrates previously saved Smart Budget settings to use the unified global App Month start day
 * and converts any legacy 'YYYY-MM' override keys to 'YYYY-MM-DD' cycle start date keys.
 */
export function migrateSmartBudgetSettingsToUnifiedCycle(
  smartBudget: SmartBudgetSettings | undefined,
  globalMonthStartDay: number
): { migrated: SmartBudgetSettings | undefined; changed: boolean } {
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
        nextOverrides[fullKey] = val;
        changed = true;
      } else {
        nextOverrides[key] = val;
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

/**
 * Auto-detects salary start day from latest income transaction marked as salary.
 * Falls back to defaultStartDay if no salary transactions exist.
 */
export function autoDetectSalaryDay(
  transactions: Transaction[],
  defaultStartDay = 1
): number {
  const normalizedDefault = Math.min(31, Math.max(1, Math.floor(defaultStartDay || 1)));
  if (!transactions || transactions.length === 0) return normalizedDefault;

  // Filter income transactions marked as salary
  const salaryTxs = transactions.filter((t) => {
    if (t.type !== 'income') return false;
    if (t.isSalary) return true;
    const text = `${t.description || ''} ${t.categoryName || ''} ${t.note || ''}`.toLowerCase();
    return text.includes('salary') || text.includes('مرتب') || text.includes('راتب');
  });

  if (salaryTxs.length === 0) return normalizedDefault;

  // Sort descending by date/createdAt
  salaryTxs.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));

  const latest = salaryTxs[0];
  const parsed = parseLocalDate(latest.date);
  const detectedDay = parsed.getDate();
  return Math.min(31, Math.max(1, detectedDay));
}

function normalizeCurrencyCodeOrSymbol(curr?: string): string {
  const c = (curr || 'EGP').trim().toUpperCase();
  if (c === '£' || c === 'EGP' || c === 'LE' || c === 'L.E' || c === 'ج.م' || c === 'ج.م.') {
    return 'EGP';
  }
  if (c === '$' || c === 'USD') return 'USD';
  if (c === '€' || c === 'EUR') return 'EUR';
  return c;
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
  if (config.startDay === 'auto') {
    cycleStartDay = autoDetectSalaryDay(transactions, 1);
  } else if (typeof config.startDay === 'number') {
    cycleStartDay = Math.min(31, Math.max(1, Math.floor(config.startDay)));
  }
  const cycle = getSalaryCycleRange(asOfDate, cycleStartDay);
  const cycleStart = parseLocalDate(cycle.startDate);
  const cycleEnd = parseLocalDate(cycle.endDate);

  // Apply active cycle override (keyed by cycle.startDate 'YYYY-MM-DD') if present
  const cycleOverride = resolveCycleOverride(config.overrides, cycle.startDate);
  const effectiveConfig: SmartBudgetConfig = cycleOverride
    ? { ...config, ...cycleOverride }
    : config;

  // 2. Base Currency & Account Filtering
  const baseCurrency = effectiveConfig.baseCurrency || accounts[0]?.currency || 'EGP';
  const normalizedBaseCurr = normalizeCurrencyCodeOrSymbol(baseCurrency);
  const accountMap = new Map<string, Account>();
  for (const acc of accounts) {
    accountMap.set(acc.id, acc);
  }
  const includedAccountSet =
    effectiveConfig.includedAccountIds && effectiveConfig.includedAccountIds.length > 0
      ? new Set(effectiveConfig.includedAccountIds)
      : null;
  const excludedCurrenciesSet = new Set<string>();

  for (const acc of accounts) {
    if (acc.isPrivate && !effectiveConfig.includePrivateAccounts) continue;
    if (acc.currency && normalizeCurrencyCodeOrSymbol(acc.currency) !== normalizedBaseCurr) {
      excludedCurrenciesSet.add(acc.currency);
    }
  }

  // 3. Cycle Spending & Transfer Filtering
  // Internal transfers between any accounts are NEVER counted as expenses and NEVER create budget deficits.
  const calculationMode: 'full_cycle' | 'from_today' = effectiveConfig.calculationMode || 'full_cycle';
  const isPaused = Boolean(effectiveConfig.isPaused);

  let fromDateStr = cycle.startDate;
  let remainingMoneyMinor: number | null = null;
  if (calculationMode === 'from_today') {
    const rawFromDate = effectiveConfig.fromTodayConfig?.fromDate || asOfStr;
    fromDateStr =
      rawFromDate < cycle.startDate
        ? cycle.startDate
        : rawFromDate > cycle.endDate
        ? cycle.endDate
        : rawFromDate;
    if (effectiveConfig.fromTodayConfig?.remainingMoney != null) {
      remainingMoneyMinor = Math.max(
        0,
        toMinorUnits(effectiveConfig.fromTodayConfig.remainingMoney, minorFactor)
      );
    } else if (effectiveConfig.fromTodayConfig?.remainingMoneyMinor != null) {
      remainingMoneyMinor = Math.max(0, effectiveConfig.fromTodayConfig.remainingMoneyMinor);
    }
  }

  const cycleTxs: Transaction[] = [];
  let savingsDepositedMinor = 0;
  let savingsWithdrawnMinor = 0;
  let emergencyCreditMinor = 0;
  let dailyPoolAdjustmentMinor = 0;

  const adjustmentsMap = effectiveConfig.adjustments || config.adjustments || {};

  for (const tx of transactions) {
    if (!tx || !tx.date) continue;
    const cleanTxDate = tx.date.split('T')[0].trim();
    if (cleanTxDate < cycle.startDate || cleanTxDate > cycle.endDate) continue;

    // In 'from_today' mode, count ONLY transactions from today onward over the remaining days
    if (calculationMode === 'from_today' && cleanTxDate < fromDateStr) continue;

    const acc = accountMap.get(tx.accountId);
    if (acc) {
      if (acc.currency && normalizeCurrencyCodeOrSymbol(acc.currency) !== normalizedBaseCurr) {
        excludedCurrenciesSet.add(acc.currency);
        continue;
      }
    }

    // Handle internal transfers (never counted as expenses)
    if (tx.type === 'transfer' || Boolean(tx.toAccountId)) {
      if (!tx.toAccountId || tx.accountId === tx.toAccountId) continue;

      const toAcc = accountMap.get(tx.toAccountId);
      if (toAcc?.currency && normalizeCurrencyCodeOrSymbol(toAcc.currency) !== normalizedBaseCurr) {
        excludedCurrenciesSet.add(toAcc.currency);
        continue;
      }

      // Principal amount X only (never tx.transferFee)
      const principalMinor = Math.max(0, toMinorUnits(tx.amount || 0, minorFactor));
      if (principalMinor <= 0) continue;

      const fromRole = acc?.accountRole || 'spending';
      const toRole = toAcc?.accountRole || 'spending';

      const linkedAdj: BudgetAdjustment | undefined =
        (tx.linkedAdjustmentId && adjustmentsMap[tx.linkedAdjustmentId]) ||
        adjustmentsMap[`adj_tx_${tx.id}`] ||
        tx.budgetAdjustment;

      const isWithdrawalFromSavingsToSpending =
        ((fromRole === 'savings' || fromRole === 'investment') && toRole === 'spending') ||
        Boolean(tx.savingsWithdrawalChoice) ||
        Boolean(linkedAdj);

      if (isWithdrawalFromSavingsToSpending) {
        // In all 3 withdrawal cases, net cycle savings progress decreases by the withdrawn principal amount
        const adjMinor = linkedAdj?.amountMinor !== undefined ? linkedAdj.amountMinor : principalMinor;
        savingsWithdrawnMinor += adjMinor;

        const choice = linkedAdj?.choice || tx.savingsWithdrawalChoice || 'just_moving';
        if (choice === 'emergency_expense') {
          // Option 1: Emergency credit offsets 'oneoff' / 'emergency' expenses in the same cycle
          emergencyCreditMinor += adjMinor;
        } else if (choice === 'add_to_spending') {
          // Option 2: Increases the current cycle's Daily Spending pool by the amount
          dailyPoolAdjustmentMinor += adjMinor;
        }
        // Option 3 ('just_moving'): no impact on spending pools
      } else if (tx.isSavingsAllocation === true) {
        // Transfers with Savings / Investment Allocation ON count principal X toward Savings target
        savingsDepositedMinor += principalMinor;
      }

      continue;
    }

    if (acc) {
      if (includedAccountSet && !includedAccountSet.has(acc.id)) continue;
      if (acc.isPrivate && !effectiveConfig.includePrivateAccounts) continue;
    }

    // Skip manual balance adjustments
    if (tx.isAdjustment || tx.isUneditable) continue;
    const desc = (tx.description || '').toLowerCase();
    if (desc.includes('manual balance adjustment') || desc.includes('تسوية رصيد')) continue;

    if (tx.type === 'expense') {
      cycleTxs.push({ ...tx, date: cleanTxDate });
    }
  }

  // Determine Cycle Total Income:
  // In 'from_today' mode, uses remainingMoney as the income basis for the remaining cycle.
  // In 'full_cycle' mode, uses user-entered plannedIncome (never from deposit transactions).
  const cycleIncomeMinor =
    calculationMode === 'from_today' && remainingMoneyMinor !== null
      ? remainingMoneyMinor
      : Math.max(0, toMinorUnits(effectiveConfig.plannedIncome || 0, minorFactor));

  // 4. Split Income Into 4 Pools (Minor Units Integer Math with Half-Up Rounding)
  let savingsMinor = 0;
  let fixedMinor = 0;
  let outingsMinor = 0;

  if (calculationMode === 'from_today') {
    // In "From Today" mode: applies pool percentages to this remaining amount
    const savingsPct =
      effectiveConfig.poolsConfig?.savings?.percent ??
      (effectiveConfig.savings?.type === 'percent' ? effectiveConfig.savings.value : 0);
    const fixedPct = effectiveConfig.poolsConfig?.fixed?.percent ?? 0;
    const outingsPct = effectiveConfig.poolsConfig?.outings?.percent ?? 0;

    savingsMinor = roundHalfUp(cycleIncomeMinor * (Math.max(0, savingsPct) / 100));
    savingsMinor = Math.min(cycleIncomeMinor, Math.max(0, savingsMinor));

    fixedMinor = roundHalfUp(cycleIncomeMinor * (Math.max(0, fixedPct) / 100));
    fixedMinor = Math.min(Math.max(0, cycleIncomeMinor - savingsMinor), Math.max(0, fixedMinor));

    outingsMinor = roundHalfUp(cycleIncomeMinor * (Math.max(0, outingsPct) / 100));
    outingsMinor = Math.min(Math.max(0, cycleIncomeMinor - savingsMinor - fixedMinor), Math.max(0, outingsMinor));
  } else if (effectiveConfig.poolsConfig) {
    if (effectiveConfig.poolsConfig.savings) {
      if (effectiveConfig.poolsConfig.savings.mode === 'percent') {
        savingsMinor = roundHalfUp(cycleIncomeMinor * (effectiveConfig.poolsConfig.savings.percent / 100));
      } else {
        savingsMinor = roundHalfUp(effectiveConfig.poolsConfig.savings.minorUnits);
      }
    }
    savingsMinor = Math.min(cycleIncomeMinor, Math.max(0, savingsMinor));

    if (effectiveConfig.poolsConfig.fixed) {
      if (effectiveConfig.poolsConfig.fixed.mode === 'percent') {
        fixedMinor = roundHalfUp(cycleIncomeMinor * (effectiveConfig.poolsConfig.fixed.percent / 100));
      } else {
        fixedMinor = roundHalfUp(effectiveConfig.poolsConfig.fixed.minorUnits);
      }
    }
    fixedMinor = Math.min(Math.max(0, cycleIncomeMinor - savingsMinor), Math.max(0, fixedMinor));

    if (effectiveConfig.poolsConfig.outings) {
      if (effectiveConfig.poolsConfig.outings.mode === 'percent') {
        outingsMinor = roundHalfUp(cycleIncomeMinor * (effectiveConfig.poolsConfig.outings.percent / 100));
      } else {
        outingsMinor = roundHalfUp(effectiveConfig.poolsConfig.outings.minorUnits);
      }
    }
    outingsMinor = Math.min(Math.max(0, cycleIncomeMinor - savingsMinor - fixedMinor), Math.max(0, outingsMinor));
  } else {
    // Legacy calculation fallback
    if (effectiveConfig.savings) {
      if (effectiveConfig.savings.type === 'percent') {
        savingsMinor = roundHalfUp(cycleIncomeMinor * (Math.max(0, effectiveConfig.savings.value) / 100));
      } else {
        savingsMinor = toMinorUnits(Math.max(0, effectiveConfig.savings.value), minorFactor);
      }
      savingsMinor = Math.min(cycleIncomeMinor, savingsMinor);
    }

    const plannedFixedMinor = toMinorUnits(Math.max(0, effectiveConfig.plannedFixedObligations || 0), minorFactor);
    fixedMinor = Math.min(Math.max(0, cycleIncomeMinor - savingsMinor), plannedFixedMinor);

    const plannedOutingsMinor = toMinorUnits(Math.max(0, effectiveConfig.outingsBudget || 0), minorFactor);
    outingsMinor = Math.min(Math.max(0, cycleIncomeMinor - savingsMinor - fixedMinor), plannedOutingsMinor);
  }

  // Pool 4: Daily Safe-to-Spend (absorbs remainder + any Option 2 'add_to_spending' withdrawal adjustments)
  const baseDailyMinor = Math.max(0, cycleIncomeMinor - savingsMinor - fixedMinor - outingsMinor);
  const dailyMinor = Math.max(0, baseDailyMinor + dailyPoolAdjustmentMinor);

  // 5. Attribute Expenses to Pools ('daily' | 'fixed' | 'outings' | 'oneoff')
  const fixedCategorySet = new Set(effectiveConfig.fixedCategoryIds || []);
  let savingsSpentMinor = 0; // Uncovered one-off / exceptional expenses tracked outside daily pool
  let fixedSpentMinor = 0;
  let fixedSpentBeforeTodayMinor = 0;
  let outingsSpentMinor = 0;
  let outingsSpentBeforeTodayMinor = 0;
  let dailySpentMinor = 0;
  let remainingEmergencyCreditMinor = emergencyCreditMinor;

  // Track daily spending by date
  const dailySpentByDate: Record<string, number> = {};
  // Daily spending in the cycle outside today
  let dailySpentBeforeTodayMinor = 0;
  let todayDailySpentMinor = 0;

  // Track spending per category for Daily and Outings pools (for "What caused the overspend" summary)
  const discretionaryCatTotals: Record<string, { totalMinor: number; count: number; pool: 'daily' | 'outings' }> = {};

  // Sort cycleTxs chronologically so emergency credits offset exceptional ('oneoff') expenses in order
  const sortedCycleTxs = [...cycleTxs].sort(
    (a, b) => (a.date || '').localeCompare(b.date || '') || (a.createdAt || 0) - (b.createdAt || 0)
  );

  for (const tx of sortedCycleTxs) {
    const tax = typeof tx.taxAmount === 'number' && !isNaN(tx.taxAmount) ? Math.max(0, tx.taxAmount) : 0;
    const effectiveTotal = (tx.amount || 0) + tax;
    const amtMinor = toMinorUnits(effectiveTotal, minorFactor);
    const txDate = tx.date;
    const rawPool = tx.budgetPool as string | undefined;

    // Attribution priority:
    // 1. Explicit budgetPool ('daily' | 'fixed' | 'outings' | 'oneoff' / legacy 'emergency')
    // 2. Recurring generated or fixed-category -> 'fixed' (Bills & Fixed)
    // 3. Default -> 'daily' (Daily Spending)
    if (rawPool === 'outings') {
      outingsSpentMinor += amtMinor;
      if (txDate < asOfStr) outingsSpentBeforeTodayMinor += amtMinor;
      const catId = tx.categoryId || 'uncategorized';
      if (!discretionaryCatTotals[catId]) {
        discretionaryCatTotals[catId] = { totalMinor: 0, count: 0, pool: 'outings' };
      }
      discretionaryCatTotals[catId].totalMinor += amtMinor;
      discretionaryCatTotals[catId].count += 1;
    } else if (rawPool === 'oneoff' || rawPool === 'emergency') {
      // 'oneoff' (One-off / Exceptional) expenses NEVER reduce the daily allowance
      // and are offset first by emergency credits from savings withdrawals.
      const coveredByCredit = Math.min(amtMinor, remainingEmergencyCreditMinor);
      remainingEmergencyCreditMinor -= coveredByCredit;
      const uncoveredExceptionalMinor = amtMinor - coveredByCredit;
      savingsSpentMinor += uncoveredExceptionalMinor;
    } else if (rawPool === 'fixed') {
      fixedSpentMinor += amtMinor;
      if (txDate < asOfStr) fixedSpentBeforeTodayMinor += amtMinor;
    } else if (rawPool === 'daily') {
      dailySpentMinor += amtMinor;
      dailySpentByDate[txDate] = (dailySpentByDate[txDate] || 0) + amtMinor;
      if (txDate === asOfStr) todayDailySpentMinor += amtMinor;
      else if (txDate < asOfStr) dailySpentBeforeTodayMinor += amtMinor;
      const catId = tx.categoryId || 'uncategorized';
      if (!discretionaryCatTotals[catId]) {
        discretionaryCatTotals[catId] = { totalMinor: 0, count: 0, pool: 'daily' };
      }
      discretionaryCatTotals[catId].totalMinor += amtMinor;
      discretionaryCatTotals[catId].count += 1;
    } else if (
      tx.isFromRecurring ||
      Boolean(tx.recurringRuleId) ||
      (tx.categoryId && fixedCategorySet.has(tx.categoryId))
    ) {
      fixedSpentMinor += amtMinor;
      if (txDate < asOfStr) fixedSpentBeforeTodayMinor += amtMinor;
    } else {
      // Default to daily
      dailySpentMinor += amtMinor;
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

  // Calmly spill any Bills & Fixed ('fixed') or Outings ('outings') overspend into the Daily pool.
  // Pre-today spillover reduces the Daily pool at the start of today; today's spillover is absorbed into upcoming days
  // so today's baseline allowance (Allowed Today) never shrinks mid-day while spending.
  const fixedOverspendBeforeTodayMinor = Math.max(0, fixedSpentBeforeTodayMinor - fixedMinor);
  const outingsOverspendBeforeTodayMinor = Math.max(0, outingsSpentBeforeTodayMinor - outingsMinor);
  const spilledBeforeTodayMinor = fixedOverspendBeforeTodayMinor + outingsOverspendBeforeTodayMinor;

  const spilledFromFixedMinor = Math.max(0, fixedSpentMinor - fixedMinor);
  const spilledFromOutingsMinor = Math.max(0, outingsSpentMinor - outingsMinor);
  const totalSpilledToDailyMinor = spilledFromFixedMinor + spilledFromOutingsMinor;
  const spilledTodayMinor = Math.max(0, totalSpilledToDailyMinor - spilledBeforeTodayMinor);

  // 6. Day Weights & Remaining Days in Cycle (Pure Local Calendar Components)
  const weekdayWeights = { ...effectiveConfig.weekdayWeights };
  const getWeightForDate = (d: Date): number => {
    const dayOfWeek = d.getDay();
    const w = weekdayWeights[dayOfWeek];
    if (typeof w === 'number' && !isNaN(w)) {
      return Math.min(3.0, Math.max(1.0, w));
    }
    return 1.0;
  };

  // Generate all dates in cycle using local calendar components
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

  // Active dates for planned daily allowance calculation:
  // In 'from_today' mode, active dates start from fromDateStr through cycleEnd.
  const activeDates =
    calculationMode === 'from_today'
      ? allCycleDates.filter((d) => formatLocalDate(d) >= fromDateStr)
      : allCycleDates;
  const sumActiveWeights = activeDates.reduce((acc, d) => acc + getWeightForDate(d), 0);

  // Planned baseline daily allowance at cycle start (or from_today start, weighted for today)
  const plannedDailyAllowanceMinor =
    sumActiveWeights > 0 ? roundHalfUp((dailyMinor * weightToday) / sumActiveWeights) : 0;

  // 7. Calculate Today's Baseline Allowance (Allowed Today = Remaining Daily Pool at start of today ÷ Remaining Days in Cycle including today)
  const rollover = effectiveConfig.rolloverSetting || 'spread';
  const effectiveDailySpentBeforeTodayMinor = dailySpentBeforeTodayMinor + spilledBeforeTodayMinor;
  let dailyPoolRemainingAtStartOfTodayMinor: number;

  if (rollover === 'sweep_to_savings') {
    // Simulate past days: unspent daily allowances were swept into savings at midnight
    let poolSimMinor = Math.max(0, dailyMinor - spilledBeforeTodayMinor);
    for (let i = 0; i < allCycleDates.length; i++) {
      const d = allCycleDates[i];
      const dStr = formatLocalDate(d);
      if (dStr >= asOfStr) break;

      const remDatesAtD = allCycleDates.slice(i);
      const sumWeightsAtD = remDatesAtD.reduce((acc, x) => acc + getWeightForDate(x), 0);
      const wD = getWeightForDate(d);
      const allowD = sumWeightsAtD > 0 ? roundHalfUp((Math.max(0, poolSimMinor) * wD) / sumWeightsAtD) : 0;
      const spentD = dailySpentByDate[dStr] || 0;

      if (spentD <= allowD) {
        // Unspent allowance is swept to savings
        poolSimMinor = Math.max(0, poolSimMinor - allowD);
      } else {
        // Overspend reduces pool
        poolSimMinor = poolSimMinor - spentD;
      }
    }
    dailyPoolRemainingAtStartOfTodayMinor = poolSimMinor;
  } else {
    // Default 'spread': Remaining Daily Pool at start of today
    dailyPoolRemainingAtStartOfTodayMinor = dailyMinor - effectiveDailySpentBeforeTodayMinor;
  }

  let todayAllowanceMinor = 0;
  if (remainingDaysInCycle > 0 && sumRemainingWeights > 0 && dailyPoolRemainingAtStartOfTodayMinor > 0) {
    todayAllowanceMinor = roundHalfUp(
      (dailyPoolRemainingAtStartOfTodayMinor * weightToday) / sumRemainingWeights
    );
  }

  const todaySpentMinor = todayDailySpentMinor + spilledTodayMinor;
  const todayRemainingMinor = todayAllowanceMinor - todaySpentMinor;
  const overBudgetByMinor = todayRemainingMinor < 0 ? Math.abs(todayRemainingMinor) : 0;

  // Remaining monthly Daily pool after today's spending and any spillover
  const dailyPoolRemainingAfterTodayMinor = dailyPoolRemainingAtStartOfTodayMinor - todaySpentMinor;
  const effectiveDailySpentMinor = dailySpentMinor + totalSpilledToDailyMinor;
  const effectiveDailyRemainingMinor = dailyMinor - effectiveDailySpentMinor;

  // Daily amount for upcoming days (Y) after absorbing today's spending
  let upcomingDailyAllowanceMinor = 0;
  if (remainingDaysInCycle > 1) {
    const futureDates = remainingDates.slice(1);
    const sumFutureWeights = futureDates.reduce((acc, d) => acc + getWeightForDate(d), 0);
    const nextDayWeight = futureDates.length > 0 ? getWeightForDate(futureDates[0]) : 1.0;
    if (sumFutureWeights > 0 && dailyPoolRemainingAfterTodayMinor > 0) {
      upcomingDailyAllowanceMinor = roundHalfUp(
        (dailyPoolRemainingAfterTodayMinor * nextDayWeight) / sumFutureWeights
      );
    }
  } else {
    upcomingDailyAllowanceMinor = Math.max(0, todayRemainingMinor);
  }

  // 3-State Calm Allowance Status ('normal' | 'heads_up' | 'true_deficit')
  const rawThreshold = effectiveConfig.headsUpThresholdRatio ?? DEFAULT_HEADS_UP_THRESHOLD_RATIO;
  const headsUpThresholdRatio = Math.min(0.95, Math.max(0.3, rawThreshold));

  const totalCycleSpendMinor = fixedSpentMinor + outingsSpentMinor + dailySpentMinor;
  const isDailyPoolExhausted =
    dailyMinor > 0
      ? effectiveDailyRemainingMinor < 0 ||
        (effectiveDailyRemainingMinor === 0 && (overBudgetByMinor > 0 || remainingDaysInCycle > 1))
      : effectiveDailySpentMinor > 0;
  const isTotalIncomeExceeded = cycleIncomeMinor > 0 && totalCycleSpendMinor > cycleIncomeMinor;

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

  // 8. Projected Daily Allowance Helper
  const projectedDailyAllowanceAfterSpend = (
    amountMajor: number,
    pool: ExpenseBudgetPool | 'emergency' = 'daily',
    onDateInput: string | Date = asOfDate
  ): number => {
    const normalizedPool = normalizeExpenseBudgetPool(pool);
    if (normalizedPool === 'oneoff') {
      // One-off / Exceptional expenses NEVER reduce the daily allowance
      return toMajorUnits(
        remainingDaysInCycle > 1 ? upcomingDailyAllowanceMinor : Math.max(0, todayRemainingMinor),
        minorFactor
      );
    }

    const spendMinor = toMinorUnits(Math.max(0, amountMajor), minorFactor);
    let additionalDailyImpactMinor = 0;

    if (normalizedPool === 'daily') {
      additionalDailyImpactMinor = spendMinor;
    } else if (normalizedPool === 'outings') {
      const outingsRemBeforeSpend = Math.max(0, outingsMinor - outingsSpentMinor);
      additionalDailyImpactMinor = Math.max(0, spendMinor - outingsRemBeforeSpend);
    } else if (normalizedPool === 'fixed') {
      const fixedRemBeforeSpend = Math.max(0, fixedMinor - fixedSpentMinor);
      additionalDailyImpactMinor = Math.max(0, spendMinor - fixedRemBeforeSpend);
    }

    if (additionalDailyImpactMinor <= 0) {
      return toMajorUnits(
        remainingDaysInCycle > 1 ? upcomingDailyAllowanceMinor : Math.max(0, todayRemainingMinor),
        minorFactor
      );
    }

    const newPoolRem = dailyPoolRemainingAtStartOfTodayMinor - todaySpentMinor - additionalDailyImpactMinor;
    if (newPoolRem <= 0 || remainingDaysInCycle <= 1) return 0;

    // Project tomorrow's allowance
    const tomorrowDate = addDays(parseLocalDate(onDateInput), 1);
    const remTomorrow = allCycleDates.filter((d) => formatLocalDate(d) >= formatLocalDate(tomorrowDate));
    if (remTomorrow.length === 0) return 0;
    const wTomorrow = getWeightForDate(remTomorrow[0]);
    const sumTomorrowWeights = remTomorrow.reduce((acc, d) => acc + getWeightForDate(d), 0);
    if (sumTomorrowWeights <= 0) return 0;

    const projectedTomorrowMinor = roundHalfUp((Math.max(0, newPoolRem) * wTomorrow) / sumTomorrowWeights);
    return toMajorUnits(projectedTomorrowMinor, minorFactor);
  };

  // 9. Anomaly Detection (Removed legacy single_expense_spike > 2x allowance alert)
  const anomalies: BudgetAnomaly[] = [];

  for (const tx of cycleTxs) {
    const tax = typeof tx.taxAmount === 'number' && !isNaN(tx.taxAmount) ? Math.max(0, tx.taxAmount) : 0;
    const effectiveTotal = (tx.amount || 0) + tax;
    const amtMinor = toMinorUnits(effectiveTotal, minorFactor);
    const targetPool = normalizeExpenseBudgetPool(
      tx.budgetPool,
      Boolean(tx.isFromRecurring || tx.recurringRuleId)
    );
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

  // Milestone Health Checks (Days 7, 14, 21) & Burn Rate Deviation (> 15% points)
  if (sumTotalWeights > 0 && dailyMinor > 0) {
    const elapsedDates = allCycleDates.filter((d) => formatLocalDate(d) <= asOfStr);
    const sumElapsedWeights = elapsedDates.reduce((acc, d) => acc + getWeightForDate(d), 0);
    const expectedBurnRatio = sumElapsedWeights / sumTotalWeights;
    const actualBurnRatio = effectiveDailySpentMinor / dailyMinor;
    const deviation = actualBurnRatio - expectedBurnRatio;

    const isMilestone = (ANOMALY_MILESTONE_DAYS as readonly number[]).includes(cycleDayIndex);

    if (deviation > ANOMALY_BURN_DEVIATION_THRESHOLD || (isMilestone && deviation > 0.10)) {
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

  // 10. Rebalance Scenarios
  // Keep un-clamped deficit D for calculations and clamp only for UI display.
  // Overall cycle daily deficit is the amount by which daily spending exceeds the daily pool
  const unclampedDailyPoolRemainingMinor = dailyMinor - (dailySpentMinor + totalSpilledToDailyMinor);
  const cycleDeficitMinor = Math.max(0, -unclampedDailyPoolRemainingMinor);
  const hasDeficit = cycleDeficitMinor > 0;
  const cycleDeficitMajor = toMajorUnits(cycleDeficitMinor, minorFactor);

  // Explicit Funding Sources (capped at their actual remaining balance)
  const unspentOutingsMinor = Math.max(0, outingsMinor - outingsSpentMinor);
  const unfulfilledSavingsMinor = Math.max(0, savingsMinor - savingsSpentMinor - savingsWithdrawnMinor);
  const unspentBillsMinor = Math.max(0, fixedMinor - fixedSpentMinor);

  // Scenario B: Option 1 - Trim Outings
  const canOutingsCover = unspentOutingsMinor >= cycleDeficitMinor;
  const isOutingsAvailable = hasDeficit && canOutingsCover && unspentOutingsMinor > 0;
  let scenB_afterDailyAllowanceMinor = 0;
  if (isOutingsAvailable) {
    const excessOutingsMinor = unspentOutingsMinor - cycleDeficitMinor;
    if (remainingDaysInCycle > 1 && sumRemainingWeights > weightToday) {
      const remWeightsFuture = sumRemainingWeights - weightToday;
      const nextDayWeight = getWeightForDate(addDays(asOfDate, 1));
      const allowanceFromExcess = roundHalfUp((excessOutingsMinor * nextDayWeight) / remWeightsFuture);
      scenB_afterDailyAllowanceMinor = Math.min(plannedDailyAllowanceMinor, allowanceFromExcess);
    }
  }

  const scenarioB: RebalanceScenario = {
    id: 'B',
    sourceKey: 'outings',
    sourceName: {
      en: 'Unspent Outings',
      ar: 'الخروجات غير المستهلكة',
    },
    sourceAvailableMinor: unspentOutingsMinor,
    sourceAvailable: toMajorUnits(unspentOutingsMinor, minorFactor),
    name: {
      en: 'Option 1: Trim Outings',
      ar: 'الخيار 1: تقليل الخروجات',
    },
    description: {
      en: 'Cover the extra spending by taking a little from Outings, keeping your savings and daily spending safe.',
      ar: 'تغطية الفارق من ميزانية الخروجات مع حماية مدخراتك ومصروفك اليومي.',
    },
    isAvailable: isOutingsAvailable,
    unavailableReason: !hasDeficit
      ? undefined
      : unspentOutingsMinor === 0
      ? {
          en: 'No remaining outings budget to trim.',
          ar: 'ميزانية الخروجات استُنفدت بالفعل ولا يمكن التضحية بها.',
        }
      : !canOutingsCover
      ? {
          en: `Available Outings (${toMajorUnits(unspentOutingsMinor, minorFactor)}) cannot cover deficit (${cycleDeficitMajor}).`,
          ar: `رصيد الخروجات المتاح (${toMajorUnits(unspentOutingsMinor, minorFactor)}) لا يكفي لتغطية العجز (${cycleDeficitMajor}).`,
        }
      : undefined,
    beforeDailyAllowance: 0,
    afterDailyAllowance: toMajorUnits(scenB_afterDailyAllowanceMinor, minorFactor),
    deficitMinor: cycleDeficitMinor,
    deficit: cycleDeficitMajor,
    absorbedFromSavingsMinor: 0,
    trimmedFromOutingsMinor: isOutingsAvailable ? cycleDeficitMinor : unspentOutingsMinor,
    trimmedFromFixedMinor: 0,
    spilledToDailyMinor: 0,
    unabsorbedDeficitMinor: isOutingsAvailable ? 0 : Math.max(0, cycleDeficitMinor - unspentOutingsMinor),
  };

  // Scenario C: Option 2 - Use Savings Cushion
  const canSavingsCover = unfulfilledSavingsMinor >= cycleDeficitMinor;
  const isSavingsAvailable = hasDeficit && canSavingsCover && unfulfilledSavingsMinor > 0;
  let scenC_afterDailyAllowanceMinor = 0;
  if (isSavingsAvailable) {
    const excessSavingsMinor = unfulfilledSavingsMinor - cycleDeficitMinor;
    if (remainingDaysInCycle > 1 && sumRemainingWeights > weightToday) {
      const remWeightsFuture = sumRemainingWeights - weightToday;
      const targetFutureMinor = plannedDailyAllowanceMinor * (remainingDaysInCycle - 1);
      if (excessSavingsMinor >= targetFutureMinor) {
        scenC_afterDailyAllowanceMinor = plannedDailyAllowanceMinor;
      } else {
        const nextDayWeight = getWeightForDate(addDays(asOfDate, 1));
        scenC_afterDailyAllowanceMinor = roundHalfUp((excessSavingsMinor * nextDayWeight) / remWeightsFuture);
      }
    }
  }

  const scenarioC: RebalanceScenario = {
    id: 'C',
    sourceKey: 'savings',
    sourceName: {
      en: 'Savings Cushion',
      ar: 'وسادة التحويش',
    },
    sourceAvailableMinor: unfulfilledSavingsMinor,
    sourceAvailable: toMajorUnits(unfulfilledSavingsMinor, minorFactor),
    name: {
      en: 'Option 2: Use Savings Cushion',
      ar: 'الخيار 2: استخدام وسادة الادخار',
    },
    description: {
      en: 'Use a small part of savings so your daily allowance stays comfortable.',
      ar: 'تغطية الفارق من المدخرات للحفاظ على راحة المصروف اليومي.',
    },
    isAvailable: isSavingsAvailable,
    unavailableReason: !hasDeficit
      ? undefined
      : unfulfilledSavingsMinor === 0
      ? {
          en: 'No available savings cushion to absorb deficit.',
          ar: 'لا يوجد رصيد تحويش متاح لامتصاص العجز.',
        }
      : !canSavingsCover
      ? {
          en: `Available Savings (${toMajorUnits(unfulfilledSavingsMinor, minorFactor)}) cannot cover deficit (${cycleDeficitMajor}).`,
          ar: `رصيد التحويش المتاح (${toMajorUnits(unfulfilledSavingsMinor, minorFactor)}) لا يكفي لتغطية العجز (${cycleDeficitMajor}).`,
        }
      : undefined,
    beforeDailyAllowance: 0,
    afterDailyAllowance: toMajorUnits(scenC_afterDailyAllowanceMinor, minorFactor),
    deficitMinor: cycleDeficitMinor,
    deficit: cycleDeficitMajor,
    absorbedFromSavingsMinor: isSavingsAvailable ? cycleDeficitMinor : unfulfilledSavingsMinor,
    trimmedFromOutingsMinor: 0,
    trimmedFromFixedMinor: 0,
    spilledToDailyMinor: 0,
    unabsorbedDeficitMinor: isSavingsAvailable ? 0 : Math.max(0, cycleDeficitMinor - unfulfilledSavingsMinor),
  };

  // Scenario A: Option 3 - Use Unspent Bills & Fixed
  const canBillsCover = unspentBillsMinor >= cycleDeficitMinor;
  const isBillsAvailable = hasDeficit && canBillsCover && unspentBillsMinor > 0;
  let scenA_afterDailyAllowanceMinor = 0;
  if (isBillsAvailable) {
    const excessBillsMinor = unspentBillsMinor - cycleDeficitMinor;
    if (remainingDaysInCycle > 1 && sumRemainingWeights > weightToday) {
      const remWeightsFuture = sumRemainingWeights - weightToday;
      const nextDayWeight = getWeightForDate(addDays(asOfDate, 1));
      const allowanceFromExcess = roundHalfUp((excessBillsMinor * nextDayWeight) / remWeightsFuture);
      scenA_afterDailyAllowanceMinor = Math.min(plannedDailyAllowanceMinor, allowanceFromExcess);
    }
  }

  const scenarioA: RebalanceScenario = {
    id: 'A',
    sourceKey: 'fixed',
    sourceName: {
      en: 'Unspent Bills & Fixed',
      ar: 'الفواتير والالتزامات غير المستهلكة',
    },
    sourceAvailableMinor: unspentBillsMinor,
    sourceAvailable: toMajorUnits(unspentBillsMinor, minorFactor),
    name: {
      en: 'Option 3: Use Unspent Bills & Fixed',
      ar: 'الخيار 3: استخدام فائض الفواتير والالتزامات',
    },
    description: {
      en: 'Use unspent funds from your Bills & Fixed pool to cover the daily deficit, keeping your savings safe.',
      ar: 'استخدام الفائض من ميزانية الفواتير والالتزامات غير المستهلكة لتغطية العجز مع حماية مدخراتك.',
    },
    isAvailable: isBillsAvailable,
    unavailableReason: !hasDeficit
      ? undefined
      : unspentBillsMinor === 0
      ? {
          en: 'No unspent bills budget available.',
          ar: 'لا يوجد فائض في ميزانية الفواتير والالتزامات.',
        }
      : !canBillsCover
      ? {
          en: `Available Bills budget (${toMajorUnits(unspentBillsMinor, minorFactor)}) cannot cover deficit (${cycleDeficitMajor}).`,
          ar: `رصيد الفواتير المتاح (${toMajorUnits(unspentBillsMinor, minorFactor)}) لا يكفي لتغطية العجز (${cycleDeficitMajor}).`,
        }
      : undefined,
    beforeDailyAllowance: 0,
    afterDailyAllowance: toMajorUnits(scenA_afterDailyAllowanceMinor, minorFactor),
    deficitMinor: cycleDeficitMinor,
    deficit: cycleDeficitMajor,
    absorbedFromSavingsMinor: 0,
    trimmedFromOutingsMinor: 0,
    trimmedFromFixedMinor: isBillsAvailable ? cycleDeficitMinor : unspentBillsMinor,
    spilledToDailyMinor: 0,
    unabsorbedDeficitMinor: isBillsAvailable ? 0 : Math.max(0, cycleDeficitMinor - unspentBillsMinor),
  };

  // Generate rebalance cards ONLY if a true deficit exists (D > 0)
  const scenarios: RebalanceScenario[] = hasDeficit
    ? [scenarioB, scenarioC, scenarioA]
    : [];

  // Top 3 Spending Categories in Daily & Outings (What caused the overspend)
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

  // 11. Compile Complete Evaluation
  const netSavedMinor = savingsDepositedMinor - savingsWithdrawnMinor;
  const savingsProgressPercent =
    savingsMinor > 0
      ? Math.min(100, Math.max(0, roundHalfUp((Math.max(0, netSavedMinor) / savingsMinor) * 100)))
      : netSavedMinor > 0
      ? 100
      : 0;

  const totalSpentMinor = savingsSpentMinor + fixedSpentMinor + outingsSpentMinor + dailySpentMinor;
  const totalRemMinor = cycleIncomeMinor - totalSpentMinor;

  return {
    cycle,
    baseCurrency,
    excludedCurrencies: Array.from(excludedCurrenciesSet),
    isPaused,
    calculationMode,
    fromTodayConfig: effectiveConfig.fromTodayConfig,
    pools: {
      savings: {
        allocatedMinor: savingsMinor,
        spentMinor: savingsSpentMinor,
        remainingMinor: savingsMinor - savingsSpentMinor,
        allocated: toMajorUnits(savingsMinor, minorFactor),
        spent: toMajorUnits(savingsSpentMinor, minorFactor),
        remaining: toMajorUnits(savingsMinor - savingsSpentMinor, minorFactor),
        depositedMinor: savingsDepositedMinor,
        withdrawnMinor: savingsWithdrawnMinor,
        netSavedMinor,
        deposited: toMajorUnits(savingsDepositedMinor, minorFactor),
        withdrawn: toMajorUnits(savingsWithdrawnMinor, minorFactor),
        netSaved: toMajorUnits(netSavedMinor, minorFactor),
        progressPercent: savingsProgressPercent,
        emergencyCreditMinor,
        emergencyCredit: toMajorUnits(emergencyCreditMinor, minorFactor),
        remainingEmergencyCreditMinor,
        remainingEmergencyCredit: toMajorUnits(remainingEmergencyCreditMinor, minorFactor),
      },
      fixed: {
        allocatedMinor: fixedMinor,
        spentMinor: fixedSpentMinor,
        remainingMinor: fixedMinor - fixedSpentMinor,
        allocated: toMajorUnits(fixedMinor, minorFactor),
        spent: toMajorUnits(fixedSpentMinor, minorFactor),
        remaining: toMajorUnits(fixedMinor - fixedSpentMinor, minorFactor),
      },
      outings: {
        allocatedMinor: outingsMinor,
        spentMinor: outingsSpentMinor,
        remainingMinor: outingsMinor - outingsSpentMinor,
        allocated: toMajorUnits(outingsMinor, minorFactor),
        spent: toMajorUnits(outingsSpentMinor, minorFactor),
        remaining: toMajorUnits(outingsMinor - outingsSpentMinor, minorFactor),
      },
      daily: {
        allocatedMinor: dailyMinor,
        spentMinor: effectiveDailySpentMinor,
        remainingMinor: effectiveDailyRemainingMinor,
        allocated: toMajorUnits(dailyMinor, minorFactor),
        spent: toMajorUnits(effectiveDailySpentMinor, minorFactor),
        remaining: toMajorUnits(effectiveDailyRemainingMinor, minorFactor),
      },
      total: {
        incomeMinor: cycleIncomeMinor,
        income: toMajorUnits(cycleIncomeMinor, minorFactor),
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
      totalSpilledToDaily: toMajorUnits(totalSpilledToDailyMinor, minorFactor),
      headsUpThresholdRatio,
      allowanceState: isPaused ? 'normal' : allowanceState,
    },
    anomalies: isPaused ? [] : anomalies,
    rebalanceScenarios: {
      hasDeficit,
      deficitMinor: cycleDeficitMinor,
      deficit: cycleDeficitMajor,
      scenarios,
      scenarioA,
      scenarioB,
      scenarioC,
    },
    topOverspendCategories,
    projectedDailyAllowanceAfterSpend,
  };
}
