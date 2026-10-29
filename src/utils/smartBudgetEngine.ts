/**
 * Smart Budget Engine
 * 
 * PURE, typed, dependency-free mathematical engine for personal financial tracking:
 * - Integer minor-units currency math (round half up, with remainders assigned to Daily pool)
 * - Local midnight day boundaries & 28-31 day salary cycle (configurable start day 1-28 or auto-detected)
 * - 4 distinct budget pools: Savings, Fixed Obligations, Outings & Special Days, Daily Safe-to-Spend
 * - Real spending attribution, multi-currency segregation & exclusion
 * - Weighted daily allowance calculation with rollover or sweep-to-savings
 * - Anomaly detection with named constants (spending spikes, pool drains, milestone burn checks)
 * - 3 non-destructive rebalance scenarios (Protect Savings, Trim Outings, Emergency Savings Absorption)
 */

import type { Transaction, Account, Category, RecurringTransaction } from '../types/index.ts';

// ============================================================================
// NAMED CONSTANTS FOR ANOMALY DETECTION
// ============================================================================

export const ANOMALY_SPIKE_TODAY_ALLOWANCE_RATIO = 2.0;
export const ANOMALY_POOL_DRAIN_RATIO = 0.25;
export const ANOMALY_MILESTONE_DAYS = [7, 14, 21] as const;
export const ANOMALY_BURN_DEVIATION_THRESHOLD = 0.15;

// ============================================================================
// TYPES & CONFIGURATION INTERFACES
// ============================================================================

export type BudgetPoolType = 'savings' | 'fixed' | 'outings' | 'daily';

export type SavingsConfig =
  | { type: 'percent'; value: number }
  | { type: 'fixed'; value: number };

export type RolloverSetting = 'spread' | 'sweep_to_savings';

export interface SmartBudgetConfig {
  /** Day of month cycle starts (1-28, default: 1, or 'auto' from salary) */
  startDay?: number | 'auto';
  /** Manual planned cycle income in major units (if not using salary transactions) */
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
}

export interface CycleInfo {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  startDay: number; // 1-28
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
  todayAllowanceMinor: number;
  todaySpentMinor: number;
  todayRemainingMinor: number;
  overBudgetByMinor: number; // Negative remaining clamped to 0
  todayAllowance: number;
  todaySpent: number;
  todayRemaining: number;
  overBudgetBy: number;
}

