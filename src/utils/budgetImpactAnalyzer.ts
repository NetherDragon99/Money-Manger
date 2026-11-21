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
  exceedsAvgAlert: boolean;
  exceedsAvgRatio: number;
  remainingDaysInCycle: number;
  projectedRunwayDays: number;
  projectedZeroDate: string | null;
  projectedCycleEndBalance: number;
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
  mode: 'single_expense' | 'multi_day_expense' | 'extra_income';
  totalAmount: number;
  perDayAmount: number;
  daysCount: number;
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
  if (pool === 'oneoff') return isAr ? 'المصاريف الاستثنائية (One-Off)' : 'One-Off';
  if (pool === 'savings') return isAr ? 'التحويش' : 'Savings';
  if (pool === 'income') return isAr ? 'إجمالي الميزانية' : 'Total Budget';
  return isAr ? 'تحويل' : 'Transfer';
}

export function analyzeTransactionImpact(
  draft: DraftTransactionForImpact,
  editingTx: Transaction | null,
  allTransactions: Transaction[],
  accounts: Account[],
  config: SmartBudgetConfig,
  lang: 'en' | 'ar' = 'ar',
  asOf: Date = new Date()
): TransactionImpactReport | null {
  const isAr = lang === 'ar';
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
  const totalDiscretionarySpentBefore =
    evalBefore.pools.daily.trackedSpent + evalBefore.pools.outings.trackedSpent;
  const averageDailySpendInCycle =
    Math.round((totalDiscretionarySpentBefore / elapsedDays) * 100) / 100;

  const plannedDaily = Math.max(1, evalBefore.dailyStatus.plannedDailyAllowance || dailyBefore || 1);
  const equivalentDailyDays = Math.round((effectiveAmount / plannedDaily) * 10) / 10;

  const avgBaseline = Math.max(averageDailySpendInCycle, plannedDaily * 0.65);
  const exceedsAvgRatio = avgBaseline > 0 ? Math.round((effectiveAmount / avgBaseline) * 10) / 10 : 0;
  const exceedsAvgAlert =
    draft.type === 'expense' &&
    ((averageDailySpendInCycle > 0 && effectiveAmount >= averageDailySpendInCycle * 1.5) ||
      effectiveAmount >= plannedDaily * 1.6);

  const burnAfter = Math.max(
    averageDailySpendInCycle || plannedDaily,
    evalAfter.dailyStatus.upcomingDailyAllowance || plannedDaily
  );
  const runwayAfter = computeRunway(
    evalAfter.pools.daily.remaining + Math.max(0, evalAfter.pools.outings.remaining),
    burnAfter,
    remDays,
    asOf
  );
  const projectedCycleEndBalance =
    Math.round(
      (evalAfter.pools.daily.remaining -
        (averageDailySpendInCycle > 0 ? averageDailySpendInCycle : dailyAfter) * Math.max(0, remDays - 1)) *
        100
    ) / 100;

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

  if (isOutOfCycle) {
    severity = 'safe';
    headline = isAr
      ? `هذه المعاملة (${draft.date}) خارج دورة الميزانية الحالية`
      : `Transaction date (${draft.date}) is outside the active budget cycle`;
    detailedMessages.push(
      isAr
        ? `الدورة الحالية من ${evalBefore.cycle.startDate} إلى ${evalBefore.cycle.endDate} — لن تؤثر على مسموح هذه الدورة.`
        : `Active cycle is ${evalBefore.cycle.startDate} to ${evalBefore.cycle.endDate} — current cycle limits remain unchanged.`
    );
    recommendation = isAr
      ? 'سيتم حسابها تلقائياً عند الانتقال لدورتها الزمنية.'
      : 'It will automatically be included when viewing that cycle.';
  } else if (draft.type === 'income') {
    poolKey = 'income';
    poolLabel = getPoolDisplayName('income', isAr);
    poolBefore = evalBefore.pools.total.income;
    poolAfter = evalAfter.pools.total.income;

    if (fromAcc?.isPrivate) {
      severity = 'safe';
      headline = isAr
        ? `دخل لحساب خاص (${fromAcc.name}) — لا يغيّر خطة المصروف العام`
        : `Income to Private account (${fromAcc.name}) — budget stays isolated`;
      detailedMessages.push(
        isAr
          ? 'الحسابات الخاصة معزولة عن الصرف اليومي والخطة العامة، ويمكنك تحويل جزء منها للحساب العام متى أردت.'
          : 'Private accounts are excluded from public budget pools until transferred to a public account.'
      );
      recommendation = isAr
        ? 'لو حابب تزود مصروفك اليومي من هذا المبلغ، انقله إلى أحد الحسابات العامة.'
        : 'Transfer any portion to a public account whenever you want to boost daily spending.';
    } else {
      severity = 'positive';
      const boostPerDay = Math.max(0, dailyDelta);
      headline = isAr
        ? `دفعة إيجابية! مصروفك اليومي هيرتفع بـ +${fmtShort(boostPerDay, curr)} (${dailyDeltaPercent > 0 ? `+${dailyDeltaPercent}%` : 'مباشر'})`
        : `Positive boost! Daily allowance rises by +${fmtShort(boostPerDay, curr)}/day`;
      detailedMessages.push(
        isAr
          ? `إضافة ${fmt(effectiveAmount, curr)} في "${fromAcc?.name || 'حساب عام'}" بترفع إجمالي الخطة إلى ${fmt(evalAfter.pools.total.income, curr)} مع الحفاظ على أهداف التحويش والفواتير ثابتة.`
          : `Adding ${fmt(effectiveAmount, curr)} into "${fromAcc?.name || 'public account'}" lifts your total budget to ${fmt(evalAfter.pools.total.income, curr)} while keeping Savings & Bills targets intact.`
      );
      detailedMessages.push(
        isAr
          ? `المسموح اليومي لباقي ${remDays} أيام: ${fmtShort(dailyBefore, curr)} ← ${fmtShort(dailyAfter, curr)} / يوم (يعادل ${equivalentDailyDays} يوم صرف إضافي).`
          : `Daily allowance for the remaining ${remDays} days: ${fmtShort(dailyBefore, curr)} → ${fmtShort(dailyAfter, curr)}/day (+${equivalentDailyDays} days of spending).`
      );
      recommendation = isAr
        ? `تقدر تستفيد بجزء من الزيادة في التحويش لو حابب تقفل هدف التحويش بدري (المتبقي للهدف: ${fmtShort(evalAfter.pools.savings.remaining, curr)}).`
        : `Consider allocating part of this inflow toward Savings (${fmtShort(evalAfter.pools.savings.remaining, curr)} remaining to target).`;
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
        ? `ممتاز! تقدم التحويش هيرتفع من ${pBefore}% إلى ${pAfter}%`
        : `Great! Savings progress jumps from ${pBefore}% to ${pAfter}%`;
      detailedMessages.push(
        isAr
          ? `تحويل ${fmt(baseAmount, curr)} للتحويش بيقربك أكتر لهدف الدورة (${fmtShort(evalAfter.pools.savings.remaining, curr)} متبقي).`
          : `Moving ${fmt(baseAmount, curr)} to savings leaves ${fmtShort(evalAfter.pools.savings.remaining, curr)} left to reach your cycle goal.`
      );
    } else if (fromAcc?.isPrivate !== toAcc?.isPrivate) {
      if (fromAcc?.isPrivate && !toAcc?.isPrivate) {
        severity = 'positive';
        headline = isAr
          ? `نقل للحساب العام: +${fmtShort(Math.max(0, dailyDelta), curr)}/يوم للمصروف اليومي`
          : `Moved to Public account: +${fmtShort(Math.max(0, dailyDelta), curr)}/day to Daily`;
        detailedMessages.push(
          isAr
            ? `نقل الفلوس من حساب خاص إلى حساب عام يضيفها للخطة فوراً ويرفع المسموح اليومي لـ ${fmtShort(dailyAfter, curr)}.`
            : `Moving funds into a public account adds them directly to Daily Spending (${fmtShort(dailyAfter, curr)}/day).`
        );
      } else {
        severity = dailyDelta < 0 ? 'caution' : 'safe';
        headline = isAr
          ? `نقل لحساب خاص: ينقص الصرف اليومي بـ ${fmtShort(Math.abs(dailyDelta), curr)}/يوم`
          : `Moved to Private account: Daily allowance adjusts by -${fmtShort(Math.abs(dailyDelta), curr)}/day`;
        detailedMessages.push(
          isAr
            ? `عند نقل ${fmt(baseAmount, curr)} لحساب خاص، يتم استبعادها من رصيد الخطة العامة تلقائياً (${fmtShort(dailyBefore, curr)} ← ${fmtShort(dailyAfter, curr)}).`
            : `Moving ${fmt(baseAmount, curr)} to a private account removes it from the public budget (${fmtShort(dailyBefore, curr)} → ${fmtShort(dailyAfter, curr)}/day).`
        );
      }
    } else {
      severity = 'safe';
      headline = isAr
        ? 'تحويل داخلي آمن — لا يستهلك من أحواض الصرف'
        : 'Internal transfer — zero impact on expense budget pools';
      detailedMessages.push(
        isAr
          ? 'التحويلات بين الحسابات العامة لا تُحسب كمصروف.'
          : 'Transfers between public accounts never reduce your spending pools.'
      );
    }
    if (fee > 0) {
      detailedMessages.push(
        isAr
          ? `تنبيه: رسوم التحويل (${fmt(fee, curr)}) يتم خصمها كمصروف من حوض الميزانية المختار.`
          : `Note: The ${fmt(fee, curr)} transfer fee is deducted as an expense from your selected pool.`
      );
    }
    recommendation =
      recommendation ||
      (isAr
        ? `مسموحك اليومي بعد العملية: ${fmtShort(dailyAfter, curr)} / يوم.`
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
            ? `مصروف One-Off مغطى برصيد الطوارئ وميزانية الـ One-Off`
            : `مصروف One-Off ضمن المخصص المحدد له بدون ضغط على اليومي`
          : `One-Off expense covered within its reserve — Daily allowance protected`;
      } else if (fundingSrc === 'savings') {
        severity = evalAfter.pools.daily.remaining < 0 ? 'danger' : 'warning';
        headline = isAr
          ? `مصروف One-Off سيخصم ${fmtShort(uncoveredDelta, curr)} من وسادة التحويش`
          : `One-Off expense draws ${fmtShort(uncoveredDelta, curr)} from Savings cushion`;
      } else if (fundingSrc === 'outings') {
        severity = dailyDelta < 0 ? 'warning' : 'caution';
        headline = isAr
          ? dailyDelta < 0
            ? `تجاوز One-Off والخروجات وهيقلل اليومي لـ ${fmtShort(dailyAfter, curr)}/يوم`
            : `مصروف One-Off هيتم استيعابه من فائض الخروجات`
          : dailyDelta < 0
          ? `One-Off exceeds Outings and trims Daily to ${fmtShort(dailyAfter, curr)}/day`
          : `One-Off absorbed by remaining Outings balance`;
      } else {
        severity = evalAfter.pools.daily.remaining <= 0 ? 'danger' : 'warning';
        headline = isAr
          ? `مصروف One-Off هينزل مصروفك اليومي من ${fmtShort(dailyBefore, curr)} إلى ${fmtShort(dailyAfter, curr)}`
          : `One-Off adjusts Daily allowance from ${fmtShort(dailyBefore, curr)} to ${fmtShort(dailyAfter, curr)}/day`;
      }

      detailedMessages.push(
        isAr
          ? `هذا المصروف (${fmtShort(effectiveAmount, curr)}) يساوي ${equivalentDailyDays} يوم من مصروفك اليومي المخطط، ومصدر التغطية الفائض مضبوط على "${srcLabel}".`
          : `This ${fmtShort(effectiveAmount, curr)} One-Off equals ${equivalentDailyDays} planned spending days; uncovered excess routes to ${srcLabel}.`
      );
      if (evalAfter.pools.savings.absorbedOneOff > evalBefore.pools.savings.absorbedOneOff) {
        detailedMessages.push(
          isAr
            ? `تأثير التحويش: متبقي التحويش اتأثر وأصبح التقدم ${evalAfter.pools.savings.progressPercent}%.`
            : `Savings impact: Savings cushion drops and goal completion adjusts to ${evalAfter.pools.savings.progressPercent}%.`
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
          ? `داخل ميزانية ${poolLabel} (المتبقي بعدها ${fmtShort(poolAfter, curr)}) — اليومي آمن`
          : `Within ${poolLabel} budget (${fmtShort(poolAfter, curr)} left) — Daily unaffected`;
        detailedMessages.push(
          isAr
            ? `استهلاك ${poolLabel} هيوصل لـ ${pctUsed}% من المخصص الشهري، ومصروفك اليومي يفضل ثابت عند ${fmtShort(dailyAfter, curr)} / يوم.`
            : `${poolLabel} reaches ${pctUsed}% of its cycle budget while your Daily allowance stays steady at ${fmtShort(dailyAfter, curr)}/day.`
        );
      } else {
        severity = evalAfter.pools.daily.remaining <= 0 ? 'danger' : 'warning';
        headline = isAr
          ? `هيتجاوز ${poolLabel} بـ ${fmtShort(spilloverAmount, curr)} ويقلل اليومي إلى ${fmtShort(dailyAfter, curr)}`
          : `Exceeds ${poolLabel} by ${fmtShort(spilloverAmount, curr)} → Daily drops to ${fmtShort(dailyAfter, curr)}/day`;
        detailedMessages.push(
          isAr
            ? `الفارق (${fmtShort(spilloverAmount, curr)}) هيتوزع على باقي الـ ${remDays} أيام فيخفض المسموح اليومي بنسبة ${Math.abs(dailyDeltaPercent)}%.`
            : `The ${fmtShort(spilloverAmount, curr)} overflow spreads over ${remDays} days, lowering daily allowance by ${Math.abs(dailyDeltaPercent)}%.`
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
          ? `تحذير عجز! المصروف ده يستنفد باقي ميزانية الشهر (${fmtShort(Math.abs(poolAfter), curr)} عجز)`
          : `Deficit alert! Exhausts remaining Daily pool (${fmtShort(Math.abs(poolAfter), curr)} short)`;
      } else if (overToday > 0 || dailyDeltaPercent <= -15) {
        severity = 'warning';
        headline = isAr
          ? `تجاوزت مسموح النهارده بـ ${fmtShort(overToday, curr)} — الأيام الجاية هتبقى ${fmtShort(dailyAfter, curr)}/يوم`
          : `Over today by ${fmtShort(overToday, curr)} → upcoming days become ${fmtShort(dailyAfter, curr)}/day`;
      } else if (todayRemAfter < evalBefore.dailyStatus.todayAllowance * 0.25) {
        severity = 'caution';
        headline = isAr
          ? `هيسيبلك ${fmtShort(Math.max(0, todayRemAfter), curr)} بس لباقي اليوم`
          : `Leaves only ${fmtShort(Math.max(0, todayRemAfter), curr)} for the rest of today`;
      } else {
        severity = 'safe';
        headline = isAr
          ? `في الأمان! باقي لك اليوم ${fmtShort(todayRemAfter, curr)} والأيام الجاية ${fmtShort(dailyAfter, curr)}/يوم`
          : `Safely on track! ${fmtShort(todayRemAfter, curr)} left today · ${fmtShort(dailyAfter, curr)}/day next`;
      }

      detailedMessages.push(
        isAr
          ? `المبلغ يساوي ${equivalentDailyDays} يوم صرف من خطتك اليومية، ومتوقع تخلص الدورة ${projectedCycleEndBalance >= 0 ? `بفائض ${fmtShort(projectedCycleEndBalance, curr)}` : `بعجز ${fmtShort(Math.abs(projectedCycleEndBalance), curr)}`}.`
          : `Equals ${equivalentDailyDays} planned spending days; projected cycle end: ${projectedCycleEndBalance >= 0 ? `+${fmtShort(projectedCycleEndBalance, curr)} surplus` : `-${fmtShort(Math.abs(projectedCycleEndBalance), curr)} deficit`}.`
      );
    }

    // Daily Average Spike Warning
    if (exceedsAvgAlert) {
      detailedMessages.push(
        isAr
          ? `⚡ تنبيه مقارنة: المبلغ ده أعلى بـ ${exceedsAvgRatio}× من متوسط صرفك اليومي في هذه الدورة (${fmtShort(averageDailySpendInCycle, curr)}/يوم).`
          : `⚡ Spend spike alert: ${exceedsAvgRatio}× higher than your cycle daily average (${fmtShort(averageDailySpendInCycle, curr)}/day).`
      );
    }

    // Cycle Phase + Runway Contextual Insight
    if (runwayAfter.zeroDate && evalAfter.pools.daily.remaining > 0) {
      detailedMessages.push(
        isAr
          ? `📅 بمعدل الصرف الحالي، الميزانية هتكفي لحد يوم ${runwayAfter.zeroDate} (${runwayAfter.runwayDays} يوم من ${remDays} متبقية).`
          : `📅 At current burn rate, budget lasts until ${runwayAfter.zeroDate} (${runwayAfter.runwayDays} of ${remDays} days left).`
      );
    } else if (cyclePhase === 'early' && severity !== 'safe') {
      detailedMessages.push(
        isAr
          ? '💡 إحنا لسه في أول الشهر، فأي ضغط دلوقتي لسه قدامه وقت طويل يتعوض بهدوء.'
          : '💡 Since it is early in the cycle, you have plenty of days to smooth this out.'
      );
    } else if (cyclePhase === 'late' && severity === 'safe') {
      detailedMessages.push(
        isAr
          ? '🎯 أداء ممتاز في آخر الشهر — محافظ على التوازن بدون ضغط على التحويش.'
          : '🎯 Strong finish near cycle end — staying balanced without touching savings.'
      );
    }

    if (draft.isRecurring) {
      detailedMessages.push(
        isAr
          ? '🔁 لأنها معاملة متكررة، يفضل إضافتها داخل حوض الفواتير والالتزامات لو لسه مش متسجلة فيه.'
          : '🔁 Because this is recurring, consider keeping it under Bills & Fixed so future cycles plan for it.'
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
        ? `نصيحة عملية: ممكن تخفف الضغط إما بتحويل جزء للـ One-Off من التحويش، أو توفير ${fmtShort(dailyRecoveryNeeded, curr)}/يوم، أو فتح إعادة التوازن.`
        : `Actionable tip: Trim ${fmtShort(dailyRecoveryNeeded, curr)}/day, cover via Outings/Savings cushion, or run Rebalance.`;
    } else if (severity === 'warning') {
      recommendation = isAr
        ? `تقدر تعوض الفارق بسهولة لو قللت صرفك اليومي حوالي ${fmtShort(Math.max(1, dailyRecoveryNeeded), curr)} بس في كل يوم من الـ ${remDays} أيام الجاية.`
        : `To stay on your original track, aim to spend about ${fmtShort(Math.max(1, dailyRecoveryNeeded), curr)} less per day over the next ${remDays} days.`;
    } else {
      recommendation = isAr
        ? `الوضع مستقر: مسموحك للأيام الجاية ${fmtShort(dailyAfter, curr)}/يوم.${evalAfter.pools.outings.remaining > 0 ? ` وعندك كمان ${fmtShort(evalAfter.pools.outings.remaining, curr)} في الخروجات.` : ''}`
        : `All steady at ${fmtShort(dailyAfter, curr)}/day ahead.${evalAfter.pools.outings.remaining > 0 ? ` Outings still has ${fmtShort(evalAfter.pools.outings.remaining, curr)}.` : ''}`;
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
        exceedsAvgAlert,
        exceedsAvgRatio,
        remainingDaysInCycle: remDays,
        projectedRunwayDays: runwayAfter.runwayDays,
        projectedZeroDate: runwayAfter.zeroDate,
        projectedCycleEndBalance,
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
      exceedsAvgAlert,
      exceedsAvgRatio,
      remainingDaysInCycle: remDays,
      projectedRunwayDays: runwayAfter.runwayDays,
      projectedZeroDate: runwayAfter.zeroDate,
      projectedCycleEndBalance,
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
    mode: 'single_expense' | 'multi_day_expense' | 'extra_income';
    amount: number;
    daysCount?: number;
    pool: 'daily' | 'outings' | 'fixed' | 'oneoff';
  },
  evaluation: SmartBudgetEvaluation,
  transactions: Transaction[],
  accounts: Account[],
  config: SmartBudgetConfig,
  lang: 'en' | 'ar' = 'ar',
  asOf: Date = new Date()
): WhatIfSimulationReport {
  const isAr = lang === 'ar';
  const curr = evaluation.baseCurrency || 'EGP';
  const remDays = Math.max(1, evaluation.dailyStatus.remainingDaysInCycle);
  const isLastDay = remDays <= 1;
  const daysCount =
    params.mode === 'multi_day_expense'
      ? Math.min(remDays, Math.max(1, Math.round(params.daysCount || 3)))
      : 1;
  const perDayAmount = Math.max(0, Number(params.amount) || 0);
  const totalAmount = Math.round(perDayAmount * daysCount * 100) / 100;

  const allowanceBefore = isLastDay
    ? Math.max(0, evaluation.dailyStatus.todayRemaining)
    : evaluation.dailyStatus.upcomingDailyAllowance;

  const elapsedDays = Math.max(1, evaluation.dailyStatus.cycleDayIndex);
  const burnRateBefore =
    Math.round(
      ((evaluation.pools.daily.trackedSpent + evaluation.pools.outings.trackedSpent) / elapsedDays) * 100
    ) / 100;

  const runwayBefore = computeRunway(
    evaluation.pools.daily.remaining + Math.max(0, evaluation.pools.outings.remaining),
    Math.max(burnRateBefore, allowanceBefore || 1),
    remDays,
    asOf
  );

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
      : Math.round(
          ((simEval.pools.daily.trackedSpent + simEval.pools.outings.trackedSpent) / elapsedDays) * 100
        ) / 100;

  const runwayAfter = computeRunway(
    simEval.pools.daily.remaining + Math.max(0, simEval.pools.outings.remaining),
    Math.max(burnRateAfter, allowanceAfter || 1),
    remDays,
    asOf
  );

  const projectedCycleEndBalance =
    Math.round(
      (simEval.pools.daily.remaining -
        Math.max(burnRateBefore, allowanceAfter) * Math.max(0, remDays - 1)) *
        100
    ) / 100;

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
              ? 'يغطيه حوض الخروجات بدون لمس اليومي'
              : 'Absorbed cleanly inside Outings'
            : p === 'oneoff' && savImpact > 0
            ? isAr
              ? `يخصم ${fmtShort(savImpact, curr)} من وسادة التحويش`
              : `Uses ${fmtShort(savImpact, curr)} from Savings`
            : pDelta === 0
            ? isAr
              ? 'بدون تأثير على اليومي'
              : 'Zero daily allowance drop'
            : isAr
            ? `يغيّر اليومي بـ ${fmtShort(pDelta, curr)}`
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
    headline = isAr ? 'أدخل مبلغاً لمعاينة التأثير المستقبلي الكامل' : 'Enter an amount to preview full future impact';
    recommendation = isAr
      ? 'تقدر تجرب مصروف مرة واحدة، مصروف متكرر لعدة أيام، أو دخل إضافي وتقارن النتيجة على كل الأحواض.'
      : 'Simulate a single spend, multi-day streak, or extra income and compare across pools.';
  } else if (params.mode === 'extra_income') {
    severity = 'positive';
    headline = isAr
      ? `إضافة ${fmtShort(totalAmount, curr)} بترفع مصروفك اليومي بـ +${fmtShort(Math.max(0, dailyDelta), curr)}/يوم (+${dailyDeltaPercent}%)`
      : `Adding ${fmtShort(totalAmount, curr)} raises Daily Allowance by +${fmtShort(Math.max(0, dailyDelta), curr)}/day`;
    detailedMessages.push(
      isAr
        ? `المصروف اليومي للأيام المتبقية (${remDays} يوم) ينتقل من ${fmtShort(allowanceBefore, curr)} إلى ${fmtShort(allowanceAfter, curr)}.`
        : `Daily allowance for the next ${remDays} days rises from ${fmtShort(allowanceBefore, curr)} to ${fmtShort(allowanceAfter, curr)}.`
    );
    detailedMessages.push(
      isAr
        ? `صافي نهاية الدورة المتوقع يتحسن ليصبح ${projectedCycleEndBalance >= 0 ? `فائض +${fmtShort(projectedCycleEndBalance, curr)}` : `عجز ${fmtShort(projectedCycleEndBalance, curr)}`}.`
        : `Projected cycle finish improves to ${projectedCycleEndBalance >= 0 ? `+${fmtShort(projectedCycleEndBalance, curr)} surplus` : fmtShort(projectedCycleEndBalance, curr)}.`
    );
    recommendation = isAr
      ? `خيار ذكي: تقدر تزود هدف التحويش أو تغطي أي عجز في البنود التانية من هذه الزيادة.`
      : `Smart move: allocate part of this boost to accelerate your Savings goal.`;
  } else {
    const modePrefix =
      params.mode === 'multi_day_expense'
        ? isAr
          ? `صرف ${fmtShort(perDayAmount, curr)} لمدة ${daysCount} أيام (إجمالي ${fmtShort(totalAmount, curr)}): `
          : `${daysCount} days at ${fmtShort(perDayAmount, curr)}/day (total ${fmtShort(totalAmount, curr)}): `
        : '';

    if (simEval.pools.daily.remaining <= 0 || simEval.dailyStatus.allowanceState === 'true_deficit') {
      severity = 'danger';
      headline = isAr
        ? `${modePrefix}يدخل الميزانية في عجز (${fmtShort(Math.abs(simEval.pools.daily.remaining), curr)})`
        : `${modePrefix}triggers a budget deficit (${fmtShort(Math.abs(simEval.pools.daily.remaining), curr)})`;
    } else if (dailyDelta < 0 || poolAfter < 0) {
      severity = Math.abs(dailyDeltaPercent) >= 20 ? 'warning' : 'caution';
      headline = isAr
        ? `${modePrefix}يخفض المسموح اليومي إلى ${fmtShort(allowanceAfter, curr)}/يوم (${dailyDeltaPercent}%)`
        : `${modePrefix}lowers Daily Allowance to ${fmtShort(allowanceAfter, curr)}/day (${dailyDeltaPercent}%)`;
    } else {
      severity = 'safe';
      headline = isAr
        ? `${modePrefix}آمن بالكامل — مسموحك اليومي يظل ${fmtShort(allowanceAfter, curr)}/يوم`
        : `${modePrefix}completely safe — Daily stays ${fmtShort(allowanceAfter, curr)}/day`;
    }

    detailedMessages.push(
      isAr
        ? `معدل الحرق اليومي: ${fmtShort(burnRateBefore, curr)} ← ${fmtShort(burnRateAfter, curr)} / يوم.`
        : `Daily burn rate shifts: ${fmtShort(burnRateBefore, curr)} → ${fmtShort(burnRateAfter, curr)} / day.`
    );
    if (runwayAfter.zeroDate) {
      detailedMessages.push(
        isAr
          ? `تاريخ النفاد المتوقع لو استمر نفس المعدل: ${runwayAfter.zeroDate} (يتبقى ${runwayAfter.runwayDays} يوم من ${remDays}).`
          : `Estimated zero date at this pace: ${runwayAfter.zeroDate} (${runwayAfter.runwayDays} of ${remDays} days).`
      );
    } else {
      detailedMessages.push(
        isAr
          ? `الرصيد يكفي حتى نهاية الدورة يوم ${evaluation.cycle.endDate} بصافي متوقع ${projectedCycleEndBalance >= 0 ? `+${fmtShort(projectedCycleEndBalance, curr)}` : fmtShort(projectedCycleEndBalance, curr)}.`
          : `Covers full cycle through ${evaluation.cycle.endDate} (projected end balance: ${fmtShort(projectedCycleEndBalance, curr)}).`
      );
    }

    const bestOption = poolComparison.find((p) => p.isOptimal);
    recommendation = bestOption
      ? isAr
        ? `أفضل خيار لتسجيل المبلغ: "${bestOption.label}" (${bestOption.note}).${dailyRecoveryNeeded > 0 ? ` خطة التعويض: توفير ${fmtShort(dailyRecoveryNeeded, curr)}/يوم.` : ''}`
        : `Best pool choice: "${bestOption.label}" (${bestOption.note}).${dailyRecoveryNeeded > 0 ? ` Recovery plan: trim ${fmtShort(dailyRecoveryNeeded, curr)}/day.` : ''}`
      : isAr
      ? 'الوضع متزن وتقدر تنفذ القرار بأمان.'
      : 'Balanced outlook — safe to proceed.';
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
    poolComparison,
  };
}
