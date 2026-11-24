/**
 * Budget Future-Impact & What-If Analyzer
 * 100% local, deterministic financial forecasting for solv:
 * - New/edited Expense, Income, & Transfer future-impact analysis
 * - Daily-average spike detection & safety threshold alerts
 * - Budget runway & zero-day forecasting
 * - Daily recovery calculations
 * - 3-Mode What-If Simulator (Single Expense, N-Day Spend, Extra Income) + 3-way Pool Comparison
 */

import type {
  Account,
  ExpenseBudgetPool,
  OneOffFundingSource,
  SavingsWithdrawalChoice,
  Transaction,
  TransactionType,
} from '../types';
import {
  addDays,
  evaluateSmartBudget,
  formatLocalDate,
  parseLocalDate,
  SmartBudgetConfig,
  SmartBudgetEvaluation,
} from './smartBudgetEngine';
import { formatNumberWithCommas } from './formatters';

export type ImpactSeverity = 'positive' | 'safe' | 'caution' | 'warning' | 'danger';

export interface DraftTransactionForImpact {
  id?: string;
  type: TransactionType;
  amount: number;
  taxAmount?: number;
  transferFee?: number;
  date: string;
  accountId: string;
  toAccountId?: string;
  budgetPool?: ExpenseBudgetPool;
  isSalary?: boolean;
  isSavingsAllocation?: boolean;
  savingsWithdrawalChoice?: SavingsWithdrawalChoice;
  isRecurring?: boolean;
}

export interface TransactionImpactMetrics {
  effectiveAmount: number;
  dailyBefore: number;
  dailyAfter: number;
  dailyDelta: number;
  dailyDeltaPercent: number;
  todayRemainingBefore: number;
  todayRemainingAfter: number;
  poolKey: 'daily' | 'outings' | 'fixed' | 'oneoff' | 'savings' | 'income' | 'transfer';
  poolLabel: string;
  poolBefore: number;
  poolAfter: number;
  spilloverAmount: number;
  equivalentDailyDays: number;
  averageDailySpendInCycle: number;
  recentDailySpendAverage: number;
  paceForecastDays: number;
  paceExtraDaysDelta: number;
  exceedsAvgAlert: boolean;
  exceedsAvgRatio: number;
  remainingDaysInCycle: number;
  projectedRunwayDays: number;
  projectedZeroDate: string | null;
  projectedCycleEndBalance: number;
  simpleOutlookLabel: string;
  savingsProgressBefore: number;
  savingsProgressAfter: number;
  dailyRecoveryNeeded: number;
  isPrivateInvolved: boolean;
  isOutOfCycle: boolean;
}

export interface TransactionImpactReport {
  severity: ImpactSeverity;
  headline: string;
  detailedMessages: string[];
  recommendation: string;
  metrics: TransactionImpactMetrics;
}

export interface WhatIfPoolComparisonItem {
  pool: 'daily' | 'outings' | 'oneoff';
  label: string;
  poolRemainingAfter: number;
  dailyAllowanceAfter: number;
  dailyDelta: number;
  savingsImpact: number;
  isOptimal: boolean;
  note: string;
}

export interface WhatIfSimulationReport {
  mode: 'single_expense' | 'multi_day_expense' | 'extra_income' | 'stretch_days';
  totalAmount: number;
  perDayAmount: number;
  daysCount: number;
  extraDays?: number;
  newCycleEndDate?: string;
  newRemainingDays?: number;
  recentDailyAverage?: number;
  paceForecastDays?: number;
  severity: ImpactSeverity;
  headline: string;
  detailedMessages: string[];
  recommendation: string;
  poolName: string;
  poolBefore: number;
  poolAfter: number;
  spilloverToDaily: number;
  allowanceBefore: number;
  allowanceAfter: number;
  dailyDelta: number;
  dailyDeltaPercent: number;
  burnRateBefore: number;
  burnRateAfter: number;
  runwayDaysBefore: number;
  runwayDaysAfter: number;
  projectedZeroDate: string | null;
  projectedCycleEndBalance: number;
  dailyRecoveryNeeded: number;
  remainingDaysInCycle: number;
  isLastDay: boolean;
  poolComparison: WhatIfPoolComparisonItem[];
}

function fmt(val: number, curr: string): string {
  return `${formatNumberWithCommas(Math.round(val * 100) / 100, 2)} ${curr}`;
}

function fmtShort(val: number, curr: string): string {
  const abs = Math.abs(val);
  const decimals = Math.abs(abs - Math.round(abs)) < 0.01 ? 0 : 2;
  return `${formatNumberWithCommas(val, decimals)} ${curr}`;
}

function applyVirtualAccountDeltas(
  accounts: Account[],
  tx: DraftTransactionForImpact,
  sign: 1 | -1
): Account[] {
  return accounts.map((acc) => {
    let delta = 0;
    if (tx.type === 'expense' && acc.id === tx.accountId) {
      delta = -((tx.amount || 0) + (tx.taxAmount || 0)) * sign;
    } else if (tx.type === 'income' && acc.id === tx.accountId) {
      delta = ((tx.amount || 0) + (tx.taxAmount || 0)) * sign;
    } else if (tx.type === 'transfer') {
      if (acc.id === tx.accountId) {
        delta -= ((tx.amount || 0) + (tx.transferFee || 0)) * sign;
      }
      if (tx.toAccountId && acc.id === tx.toAccountId) {
        delta += (tx.amount || 0) * sign;
      }
    }
    return delta !== 0 ? { ...acc, balance: (acc.balance || 0) + delta } : acc;
  });
}

function computeRecentDailyAverage(
  dailyTxs: Transaction[] | undefined,
  cycleDailyTrackedSpent: number,
  asOfDate: Date,
  cycleStartStr: string,
  elapsedDays: number
): number {
  const safeElapsed = Math.max(1, elapsedDays);
  const cycleAvg = Math.round((Math.max(0, cycleDailyTrackedSpent) / safeElapsed) * 100) / 100;
  if (!dailyTxs || dailyTxs.length === 0) return cycleAvg;

  const windowDays = Math.min(7, safeElapsed);
  const asOfStr = formatLocalDate(asOfDate);
  const rawWindowStart = formatLocalDate(addDays(asOfDate, -(windowDays - 1)));
  const windowStartStr = rawWindowStart < cycleStartStr ? cycleStartStr : rawWindowStart;

  let windowSum = 0;
  for (const tx of dailyTxs) {
    const cleanDate = (tx.date || '').slice(0, 10);
    if (cleanDate >= windowStartStr && cleanDate <= asOfStr) {
      windowSum += Math.max(0, Number(tx.amount) || 0) + Math.max(0, Number(tx.taxAmount) || 0);
    }
  }
  if (windowSum <= 0) return cycleAvg;
  return Math.round((windowSum / windowDays) * 100) / 100;
}

function computeRunway(
  availableDiscretionary: number,
  dailyBurnRate: number,
  remainingDays: number,
  asOfDate: Date
): { runwayDays: number; zeroDate: string | null } {
  if (availableDiscretionary <= 0) {
    return { runwayDays: 0, zeroDate: formatLocalDate(asOfDate) };
  }
  if (dailyBurnRate <= 0) {
    return { runwayDays: remainingDays, zeroDate: null };
  }
  const daysUntilZero = Math.floor(availableDiscretionary / dailyBurnRate);
  if (daysUntilZero >= remainingDays) {
    return { runwayDays: remainingDays, zeroDate: null };
  }
  return {
    runwayDays: Math.max(0, daysUntilZero),
    zeroDate: formatLocalDate(addDays(asOfDate, Math.max(0, daysUntilZero))),
  };
}

function getPoolDisplayName(pool: string, isAr: boolean): string {
  if (pool === 'daily') return isAr ? 'المصروف اليومي' : 'Daily Spending';
  if (pool === 'outings') return isAr ? 'الخروجات' : 'Outings';
  if (pool === 'fixed') return isAr ? 'الفواتير والالتزامات' : 'Bills & Fixed';
  if (pool === 'oneoff') return isAr ? 'المصاريف الاستثنائية' : 'One-Off';
  if (pool === 'savings') return isAr ? 'التحويش' : 'Savings';
  if (pool === 'income') return isAr ? 'إجمالي الميزانية' : 'Total Budget';
  return isAr ? 'تحويل بين الحسابات' : 'Transfer';
}