export interface BudgetAnomaly {
  type: 'single_expense_spike' | 'pool_drain' | 'milestone_overburn' | 'burn_rate_deviation';
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
    savings: PoolSpendingStatus;
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
    pool?: 'daily' | 'outings' | 'emergency',
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
  const next = new Date(d.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

export function diffCalendarDays(start: Date, end: Date): number {
  const msPerDay = 86400000;
  const sUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const eUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((eUtc - sUtc) / msPerDay);
}

/**
 * Resolves salary cycle range [startDate, endDate] starting on a day between 1 and 28.
 * Correctly computes cycle lengths between 28 and 31 days.
 */
export function getSalaryCycleRange(
  refDate: string | Date,
  startDay: number
): CycleInfo {
  const clampedStartDay = Math.min(28, Math.max(1, Math.floor(startDay || 1)));
  const ref = parseLocalDate(refDate);

  const year = ref.getFullYear();
  const month = ref.getMonth();
  const date = ref.getDate();

  let cycleStart: Date;
  let nextCycleStart: Date;

  if (date >= clampedStartDay) {
    cycleStart = new Date(year, month, clampedStartDay, 0, 0, 0, 0);
    nextCycleStart = new Date(year, month + 1, clampedStartDay, 0, 0, 0, 0);
  } else {
    cycleStart = new Date(year, month - 1, clampedStartDay, 0, 0, 0, 0);
    nextCycleStart = new Date(year, month, clampedStartDay, 0, 0, 0, 0);
  }

  const cycleEnd = new Date(nextCycleStart.getTime() - 86400000);
  const length = diffCalendarDays(cycleStart, cycleEnd) + 1;

  const startStr = formatLocalDate(cycleStart);
  const endStr = formatLocalDate(cycleEnd);

  const startMonthName = cycleStart.toLocaleDateString('en-US', { month: 'short' });
  const endMonthName = cycleEnd.toLocaleDateString('en-US', { month: 'short' });
  const label = startMonthName === endMonthName ? `${startMonthName} ${cycleStart.getFullYear()}` : `${startMonthName} - ${endMonthName} ${cycleEnd.getFullYear()}`;

  return {
    startDate: startStr,
    endDate: endStr,
    startDay: clampedStartDay,
    length,
    label,
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
  if (!transactions || transactions.length === 0) return defaultStartDay;

  // Filter income transactions marked as salary
  const salaryTxs = transactions.filter((t) => {
    if (t.type !== 'income') return false;
    if (t.isSalary) return true;
    const text = `${t.description || ''} ${t.categoryName || ''} ${t.note || ''}`.toLowerCase();
    return text.includes('salary') || text.includes('مرتب') || text.includes('راتب');
  });

  if (salaryTxs.length === 0) return defaultStartDay;

  // Sort descending by date/createdAt
  salaryTxs.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));

  const latest = salaryTxs[0];
  const parsed = parseLocalDate(latest.date);
  const detectedDay = parsed.getDate();
  return Math.min(28, Math.max(1, detectedDay));
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

  // 1. Resolve Salary Cycle Start Day & Range
  let cycleStartDay = 1;
  if (config.startDay === 'auto') {
    cycleStartDay = autoDetectSalaryDay(transactions, 1);
  } else if (typeof config.startDay === 'number') {
    cycleStartDay = Math.min(28, Math.max(1, config.startDay));
  }
  const cycle = getSalaryCycleRange(asOfDate, cycleStartDay);
  const cycleStart = parseLocalDate(cycle.startDate);
  const cycleEnd = parseLocalDate(cycle.endDate);

  // 2. Base Currency & Account Filtering
  const baseCurrency = config.baseCurrency || accounts[0]?.currency || 'EGP';
  const includedAccountSet = config.includedAccountIds ? new Set(config.includedAccountIds) : null;
  const excludedCurrenciesSet = new Set<string>();

  const validAccountIds = new Set<string>();
  for (const acc of accounts) {
    if (includedAccountSet && !includedAccountSet.has(acc.id)) continue;
    if (acc.isPrivate && !config.includePrivateAccounts) continue;
    const accCurr = acc.currency || baseCurrency;
    if (accCurr !== baseCurrency) {
      excludedCurrenciesSet.add(accCurr);
      continue;
    }
    validAccountIds.add(acc.id);
  }

  // 3. Cycle Income & Spending Filtering
  let detectedSalaryIncomeMinor = 0;
  let totalCycleIncomeMinor = 0;

  // Pre-filter cycle transactions belonging to included accounts
  const cycleTxs: Transaction[] = [];
  for (const tx of transactions) {
    if (!validAccountIds.has(tx.accountId)) continue;
    if (tx.date < cycle.startDate || tx.date > cycle.endDate) continue;

    // Check manual balance adjustments
    if (tx.isAdjustment || tx.isUneditable) continue;
    const desc = (tx.description || '').toLowerCase();
    if (desc.includes('manual balance adjustment') || desc.includes('تسوية رصيد')) continue;

    // Transfers
    if (tx.type === 'transfer' || Boolean(tx.toAccountId)) continue;

    if (tx.type === 'income') {
      const amtMinor = toMinorUnits(tx.amount || 0, minorFactor);
      totalCycleIncomeMinor += amtMinor;
      const isSal = tx.isSalary || desc.includes('salary') || desc.includes('مرتب') || desc.includes('راتب');
      if (isSal) detectedSalaryIncomeMinor += amtMinor;
    } else if (tx.type === 'expense') {
      cycleTxs.push(tx);
    }
  }

  // Determine Cycle Total Income: config override takes precedence, then salary income, then total income
  let cycleIncomeMinor: number;
  if (config.plannedIncome !== undefined) {
    cycleIncomeMinor = Math.max(0, toMinorUnits(config.plannedIncome, minorFactor));
  } else if (detectedSalaryIncomeMinor > 0) {
    cycleIncomeMinor = detectedSalaryIncomeMinor;
  } else {
    cycleIncomeMinor = Math.max(0, totalCycleIncomeMinor);
  }

  // 4. Split Income Into 4 Pools (Minor Units Integer Math)
  // Pool 1: Savings (locked first)
  let savingsMinor = 0;
  if (config.savings) {
    if (config.savings.type === 'percent') {
      savingsMinor = roundHalfUp(cycleIncomeMinor * (Math.max(0, config.savings.value) / 100));
    } else {
      savingsMinor = toMinorUnits(Math.max(0, config.savings.value), minorFactor);
    }
    savingsMinor = Math.min(cycleIncomeMinor, savingsMinor);
  }

  // Pool 2: Fixed Obligations (planned recurring rules + fixed categories)
  const plannedFixedMinor = toMinorUnits(Math.max(0, config.plannedFixedObligations || 0), minorFactor);
  const fixedMinor = Math.min(Math.max(0, cycleIncomeMinor - savingsMinor), plannedFixedMinor);

  // Pool 3: Outings & Special Days
  const plannedOutingsMinor = toMinorUnits(Math.max(0, config.outingsBudget || 0), minorFactor);
  const outingsMinor = Math.min(Math.max(0, cycleIncomeMinor - savingsMinor - fixedMinor), plannedOutingsMinor);

  // Pool 4: Daily Safe-to-Spend (absorbs remainder so sum === cycleIncomeMinor exactly)
  const dailyMinor = Math.max(0, cycleIncomeMinor - savingsMinor - fixedMinor - outingsMinor);

  // 5. Attribute Expenses to Pools
  const fixedCategorySet = new Set(config.fixedCategoryIds || []);
  let savingsSpentMinor = 0;
  let fixedSpentMinor = 0;
  let outingsSpentMinor = 0;
  let dailySpentMinor = 0;

  // Track daily spending by date
  const dailySpentByDate: Record<string, number> = {};
  // Daily spending prior to today
  let dailySpentBeforeTodayMinor = 0;
  let todayDailySpentMinor = 0;

  for (const tx of cycleTxs) {
    const amtMinor = toMinorUnits(tx.amount || 0, minorFactor);
    const txDate = tx.date;

    // Attribution priority:
    // 1. Explicit budgetPool field
    // 2. Recurring generated or fixed-category -> Fixed Obligations
    // 3. Default -> Daily
    if (tx.budgetPool === 'outings') {
      outingsSpentMinor += amtMinor;
    } else if (tx.budgetPool === 'emergency') {
      savingsSpentMinor += amtMinor;
    } else if (tx.budgetPool === 'daily') {
      dailySpentMinor += amtMinor;
      dailySpentByDate[txDate] = (dailySpentByDate[txDate] || 0) + amtMinor;
      if (txDate < asOfStr) dailySpentBeforeTodayMinor += amtMinor;
      else if (txDate === asOfStr) todayDailySpentMinor += amtMinor;
    } else if (tx.isFromRecurring || (tx.categoryId && fixedCategorySet.has(tx.categoryId))) {
      fixedSpentMinor += amtMinor;
    } else {
      // Default to daily
      dailySpentMinor += amtMinor;
      dailySpentByDate[txDate] = (dailySpentByDate[txDate] || 0) + amtMinor;
      if (txDate < asOfStr) dailySpentBeforeTodayMinor += amtMinor;
      else if (txDate === asOfStr) todayDailySpentMinor += amtMinor;
    }
  }

  // 6. Day Weights & Remaining Days in Cycle
  const weekdayWeights = { ...config.weekdayWeights };
  const getWeightForDate = (d: Date): number => {
    const dayOfWeek = d.getDay();
    const w = weekdayWeights[dayOfWeek];
    if (typeof w === 'number' && !isNaN(w)) {
      return Math.min(3.0, Math.max(1.0, w));
    }
    return 1.0;
  };

  // Generate all dates in cycle
  const allCycleDates: Date[] = [];
  let cur = new Date(cycleStart.getTime());
  while (cur <= cycleEnd) {
    allCycleDates.push(new Date(cur.getTime()));
    cur = addDays(cur, 1);
  }

  const cycleLength = allCycleDates.length;
  const cycleDayIndex = Math.min(cycleLength, Math.max(1, diffCalendarDays(cycleStart, asOfDate) + 1));
  const remainingDates = allCycleDates.filter((d) => formatLocalDate(d) >= asOfStr);
  const remainingDaysInCycle = remainingDates.length;

  const weightToday = getWeightForDate(asOfDate);
  const sumRemainingWeights = remainingDates.reduce((acc, d) => acc + getWeightForDate(d), 0);
  const sumTotalWeights = allCycleDates.reduce((acc, d) => acc + getWeightForDate(d), 0);

  // 7. Calculate Daily Allowance
  const rollover = config.rolloverSetting || 'spread';
  let dailyPoolRemainingAtStartOfTodayMinor: number;

  if (rollover === 'sweep_to_savings') {
    // Simulate past days: unspent daily allowances were swept into savings at midnight
    let poolSimMinor = dailyMinor;
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
    // Default 'spread': unspent allowance rolls over and spreads across remaining days
    dailyPoolRemainingAtStartOfTodayMinor = dailyMinor - dailySpentBeforeTodayMinor;
  }

  let todayAllowanceMinor = 0;
  if (remainingDaysInCycle > 0 && sumRemainingWeights > 0 && dailyPoolRemainingAtStartOfTodayMinor > 0) {
    todayAllowanceMinor = roundHalfUp(
      (dailyPoolRemainingAtStartOfTodayMinor * weightToday) / sumRemainingWeights
    );
  }

  const todaySpentMinor = todayDailySpentMinor;
  const todayRemainingMinor = todayAllowanceMinor - todaySpentMinor;
  const overBudgetByMinor = todayRemainingMinor < 0 ? Math.abs(todayRemainingMinor) : 0;

  // 8. Projected Daily Allowance Helper
  const projectedDailyAllowanceAfterSpend = (
    amountMajor: number,
    pool: 'daily' | 'outings' | 'emergency' = 'daily',
    onDateInput: string | Date = asOfDate
  ): number => {
    if (pool !== 'daily') {
      // Spending in other pools does not directly affect the baseline daily allowance
      return toMajorUnits(todayAllowanceMinor, minorFactor);
    }
    const spendMinor = toMinorUnits(Math.max(0, amountMajor), minorFactor);
    const newPoolRem = dailyPoolRemainingAtStartOfTodayMinor - todaySpentMinor - spendMinor;
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

  // 9. Anomaly Detection
  const anomalies: BudgetAnomaly[] = [];

  // (a) Single expense spike (> 2x today's allowance)
  for (const tx of cycleTxs) {
    const isDaily = !tx.budgetPool || tx.budgetPool === 'daily';
    const amtMinor = toMinorUnits(tx.amount || 0, minorFactor);
    if (isDaily && todayAllowanceMinor > 0 && amtMinor > ANOMALY_SPIKE_TODAY_ALLOWANCE_RATIO * todayAllowanceMinor) {
      anomalies.push({
        type: 'single_expense_spike',
        severity: 'warning',
        message: {
          en: `Single expense of ${toMajorUnits(amtMinor, minorFactor)} exceeds 2x today's allowance (${toMajorUnits(todayAllowanceMinor, minorFactor)}).`,
          ar: `المصروف بقيمة ${toMajorUnits(amtMinor, minorFactor)} يتجاوز ضعف ميزانية اليوم (${toMajorUnits(todayAllowanceMinor, minorFactor)}).`,
        },
        transactionId: tx.id,
        amount: toMajorUnits(amtMinor, minorFactor),
      });
    }

    // (b) Pool drain (> 25% of pool)
    const targetPool = tx.budgetPool || 'daily';
    if (targetPool === 'daily' && dailyMinor > 0 && amtMinor > ANOMALY_POOL_DRAIN_RATIO * dailyMinor) {
      anomalies.push({
        type: 'pool_drain',
        severity: 'critical',
        message: {
          en: `Expense of ${toMajorUnits(amtMinor, minorFactor)} drains over 25% of the entire Daily pool.`,
          ar: `المصروف بقيمة ${toMajorUnits(amtMinor, minorFactor)} يستنزف أكثر من 25% من ميزانية المصروف اليومي بالكامل.`,
        },
        transactionId: tx.id,
        amount: toMajorUnits(amtMinor, minorFactor),
      });
    } else if (targetPool === 'outings' && outingsMinor > 0 && amtMinor > ANOMALY_POOL_DRAIN_RATIO * outingsMinor) {
      anomalies.push({
        type: 'pool_drain',
        severity: 'warning',
        message: {
          en: `Outing expense of ${toMajorUnits(amtMinor, minorFactor)} drains over 25% of the Outings pool.`,
          ar: `مصروف الخروجات بقيمة ${toMajorUnits(amtMinor, minorFactor)} يستنزف أكثر من 25% من ميزانية الخروجات.`,
        },
        transactionId: tx.id,
        amount: toMajorUnits(amtMinor, minorFactor),
      });
    }
  }

  // (c) Milestone Health Checks (Days 7, 14, 21) & Burn Rate Deviation (> 15% points)
  if (sumTotalWeights > 0 && dailyMinor > 0) {
    const elapsedDates = allCycleDates.filter((d) => formatLocalDate(d) <= asOfStr);
    const sumElapsedWeights = elapsedDates.reduce((acc, d) => acc + getWeightForDate(d), 0);
    const expectedBurnRatio = sumElapsedWeights / sumTotalWeights;
    const actualBurnRatio = (dailySpentBeforeTodayMinor + todaySpentMinor) / dailyMinor;
    const deviation = actualBurnRatio - expectedBurnRatio;

    const isMilestone = (ANOMALY_MILESTONE_DAYS as readonly number[]).includes(cycleDayIndex);

    if (deviation > ANOMALY_BURN_DEVIATION_THRESHOLD || (isMilestone && deviation > 0.10)) {
      anomalies.push({
        type: isMilestone ? 'milestone_overburn' : 'burn_rate_deviation',
        severity: deviation > 0.25 ? 'critical' : 'warning',
        message: {
          en: `Spending burn is ${Math.round(deviation * 100)}% ahead of the weighted schedule at Day ${cycleDayIndex}.`,
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
  const totalDailySpentSoFar = dailySpentBeforeTodayMinor + todaySpentMinor;
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
      ar: 'امتصاص العجز وتوزيعه على باقي أيام الدورة مع الحفاظ على مدخراتك وميزانية خروجاتك كاملة دون المساس بها.',
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
      en: 'Sacrifice unspent outings budget first to keep your daily spending allowance comfortable, leaving savings intact.',
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
  const savingsRemainingMinor = Math.max(0, savingsMinor - savingsSpentMinor);
  const canSavingsCover = savingsRemainingMinor >= cycleDeficitMinor;

  const scenarioC: RebalanceScenario = {
    id: 'C',
    name: {
      en: 'Emergency Savings Absorption',
      ar: 'امتصاص الطوارئ من التحويش',
    },
    description: {
      en: 'Treat the overspend as an emergency and deduct it from your cycle savings target, keeping your daily allowance unchanged.',
      ar: 'اعتبار المصروف كحالة طارئة وخصمه من هدف التحويش لهذا الشهر، مع الحفاظ على مصروفك اليومي دون أي تغيير.',
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
        spentMinor: dailySpentMinor,
        remainingMinor: dailyMinor - dailySpentMinor,
        allocated: toMajorUnits(dailyMinor, minorFactor),
        spent: toMajorUnits(dailySpentMinor, minorFactor),
        remaining: toMajorUnits(dailyMinor - dailySpentMinor, minorFactor),
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
      dailyPoolSpentBeforeTodayMinor: dailySpentBeforeTodayMinor,
      dailyPoolRemainingAtStartOfTodayMinor,
      todayAllowanceMinor,
      todaySpentMinor,
      todayRemainingMinor,
      overBudgetByMinor,
      todayAllowance: toMajorUnits(todayAllowanceMinor, minorFactor),
      todaySpent: toMajorUnits(todaySpentMinor, minorFactor),
      todayRemaining: toMajorUnits(todayRemainingMinor, minorFactor),
      overBudgetBy: toMajorUnits(overBudgetByMinor, minorFactor),
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
