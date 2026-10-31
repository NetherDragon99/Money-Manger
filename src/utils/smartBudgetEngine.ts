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
  id: 'A' | 'B' | 'C';
  name: { en: string; ar: string };
  description: { en: string; ar: string };
  isAvailable: boolean;
  unavailableReason?: { en: string; ar: string };
  beforeDailyAllowance: number;
  afterDailyAllowance: number;
  deficitMinor: number;
  absorbedFromSavingsMinor: number;
  trimmedFromOutingsMinor: number;
  spilledToDailyMinor: number;
  unabsorbedDeficitMinor: number;
}

export interface SmartBudgetEvaluation {
  cycle: CycleInfo;
  baseCurrency: string;
  excludedCurrencies: string[];
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
    scenarioA: RebalanceScenario; // Protect Savings
    scenarioB: RebalanceScenario; // Trim Outings
    scenarioC: RebalanceScenario; // Emergency Savings Absorption
  };
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

  // Determine Cycle Total Income strictly from user-entered plannedIncome (never from deposit transactions)
  const cycleIncomeMinor = Math.max(
    0,
    toMinorUnits(effectiveConfig.plannedIncome || 0, minorFactor)
  );

  // 4. Split Income Into 4 Pools (Minor Units Integer Math with Half-Up Rounding)
  let savingsMinor = 0;
  let fixedMinor = 0;
  let outingsMinor = 0;

  if (effectiveConfig.poolsConfig) {
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

  // Sort cycleTxs chronologically so emergency credits offset exceptional ('oneoff') expenses in order
  const sortedCycleTxs = [...cycleTxs].sort(
    (a, b) => (a.date || '').localeCompare(b.date || '') || (a.createdAt || 0) - (b.createdAt || 0)
  );

  for (const tx of sortedCycleTxs) {
    const amtMinor = toMinorUnits(tx.amount || 0, minorFactor);
    const txDate = tx.date;
    const rawPool = tx.budgetPool as string | undefined;

    // Attribution priority:
    // 1. Explicit budgetPool ('daily' | 'fixed' | 'outings' | 'oneoff' / legacy 'emergency')
    // 2. Recurring generated or fixed-category -> 'fixed' (Bills & Fixed)
    // 3. Default -> 'daily' (Daily Spending)
    if (rawPool === 'outings') {
      outingsSpentMinor += amtMinor;
      if (txDate !== asOfStr) outingsSpentBeforeTodayMinor += amtMinor;
    } else if (rawPool === 'oneoff' || rawPool === 'emergency') {
      // 'oneoff' (One-off / Exceptional) expenses NEVER reduce the daily allowance
      // and are offset first by emergency credits from savings withdrawals.
      const coveredByCredit = Math.min(amtMinor, remainingEmergencyCreditMinor);
      remainingEmergencyCreditMinor -= coveredByCredit;
      const uncoveredExceptionalMinor = amtMinor - coveredByCredit;
      savingsSpentMinor += uncoveredExceptionalMinor;
    } else if (rawPool === 'fixed') {
      fixedSpentMinor += amtMinor;
      if (txDate !== asOfStr) fixedSpentBeforeTodayMinor += amtMinor;
    } else if (rawPool === 'daily') {
      dailySpentMinor += amtMinor;
      dailySpentByDate[txDate] = (dailySpentByDate[txDate] || 0) + amtMinor;
      if (txDate === asOfStr) todayDailySpentMinor += amtMinor;
      else dailySpentBeforeTodayMinor += amtMinor;
    } else if (
      tx.isFromRecurring ||
      Boolean(tx.recurringRuleId) ||
      (tx.categoryId && fixedCategorySet.has(tx.categoryId))
    ) {
      fixedSpentMinor += amtMinor;
      if (txDate !== asOfStr) fixedSpentBeforeTodayMinor += amtMinor;
    } else {
      // Default to daily
      dailySpentMinor += amtMinor;
      dailySpentByDate[txDate] = (dailySpentByDate[txDate] || 0) + amtMinor;
      if (txDate === asOfStr) todayDailySpentMinor += amtMinor;
      else dailySpentBeforeTodayMinor += amtMinor;
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

  // Planned baseline daily allowance at cycle start (weighted for today)
  const plannedDailyAllowanceMinor =
    sumTotalWeights > 0 ? roundHalfUp((dailyMinor * weightToday) / sumTotalWeights) : 0;

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
      return toMajorUnits(todayAllowanceMinor, minorFactor);
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
    const amtMinor = toMinorUnits(tx.amount || 0, minorFactor);
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
  // Overall deficit is today's overspend or the cycle's daily deficit
  const totalDailySpentSoFar = effectiveDailySpentBeforeTodayMinor + todaySpentMinor;
  const cycleDeficitMinor = Math.max(0, overBudgetByMinor, totalDailySpentSoFar - dailyMinor);

  // Scenario A: "Protect Savings / شد الحزام وحماية التحويش"
  // Absorb deficit entirely from remaining daily allowance
  let scenA_afterDailyAllowanceMinor = 0;
  if (remainingDaysInCycle > 1 && sumRemainingWeights > weightToday) {
    const remWeightsFuture = sumRemainingWeights - weightToday;
    const remPoolFuture = Math.max(0, dailyPoolRemainingAtStartOfTodayMinor - todaySpentMinor);
    scenA_afterDailyAllowanceMinor = roundHalfUp((remPoolFuture * getWeightForDate(addDays(asOfDate, 1))) / remWeightsFuture);
  } else if (remainingDaysInCycle === 1) {
    scenA_afterDailyAllowanceMinor = Math.max(0, todayAllowanceMinor - todaySpentMinor);
  }

  const scenarioA: RebalanceScenario = {
    id: 'A',
    name: {
      en: 'Protect Savings',
      ar: 'شد الحزام وحماية التحويش',
    },
    description: {
      en: 'Absorb the deficit across the remaining days of the cycle. Your savings and outings pools stay 100% protected.',
      ar: 'امتصاص العجز وتوزيعه على باقي أيام الدورة مع الحفاظ على التحويش وميزانية الخروجات كاملة دون المساس بها.',
    },
    isAvailable: true,
    beforeDailyAllowance: toMajorUnits(todayAllowanceMinor, minorFactor),
    afterDailyAllowance: toMajorUnits(scenA_afterDailyAllowanceMinor, minorFactor),
    deficitMinor: cycleDeficitMinor,
    absorbedFromSavingsMinor: 0,
    trimmedFromOutingsMinor: 0,
    spilledToDailyMinor: cycleDeficitMinor,
    unabsorbedDeficitMinor: Math.max(0, cycleDeficitMinor - Math.max(0, dailyPoolRemainingAtStartOfTodayMinor)),
  };

  // Scenario B: "Trim Outings / التضحية بالخروجات"
  // Absorb deficit from remaining outings first, spilling any excess into daily pool
  const outingsRemainingMinor = Math.max(0, outingsMinor - outingsSpentMinor);
  const absorbedFromOutingsMinor = Math.min(cycleDeficitMinor, outingsRemainingMinor);
  const spilledToDailyBMinor = cycleDeficitMinor - absorbedFromOutingsMinor;

  let scenB_afterDailyAllowanceMinor = todayAllowanceMinor;
  if (spilledToDailyBMinor > 0) {
    if (remainingDaysInCycle > 1 && sumRemainingWeights > weightToday) {
      const remWeightsFuture = sumRemainingWeights - weightToday;
      const remPoolFuture = Math.max(0, dailyPoolRemainingAtStartOfTodayMinor - todaySpentMinor - spilledToDailyBMinor);
      scenB_afterDailyAllowanceMinor = roundHalfUp((remPoolFuture * getWeightForDate(addDays(asOfDate, 1))) / remWeightsFuture);
    } else {
      scenB_afterDailyAllowanceMinor = 0;
    }
  }

  const scenarioB: RebalanceScenario = {
    id: 'B',
    name: {
      en: 'Trim Outings',
      ar: 'التضحية بالخروجات',
    },
    description: {
      en: 'Use unspent Outings budget first to keep your Daily Spending allowance comfortable, leaving Savings intact.',
      ar: 'امتصاص العجز من ميزانية الخروجات المتبقية أولاً للحفاظ على مصروفك اليومي مريحاً، وحماية التحويش.',
    },
    isAvailable: outingsRemainingMinor > 0 || cycleDeficitMinor === 0,
    unavailableReason: outingsRemainingMinor === 0 && cycleDeficitMinor > 0 ? {
      en: 'No remaining outings budget to trim.',
      ar: 'ميزانية الخروجات استُنفدت بالفعل ولا يمكن التضحية بها.',
    } : undefined,
    beforeDailyAllowance: toMajorUnits(todayAllowanceMinor, minorFactor),
    afterDailyAllowance: toMajorUnits(scenB_afterDailyAllowanceMinor, minorFactor),
    deficitMinor: cycleDeficitMinor,
    absorbedFromSavingsMinor: 0,
    trimmedFromOutingsMinor: absorbedFromOutingsMinor,
    spilledToDailyMinor: spilledToDailyBMinor,
    unabsorbedDeficitMinor: Math.max(0, spilledToDailyBMinor - Math.max(0, dailyPoolRemainingAtStartOfTodayMinor)),
  };

  // Scenario C: "Emergency Savings Absorption / امتصاص الطوارئ من التحويش"
  // Absorb deficit from savings pool (limited to remaining cycle savings target)
  const savingsRemainingMinor = Math.max(0, savingsMinor - savingsSpentMinor - savingsWithdrawnMinor);
  const canSavingsCover = savingsRemainingMinor >= cycleDeficitMinor;

  const scenarioC: RebalanceScenario = {
    id: 'C',
    name: {
      en: 'Use Savings Cushion',
      ar: 'استخدام وسادة التحويش',
    },
    description: {
      en: 'Deduct the overspend from your cycle Savings target so your Daily Spending allowance stays unchanged.',
      ar: 'خصم الفارق من هدف التحويش لهذا الشهر، مع الحفاظ على مصروفك اليومي دون أي تغيير.',
    },
    isAvailable: canSavingsCover && (savingsRemainingMinor > 0 || cycleDeficitMinor === 0),
    unavailableReason: !canSavingsCover ? {
      en: `Deficit (${toMajorUnits(cycleDeficitMinor, minorFactor)}) exceeds available savings target (${toMajorUnits(savingsRemainingMinor, minorFactor)}).`,
      ar: `العجز (${toMajorUnits(cycleDeficitMinor, minorFactor)}) يتجاوز قيمة التحويش المتاحة (${toMajorUnits(savingsRemainingMinor, minorFactor)}).`,
    } : undefined,
    beforeDailyAllowance: toMajorUnits(todayAllowanceMinor, minorFactor),
    afterDailyAllowance: toMajorUnits(todayAllowanceMinor, minorFactor),
    deficitMinor: cycleDeficitMinor,
    absorbedFromSavingsMinor: canSavingsCover ? cycleDeficitMinor : savingsRemainingMinor,
    trimmedFromOutingsMinor: 0,
    spilledToDailyMinor: 0,
    unabsorbedDeficitMinor: canSavingsCover ? 0 : cycleDeficitMinor - savingsRemainingMinor,
  };

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
      allowanceState,
    },
    anomalies,
    rebalanceScenarios: {
      scenarioA,
      scenarioB,
      scenarioC,
    },
    projectedDailyAllowanceAfterSpend,
  };
}