export function analyzeTransactionImpact(
  draft: DraftTransactionForImpact,
  editingTx: Transaction | null,
  allTransactions: Transaction[],
  accounts: Account[],
  config: SmartBudgetConfig,
  lang: 'en' | 'ar' | 'ar_eg' = 'ar_eg',
  asOf: Date = new Date()
): TransactionImpactReport | null {
  const isAr = lang === 'ar' || lang === 'ar_eg';
  const curr = config.baseCurrency || 'EGP';
  const baseAmount = Math.max(0, Number(draft.amount) || 0);
  const tax = draft.type === 'expense' || draft.type === 'income' ? Math.max(0, Number(draft.taxAmount) || 0) : 0;
  const fee = draft.type === 'transfer' ? Math.max(0, Number(draft.transferFee) || 0) : 0;
  const effectiveAmount = baseAmount + tax;

  if (baseAmount <= 0) return null;

  // Baseline accounts & transactions (strip existing editingTx & any linked transfer fee tx first so we compare clean Before vs After)
  const removedLinkedFeeTxs = editingTx
    ? allTransactions.filter(
        (t) => t.feeOfTransferId === editingTx.id || (editingTx.linkedFeeTxId && t.id === editingTx.linkedFeeTxId)
      )
    : [];
  const removedFeeIds = new Set(removedLinkedFeeTxs.map((t) => t.id));

  const baseTxs = editingTx
    ? allTransactions.filter((t) => t.id !== editingTx.id && !removedFeeIds.has(t.id))
    : allTransactions;

  let baseAccounts = editingTx
    ? applyVirtualAccountDeltas(
        accounts,
        {
          type: editingTx.type,
          amount: editingTx.amount,
          taxAmount: editingTx.taxAmount,
          transferFee: 0, // Linked fee tx is reversed below to avoid double subtraction
          date: editingTx.date,
          accountId: editingTx.accountId,
          toAccountId: editingTx.toAccountId,
        },
        -1
      )
    : accounts;

  if (removedLinkedFeeTxs.length > 0) {
    const feeRevertAmount = removedLinkedFeeTxs.reduce(
      (sum, ft) => sum + Math.max(0, ft.amount || 0) + Math.max(0, ft.taxAmount || 0),
      0
    );
    if (feeRevertAmount > 0 && editingTx) {
      baseAccounts = baseAccounts.map((acc) =>
        acc.id === editingTx.accountId ? { ...acc, balance: (acc.balance || 0) + feeRevertAmount } : acc
      );
    }
  }

  const evalBefore = evaluateSmartBudget(baseTxs, baseAccounts, config, asOf);
  if (evalBefore.isPaused) return null;

  const isOutOfCycle =
    draft.date < evalBefore.cycle.startDate || draft.date > evalBefore.cycle.endDate;

  const virtualTx: Transaction = {
    id: editingTx?.id || '__draft_impact_tx__',
    type: draft.type,
    amount: baseAmount,
    taxAmount: tax > 0 ? tax : undefined,
    transferFee: fee > 0 ? fee : undefined,
    date: draft.date,
    accountId: draft.accountId,
    toAccountId: draft.toAccountId,
    budgetPool: draft.type === 'expense' ? draft.budgetPool : draft.isSavingsAllocation ? 'savings' : undefined,
    isSalary: draft.isSalary,
    isSavingsAllocation: draft.isSavingsAllocation,
    savingsWithdrawalChoice: draft.savingsWithdrawalChoice,
    isFromRecurring: draft.isRecurring,
    description: '',
    createdAt: Date.now(),
  };

  const afterTxs = [...baseTxs, virtualTx];
  const afterAccounts = applyVirtualAccountDeltas(baseAccounts, draft, 1);
  const evalAfter = evaluateSmartBudget(afterTxs, afterAccounts, config, asOf);

  const remDays = Math.max(1, evalBefore.dailyStatus.remainingDaysInCycle);
  const isLastDay = remDays <= 1;
  const dailyBefore = isLastDay
    ? Math.max(0, evalBefore.dailyStatus.todayRemaining)
    : evalBefore.dailyStatus.upcomingDailyAllowance;
  const dailyAfter = isLastDay
    ? Math.max(0, evalAfter.dailyStatus.todayRemaining)
    : evalAfter.dailyStatus.upcomingDailyAllowance;

  const dailyDelta = Math.round((dailyAfter - dailyBefore) * 100) / 100;
  const dailyDeltaPercent =
    dailyBefore > 0 ? Math.round(((dailyAfter - dailyBefore) / dailyBefore) * 1000) / 10 : 0;

  const elapsedDays = Math.max(1, evalBefore.dailyStatus.cycleDayIndex);
  // Strictly Daily-pool spending only (never mix Outings/Bills/One-Off into Daily pace!)
  const dailyOnlyTrackedSpentBefore = evalBefore.pools.daily.trackedSpent;
  const averageDailySpendInCycle =
    Math.round((dailyOnlyTrackedSpentBefore / elapsedDays) * 100) / 100;
  const recentDailySpendAverage = computeRecentDailyAverage(
    evalBefore.pools.daily.transactions,
    dailyOnlyTrackedSpentBefore,
    asOf,
    evalBefore.cycle.startDate,
    elapsedDays
  );

  const plannedDaily = Math.max(1, evalBefore.dailyStatus.plannedDailyAllowance || dailyBefore || 1);
  const equivalentDailyDays = Math.round((effectiveAmount / plannedDaily) * 10) / 10;

  const avgBaseline = Math.max(recentDailySpendAverage, averageDailySpendInCycle, plannedDaily * 0.65);
  const exceedsAvgRatio = avgBaseline > 0 ? Math.round((effectiveAmount / avgBaseline) * 10) / 10 : 0;
  const exceedsAvgAlert =
    draft.type === 'expense' &&
    ((recentDailySpendAverage > 0 && effectiveAmount >= recentDailySpendAverage * 1.6) ||
      effectiveAmount >= plannedDaily * 1.6);

  const paceBasis = recentDailySpendAverage > 0 ? recentDailySpendAverage : dailyAfter || plannedDaily;
  const paceForecastDays =
    evalAfter.pools.daily.remaining <= 0
      ? 0
      : paceBasis > 0
      ? Math.min(999, Math.floor(evalAfter.pools.daily.remaining / paceBasis))
      : remDays;
  const paceExtraDaysDelta = paceForecastDays - remDays;

  const runwayAfter = computeRunway(
    evalAfter.pools.daily.remaining,
    Math.max(paceBasis, 1),
    remDays,
    asOf
  );
  // Honest cycle-end projection: never invent a fake deficit when remaining Daily pool covers all remaining days at dailyAfter!
  const projectedCycleEndBalance =
    evalAfter.pools.daily.remaining <= 0
      ? Math.round(evalAfter.pools.daily.remaining * 100) / 100
      : recentDailySpendAverage > 0 && recentDailySpendAverage < dailyAfter
      ? Math.round(
          (evalAfter.pools.daily.remaining - recentDailySpendAverage * Math.max(0, remDays - 1)) * 100
        ) / 100
      : 0;

  const fromAcc = accounts.find((a) => a.id === draft.accountId);
  const toAcc = draft.toAccountId ? accounts.find((a) => a.id === draft.toAccountId) : undefined;
  const isPrivateInvolved = Boolean(fromAcc?.isPrivate || toAcc?.isPrivate);

  const cyclePhase: 'early' | 'mid' | 'late' =
    evalBefore.dailyStatus.cycleDayIndex <= 10
      ? 'early'
      : remDays <= 7
      ? 'late'
      : 'mid';

  const detailedMessages: string[] = [];
  let severity: ImpactSeverity = 'safe';
  let headline = '';
  let recommendation = '';

  let poolKey: TransactionImpactMetrics['poolKey'] = 'daily';
  let poolLabel = getPoolDisplayName('daily', isAr);
  let poolBefore = evalBefore.pools.daily.remaining;
  let poolAfter = evalAfter.pools.daily.remaining;
  let spilloverAmount = 0;

  let simpleOutlookLabel = '';

  if (isOutOfCycle) {
    severity = 'safe';
    headline = isAr
      ? `التاريخ ده (${draft.date}) برة دورة الشهر ده خالص`
      : `This date (${draft.date}) falls outside your current budget cycle`;
    detailedMessages.push(
      isAr
        ? `دورتك الحالية من ${evalBefore.cycle.startDate} لـ ${evalBefore.cycle.endDate} — يعني المبلغ ده مش هيلعب في مصروفك اليومي دلوقتي.`
        : `Your active cycle runs ${evalBefore.cycle.startDate} to ${evalBefore.cycle.endDate}, so today's daily allowance stays unchanged.`
    );
    recommendation = isAr
      ? 'هيتحسب تلقائي أول ما توصل للدورة بتاعته — كله تمام!'
      : 'It will automatically count when viewing that cycle.';
    simpleOutlookLabel = isAr ? 'خارج الدورة الحالية' : 'Outside this cycle';
  } else if (draft.type === 'income') {
    poolKey = 'income';
    poolLabel = getPoolDisplayName('income', isAr);
    poolBefore = evalBefore.pools.total.income;
    poolAfter = evalAfter.pools.total.income;

    if (fromAcc?.isPrivate) {
      severity = 'safe';
      headline = isAr
        ? `فلوس داخلة حساب خاص (${fromAcc.name}) — مصروفك اليومي زي ما هو`
        : `Added to Private account (${fromAcc.name}) — public budget untouched`;
      detailedMessages.push(
        isAr
          ? 'الحسابات الخاصة متشالة على جنب ومش بتأثر على مصروفك اليومي ولا خطة الشهر.'
          : 'Private accounts stay separate from your everyday spending plan until transferred.'
      );
      recommendation = isAr
        ? 'لو حابب تزود مصروف اليوم من المبلغ ده، اعمل تحويل بسيط لحساب عام وقت ما تحب.'
        : 'Transfer any portion to a public account whenever you want to boost daily spending.';
      simpleOutlookLabel = isAr ? 'متشال على جنب (حساب خاص)' : 'Parked safely (Private)';
    } else {
      severity = 'positive';
      const boostPerDay = Math.max(0, dailyDelta);
      headline = isAr
        ? `يا مسهل! يوميتك هتزيد +${fmtShort(boostPerDay, curr)} في اليوم (${dailyDeltaPercent > 0 ? `+${dailyDeltaPercent}%` : 'مباشر'})`
        : `Nice boost! Your daily spending jumps +${fmtShort(boostPerDay, curr)}/day`;
      detailedMessages.push(
        isAr
          ? `إضافة ${fmt(effectiveAmount, curr)} في "${fromAcc?.name || 'حسابك العام'}" رفعت إجمالي الميزانية لـ ${fmt(evalAfter.pools.total.income, curr)} من غير ما تيجي جنب التحويش أو الفواتير.`
          : `Adding ${fmt(effectiveAmount, curr)} to "${fromAcc?.name || 'public account'}" lifts your cycle budget to ${fmt(evalAfter.pools.total.income, curr)} while keeping Savings and Bills steady.`
      );
      detailedMessages.push(
        isAr
          ? `يوميتك لباقي الـ ${remDays} يوم بقت ${fmtShort(dailyAfter, curr)} بدل ${fmtShort(dailyBefore, curr)} — كأنك زودت ${equivalentDailyDays} يوم صرف زيادة!`
          : `Over the next ${remDays} days you get ${fmtShort(dailyAfter, curr)}/day instead of ${fmtShort(dailyBefore, curr)} (+${equivalentDailyDays} extra days of runway).`
      );
      recommendation = isAr
        ? `فكرة حلوة: شيل جزء من الزيادة دي في التحويش عشان تقفل هدفك بدري (ناقصلك ${fmtShort(evalAfter.pools.savings.remaining, curr)} بس).`
        : `Smart move: Tuck part of this inflow into Savings (${fmtShort(evalAfter.pools.savings.remaining, curr)} remaining to target).`;
      simpleOutlookLabel =
        projectedCycleEndBalance >= 0
          ? isAr
            ? `متوقع توفر +${fmtShort(projectedCycleEndBalance, curr)}`
            : `+${fmtShort(projectedCycleEndBalance, curr)} likely left`
          : isAr
          ? `عجز متوقع ${fmtShort(Math.abs(projectedCycleEndBalance), curr)}`
          : `-${fmtShort(Math.abs(projectedCycleEndBalance), curr)} likely short`;
    }
  } else if (draft.type === 'transfer') {
    poolKey = 'transfer';
    poolLabel = draft.isSavingsAllocation
      ? getPoolDisplayName('savings', isAr)
      : isAr
      ? 'تحويل بين الحسابات'
      : 'Account Transfer';
    poolBefore = evalBefore.pools.savings.netSaved;
    poolAfter = evalAfter.pools.savings.netSaved;

    if (draft.isSavingsAllocation) {
      severity = 'positive';
      const pBefore = evalBefore.pools.savings.progressPercent;
      const pAfter = evalAfter.pools.savings.progressPercent;
      headline = isAr
        ? `عاش يا بطل! تحويشك نط من ${pBefore}% لـ ${pAfter}%`
        : `Nice discipline! Savings jumps from ${pBefore}% to ${pAfter}%`;
      detailedMessages.push(
        isAr
          ? `شلت ${fmt(baseAmount, curr)} على جنب في التحويش، ولسه فاضل ${fmtShort(evalAfter.pools.savings.remaining, curr)} وتكمل هدف الشهر.`
          : `Moving ${fmt(baseAmount, curr)} to savings leaves ${fmtShort(evalAfter.pools.savings.remaining, curr)} left to reach your cycle goal.`
      );
      simpleOutlookLabel = isAr ? `تحويشك وصل ${pAfter}%` : `Savings at ${pAfter}%`;
    } else if (fromAcc?.isPrivate !== toAcc?.isPrivate) {
      if (fromAcc?.isPrivate && !toAcc?.isPrivate) {
        severity = 'positive';
        headline = isAr
          ? `ضخّيت سيولة للحساب العام: يوميتك زادت +${fmtShort(Math.max(0, dailyDelta), curr)}/يوم`
          : `Fresh cash in! Daily allowance grows +${fmtShort(Math.max(0, dailyDelta), curr)}/day`;
        detailedMessages.push(
          isAr
            ? `نقل الفلوس من الحساب الخاص للعام دخلهم في الخطة فوراً، ويوميتك بقت ${fmtShort(dailyAfter, curr)}.`
            : `Moving funds into a public account adds them directly to Daily Spending (${fmtShort(dailyAfter, curr)}/day).`
        );
      } else {
        severity = dailyDelta < 0 ? 'caution' : 'safe';
        headline = isAr
          ? `شلت مبلغ في حساب خاص: يوميتك هتقل ${fmtShort(Math.abs(dailyDelta), curr)}/يوم`
          : `Tucked into Private: Daily allowance dips -${fmtShort(Math.abs(dailyDelta), curr)}/day`;
        detailedMessages.push(
          isAr
            ? `طالما حولت ${fmt(baseAmount, curr)} لحساب خاص، اتشالوا من حسبة اليومي تلقائي (${fmtShort(dailyBefore, curr)} ← ${fmtShort(dailyAfter, curr)}).`
            : `Moving ${fmt(baseAmount, curr)} to a private account sets it aside safely (${fmtShort(dailyBefore, curr)} → ${fmtShort(dailyAfter, curr)}/day).`
        );
      }
      simpleOutlookLabel =
        evalAfter.pools.daily.remaining <= 0
          ? isAr
            ? 'الميزانية مش هتستحمل'
            : 'Runs short before payday'
          : isAr
          ? `متكفي لآخر الشهر (${evalAfter.cycle.endDate.slice(5)})`
          : `Safe until ${evalAfter.cycle.endDate.slice(5)}`;
    } else {
      severity = 'safe';
      headline = isAr
        ? 'تحويل عادي بين حساباتك — يوميتك في التمام وماتغيرتش'
        : 'Internal move between accounts — daily allowance stays unchanged';
      detailedMessages.push(
        isAr
          ? 'التحويل بين نفس نوع الحسابات مجرد ترتيب محافظ، مش بيتحسب مصروف.'
          : 'Shuffling money between same-type accounts never reduces your spending limits.'
      );
      simpleOutlookLabel = isAr ? 'الوضع مستقر' : 'Steady on track';
    }
    if (fee > 0) {
      detailedMessages.push(
        isAr
          ? `خلي بالك: رسوم التحويل (${fmt(fee, curr)}) اتخصمت كمصروف من الميزانية.`
          : `Heads-up: The ${fmt(fee, curr)} transfer fee counts as a small expense from your budget.`
      );
    }
    recommendation =
      recommendation ||
      (isAr
        ? `يوميتك بعد التحويل بقت ${fmtShort(dailyAfter, curr)} في اليوم.`
        : `Post-transfer daily allowance: ${fmtShort(dailyAfter, curr)} / day.`);
  } else {
    // EXPENSE ANALYSIS
    const targetPool = draft.budgetPool || 'daily';
    poolKey = targetPool;
    poolLabel = getPoolDisplayName(targetPool, isAr);

    if (targetPool === 'oneoff') {
      poolBefore = evalBefore.pools.oneoff.remaining;
      poolAfter = evalAfter.pools.oneoff.remaining;
      const fundingSrc = evalAfter.pools.oneoff.fundingSource;
      const srcLabel = getPoolDisplayName(fundingSrc, isAr);
      const emergencyUsed = Math.max(0, evalAfter.pools.oneoff.coveredByEmergencyCredit - evalBefore.pools.oneoff.coveredByEmergencyCredit);
      const uncoveredDelta = Math.max(0, evalAfter.pools.oneoff.uncoveredExcess - evalBefore.pools.oneoff.uncoveredExcess);
      spilloverAmount = Math.max(0, dailyBefore - dailyAfter) * Math.max(1, remDays - (isLastDay ? 0 : 1));

      if (uncoveredDelta <= 0) {
        severity = 'safe';
        headline = isAr
          ? emergencyUsed > 0
            ? 'أمان يا صاحبي! مبلغ الطوارئ والـ One-Off شايلينها ومصروفك اليومي سليم'
            : 'مية مية! المصروف الاستثنائي متغطي من مخصصه ومن غير ضغط على يوميتك'
          : 'All good! Covered within its One-Off reserve — Daily allowance protected';
      } else if (fundingSrc === 'savings') {
        severity = evalAfter.pools.daily.remaining < 0 ? 'danger' : 'warning';
        headline = isAr
          ? `المصروف الاستثنائي ده هياكل ${fmtShort(uncoveredDelta, curr)} من وسادة التحويش`
          : `One-Off expense dips ${fmtShort(uncoveredDelta, curr)} into your Savings cushion`;
      } else if (fundingSrc === 'outings') {
        severity = dailyDelta < 0 ? 'warning' : 'caution';
        headline = isAr
          ? dailyDelta < 0
            ? `تخطى مخصص الطوارئ والخروجات وهينزل يوميتك لـ ${fmtShort(dailyAfter, curr)}/يوم`
            : 'تمام! المصروف الاستثنائي اتشال بهدوء من فائض الخروجات'
          : dailyDelta < 0
          ? `Overflows Outings too, trimming Daily to ${fmtShort(dailyAfter, curr)}/day`
          : 'One-Off absorbed cleanly by your remaining Outings balance';
      } else {
        severity = evalAfter.pools.daily.remaining <= 0 ? 'danger' : 'warning';
        headline = isAr
          ? `المصروف ده هينزل يوميتك من ${fmtShort(dailyBefore, curr)} لـ ${fmtShort(dailyAfter, curr)}/يوم`
          : `One-Off trims Daily allowance from ${fmtShort(dailyBefore, curr)} to ${fmtShort(dailyAfter, curr)}/day`;
      }

      detailedMessages.push(
        isAr
          ? `المبلغ ده (${fmtShort(effectiveAmount, curr)}) قد مصروف ${equivalentDailyDays} يوم كاملين من خطتك، والزيادة بتروح على "${srcLabel}".`
          : `This ${fmtShort(effectiveAmount, curr)} spend equals ${equivalentDailyDays} planned spending days; overflow routes to ${srcLabel}.`
      );
      if (evalAfter.pools.savings.absorbedOneOff > evalBefore.pools.savings.absorbedOneOff) {
        detailedMessages.push(
          isAr
            ? `ملاحظة تحويش: رصيد الأمان قل شوية وتقدم التحويش بقى ${evalAfter.pools.savings.progressPercent}%.`
            : `Savings impact: Cushion drops slightly and goal progress adjusts to ${evalAfter.pools.savings.progressPercent}%.`
        );
      }
    } else if (targetPool === 'outings' || targetPool === 'fixed') {
      poolBefore = evalBefore.pools[targetPool].remaining;
      poolAfter = evalAfter.pools[targetPool].remaining;
      spilloverAmount = Math.max(0, effectiveAmount - Math.max(0, poolBefore));

      if (spilloverAmount <= 0) {
        const pctUsed = evalAfter.pools[targetPool].allocated > 0
          ? Math.round((evalAfter.pools[targetPool].spent / evalAfter.pools[targetPool].allocated) * 100)
          : 100;
        severity = pctUsed >= 85 ? 'caution' : 'safe';
        headline = isAr
          ? `في الأمان جوه "${poolLabel}" (باقي فيه ${fmtShort(poolAfter, curr)}) — يوميتك مالمستش`
          : `Fits cleanly in ${poolLabel} (${fmtShort(poolAfter, curr)} left) — Daily untouched`;
        detailedMessages.push(
          isAr
            ? `كده استهلكت ${pctUsed}% من ميزانية ${poolLabel} للشهر، ومصروفك اليومي ثابت عند ${fmtShort(dailyAfter, curr)}/يوم.`
            : `${poolLabel} moves to ${pctUsed}% used while your Daily allowance stays steady at ${fmtShort(dailyAfter, curr)}/day.`
        );
      } else {
        severity = evalAfter.pools.daily.remaining <= 0 ? 'danger' : 'warning';
        headline = isAr
          ? `أكبر من المتبقي في ${poolLabel} بـ ${fmtShort(spilloverAmount, curr)} وهيقلل يوميتك لـ ${fmtShort(dailyAfter, curr)}`
          : `Spills ${fmtShort(spilloverAmount, curr)} past ${poolLabel} → Daily dips to ${fmtShort(dailyAfter, curr)}/day`;
        detailedMessages.push(
          isAr
            ? `الزيادة (${fmtShort(spilloverAmount, curr)}) اتوزعت بهدوء على باقي الـ ${remDays} يوم فنزلت يوميتك بنسبة ${Math.abs(dailyDeltaPercent)}%.`
            : `That extra ${fmtShort(spilloverAmount, curr)} spreads over ${remDays} days, trimming daily spending by ${Math.abs(dailyDeltaPercent)}%.`
        );
      }
    } else {
      // DAILY POOL
      poolBefore = evalBefore.pools.daily.remaining;
      poolAfter = evalAfter.pools.daily.remaining;
      const todayRemAfter = evalBefore.dailyStatus.todayRemaining - effectiveAmount;
      const overToday = todayRemAfter < 0 ? Math.abs(todayRemAfter) : 0;

      if (poolAfter <= 0 || evalAfter.dailyStatus.allowanceState === 'true_deficit') {
        severity = 'danger';
        headline = isAr
          ? `استنى شوية! الصرف ده هيخلّص فلوس اليومي ويدخّلك في عجز ${fmtShort(Math.abs(poolAfter), curr)}`
          : `Hold on! This uses up your remaining Daily pool (${fmtShort(Math.abs(poolAfter), curr)} short)`;
      } else if (overToday > 0 || dailyDeltaPercent <= -15) {
        severity = 'warning';
        headline = isAr
          ? `عدّيت مسموح النهارده بـ ${fmtShort(overToday, curr)} — يومية الأيام الجاية بقت ${fmtShort(dailyAfter, curr)}`
          : `Over today's limit by ${fmtShort(overToday, curr)} — upcoming days adjust to ${fmtShort(dailyAfter, curr)}/day`;
      } else if (todayRemAfter < evalBefore.dailyStatus.todayAllowance * 0.25) {
        severity = 'caution';
        headline = isAr
          ? `قرّبت تخلص مسموح النهارده — باقي لك ${fmtShort(Math.max(0, todayRemAfter), curr)} بس`
          : `Getting tight today — ${fmtShort(Math.max(0, todayRemAfter), curr)} left for the rest of the day`;
      } else {
        severity = 'safe';
        headline = isAr
          ? `في الأمان! باقي لك النهارده ${fmtShort(todayRemAfter, curr)}`
          : `Right on track! ${fmtShort(todayRemAfter, curr)} left for today`;
      }
    }

    // 100% consistent Month Status label (never contradicts a green headline!)
    if (evalAfter.pools.daily.remaining <= 0 || evalAfter.dailyStatus.allowanceState === 'true_deficit') {
      simpleOutlookLabel = isAr
        ? `عجز ${fmtShort(Math.abs(evalAfter.pools.daily.remaining), curr)}`
        : `Short by ${fmtShort(Math.abs(evalAfter.pools.daily.remaining), curr)}`;
    } else if (recentDailySpendAverage > 0 && paceExtraDaysDelta > 0) {
      simpleOutlookLabel = isAr
        ? `مكفّي الـ ${remDays} يوم (+${paceExtraDaysDelta} يوم زيادة)`
        : `Covers ${remDays}d (+${paceExtraDaysDelta}d spare)`;
    } else {
      simpleOutlookLabel = isAr
        ? `مكفّي لآخر الشهر (${remDays} يوم)`
        : `Covers all ${remDays} days left`;
    }

    // Honest Pace Forecast bullet (strictly Daily-only 7-day average, answers "how many days will my cash last?")
    if (evalAfter.pools.daily.remaining <= 0 || evalAfter.dailyStatus.allowanceState === 'true_deficit') {
      detailedMessages.push(
        isAr
          ? `المبلغ ده أكبر من المتبقي في المصروف اليومي وهيسيب عجز ${fmtShort(Math.abs(evalAfter.pools.daily.remaining), curr)} لنهاية الدورة.`
          : `This exceeds your remaining Daily balance, leaving a ${fmtShort(Math.abs(evalAfter.pools.daily.remaining), curr)} shortfall.`
      );
    } else if (recentDailySpendAverage > 0) {
      if (paceForecastDays >= remDays) {
        detailedMessages.push(
          isAr
            ? `📊 بمعدل صرفك اليومي آخر 7 أيام (${fmtShort(recentDailySpendAverage, curr)}/يوم)، فلوسك تكفي حوالي ${paceForecastDays} يوم${paceExtraDaysDelta > 0 ? ` — يعني مكفّية الـ ${remDays} يوم اللي فاضلين ومعاك ~${paceExtraDaysDelta} يوم زيادة.` : ' (مكفّية لآخر الشهر بالظبط).'}`
            : `📊 At your recent 7-day daily pace (${fmtShort(recentDailySpendAverage, curr)}/day), your funds last ~${paceForecastDays} days${paceExtraDaysDelta > 0 ? ` — covering all ${remDays} days left with ~${paceExtraDaysDelta} extra days to spare.` : ' (right through payday).'}`
        );
      } else {
        detailedMessages.push(
          isAr
            ? `📊 وتيرة آخر 7 أيام كانت ${fmtShort(recentDailySpendAverage, curr)}/يوم (تكفي ${paceForecastDays} من ${remDays} يوم)، بس التزامك بحد ${fmtShort(dailyAfter, curr)}/يوم هيوصّلك لآخر الشهر مرتاح.`
            : `📊 Your last 7-day daily pace was ${fmtShort(recentDailySpendAverage, curr)}/day (~${paceForecastDays} of ${remDays} days), so sticking to ${fmtShort(dailyAfter, curr)}/day keeps you covered until payday.`
        );
      }
    } else {
      detailedMessages.push(
        isAr
          ? `📅 بحدك اليومي (${fmtShort(dailyAfter, curr)}/يوم)، فلوسك مكفّية الـ ${remDays} يوم اللي فاضلين لحد ${evalAfter.cycle.endDate.slice(5)}.`
          : `📅 At ${fmtShort(dailyAfter, curr)}/day, your balance covers all ${remDays} remaining days through ${evalAfter.cycle.endDate.slice(5)}.`
      );
    }

    // Daily Average Spike Warning (only when significantly higher than usual Daily-only average)
    if (exceedsAvgAlert) {
      detailedMessages.push(
        isAr
          ? `⚡ الصرفة دي أعلى بـ ${exceedsAvgRatio}× من متوسّط صرفك اليومي المعتاد (${fmtShort(recentDailySpendAverage || plannedDaily, curr)}/يوم).`
          : `⚡ Big jump: ${exceedsAvgRatio}× higher than your usual daily spend (${fmtShort(recentDailySpendAverage || plannedDaily, curr)}/day).`
      );
    }

    if (draft.isRecurring) {
      detailedMessages.push(
        isAr
          ? '🔁 بما إن المصروف ده متكرر، سجّله في الفواتير والالتزامات عشان يتعمل حسابه من أول الشهر.'
          : '🔁 Since this repeats, keeping it under Bills & Fixed helps future cycles plan for it.'
      );
    }

    const dailyRecoveryNeeded =
      dailyBefore > dailyAfter && remDays > 1
        ? Math.round((dailyBefore - dailyAfter) * 100) / 100
        : evalAfter.pools.daily.remaining < 0
        ? Math.round((Math.abs(evalAfter.pools.daily.remaining) / remDays) * 100) / 100
        : 0;

    if (severity === 'danger') {
      recommendation = isAr
        ? `تعمل إيه؟ لو المصروف ده طارئ سجّله كـ "استثنائي" عشان ميبوّظش اليومي، أو وفّر ${fmtShort(dailyRecoveryNeeded, curr)}/يوم، أو افتح إعادة التوازن.`
        : `What helps: Tag urgent surprises as One-Off, trim ${fmtShort(dailyRecoveryNeeded, curr)}/day ahead, or open Smart Budget to rebalance.`;
    } else if (severity === 'warning') {
      recommendation = isAr
        ? `عشان ترجع لخطتك القديمة بسهولة، حاول توفّر حوالي ${fmtShort(Math.max(1, dailyRecoveryNeeded), curr)} بس كل يوم في الـ ${remDays} يوم الجايين.`
        : `Easy recovery: Spend about ${fmtShort(Math.max(1, dailyRecoveryNeeded), curr)} less per day over the next ${remDays} days to bounce back.`;
    } else if (severity === 'caution') {
      recommendation = isAr
        ? `خلي باقي يومك هادي النهارده وهتكمل باقي الشهر على ${fmtShort(dailyAfter, curr)}/يوم بدون أي ضغط.`
        : `Keep the rest of today light and you will cruise at ${fmtShort(dailyAfter, curr)}/day ahead.`;
    } else {
      recommendation = isAr
        ? evalAfter.pools.outings.remaining > 0
          ? `ماشي مظبوط! ومعاك كمان ${fmtShort(evalAfter.pools.outings.remaining, curr)} فايضين لبند الخروجات.`
          : 'ماشي مظبوط — حافظ على الوتيرة دي وهتكمّل الشهر مرتاح.'
        : evalAfter.pools.outings.remaining > 0
        ? `Looking great! You also still have ${fmtShort(evalAfter.pools.outings.remaining, curr)} free in Outings.`
        : 'Looking great — keep this pace and you will breeze through the month.';
    }

    return {
      severity,
      headline,
      detailedMessages,
      recommendation,
      metrics: {
        effectiveAmount,
        dailyBefore,
        dailyAfter,
        dailyDelta,
        dailyDeltaPercent,
        todayRemainingBefore: evalBefore.dailyStatus.todayRemaining,
        todayRemainingAfter: evalAfter.dailyStatus.todayRemaining,
        poolKey,
        poolLabel,
        poolBefore,
        poolAfter,
        spilloverAmount,
        equivalentDailyDays,
        averageDailySpendInCycle,
        recentDailySpendAverage,
        paceForecastDays,
        paceExtraDaysDelta,
        exceedsAvgAlert,
        exceedsAvgRatio,
        remainingDaysInCycle: remDays,
        projectedRunwayDays: runwayAfter.runwayDays,
        projectedZeroDate: runwayAfter.zeroDate,
        projectedCycleEndBalance,
        simpleOutlookLabel,
        savingsProgressBefore: evalBefore.pools.savings.progressPercent,
        savingsProgressAfter: evalAfter.pools.savings.progressPercent,
        dailyRecoveryNeeded,
        isPrivateInvolved,
        isOutOfCycle: false,
      },
    };
  }

  return {
    severity,
    headline,
    detailedMessages,
    recommendation,
    metrics: {
      effectiveAmount,
      dailyBefore,
      dailyAfter,
      dailyDelta,
      dailyDeltaPercent,
      todayRemainingBefore: evalBefore.dailyStatus.todayRemaining,
      todayRemainingAfter: evalAfter.dailyStatus.todayRemaining,
      poolKey,
      poolLabel,
      poolBefore,
      poolAfter,
      spilloverAmount,
      equivalentDailyDays,
      averageDailySpendInCycle,
      recentDailySpendAverage,
      paceForecastDays,
      paceExtraDaysDelta,
      exceedsAvgAlert,
      exceedsAvgRatio,
      remainingDaysInCycle: remDays,
      projectedRunwayDays: runwayAfter.runwayDays,
      projectedZeroDate: runwayAfter.zeroDate,
      projectedCycleEndBalance,
      simpleOutlookLabel,
      savingsProgressBefore: evalBefore.pools.savings.progressPercent,
      savingsProgressAfter: evalAfter.pools.savings.progressPercent,
      dailyRecoveryNeeded: 0,
      isPrivateInvolved,
      isOutOfCycle,
    },
  };
}

