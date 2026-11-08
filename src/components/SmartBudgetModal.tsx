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
} from 'lucide-react';
import { useApp } from '../context/AppContext';
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
import {
  SmartBudgetBaselineConfig,
  SmartBudgetCycleOverride,
  SmartBudgetCycleStartMode,
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

  if (incomeMinor > 0 && sMinor + fMinor + oMinor > incomeMinor) {
    const excess = sMinor + fMinor + oMinor - incomeMinor;
    if (oMinor >= excess) {
      oMinor -= excess;
    } else {
      const rem = excess - oMinor;
      oMinor = 0;
      fMinor = Math.max(0, fMinor - rem);
    }
  }

  const sFinalPct =
    incomeMinor > 0 ? Math.round(((sMinor / incomeMinor) * 100) * 10) / 10 : 0;
  const fFinalPct =
    incomeMinor > 0 ? Math.round(((fMinor / incomeMinor) * 100) * 10) / 10 : 0;
  const oFinalPct =
    incomeMinor > 0 ? Math.round(((oMinor / incomeMinor) * 100) * 10) / 10 : 0;

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
  } = useApp();

  const isArabic = settings.language === 'ar';
  const currency = settings.currencySymbol || 'EGP';
  const formatCurrency = (amount: number, curr = currency) =>
    `${formatNumberWithCommas(amount, 2)} ${curr}`;

  const inspectPoolKey = activePoolDrillDown;
  const setInspectPoolKey = setActivePoolDrillDown;

  // ==========================================================================
  // WHAT-IF SIMULATOR STATE
  // ==========================================================================
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
  const [poolHints, setPoolHints] = useState<{
    savings: string | null;
    fixed: string | null;
    outings: string | null;
  }>({ savings: null, fixed: null, outings: null });

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
    const spendingAccounts = accounts.filter((a) => isSpendingOrCustomiseRole(a.accountRole));
    return spendingAccounts.length > 0
      ? spendingAccounts.map((a) => a.id)
      : accounts.map((a) => a.id);
  });

  const [isLinkedAccountsOpen, setIsLinkedAccountsOpen] = useState<boolean>(false);
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
      .filter((a) => selectedAccountIds.includes(a.id))
      .reduce((sum, a) => sum + (a.balance || 0), 0);
  }, [accounts, selectedAccountIds]);

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
      (pools.savings.minorUnits + pools.fixed.minorUnits + pools.outings.minorUnits)
  );
  const dailyPercent =
    incomeMinor > 0
      ? Math.max(0, Math.round(((dailyMinor / incomeMinor) * 100) * 10) / 10)
      : Math.max(
          0,
          Math.round((100 - (pools.savings.percent + pools.fixed.percent + pools.outings.percent)) * 10) / 10
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
  const evaluation: SmartBudgetEvaluation = useMemo(() => {
    const draftPlanned = parseFloat(plannedIncomeInput.replace(/,/g, '')) || 0;
    const effectiveIncome =
      baselineCalculationMode === 'from_today'
        ? liveBudget
        : baselineSettings.plannedIncome || draftPlanned;

    const sMinor = pools.savings.minorUnits;
    const fMinor = pools.fixed.minorUnits;
    const oMinor = pools.outings.minorUnits;
    const sPct = incomeMinor > 0 ? Math.round(((sMinor / incomeMinor) * 100) * 10) / 10 : 0;
    const fPct = incomeMinor > 0 ? Math.round(((fMinor / incomeMinor) * 100) * 10) / 10 : 0;
    const oPct = incomeMinor > 0 ? Math.round(((oMinor / incomeMinor) * 100) * 10) / 10 : 0;

    const config: SmartBudgetConfig = {
      baseCurrency: currency,
      startDay: globalMonthStartDay,
      cycleStartMode,
      customStartDay: cycleStartMode === 'custom' ? customStartDay : undefined,
      customStartDate: cycleStartMode === 'custom' ? customStartDate : undefined,
      plannedIncome: effectiveIncome > 0 ? effectiveIncome : undefined,
      savings: { type: 'fixed', value: sMinor / 100 },
      plannedFixedObligations: fMinor / 100,
      outingsBudget: oMinor / 100,
      fixedCategoryIds: selectedFixedCatIds,
      includedAccountIds: selectedAccountIds,
      calculationMode: baselineCalculationMode,
      fromTodayConfig: {
        fromDate: formatLocalDate(new Date()),
        linkedAccountIds: selectedAccountIds,
        manualAdjustment: parsedAdjustment,
        remainingMoney: liveBudget,
        remainingMoneyMinor: Math.round(liveBudget * 100),
      },
      headsUpThresholdRatio:
        baselineSettings.headsUpThresholdRatio ?? headsUpThresholdPercent / 100,
      poolsConfig: {
        savings: {
          minorUnits: sMinor,
          percent: sPct,
          mode: 'amount',
        },
        fixed: {
          minorUnits: fMinor,
          percent: fPct,
          mode: 'amount',
        },
        outings: {
          minorUnits: oMinor,
          percent: oPct,
          mode: 'amount',
        },
      },
      overrides: settings.smartBudget?.overrides,
      adjustments: settings.smartBudget?.adjustments,
      weekdayWeights:
        weekendMultiplier !== 1.0
          ? { 4: weekendMultiplier, 5: weekendMultiplier }
          : undefined,
    };
    return evaluateSmartBudget(
      transactions,
      accounts,
      config,
      new Date()
    );
  }, [
    transactions,
    accounts,
    currency,
    globalMonthStartDay,
    cycleStartMode,
    customStartDay,
    customStartDate,
    baselineSettings.plannedIncome,
    baselineSettings.headsUpThresholdRatio,
    plannedIncomeInput,
    baselineCalculationMode,
    liveBudget,
    incomeMinor,
    pools.savings.minorUnits,
    pools.fixed.minorUnits,
    pools.outings.minorUnits,
    selectedFixedCatIds,
    selectedAccountIds,
    parsedAdjustment,
    headsUpThresholdPercent,
    settings.smartBudget?.overrides,
    settings.smartBudget?.adjustments,
    weekendMultiplier,
  ]);

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
      };
    }

    let sMinor = prev.savings.minorUnits;
    let fMinor = prev.fixed.minorUnits;
    let oMinor = prev.outings.minorUnits;

    const totalMinor = sMinor + fMinor + oMinor;
    if (totalMinor > newMinor) {
      const excess = totalMinor - newMinor;
      if (oMinor >= excess) {
        oMinor -= excess;
      } else {
        const rem = excess - oMinor;
        oMinor = 0;
        fMinor = Math.max(0, fMinor - rem);
      }
    }

    const sPct = Math.round(((sMinor / newMinor) * 100) * 10) / 10;
    const fPct = Math.round(((fMinor / newMinor) * 100) * 10) / 10;
    const oPct = Math.round(((oMinor / newMinor) * 100) * 10) / 10;

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
    };
  };

  const handlePlannedIncomeChange = (valStr: string, inputEl?: HTMLInputElement | null) => {
    const newIncome = formatIncomeWithCaret(valStr, inputEl || null, setPlannedIncomeInput);
    const newMinor = Math.round(newIncome * 100);
    setPools((prev) => recomputePoolsForNewIncome(prev, newMinor));
  };

  const applyDualAmountChange = (
    poolKey: 'savings' | 'fixed' | 'outings',
    rawInput: string,
    inputEl: HTMLInputElement | null,
    targetIncomeMinor: number,
    currentPools: PoolsState,
    setPoolsFn: React.Dispatch<React.SetStateAction<PoolsState>>,
    setHintsFn: React.Dispatch<
      React.SetStateAction<{ savings: string | null; fixed: string | null; outings: string | null }>
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
    if (poolKey === 'savings') otherMinor = currentPools.fixed.minorUnits + currentPools.outings.minorUnits;
    if (poolKey === 'fixed') otherMinor = currentPools.savings.minorUnits + currentPools.outings.minorUnits;
    if (poolKey === 'outings') otherMinor = currentPools.savings.minorUnits + currentPools.fixed.minorUnits;

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
    poolKey: 'savings' | 'fixed' | 'outings',
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
          amountText: formatNumberWithCommas(minor / 100, 2),
        },
      };
    });
  };

  const handleAmountChange = (
    poolKey: 'savings' | 'fixed' | 'outings',
    rawInput: string,
    inputEl: HTMLInputElement | null
  ) =>
    applyDualAmountChange(
      poolKey,
      rawInput,
      inputEl,
      incomeMinor,
      pools,
      setPools,
      setPoolHints
    );

  const handleAmountBlur = (poolKey: 'savings' | 'fixed' | 'outings') =>
    applyDualAmountBlur(poolKey, incomeMinor, setPools);

  const handleApplyDetectedRecurringBills = () => {
    if (detectedRecurringBills <= 0) return;
    const detectedMinor = Math.round(detectedRecurringBills * 100);

    if (incomeMinor > 0) {
      const otherMinor = pools.savings.minorUnits + pools.outings.minorUnits;
      const maxMinor = Math.max(0, incomeMinor - otherMinor);
      const finalMinor = Math.min(detectedMinor, maxMinor);
      const derivedPct = Math.round(((finalMinor / incomeMinor) * 100) * 10) / 10;

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

  const handleSelectLinkedAccountsPreset = (preset: 'non_savings' | 'all') => {
    const primaryAccounts = accounts.filter(
      (a) => !a.currency || normalizeCurrencyCodeOrSymbol(a.currency) === normalizeCurrencyCodeOrSymbol(currency)
    );
    let nextIds: string[];
    if (preset === 'all') {
      nextIds = primaryAccounts.map((a) => a.id);
    } else {
      nextIds = primaryAccounts
        .filter((a) => isSpendingOrCustomiseRole(a.accountRole))
        .map((a) => a.id);
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
  // WHAT-IF SIMULATOR CALCULATION (100% LOCAL DETERMINISTIC MATH)
  // ==========================================================================
  const whatIfCalculation = useMemo(() => {
    const simulatedExpenseNumber = Math.max(0, parseFloat(whatIfAmount.replace(/,/g, '')) || 0);
    const remainingDaysInCycle = evaluation.dailyStatus.remainingDaysInCycle;
    const isLastDay = remainingDaysInCycle <= 1;

    let poolName = t('poolDaily');
    let poolBefore = evaluation.pools.daily.remaining;
    let poolAfter = poolBefore - simulatedExpenseNumber;
    let spilloverToDaily = simulatedExpenseNumber;
    let isCoveredByEmergency = false;

    if (whatIfPool === 'outings') {
      poolName = t('poolOutings');
      poolBefore = evaluation.pools.outings.remaining;
      poolAfter = poolBefore - simulatedExpenseNumber;
      if (poolBefore > 0) {
        spilloverToDaily = Math.max(0, simulatedExpenseNumber - poolBefore);
      } else {
        spilloverToDaily = simulatedExpenseNumber;
      }
    } else if (whatIfPool === 'fixed') {
      poolName = t('poolFixed');
      poolBefore = evaluation.pools.fixed.remaining;
      poolAfter = poolBefore - simulatedExpenseNumber;
      if (poolBefore > 0) {
        spilloverToDaily = Math.max(0, simulatedExpenseNumber - poolBefore);
      } else {
        spilloverToDaily = simulatedExpenseNumber;
      }
    } else if (whatIfPool === 'daily') {
      poolName = t('poolDaily');
      poolBefore = evaluation.pools.daily.remaining;
      poolAfter = poolBefore - simulatedExpenseNumber;
      spilloverToDaily = simulatedExpenseNumber;
    } else if (whatIfPool === 'oneoff') {
      poolName = t('poolOneOff');
      const emergencyCredit = evaluation.pools.savings.remainingEmergencyCredit;
      poolBefore = emergencyCredit;
      poolAfter = Math.max(0, emergencyCredit - simulatedExpenseNumber);
      spilloverToDaily = 0;
      isCoveredByEmergency = true;
    }

    const allowanceBefore = isLastDay
      ? Math.max(0, evaluation.dailyStatus.todayRemaining)
      : evaluation.dailyStatus.upcomingDailyAllowance;

    let allowanceAfter = allowanceBefore;
    let dailyImpact = 0;

    if (simulatedExpenseNumber === 0) {
      allowanceAfter = allowanceBefore;
      dailyImpact = 0;
    } else if (whatIfPool === 'oneoff') {
      allowanceAfter = allowanceBefore;
      dailyImpact = 0;
    } else if (isLastDay) {
      allowanceAfter = Math.max(0, allowanceBefore - spilloverToDaily);
      dailyImpact = allowanceAfter - allowanceBefore;
    } else {
      allowanceAfter = evaluation.projectedDailyAllowanceAfterSpend(
        simulatedExpenseNumber,
        whatIfPool,
        evaluation.dailyStatus.asOfDate
      );
      dailyImpact = allowanceAfter - allowanceBefore;
    }

    return {
      poolName,
      poolBefore,
      poolAfter,
      spilloverToDaily,
      isCoveredByEmergency,
      isLastDay,
      remainingDaysInCycle,
      allowanceBefore,
      allowanceAfter,
      dailyImpact,
    };
  }, [whatIfAmount, whatIfPool, evaluation, t]);

  // ==========================================================================
  // ACTIONS: SAVE BUDGET PLAN
  // ==========================================================================
  const handleSaveBudgetPlan = () => {
    const planned = parseFloat(plannedIncomeInput.replace(/,/g, '')) || 0;
    const sMinor = pools.savings.minorUnits;
    const fMinor = pools.fixed.minorUnits;
    const oMinor = pools.outings.minorUnits;
    const sPct = incomeMinor > 0 ? Math.round(((sMinor / incomeMinor) * 100) * 10) / 10 : 0;
    const fPct = incomeMinor > 0 ? Math.round(((fMinor / incomeMinor) * 100) * 10) / 10 : 0;
    const oPct = incomeMinor > 0 ? Math.round(((oMinor / incomeMinor) * 100) * 10) / 10 : 0;

    const newBaseline: SmartBudgetBaselineConfig = {
      startDay: globalMonthStartDay,
      cycleStartMode,
      customStartDay: cycleStartMode === 'custom' ? customStartDay : undefined,
      customStartDate: cycleStartMode === 'custom' ? customStartDate : undefined,
      plannedIncome: planned > 0 ? planned : undefined,
      savings: { type: 'fixed', value: sMinor / 100 },
      plannedFixedObligations: fMinor / 100,
      outingsBudget: oMinor / 100,
      fixedCategoryIds: selectedFixedCatIds,
      includedAccountIds: selectedAccountIds,
      calculationMode: baselineCalculationMode,
      fromTodayConfig: {
        fromDate: evaluation.cycle.startDate,
        linkedAccountIds: selectedAccountIds,
        manualAdjustment: parsedAdjustment,
        remainingMoney: liveBudget,
        remainingMoneyMinor: Math.round(liveBudget * 100),
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
        savings: {
          minorUnits: sMinor,
          percent: sPct,
          mode: 'amount',
        },
        fixed: {
          minorUnits: fMinor,
          percent: fPct,
          mode: 'amount',
        },
        outings: {
          minorUnits: oMinor,
          percent: oPct,
          mode: 'amount',
        },
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
    });
    setHeadsUpThresholdPercent(70);
    setPoolHints({ savings: null, fixed: null, outings: null });
    showToast(t('resetToDefault'), 'info');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md transition-opacity duration-200"
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
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-950/40">
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 min-w-0">
          {/* =============================================================== */}
          {/* SECTION 1: GLOBAL SETTINGS & FUNDING */}
          {/* =============================================================== */}
          <section className="space-y-4">
            {/* Cycle Info Banner & Pause Toggle */}
            <div className="p-4 sm:p-5 rounded-3xl bg-zinc-900/80 border border-zinc-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Calendar className="w-4 h-4 text-blue-400 shrink-0" />
                    <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                      {evaluation.cycle.label}
                    </h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                      {currentCycleKey}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    {isArabic
                      ? `اليوم ${evaluation.dailyStatus.cycleDayIndex} من ${evaluation.dailyStatus.cycleLength} · متبقي ${evaluation.dailyStatus.remainingDaysInCycle} يوماً`
                      : `Day ${evaluation.dailyStatus.cycleDayIndex} of ${evaluation.dailyStatus.cycleLength} · ${evaluation.dailyStatus.remainingDaysInCycle} days left`}
                  </p>
                </div>

                {/* Pause Smart Budget for this month toggle */}
                <button
                  type="button"
                  onClick={handleToggleCyclePause}
                  className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-2 cursor-pointer ${
                    isCyclePaused
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                      : 'bg-zinc-800 hover:bg-zinc-750 text-zinc-300 border-zinc-700'
                  }`}
                >
                  <Shield className={`w-3.5 h-3.5 ${isCyclePaused ? 'text-amber-400' : 'text-zinc-400'}`} />
                  <span>
                    {isCyclePaused
                      ? t('smartBudgetPausedBadge')
                      : t('pauseSmartBudgetThisMonth')}
                  </span>
                </button>
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

              {/* Cycle Start Mode Selector (4 Options) */}
              <div className="space-y-2.5 pt-2 border-t border-zinc-800/80">
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

              {/* Linked Funding Accounts or Planned Income */}
              {baselineCalculationMode === 'from_today' ? (
                <div className="space-y-3 pt-2 border-t border-zinc-800/80">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-white">
                        {t('linkedFundingAccountsTitle')}
                      </h4>
                      <p className="text-[11px] text-zinc-400">
                        {t('linkedFundingAccountsDesc')}
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

                  {/* Live Budget Banner */}
                  <div className="p-3.5 rounded-2xl bg-zinc-950/90 border border-zinc-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        {t('moneyLeftForRestOfCycle')}
                      </span>
                      <span className="text-base font-mono font-extrabold text-emerald-400">
                        {formatCurrency(liveBudget, currency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                      <span>
                        {t('sumOfLinkedAccounts')}: {formatCurrency(linkedAccountsBalanceSum, currency)}
                      </span>
                      {parsedAdjustment !== 0 && (
                        <span className={parsedAdjustment > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {parsedAdjustment > 0 ? '+' : ''}{formatCurrency(parsedAdjustment, currency)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick-filter Chips */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleSelectLinkedAccountsPreset('non_savings')}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border border-zinc-750 transition cursor-pointer"
                    >
                      {t('selectLinkedAccountsPresetNonSavings')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectLinkedAccountsPreset('all')}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border border-zinc-750 transition cursor-pointer"
                    >
                      {t('selectLinkedAccountsPresetAll')}
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
                            acc.currency && normalizeCurrencyCodeOrSymbol(acc.currency) !== normalizeCurrencyCodeOrSymbol(currency)
                          );
                          const isChecked = !isExcludedCurrency && selectedAccountIds.includes(acc.id);
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
                                  onChange={() => !isExcludedCurrency && handleToggleLinkedAccount(acc.id)}
                                  className="w-4 h-4 rounded text-blue-600 bg-zinc-800 border-zinc-700 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                                />
                                <span className="text-sm shrink-0">{acc.icon || '💳'}</span>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="text-xs font-semibold text-zinc-200 truncate">
                                      {acc.name}
                                    </p>
                                    {isExcludedCurrency && (
                                      <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
                                        {isArabic ? `مستبعد (${acc.currency})` : `Excluded (${acc.currency})`}
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

                  {/* Extra Outside Cash (Adjustment) */}
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
                </div>
              ) : (
                /* Planned Income for Full Cycle Mode */
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

                  {incomeMinor <= 0 && (
                    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{t('enterIncomeFirstHint')}</span>
                    </div>
                  )}
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
                    <div className="mt-2.5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200 leading-relaxed flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        {t('calmOverTodayMessage')
                          .replace(
                            '{over}',
                            formatCurrency(evaluation.dailyStatus.overBudgetBy, currency)
                          )
                          .replace(
                            '{nextDaily}',
                            formatCurrency(
                              evaluation.dailyStatus.upcomingDailyAllowance,
                              currency
                            )
                          )}
                      </span>
                    </div>
                  )}

                {/* True Deficit Message */}
                {evaluation.dailyStatus.allowanceState === 'true_deficit' && (
                  <div className="mt-2.5 p-3 rounded-2xl bg-red-500/15 border border-red-500/30 text-xs text-red-200 leading-relaxed flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span>
                      {t('overBudgetBy')}:{' '}
                      <strong className="font-mono">
                        {formatCurrency(
                          Math.max(
                            evaluation.dailyStatus.overBudgetBy,
                            Math.abs(Math.min(0, evaluation.pools.daily.remaining))
                          ),
                          currency
                        )}
                      </strong>
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
                  incomeMinor <= 0 ? 'opacity-40 pointer-events-none' : ''
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
                      {pools.savings.percent}%
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
                      disabled={incomeMinor <= 0}
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
              </div>

              {/* Pool 2: Bills & Fixed Obligations Card */}
              <div
                onClick={() => setInspectPoolKey('fixed')}
                className={`p-4 rounded-3xl bg-zinc-900/80 border border-purple-500/25 space-y-3 cursor-pointer hover:border-purple-500/50 transition ${
                  incomeMinor <= 0 ? 'opacity-40 pointer-events-none' : ''
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
                      {pools.fixed.percent}%
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
                      disabled={incomeMinor <= 0}
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
              </div>

              {/* Pool 3: Outings Card */}
              <div
                onClick={() => setInspectPoolKey('outings')}
                className={`p-4 rounded-3xl bg-zinc-900/80 border border-amber-500/25 space-y-3 cursor-pointer hover:border-amber-500/50 transition ${
                  incomeMinor <= 0 ? 'opacity-40 pointer-events-none' : ''
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
                      {pools.outings.percent}%
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
                      disabled={incomeMinor <= 0}
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
              </div>

              {/* Pool 4: Daily Spending (The Calculated Remainder) */}
              <div
                onClick={() => setInspectPoolKey('daily')}
                className="p-4 rounded-3xl bg-gradient-to-br from-emerald-950/40 via-zinc-900/90 to-zinc-900 border border-emerald-500/30 space-y-3 cursor-pointer hover:border-emerald-500/50 transition"
                title={isArabic ? 'اضغط لعرض معاملات المصروف اليومي' : 'Click to view daily transactions'}
              >
                <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                  <span className="flex items-center gap-1.5">
                    <Wallet className="w-4 h-4" />
                    <span>{t('poolDaily')}</span>
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
                      {dailyPercent}%
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
                      {isArabic ? 'المتبقي تلقائياً' : 'Calculated remainder'}
                    </span>
                    <span className="text-base font-extrabold font-mono text-white">
                      {formatCurrency(dailyMinor / 100, currency)}
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
            {/* What-If Expense Simulator Card */}
            <div className="p-4 sm:p-5 rounded-3xl bg-zinc-900/80 border border-zinc-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <h4 className="text-xs sm:text-sm font-bold text-white">
                    {t('whatIfSimulatorTitle')}
                  </h4>
                </div>
              </div>
              <p className="text-xs text-zinc-400">{t('whatIfSimulatorDesc')}</p>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                    {t('whatIfAmount')}
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
                          ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <Shield className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{t('poolOneOff')}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Instant Deterministic Math Results Display */}
              {whatIfCalculation && (
                <div className="pt-2 border-t border-zinc-800 space-y-3">
                  {whatIfCalculation.isLastDay && (
                    <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-xs text-blue-200 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-400 shrink-0" />
                      <span>{t('lastDayCycleNotice')}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Card 1: Selected Pool Before -> After */}
                    <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
                        <span>{t('whatIfPoolBeforeAfter')}: {whatIfCalculation.poolName}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm font-mono">
                        <span className="text-zinc-300">
                          {formatCurrency(whatIfCalculation.poolBefore, currency)}
                        </span>
                        <span className="text-zinc-500 text-xs">→</span>
                        <span
                          className={`font-bold ${
                            whatIfCalculation.poolAfter < 0
                              ? 'text-red-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {formatCurrency(whatIfCalculation.poolAfter, currency)}
                        </span>
                      </div>
                      {whatIfCalculation.poolAfter < 0 && (
                        <p className="text-[10px] text-amber-400">
                          {t('poolExceededNotice')}
                        </p>
                      )}
                    </div>

                    {/* Card 2: Daily Allowance Before -> After */}
                    <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
                        <span>{t('whatIfDailyAllowanceBeforeAfter')}</span>
                        {whatIfCalculation.dailyImpact !== 0 && (
                          <span
                            className={`text-[10px] font-mono font-bold ${
                              whatIfCalculation.dailyImpact < 0
                                ? 'text-red-400'
                                : 'text-emerald-400'
                            }`}
                          >
                            {whatIfCalculation.dailyImpact > 0 ? '+' : ''}
                            {formatCurrency(whatIfCalculation.dailyImpact, currency)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-sm font-mono">
                        <span className="text-zinc-300">
                          {formatCurrency(whatIfCalculation.allowanceBefore, currency)}
                        </span>
                        <span className="text-zinc-500 text-xs">→</span>
                        <span
                          className={`font-bold ${
                            whatIfCalculation.allowanceAfter < whatIfCalculation.allowanceBefore
                              ? 'text-amber-300'
                              : 'text-emerald-400'
                          }`}
                        >
                          {formatCurrency(whatIfCalculation.allowanceAfter, currency)}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-500">
                        {isArabic
                          ? `لكل يوم من الـ ${whatIfCalculation.remainingDaysInCycle} يوماً المتبقية`
                          : `Per day for the remaining ${whatIfCalculation.remainingDaysInCycle} days`}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Rebalance Options (Shown ONLY if there is a deficit) */}
            {evaluation.rebalanceScenarios.hasDeficit && (
              <div className="p-4 sm:p-5 rounded-3xl bg-red-950/20 border border-red-500/30 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4.5 h-4.5 text-red-400 shrink-0" />
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-white">
                        {t('rebalanceTitle')}
                      </h4>
                      <p className="text-[11px] text-zinc-400">
                        {t('rebalanceSubtitle')}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-extrabold text-red-400 bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/20">
                    -{formatCurrency(evaluation.rebalanceScenarios.deficit, currency)}
                  </span>
                </div>

                {/* Top 3 Overspend Categories */}
                {topOverspendCategories.length > 0 && (
                  <div className="p-3 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-2">
                    <div className="text-[11px] font-semibold text-zinc-400">
                      {isArabic ? 'أكثر الفئات المسببة لزيادة الصرف:' : 'Top overspend categories:'}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {topOverspendCategories.map((c, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-zinc-900 border border-zinc-800/60 text-xs">
                          <span className="flex items-center gap-1.5 truncate">
                            <span>{c.icon}</span>
                            <span className="text-zinc-200 truncate">{c.name}</span>
                          </span>
                          <span className="font-mono font-bold text-red-400 shrink-0">
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
                        {t('scenarioATitle')}
                      </span>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        {t('scenarioADesc')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleApplyScenario('scenario_a')}
                      className="w-full min-h-[38px] py-1.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition cursor-pointer"
                    >
                      {t('applyScenarioBtn')}
                    </button>
                  </div>

                  {/* Scenario B: Absorb via Savings */}
                  <div className="p-3.5 rounded-2xl bg-zinc-950 border border-blue-500/20 flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                        <PiggyBank className="w-3.5 h-3.5" />
                        {t('scenarioBTitle')}
                      </span>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        {t('scenarioBDesc')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleApplyScenario('scenario_b')}
                      className="w-full min-h-[38px] py-1.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition cursor-pointer"
                    >
                      {t('applyScenarioBtn')}
                    </button>
                  </div>

                  {/* Scenario C: Reduce Daily Allowance */}
                  <div className="p-3.5 rounded-2xl bg-zinc-950 border border-emerald-500/20 flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5" />
                        {t('scenarioCTitle')}
                      </span>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        {t('scenarioCDesc')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleApplyScenario('scenario_c')}
                      className="w-full min-h-[38px] py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer"
                    >
                      {t('applyScenarioBtn')}
                    </button>
                  </div>
                </div>

                {/* Revert override button if active */}
                {currentOverride && (
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleRevertToBaseline}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-amber-300 text-xs font-bold border border-amber-500/30 flex items-center gap-1.5 transition cursor-pointer"
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
        <div className="shrink-0 p-4 sm:px-6 border-t border-zinc-800/80 bg-zinc-900/95 backdrop-blur-md flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveBudgetPlan}
            className="flex-1 min-h-[48px] py-2.5 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-xl shadow-emerald-950/40 transition cursor-pointer flex items-center justify-center gap-2"
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
          className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md transition-opacity duration-200"
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
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  {inspectPoolKey === 'savings' && <PiggyBank className="w-5 h-5" />}
                  {inspectPoolKey === 'fixed' && <ShoppingBag className="w-5 h-5" />}
                  {inspectPoolKey === 'outings' && <Coffee className="w-5 h-5" />}
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
