/**
 * Smart Budget Hub Modal - Unified Vertical View
 *
 * Single scrollable vertical interface for the 4-Pool Smart Budget engine:
 * 1. Global Settings & Funding:
 *    - Pause Smart Budget for this month toggle
 *    - Calculation Mode ("From Today" vs "Full Cycle")
 *    - Linked Funding Accounts (with Live Budget total, Non-Savings Only / All Accounts role filters)
 *    - Extra outside cash (Adjustment) input
 * 2. Daily Allowance Tracker (The Dashboard):
 *    - The ALLOWED TODAY card (Allowed, Spent, Remaining for today, status pill, progress bar)
 * 3. Budget Pool Allocations & Progress:
 *    - 4 Combined Cards: Savings, Bills & Fixed, Outings, Daily Spending
 *    - Allows user to input the EXACT absolute target amount (EGP), and immediately below displays
 *      the real-time remaining balance, spent amount, and cycle progress bar.
 *    - Percentages remain as read-only labels.
 *    - Daily Spending remains the absolute calculated remainder: Live Budget - (Savings + Bills + Outings).
 * 4. Bills & Fixed Categories Setup:
 *    - Multi-select category chips automatically counted under Bills & Fixed.
 * 5. Tools & Alerts:
 *    - What-If Expense Simulator (100% local, deterministic math)
 *    - Rebalance Options (shown only if there is a deficit)
 *    - Heads-up Alert Threshold slider
 * 6. Sticky Action Footer:
 *    - Master sticky "Apply & Save Changes" button with quick reset to defaults.
 *
 * Accessibility & Responsiveness:
 * - Safe at 320px width, dark mode native, RTL compliant.
 * - Touch targets >= 44px on all interactive elements.
 * - 100% local deterministic math with zero experimental AI dependencies.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Calendar,
  Sliders,
  Shield,
  AlertCircle,
  CheckCircle2,
  Wallet,
  PiggyBank,
  Coffee,
  ShoppingBag,
  RotateCcw,
  Zap,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  RefreshCw,
  Plus,
  Minus,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { resolveMessageLanguage } from '../utils/constants';
import { formatNumberWithCommas } from '../utils/formatters';
import {
  evaluateSmartBudget,
  resolveCycleOverride,
  SmartBudgetConfig,
  SmartBudgetEvaluation,
  normalizeCurrencyCodeOrSymbol,
  formatLocalDate,
  isSpendingOrCustomiseRole,
  isSavingsOrInvestmentRole,
} from '../utils/smartBudgetEngine';
import { simulateWhatIfScenario, type WhatIfSimulationReport } from '../utils/budgetImpactAnalyzer';
import {
  OneOffFundingSource,
  SmartBudgetBaselineConfig,
  SmartBudgetCycleOverride,
  SmartBudgetCycleStartMode,
  SmartBudgetPoolKey,
} from '../types';

interface PoolItemState {
  minorUnits: number;
  percent: number;
  mode: 'percent' | 'amount';
  amountText: string;
}

interface PoolsState {
  savings: PoolItemState;
  fixed: PoolItemState;
  outings: PoolItemState;
  oneoff: PoolItemState;
}

const initPoolsFromSettings = (
  baseline: SmartBudgetBaselineConfig | undefined,
  incomeMajor: number
): PoolsState => {
  const incomeMinor = Math.round(incomeMajor * 100);
  const cfg = baseline?.poolsConfig;

  let sMinor = 0;
  if (cfg?.savings?.minorUnits != null) {
    sMinor = Math.max(0, cfg.savings.minorUnits);
  } else if (baseline?.savings) {
    if (baseline.savings.type === 'fixed') {
      sMinor = Math.max(0, Math.round(baseline.savings.value * 100));
    } else if (baseline.savings.type === 'percent' && incomeMinor > 0) {
      sMinor = Math.max(0, Math.round(incomeMinor * (baseline.savings.value / 100)));
    }
  } else if (incomeMinor > 0) {
    sMinor = Math.round(incomeMinor * 0.2);
  }

  let fMinor = 0;
  if (cfg?.fixed?.minorUnits != null) {
    fMinor = Math.max(0, cfg.fixed.minorUnits);
  } else if (typeof baseline?.plannedFixedObligations === 'number') {
    fMinor = Math.max(0, Math.round(baseline.plannedFixedObligations * 100));
  } else if (incomeMinor > 0) {
    fMinor = Math.round(incomeMinor * 0.4);
  }

  let oMinor = 0;
  if (cfg?.outings?.minorUnits != null) {
    oMinor = Math.max(0, cfg.outings.minorUnits);
  } else if (typeof baseline?.outingsBudget === 'number') {
    oMinor = Math.max(0, Math.round(baseline.outingsBudget * 100));
  } else if (incomeMinor > 0) {
    oMinor = Math.round(incomeMinor * 0.15);
  }

  let ooMinor = 0;
  if (cfg?.oneoff?.minorUnits != null) {
    ooMinor = Math.max(0, cfg.oneoff.minorUnits);
  } else if (typeof baseline?.oneOffBudget === 'number') {
    ooMinor = Math.max(0, Math.round(baseline.oneOffBudget * 100));
  }

  if (incomeMinor > 0 && sMinor + fMinor + oMinor + ooMinor > incomeMinor) {
    const excess = sMinor + fMinor + oMinor + ooMinor - incomeMinor;
    if (ooMinor >= excess) {
      ooMinor -= excess;
    } else {
      let rem = excess - ooMinor;
      ooMinor = 0;
      if (oMinor >= rem) {
        oMinor -= rem;
      } else {
        rem = rem - oMinor;
        oMinor = 0;
        fMinor = Math.max(0, fMinor - rem);
      }
    }
  }

  const sFinalPct =
    incomeMinor > 0 ? Math.round(((sMinor / incomeMinor) * 100) * 10) / 10 : 0;
  const fFinalPct =
    incomeMinor > 0 ? Math.round(((fMinor / incomeMinor) * 100) * 10) / 10 : 0;
  const oFinalPct =
    incomeMinor > 0 ? Math.round(((oMinor / incomeMinor) * 100) * 10) / 10 : 0;
  const ooFinalPct =
    incomeMinor > 0 ? Math.round(((ooMinor / incomeMinor) * 100) * 10) / 10 : 0;

  return {
    savings: {
      minorUnits: sMinor,
      percent: sFinalPct,
      mode: 'amount',
      amountText: formatNumberWithCommas(sMinor / 100, 2),
    },
    fixed: {
      minorUnits: fMinor,
      percent: fFinalPct,
      mode: 'amount',
      amountText: formatNumberWithCommas(fMinor / 100, 2),
    },
    outings: {
      minorUnits: oMinor,
      percent: oFinalPct,
      mode: 'amount',
      amountText: formatNumberWithCommas(oMinor / 100, 2),
    },
    oneoff: {
      minorUnits: ooMinor,
      percent: ooFinalPct,
      mode: 'amount',
      amountText: ooMinor > 0 ? formatNumberWithCommas(ooMinor / 100, 2) : '',
    },
  };
};

interface SmartBudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SmartBudgetModal: React.FC<SmartBudgetModalProps> = ({ isOpen, onClose }) => {
  const {
    settings,
    updateSettings,
    transactions,
    accounts,
    categories,
    recurringTransactions,
    showToast,
    openTxDetailsModal,
    t,
    activePoolDrillDown,
    setActivePoolDrillDown,
    updateManualPoolProgress,
  } = useApp();

  const isArabic = settings.language === 'ar';
  const resolvedMsgLang = resolveMessageLanguage(settings);
  const isMsgArabic = resolvedMsgLang === 'ar_eg';
  const currency = settings.currencySymbol || 'EGP';
  const formatCurrency = (amount: number, curr = currency) =>
    `${formatNumberWithCommas(amount, 2)} ${curr}`;

  const inspectPoolKey = activePoolDrillDown;
  const setInspectPoolKey = setActivePoolDrillDown;

  // Collapsible Cycle & Funding Settings Card (Collapsed by default)
  const [isCycleSettingsOpen, setIsCycleSettingsOpen] = useState<boolean>(false);

  // Manual (+/-) per-pool progress editing state (isolated from Daily Spending)
  const [manualEditPool, setManualEditPool] = useState<SmartBudgetPoolKey | null>(null);
  const [manualAmountInput, setManualAmountInput] = useState<string>('');

  // ==========================================================================
  // WHAT-IF SIMULATOR STATE (3 Modes)
  // ==========================================================================
  const [whatIfMode, setWhatIfMode] = useState<'single_expense' | 'multi_day_expense' | 'extra_income'>('single_expense');
  const [whatIfDaysCount, setWhatIfDaysCount] = useState<number>(3);
  const [whatIfAmount, setWhatIfAmount] = useState<string>('');
  const [whatIfPool, setWhatIfPool] = useState<'daily' | 'outings' | 'fixed' | 'oneoff'>('outings');

  // ==========================================================================
  // CONFIGURATION STATE
  // ==========================================================================
  const baselineSettings = settings.smartBudget?.baseline || {};
  const globalMonthStartDay = Math.min(31, Math.max(1, Math.floor(settings.defaultMonthStartDay || 1)));
  const [plannedIncomeInput, setPlannedIncomeInput] = useState<string>(() =>
    baselineSettings.plannedIncome ? formatNumberWithCommas(baselineSettings.plannedIncome, 2) : ''
  );
  const [pools, setPools] = useState<PoolsState>(() =>
    initPoolsFromSettings(baselineSettings, baselineSettings.plannedIncome || 0)
  );
  const [oneOffFundingSource, setOneOffFundingSource] = useState<OneOffFundingSource>(
    () => baselineSettings.oneOffFundingSource || 'daily'
  );
  const [poolHints, setPoolHints] = useState<{
    savings: string | null;
    fixed: string | null;
    outings: string | null;
    oneoff: string | null;
  }>({ savings: null, fixed: null, outings: null, oneoff: null });

  const [headsUpThresholdPercent, setHeadsUpThresholdPercent] = useState<number>(() =>
    Math.round(((baselineSettings.headsUpThresholdRatio ?? 0.7) * 100))
  );
  const [selectedFixedCatIds, setSelectedFixedCatIds] = useState<string[]>(
    baselineSettings.fixedCategoryIds || []
  );

  const [cycleStartMode, setCycleStartMode] = useState<SmartBudgetCycleStartMode>(() => {
    if (baselineSettings.cycleStartMode) return baselineSettings.cycleStartMode;
    if (baselineSettings.calculationMode === 'from_today') return 'from_today';
    return 'app_default';
  });

  const [customStartDay, setCustomStartDay] = useState<number>(() => {
    return baselineSettings.customStartDay || 1;
  });

  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    return baselineSettings.customStartDate || formatLocalDate(new Date());
  });

  const baselineCalculationMode: 'from_today' | 'full_cycle' =
    cycleStartMode === 'from_today' ? 'from_today' : 'full_cycle';

  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(() => {
    if (baselineSettings.includedAccountIds && baselineSettings.includedAccountIds.length > 0) {
      return baselineSettings.includedAccountIds;
    }
    if (
      baselineSettings.fromTodayConfig?.linkedAccountIds &&
      baselineSettings.fromTodayConfig.linkedAccountIds.length > 0
    ) {
      return baselineSettings.fromTodayConfig.linkedAccountIds;
    }
    const spendingAccounts = accounts.filter(
      (a) => !a.isPrivate && isSpendingOrCustomiseRole(a.accountRole)
    );
    return spendingAccounts.length > 0
      ? spendingAccounts.map((a) => a.id)
      : accounts.filter((a) => !a.isPrivate).map((a) => a.id);
  });

  const [isLinkedAccountsOpen, setIsLinkedAccountsOpen] = useState<boolean>(true);
  const [adjustmentInput, setAdjustmentInput] = useState<string>(() => {
    const adj = baselineSettings.fromTodayConfig?.manualAdjustment;
    return adj != null && adj !== 0 ? String(adj) : '';
  });

  const parsedAdjustment = useMemo(() => {
    const cleaned = adjustmentInput.replace(/[^0-9.-]/g, '');
    return parseFloat(cleaned) || 0;
  }, [adjustmentInput]);

  const linkedAccountsBalanceSum = useMemo(() => {
    return accounts
      .filter(
        (a) =>
          selectedAccountIds.includes(a.id) &&
          (!a.currency ||
            normalizeCurrencyCodeOrSymbol(a.currency) ===
              normalizeCurrencyCodeOrSymbol(currency))
      )
      .reduce((sum, a) => sum + (a.balance || 0), 0);
  }, [accounts, selectedAccountIds, currency]);

  const activeIncludePrivateAccounts = useMemo(
    () => accounts.some((a) => selectedAccountIds.includes(a.id) && a.isPrivate),
    [accounts, selectedAccountIds]
  );

  const liveBudget = useMemo(() => {
    return Math.max(0, Math.round((linkedAccountsBalanceSum + parsedAdjustment) * 100) / 100);
  }, [linkedAccountsBalanceSum, parsedAdjustment]);

  const [weekendMultiplier] = useState<number>(1.5);

  // Synchronize state when baseline settings change externally
  useEffect(() => {
    if (baselineSettings) {
      if (baselineSettings.fixedCategoryIds) {
        setSelectedFixedCatIds(baselineSettings.fixedCategoryIds);
      }
      if (baselineSettings.includedAccountIds) {
        setSelectedAccountIds(baselineSettings.includedAccountIds);
      }
      if (baselineSettings.oneOffFundingSource) {
        setOneOffFundingSource(baselineSettings.oneOffFundingSource);
      }
      if (baselineSettings.cycleStartMode) {
        setCycleStartMode(baselineSettings.cycleStartMode);
      } else if (baselineSettings.calculationMode) {
        setCycleStartMode(baselineSettings.calculationMode === 'from_today' ? 'from_today' : 'app_default');
      }
      if (baselineSettings.customStartDay) {
        setCustomStartDay(baselineSettings.customStartDay);
      }
      if (baselineSettings.customStartDate) {
        setCustomStartDate(baselineSettings.customStartDate);
      }
      if (typeof baselineSettings.headsUpThresholdRatio === 'number') {
        setHeadsUpThresholdPercent(Math.round(baselineSettings.headsUpThresholdRatio * 100));
      }
    }
  }, [settings.smartBudget?.baseline]);

  // Derived income minor units & daily remainder
  const incomeMinor =
    baselineCalculationMode === 'from_today'
      ? Math.round(liveBudget * 100)
      : Math.round((parseFloat(plannedIncomeInput.replace(/,/g, '')) || 0) * 100);

  const dailyMinor = Math.max(
    0,
    incomeMinor -
      (pools.savings.minorUnits +
        pools.fixed.minorUnits +
        pools.outings.minorUnits +
        pools.oneoff.minorUnits)
  );
  const dailyPercent =
    incomeMinor > 0
      ? Math.max(0, Math.round(((dailyMinor / incomeMinor) * 100) * 10) / 10)
      : Math.max(
          0,
          Math.round(
            (100 -
              (pools.savings.percent +
                pools.fixed.percent +
                pools.outings.percent +
                pools.oneoff.percent)) *
              10
          ) / 10
        );

  // Monthly recurring expenses detection
  const detectedRecurringBills = useMemo(() => {
    if (!recurringTransactions || recurringTransactions.length === 0) return 0;
    return recurringTransactions
      .filter((r) => r.type === 'expense')
      .reduce((sum, r) => {
        let monthly = r.amount || 0;
        if (r.frequency === 'daily') monthly = r.amount * 30;
        else if (r.frequency === 'weekly') monthly = r.amount * 4.33;
        else if (r.frequency === 'biweekly') monthly = r.amount * 2.167;
        else if (r.frequency === 'yearly') monthly = r.amount / 12;
        return sum + monthly;
      }, 0);
  }, [recurringTransactions]);

  // ==========================================================================
  // EVALUATION & CURRENT CYCLE KEY
  // ==========================================================================
  const effectiveBudgetConfig: SmartBudgetConfig = useMemo(() => {
    const draftPlanned = parseFloat(plannedIncomeInput.replace(/,/g, '')) || 0;
    const effectiveIncome =
      baselineCalculationMode === 'from_today'
        ? liveBudget
        : draftPlanned || baselineSettings.plannedIncome || 0;

    const sMinor = pools.savings.minorUnits;
    const fMinor = pools.fixed.minorUnits;
    const oMinor = pools.outings.minorUnits;
    const ooMinor = pools.oneoff.minorUnits;
    const sPct = incomeMinor > 0 ? Math.round(((sMinor / incomeMinor) * 100) * 10) / 10 : 0;
    const fPct = incomeMinor > 0 ? Math.round(((fMinor / incomeMinor) * 100) * 10) / 10 : 0;
    const oPct = incomeMinor > 0 ? Math.round(((oMinor / incomeMinor) * 100) * 10) / 10 : 0;
    const ooPct = incomeMinor > 0 ? Math.round(((ooMinor / incomeMinor) * 100) * 10) / 10 : 0;

    return {
      baseCurrency: currency,
      startDay: globalMonthStartDay,
      cycleStartMode,
      customStartDay: cycleStartMode === 'custom' ? customStartDay : undefined,
      customStartDate: cycleStartMode === 'custom' ? customStartDate : undefined,
      plannedIncome: effectiveIncome > 0 ? effectiveIncome : undefined,
      savings: { type: 'fixed', value: sMinor / 100 },
      plannedFixedObligations: fMinor / 100,
      outingsBudget: oMinor / 100,
      oneOffBudget: ooMinor / 100,
      oneOffFundingSource,
      fixedCategoryIds: selectedFixedCatIds,
      includedAccountIds: selectedAccountIds,
      includePrivateAccounts: activeIncludePrivateAccounts,
      calculationMode: baselineCalculationMode,
      fromTodayConfig: {
        fromDate: baselineSettings.fromTodayConfig?.fromDate || formatLocalDate(new Date()),
        linkedAccountIds: selectedAccountIds,
        manualAdjustment: parsedAdjustment,
      },
      headsUpThresholdRatio:
        baselineSettings.headsUpThresholdRatio ?? headsUpThresholdPercent / 100,
      poolsConfig: {
        savings: { minorUnits: sMinor, percent: sPct, mode: 'amount' },
        fixed: { minorUnits: fMinor, percent: fPct, mode: 'amount' },
        outings: { minorUnits: oMinor, percent: oPct, mode: 'amount' },
        oneoff: { minorUnits: ooMinor, percent: ooPct, mode: 'amount' },
      },
      overrides: settings.smartBudget?.overrides,
      adjustments: settings.smartBudget?.adjustments,
      weekdayWeights:
        weekendMultiplier !== 1.0
          ? { 4: weekendMultiplier, 5: weekendMultiplier }
          : undefined,
    };
  }, [
    currency,
    globalMonthStartDay,
    cycleStartMode,
    customStartDay,
    customStartDate,
    baselineSettings.plannedIncome,
    baselineSettings.headsUpThresholdRatio,
    baselineSettings.fromTodayConfig?.fromDate,
    plannedIncomeInput,
    baselineCalculationMode,
    liveBudget,
    incomeMinor,
    pools.savings.minorUnits,
    pools.fixed.minorUnits,
    pools.outings.minorUnits,
    pools.oneoff.minorUnits,
    oneOffFundingSource,
    selectedFixedCatIds,
    selectedAccountIds,
    activeIncludePrivateAccounts,
    parsedAdjustment,
    headsUpThresholdPercent,
    settings.smartBudget?.overrides,
    settings.smartBudget?.adjustments,
    weekendMultiplier,
  ]);

  const evaluation: SmartBudgetEvaluation = useMemo(
    () => evaluateSmartBudget(transactions, accounts, effectiveBudgetConfig, new Date()),
    [transactions, accounts, effectiveBudgetConfig]
  );

  // Live percentage badges computed from active evaluation totals (including dynamic public income) so they always sum to 100%
  const displayPoolPercents = useMemo(() => {
    const totalAllocMinor =
      evaluation.pools.savings.allocatedMinor +
      evaluation.pools.fixed.allocatedMinor +
      evaluation.pools.outings.allocatedMinor +
      evaluation.pools.oneoff.allocatedMinor +
      evaluation.pools.daily.allocatedMinor;
    if (totalAllocMinor <= 0) {
      return { savings: 0, fixed: 0, outings: 0, oneoff: 0, daily: 0 };
    }
    const sPct =
      Math.round((evaluation.pools.savings.allocatedMinor / totalAllocMinor) * 100 * 10) / 10;
    const fPct =
      Math.round((evaluation.pools.fixed.allocatedMinor / totalAllocMinor) * 100 * 10) / 10;
    const oPct =
      Math.round((evaluation.pools.outings.allocatedMinor / totalAllocMinor) * 100 * 10) / 10;
    const ooPct =
      Math.round((evaluation.pools.oneoff.allocatedMinor / totalAllocMinor) * 100 * 10) / 10;
    const dPct = Math.max(0, Math.round((100 - (sPct + fPct + oPct + ooPct)) * 10) / 10);
    return { savings: sPct, fixed: fPct, outings: oPct, oneoff: ooPct, daily: dPct };
  }, [
    evaluation.pools.savings.allocatedMinor,
    evaluation.pools.fixed.allocatedMinor,
    evaluation.pools.outings.allocatedMinor,
    evaluation.pools.oneoff.allocatedMinor,
    evaluation.pools.daily.allocatedMinor,
  ]);

  const unpaidObligationsTotal = useMemo(() => {
    const unpaidSavings = Math.max(
      0,
      evaluation.pools.savings.allocated -
        evaluation.pools.savings.netSaved -
        evaluation.pools.savings.absorbedOneOff
    );
    const unpaidFixed = Math.max(0, evaluation.pools.fixed.remaining);
    const unpaidOutings = Math.max(0, evaluation.pools.outings.remaining);
    const unpaidOneOff = Math.max(0, evaluation.pools.oneoff.remaining);
    return Math.round((unpaidSavings + unpaidFixed + unpaidOutings + unpaidOneOff) * 100) / 100;
  }, [
    evaluation.pools.savings.allocated,
    evaluation.pools.savings.netSaved,
    evaluation.pools.savings.absorbedOneOff,
    evaluation.pools.fixed.remaining,
    evaluation.pools.outings.remaining,
    evaluation.pools.oneoff.remaining,
  ]);

  const effectiveTotalIncomeMinor = Math.max(incomeMinor, evaluation.pools.total.incomeMinor);

  const currentCycleKey = evaluation.cycle.startDate; // YYYY-MM-DD
  const currentOverride = resolveCycleOverride(settings.smartBudget?.overrides, currentCycleKey);
  const isCyclePaused = Boolean(currentOverride?.isPaused);

  if (!isOpen) return null;

  // ==========================================================================
  // INPUT FORMATTERS & HANDLERS
  // ==========================================================================
  const formatIncomeWithCaret = (
    rawInput: string,
    inputEl: HTMLInputElement | null,
    setter: React.Dispatch<React.SetStateAction<string>>
  ): number => {
    const cursorPos = inputEl?.selectionStart ?? rawInput.length;
    const rawBeforeCursor = rawInput.slice(0, cursorPos);
    const nonCommasBeforeCursor = rawBeforeCursor.replace(/,/g, '').length;

    let cleaned = rawInput.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }

    let formattedDisplay = '';
    if (cleaned.includes('.')) {
      const [intPart, decPart] = cleaned.split('.');
      formattedDisplay =
        (intPart ? Number(intPart).toLocaleString('en-US') : '0') +
        '.' +
        (decPart || '');
    } else if (cleaned) {
      formattedDisplay = Number(cleaned).toLocaleString('en-US');
    }

    setter(formattedDisplay);

    if (inputEl) {
      requestAnimationFrame(() => {
        let newCursor = 0;
        let count = 0;
        for (let i = 0; i < formattedDisplay.length; i++) {
          if (formattedDisplay[i] !== ',') count++;
          if (count === nonCommasBeforeCursor) {
            newCursor = i + 1;
            break;
          }
        }
        if (count < nonCommasBeforeCursor) {
          newCursor = formattedDisplay.length;
        }
        inputEl.setSelectionRange(newCursor, newCursor);
      });
    }

    return parseFloat(cleaned) || 0;
  };

  const recomputePoolsForNewIncome = (prev: PoolsState, newMinor: number): PoolsState => {
    if (newMinor <= 0) {
      return {
        savings: { ...prev.savings, minorUnits: 0, percent: 0, amountText: '0' },
        fixed: { ...prev.fixed, minorUnits: 0, percent: 0, amountText: '0' },
        outings: { ...prev.outings, minorUnits: 0, percent: 0, amountText: '0' },
        oneoff: { ...prev.oneoff, minorUnits: 0, percent: 0, amountText: '' },
      };
    }

    let sMinor = prev.savings.minorUnits;
    let fMinor = prev.fixed.minorUnits;
    let oMinor = prev.outings.minorUnits;
    let ooMinor = prev.oneoff.minorUnits;

    const totalMinor = sMinor + fMinor + oMinor + ooMinor;
    if (totalMinor > newMinor) {
      let excess = totalMinor - newMinor;
      if (ooMinor >= excess) {
        ooMinor -= excess;
        excess = 0;
      } else {
        excess -= ooMinor;
        ooMinor = 0;
      }
      if (excess > 0) {
        if (oMinor >= excess) {
          oMinor -= excess;
        } else {
          const rem = excess - oMinor;
          oMinor = 0;
          fMinor = Math.max(0, fMinor - rem);
        }
      }
    }

    const sPct = Math.round(((sMinor / newMinor) * 100) * 10) / 10;
    const fPct = Math.round(((fMinor / newMinor) * 100) * 10) / 10;
    const oPct = Math.round(((oMinor / newMinor) * 100) * 10) / 10;
    const ooPct = Math.round(((ooMinor / newMinor) * 100) * 10) / 10;

    return {
      savings: {
        minorUnits: sMinor,
        percent: sPct,
        mode: 'amount',
        amountText: formatNumberWithCommas(sMinor / 100, 2),
      },
      fixed: {
        minorUnits: fMinor,
        percent: fPct,
        mode: 'amount',
        amountText: formatNumberWithCommas(fMinor / 100, 2),
      },
      outings: {
        minorUnits: oMinor,
        percent: oPct,
        mode: 'amount',
        amountText: formatNumberWithCommas(oMinor / 100, 2),
      },
      oneoff: {
        minorUnits: ooMinor,
        percent: ooPct,
        mode: 'amount',
        amountText: ooMinor > 0 ? formatNumberWithCommas(ooMinor / 100, 2) : '',
      },
    };
  };

  const handlePlannedIncomeChange = (valStr: string, inputEl?: HTMLInputElement | null) => {
    const newIncome = formatIncomeWithCaret(valStr, inputEl || null, setPlannedIncomeInput);
    const newMinor = Math.round(newIncome * 100);
    setPools((prev) => recomputePoolsForNewIncome(prev, newMinor));
  };

  const applyDualAmountChange = (
    poolKey: 'savings' | 'fixed' | 'outings' | 'oneoff',
    rawInput: string,
    inputEl: HTMLInputElement | null,
    targetIncomeMinor: number,
    currentPools: PoolsState,
    setPoolsFn: React.Dispatch<React.SetStateAction<PoolsState>>,
    setHintsFn: React.Dispatch<
      React.SetStateAction<{
        savings: string | null;
        fixed: string | null;
        outings: string | null;
        oneoff: string | null;
      }>
    >
  ) => {
    if (targetIncomeMinor <= 0) return;

    const cursorPos = inputEl?.selectionStart ?? rawInput.length;
    const rawBeforeCursor = rawInput.slice(0, cursorPos);
    const nonCommasBeforeCursor = rawBeforeCursor.replace(/,/g, '').length;

    let cleaned = rawInput.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }

    const valMajor = parseFloat(cleaned) || 0;
    let valMinor = Math.round(valMajor * 100);

    let otherMinor = 0;
    if (poolKey === 'savings')
      otherMinor = currentPools.fixed.minorUnits + currentPools.outings.minorUnits + currentPools.oneoff.minorUnits;
    if (poolKey === 'fixed')
      otherMinor = currentPools.savings.minorUnits + currentPools.outings.minorUnits + currentPools.oneoff.minorUnits;
    if (poolKey === 'outings')
      otherMinor = currentPools.savings.minorUnits + currentPools.fixed.minorUnits + currentPools.oneoff.minorUnits;
    if (poolKey === 'oneoff')
      otherMinor = currentPools.savings.minorUnits + currentPools.fixed.minorUnits + currentPools.outings.minorUnits;

    const maxMinor = Math.max(0, targetIncomeMinor - otherMinor);
    const maxPct = Math.round(((maxMinor / targetIncomeMinor) * 100) * 10) / 10;

    let hint: string | null = null;
    if (valMinor > maxMinor) {
      valMinor = maxMinor;
      hint = t('maxAllowedPoolHint')
        .replace('{amount}', formatCurrency(maxMinor / 100, currency))
        .replace('{percent}', String(maxPct));
    }

    setHintsFn((h) => ({ ...h, [poolKey]: hint }));

    const derivedPct = Math.round(((valMinor / targetIncomeMinor) * 100) * 10) / 10;

    let formattedDisplay = '';
    if (cleaned.includes('.')) {
      const [intPart, decPart] = cleaned.split('.');
      formattedDisplay =
        (intPart ? Number(intPart).toLocaleString('en-US') : '0') +
        '.' +
        (decPart || '');
    } else if (cleaned) {
      formattedDisplay = Number(cleaned).toLocaleString('en-US');
    }

    setPoolsFn((prev) => ({
      ...prev,
      [poolKey]: {
        minorUnits: valMinor,
        percent: derivedPct,
        mode: 'amount',
        amountText: formattedDisplay,
      },
    }));

    if (inputEl) {
      requestAnimationFrame(() => {
        let newCursor = 0;
        let count = 0;
        for (let i = 0; i < formattedDisplay.length; i++) {
          if (formattedDisplay[i] !== ',') count++;
          if (count === nonCommasBeforeCursor) {
            newCursor = i + 1;
            break;
          }
        }
        if (count < nonCommasBeforeCursor) {
          newCursor = formattedDisplay.length;
        }
        inputEl.setSelectionRange(newCursor, newCursor);
      });
    }
  };

  const applyDualAmountBlur = (
    poolKey: 'savings' | 'fixed' | 'outings' | 'oneoff',
    _targetIncomeMinor: number,
    setPoolsFn: React.Dispatch<React.SetStateAction<PoolsState>>
  ) => {
    setPoolsFn((prev) => {
      const minor = Math.max(0, prev[poolKey].minorUnits);
      return {
        ...prev,
        [poolKey]: {
          ...prev[poolKey],
          minorUnits: minor,
          amountText:
            poolKey === 'oneoff' && minor === 0 ? '' : formatNumberWithCommas(minor / 100, 2),
        },
      };
    });
  };

  const handleAmountChange = (
    poolKey: 'savings' | 'fixed' | 'outings' | 'oneoff',
    rawInput: string,
    inputEl: HTMLInputElement | null
  ) =>
    applyDualAmountChange(
      poolKey,
      rawInput,
      inputEl,
      effectiveTotalIncomeMinor,
      pools,
      setPools,
      setPoolHints
    );

  const handleAmountBlur = (poolKey: 'savings' | 'fixed' | 'outings' | 'oneoff') =>
    applyDualAmountBlur(poolKey, effectiveTotalIncomeMinor, setPools);

  const handleApplyCurrentOneOffSpend = () => {
    const spentVal = Math.max(0, evaluation.pools.oneoff.spent);
    if (spentVal <= 0) return;
    const spentMinor = Math.round(spentVal * 100);
    const capMinor = effectiveTotalIncomeMinor;
    if (capMinor > 0) {
      const otherMinor =
        pools.savings.minorUnits + pools.fixed.minorUnits + pools.outings.minorUnits;
      const maxMinor = Math.max(0, capMinor - otherMinor);
      const finalMinor = Math.min(spentMinor, maxMinor);
      const derivedPct = Math.round(((finalMinor / capMinor) * 100) * 10) / 10;

      if (spentMinor > maxMinor) {
        setPoolHints((h) => ({
          ...h,
          oneoff: t('maxAllowedPoolHint')
            .replace('{amount}', formatCurrency(maxMinor / 100, currency))
            .replace('{percent}', String(derivedPct)),
        }));
      } else {
        setPoolHints((h) => ({ ...h, oneoff: null }));
      }

      setPools((prev) => ({
        ...prev,
        oneoff: {
          minorUnits: finalMinor,
          percent: derivedPct,
          mode: 'amount',
          amountText: formatNumberWithCommas(finalMinor / 100, 2),
        },
      }));
    } else {
      setPools((prev) => ({
        ...prev,
        oneoff: {
          minorUnits: spentMinor,
          percent: 0,
          mode: 'amount',
          amountText: formatNumberWithCommas(spentMinor / 100, 2),
        },
      }));
    }
    showToast(
      isArabic ? 'تم تخصيص ميزانية المصاريف الاستثنائية' : 'One-Off allocation updated',
      'success'
    );
  };

  const handleApplyDetectedRecurringBills = () => {
    if (detectedRecurringBills <= 0) return;
    const detectedMinor = Math.round(detectedRecurringBills * 100);

    if (effectiveTotalIncomeMinor > 0) {
      const otherMinor =
        pools.savings.minorUnits + pools.outings.minorUnits + pools.oneoff.minorUnits;
      const maxMinor = Math.max(0, effectiveTotalIncomeMinor - otherMinor);
      const finalMinor = Math.min(detectedMinor, maxMinor);
      const derivedPct =
        Math.round(((finalMinor / effectiveTotalIncomeMinor) * 100) * 10) / 10;

      if (detectedMinor > maxMinor) {
        setPoolHints((h) => ({
          ...h,
          fixed: t('maxAllowedPoolHint')
            .replace('{amount}', formatCurrency(maxMinor / 100, currency))
            .replace('{percent}', String(derivedPct)),
        }));
      } else {
        setPoolHints((h) => ({ ...h, fixed: null }));
      }

      setPools((prev) => ({
        ...prev,
        fixed: {
          minorUnits: finalMinor,
          percent: derivedPct,
          mode: 'amount',
          amountText: formatNumberWithCommas(finalMinor / 100, 2),
        },
      }));
    } else {
      setPools((prev) => ({
        ...prev,
        fixed: {
          minorUnits: detectedMinor,
          percent: 0,
          mode: 'amount',
          amountText: formatNumberWithCommas(detectedMinor / 100, 2),
        },
      }));
    }

    showToast(t('recurringBillsApplied'), 'success');
  };

  // ==========================================================================
  // ACTIONS: REBALANCE SCENARIOS
  // ==========================================================================
  const topOverspendCategories = useMemo(() => {
    return (evaluation.topOverspendCategories || []).map((item) => {
      const cat = categories.find((c) => c.id === item.categoryId);
      return {
        ...item,
        name:
          cat?.name ||
          (item.categoryId === 'uncategorized'
            ? isArabic
              ? 'غير مصنف'
              : 'Uncategorized'
            : item.categoryId),
        icon: cat?.icon || '📁',
      };
    });
  }, [evaluation.topOverspendCategories, categories, isArabic]);

  const handleApplyScenario = (scenarioId: string) => {
    const newOverrides = {
      ...(settings.smartBudget?.overrides || {}),
      [currentCycleKey]: {
        ...(settings.smartBudget?.overrides?.[currentCycleKey] || {}),
        appliedScenario: scenarioId as any,
        appliedAt: Date.now(),
      },
    };

    updateSettings({
      smartBudget: {
        baseline: settings.smartBudget?.baseline || {},
        overrides: newOverrides,
        adjustments: settings.smartBudget?.adjustments,
        updatedAt: Date.now(),
      },
    });

    showToast(t('scenarioAppliedSuccess'), 'success');
  };

  const handleRevertToBaseline = () => {
    const newOverrides = { ...(settings.smartBudget?.overrides || {}) };
    delete newOverrides[currentCycleKey];
    delete newOverrides[currentCycleKey.slice(0, 7)];

    updateSettings({
      smartBudget: {
        baseline: settings.smartBudget?.baseline || {},
        overrides: newOverrides,
        adjustments: settings.smartBudget?.adjustments,
        updatedAt: Date.now(),
      },
    });

    showToast(t('scenarioRevertedSuccess'), 'info');
  };

  const handleToggleCyclePause = () => {
    const nextPaused = !isCyclePaused;
    const newOverride: SmartBudgetCycleOverride = {
      ...(currentOverride || {}),
      isPaused: nextPaused,
    };
    const newOverrides = {
      ...(settings.smartBudget?.overrides || {}),
      [currentCycleKey]: newOverride,
    };
    updateSettings({
      smartBudget: {
        baseline: settings.smartBudget?.baseline || {},
        overrides: newOverrides,
        adjustments: settings.smartBudget?.adjustments,
        updatedAt: Date.now(),
      },
    });
  };

  const handleSetCalculationMode = (newMode: 'full_cycle' | 'from_today') => {
    setCycleStartMode(newMode === 'from_today' ? 'from_today' : 'app_default');
  };

  const handleToggleLinkedAccount = (accountId: string) => {
    const targetAcc = accounts.find((a) => a.id === accountId);
    if (
      targetAcc?.currency &&
      normalizeCurrencyCodeOrSymbol(targetAcc.currency) !== normalizeCurrencyCodeOrSymbol(currency)
    ) {
      showToast(
        isArabic
          ? 'لا يمكن ربط حساب بعملة مختلفة عن عملة الميزانية الأساسية'
          : 'Cannot link account with currency different from budget base currency',
        'error'
      );
      return;
    }
    setSelectedAccountIds((prev) =>
      prev.includes(accountId)
        ? prev.filter((id) => id !== accountId)
        : [...prev, accountId]
    );
  };

  const getLinkedPresetIds = (
    preset: 'public_only' | 'private_only' | 'all' | 'non_savings'
  ): string[] => {
    const primaryAccounts = accounts.filter(
      (a) =>
        !a.currency ||
        normalizeCurrencyCodeOrSymbol(a.currency) ===
          normalizeCurrencyCodeOrSymbol(currency)
    );
    if (preset === 'public_only') {
      return primaryAccounts.filter((a) => !a.isPrivate).map((a) => a.id);
    }
    if (preset === 'private_only') {
      return primaryAccounts.filter((a) => Boolean(a.isPrivate)).map((a) => a.id);
    }
    if (preset === 'all') {
      return primaryAccounts.map((a) => a.id);
    }
    return primaryAccounts
      .filter((a) => !a.isPrivate && isSpendingOrCustomiseRole(a.accountRole))
      .map((a) => a.id);
  };

  const isPresetSelected = (
    preset: 'public_only' | 'private_only' | 'all' | 'non_savings'
  ): boolean => {
    const presetIds = getLinkedPresetIds(preset);
    if (presetIds.length === 0 || presetIds.length !== selectedAccountIds.length) return false;
    const selSet = new Set(selectedAccountIds);
    return presetIds.every((id) => selSet.has(id));
  };

  const handleSelectLinkedAccountsPreset = (
    preset: 'public_only' | 'private_only' | 'all' | 'non_savings'
  ) => {
    const nextIds = getLinkedPresetIds(preset);
    if (nextIds.length === 0) {
      showToast(
        preset === 'private_only'
          ? isArabic
            ? 'لا توجد حسابات خاصة بعملة الميزانية حالياً'
            : 'No private accounts found in base currency'
          : isArabic
          ? 'لا توجد حسابات مطابقة'
          : 'No matching accounts found',
        'info'
      );
      return;
    }
    setSelectedAccountIds(nextIds);
  };

  const handleAdjustmentChange = (raw: string) => {
    setAdjustmentInput(raw);
  };

  const handleAdjustmentBlur = () => {
    const cleaned = adjustmentInput.replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned) || 0;
    setAdjustmentInput(num !== 0 ? String(num) : '');
  };

  const handleToggleFixedCategory = (catId: string) => {
    setSelectedFixedCatIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  // ==========================================================================
  // 3-MODE WHAT-IF SIMULATOR CALCULATION (100% LOCAL DETERMINISTIC MATH)
  // ==========================================================================
  const whatIfReport: WhatIfSimulationReport | null = useMemo(() => {
    const simulatedAmount = Math.max(0, parseFloat(whatIfAmount.replace(/,/g, '')) || 0);
    if (simulatedAmount <= 0) return null;
    return simulateWhatIfScenario(
      {
        mode: whatIfMode,
        amount: simulatedAmount,
        daysCount: whatIfDaysCount,
        pool: whatIfPool,
      },
      evaluation,
      transactions,
      accounts,
      effectiveBudgetConfig,
      resolvedMsgLang,
      new Date()
    );
  }, [
    whatIfMode,
    whatIfAmount,
    whatIfDaysCount,
    whatIfPool,
    evaluation,
    transactions,
    accounts,
    effectiveBudgetConfig,
    resolvedMsgLang,
  ]);

  // ==========================================================================
  // ACTIONS: SAVE BUDGET PLAN
  // ==========================================================================
  const handleSaveBudgetPlan = () => {
    const planned = parseFloat(plannedIncomeInput.replace(/,/g, '')) || 0;
    const sMinor = pools.savings.minorUnits;
    const fMinor = pools.fixed.minorUnits;
    const oMinor = pools.outings.minorUnits;
    const ooMinor = pools.oneoff.minorUnits;
    const sPct =
      effectiveTotalIncomeMinor > 0
        ? Math.round(((sMinor / effectiveTotalIncomeMinor) * 100) * 10) / 10
        : 0;
    const fPct =
      effectiveTotalIncomeMinor > 0
        ? Math.round(((fMinor / effectiveTotalIncomeMinor) * 100) * 10) / 10
        : 0;
    const oPct =
      effectiveTotalIncomeMinor > 0
        ? Math.round(((oMinor / effectiveTotalIncomeMinor) * 100) * 10) / 10
        : 0;
    const ooPct =
      effectiveTotalIncomeMinor > 0
        ? Math.round(((ooMinor / effectiveTotalIncomeMinor) * 100) * 10) / 10
        : 0;

    const newBaseline: SmartBudgetBaselineConfig = {
      startDay: globalMonthStartDay,
      cycleStartMode,
      customStartDay: cycleStartMode === 'custom' ? customStartDay : undefined,
      customStartDate: cycleStartMode === 'custom' ? customStartDate : undefined,
      plannedIncome: planned > 0 ? planned : undefined,
      savings: { type: 'fixed', value: sMinor / 100 },
      plannedFixedObligations: fMinor / 100,
      outingsBudget: oMinor / 100,
      oneOffBudget: ooMinor / 100,
      oneOffFundingSource,
      fixedCategoryIds: selectedFixedCatIds,
      includedAccountIds: selectedAccountIds,
      includePrivateAccounts: activeIncludePrivateAccounts,
      calculationMode: baselineCalculationMode,
      fromTodayConfig: {
        fromDate: baselineSettings.fromTodayConfig?.fromDate || evaluation.cycle.startDate,
        linkedAccountIds: selectedAccountIds,
        manualAdjustment: parsedAdjustment,
      },
      headsUpThresholdRatio: Math.min(
        0.95,
        Math.max(0.3, headsUpThresholdPercent / 100)
      ),
      weekdayWeights:
        weekendMultiplier !== 1.0
          ? { 4: weekendMultiplier, 5: weekendMultiplier }
          : undefined,
      poolsConfig: {
        savings: { minorUnits: sMinor, percent: sPct, mode: 'amount' },
        fixed: { minorUnits: fMinor, percent: fPct, mode: 'amount' },
        outings: { minorUnits: oMinor, percent: oPct, mode: 'amount' },
        oneoff: { minorUnits: ooMinor, percent: ooPct, mode: 'amount' },
      },
    };

    updateSettings({
      smartBudget: {
        baseline: newBaseline,
        overrides: settings.smartBudget?.overrides || {},
        adjustments: settings.smartBudget?.adjustments,
        updatedAt: Date.now(),
      },
    });

    showToast(
      isArabic
        ? 'تم تطبيق وحفظ تغييرات الميزانية بنجاح'
        : 'Budget settings applied & saved successfully',
      'success'
    );
  };

  const handleResetToDefaults = () => {
    const incMinor = Math.round(liveBudget * 100);
    const sMinor = Math.round(incMinor * 0.2);
    const fMinor = Math.round(incMinor * 0.4);
    const oMinor = Math.round(incMinor * 0.15);

    setPools({
      savings: {
        minorUnits: sMinor,
        percent: 20,
        mode: 'amount',
        amountText: formatNumberWithCommas(sMinor / 100, 2),
      },
      fixed: {
        minorUnits: fMinor,
        percent: 40,
        mode: 'amount',
        amountText: formatNumberWithCommas(fMinor / 100, 2),
      },
      outings: {
        minorUnits: oMinor,
        percent: 15,
        mode: 'amount',
        amountText: formatNumberWithCommas(oMinor / 100, 2),
      },
      oneoff: {
        minorUnits: 0,
        percent: 0,
        mode: 'amount',
        amountText: '',
      },
    });
    setOneOffFundingSource('daily');
    setHeadsUpThresholdPercent(70);
    setPoolHints({ savings: null, fixed: null, outings: null, oneoff: null });
    showToast(t('resetToDefault'), 'info');
  };

  const applyManualPoolStep = (
    poolKey: SmartBudgetPoolKey,
    mode: 'add' | 'subtract' | 'set' | 'reset',
    allocatedMajor = 0,
    trackedValueMajor = 0
  ) => {
    if (mode === 'reset') {
      updateManualPoolProgress(currentCycleKey, poolKey, 0, 'reset');
      setManualAmountInput('');
      return;
    }
    if (mode === 'set') {
      const targetOffsetMajor = Math.max(0, allocatedMajor - trackedValueMajor);
      updateManualPoolProgress(currentCycleKey, poolKey, targetOffsetMajor, 'set');
      setManualAmountInput('');
      return;
    }
    const val = Math.max(0, parseFloat(manualAmountInput.replace(/,/g, '')) || 0);
    if (val <= 0) {
      showToast(isArabic ? 'أدخل مبلغاً أولاً' : 'Enter an amount first', 'info');
      return;
    }
    updateManualPoolProgress(currentCycleKey, poolKey, val, mode);
    setManualAmountInput('');
  };

  const renderManualProgressControl = (
    poolKey: SmartBudgetPoolKey,
    allocatedMajor: number,
    trackedValueMajor: number,
    manualAdjMajor: number
  ) => {
    const isExpanded = manualEditPool === poolKey;
    return (
      <div
        className="pt-2 border-t border-zinc-800/50 space-y-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              setManualEditPool(isExpanded ? null : poolKey);
              setManualAmountInput('');
            }}
            className="min-h-[34px] px-2.5 py-1 rounded-xl bg-zinc-950/90 hover:bg-zinc-800 border border-zinc-800 text-[10px] font-bold text-zinc-300 flex items-center gap-1.5 transition cursor-pointer"
          >
            <Sliders className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>{isArabic ? 'تعديل التقدم يدوياً (+/-)' : 'Manual +/- Adjust'}</span>
          </button>

          {manualAdjMajor !== 0 && (
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                manualAdjMajor > 0
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                  : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
              }`}
            >
              {manualAdjMajor > 0 ? '+' : ''}
              {formatCurrency(manualAdjMajor, currency)}
            </span>
          )}
        </div>

        {isExpanded && (
          <div className="p-2.5 rounded-2xl bg-zinc-950/95 border border-zinc-800 space-y-2">
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                inputMode="decimal"
                value={manualAmountInput}
                onChange={(e) => setManualAmountInput(e.target.value)}
                placeholder={isArabic ? 'مبلغ التعديل...' : 'Amount...'}
                className="flex-1 min-w-0 min-h-[38px] px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-mono text-white focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => applyManualPoolStep(poolKey, 'add')}
                className="min-h-[38px] px-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer shrink-0"
              >
                <Plus className="w-3 h-3" />
                <span>{isArabic ? 'إضافة' : 'Add'}</span>
              </button>
              <button
                type="button"
                onClick={() => applyManualPoolStep(poolKey, 'subtract')}
                className="min-h-[38px] px-2.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer shrink-0"
              >
                <Minus className="w-3 h-3" />
                <span>{isArabic ? 'تقليل' : 'Sub'}</span>
              </button>
            </div>
            <div className="flex items-center justify-between gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() =>
                  applyManualPoolStep(poolKey, 'set', allocatedMajor, trackedValueMajor)
                }
                className="min-h-[34px] px-2.5 py-1 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
              >
                <Check className="w-3 h-3" />
                <span>{isArabic ? 'تم بالكامل ✓' : 'Complete ✓'}</span>
              </button>
              {manualAdjMajor !== 0 && (
                <button
                  type="button"
                  onClick={() => applyManualPoolStep(poolKey, 'reset')}
                  className="min-h-[34px] px-2.5 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-[10px] font-bold transition cursor-pointer"
                >
                  {isArabic ? 'تصفير اليدوي' : 'Reset'}
                </button>
              )}
            </div>
            <p className="text-[10px] text-zinc-500 leading-snug">
              {isArabic
                ? 'يعدّل تقدم هذا البند فقط يدوياً بدون المساس بالمصروف اليومي.'
                : 'Adjusts this pool progress directly without affecting Daily Spending.'}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="modal-safe-overlay fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 transition-opacity duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[92vh] flex flex-col bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden text-zinc-100 min-w-0"
        onClick={(e) => e.stopPropagation()}
        dir={isArabic ? 'rtl' : 'ltr'}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800/80 flex items-center justify-between shrink-0 bg-zinc-900/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-black flex items-center justify-center shrink-0 shadow-lg shadow-emerald-950/40">
              <Wallet className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-white truncate">
                {t('smartBudget')}
              </h3>
              <p className="text-xs text-zinc-400 truncate mt-0.5">
                {t('smartBudgetDesc')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Unified Scrollable Layout */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 min-w-0 kb-scroll-pad">
          {/* =============================================================== */}
          {/* SECTION 1: COLLAPSIBLE CYCLE & FUNDING SETTINGS (Collapsed by Default) */}
          {/* =============================================================== */}
          <section className="space-y-4">
            <div className="p-4 sm:p-5 rounded-3xl bg-zinc-900/80 border border-zinc-800 space-y-4">
              {/* Clickable Compact Summary Header */}
              <div
                onClick={() => setIsCycleSettingsOpen((prev) => !prev)}
                role="button"
                tabIndex={0}
                className="flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                    <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                      {evaluation.cycle.label}
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      {cycleStartMode === 'from_today'
                        ? isArabic ? 'من اليوم (حي)' : 'From Today'
                        : cycleStartMode === 'calendar_month'
                        ? isArabic ? 'الشهر الميلادي' : 'Calendar Month'
                        : cycleStartMode === 'custom'
                        ? isArabic ? 'مخصص' : 'Custom'
                        : isArabic ? 'دورة التطبيق' : 'App Cycle'}
                    </span>
                    {evaluation.pools.total.dynamicPublicIncomeDelta !== 0 && (
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                          evaluation.pools.total.dynamicPublicIncomeDelta > 0
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                            : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                        }`}
                      >
                        {evaluation.pools.total.dynamicPublicIncomeDelta > 0 ? '+' : ''}
                        {formatCurrency(evaluation.pools.total.dynamicPublicIncomeDelta, currency)}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1 flex items-center gap-2 flex-wrap">
                    <span>
                      {isArabic
                        ? `اليوم ${evaluation.dailyStatus.cycleDayIndex}/${evaluation.dailyStatus.cycleLength} · متبقي ${evaluation.dailyStatus.remainingDaysInCycle} يوم`
                        : `Day ${evaluation.dailyStatus.cycleDayIndex}/${evaluation.dailyStatus.cycleLength} · ${evaluation.dailyStatus.remainingDaysInCycle}d left`}
                    </span>
                    <span>•</span>
                    <span className="font-mono text-zinc-200 font-semibold">
                      {formatCurrency(evaluation.pools.total.income, currency)}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleCyclePause();
                    }}
                    className={`min-h-[38px] px-3 py-1.5 rounded-xl text-[11px] font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                      isCyclePaused
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                        : 'bg-zinc-800 hover:bg-zinc-750 text-zinc-300 border-zinc-700'
                    }`}
                  >
                    <Shield className={`w-3.5 h-3.5 ${isCyclePaused ? 'text-amber-400' : 'text-zinc-400'}`} />
                    <span className="hidden sm:inline">
                      {isCyclePaused
                        ? t('smartBudgetPausedBadge')
                        : isArabic ? 'إيقاف مؤقت' : 'Pause'}
                    </span>
                  </button>
                  <div className="w-8 h-8 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-400">
                    {isCycleSettingsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </div>

              {/* Paused state message */}
              {isCyclePaused && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-xs text-amber-200 leading-relaxed">
                      {t('smartBudgetPausedMessage')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleCyclePause}
                    className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shrink-0 transition cursor-pointer"
                  >
                    {t('resumeSmartBudgetBtn')}
                  </button>
                </div>
              )}

              {isCycleSettingsOpen && (
                <div className="space-y-4 pt-2 border-t border-zinc-800/80 animate-in fade-in duration-150">
              {/* Cycle Start Mode Selector (4 Options) */}
              <div className="space-y-2.5">
                <label className="block text-xs font-semibold text-zinc-300">
                  {isArabic ? 'دورة الميزانية وتاريخ البداية' : 'Budget Cycle & Start Mode'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* 1. App Default Month */}
                  <button
                    type="button"
                    onClick={() => setCycleStartMode('app_default')}
                    className={`p-3 rounded-2xl border text-start transition cursor-pointer ${
                      cycleStartMode === 'app_default'
                        ? 'bg-blue-500/15 border-blue-500/50 text-white shadow-md'
                        : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-950'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {isArabic ? 'شهر التطبيق الافتراضي' : 'App Default Month'}
                      </span>
                      {cycleStartMode === 'app_default' && (
                        <Check className="w-4 h-4 text-blue-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      {isArabic
                        ? `يبدأ في يوم ${globalMonthStartDay} من كل شهر وفقاً لإعدادات التطبيق`
                        : `Starts on day ${globalMonthStartDay} of each month from app settings`}
                    </p>
                  </button>

                  {/* 2. Calendar Month (Day 1) */}
                  <button
                    type="button"
                    onClick={() => setCycleStartMode('calendar_month')}
                    className={`p-3 rounded-2xl border text-start transition cursor-pointer ${
                      cycleStartMode === 'calendar_month'
                        ? 'bg-blue-500/15 border-blue-500/50 text-white shadow-md'
                        : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-950'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {isArabic ? 'الشهر الميلادي (يوم 1)' : 'Calendar Month (Day 1)'}
                      </span>
                      {cycleStartMode === 'calendar_month' && (
                        <Check className="w-4 h-4 text-blue-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      {isArabic
                        ? 'يبدأ من أول يوم في الشهر (1) وحتى نهايته'
                        : 'Starts from the 1st of the current month'}
                    </p>
                  </button>

                  {/* 3. From Today */}
                  <button
                    type="button"
                    onClick={() => setCycleStartMode('from_today')}
                    className={`p-3 rounded-2xl border text-start transition cursor-pointer ${
                      cycleStartMode === 'from_today'
                        ? 'bg-blue-500/15 border-blue-500/50 text-white shadow-md'
                        : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-950'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5" />
                        {isArabic ? 'من اليوم (رصيد حي)' : 'From Today (Live)'}
                      </span>
                      {cycleStartMode === 'from_today' && (
                        <Check className="w-4 h-4 text-blue-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      {isArabic
                        ? 'تتبع الرصيد الحي من تاريخ اليوم وحتى نهاية الدورة'
                        : 'Tracks live balance from today through cycle end'}
                    </p>
                  </button>

                  {/* 4. Custom Day / Date */}
                  <button
                    type="button"
                    onClick={() => setCycleStartMode('custom')}
                    className={`p-3 rounded-2xl border text-start transition cursor-pointer ${
                      cycleStartMode === 'custom'
                        ? 'bg-blue-500/15 border-blue-500/50 text-white shadow-md'
                        : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-950'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5" />
                        {isArabic ? 'يوم / تاريخ مخصص' : 'Custom Day / Date'}
                      </span>
                      {cycleStartMode === 'custom' && (
                        <Check className="w-4 h-4 text-blue-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      {isArabic
                        ? 'حدد يوماً معيناً (1-31) أو تاريخ بداية مخصص لهذه الدورة'
                        : 'Pick a specific start day (1–31) or exact start date'}
                    </p>
                  </button>
                </div>

                {/* Custom Options Expanded */}
                {cycleStartMode === 'custom' && (
                  <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800 grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                        {isArabic ? 'يوم بداية الدورة (1-31)' : 'Cycle Start Day of Month (1–31)'}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={customStartDay}
                        onChange={(e) => {
                          const val = Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1));
                          setCustomStartDay(val);
                        }}
                        className="w-full min-h-[42px] px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-750 text-white text-xs font-mono focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                        {isArabic ? 'تاريخ بداية محدد لهذه الدورة' : 'Exact Start Date for Active Cycle'}
                      </label>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-full min-h-[42px] px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-750 text-white text-xs font-mono focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Planned Income for Full Cycle Mode (always shown alongside Linked Accounts) */}
              {baselineCalculationMode === 'full_cycle' && (
                <div className="space-y-3 pt-2 border-t border-zinc-800/80">
                  <div>
                    <label className="block text-xs font-bold text-white mb-1">
                      {t('plannedIncome')}
                    </label>
                    <p className="text-[11px] text-zinc-400 mb-2">{t('plannedIncomeDesc')}</p>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={plannedIncomeInput}
                      onChange={(e) => handlePlannedIncomeChange(e.target.value, e.target)}
                      placeholder="e.g. 20000"
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  {effectiveTotalIncomeMinor <= 0 && (
                    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{t('enterIncomeFirstHint')}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Always-Visible Linked Funding Accounts Section (All Cycle Modes) */}
              <div className="space-y-3 pt-3 border-t border-zinc-800/80">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-white">
                      {isArabic ? 'الحسابات الداخلة في الميزانية' : t('linkedFundingAccountsTitle')}
                    </h4>
                    <p className="text-[11px] text-zinc-400">
                      {isArabic
                        ? 'اختر الحسابات اللي التطبيق يحسب منها المتاح الفعلي لباقي الشهر بعد خصم الالتزامات غير المدفوعة'
                        : t('linkedFundingAccountsDesc')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsLinkedAccountsOpen((prev) => !prev)}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs font-bold border border-zinc-700 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <span>
                      {t('includedAccountsCount').replace(
                        '{count}',
                        String(selectedAccountIds.length)
                      )}
                    </span>
                    {isLinkedAccountsOpen ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* Live Obligation & Net Remainder Banner */}
                <div className="p-3.5 rounded-2xl bg-zinc-950/90 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>
                        {baselineCalculationMode === 'from_today'
                          ? t('moneyLeftForRestOfCycle')
                          : isArabic
                          ? 'الرصيد الحالي بالحسابات المختارة'
                          : 'Selected Accounts Live Balance'}
                      </span>
                    </span>
                    <span className="text-base font-mono font-extrabold text-emerald-400 shrink-0">
                      {formatCurrency(
                        baselineCalculationMode === 'from_today' ? liveBudget : linkedAccountsBalanceSum,
                        currency
                      )}
                    </span>
                  </div>

                  {baselineCalculationMode !== 'from_today' ? (
                    <div className="space-y-1 pt-1.5 border-t border-zinc-800/80 text-[11px] font-mono">
                      <div className="flex items-center justify-between text-zinc-400">
                        <span>
                          {isArabic
                            ? 'الالتزامات المتبقية (فواتير / تحويش / غيرها):'
                            : 'Unpaid obligations reserved:'}
                        </span>
                        <span className="text-amber-300">
                          - {formatCurrency(unpaidObligationsTotal, currency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-zinc-300">
                          {isArabic ? 'الصافي المتبقي للمصروف اليومي:' : 'Net remaining for Daily Spending:'}
                        </span>
                        <span
                          className={
                            evaluation.pools.daily.remaining < 0
                              ? 'text-rose-400'
                              : 'text-emerald-400'
                          }
                        >
                          {formatCurrency(evaluation.pools.daily.remaining, currency)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                      <span>
                        {t('sumOfLinkedAccounts')}: {formatCurrency(linkedAccountsBalanceSum, currency)}
                      </span>
                      {parsedAdjustment !== 0 && (
                        <span className={parsedAdjustment > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {parsedAdjustment > 0 ? '+' : ''}
                          {formatCurrency(parsedAdjustment, currency)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Quick Shortcuts: Public Only | Private Only | All | Non-Savings */}
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => handleSelectLinkedAccountsPreset('public_only')}
                    className={`min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                      isPresetSelected('public_only')
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                        : 'bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border-zinc-750'
                    }`}
                  >
                    {isArabic ? 'العامة فقط' : 'Public Only'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectLinkedAccountsPreset('private_only')}
                    className={`min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                      isPresetSelected('private_only')
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                        : 'bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border-zinc-750'
                    }`}
                  >
                    {isArabic ? 'الخاصة فقط' : 'Private Only'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectLinkedAccountsPreset('all')}
                    className={`min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                      isPresetSelected('all')
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                        : 'bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border-zinc-750'
                    }`}
                  >
                    {isArabic ? 'الكل' : 'All'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectLinkedAccountsPreset('non_savings')}
                    className={`min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                      isPresetSelected('non_savings') && !isPresetSelected('public_only')
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                        : 'bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border-zinc-750'
                    }`}
                  >
                    {t('selectLinkedAccountsPresetNonSavings')}
                  </button>
                </div>

                {/* Dropdown list of accounts */}
                {isLinkedAccountsOpen && (
                  <div className="p-2 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-1 max-h-56 overflow-y-auto">
                    {accounts.length === 0 ? (
                      <div className="p-2 text-center text-xs text-zinc-500">
                        {isArabic ? 'لا توجد حسابات' : 'No accounts found'}
                      </div>
                    ) : (
                      accounts.map((acc) => {
                        const isExcludedCurrency = Boolean(
                          acc.currency &&
                            normalizeCurrencyCodeOrSymbol(acc.currency) !==
                              normalizeCurrencyCodeOrSymbol(currency)
                        );
                        const isChecked =
                          !isExcludedCurrency && selectedAccountIds.includes(acc.id);
                        return (
                          <label
                            key={acc.id}
                            className={`flex items-center justify-between p-2 rounded-xl transition select-none ${
                              isExcludedCurrency
                                ? 'opacity-40 cursor-not-allowed bg-zinc-950/40'
                                : 'hover:bg-zinc-900 cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                disabled={isExcludedCurrency}
                                checked={isChecked}
                                onChange={() =>
                                  !isExcludedCurrency && handleToggleLinkedAccount(acc.id)
                                }
                                className="w-4 h-4 rounded text-emerald-600 bg-zinc-800 border-zinc-700 focus:ring-emerald-500 cursor-pointer disabled:cursor-not-allowed"
                              />
                              <span className="text-sm shrink-0">{acc.icon || '💳'}</span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-xs font-semibold text-zinc-200 truncate">
                                    {acc.name}
                                  </p>
                                  <span
                                    className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-medium border ${
                                      acc.isPrivate
                                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                        : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                    }`}
                                  >
                                    {acc.isPrivate
                                      ? isArabic ? 'خاص' : 'Private'
                                      : isArabic ? 'عام' : 'Public'}
                                  </span>
                                  {isExcludedCurrency && (
                                    <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
                                      {isArabic
                                        ? `مستبعد (${acc.currency})`
                                        : `Excluded (${acc.currency})`}
                                    </span>
                                  )}
                                </div>
                                {isSavingsOrInvestmentRole(acc.accountRole) ? (
                                  <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                    {isArabic ? 'ادخار / استثمار' : 'Savings / Investing'}
                                  </span>
                                ) : acc.accountRole === 'customise' ? (
                                  <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                    {isArabic ? 'مخصص' : 'Custom'}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <span
                              className={`text-xs font-mono font-semibold shrink-0 ${
                                acc.balance >= 0 ? 'text-zinc-300' : 'text-rose-400'
                              }`}
                            >
                              {formatCurrency(acc.balance || 0, acc.currency || currency)}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                )}

                {selectedAccountIds.length === 0 && (
                  <p className="text-[11px] text-amber-400 leading-relaxed">
                    {t('noLinkedAccountsWarning')}
                  </p>
                )}

                {/* Extra Outside Cash (Adjustment) in From Today mode */}
                {baselineCalculationMode === 'from_today' && (
                  <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
                    <label className="block text-xs font-semibold text-zinc-300">
                      {t('extraCashAdjustment')}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={adjustmentInput}
                        onChange={(e) => handleAdjustmentChange(e.target.value)}
                        onBlur={handleAdjustmentBlur}
                        placeholder="0.00"
                        className="w-full min-h-[44px] px-3.5 py-2 pe-12 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono text-sm focus:border-blue-500 focus:outline-none"
                      />
                      <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-mono pointer-events-none">
                        {currency}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      {t('extraCashAdjustmentDesc')}
                    </p>
                  </div>
                )}
              </div>
                </div>
              )}
            </div>
          </section>

          {/* =============================================================== */}
          {/* SECTION 2: DAILY ALLOWANCE TRACKER (THE DASHBOARD) */}
          {/* =============================================================== */}
          {!isCyclePaused && (
            <section className="space-y-3">
              <div
                className={`p-4 sm:p-5 rounded-3xl border shadow-xl relative overflow-hidden transition-colors ${
                  evaluation.dailyStatus.allowanceState === 'true_deficit'
                    ? 'bg-gradient-to-br from-red-950/50 via-zinc-900 to-zinc-900/90 border-red-500/40'
                    : evaluation.dailyStatus.allowanceState === 'heads_up'
                      ? 'bg-gradient-to-br from-amber-950/50 via-zinc-900 to-zinc-900/90 border-amber-500/40'
                      : 'bg-gradient-to-br from-emerald-950/60 via-zinc-900 to-zinc-900/90 border-emerald-500/30'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <span
                    className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                      evaluation.dailyStatus.allowanceState === 'true_deficit'
                        ? 'text-red-400'
                        : evaluation.dailyStatus.allowanceState === 'heads_up'
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                    }`}
                  >
                    <Wallet className="w-4 h-4" />
                    <span>{t('safeToSpendToday')}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        evaluation.dailyStatus.allowanceState === 'true_deficit'
                          ? 'bg-red-500/20 text-red-300 border-red-500/30'
                          : evaluation.dailyStatus.allowanceState === 'heads_up'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      }`}
                    >
                      {evaluation.dailyStatus.allowanceState === 'true_deficit'
                        ? t('stateTrueDeficitBadge')
                        : evaluation.dailyStatus.allowanceState === 'heads_up'
                          ? t('stateHeadsUpBadge')
                          : t('stateNormalBadge')}
                    </span>
                  </div>
                </div>

                {/* 3 Prominent Daily Metrics: Allowed Today, Spent Today, Remaining Today */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
                  <div className="p-2.5 sm:p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 min-w-0">
                    <div className="text-[10px] sm:text-[11px] font-semibold text-zinc-400 truncate mb-0.5">
                      {t('todayAllowance')}
                    </div>
                    <div className="text-sm sm:text-lg font-extrabold font-mono text-white truncate">
                      {formatCurrency(evaluation.dailyStatus.todayAllowance, currency)}
                    </div>
                  </div>

                  <div className="p-2.5 sm:p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 min-w-0">
                    <div className="text-[10px] sm:text-[11px] font-semibold text-zinc-400 truncate mb-0.5">
                      {t('todaySpent')}
                    </div>
                    <div className="text-sm sm:text-lg font-extrabold font-mono text-zinc-200 truncate">
                      {formatCurrency(evaluation.dailyStatus.todaySpent, currency)}
                    </div>
                  </div>

                  <div className="p-2.5 sm:p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 min-w-0">
                    <div className="text-[10px] sm:text-[11px] font-semibold text-zinc-400 truncate mb-0.5">
                      {t('todayRemaining')}
                    </div>
                    <div
                      className={`text-sm sm:text-lg font-extrabold font-mono truncate ${
                        evaluation.dailyStatus.allowanceState === 'true_deficit'
                          ? 'text-red-400'
                          : evaluation.dailyStatus.todayRemaining < 0
                            ? 'text-amber-300'
                            : 'text-emerald-400'
                      }`}
                    >
                      {formatCurrency(
                        Math.max(0, evaluation.dailyStatus.todayRemaining),
                        currency
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-zinc-800 rounded-full h-2.5 overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      evaluation.dailyStatus.allowanceState === 'true_deficit'
                        ? 'bg-red-500'
                        : evaluation.dailyStatus.allowanceState === 'heads_up' ||
                            evaluation.dailyStatus.overBudgetBy > 0
                          ? 'bg-amber-400'
                          : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(
                          0,
                          (evaluation.dailyStatus.todaySpent /
                            Math.max(1, evaluation.dailyStatus.todayAllowance)) *
                            100
                        )
                      )}%`,
                    }}
                  />
                </div>

                {/* Calm Absorption Message */}
                {evaluation.dailyStatus.overBudgetBy > 0 &&
                  evaluation.dailyStatus.allowanceState !== 'true_deficit' && (
                    <div
                      dir={isMsgArabic ? 'rtl' : 'ltr'}
                      className="mt-2.5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200 leading-relaxed flex items-start gap-2"
                    >
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span className="whitespace-normal break-words">
                        {isMsgArabic
                          ? `النهارده عدّينا بمبلغ ${formatCurrency(evaluation.dailyStatus.overBudgetBy, currency)}، وببساطة يوميتك للأيام الجاية اتظبطت على ${formatCurrency(evaluation.dailyStatus.upcomingDailyAllowance, currency)} عشان الشهر يكمل معاك مرتاح.`
                          : `Over today's limit by ${formatCurrency(evaluation.dailyStatus.overBudgetBy, currency)} — no stress, upcoming days gently adjust to ${formatCurrency(evaluation.dailyStatus.upcomingDailyAllowance, currency)}/day.`}
                      </span>
                    </div>
                  )}

                {/* True Deficit Message */}
                {evaluation.dailyStatus.allowanceState === 'true_deficit' && (
                  <div
                    dir={isMsgArabic ? 'rtl' : 'ltr'}
                    className="mt-2.5 p-3 rounded-2xl bg-red-500/15 border border-red-500/30 text-xs text-red-200 leading-relaxed flex items-start gap-2"
                  >
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span className="whitespace-normal break-words">
                      {isMsgArabic ? 'الميزانية اليومية دخلت في عجز ' : 'Daily budget is short by '}
                      <strong className="font-mono tabular-nums">
                        {formatCurrency(
                          Math.max(
                            evaluation.dailyStatus.overBudgetBy,
                            Math.abs(Math.min(0, evaluation.pools.daily.remaining))
                          ),
                          currency
                        )}
                      </strong>
                      {isMsgArabic
                        ? ' — انزل تحت عند اقتراحات التوازن ونرتّبها في ضغطة.'
                        : ' — scroll to Rebalance Options below to smooth it out.'}
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* =============================================================== */}
          {/* SECTION 3: BUDGET POOL ALLOCATIONS & PROGRESS */}
          {/* =============================================================== */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white">
                  {t('budgetPoolsAndProgressTitle') || t('poolSlidersTitle')}
                </h4>
                <p className="text-[11px] text-zinc-400">
                  {t('budgetPoolsAndProgressDesc') || t('poolSlidersDesc')}
                </p>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                {t('mustTotal100')}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Pool 1: Savings Card */}
              <div
                onClick={() => setInspectPoolKey('savings')}
                className={`p-4 rounded-3xl bg-zinc-900/80 border border-blue-500/25 space-y-3 cursor-pointer hover:border-blue-500/50 transition ${
                  effectiveTotalIncomeMinor <= 0 ? 'opacity-40 pointer-events-none' : ''
                }`}
                title={isArabic ? 'اضغط لعرض معاملات التحويش' : 'Click to view savings transactions'}
              >
                <div className="flex items-center justify-between text-xs font-bold text-blue-400">
                  <span className="flex items-center gap-1.5">
                    <PiggyBank className="w-4 h-4" />
                    <span>{t('poolSavings')}</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInspectPoolKey('savings');
                      }}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 font-semibold border border-blue-500/30 flex items-center gap-1 transition cursor-pointer"
                    >
                      <span>{(evaluation.pools.savings.transactions || []).length} {isArabic ? 'معاملة' : 'txs'}</span>
                      <ChevronRight className="w-2.5 h-2.5 rtl:rotate-180" />
                    </button>
                    <span className="text-[10px] font-mono bg-blue-500/20 px-2 py-0.5 rounded-full text-blue-300 font-semibold">
                      {displayPoolPercents.savings}%
                    </span>
                  </div>
                </div>

                {/* Target Numerical Input */}
                <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                    {t('poolAllocated')}
                  </span>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={pools.savings.amountText}
                      disabled={effectiveTotalIncomeMinor <= 0}
                      onChange={(e) =>
                        handleAmountChange('savings', e.target.value, e.target)
                      }
                      onBlur={() => handleAmountBlur('savings')}
                      placeholder="0.00"
                      className="w-full min-h-[44px] px-3.5 py-2 pe-12 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono text-sm focus:border-blue-500 focus:outline-none"
                    />
                    <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-mono pointer-events-none">
                      {currency}
                    </span>
                  </div>
                </div>

                {/* Real-Time Cycle Progress & Remaining */}
                <div className="space-y-1.5 pt-1 border-t border-zinc-800/60">
                  <div className="flex justify-between items-baseline font-mono text-xs">
                    <span className="text-zinc-400">{t('poolRemaining')}:</span>
                    <span className="font-bold text-white">
                      {formatCurrency(evaluation.pools.savings.remaining, currency)}{' '}
                      <span className="text-zinc-500 text-[11px] font-normal">
                        / {formatCurrency(evaluation.pools.savings.allocated, currency)}
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-zinc-800/80 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, evaluation.pools.savings.progressPercent))}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500">
                    <span>{t('netSavedThisCycle')}: {formatCurrency(evaluation.pools.savings.netSaved, currency)}</span>
                    <span className="font-semibold text-blue-300">
                      {evaluation.pools.savings.progressPercent >= 100
                        ? (isArabic ? '✓ تم إكمال الهدف' : '✓ Goal Completed')
                        : `${evaluation.pools.savings.progressPercent}%`}
                    </span>
                  </div>
                  {poolHints.savings && (
                    <div className="text-[10px] text-amber-400 font-medium">{poolHints.savings}</div>
                  )}
                </div>

                {renderManualProgressControl(
                  'savings',
                  evaluation.pools.savings.allocated,
                  evaluation.pools.savings.trackedNetSaved,
                  evaluation.pools.savings.manualAdjustment
                )}
              </div>

              {/* Pool 2: Bills & Fixed Obligations Card */}
              <div
                onClick={() => setInspectPoolKey('fixed')}
                className={`p-4 rounded-3xl bg-zinc-900/80 border border-purple-500/25 space-y-3 cursor-pointer hover:border-purple-500/50 transition ${
                  effectiveTotalIncomeMinor <= 0 ? 'opacity-40 pointer-events-none' : ''
                }`}
                title={isArabic ? 'اضغط لعرض معاملات الفواتير والالتزامات' : 'Click to view fixed & bills transactions'}
              >
                <div className="flex items-center justify-between text-xs font-bold text-purple-400">
                  <span className="flex items-center gap-1.5">
                    <ShoppingBag className="w-4 h-4" />
                    <span>{t('poolFixed')}</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInspectPoolKey('fixed');
                      }}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 font-semibold border border-purple-500/30 flex items-center gap-1 transition cursor-pointer"
                    >
                      <span>{(evaluation.pools.fixed.transactions || []).length} {isArabic ? 'معاملة' : 'txs'}</span>
                      <ChevronRight className="w-2.5 h-2.5 rtl:rotate-180" />
                    </button>
                    <span className="text-[10px] font-mono bg-purple-500/20 px-2 py-0.5 rounded-full text-purple-300 font-semibold">
                      {displayPoolPercents.fixed}%
                    </span>
                  </div>
                </div>

                {/* Target Numerical Input */}
                <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                    {t('poolAllocated')}
                  </span>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={pools.fixed.amountText}
                      disabled={effectiveTotalIncomeMinor <= 0}
                      onChange={(e) =>
                        handleAmountChange('fixed', e.target.value, e.target)
                      }
                      onBlur={() => handleAmountBlur('fixed')}
                      placeholder="0.00"
                      className="w-full min-h-[44px] px-3.5 py-2 pe-12 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono text-sm focus:border-purple-500 focus:outline-none"
                    />
                    <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-mono pointer-events-none">
                      {currency}
                    </span>
                  </div>
                </div>

                {/* Detected recurring bills helper button */}
                {detectedRecurringBills > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApplyDetectedRecurringBills();
                    }}
                    className="min-h-[36px] px-2.5 py-1 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-[11px] font-semibold border border-purple-500/30 flex items-center gap-1.5 transition w-full cursor-pointer"
                  >
                    <Sliders className="w-3 h-3 shrink-0" />
                    <span className="truncate">
                      {t('useDetectedRecurringBills').replace(
                        '{amount}',
                        formatCurrency(detectedRecurringBills, currency)
                      )}
                    </span>
                  </button>
                )}

                {/* Real-Time Cycle Progress & Remaining */}
                <div className="space-y-1.5 pt-1 border-t border-zinc-800/60">
                  <div className="flex justify-between items-baseline font-mono text-xs">
                    <span className="text-zinc-400">{t('poolRemaining')}:</span>
                    <span className="font-bold text-white">
                      {formatCurrency(evaluation.pools.fixed.remaining, currency)}{' '}
                      <span className="text-zinc-500 text-[11px] font-normal">
                        / {formatCurrency(evaluation.pools.fixed.allocated, currency)}
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-zinc-800/80 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-400 transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            0,
                            evaluation.pools.fixed.allocated > 0
                              ? (evaluation.pools.fixed.spent / evaluation.pools.fixed.allocated) * 100
                              : 0
                          )
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500">
                    <span>{t('poolSpent')}: {formatCurrency(evaluation.pools.fixed.spent, currency)}</span>
                    {poolHints.fixed && (
                      <span className="text-amber-400 font-medium">{poolHints.fixed}</span>
                    )}
                  </div>
                </div>

                {renderManualProgressControl(
                  'fixed',
                  evaluation.pools.fixed.allocated,
                  evaluation.pools.fixed.trackedSpent,
                  evaluation.pools.fixed.manualAdjustment
                )}
              </div>

              {/* Pool 3: Outings Card */}
              <div
                onClick={() => setInspectPoolKey('outings')}
                className={`p-4 rounded-3xl bg-zinc-900/80 border border-amber-500/25 space-y-3 cursor-pointer hover:border-amber-500/50 transition ${
                  effectiveTotalIncomeMinor <= 0 ? 'opacity-40 pointer-events-none' : ''
                }`}
                title={isArabic ? 'اضغط لعرض معاملات الخروجات' : 'Click to view outings transactions'}
              >
                <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                  <span className="flex items-center gap-1.5">
                    <Coffee className="w-4 h-4" />
                    <span>{t('poolOutings')}</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInspectPoolKey('outings');
                      }}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 font-semibold border border-amber-500/30 flex items-center gap-1 transition cursor-pointer"
                    >
                      <span>{(evaluation.pools.outings.transactions || []).length} {isArabic ? 'معاملة' : 'txs'}</span>
                      <ChevronRight className="w-2.5 h-2.5 rtl:rotate-180" />
                    </button>
                    <span className="text-[10px] font-mono bg-amber-500/20 px-2 py-0.5 rounded-full text-amber-300 font-semibold">
                      {displayPoolPercents.outings}%
                    </span>
                  </div>
                </div>

                {/* Target Numerical Input */}
                <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                    {t('poolAllocated')}
                  </span>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={pools.outings.amountText}
                      disabled={effectiveTotalIncomeMinor <= 0}
                      onChange={(e) =>
                        handleAmountChange('outings', e.target.value, e.target)
                      }
                      onBlur={() => handleAmountBlur('outings')}
                      placeholder="0.00"
                      className="w-full min-h-[44px] px-3.5 py-2 pe-12 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono text-sm focus:border-amber-500 focus:outline-none"
                    />
                    <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-mono pointer-events-none">
                      {currency}
                    </span>
                  </div>
                </div>

                {/* Real-Time Cycle Progress & Remaining */}
                <div className="space-y-1.5 pt-1 border-t border-zinc-800/60">
                  <div className="flex justify-between items-baseline font-mono text-xs">
                    <span className="text-zinc-400">{t('poolRemaining')}:</span>
                    <span
                      className={`font-bold ${
                        evaluation.pools.outings.remaining < 0 ? 'text-red-400' : 'text-white'
                      }`}
                    >
                      {formatCurrency(evaluation.pools.outings.remaining, currency)}{' '}
                      <span className="text-zinc-500 text-[11px] font-normal">
                        / {formatCurrency(evaluation.pools.outings.allocated, currency)}
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-zinc-800/80 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        evaluation.pools.outings.remaining < 0
                          ? 'bg-red-500'
                          : 'bg-gradient-to-r from-amber-500 to-yellow-400'
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            0,
                            evaluation.pools.outings.allocated > 0
                              ? (evaluation.pools.outings.spent / evaluation.pools.outings.allocated) * 100
                              : 0
                          )
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500">
                    <span>{t('poolSpent')}: {formatCurrency(evaluation.pools.outings.spent, currency)}</span>
                    {poolHints.outings && (
                      <span className="text-amber-400 font-medium">{poolHints.outings}</span>
                    )}
                  </div>
                </div>

                {renderManualProgressControl(
                  'outings',
                  evaluation.pools.outings.allocated,
                  evaluation.pools.outings.trackedSpent,
                  evaluation.pools.outings.manualAdjustment
                )}
              </div>

              {/* Pool 4: One-Off (Exceptional Expenses) Card */}
              <div
                onClick={() => setInspectPoolKey('oneoff')}
                className={`p-4 rounded-3xl bg-zinc-900/80 border border-cyan-500/25 space-y-3 cursor-pointer hover:border-cyan-500/50 transition ${
                  effectiveTotalIncomeMinor <= 0 ? 'opacity-40 pointer-events-none' : ''
                }`}
                title={isArabic ? 'اضغط لعرض معاملات الـ One-Off' : 'Click to view One-Off transactions'}
              >
                <div className="flex items-center justify-between text-xs font-bold text-cyan-400">
                  <span className="flex items-center gap-1.5">
                    <Shield className="w-4 h-4" />
                    <span>{t('poolOneOff')}</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInspectPoolKey('oneoff');
                      }}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 font-semibold border border-cyan-500/30 flex items-center gap-1 transition cursor-pointer"
                    >
                      <span>{(evaluation.pools.oneoff.transactions || []).length} {isArabic ? 'معاملة' : 'txs'}</span>
                      <ChevronRight className="w-2.5 h-2.5 rtl:rotate-180" />
                    </button>
                    <span className="text-[10px] font-mono bg-cyan-500/20 px-2 py-0.5 rounded-full text-cyan-300 font-semibold">
                      {displayPoolPercents.oneoff}%
                    </span>
                  </div>
                </div>

                {/* Dedicated One-Off Allocation Input */}
                <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                    {t('poolAllocated')}
                  </span>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={pools.oneoff.amountText}
                      disabled={effectiveTotalIncomeMinor <= 0}
                      onChange={(e) => handleAmountChange('oneoff', e.target.value, e.target)}
                      onBlur={() => handleAmountBlur('oneoff')}
                      placeholder="0.00"
                      className="w-full min-h-[44px] px-3.5 py-2 pe-12 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono text-sm focus:border-cyan-500 focus:outline-none"
                    />
                    <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-mono pointer-events-none">
                      {currency}
                    </span>
                  </div>
                </div>

                {/* 1-Tap Allocate Current One-Off Spend Helper Button */}
                {evaluation.pools.oneoff.spent > pools.oneoff.minorUnits / 100 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApplyCurrentOneOffSpend();
                    }}
                    className="min-h-[36px] px-2.5 py-1 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-[11px] font-semibold border border-cyan-500/30 flex items-center gap-1.5 transition w-full cursor-pointer"
                  >
                    <Sliders className="w-3 h-3 shrink-0" />
                    <span className="truncate">
                      {isArabic
                        ? `تخصيص المنصرف الفعلي (${formatCurrency(evaluation.pools.oneoff.spent, currency)})`
                        : `Use current spend (${formatCurrency(evaluation.pools.oneoff.spent, currency)})`}
                    </span>
                  </button>
                )}

                {/* Funding Source Selector for Uncovered One-Off Excess */}
                <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[10px] font-semibold text-zinc-400 block">
                    {isArabic ? 'مصدر تغطية أي زيادة غير مغطاة:' : 'Cover uncovered excess from:'}
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { key: 'daily', labelAr: 'اليومي', labelEn: 'Daily' },
                      { key: 'savings', labelAr: 'التحويش', labelEn: 'Savings' },
                      { key: 'outings', labelAr: 'الخروجات', labelEn: 'Outings' },
                    ] as const).map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setOneOffFundingSource(opt.key)}
                        className={`min-h-[32px] px-2 py-1 rounded-xl text-[10px] font-bold border transition cursor-pointer ${
                          oneOffFundingSource === opt.key
                            ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-200'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {isArabic ? opt.labelAr : opt.labelEn}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Real-Time Cycle Progress & Remaining */}
                <div className="space-y-1.5 pt-1 border-t border-zinc-800/60">
                  <div className="flex justify-between items-baseline font-mono text-xs">
                    <span className="text-zinc-400">{t('poolRemaining')}:</span>
                    <span
                      className={`font-bold ${
                        evaluation.pools.oneoff.remaining < 0 ? 'text-amber-400' : 'text-white'
                      }`}
                    >
                      {formatCurrency(evaluation.pools.oneoff.remaining, currency)}{' '}
                      <span className="text-zinc-500 text-[11px] font-normal">
                        / {formatCurrency(evaluation.pools.oneoff.allocated, currency)}
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-zinc-800/80 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        evaluation.pools.oneoff.remaining < 0
                          ? 'bg-amber-500'
                          : 'bg-gradient-to-r from-cyan-500 to-teal-400'
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            0,
                            evaluation.pools.oneoff.allocated > 0
                              ? (evaluation.pools.oneoff.spent / evaluation.pools.oneoff.allocated) * 100
                              : evaluation.pools.oneoff.spent > 0
                              ? 100
                              : 0
                          )
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 flex-wrap gap-1">
                    <span>{t('poolSpent')}: {formatCurrency(evaluation.pools.oneoff.spent, currency)}</span>
                    {evaluation.pools.oneoff.coveredByEmergencyCredit > 0 && (
                      <span className="text-emerald-400 font-semibold">
                        {isArabic ? 'رصيد طوارئ:' : 'Emergency Credit:'}{' '}
                        {formatCurrency(evaluation.pools.oneoff.coveredByEmergencyCredit, currency)}
                      </span>
                    )}
                    {poolHints.oneoff && (
                      <span className="text-amber-400 font-medium">{poolHints.oneoff}</span>
                    )}
                  </div>
                </div>

                {renderManualProgressControl(
                  'oneoff',
                  evaluation.pools.oneoff.allocated,
                  evaluation.pools.oneoff.trackedSpent,
                  evaluation.pools.oneoff.manualAdjustment
                )}
              </div>

              {/* Pool 5: Daily Spending (The Calculated Remainder) */}
              <div
                onClick={() => setInspectPoolKey('daily')}
                className="sm:col-span-2 p-4 rounded-3xl bg-gradient-to-br from-emerald-950/40 via-zinc-900/90 to-zinc-900 border border-emerald-500/30 space-y-3 cursor-pointer hover:border-emerald-500/50 transition"
                title={isArabic ? 'اضغط لعرض معاملات المصروف اليومي' : 'Click to view daily transactions'}
              >
                <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                  <span className="flex items-center gap-1.5">
                    <Wallet className="w-4 h-4" />
                    <span>{t('poolDaily')}</span>
                    {evaluation.pools.total.dynamicPublicIncomeDelta !== 0 && (
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full border ${
                          evaluation.pools.total.dynamicPublicIncomeDelta > 0
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                            : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                        }`}
                      >
                        {evaluation.pools.total.dynamicPublicIncomeDelta > 0 ? '+' : ''}
                        {formatCurrency(evaluation.pools.total.dynamicPublicIncomeDelta, currency)}
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInspectPoolKey('daily');
                      }}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-semibold border border-emerald-500/30 flex items-center gap-1 transition cursor-pointer"
                    >
                      <span>{(evaluation.pools.daily.transactions || []).length} {isArabic ? 'معاملة' : 'txs'}</span>
                      <ChevronRight className="w-2.5 h-2.5 rtl:rotate-180" />
                    </button>
                    <span className="text-[10px] font-mono bg-emerald-500/20 px-2 py-0.5 rounded-full text-emerald-300 font-bold">
                      {displayPoolPercents.daily}%
                    </span>
                  </div>
                </div>

                {/* Target Calculated Remainder Display */}
                <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                    {t('poolAllocated')} ({isArabic ? 'باقي الميزانية الحية' : 'Live Remainder'})
                  </span>
                  <div className="flex items-center justify-between min-h-[44px] px-3.5 py-2 rounded-xl bg-zinc-950 border border-emerald-500/30">
                    <span className="text-xs text-zinc-400">
                      {isArabic ? 'المتبقي تلقائياً بعد الأحواض الأربعة' : 'Auto remainder after fixed pools'}
                    </span>
                    <span className="text-base font-extrabold font-mono text-white">
                      {formatCurrency(evaluation.pools.daily.allocated, currency)}
                    </span>
                  </div>
                </div>

                {/* Real-Time Cycle Progress & Remaining */}
                <div className="space-y-1.5 pt-1 border-t border-zinc-800/60">
                  <div className="flex justify-between items-baseline font-mono text-xs">
                    <span className="text-zinc-400">{t('poolRemaining')}:</span>
                    <span
                      className={`font-bold ${
                        evaluation.pools.daily.remaining < 0 ? 'text-red-400' : 'text-white'
                      }`}
                    >
                      {formatCurrency(evaluation.pools.daily.remaining, currency)}{' '}
                      <span className="text-zinc-500 text-[11px] font-normal">
                        / {formatCurrency(evaluation.pools.daily.allocated, currency)}
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-zinc-800/80 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        evaluation.pools.daily.remaining < 0
                          ? 'bg-red-500'
                          : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            0,
                            evaluation.pools.daily.allocated > 0
                              ? (evaluation.pools.daily.spent / evaluation.pools.daily.allocated) * 100
                              : 0
                          )
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                    <span>{t('poolSpent')}: {formatCurrency(evaluation.pools.daily.spent, currency)}</span>
                    <span className="text-emerald-400 font-semibold">
                      {evaluation.dailyStatus.upcomingDailyAllowance > 0
                        ? `${formatCurrency(evaluation.dailyStatus.upcomingDailyAllowance, currency)} / ${isArabic ? 'يوم' : 'day'}`
                        : ''}
                    </span>
                  </div>
                </div>

                {renderManualProgressControl(
                  'daily',
                  evaluation.pools.daily.allocated,
                  evaluation.pools.daily.trackedSpent,
                  evaluation.pools.daily.manualAdjustment
                )}
              </div>
            </div>
          </section>

          {/* =============================================================== */}
          {/* SECTION 4: BILLS & FIXED CATEGORIES SETUP */}
          {/* =============================================================== */}
          <section className="p-4 sm:p-5 rounded-3xl bg-zinc-900/80 border border-zinc-800 space-y-3">
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-white">
                {t('fixedCategoriesPicker')}
              </h4>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {t('fixedCategoriesDesc')}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-1 max-h-48 overflow-y-auto">
              {categories.length === 0 ? (
                <div className="p-2 text-xs text-zinc-500">
                  {isArabic ? 'لا توجد فئات' : 'No categories found'}
                </div>
              ) : (
                categories.map((cat) => {
                  const isSelected = selectedFixedCatIds.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleToggleFixedCategory(cat.id)}
                      className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-2 cursor-pointer ${
                        isSelected
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow'
                          : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700'
                      }`}
                    >
                      <span>{cat.icon || '📁'}</span>
                      <span>{cat.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </section>

          {/* =============================================================== */}
          {/* SECTION 5: TOOLS & ALERTS */}
          {/* =============================================================== */}
          <section className="space-y-4">
            {/* 3-Mode What-If Future-Impact Simulator Card */}
            <div className="p-4 sm:p-5 rounded-3xl bg-zinc-900/80 border border-zinc-800 space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs sm:text-sm font-bold text-white">
                    {t('whatIfSimulatorTitle')}
                  </h4>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                  {isArabic ? 'تحليل مستقبلي 3 أوضاع' : '3-Mode Forecast'}
                </span>
              </div>
              <p className="text-xs text-zinc-400">{t('whatIfSimulatorDesc')}</p>

              {/* 3-Mode Segmented Control */}
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-zinc-950 border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setWhatIfMode('single_expense')}
                  className={`min-h-[38px] px-2 py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer ${
                    whatIfMode === 'single_expense'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {isArabic ? 'مصروف مرة واحدة' : 'Single Expense'}
                </button>
                <button
                  type="button"
                  onClick={() => setWhatIfMode('multi_day_expense')}
                  className={`min-h-[38px] px-2 py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer ${
                    whatIfMode === 'multi_day_expense'
                      ? 'bg-amber-600 text-white shadow'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {isArabic ? 'صرف لـ N أيام' : 'N-Day Spend'}
                </button>
                <button
                  type="button"
                  onClick={() => setWhatIfMode('extra_income')}
                  className={`min-h-[38px] px-2 py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer ${
                    whatIfMode === 'extra_income'
                      ? 'bg-teal-600 text-white shadow'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {isArabic ? 'دخل إضافي' : 'Extra Income'}
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                    {whatIfMode === 'multi_day_expense'
                      ? isArabic ? 'المبلغ المتوقع يومياً' : 'Expected Daily Spend Amount'
                      : whatIfMode === 'extra_income'
                      ? isArabic ? 'مبلغ الدخل الإضافي المتوقع' : 'Expected Extra Income Amount'
                      : t('whatIfAmount')}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={whatIfAmount}
                      onChange={(e) => setWhatIfAmount(e.target.value)}
                      placeholder="e.g. 500"
                      className="w-full min-h-[44px] px-3.5 py-2 pe-12 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono text-sm focus:border-emerald-500 focus:outline-none"
                    />
                    <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-mono pointer-events-none">
                      {currency}
                    </span>
                  </div>
                </div>

                {/* Days Count Stepper & Quick Presets for Multi-Day Mode */}
                {whatIfMode === 'multi_day_expense' && (
                  <div className="p-3 rounded-2xl bg-zinc-950/90 border border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-zinc-300">
                        {isArabic ? 'عدد الأيام:' : 'Number of days:'}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setWhatIfDaysCount((d) => Math.max(1, d - 1))}
                          className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 flex items-center justify-center hover:bg-zinc-800 cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="min-w-[2.5rem] text-center font-mono font-bold text-sm text-amber-300">
                          {Math.min(Math.max(1, evaluation.dailyStatus.remainingDaysInCycle), whatIfDaysCount)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setWhatIfDaysCount((d) =>
                              Math.min(Math.max(1, evaluation.dailyStatus.remainingDaysInCycle), d + 1)
                            )
                          }
                          className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 flex items-center justify-center hover:bg-zinc-800 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[3, 5, 7, Math.max(1, evaluation.dailyStatus.remainingDaysInCycle)].map((presetDays, idx) => (
                        <button
                          key={`${presetDays}_${idx}`}
                          type="button"
                          onClick={() => setWhatIfDaysCount(presetDays)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                            whatIfDaysCount === presetDays
                              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          {idx === 3
                            ? isArabic ? `باقي الشهر (${presetDays})` : `Rest of cycle (${presetDays})`
                            : isArabic ? `${presetDays} أيام` : `${presetDays} days`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {whatIfMode !== 'extra_income' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-400 mb-1.5">
                      {t('whatIfPool')}
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => setWhatIfPool('daily')}
                        className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          whatIfPool === 'daily'
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <Wallet className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{t('poolDaily')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setWhatIfPool('outings')}
                        className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          whatIfPool === 'outings'
                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <Coffee className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{t('poolOutings')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setWhatIfPool('fixed')}
                        className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          whatIfPool === 'fixed'
                            ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{t('poolFixed')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setWhatIfPool('oneoff')}
                        className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          whatIfPool === 'oneoff'
                            ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <Shield className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{t('poolOneOff')}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Instant Rich Forecast & 3-Way Pool Comparison Display */}
              {whatIfReport && (
                <div dir={isMsgArabic ? 'rtl' : 'ltr'} className="pt-3 border-t border-zinc-800 space-y-3">
                  {/* Severity Headline Banner */}
                  <div
                    className={`p-3.5 rounded-2xl border space-y-1.5 ${
                      whatIfReport.severity === 'positive'
                        ? 'bg-emerald-950/35 border-emerald-500/40 text-emerald-200'
                        : whatIfReport.severity === 'safe'
                        ? 'bg-teal-950/30 border-teal-500/35 text-teal-200'
                        : whatIfReport.severity === 'caution'
                        ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                        : whatIfReport.severity === 'warning'
                        ? 'bg-orange-950/35 border-orange-500/45 text-orange-200'
                        : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold leading-snug whitespace-normal break-words">{whatIfReport.headline}</span>
                      <TrendingUp className="w-4 h-4 shrink-0 opacity-85 mt-0.5" />
                    </div>
                    <p className="text-[11px] leading-relaxed opacity-90 whitespace-normal break-words">{whatIfReport.recommendation}</p>
                  </div>

                  {/* Rich KPI Telemetry Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="p-2.5 rounded-2xl bg-zinc-950 border border-zinc-800/80">
                      <div className="text-[10px] text-zinc-400">{whatIfReport.poolName}</div>
                      <div className="text-xs font-mono tabular-nums font-bold text-white mt-0.5">
                        {formatCurrency(whatIfReport.poolBefore, currency)} {'->'}{' '}
                        <span className={whatIfReport.poolAfter < 0 ? 'text-rose-400' : 'text-emerald-400'}>
                          {formatCurrency(whatIfReport.poolAfter, currency)}
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-2xl bg-zinc-950 border border-zinc-800/80">
                      <div className="text-[10px] text-zinc-400">
                        {isMsgArabic ? 'يوميتك للأيام الجاية' : 'Daily Limit Ahead'}
                      </div>
                      <div className="text-xs font-mono tabular-nums font-bold text-white mt-0.5">
                        {formatCurrency(whatIfReport.allowanceBefore, currency)} {'->'}{' '}
                        <span className={whatIfReport.dailyDelta >= 0 ? 'text-emerald-400' : 'text-amber-300'}>
                          {formatCurrency(whatIfReport.allowanceAfter, currency)}
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-2xl bg-zinc-950 border border-zinc-800/80">
                      <div className="text-[10px] text-zinc-400">
                        {isMsgArabic ? 'هتكفّي كام يوم' : 'Budget Runway'}
                      </div>
                      <div className="text-xs font-mono tabular-nums font-bold text-white mt-0.5">
                        {whatIfReport.runwayDaysBefore}{isMsgArabic ? 'ي' : 'd'} {'->'}{' '}
                        <span
                          className={
                            whatIfReport.runwayDaysAfter < whatIfReport.remainingDaysInCycle
                              ? 'text-rose-400'
                              : 'text-emerald-400'
                          }
                        >
                          {whatIfReport.runwayDaysAfter}{isMsgArabic ? 'ي' : 'd'}
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-2xl bg-zinc-950 border border-zinc-800/80">
                      <div className="text-[10px] text-zinc-400">
                        {whatIfReport.dailyRecoveryNeeded > 0
                          ? isMsgArabic ? 'توفّر كام في اليوم' : 'Daily Recovery'
                          : isMsgArabic ? 'المتبقي لآخر الشهر' : 'Month-End Outlook'}
                      </div>
                      <div className="text-xs font-mono tabular-nums font-bold text-white mt-0.5">
                        {whatIfReport.dailyRecoveryNeeded > 0
                          ? `${formatCurrency(whatIfReport.dailyRecoveryNeeded, currency)}/${isMsgArabic ? 'ي' : 'd'}`
                          : formatCurrency(whatIfReport.projectedCycleEndBalance, currency)}
                      </div>
                    </div>
                  </div>

                  {/* Detailed Forecast Bullets */}
                  {whatIfReport.detailedMessages.length > 0 && (
                    <ul className="p-3 rounded-2xl bg-zinc-950/90 border border-zinc-800/80 space-y-1.5 text-[11px] text-zinc-300">
                      {whatIfReport.detailedMessages.map((msg, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                          <span className="leading-relaxed whitespace-normal break-words">{msg}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* 3-Way Pool Comparison Cards */}
                  {whatIfReport.poolComparison && whatIfReport.poolComparison.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-bold text-zinc-300">
                        {isMsgArabic ? 'لو سجّلتها في كل بند هيحصل إيه:' : 'How Each Pool Handles This:'}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {whatIfReport.poolComparison.map((item) => (
                          <div
                            key={item.pool}
                            className={`p-2.5 rounded-2xl border space-y-1 ${
                              item.isOptimal
                                ? 'bg-emerald-950/35 border-emerald-500/50'
                                : 'bg-zinc-950 border-zinc-800/80'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-bold text-white">{item.label}</span>
                              {item.isOptimal && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  {isMsgArabic ? 'أحسن اختيار ✓' : 'Best Choice ✓'}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono tabular-nums text-zinc-300">
                              {isMsgArabic ? 'يوميتك:' : 'Daily:'} {formatCurrency(item.dailyAllowanceAfter, currency)}
                            </div>
                            <div className="text-[10px] text-zinc-400 leading-snug whitespace-normal break-words">{item.note}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Rebalance Options (Shown ONLY if there is a deficit) */}
            {evaluation.rebalanceScenarios.hasDeficit && (
              <div
                dir={isMsgArabic ? 'rtl' : 'ltr'}
                className="p-4 sm:p-5 rounded-3xl bg-red-950/20 border border-red-500/30 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4.5 h-4.5 text-red-400 shrink-0" />
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-white">
                        {isMsgArabic ? 'إزاي نلمّ العجز ده بسرعة؟' : 'Easy Ways to Balance Your Month'}
                      </h4>
                      <p className="text-[11px] text-zinc-400">
                        {isMsgArabic
                          ? 'اختار الطريقة اللي تريحك وهنظبّطلك باقي الشهر في ضغطة واحدة:'
                          : 'Pick whichever tweak feels easiest — we will adjust the rest cleanly:'}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono tabular-nums font-extrabold text-red-400 bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/20">
                    -{formatCurrency(evaluation.rebalanceScenarios.deficit, currency)}
                  </span>
                </div>

                {/* Top 3 Overspend Categories */}
                {topOverspendCategories.length > 0 && (
                  <div className="p-3 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-2">
                    <div className="text-[11px] font-semibold text-zinc-400">
                      {isMsgArabic ? 'أكتر حاجات سحبت من الميزانية:' : 'Biggest drains this cycle:'}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {topOverspendCategories.map((c, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-zinc-900 border border-zinc-800/60 text-xs">
                          <span className="flex items-center gap-1.5 truncate">
                            <span>{c.icon}</span>
                            <span className="text-zinc-200 truncate">{c.name}</span>
                          </span>
                          <span className="font-mono tabular-nums font-bold text-red-400 shrink-0">
                            {formatCurrency(c.amount, currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3 Rebalance Scenario Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Scenario A: Trim Bills */}
                  <div className="p-3.5 rounded-2xl bg-zinc-950 border border-purple-500/20 flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                        <ShoppingBag className="w-3.5 h-3.5" />
                        {isMsgArabic ? 'اخفض الخروجات أو الفواتير' : 'Trim Outings & Bills'}
                      </span>
                      <p className="text-[11px] text-zinc-400 leading-relaxed whitespace-normal break-words">
                        {isMsgArabic
                          ? 'نشيل الفرق من مخصص الفواتير أو الخروجات ونسيب يوميتك والتحويش في أمان.'
                          : 'Trim discretionary planned space first so your daily cash and Savings stay intact.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleApplyScenario('scenario_a')}
                      className="w-full min-h-[44px] py-1.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition cursor-pointer"
                    >
                      {isMsgArabic ? 'نفّذ الخيار ده' : 'Apply This'}
                    </button>
                  </div>

                  {/* Scenario B: Absorb via Savings */}
                  <div className="p-3.5 rounded-2xl bg-zinc-950 border border-blue-500/20 flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                        <PiggyBank className="w-3.5 h-3.5" />
                        {isMsgArabic ? 'غطّي من وسادة التحويش' : 'Cover via Savings Cushion'}
                      </span>
                      <p className="text-[11px] text-zinc-400 leading-relaxed whitespace-normal break-words">
                        {isMsgArabic
                          ? 'نسحب الفرق من تحويش الشهر ده مؤقتاً عشان مصروفك اليومي يكمل مستريح.'
                          : 'Use part of this cycle’s Savings target to absorb the bump without squeezing daily spending.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleApplyScenario('scenario_b')}
                      className="w-full min-h-[44px] py-1.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition cursor-pointer"
                    >
                      {isMsgArabic ? 'نفّذ الخيار ده' : 'Apply This'}
                    </button>
                  </div>

                  {/* Scenario C: Reduce Daily Allowance */}
                  <div className="p-3.5 rounded-2xl bg-zinc-950 border border-emerald-500/20 flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5" />
                        {isMsgArabic ? 'قسّمها على باقي الأيام' : 'Spread Over Remaining Days'}
                      </span>
                      <p className="text-[11px] text-zinc-400 leading-relaxed whitespace-normal break-words">
                        {isMsgArabic
                          ? 'نوزع الفرق بهدوء على يومية باقي الشهر ومنجيش جنب هدف التحويش خالص.'
                          : 'Gently lower your daily limit ahead while keeping Savings and Bills targets untouched.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleApplyScenario('scenario_c')}
                      className="w-full min-h-[44px] py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer"
                    >
                      {isMsgArabic ? 'نفّذ الخيار ده' : 'Apply This'}
                    </button>
                  </div>
                </div>

                {/* Revert override button if active */}
                {currentOverride && (
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleRevertToBaseline}
                      className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-amber-300 text-xs font-bold border border-amber-500/30 flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{t('revertToBaseline')}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Heads-up Alert Threshold Slider Card */}
            <div className="p-4 sm:p-5 rounded-3xl bg-zinc-900/80 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-white">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-emerald-400" />
                  <span>{t('headsUpThresholdLabel')}</span>
                </span>
                <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  {headsUpThresholdPercent}%
                </span>
              </div>
              <input
                type="range"
                min={30}
                max={95}
                step={5}
                value={headsUpThresholdPercent}
                onChange={(e) => setHeadsUpThresholdPercent(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-500 cursor-pointer min-h-[44px]"
              />
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                {t('headsUpThresholdDesc')}
              </p>
            </div>
          </section>
        </div>

        {/* Sticky Action Footer */}
        <div className="shrink-0 p-4 sm:px-6 border-t border-zinc-800/80 bg-zinc-900 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveBudgetPlan}
            className="flex-1 min-h-[48px] py-2.5 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-bold text-sm shadow-xl shadow-emerald-950/40 transition cursor-pointer flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{isArabic ? 'تطبيق وحفظ التغييرات' : 'Apply & Save Changes'}</span>
          </button>
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="min-h-[48px] px-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition cursor-pointer shrink-0 flex items-center justify-center"
            title={t('resetToDefault')}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Pool Transactions Inspection Modal */}
      {inspectPoolKey && (
        <div
          className="modal-safe-overlay fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/80 transition-opacity duration-200"
          onClick={() => setInspectPoolKey(null)}
        >
          <div
            className="relative w-full max-w-lg max-h-[85vh] flex flex-col rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-zinc-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
                    inspectPoolKey === 'savings'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : inspectPoolKey === 'fixed'
                      ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                      : inspectPoolKey === 'outings'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : inspectPoolKey === 'oneoff'
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  {inspectPoolKey === 'savings' && <PiggyBank className="w-5 h-5" />}
                  {inspectPoolKey === 'fixed' && <ShoppingBag className="w-5 h-5" />}
                  {inspectPoolKey === 'outings' && <Coffee className="w-5 h-5" />}
                  {inspectPoolKey === 'oneoff' && <Shield className="w-5 h-5" />}
                  {inspectPoolKey === 'daily' && <Wallet className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">
                    {inspectPoolKey === 'savings'
                      ? (isArabic ? 'معاملات التحويش والادخار' : 'Savings Transactions')
                      : inspectPoolKey === 'fixed'
                      ? (isArabic ? 'معاملات الفواتير والالتزامات' : 'Bills & Fixed Transactions')
                      : inspectPoolKey === 'outings'
                      ? (isArabic ? 'معاملات الخروجات' : 'Outings Transactions')
                      : inspectPoolKey === 'oneoff'
                      ? (isArabic ? 'معاملات المصاريف الاستثنائية (One-Off)' : 'One-Off Transactions')
                      : (isArabic ? 'معاملات المصروف اليومي' : 'Daily Spending Transactions')}
                  </h3>
                  <div className="text-[11px] text-zinc-400 flex items-center gap-2">
                    <span>
                      {(evaluation.pools[inspectPoolKey]?.transactions || []).length}{' '}
                      {isArabic ? 'معاملة مسجلة' : 'transactions'}
                    </span>
                    <span>•</span>
                    <span className="font-mono text-zinc-300">
                      {inspectPoolKey === 'savings'
                        ? `${isArabic ? 'إجمالي المحوّش' : 'Total Saved'}: ${formatCurrency(evaluation.pools.savings.netSaved, currency)}`
                        : `${isArabic ? 'إجمالي المنصرف' : 'Total Spent'}: ${formatCurrency(evaluation.pools[inspectPoolKey]?.spent || 0, currency)}`}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectPoolKey(null)}
                className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
              {(evaluation.pools[inspectPoolKey]?.transactions || []).length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-xs">
                  {isArabic
                    ? 'لا توجد معاملات مسجلة في هذا البند خلال دورة الشهر الحالية.'
                    : 'No transactions marked for this pool in the current cycle.'}
                </div>
              ) : (
                (evaluation.pools[inspectPoolKey]?.transactions || [])
                  .slice()
                  .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0))
                  .map((tx) => {
                    const fromAcc = accounts.find((a) => a.id === tx.accountId);
                    const toAcc = accounts.find((a) => a.id === tx.toAccountId);
                    const isTransfer = tx.type === 'transfer' || Boolean(tx.toAccountId);

                    return (
                      <div
                        key={tx.id}
                        onClick={() => {
                          setInspectPoolKey(null);
                          if (typeof openTxDetailsModal === 'function') {
                            openTxDetailsModal(tx);
                          }
                        }}
                        className="p-3 rounded-2xl bg-zinc-900/70 hover:bg-zinc-800/80 border border-zinc-800/80 flex items-center justify-between gap-3 transition cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-zinc-800 text-sm">
                            {isTransfer ? (
                              <RefreshCw className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <span>{tx.categoryIcon || '💰'}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate group-hover:text-blue-400 transition">
                              {isTransfer
                                ? `${tx.fromAccountName || fromAcc?.name || 'Account'} → ${tx.toAccountName || toAcc?.name || 'Account'}`
                                : (tx.description || tx.categoryName || 'Transaction')}
                            </div>
                            <div className="text-[10px] text-zinc-400 flex items-center gap-1.5 truncate">
                              <span>{tx.date}</span>
                              {tx.note && (
                                <span className="truncate italic max-w-[120px] text-zinc-500">
                                  "{tx.note}"
                                </span>
                              )}
                              {tx.isSavingsAllocation && (
                                <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                                  {isArabic ? 'تحويش' : 'Savings'}
                                </span>
                              )}
                              {tx.budgetPool && tx.budgetPool !== 'daily' && (
                                <span className="px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-300 font-mono">
                                  {tx.budgetPool}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-end shrink-0">
                          <div
                            className={`font-mono text-xs font-bold ${
                              isTransfer
                                ? 'text-emerald-400'
                                : tx.type === 'income'
                                ? 'text-emerald-400'
                                : 'text-zinc-200'
                            }`}
                          >
                            {isTransfer ? '⇄ ' : tx.type === 'income' ? '+ ' : '- '}
                            {formatCurrency(tx.amount || 0, currency)}
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-zinc-800/80 bg-zinc-950 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectPoolKey(null)}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white transition cursor-pointer"
              >
                {isArabic ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