export function simulateWhatIfScenario(
  params: {
    mode: 'single_expense' | 'multi_day_expense' | 'extra_income' | 'stretch_days';
    amount: number;
    daysCount?: number;
    extraDays?: number;
    pool: 'daily' | 'outings' | 'fixed' | 'oneoff';
  },
  evaluation: SmartBudgetEvaluation,
  transactions: Transaction[],
  accounts: Account[],
  config: SmartBudgetConfig,
  lang: 'en' | 'ar' | 'ar_eg' = 'ar_eg',
  asOf: Date = new Date()
): WhatIfSimulationReport {
  const isAr = lang === 'ar' || lang === 'ar_eg';
  const curr = evaluation.baseCurrency || 'EGP';
  const remDays = Math.max(1, evaluation.dailyStatus.remainingDaysInCycle);
  const isLastDay = remDays <= 1;

  const elapsedDays = Math.max(1, evaluation.dailyStatus.cycleDayIndex);
  // Strictly Daily-only pace (never mix Outings into Daily burn rate!)
  const burnRateBefore =
    Math.round((evaluation.pools.daily.trackedSpent / elapsedDays) * 100) / 100;
  const recentDailyAverage = computeRecentDailyAverage(
    evaluation.pools.daily.transactions,
    evaluation.pools.daily.trackedSpent,
    asOf,
    evaluation.cycle.startDate,
    elapsedDays
  );

  const allowanceBefore = isLastDay
    ? Math.max(0, evaluation.dailyStatus.todayRemaining)
    : evaluation.dailyStatus.upcomingDailyAllowance;

  const runwayBefore = computeRunway(
    evaluation.pools.daily.remaining,
    Math.max(recentDailyAverage || burnRateBefore, allowanceBefore || 1),
    remDays,
    asOf
  );

  // ==========================================================================
  // MODE 4: STRETCH EXTRA DAYS (Extend current cycle end date by N extra days)
  // ==========================================================================
  if (params.mode === 'stretch_days') {
    const requestedExtraDays = Math.min(
      60,
      Math.max(1, Math.round(params.extraDays ?? params.daysCount ?? 5))
    );
    const currentCycleKey = evaluation.cycle.startDate;
    const nextOverrides = {
      ...(config.overrides || {}),
      [currentCycleKey]: {
        ...(config.overrides?.[currentCycleKey] || {}),
        extraCycleDays: requestedExtraDays,
      },
    };
    const simEval = evaluateSmartBudget(
      transactions,
      accounts,
      { ...config, extraCycleDays: requestedExtraDays, overrides: nextOverrides },
      asOf
    );

    const newRemDays = Math.max(1, simEval.dailyStatus.remainingDaysInCycle);
    const newAllowance =
      newRemDays <= 1
        ? Math.max(0, simEval.dailyStatus.todayRemaining)
        : simEval.dailyStatus.upcomingDailyAllowance;
    const stretchDelta = Math.round((newAllowance - allowanceBefore) * 100) / 100;
    const stretchDeltaPct =
      allowanceBefore > 0 ? Math.round((stretchDelta / allowanceBefore) * 1000) / 10 : 0;
    const paceBasis = recentDailyAverage > 0 ? recentDailyAverage : newAllowance || 1;
    const paceDays =
      simEval.pools.daily.remaining <= 0
        ? 0
        : Math.min(999, Math.floor(simEval.pools.daily.remaining / paceBasis));
    const stretchRunway = computeRunway(
      simEval.pools.daily.remaining,
      Math.max(paceBasis, 1),
      newRemDays,
      asOf
    );

    const severity: ImpactSeverity =
      simEval.pools.daily.remaining <= 0
        ? 'danger'
        : Math.abs(stretchDeltaPct) >= 25
        ? 'warning'
        : 'caution';

    const headline =
      simEval.pools.daily.remaining <= 0
        ? isAr
          ? `مافيش رصيد يومي كافي للتمديد (+${requestedExtraDays} يوم)`
          : `Not enough Daily balance left to stretch by +${requestedExtraDays} days`
        : isAr
        ? `لو مدّيت الشهر +${requestedExtraDays} يوم (لحد ${simEval.cycle.endDate})، يوميتك هتبقى ${fmtShort(newAllowance, curr)}/يوم`
        : `Stretching +${requestedExtraDays} extra days (until ${simEval.cycle.endDate}) sets your daily limit to ${fmtShort(newAllowance, curr)}/day`;

    const detailedMessages: string[] = [
      isAr
        ? `الفلوس المتبقية في اليومي (${fmtShort(simEval.pools.daily.remaining, curr)}) هتتقسّم على ${newRemDays} يوم بدل ${remDays} يوم (نهاية جديدة: ${simEval.cycle.endDate}).`
        : `Your remaining Daily balance (${fmtShort(simEval.pools.daily.remaining, curr)}) spreads across ${newRemDays} days instead of ${remDays} (new end: ${simEval.cycle.endDate}).`,
    ];

    if (recentDailyAverage > 0) {
      detailedMessages.push(
        paceDays >= newRemDays
          ? isAr
            ? `📊 بمعدل صرفك آخر 7 أيام (${fmtShort(recentDailyAverage, curr)}/يوم)، فلوسك تكفي حوالي ${paceDays} يوم — يعني هتعدّي التمديد مرتاح!`
            : `📊 At your last 7-day pace (${fmtShort(recentDailyAverage, curr)}/day), funds last ~${paceDays} days — comfortably covering the stretch!`
          : isAr
          ? `📊 معدل آخر 7 أيام (${fmtShort(recentDailyAverage, curr)}/يوم) يكفي ${paceDays} من ${newRemDays} يوم — فلو طبّقت التمديد التزم بحد ${fmtShort(newAllowance, curr)}/يوم.`
          : `📊 Your last 7-day pace (${fmtShort(recentDailyAverage, curr)}/day) covers ${paceDays} of ${newRemDays} days — stick to ${fmtShort(newAllowance, curr)}/day if you apply this stretch.`
      );
    }

    const recommendation = isAr
      ? `تقدر تطبّق التمديد (+${requestedExtraDays} يوم) على الشهر ده كحالة استثنائية، وهيفضل الشهر الجاي يرجع لموعده العادي تلقائياً.`
      : `You can apply +${requestedExtraDays} extra days to this cycle as a one-off exception — next month stays on your normal schedule automatically.`;

    return {
      mode: 'stretch_days',
      totalAmount: simEval.pools.daily.remaining,
      perDayAmount: newAllowance,
      daysCount: requestedExtraDays,
      extraDays: requestedExtraDays,
      newCycleEndDate: simEval.cycle.endDate,
      newRemainingDays: newRemDays,
      recentDailyAverage,
      paceForecastDays: paceDays,
      severity,
      headline,
      detailedMessages,
      recommendation,
      poolName: getPoolDisplayName('daily', isAr),
      poolBefore: evaluation.pools.daily.remaining,
      poolAfter: simEval.pools.daily.remaining,
      spilloverToDaily: 0,
      allowanceBefore,
      allowanceAfter: newAllowance,
      dailyDelta: stretchDelta,
      dailyDeltaPercent: stretchDeltaPct,
      burnRateBefore,
      burnRateAfter: burnRateBefore,
      runwayDaysBefore: runwayBefore.runwayDays,
      runwayDaysAfter: stretchRunway.runwayDays,
      projectedZeroDate: stretchRunway.zeroDate,
      projectedCycleEndBalance: simEval.pools.daily.remaining <= 0 ? simEval.pools.daily.remaining : 0,
      dailyRecoveryNeeded: stretchDelta < 0 ? Math.abs(stretchDelta) : 0,
      remainingDaysInCycle: newRemDays,
      isLastDay: newRemDays <= 1,
      poolComparison: [],
    };
  }

  const daysCount =
    params.mode === 'multi_day_expense'
      ? Math.min(remDays, Math.max(1, Math.round(params.daysCount || 3)))
      : 1;
  const perDayAmount = Math.max(0, Number(params.amount) || 0);
  const totalAmount = Math.round(perDayAmount * daysCount * 100) / 100;

  // Pick a representative public account for simulation (so from_today live balances adjust cleanly)
  const publicAcc = accounts.find((a) => !a.isPrivate) || accounts[0];
  const simAccountId = publicAcc?.id || '__sim_public__';
  const simAccounts: Account[] =
    publicAcc
      ? accounts
      : [{ id: simAccountId, name: 'Public', icon: '💳', balance: evaluation.pools.total.income, isPrivate: false, customMonthStartDay: 'default', notes: '' }];

  const buildVirtualEvaluation = (
    txType: 'expense' | 'income',
    amt: number,
    targetPool: 'daily' | 'outings' | 'fixed' | 'oneoff'
  ): SmartBudgetEvaluation => {
    if (amt <= 0) return evaluation;
    const simTx: Transaction = {
      id: '__what_if_sim__',
      type: txType,
      amount: amt,
      date: evaluation.dailyStatus.asOfDate,
      accountId: simAccountId,
      budgetPool: txType === 'expense' ? targetPool : undefined,
      description: 'What-If Simulation',
      createdAt: Date.now(),
    };
    const nextAccs = applyVirtualAccountDeltas(simAccounts, simTx, 1);
    return evaluateSmartBudget([...transactions, simTx], nextAccs, config, asOf);
  };

  let poolName = getPoolDisplayName(params.pool, isAr);
  let poolBefore = 0;
  let poolAfter = 0;
  let spilloverToDaily = 0;
  let allowanceAfter = allowanceBefore;
  let simEval: SmartBudgetEvaluation = evaluation;

  if (params.mode === 'extra_income') {
    poolName = isAr ? 'إجمالي الخطة والمصروف اليومي' : 'Total Plan & Daily';
    poolBefore = evaluation.pools.total.income;
    simEval = buildVirtualEvaluation('income', totalAmount, 'daily');
    poolAfter = simEval.pools.total.income;
    allowanceAfter = isLastDay
      ? Math.max(0, simEval.dailyStatus.todayRemaining)
      : simEval.dailyStatus.upcomingDailyAllowance;
  } else {
    simEval = buildVirtualEvaluation('expense', totalAmount, params.pool);
    if (params.pool === 'outings') {
      poolBefore = evaluation.pools.outings.remaining;
      poolAfter = simEval.pools.outings.remaining;
      spilloverToDaily = Math.max(0, totalAmount - Math.max(0, poolBefore));
    } else if (params.pool === 'fixed') {
      poolBefore = evaluation.pools.fixed.remaining;
      poolAfter = simEval.pools.fixed.remaining;
      spilloverToDaily = Math.max(0, totalAmount - Math.max(0, poolBefore));
    } else if (params.pool === 'oneoff') {
      poolBefore = evaluation.pools.oneoff.remaining + evaluation.pools.savings.remainingEmergencyCredit;
      poolAfter = simEval.pools.oneoff.remaining;
      spilloverToDaily = Math.max(0, simEval.dailyStatus.spilledFromOneOff - evaluation.dailyStatus.spilledFromOneOff);
    } else {
      poolBefore = evaluation.pools.daily.remaining;
      poolAfter = simEval.pools.daily.remaining;
      spilloverToDaily = totalAmount;
    }

    allowanceAfter = isLastDay
      ? Math.max(0, simEval.dailyStatus.todayRemaining)
      : simEval.dailyStatus.upcomingDailyAllowance;
  }

  const dailyDelta = Math.round((allowanceAfter - allowanceBefore) * 100) / 100;
  const dailyDeltaPercent =
    allowanceBefore > 0 ? Math.round((dailyDelta / allowanceBefore) * 1000) / 10 : 0;

  const burnRateAfter =
    params.mode === 'extra_income'
      ? burnRateBefore
      : Math.round((simEval.pools.daily.trackedSpent / elapsedDays) * 100) / 100;

  const paceBasisAfter = recentDailyAverage > 0 ? recentDailyAverage : allowanceAfter || 1;
  const paceForecastDays =
    simEval.pools.daily.remaining <= 0
      ? 0
      : Math.min(999, Math.floor(simEval.pools.daily.remaining / paceBasisAfter));

  const runwayAfter = computeRunway(
    simEval.pools.daily.remaining,
    Math.max(paceBasisAfter, 1),
    remDays,
    asOf
  );

  const projectedCycleEndBalance =
    simEval.pools.daily.remaining <= 0
      ? Math.round(simEval.pools.daily.remaining * 100) / 100
      : recentDailyAverage > 0 && recentDailyAverage < allowanceAfter
      ? Math.round(
          (simEval.pools.daily.remaining - recentDailyAverage * Math.max(0, remDays - 1)) * 100
        ) / 100
      : 0;

  const dailyRecoveryNeeded =
    params.mode !== 'extra_income' && dailyDelta < 0
      ? Math.round(Math.abs(dailyDelta) * 100) / 100
      : 0;

  // Build 3-way Pool Comparison (Daily vs Outings vs One-Off) for expense modes
  const poolComparison: WhatIfPoolComparisonItem[] = [];
  if (params.mode !== 'extra_income' && totalAmount > 0) {
    const comparePools: Array<'daily' | 'outings' | 'oneoff'> = ['daily', 'outings', 'oneoff'];
    const rawItems = comparePools.map((p) => {
      const pEval = p === params.pool ? simEval : buildVirtualEvaluation('expense', totalAmount, p);
      const pAllowAfter = isLastDay
        ? Math.max(0, pEval.dailyStatus.todayRemaining)
        : pEval.dailyStatus.upcomingDailyAllowance;
      const pDelta = Math.round((pAllowAfter - allowanceBefore) * 100) / 100;
      const pRemAfter =
        p === 'outings'
          ? pEval.pools.outings.remaining
          : p === 'oneoff'
          ? pEval.pools.oneoff.remaining
          : pEval.pools.daily.remaining;
      const savImpact = Math.max(
        0,
        pEval.pools.savings.absorbedOneOff - evaluation.pools.savings.absorbedOneOff
      );
      return {
        pool: p,
        label: getPoolDisplayName(p, isAr),
        poolRemainingAfter: pRemAfter,
        dailyAllowanceAfter: pAllowAfter,
        dailyDelta: pDelta,
        savingsImpact: savImpact,
        score: pAllowAfter - savImpact * 0.4 + (pRemAfter >= 0 ? 150 : 0),
        note:
          p === 'outings' && pRemAfter >= 0
            ? isAr
              ? 'الخروجات هتشيلها من غير ما تلمس اليومي'
              : 'Absorbed cleanly inside Outings'
            : p === 'oneoff' && savImpact > 0
            ? isAr
              ? `هيسحب ${fmtShort(savImpact, curr)} من وسادة التحويش`
              : `Uses ${fmtShort(savImpact, curr)} from Savings`
            : pDelta === 0
            ? isAr
              ? 'مش هيأثر على يوميتك خالص'
              : 'Zero daily allowance drop'
            : isAr
            ? `هيغيّر يوميتك بـ ${fmtShort(pDelta, curr)}`
            : `Shifts Daily by ${fmtShort(pDelta, curr)}`,
      };
    });

    const bestScore = Math.max(...rawItems.map((i) => i.score));
    let marked = false;
    for (const item of rawItems) {
      const isOptimal = !marked && item.score === bestScore;
      if (isOptimal) marked = true;
      poolComparison.push({
        pool: item.pool,
        label: item.label,
        poolRemainingAfter: item.poolRemainingAfter,
        dailyAllowanceAfter: item.dailyAllowanceAfter,
        dailyDelta: item.dailyDelta,
        savingsImpact: item.savingsImpact,
        isOptimal,
        note: item.note,
      });
    }
  }

  let severity: ImpactSeverity = 'safe';
  let headline = '';
  let recommendation = '';
  const detailedMessages: string[] = [];

  if (totalAmount <= 0) {
    headline = isAr ? 'اكتب أي مبلغ عشان تشوف هيأثر إزاي على شهرك' : 'Enter an amount to preview how it affects your month';
    recommendation = isAr
      ? 'جرب تحسب مصروف مرة واحدة، مصروف كام يوم، أو فلوس زيادة جاية وشوف الأرقام هتقول إيه.'
      : 'Test a single spend, multi-day streak, or extra income and compare across pools.';
  } else if (params.mode === 'extra_income') {
    severity = 'positive';
    headline = isAr
      ? `حلو أوي! لو دخلت ${fmtShort(totalAmount, curr)} يوميتك هتزيد +${fmtShort(Math.max(0, dailyDelta), curr)}/يوم (+${dailyDeltaPercent}%)`
      : `Nice lift! Adding ${fmtShort(totalAmount, curr)} raises Daily Allowance by +${fmtShort(Math.max(0, dailyDelta), curr)}/day`;
    detailedMessages.push(
      isAr
        ? `يوميتك في الـ ${remDays} يوم اللي فاضلين هتنط من ${fmtShort(allowanceBefore, curr)} لـ ${fmtShort(allowanceAfter, curr)}.`
        : `Daily allowance for the next ${remDays} days rises from ${fmtShort(allowanceBefore, curr)} to ${fmtShort(allowanceAfter, curr)}.`
    );
    detailedMessages.push(
      isAr
        ? `صافي آخر الشهر المتوقع هيتحسن لـ ${projectedCycleEndBalance >= 0 ? `وفر حلو +${fmtShort(projectedCycleEndBalance, curr)}` : `عجز ${fmtShort(projectedCycleEndBalance, curr)}`}.`
        : `Projected cycle finish improves to ${projectedCycleEndBalance >= 0 ? `+${fmtShort(projectedCycleEndBalance, curr)} surplus` : fmtShort(projectedCycleEndBalance, curr)}.`
    );
    recommendation = isAr
      ? 'فكرة ذكية: زوّد بيهم التحويش أو قفّل لو فيه بند واقع معاك.'
      : 'Smart move: Put part of this boost toward your Savings goal.';
  } else {
    const modePrefix =
      params.mode === 'multi_day_expense'
        ? isAr
          ? `صرف ${fmtShort(perDayAmount, curr)} لمدة ${daysCount} يوم (إجمالي ${fmtShort(totalAmount, curr)}): `
          : `${daysCount} days at ${fmtShort(perDayAmount, curr)}/day (total ${fmtShort(totalAmount, curr)}): `
        : '';

    if (simEval.pools.daily.remaining <= 0 || simEval.dailyStatus.allowanceState === 'true_deficit') {
      severity = 'danger';
      headline = isAr
        ? `${modePrefix}هيدخّل الميزانية في عجز (${fmtShort(Math.abs(simEval.pools.daily.remaining), curr)})`
        : `${modePrefix}triggers a budget deficit (${fmtShort(Math.abs(simEval.pools.daily.remaining), curr)})`;
    } else if (dailyDelta < 0 || poolAfter < 0) {
      severity = Math.abs(dailyDeltaPercent) >= 20 ? 'warning' : 'caution';
      headline = isAr
        ? `${modePrefix}هينزّل يوميتك لـ ${fmtShort(allowanceAfter, curr)}/يوم (${dailyDeltaPercent}%)`
        : `${modePrefix}lowers Daily Allowance to ${fmtShort(allowanceAfter, curr)}/day (${dailyDeltaPercent}%)`;
    } else {
      severity = 'safe';
      headline = isAr
        ? `${modePrefix}زي الفل وأمان تماماً — يوميتك ثابتة عند ${fmtShort(allowanceAfter, curr)}/يوم`
        : `${modePrefix}completely safe — Daily stays ${fmtShort(allowanceAfter, curr)}/day`;
    }

    detailedMessages.push(
      isAr
        ? `متوسط صرفك اليومي هيتغير من ${fmtShort(burnRateBefore, curr)} لـ ${fmtShort(burnRateAfter, curr)} في اليوم.`
        : `Your daily burn rate shifts from ${fmtShort(burnRateBefore, curr)} to ${fmtShort(burnRateAfter, curr)}/day.`
    );
    if (runwayAfter.zeroDate) {
      detailedMessages.push(
        isAr
          ? `لو فضلت على نفس السرعة، الميزانية هتقفل يوم ${runwayAfter.zeroDate} (يعني ${runwayAfter.runwayDays} يوم من ${remDays}).`
          : `At this pace, funds last until ${runwayAfter.zeroDate} (${runwayAfter.runwayDays} of ${remDays} days).`
      );
    } else {
      detailedMessages.push(
        isAr
          ? `الفلوس متكفي لآخر الدورة يوم ${evaluation.cycle.endDate} بباقي متوقع ${projectedCycleEndBalance >= 0 ? `+${fmtShort(projectedCycleEndBalance, curr)}` : fmtShort(projectedCycleEndBalance, curr)}.`
          : `Covers the full cycle through ${evaluation.cycle.endDate} (projected end balance: ${fmtShort(projectedCycleEndBalance, curr)}).`
      );
    }

    const bestOption = poolComparison.find((p) => p.isOptimal);
    recommendation = bestOption
      ? isAr
        ? `أحسن مكان تسجل فيه الصرفة دي: "${bestOption.label}" (${bestOption.note}).${dailyRecoveryNeeded > 0 ? ` وعشان تعوّض، وفّر ${fmtShort(dailyRecoveryNeeded, curr)}/يوم.` : ''}`
        : `Best pool choice: "${bestOption.label}" (${bestOption.note}).${dailyRecoveryNeeded > 0 ? ` Easy recovery: trim ${fmtShort(dailyRecoveryNeeded, curr)}/day.` : ''}`
      : isAr
      ? 'الوضع متزن وتقدر تنفذ الخطة بأمان!'
      : 'Balanced outlook — safe to proceed!';
  }

  return {
    mode: params.mode,
    totalAmount,
    perDayAmount,
    daysCount,
    severity,
    headline,
    detailedMessages,
    recommendation,
    poolName,
    poolBefore,
    poolAfter,
    spilloverToDaily,
    allowanceBefore,
    allowanceAfter,
    dailyDelta,
    dailyDeltaPercent,
    burnRateBefore,
    burnRateAfter,
    runwayDaysBefore: runwayBefore.runwayDays,
    runwayDaysAfter: runwayAfter.runwayDays,
    projectedZeroDate: runwayAfter.zeroDate,
    projectedCycleEndBalance,
    dailyRecoveryNeeded,
    remainingDaysInCycle: remDays,
    isLastDay,
    recentDailyAverage,
    paceForecastDays,
    poolComparison,
  };
}
