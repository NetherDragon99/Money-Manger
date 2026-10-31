/**
 * Smart Budget Hub Modal
 *
 * Full-featured interactive interface for the 4-Pool Smart Budget engine & AI advisor:
 * 1. "This Month & Rebalance": Today's Safe-to-Spend meter, 4 pool status cards, health check banner,
 *    instant deterministic What-If simulator with AI option, and 3 adaptive rebalance scenario cards
 *    that override only the current cycle without modifying baseline.
 * 2. "Baseline Plan": Cycle start day, planned income, 4-pool sliders totaling exactly 100% with
 *    locked savings minimum, fixed-category multi-picker, account inclusion, and AI optimization preview.
 * 3. "AI Advisor & Secrets": Private Gemini API key management (masked view, test connection, clear key),
 *    privacy disclosure, explicit consent toggle, and monthly usage metrics.
 *
 * Accessibility & Responsiveness:
 * - Safe at 320px width, dark mode native, RTL compliant.
 * - Touch targets >= 44px on all interactive elements.
 * - Registered in navigation history stack so hardware Back closes it.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Sparkles,
  Calendar,
  Sliders,
  Shield,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Wallet,
  PiggyBank,
  Coffee,
  ShoppingBag,
  HelpCircle,
  RotateCcw,
  KeyRound,
  Trash2,
  Zap,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { navigateBack } from '../context/NavigationContext';
import { formatNumberWithCommas } from '../utils/formatters';
import {
  evaluateSmartBudget,
  resolveCycleOverride,
  SmartBudgetConfig,
  SmartBudgetEvaluation,
} from '../utils/smartBudgetEngine';
import {
  PoolAllocationConfig,
  SmartBudgetBaselineConfig,
  SmartBudgetCycleOverride,
} from '../types';
import {
  hasAIConsent,
  setAIConsent,
  getAIMonthlyUsage,
  AI_CONSENT_DISCLOSURE,
  suggestSalaryAllocation,
  clearAICache,
  hasAIAccess,
  isManagedBackendOrProxyAvailable,
  testConnection,
  ConnectionTestResult,
  requestSmartBudgetAdvice,
  SmartBudgetAdviceResult,
} from '../utils/smartBudgetAI';
import {
  getLocalGeminiApiKey,
  maskGeminiApiKey,
  saveGeminiApiKey,
  clearGeminiApiKey,
} from '../utils/geminiApiKey';
import { auth } from '../utils/firebase';

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

  let sPct = 20;
  let fPct = 40;
  let oPct = 15;

  if (baseline?.savings && baseline.savings.type === 'percent') {
    sPct = baseline.savings.value;
  }

  const sMode: 'percent' | 'amount' = cfg?.savings?.mode || 'percent';
  const sMinor =
    cfg?.savings?.minorUnits != null
      ? cfg.savings.minorUnits
      : Math.round(incomeMinor * (sPct / 100));
  const sFinalPct =
    cfg?.savings?.percent != null
      ? cfg.savings.percent
      : incomeMinor > 0
      ? Math.round(((sMinor / incomeMinor) * 100) * 10) / 10
      : sPct;

  const fMode: 'percent' | 'amount' =
    cfg?.fixed?.mode || (baseline?.plannedFixedObligations ? 'amount' : 'percent');
  const fMinor =
    cfg?.fixed?.minorUnits != null
      ? cfg.fixed.minorUnits
      : baseline?.plannedFixedObligations
      ? Math.round(baseline.plannedFixedObligations * 100)
      : Math.round(incomeMinor * (fPct / 100));
  const fFinalPct =
    cfg?.fixed?.percent != null
      ? cfg.fixed.percent
      : incomeMinor > 0
      ? Math.round(((fMinor / incomeMinor) * 100) * 10) / 10
      : fPct;

  const oMode: 'percent' | 'amount' =
    cfg?.outings?.mode || (baseline?.outingsBudget ? 'amount' : 'percent');
  const oMinor =
    cfg?.outings?.minorUnits != null
      ? cfg.outings.minorUnits
      : baseline?.outingsBudget
      ? Math.round(baseline.outingsBudget * 100)
      : Math.round(incomeMinor * (oPct / 100));
  const oFinalPct =
    cfg?.outings?.percent != null
      ? cfg.outings.percent
      : incomeMinor > 0
      ? Math.round(((oMinor / incomeMinor) * 100) * 10) / 10
      : oPct;

  return {
    savings: {
      minorUnits: sMinor,
      percent: sFinalPct,
      mode: sMode,
      amountText: formatNumberWithCommas(sMinor / 100, 2),
    },
    fixed: {
      minorUnits: fMinor,
      percent: fFinalPct,
      mode: fMode,
      amountText: formatNumberWithCommas(fMinor / 100, 2),
    },
    outings: {
      minorUnits: oMinor,
      percent: oFinalPct,
      mode: oMode,
      amountText: formatNumberWithCommas(oMinor / 100, 2),
    },
  };
};

interface SmartBudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabKey = 'thisMonth' | 'baseline' | 'aiAdvisor';

export const SmartBudgetModal: React.FC<SmartBudgetModalProps> = ({ isOpen, onClose }) => {
  const {
    settings,
    updateSettings,
    transactions,
    accounts,
    categories,
    recurringTransactions,
    showToast,
    t,
  } = useApp();

  const isArabic = settings.language === 'ar';
  const currency = settings.currencySymbol || 'EGP';
  const formatCurrency = (amount: number, curr = currency) =>
    `${formatNumberWithCommas(amount, 2)} ${curr}`;

  // Active Hub Tab
  const [activeTab, setActiveTab] = useState<TabKey>('thisMonth');

  // ==========================================================================
  // TAB 1: THIS MONTH & REBALANCE STATE
  // ==========================================================================
  const [whatIfAmount, setWhatIfAmount] = useState<string>('');
  const [whatIfPool, setWhatIfPool] = useState<'daily' | 'outings' | 'fixed' | 'oneoff'>('outings');

  // ==========================================================================
  // TAB 2: BASELINE PLAN DRAFT STATE & 4-POOL ALLOCATION
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

  const savingsMinPercent = 0;
  const [headsUpThresholdPercent, setHeadsUpThresholdPercent] = useState<number>(() =>
    Math.round(((baselineSettings.headsUpThresholdRatio ?? 0.7) * 100))
  );
  const [selectedFixedCatIds, setSelectedFixedCatIds] = useState<string[]>(
    baselineSettings.fixedCategoryIds || []
  );
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(
    baselineSettings.includedAccountIds || accounts.map((a) => a.id)
  );
  const [weekendMultiplier] = useState<number>(1.5);
  const [isOptimizingWithAI, setIsOptimizingWithAI] = useState<boolean>(false);
  const [aiOptimizationPreview, setAiOptimizationPreview] = useState<{
    savings: number;
    fixed: number;
    outings: number;
    daily: number;
    explanation: string;
  } | null>(null);

  // ==========================================================================
  // SINGLE-MONTH CUSTOM PLAN STATE (KEYED BY CYCLE START DATE YYYY-MM-DD)
  // ==========================================================================
  const [isEditingCustomPlan, setIsEditingCustomPlan] = useState<boolean>(false);
  const [customIncomeInput, setCustomIncomeInput] = useState<string>('');
  const [customPools, setCustomPools] = useState<PoolsState>(() =>
    initPoolsFromSettings(baselineSettings, baselineSettings.plannedIncome || 0)
  );
  const [customPoolHints, setCustomPoolHints] = useState<{
    savings: string | null;
    fixed: string | null;
    outings: string | null;
  }>({ savings: null, fixed: null, outings: null });

  // Synchronize baseline state from settings
  useEffect(() => {
    if (baselineSettings) {
      if (baselineSettings.fixedCategoryIds) {
        setSelectedFixedCatIds(baselineSettings.fixedCategoryIds);
      }
      if (baselineSettings.includedAccountIds) {
        setSelectedAccountIds(baselineSettings.includedAccountIds);
      }
      if (typeof baselineSettings.headsUpThresholdRatio === 'number') {
        setHeadsUpThresholdPercent(Math.round(baselineSettings.headsUpThresholdRatio * 100));
      }
    }
  }, [settings.smartBudget?.baseline]);

  // Derived income minor units & daily remainder for Baseline Plan
  const incomeMinor = Math.round(
    (parseFloat(plannedIncomeInput.replace(/,/g, '')) || 0) * 100
  );
  const dailyMinor = Math.max(
    0,
    incomeMinor -
      (pools.savings.minorUnits + pools.fixed.minorUnits + pools.outings.minorUnits)
  );
  const dailyPercent =
    incomeMinor > 0
      ? Math.max(0, Math.round(((dailyMinor / incomeMinor) * 100) * 10) / 10)
      : 0;

  // Derived income minor units & daily remainder for Custom Plan (This Month)
  const customIncomeMinor = Math.round(
    (parseFloat(customIncomeInput.replace(/,/g, '')) || 0) * 100
  );
  const customDailyMinor = Math.max(
    0,
    customIncomeMinor -
      (customPools.savings.minorUnits + customPools.fixed.minorUnits + customPools.outings.minorUnits)
  );
  const customDailyPercent =
    customIncomeMinor > 0
      ? Math.max(0, Math.round(((customDailyMinor / customIncomeMinor) * 100) * 10) / 10)
      : 0;

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
  // TAB 3: AI ADVISOR & SECRETS STATE
  // ==========================================================================
  const [aiConsentEnabled, setAiConsentEnabled] = useState<boolean>(() => hasAIConsent());
  const [storedApiKey, setStoredApiKey] = useState<string | null>(() => getLocalGeminiApiKey());
  const [inputApiKey, setInputApiKey] = useState<string>('');
  const [isEditingKey, setIsEditingKey] = useState<boolean>(false);
  const [monthlyUsage, setMonthlyUsage] = useState(() => getAIMonthlyUsage());
  const [isTestingConnection, setIsTestingConnection] = useState<boolean>(false);
  const [connectionTestResult, setConnectionTestResult] = useState<ConnectionTestResult | null>(null);
  const [hasAIAccessState, setHasAIAccessState] = useState<boolean>(false);
  const [managedAiAvailable, setManagedAiAvailable] = useState<boolean>(() =>
    isManagedBackendOrProxyAvailable()
  );
  const [showAdvancedKeySection, setShowAdvancedKeySection] = useState<boolean>(false);
  const [adviceData, setAdviceData] = useState<SmartBudgetAdviceResult | null>(null);
  const [isLoadingAdvice, setIsLoadingAdvice] = useState<boolean>(false);

  // Refresh AI key & metrics when tab opens
  useEffect(() => {
    setStoredApiKey(getLocalGeminiApiKey());
    setAiConsentEnabled(hasAIConsent());
    setMonthlyUsage(getAIMonthlyUsage());
    hasAIAccess().then(setHasAIAccessState);
    setManagedAiAvailable(isManagedBackendOrProxyAvailable());
  }, [activeTab]);

  // ==========================================================================
  // EVALUATION & CURRENT CYCLE KEY (KEYED BY YYYY-MM-DD START DATE)
  // ==========================================================================
  const evaluation: SmartBudgetEvaluation = useMemo(() => {
    const draftPlanned = parseFloat(plannedIncomeInput.replace(/,/g, '')) || 0;
    const savedPlanned = baselineSettings.plannedIncome || draftPlanned;
    const savedPoolsCfg = baselineSettings.poolsConfig || {
      savings: {
        minorUnits: pools.savings.minorUnits,
        percent: pools.savings.percent,
        mode: pools.savings.mode,
      },
      fixed: {
        minorUnits: pools.fixed.minorUnits,
        percent: pools.fixed.percent,
        mode: pools.fixed.mode,
      },
      outings: {
        minorUnits: pools.outings.minorUnits,
        percent: pools.outings.percent,
        mode: pools.outings.mode,
      },
    };
    const config: SmartBudgetConfig = {
      baseCurrency: currency,
      startDay: globalMonthStartDay,
      plannedIncome: savedPlanned > 0 ? savedPlanned : undefined,
      savings: baselineSettings.savings || { type: 'percent', value: pools.savings.percent },
      plannedFixedObligations:
        baselineSettings.plannedFixedObligations !== undefined
          ? baselineSettings.plannedFixedObligations
          : pools.fixed.minorUnits / 100,
      outingsBudget:
        baselineSettings.outingsBudget !== undefined
          ? baselineSettings.outingsBudget
          : pools.outings.minorUnits / 100,
      fixedCategoryIds: selectedFixedCatIds,
      includedAccountIds: selectedAccountIds,
      headsUpThresholdRatio:
        baselineSettings.headsUpThresholdRatio ?? headsUpThresholdPercent / 100,
      poolsConfig: savedPoolsCfg,
      overrides: settings.smartBudget?.overrides,
      adjustments: settings.smartBudget?.adjustments,
      weekdayWeights:
        weekendMultiplier !== 1.0
          ? { 4: weekendMultiplier, 5: weekendMultiplier } // Thu/Fri for Middle East weekend
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
    baselineSettings,
    plannedIncomeInput,
    pools,
    selectedFixedCatIds,
    selectedAccountIds,
    headsUpThresholdPercent,
    settings.smartBudget?.overrides,
    settings.smartBudget?.adjustments,
    weekendMultiplier,
  ]);

  const currentCycleKey = evaluation.cycle.startDate; // YYYY-MM-DD
  const currentOverride = resolveCycleOverride(settings.smartBudget?.overrides, currentCycleKey);

  const totalCycleExpensesBeforeTodayMajor = useMemo(() => {
    const todayStr = evaluation.dailyStatus.asOfDate;
    const baseCurr = evaluation.baseCurrency;
    return transactions
      .filter((tx) => {
        if (!tx || !tx.date || tx.type !== 'expense' || tx.isAdjustment || tx.isUneditable) return false;
        const d = tx.date.split('T')[0].trim();
        if (d < evaluation.cycle.startDate || d >= todayStr) return false;
        const acc = accounts.find((a) => a.id === tx.accountId);
        if (acc?.currency && acc.currency !== baseCurr) return false;
        return true;
      })
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);
  }, [transactions, accounts, evaluation.cycle.startDate, evaluation.dailyStatus.asOfDate, evaluation.baseCurrency]);

  const defaultRemainingMoney = useMemo(() => {
    const planned = currentOverride?.plannedIncome ?? (baselineSettings.plannedIncome || (incomeMinor / 100));
    return Math.max(0, Math.round((planned - totalCycleExpensesBeforeTodayMajor) * 100) / 100);
  }, [currentOverride?.plannedIncome, baselineSettings.plannedIncome, incomeMinor, totalCycleExpensesBeforeTodayMajor]);

  const activeCycleMode: 'full_cycle' | 'from_today' =
    currentOverride?.calculationMode ||
    (evaluation.dailyStatus.cycleDayIndex > 1 ? 'from_today' : 'full_cycle');

  const isCyclePaused = Boolean(currentOverride?.isPaused);

  const [moneyLeftInput, setMoneyLeftInput] = useState<string>(() => {
    if (currentOverride?.fromTodayConfig?.remainingMoney != null) {
      return formatNumberWithCommas(currentOverride.fromTodayConfig.remainingMoney, 2);
    }
    return formatNumberWithCommas(defaultRemainingMoney, 2);
  });

  useEffect(() => {
    if (currentOverride?.fromTodayConfig?.remainingMoney != null) {
      setMoneyLeftInput(formatNumberWithCommas(currentOverride.fromTodayConfig.remainingMoney, 2));
    } else {
      setMoneyLeftInput(formatNumberWithCommas(defaultRemainingMoney, 2));
    }
  }, [currentOverride?.fromTodayConfig?.remainingMoney, defaultRemainingMoney]);

  if (!isOpen) return null;

  // ==========================================================================
  // DUAL-INPUT REBALANCER (PERCENT SLIDER + COMMAS AMOUNT INPUT)
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
        savings: { ...prev.savings, minorUnits: 0, amountText: '0' },
        fixed: { ...prev.fixed, minorUnits: 0, amountText: '0' },
        outings: { ...prev.outings, minorUnits: 0, amountText: '0' },
      };
    }

    let sMinor = prev.savings.minorUnits;
    let sPct = prev.savings.percent;
    let fMinor = prev.fixed.minorUnits;
    let fPct = prev.fixed.percent;
    let oMinor = prev.outings.minorUnits;
    let oPct = prev.outings.percent;

    if (prev.savings.mode === 'percent') {
      sMinor = Math.round(newMinor * (sPct / 100));
    }
    if (prev.fixed.mode === 'percent') {
      fMinor = Math.round(newMinor * (fPct / 100));
    }
    if (prev.outings.mode === 'percent') {
      oMinor = Math.round(newMinor * (oPct / 100));
    }

    if (prev.savings.mode === 'amount') {
      sPct = Math.round(((sMinor / newMinor) * 100) * 10) / 10;
    }
    if (prev.fixed.mode === 'amount') {
      fPct = Math.round(((fMinor / newMinor) * 100) * 10) / 10;
    }
    if (prev.outings.mode === 'amount') {
      oPct = Math.round(((oMinor / newMinor) * 100) * 10) / 10;
    }

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
      sPct = Math.round(((sMinor / newMinor) * 100) * 10) / 10;
      fPct = Math.round(((fMinor / newMinor) * 100) * 10) / 10;
      oPct = Math.round(((oMinor / newMinor) * 100) * 10) / 10;
    }

    return {
      savings: {
        ...prev.savings,
        minorUnits: sMinor,
        percent: sPct,
        amountText: formatNumberWithCommas(sMinor / 100, 2),
      },
      fixed: {
        ...prev.fixed,
        minorUnits: fMinor,
        percent: fPct,
        amountText: formatNumberWithCommas(fMinor / 100, 2),
      },
      outings: {
        ...prev.outings,
        minorUnits: oMinor,
        percent: oPct,
        amountText: formatNumberWithCommas(oMinor / 100, 2),
      },
    };
  };

  const handlePlannedIncomeChange = (valStr: string, inputEl?: HTMLInputElement | null) => {
    const newIncome = formatIncomeWithCaret(valStr, inputEl || null, setPlannedIncomeInput);
    const newMinor = Math.round(newIncome * 100);
    setPools((prev) => recomputePoolsForNewIncome(prev, newMinor));
  };

  const handleCustomIncomeChange = (valStr: string, inputEl?: HTMLInputElement | null) => {
    const newIncome = formatIncomeWithCaret(valStr, inputEl || null, setCustomIncomeInput);
    const newMinor = Math.round(newIncome * 100);
    setCustomPools((prev) => recomputePoolsForNewIncome(prev, newMinor));
  };

  const applyDualSliderChange = (
    poolKey: 'savings' | 'fixed' | 'outings',
    val: number,
    targetIncomeMinor: number,
    setPoolsFn: React.Dispatch<React.SetStateAction<PoolsState>>,
    setHintsFn: React.Dispatch<
      React.SetStateAction<{ savings: string | null; fixed: string | null; outings: string | null }>
    >
  ) => {
    if (targetIncomeMinor <= 0) return;
    setHintsFn((h) => ({ ...h, [poolKey]: null }));

    setPoolsFn((prev) => {
      let otherMinor = 0;
      if (poolKey === 'savings') otherMinor = prev.fixed.minorUnits + prev.outings.minorUnits;
      if (poolKey === 'fixed') otherMinor = prev.savings.minorUnits + prev.outings.minorUnits;
      if (poolKey === 'outings') otherMinor = prev.savings.minorUnits + prev.fixed.minorUnits;

      const maxMinor = Math.max(0, targetIncomeMinor - otherMinor);
      const maxPct = Math.round(((maxMinor / targetIncomeMinor) * 100) * 10) / 10;

      let clampedPct = Math.max(0, val);
      let hint: string | null = null;

      if (clampedPct > maxPct) {
        clampedPct = maxPct;
        hint = t('maxAllowedPoolHint')
          .replace('{amount}', formatCurrency(maxMinor / 100, currency))
          .replace('{percent}', String(maxPct));
      }

      if (hint) {
        setHintsFn((h) => ({ ...h, [poolKey]: hint }));
      }

      const newMinor = Math.min(maxMinor, Math.round(targetIncomeMinor * (clampedPct / 100)));

      return {
        ...prev,
        [poolKey]: {
          minorUnits: newMinor,
          percent: clampedPct,
          mode: 'percent',
          amountText: formatNumberWithCommas(newMinor / 100, 2),
        },
      };
    });
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

  const handleSliderChange = (poolKey: 'savings' | 'fixed' | 'outings', val: number) =>
    applyDualSliderChange(poolKey, val, incomeMinor, setPools, setPoolHints);

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

  const handleCustomSliderChange = (poolKey: 'savings' | 'fixed' | 'outings', val: number) =>
    applyDualSliderChange(poolKey, val, customIncomeMinor, setCustomPools, setCustomPoolHints);

  const handleCustomAmountChange = (
    poolKey: 'savings' | 'fixed' | 'outings',
    rawInput: string,
    inputEl: HTMLInputElement | null
  ) =>
    applyDualAmountChange(
      poolKey,
      rawInput,
      inputEl,
      customIncomeMinor,
      customPools,
      setCustomPools,
      setCustomPoolHints
    );

  const handleCustomAmountBlur = (poolKey: 'savings' | 'fixed' | 'outings') =>
    applyDualAmountBlur(poolKey, customIncomeMinor, setCustomPools);

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

    setIsEditingCustomPlan(false);
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
    const numMoneyLeft = parseFloat(moneyLeftInput.replace(/,/g, '')) || defaultRemainingMoney;
    const newOverride: SmartBudgetCycleOverride = {
      ...(currentOverride || {}),
      calculationMode: newMode,
      fromTodayConfig:
        newMode === 'from_today'
          ? {
              fromDate: currentOverride?.fromTodayConfig?.fromDate || evaluation.dailyStatus.asOfDate,
              remainingMoney: Math.max(0, numMoneyLeft),
              remainingMoneyMinor: Math.round(Math.max(0, numMoneyLeft) * 100),
            }
          : undefined,
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

  const handleMoneyLeftChange = (raw: string, inputEl: HTMLInputElement | null) => {
    formatIncomeWithCaret(raw, inputEl, setMoneyLeftInput);
  };

  const handleMoneyLeftBlur = () => {
    const cleaned = moneyLeftInput.replace(/[^0-9.]/g, '');
    const num = Math.max(0, parseFloat(cleaned) || 0);
    setMoneyLeftInput(formatNumberWithCommas(num, 2));

    if (activeCycleMode === 'from_today') {
      const newOverride: SmartBudgetCycleOverride = {
        ...(currentOverride || {}),
        calculationMode: 'from_today',
        fromTodayConfig: {
          fromDate: currentOverride?.fromTodayConfig?.fromDate || evaluation.dailyStatus.asOfDate,
          remainingMoney: num,
          remainingMoneyMinor: Math.round(num * 100),
        },
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
    }
  };

  // ==========================================================================
  // ACTIONS: SINGLE-MONTH CUSTOM PLAN (KEYED BY CYCLE START DATE YYYY-MM-DD)
  // ==========================================================================
  const handleOpenCustomPlanEditor = () => {
    const effectiveSrc = currentOverride
      ? { ...baselineSettings, ...currentOverride }
      : baselineSettings;
    const initInc =
      effectiveSrc.plannedIncome ||
      evaluation.pools.total.income ||
      parseFloat(plannedIncomeInput.replace(/,/g, '')) ||
      0;
    setCustomIncomeInput(initInc > 0 ? formatNumberWithCommas(initInc, 2) : '');
    setCustomPools(initPoolsFromSettings(effectiveSrc, initInc));
    setCustomPoolHints({ savings: null, fixed: null, outings: null });
    setIsEditingCustomPlan(true);
  };

  const handleSaveCustomPlan = () => {
    const customInc = parseFloat(customIncomeInput.replace(/,/g, '')) || 0;
    const newOverride = {
      plannedIncome: customInc > 0 ? customInc : undefined,
      savings: { type: 'percent' as const, value: customPools.savings.percent },
      plannedFixedObligations: customPools.fixed.minorUnits / 100,
      outingsBudget: customPools.outings.minorUnits / 100,
      poolsConfig: {
        savings: {
          minorUnits: customPools.savings.minorUnits,
          percent: customPools.savings.percent,
          mode: customPools.savings.mode,
        },
        fixed: {
          minorUnits: customPools.fixed.minorUnits,
          percent: customPools.fixed.percent,
          mode: customPools.fixed.mode,
        },
        outings: {
          minorUnits: customPools.outings.minorUnits,
          percent: customPools.outings.percent,
          mode: customPools.outings.mode,
        },
      },
      isCustomPlan: true,
      appliedAt: Date.now(),
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

    setIsEditingCustomPlan(false);
    showToast(t('customPlanSavedSuccess'), 'success');
  };

  // ==========================================================================
  // ACTIONS: SAVE BASELINE
  // ==========================================================================
  const handleSaveBaseline = () => {
    const planned = parseFloat(plannedIncomeInput.replace(/,/g, '')) || 0;
    const newBaseline: SmartBudgetBaselineConfig = {
      startDay: globalMonthStartDay,
      plannedIncome: planned > 0 ? planned : undefined,
      savings: { type: 'percent', value: pools.savings.percent },
      plannedFixedObligations: pools.fixed.minorUnits / 100,
      outingsBudget: pools.outings.minorUnits / 100,
      fixedCategoryIds: selectedFixedCatIds,
      includedAccountIds: selectedAccountIds,
      headsUpThresholdRatio: Math.min(0.95, Math.max(0.3, headsUpThresholdPercent / 100)),
      weekdayWeights:
        weekendMultiplier !== 1.0
          ? { 4: weekendMultiplier, 5: weekendMultiplier }
          : undefined,
      poolsConfig: {
        savings: {
          minorUnits: pools.savings.minorUnits,
          percent: pools.savings.percent,
          mode: pools.savings.mode,
        },
        fixed: {
          minorUnits: pools.fixed.minorUnits,
          percent: pools.fixed.percent,
          mode: pools.fixed.mode,
        },
        outings: {
          minorUnits: pools.outings.minorUnits,
          percent: pools.outings.percent,
          mode: pools.outings.mode,
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

    showToast(t('baselineSavedSuccess'), 'success');
  };

  // ==========================================================================
  // ACTIONS: AI OPTIMIZE BASELINE (Seamless AI or Deterministic Fallback)
  // ==========================================================================
  const handleAskAIToOptimize = async () => {
    setIsOptimizingWithAI(true);
    try {
      const fixedTotal = categories
        .filter((c) => selectedFixedCatIds.includes(c.id))
        .reduce((sum, c) => sum + (c.budgetLimit || 0), 0);

      const income =
        parseFloat(plannedIncomeInput.replace(/,/g, '')) ||
        evaluation.pools.total.income ||
        15000;

      const suggestion = await suggestSalaryAllocation({
        plannedIncomeMajor: income,
        fixedObligationsMajor: fixedTotal,
        savingsMinPercent,
        language: isArabic ? 'ar' : 'en',
      });

      setAiOptimizationPreview({
        savings: suggestion.savingsPercent,
        fixed: suggestion.fixedPercent,
        outings: suggestion.outingsPercent,
        daily: suggestion.dailyPercent,
        explanation: suggestion.explanation,
      });
    } catch {
      showToast(t('errorOccurred'), 'error');
    } finally {
      setIsOptimizingWithAI(false);
    }
  };

  const handleApplyAIOptimization = () => {
    if (!aiOptimizationPreview) return;
    const sPct = aiOptimizationPreview.savings;
    const fPct = aiOptimizationPreview.fixed;
    const oPct = aiOptimizationPreview.outings;

    const sMinor = Math.round(incomeMinor * (sPct / 100));
    const fMinor = Math.round(incomeMinor * (fPct / 100));
    const oMinor = Math.round(incomeMinor * (oPct / 100));

    setPools({
      savings: {
        minorUnits: sMinor,
        percent: sPct,
        mode: 'percent',
        amountText: formatNumberWithCommas(sMinor / 100, 2),
      },
      fixed: {
        minorUnits: fMinor,
        percent: fPct,
        mode: 'percent',
        amountText: formatNumberWithCommas(fMinor / 100, 2),
      },
      outings: {
        minorUnits: oMinor,
        percent: oPct,
        mode: 'percent',
        amountText: formatNumberWithCommas(oMinor / 100, 2),
      },
    });
    setAiOptimizationPreview(null);
    showToast(t('updatedSuccess'), 'success');
  };

  // ==========================================================================
  // ACTIONS: 100% INSTANT CLIENT-SIDE DETERMINISTIC WHAT-IF SIMULATION
  // ==========================================================================
  const simulatedExpenseNumber = Math.max(0, parseFloat(whatIfAmount.replace(/,/g, '')) || 0);

  const whatIfCalculation = useMemo(() => {
    if (simulatedExpenseNumber <= 0) return null;

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

    // Daily allowance before & after
    const allowanceBefore = isLastDay
      ? Math.max(0, evaluation.dailyStatus.todayRemaining)
      : evaluation.dailyStatus.upcomingDailyAllowance;

    let allowanceAfter = allowanceBefore;
    let dailyImpact = 0;

    if (whatIfPool === 'oneoff') {
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
  }, [simulatedExpenseNumber, whatIfPool, evaluation, t]);

  // ==========================================================================
  // ACTIONS: KEY & CONNECTION TEST
  // ==========================================================================
  const handleSaveKey = async () => {
    const clean = inputApiKey.trim();
    if (!clean) return;
    await saveGeminiApiKey(clean, auth.currentUser?.uid);
    setStoredApiKey(clean);
    setInputApiKey('');
    setIsEditingKey(false);
    showToast(t('apiKeySavedSuccess'), 'success');
  };

  const handleClearKey = async () => {
    await clearGeminiApiKey(auth.currentUser?.uid);
    setStoredApiKey(null);
    setInputApiKey('');
    setIsEditingKey(false);
    showToast(t('apiKeyClearedSuccess'), 'info');
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setConnectionTestResult(null);
    try {
      const res = await testConnection(isArabic ? 'ar' : 'en');
      setConnectionTestResult(res);
      if (res.ok) {
        showToast(t('connectionSuccess'), 'success');
      } else {
        showToast(isArabic ? res.messageAr : res.message, 'error');
      }
    } catch (err: any) {
      const fallbackRes: ConnectionTestResult = {
        ok: false,
        source: 'personal',
        message: err?.message || 'Connection test failed',
        messageAr: 'فشل اختبار الاتصال',
      };
      setConnectionTestResult(fallbackRes);
      showToast(t('connectionFailed'), 'error');
    } finally {
      setIsTestingConnection(false);
      setMonthlyUsage(getAIMonthlyUsage());
    }
  };

  const handleGetAdvice = async () => {
    if (!aiConsentEnabled) {
      showToast(t('aiAdvisorConsentRequired'), 'error');
      return;
    }
    setIsLoadingAdvice(true);
    try {
      const todayStr = evaluation.dailyStatus.asOfDate;
      const baseCurr = evaluation.baseCurrency;
      const cycleStart = evaluation.cycle.startDate;
      const cycleEnd = evaluation.cycle.endDate;
      const isFromToday = evaluation.calculationMode === 'from_today';
      const effectiveStart = isFromToday ? (evaluation.fromTodayConfig?.fromDate || todayStr) : cycleStart;

      // Group cycle transactions by category (excluding transfers)
      // Send ONLY aggregated numbers (category names capped at 30 chars, category totals, count, pool)
      // ZERO notes, ZERO emails, ZERO account IDs/names
      const catMap = new Map<string, { name: string; total: number; count: number; pool: string }>();

      (transactions || []).forEach((tx) => {
        if (!tx || !tx.date || tx.type !== 'expense' || tx.isAdjustment || tx.isUneditable) return;
        const d = tx.date.split('T')[0].trim();
        if (d < effectiveStart || d > cycleEnd) return;
        const acc = accounts.find((a) => a.id === tx.accountId);
        if (acc?.currency && acc.currency !== baseCurr) return;

        const catId = tx.categoryId || 'uncategorized';
        const cat = categories.find((c) => c.id === catId);
        const rawName = cat?.name || (catId === 'uncategorized' ? (isArabic ? 'غير مصنف' : 'Uncategorized') : catId);
        const sanitizedName = rawName.slice(0, 30).trim() || 'Category';

        let pool = 'daily';
        if (selectedFixedCatIds.includes(catId)) {
          pool = 'fixed';
        } else if ((cat as any)?.isOuting || /outing|entertainment|restaurant|خروج|ترفيه|مطعم/i.test(rawName)) {
          pool = 'outings';
        }

        const existing = catMap.get(catId);
        if (existing) {
          existing.total += (tx.amount || 0);
          existing.count += 1;
        } else {
          catMap.set(catId, {
            name: sanitizedName,
            total: tx.amount || 0,
            count: 1,
            pool,
          });
        }
      });

      const categoryList = Array.from(catMap.values())
        .map((item) => ({
          categoryName: item.name,
          amountMajor: Math.round(item.total * 100) / 100,
          count: item.count,
          pool: item.pool,
        }))
        .sort((a, b) => b.amountMajor - a.amountMajor)
        .slice(0, 10);

      const hasDeficit = evaluation.rebalanceScenarios.hasDeficit;
      const deficitOrSurplus = hasDeficit
        ? -Math.abs(evaluation.rebalanceScenarios.deficit)
        : Math.max(0, evaluation.pools.daily.remaining);

      const advice = await requestSmartBudgetAdvice({
        categoryTotals: categoryList,
        cycleDeficitOrSurplusMajor: deficitOrSurplus,
        isDeficit: hasDeficit,
        remainingDays: evaluation.dailyStatus.remainingDaysInCycle,
        totalCycleIncomeMajor: evaluation.pools.total.income,
        totalCycleSpentMajor: evaluation.pools.total.spent,
        currency,
        language: isArabic ? 'ar' : 'en',
      });

      setAdviceData(advice);
      showToast(t('updatedSuccess'), 'success');
    } catch {
      showToast(t('errorOccurred'), 'error');
    } finally {
      setIsLoadingAdvice(false);
      setMonthlyUsage(getAIMonthlyUsage());
    }
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
              <Sparkles className="w-5 h-5 stroke-[2.5]" />
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
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3-Tab Selector Bar */}
        <div className="flex items-center border-b border-zinc-800/80 bg-zinc-900/40 px-2 sm:px-4 shrink-0 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('thisMonth')}
            className={`min-h-[44px] px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'thisMonth'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>{t('tabThisMonth')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('baseline')}
            className={`min-h-[44px] px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'baseline'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>{t('tabBaseline')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('aiAdvisor')}
            className={`min-h-[44px] px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'aiAdvisor'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>{t('tabAIAdvisor')}</span>
          </button>
        </div>

        {/* Modal Content Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 min-w-0">
          {/* =============================================================== */}
          {/* TAB 1: THIS MONTH & REBALANCE */}
          {/* =============================================================== */}
          {activeTab === 'thisMonth' && (
            <div className="space-y-6">
              {/* Active Cycle Controls: Mode (From Today vs Full Cycle) & Pause Toggle */}
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

                {/* Calculation Mode Selector: Full Cycle vs. From Today */}
                <div className="pt-2 border-t border-zinc-800/80 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-zinc-300">
                      {t('calculationMode')}
                    </span>
                    <div className="inline-flex p-1 rounded-xl bg-zinc-950 border border-zinc-800">
                      <button
                        type="button"
                        onClick={() => handleSetCalculationMode('from_today')}
                        className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          activeCycleMode === 'from_today'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {t('modeFromToday')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetCalculationMode('full_cycle')}
                        className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          activeCycleMode === 'full_cycle'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {t('modeFullCycle')}
                      </button>
                    </div>
                  </div>

                  {/* Mode explanation & From Today inputs */}
                  {activeCycleMode === 'from_today' ? (
                    <div className="p-3 rounded-2xl bg-zinc-950/70 border border-blue-500/20 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-zinc-400 flex-wrap gap-1">
                        <span>{t('modeFromTodayDesc')}</span>
                        <span className="font-mono text-blue-300 font-semibold">
                          {evaluation.dailyStatus.asOfDate}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-zinc-200">
                          {t('moneyLeftForRestOfCycle')}
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={moneyLeftInput}
                            onChange={(e) => handleMoneyLeftChange(e.target.value, e.target)}
                            onBlur={handleMoneyLeftBlur}
                            placeholder="0.00"
                            className="w-full min-h-[44px] px-3.5 py-2 pe-12 rounded-xl bg-zinc-900 border border-zinc-750 text-white font-mono text-sm focus:border-blue-500 focus:outline-none"
                          />
                          <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-mono pointer-events-none">
                            {currency}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-400 leading-relaxed">
                          {t('moneyLeftHelper')}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-zinc-400">
                      {t('modeFullCycleDesc')}
                    </p>
                  )}
                </div>
              </div>

              {/* Paused Status Banner */}
              {isCyclePaused && (
                <div className="p-4 sm:p-5 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
                  <div className="flex items-start gap-3 min-w-0">
                    <Shield className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-amber-300">
                        {t('smartBudgetPausedBadge')}
                      </h4>
                      <p className="text-xs text-amber-200/90 mt-1 leading-relaxed">
                        {t('smartBudgetPausedMessage')}
                      </p>
                    </div>
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

              {/* Calm Daily Allowance Card (Hidden when Smart Budget is paused) */}
              {!isCyclePaused && (
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
                    <span className="text-[11px] font-mono font-semibold text-zinc-400 bg-zinc-850 px-2 py-0.5 rounded-full border border-zinc-750">
                      {isArabic
                        ? `اليوم ${evaluation.dailyStatus.cycleDayIndex} من ${evaluation.dailyStatus.cycleLength} · متبقي ${evaluation.dailyStatus.remainingDaysInCycle} يوماً`
                        : `Day ${evaluation.dailyStatus.cycleDayIndex} of ${evaluation.dailyStatus.cycleLength} · ${evaluation.dailyStatus.remainingDaysInCycle} days left`}
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

                {/* Calm Absorption Message when today's spending exceeds today's allowance while monthly Daily pool still has funds */}
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

                {/* True Deficit Message only when monthly Daily pool is exhausted or total cycle spending exceeds planned income */}
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
              )}

              {/* Single-Month Override: Custom Plan for This Month (`استثناء لشهر معين`) */}
              <div className="p-4 sm:p-5 rounded-3xl bg-zinc-900/70 border border-zinc-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-bold text-white">
                        {t('customPlanThisMonthTitle')}
                      </h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {currentCycleKey}
                      </span>
                      {currentOverride && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {t('customPlanActiveBadge')}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {t('customPlanThisMonthDesc')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isEditingCustomPlan && (
                      <button
                        type="button"
                        onClick={handleOpenCustomPlanEditor}
                        className="min-h-[38px] px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-emerald-300 text-xs font-bold border border-emerald-500/30 transition"
                      >
                        {currentOverride ? t('editCustomPlanBtn') : t('createCustomPlanBtn')}
                      </button>
                    )}
                    {currentOverride && (
                      <button
                        type="button"
                        onClick={handleRevertToBaseline}
                        className="min-h-[38px] px-3 py-1.5 rounded-xl bg-zinc-850 hover:bg-zinc-800 text-amber-300 text-xs font-bold border border-amber-500/30 flex items-center gap-1.5 transition"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{t('revertToBaseline')}</span>
                      </button>
                    )}
                  </div>
                </div>

                {isEditingCustomPlan && (
                  <div className="pt-3 border-t border-zinc-800 space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-white mb-1">
                        {t('plannedIncome')} ({currentCycleKey})
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={customIncomeInput}
                        onChange={(e) => handleCustomIncomeChange(e.target.value, e.target)}
                        placeholder="0.00"
                        className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono text-sm focus:border-emerald-500 focus:outline-none"
                      />
                    </div>

                    {/* Custom Pool 1: Savings */}
                    <div
                      className={`p-3 rounded-2xl bg-zinc-950/80 border border-blue-500/20 space-y-2 ${
                        customIncomeMinor <= 0 ? 'opacity-40 pointer-events-none' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-blue-400">
                        <span>{t('poolSavings')}</span>
                        <span className="font-mono">{customPools.savings.percent}%</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5 items-center">
                        <input
                          type="range"
                          min={0}
                          max={60}
                          step={0.5}
                          value={customPools.savings.percent}
                          disabled={customIncomeMinor <= 0}
                          onChange={(e) =>
                            handleCustomSliderChange('savings', parseFloat(e.target.value))
                          }
                          className="w-full accent-blue-500 cursor-pointer min-h-[40px]"
                        />
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={customPools.savings.amountText}
                            disabled={customIncomeMinor <= 0}
                            onChange={(e) =>
                              handleCustomAmountChange('savings', e.target.value, e.target)
                            }
                            onBlur={() => handleCustomAmountBlur('savings')}
                            className="w-full min-h-[40px] px-3 py-1.5 pe-11 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono text-xs focus:border-blue-500 focus:outline-none"
                          />
                          <span className="absolute end-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 font-mono pointer-events-none">
                            {currency}
                          </span>
                        </div>
                      </div>
                      {customPoolHints.savings && (
                        <div className="text-[10px] text-amber-400">{customPoolHints.savings}</div>
                      )}
                    </div>

                    {/* Custom Pool 2: Bills & Fixed */}
                    <div
                      className={`p-3 rounded-2xl bg-zinc-950/80 border border-purple-500/20 space-y-2 ${
                        customIncomeMinor <= 0 ? 'opacity-40 pointer-events-none' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-purple-400">
                        <span>{t('poolFixed')}</span>
                        <span className="font-mono">{customPools.fixed.percent}%</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5 items-center">
                        <input
                          type="range"
                          min={0}
                          max={70}
                          step={0.5}
                          value={customPools.fixed.percent}
                          disabled={customIncomeMinor <= 0}
                          onChange={(e) =>
                            handleCustomSliderChange('fixed', parseFloat(e.target.value))
                          }
                          className="w-full accent-purple-500 cursor-pointer min-h-[40px]"
                        />
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={customPools.fixed.amountText}
                            disabled={customIncomeMinor <= 0}
                            onChange={(e) =>
                              handleCustomAmountChange('fixed', e.target.value, e.target)
                            }
                            onBlur={() => handleCustomAmountBlur('fixed')}
                            className="w-full min-h-[40px] px-3 py-1.5 pe-11 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono text-xs focus:border-purple-500 focus:outline-none"
                          />
                          <span className="absolute end-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 font-mono pointer-events-none">
                            {currency}
                          </span>
                        </div>
                      </div>
                      {customPoolHints.fixed && (
                        <div className="text-[10px] text-amber-400">{customPoolHints.fixed}</div>
                      )}
                    </div>

                    {/* Custom Pool 3: Outings */}
                    <div
                      className={`p-3 rounded-2xl bg-zinc-950/80 border border-amber-500/20 space-y-2 ${
                        customIncomeMinor <= 0 ? 'opacity-40 pointer-events-none' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                        <span>{t('poolOutings')}</span>
                        <span className="font-mono">{customPools.outings.percent}%</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5 items-center">
                        <input
                          type="range"
                          min={0}
                          max={50}
                          step={0.5}
                          value={customPools.outings.percent}
                          disabled={customIncomeMinor <= 0}
                          onChange={(e) =>
                            handleCustomSliderChange('outings', parseFloat(e.target.value))
                          }
                          className="w-full accent-amber-500 cursor-pointer min-h-[40px]"
                        />
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={customPools.outings.amountText}
                            disabled={customIncomeMinor <= 0}
                            onChange={(e) =>
                              handleCustomAmountChange('outings', e.target.value, e.target)
                            }
                            onBlur={() => handleCustomAmountBlur('outings')}
                            className="w-full min-h-[40px] px-3 py-1.5 pe-11 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono text-xs focus:border-amber-500 focus:outline-none"
                          />
                          <span className="absolute end-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 font-mono pointer-events-none">
                            {currency}
                          </span>
                        </div>
                      </div>
                      {customPoolHints.outings && (
                        <div className="text-[10px] text-amber-400">{customPoolHints.outings}</div>
                      )}
                    </div>

                    {/* Custom Pool 4: Daily Remainder */}
                    <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-emerald-400">{t('poolDaily')}</div>
                        <div className="text-[10px] text-zinc-400">{customDailyPercent}%</div>
                      </div>
                      <div className="text-base font-extrabold font-mono text-white">
                        {formatCurrency(customDailyMinor / 100, currency)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleSaveCustomPlan}
                        disabled={customIncomeMinor <= 0}
                        className="flex-1 min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition disabled:opacity-40"
                      >
                        {t('saveCustomPlanBtn')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingCustomPlan(false)}
                        className="min-h-[42px] px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-300 font-bold text-xs transition"
                      >
                        {t('cancel')}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 4 Budget Pool Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Savings Pool */}
                <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-blue-500/20 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-blue-400">
                    <span className="flex items-center gap-1.5">
                      <PiggyBank className="w-4 h-4" />
                      <span>{t('poolSavings')}</span>
                    </span>
                    <span className="text-[10px] font-mono bg-blue-500/20 px-1.5 py-0.5 rounded text-blue-300">
                      {Math.round(
                        (evaluation.pools.savings.allocated /
                          Math.max(1, evaluation.pools.total.income)) *
                          100
                      )}
                      %
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline font-mono text-sm">
                    <span className="text-zinc-400 text-xs">{t('netSavedThisCycle')}:</span>
                    <span className="font-bold text-white">
                      {formatCurrency(evaluation.pools.savings.netSaved, currency)}{' '}
                      <span className="text-zinc-500 text-xs font-normal">
                        / {formatCurrency(evaluation.pools.savings.allocated, currency)}
                      </span>
                    </span>
                  </div>
                  {/* Savings Progress Bar */}
                  <div className="space-y-1">
                    <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-300"
                        style={{ width: `${evaluation.pools.savings.progressPercent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-zinc-400">
                      <span>{t('savingsProgress')}: {evaluation.pools.savings.progressPercent}%</span>
                      <span>
                        {t('poolRemaining')}: {formatCurrency(evaluation.pools.savings.remaining, currency)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Fixed Obligations Pool */}
                <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-purple-500/20 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-purple-400">
                    <span className="flex items-center gap-1.5">
                      <ShoppingBag className="w-4 h-4" />
                      <span>{t('poolFixed')}</span>
                    </span>
                    <span className="text-[10px] font-mono bg-purple-500/20 px-1.5 py-0.5 rounded text-purple-300">
                      {Math.round(
                        (evaluation.pools.fixed.allocated /
                          Math.max(1, evaluation.pools.total.income)) *
                          100
                      )}
                      %
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline font-mono text-sm">
                    <span className="text-zinc-400 text-xs">{t('poolRemaining')}:</span>
                    <span className="font-bold text-white">
                      {formatCurrency(evaluation.pools.fixed.remaining, currency)}
                    </span>
                  </div>
                </div>

                {/* Outings Pool */}
                <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-amber-500/20 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                    <span className="flex items-center gap-1.5">
                      <Coffee className="w-4 h-4" />
                      <span>{t('poolOutings')}</span>
                    </span>
                    <span className="text-[10px] font-mono bg-amber-500/20 px-1.5 py-0.5 rounded text-amber-300">
                      {Math.round(
                        (evaluation.pools.outings.allocated /
                          Math.max(1, evaluation.pools.total.income)) *
                          100
                      )}
                      %
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline font-mono text-sm">
                    <span className="text-zinc-400 text-xs">{t('poolRemaining')}:</span>
                    <span
                      className={`font-bold ${
                        evaluation.pools.outings.remaining < 0 ? 'text-red-400' : 'text-white'
                      }`}
                    >
                      {formatCurrency(evaluation.pools.outings.remaining, currency)}
                    </span>
                  </div>
                </div>

                {/* Daily Living Pool */}
                <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-emerald-500/20 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                    <span className="flex items-center gap-1.5">
                      <Wallet className="w-4 h-4" />
                      <span>{t('poolDaily')}</span>
                    </span>
                    <span className="text-[10px] font-mono bg-emerald-500/20 px-1.5 py-0.5 rounded text-emerald-300">
                      {Math.round(
                        (evaluation.pools.daily.allocated /
                          Math.max(1, evaluation.pools.total.income)) *
                          100
                      )}
                      %
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline font-mono text-sm">
                    <span className="text-zinc-400 text-xs">{t('poolRemaining')}:</span>
                    <span
                      className={`font-bold ${
                        evaluation.pools.daily.remaining < 0 ? 'text-red-400' : 'text-white'
                      }`}
                    >
                      {formatCurrency(evaluation.pools.daily.remaining, currency)}
                    </span>
                  </div>
                </div>
              </div>

              {/* What-If Simulator & Rebalance Scenarios (Hidden when paused) */}
              {!isCyclePaused && (
                <>
                  {/* What-If Simulator Card */}
                  <div className="p-4 sm:p-5 rounded-3xl bg-zinc-900/60 border border-zinc-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4.5 h-4.5 text-amber-400" />
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

                {/* 100% Instant Deterministic Math Results Display */}
                {whatIfCalculation && (
                  <div className="pt-2 border-t border-zinc-800 space-y-3">
                    {/* Last Day of Cycle Notice */}
                    {whatIfCalculation.isLastDay && (
                      <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-xs text-blue-200 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-400 shrink-0" />
                        <span>{t('lastDayCycleNotice')}</span>
                      </div>
                    )}

                    {/* Math Cards Grid: Pool Before->After & Daily Allowance Before->After */}
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

                        {/* Spillover note if pool is exhausted */}
                        {whatIfCalculation.spilloverToDaily > 0 && whatIfPool !== 'daily' && (
                          <p className="text-[10px] text-amber-300 leading-relaxed pt-1 border-t border-zinc-900">
                            {t('spilloverToDailyNote').replace(
                              '{over}',
                              formatCurrency(whatIfCalculation.spilloverToDaily, currency)
                            )}
                          </p>
                        )}

                        {/* One-off covered note */}
                        {whatIfCalculation.isCoveredByEmergency && (
                          <p className="text-[10px] text-emerald-300 leading-relaxed pt-1 border-t border-zinc-900">
                            {t('coveredByEmergencyCredit')}
                          </p>
                        )}
                      </div>

                      {/* Card 2: Projected Daily Allowance Before -> After */}
                      <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
                          <span>{t('whatIfDailyBeforeAfter')}</span>
                          <span className="text-[10px] font-mono text-zinc-500">
                            {whatIfCalculation.isLastDay
                              ? isArabic ? 'اليوم الأخير' : 'Last Day'
                              : isArabic
                              ? `على مدى ${Math.max(1, whatIfCalculation.remainingDaysInCycle - 1)} يوماً`
                              : `Over ${Math.max(1, whatIfCalculation.remainingDaysInCycle - 1)} days`}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm font-mono">
                          <span className="text-zinc-300">
                            {formatCurrency(whatIfCalculation.allowanceBefore, currency)}
                          </span>
                          <span className="text-zinc-500 text-xs">→</span>
                          <span
                            className={`font-bold ${
                              whatIfCalculation.allowanceAfter < whatIfCalculation.allowanceBefore
                                ? whatIfCalculation.allowanceAfter <= 0
                                  ? 'text-red-400'
                                  : 'text-amber-300'
                                : 'text-emerald-400'
                            }`}
                          >
                            {formatCurrency(whatIfCalculation.allowanceAfter, currency)}
                          </span>
                        </div>

                        {/* Exact Daily Impact Pill */}
                        <div className="pt-1 border-t border-zinc-900 flex items-center justify-between">
                          <span className="text-[10px] text-zinc-400">
                            {t('whatIfDailyImpact')}:
                          </span>
                          {whatIfCalculation.dailyImpact === 0 ? (
                            <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              {t('noDailyImpact')}
                            </span>
                          ) : (
                            <span
                              className={`text-[11px] font-mono font-bold ${
                                whatIfCalculation.allowanceAfter <= 0
                                  ? 'text-red-400'
                                  : 'text-amber-400'
                              }`}
                            >
                              {whatIfCalculation.isLastDay
                                ? t('lastDayDailyImpact').replace(
                                    '{amount}',
                                    formatCurrency(Math.abs(whatIfCalculation.dailyImpact), currency)
                                  )
                                : `-${formatCurrency(Math.abs(whatIfCalculation.dailyImpact), currency)} ${t('perDay')}`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Adaptive Rebalance Scenarios Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-white">
                      {t('scenariosTitle')}
                    </h4>
                    <p className="text-[11px] text-zinc-400">{t('scenariosDesc')}</p>
                  </div>
                  {currentOverride?.appliedScenario && (
                    <button
                      type="button"
                      onClick={handleRevertToBaseline}
                      className="min-h-[44px] px-3 py-1.5 rounded-xl bg-zinc-850 hover:bg-zinc-800 text-amber-300 text-xs font-bold border border-amber-500/30 flex items-center gap-1.5 transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{t('revertToBaseline')}</span>
                    </button>
                  )}
                </div>

                {/* Rebalance Section Body: If NO deficit, show calm budget on track card. If deficit exists (D > 0), show What caused overspend + Rebalance Cards */}
                {!evaluation.rebalanceScenarios.hasDeficit ? (
                  <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-center space-y-2">
                    <div className="w-10 h-10 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <h5 className="text-xs font-bold text-white">
                      {t('budgetBalancedTitle')}
                    </h5>
                    <p className="text-[11px] text-zinc-400 max-w-sm mx-auto">
                      {t('budgetBalancedDesc')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* What caused the overspend summary */}
                    <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-3">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-amber-400" />
                        <h5 className="text-xs font-bold text-white">
                          {t('whatCausedOverspend')}
                        </h5>
                      </div>
                      <p className="text-[11px] text-zinc-400">
                        {t('whatCausedOverspendDesc')}
                      </p>

                      {topOverspendCategories.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                          {topOverspendCategories.map((item, idx) => (
                            <div
                              key={item.categoryId || idx}
                              className="p-3 rounded-xl bg-zinc-950 border border-zinc-850 flex items-center justify-between sm:flex-col sm:items-start sm:justify-center gap-2"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-base shrink-0 select-none">
                                  {item.icon || '📁'}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-zinc-200 truncate">
                                    {item.name}
                                  </p>
                                  <p className="text-[10px] text-zinc-500">
                                    {item.pool === 'outings' ? t('poolOutings') : t('poolDaily')} • {item.count} {isArabic ? 'معاملات' : 'txs'}
                                  </p>
                                </div>
                              </div>
                              <span className="font-mono text-xs font-bold text-red-400 shrink-0">
                                {formatCurrency(item.amount, currency)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-500 italic py-2">
                          {t('noOverspendCategories')}
                        </p>
                      )}
                    </div>

                    {/* Rebalance Scenario Cards (Capped at actual remaining funding sources) */}
                    <div className="space-y-3">
                      {evaluation.rebalanceScenarios.scenarios.map((scenario) => {
                        const isScenarioActive =
                          currentOverride?.appliedScenario === scenario.id ||
                          (scenario.id === 'B' && currentOverride?.appliedScenario === 'outings') ||
                          (scenario.id === 'C' && currentOverride?.appliedScenario === 'savings') ||
                          (scenario.id === 'A' && currentOverride?.appliedScenario === 'fixed');

                        return (
                          <div
                            key={scenario.id}
                            className={`p-4 rounded-2xl border transition ${
                              isScenarioActive
                                ? 'bg-emerald-950/30 border-emerald-500'
                                : 'bg-zinc-900/70 border-zinc-800'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-bold text-white">
                                {scenario.name[isArabic ? 'ar' : 'en']}
                              </span>
                              {isScenarioActive && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  {t('activeCurrently')}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-400 mb-2.5">
                              {scenario.description[isArabic ? 'ar' : 'en']}
                            </p>

                            {/* Funding Source Pill */}
                            <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg bg-zinc-950/80 border border-zinc-850 mb-3">
                              <span className="text-zinc-400">
                                {t('fundingSource')}:{' '}
                                <span className="text-zinc-200 font-semibold">
                                  {scenario.sourceName[isArabic ? 'ar' : 'en']}
                                </span>
                              </span>
                              <span className="font-mono text-zinc-300">
                                {t('availableBalance').replace(
                                  '{amount}',
                                  formatCurrency(scenario.sourceAvailable, currency)
                                )}
                              </span>
                            </div>

                            {/* Before & After Display */}
                            <div className="flex items-center justify-between text-xs font-mono mb-3 p-2.5 rounded-xl bg-zinc-950">
                              <span className="text-red-400 font-semibold">
                                {t('beforeDaily')}:{' '}
                                {t('overByAmount').replace(
                                  '{amount}',
                                  formatCurrency(scenario.deficit, currency)
                                )}
                              </span>
                              <span className="text-emerald-400 font-bold">
                                {t('afterDaily')}: {formatCurrency(scenario.afterDailyAllowance, currency)}
                              </span>
                            </div>

                            <button
                              type="button"
                              disabled={!scenario.isAvailable}
                              onClick={() => handleApplyScenario(scenario.id)}
                              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            >
                              {scenario.isAvailable
                                ? t('applyToCurrentMonth')
                                : scenario.unavailableReason?.[isArabic ? 'ar' : 'en'] ||
                                  t('scenarioUnavailable')}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              </>
            )}
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 2: BASELINE PLAN */}
          {/* =============================================================== */}
          {activeTab === 'baseline' && (
            <div className="space-y-6">
              {/* Planned Income */}
              <div className="p-4 sm:p-5 rounded-3xl bg-zinc-900/60 border border-zinc-800 space-y-4">
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

              {/* 4-Pool Dual-Input Allocations (Always Totaling 100%) */}
              <div className="p-4 sm:p-5 rounded-3xl bg-zinc-900/60 border border-zinc-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-bold text-white">
                    {t('poolSlidersTitle')}
                  </h4>
                  <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    {t('mustTotal100')}
                  </span>
                </div>

                {/* Pool 1: Savings (Slider + Amount Input) */}
                <div
                  className={`p-3.5 rounded-2xl bg-zinc-950/70 border border-blue-500/20 space-y-2.5 ${
                    incomeMinor <= 0 ? 'opacity-40 pointer-events-none' : ''
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold text-blue-400">
                    <span className="flex items-center gap-1.5">
                      <PiggyBank className="w-4 h-4" />
                      <span>{t('poolSavings')}</span>
                    </span>
                    <span className="text-[10px] font-mono bg-blue-500/20 px-2 py-0.5 rounded-full text-blue-300">
                      {pools.savings.percent}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 items-center">
                    {/* Percentage Slider */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-zinc-400">
                        <span>% {t('poolAllocated')}</span>
                        <span className="font-mono text-white font-semibold">
                          {pools.savings.percent}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={60}
                        step={0.5}
                        value={pools.savings.percent}
                        disabled={incomeMinor <= 0}
                        onChange={(e) =>
                          handleSliderChange('savings', parseFloat(e.target.value))
                        }
                        className="w-full accent-blue-500 cursor-pointer min-h-[44px]"
                      />
                    </div>

                    {/* Amount Input with Thousands Commas & Stable Caret */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-zinc-400">
                        <span>{currency}</span>
                        <span className="text-[10px] text-zinc-500 uppercase">
                          {pools.savings.mode}
                        </span>
                      </div>
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
                          className="w-full min-h-[44px] px-3.5 py-2 pe-12 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono text-sm focus:border-blue-500 focus:outline-none"
                        />
                        <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-mono pointer-events-none">
                          {currency}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-zinc-500">
                    <span>{t('noMinSavings')}</span>
                    {poolHints.savings && (
                      <span className="text-amber-400 font-medium">
                        {poolHints.savings}
                      </span>
                    )}
                  </div>
                </div>

                {/* Pool 2: Bills & Fixed Obligations (Slider + Amount Input) */}
                <div
                  className={`p-3.5 rounded-2xl bg-zinc-950/70 border border-purple-500/20 space-y-2.5 ${
                    incomeMinor <= 0 ? 'opacity-40 pointer-events-none' : ''
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold text-purple-400">
                    <span className="flex items-center gap-1.5">
                      <ShoppingBag className="w-4 h-4" />
                      <span>{t('poolFixed')}</span>
                    </span>
                    <span className="text-[10px] font-mono bg-purple-500/20 px-2 py-0.5 rounded-full text-purple-300">
                      {pools.fixed.percent}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 items-center">
                    {/* Percentage Slider */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-zinc-400">
                        <span>% {t('poolAllocated')}</span>
                        <span className="font-mono text-white font-semibold">
                          {pools.fixed.percent}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={70}
                        step={0.5}
                        value={pools.fixed.percent}
                        disabled={incomeMinor <= 0}
                        onChange={(e) =>
                          handleSliderChange('fixed', parseFloat(e.target.value))
                        }
                        className="w-full accent-purple-500 cursor-pointer min-h-[44px]"
                      />
                    </div>

                    {/* Amount Input with Thousands Commas & Stable Caret */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-zinc-400">
                        <span>{currency}</span>
                        <span className="text-[10px] text-zinc-500 uppercase">
                          {pools.fixed.mode}
                        </span>
                      </div>
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
                          className="w-full min-h-[44px] px-3.5 py-2 pe-12 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono text-sm focus:border-purple-500 focus:outline-none"
                        />
                        <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-mono pointer-events-none">
                          {currency}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Detected recurring bills button */}
                  {detectedRecurringBills > 0 && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={handleApplyDetectedRecurringBills}
                        className="min-h-[44px] px-3 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-xs font-semibold border border-purple-500/30 flex items-center gap-2 transition w-full sm:w-auto"
                      >
                        <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {t('useDetectedRecurringBills').replace(
                            '{amount}',
                            formatCurrency(detectedRecurringBills, currency)
                          )}
                        </span>
                      </button>
                    </div>
                  )}

                  {poolHints.fixed && (
                    <div className="text-[10px] text-amber-400 font-medium">
                      {poolHints.fixed}
                    </div>
                  )}
                </div>

                {/* Pool 3: Outings (Slider + Amount Input) */}
                <div
                  className={`p-3.5 rounded-2xl bg-zinc-950/70 border border-amber-500/20 space-y-2.5 ${
                    incomeMinor <= 0 ? 'opacity-40 pointer-events-none' : ''
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                    <span className="flex items-center gap-1.5">
                      <Coffee className="w-4 h-4" />
                      <span>{t('poolOutings')}</span>
                    </span>
                    <span className="text-[10px] font-mono bg-amber-500/20 px-2 py-0.5 rounded-full text-amber-300">
                      {pools.outings.percent}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 items-center">
                    {/* Percentage Slider */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-zinc-400">
                        <span>% {t('poolAllocated')}</span>
                        <span className="font-mono text-white font-semibold">
                          {pools.outings.percent}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={50}
                        step={0.5}
                        value={pools.outings.percent}
                        disabled={incomeMinor <= 0}
                        onChange={(e) =>
                          handleSliderChange('outings', parseFloat(e.target.value))
                        }
                        className="w-full accent-amber-500 cursor-pointer min-h-[44px]"
                      />
                    </div>

                    {/* Amount Input with Thousands Commas & Stable Caret */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-zinc-400">
                        <span>{currency}</span>
                        <span className="text-[10px] text-zinc-500 uppercase">
                          {pools.outings.mode}
                        </span>
                      </div>
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
                          className="w-full min-h-[44px] px-3.5 py-2 pe-12 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono text-sm focus:border-amber-500 focus:outline-none"
                        />
                        <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-mono pointer-events-none">
                          {currency}
                        </span>
                      </div>
                    </div>
                  </div>

                  {poolHints.outings && (
                    <div className="text-[10px] text-amber-400 font-medium">
                      {poolHints.outings}
                    </div>
                  )}
                </div>

                {/* Pool 4: Daily Spending (Automatic Remainder, Read-Only) */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-zinc-950 to-zinc-950 border border-emerald-500/30 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                    <span className="flex items-center gap-1.5">
                      <Wallet className="w-4 h-4" />
                      <span>{t('poolDaily')}</span>
                    </span>
                    <span className="text-[10px] font-mono bg-emerald-500/20 px-2 py-0.5 rounded-full text-emerald-300 font-bold">
                      {dailyPercent}%
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between py-1">
                    <span className="text-xs text-zinc-400 font-medium">
                      {t('poolAllocated')}:
                    </span>
                    <span className="text-xl sm:text-2xl font-extrabold font-mono text-white">
                      {formatCurrency(dailyMinor / 100, currency)}
                    </span>
                  </div>

                  <div className="text-[11px] text-emerald-400/90 font-medium bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
                    {t('dailyRemainderHint')}
                  </div>
                </div>

                {/* Ask AI to Optimize Button & Preview */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleAskAIToOptimize}
                    disabled={isOptimizingWithAI}
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-emerald-300 font-bold text-xs flex items-center justify-center gap-2 border border-emerald-500/30 transition disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{isOptimizingWithAI ? t('optimizing') : t('askAIToOptimize')}</span>
                  </button>

                  {aiOptimizationPreview && (
                    <div className="mt-3 p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 space-y-3">
                      <div className="text-xs text-emerald-200 leading-relaxed">
                        {aiOptimizationPreview.explanation}
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono font-bold">
                        <div className="p-2 rounded bg-zinc-950/60 text-blue-300">
                          {aiOptimizationPreview.savings}%
                        </div>
                        <div className="p-2 rounded bg-zinc-950/60 text-purple-300">
                          {aiOptimizationPreview.fixed}%
                        </div>
                        <div className="p-2 rounded bg-zinc-950/60 text-amber-300">
                          {aiOptimizationPreview.outings}%
                        </div>
                        <div className="p-2 rounded bg-zinc-950/60 text-emerald-300">
                          {aiOptimizationPreview.daily}%
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleApplyAIOptimization}
                        className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
                      >
                        {t('applyAIAllocation')}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Fixed Categories Selection */}
              <div className="p-4 sm:p-5 rounded-3xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                <h4 className="text-xs sm:text-sm font-bold text-white">
                  {t('fixedCategoriesPicker')}
                </h4>
                <p className="text-[11px] text-zinc-400">{t('fixedCategoriesDesc')}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {categories.map((cat) => {
                    const isSelected = selectedFixedCatIds.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setSelectedFixedCatIds((prev) =>
                            isSelected ? prev.filter((id) => id !== cat.id) : [...prev, cat.id]
                          );
                        }}
                        className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-purple-500/20 border-purple-500/50 text-purple-200'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <span>{cat.icon || '📁'}</span>
                        <span>{cat.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-purple-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Configurable Heads-up Alert Threshold */}
              <div className="p-4 sm:p-5 rounded-3xl bg-zinc-900/60 border border-zinc-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-bold text-white">
                    {t('headsUpThresholdLabel')}
                  </h4>
                  <span className="text-xs font-mono font-bold text-amber-300 bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                    {headsUpThresholdPercent}%
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">{t('headsUpThresholdDesc')}</p>
                <input
                  type="range"
                  min={50}
                  max={90}
                  step={5}
                  value={headsUpThresholdPercent}
                  onChange={(e) => setHeadsUpThresholdPercent(parseInt(e.target.value, 10))}
                  className="w-full accent-amber-500 cursor-pointer min-h-[44px]"
                />
              </div>

              {/* Save Baseline Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSaveBaseline}
                  className="w-full min-h-[48px] px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-xl shadow-emerald-950/40 transition active:scale-[0.99]"
                >
                  {t('saveBaselinePlan')}
                </button>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 3: AI ADVISOR & SECRETS */}
          {/* =============================================================== */}
          {activeTab === 'aiAdvisor' && (
            <div className="space-y-6">
              {/* Consent Toggle & Disclosure Card */}
              <div className="p-4 sm:p-5 rounded-3xl bg-zinc-900/60 border border-zinc-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 me-3">
                    <h4 className="text-xs sm:text-sm font-bold text-white">
                      {t('aiConsentToggle')}
                    </h4>
                    <p className="text-[11px] text-zinc-400">{t('aiConsentToggleDesc')}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={aiConsentEnabled}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setAiConsentEnabled(next);
                        setAIConsent(next);
                        showToast(t('updatedSuccess'), 'info');
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
                  </label>
                </div>

                {/* Disclosure text */}
                <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-300 leading-relaxed space-y-2">
                  <p className="font-bold text-zinc-200">
                    {AI_CONSENT_DISCLOSURE[isArabic ? 'ar' : 'en'].title}
                  </p>
                  <p>{AI_CONSENT_DISCLOSURE[isArabic ? 'ar' : 'en'].description}</p>
                  <p className="text-emerald-400 font-medium">
                    {AI_CONSENT_DISCLOSURE[isArabic ? 'ar' : 'en'].disclaimer}
                  </p>
                </div>
              </div>

              {/* Private Gemini Key Management (Hidden behind Advanced Settings when proxy/backend key is available) */}
              <div className="p-4 sm:p-5 rounded-3xl bg-zinc-900/60 border border-zinc-800 space-y-4">
                {managedAiAvailable && !storedApiKey && (
                  <div className="p-3.5 rounded-2xl bg-emerald-950/25 border border-emerald-500/30 flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <span className="text-xs font-bold text-emerald-300 block">
                        {t('managedAiActiveBadge')}
                      </span>
                      <p className="text-[11px] text-zinc-300 leading-relaxed">
                        {t('managedAiActiveDesc')}
                      </p>
                    </div>
                  </div>
                )}

                {managedAiAvailable && !storedApiKey && (
                  <button
                    type="button"
                    onClick={() => setShowAdvancedKeySection((prev) => !prev)}
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl bg-zinc-950/70 hover:bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs font-semibold text-zinc-300 transition"
                  >
                    <span className="flex items-center gap-2 min-w-0 truncate">
                      <KeyRound className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">{t('advancedPersonalApiKeyToggle')}</span>
                    </span>
                    {showAdvancedKeySection ? (
                      <ChevronUp className="w-4 h-4 text-zinc-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" />
                    )}
                  </button>
                )}

                {(!managedAiAvailable || Boolean(storedApiKey) || showAdvancedKeySection) && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                          <KeyRound className="w-4 h-4 text-emerald-400" />
                          <span>{t('geminiApiKeyLabel')}</span>
                        </h4>
                        <p className="text-[11px] text-zinc-400">{t('geminiApiKeyDesc')}</p>
                      </div>
                    </div>

                    {storedApiKey && !isEditingKey ? (
                      <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                        <span className="font-mono text-sm tracking-wider text-emerald-300">
                          {maskGeminiApiKey(storedApiKey)}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsEditingKey(true)}
                            className="min-h-[44px] px-3 py-1.5 rounded-xl bg-zinc-850 hover:bg-zinc-800 text-xs font-bold text-zinc-200 transition"
                          >
                            {t('edit')}
                          </button>
                          <button
                            type="button"
                            onClick={handleClearKey}
                            className="min-h-[44px] px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/50 text-red-300 text-xs font-bold border border-red-500/30 flex items-center gap-1 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{t('clearApiKeyBtn')}</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <input
                          type="password"
                          value={inputApiKey}
                          onChange={(e) => setInputApiKey(e.target.value)}
                          placeholder={t('geminiApiKeyPlaceholder')}
                          className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono text-sm focus:border-emerald-500 focus:outline-none"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleSaveKey}
                            disabled={!inputApiKey.trim()}
                            className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition disabled:opacity-40"
                          >
                            {t('saveApiKeyBtn')}
                          </button>
                          {storedApiKey && (
                            <button
                              type="button"
                              onClick={() => setIsEditingKey(false)}
                              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-zinc-850 text-zinc-300 font-bold text-xs transition"
                            >
                              {t('cancel')}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Test Connection Button */}
                {(storedApiKey || hasAIAccessState || managedAiAvailable || Boolean(auth.currentUser)) && (
                  <div className="pt-1 space-y-3">
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={isTestingConnection}
                      className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-200 font-bold text-xs flex items-center justify-center gap-2 border border-zinc-700 transition disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTestingConnection ? 'animate-spin' : ''}`} />
                      <span>{isTestingConnection ? t('testingConnection') : t('testConnectionBtn')}</span>
                    </button>

                    {connectionTestResult && (
                      <div
                        className={`p-3.5 rounded-2xl border text-xs leading-relaxed space-y-1.5 transition-all ${
                          connectionTestResult.ok
                            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                            : 'bg-red-950/40 border-red-500/40 text-red-200'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold">
                          <div className="flex items-center gap-1.5">
                            {connectionTestResult.ok ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                            )}
                            <span>
                              {connectionTestResult.ok
                                ? t('connectionSuccess')
                                : t('connectionFailed')}
                            </span>
                          </div>
                          {connectionTestResult.source && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-750 text-zinc-300">
                              {connectionTestResult.source === 'personal'
                                ? t('sourcePersonalKey')
                                : connectionTestResult.source === 'proxy'
                                ? t('sourceBackendProxy')
                                : t('sourceSharedKey')}
                            </span>
                          )}
                        </div>

                        {connectionTestResult.modelUsed && (
                          <div className="text-[11px] text-zinc-400 font-mono">
                            Model: {connectionTestResult.modelUsed}
                            {connectionTestResult.statusCode ? ` • HTTP ${connectionTestResult.statusCode}` : ''}
                          </div>
                        )}

                        {(!connectionTestResult.ok || connectionTestResult.message) && (
                          <div className={`text-[11px] font-medium leading-normal break-words pt-1 ${
                            connectionTestResult.ok ? 'text-emerald-300/90' : 'text-red-300'
                          }`}>
                            {isArabic ? connectionTestResult.messageAr : connectionTestResult.message}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* AI Budget Advisor Card */}
              <div className="p-4 sm:p-5 rounded-3xl bg-zinc-900/60 border border-zinc-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{t('aiBudgetAdvisorTitle')}</span>
                    </h4>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {t('aiBudgetAdvisorDesc')}
                    </p>
                  </div>
                </div>

                {!aiConsentEnabled ? (
                  <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-amber-200 text-xs space-y-2">
                    <div className="flex items-center gap-2 font-semibold">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>{t('aiAdvisorConsentRequired')}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAiConsentEnabled(true);
                        setAIConsent(true);
                        showToast(t('updatedSuccess'), 'info');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{t('enableConsentBtn')}</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={handleGetAdvice}
                      disabled={isLoadingAdvice}
                      className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition disabled:opacity-50"
                    >
                      <Sparkles className={`w-4 h-4 ${isLoadingAdvice ? 'animate-spin' : ''}`} />
                      <span>{isLoadingAdvice ? t('analyzingBudget') : (adviceData ? t('refreshAdviceBtn') : t('getAdviceBtn'))}</span>
                    </button>

                    {adviceData && (
                      <div className="p-4 rounded-2xl bg-zinc-950 border border-emerald-500/30 space-y-3.5">
                        {/* Headline & Source Badge */}
                        <div className="flex items-center justify-between gap-2">
                          <h5 className="text-xs sm:text-sm font-bold text-emerald-300">
                            {adviceData.headline}
                          </h5>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                              adviceData.source === 'ai'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                            }`}>
                              {adviceData.source === 'ai' ? 'Gemini AI' : 'Smart Engine'}
                            </span>
                          </div>
                        </div>

                        {/* Top Observation */}
                        <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800/80 space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3 text-emerald-400" />
                            <span>{t('keyObservation')}</span>
                          </span>
                          <p className="text-xs text-zinc-200 leading-relaxed">
                            {adviceData.topObservation}
                          </p>
                        </div>

                        {/* Actionable Advice List */}
                        {adviceData.actionableAdvice && adviceData.actionableAdvice.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-teal-400" />
                              <span>{t('actionableRecommendations')}</span>
                            </span>
                            <div className="space-y-1.5">
                              {adviceData.actionableAdvice.map((rec, idx) => (
                                <div
                                  key={idx}
                                  className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/60 flex items-start gap-2 text-xs text-zinc-300 leading-relaxed"
                                >
                                  <span className="text-emerald-400 font-bold shrink-0 mt-0.5">•</span>
                                  <span>{rec}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Data Protection Disclaimer */}
                        <div className="pt-1 flex items-center gap-1.5 text-[10px] text-zinc-500">
                          <Shield className="w-3 h-3 text-zinc-400 shrink-0" />
                          <span>{t('dataProtectionSummary')}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Usage Metrics & Cache Management */}
              <div className="p-4 sm:p-5 rounded-3xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-zinc-400">{t('aiMonthlyRequestsLabel')}:</span>
                  <span className="font-mono text-white font-bold">
                    {monthlyUsage.count} ({monthlyUsage.month})
                  </span>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      clearAICache();
                      showToast(t('cacheClearedSuccess'), 'info');
                    }}
                    className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-medium border border-zinc-800 transition"
                  >
                    {t('clearCacheBtn')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
