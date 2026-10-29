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
  SmartBudgetConfig,
  SmartBudgetEvaluation,
} from '../utils/smartBudgetEngine';
import {
  PoolAllocationConfig,
  SmartBudgetBaselineConfig,
} from '../types';
import {
  hasAIConsent,
  setAIConsent,
  getAIMonthlyUsage,
  AI_CONSENT_DISCLOSURE,
  suggestSalaryAllocation,
  evaluatePeriodicHealthAndWhatIf,
  clearAICache,
  hasAIAccess,
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
  const [whatIfPool, setWhatIfPool] = useState<'daily' | 'outings'>('outings');
  const [aiWhatIfAdvice, setAiWhatIfAdvice] = useState<string | null>(null);
  const [isAskingAI, setIsAskingAI] = useState<boolean>(false);

  // ==========================================================================
  // TAB 2: BASELINE PLAN DRAFT STATE & 4-POOL ALLOCATION
  // ==========================================================================
  const baselineSettings = settings.smartBudget?.baseline || {};
  const [startDayInput, setStartDayInput] = useState<number | 'auto'>(
    baselineSettings.startDay ?? 1
  );
  const [plannedIncomeInput, setPlannedIncomeInput] = useState<string>(
    baselineSettings.plannedIncome ? String(baselineSettings.plannedIncome) : ''
  );
  const [pools, setPools] = useState<PoolsState>(() =>
    initPoolsFromSettings(baselineSettings, baselineSettings.plannedIncome || 0)
  );
  const [poolHints, setPoolHints] = useState<{
    savings: string | null;
    fixed: string | null;
    outings: string | null;
  }>({ savings: null, fixed: null, outings: null });

  const savingsMinPercent = 10;
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

  // Synchronize baseline state from settings
  useEffect(() => {
    if (baselineSettings) {
      if (baselineSettings.fixedCategoryIds) {
        setSelectedFixedCatIds(baselineSettings.fixedCategoryIds);
      }
      if (baselineSettings.includedAccountIds) {
        setSelectedAccountIds(baselineSettings.includedAccountIds);
      }
    }
  }, [settings.smartBudget?.baseline]);

  // Derived income minor units & daily remainder
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
  const [connectionTestResult, setConnectionTestResult] = useState<'success' | 'error' | null>(null);
  const [hasAIAccessState, setHasAIAccessState] = useState<boolean>(false);

  // Refresh AI key & metrics when tab opens
  useEffect(() => {
    if (activeTab === 'aiAdvisor') {
      setStoredApiKey(getLocalGeminiApiKey());
      setAiConsentEnabled(hasAIConsent());
      setMonthlyUsage(getAIMonthlyUsage());
      hasAIAccess().then(setHasAIAccessState);
    }
  }, [activeTab]);

  // ==========================================================================
  // EVALUATION & CURRENT CYCLE KEY
  // ==========================================================================
  const evaluation: SmartBudgetEvaluation = useMemo(() => {
    const planned = parseFloat(plannedIncomeInput.replace(/,/g, '')) || 0;
    const config: SmartBudgetConfig = {
      baseCurrency: currency,
      startDay: startDayInput === 'auto' ? 'auto' : startDayInput,
      plannedIncome: planned > 0 ? planned : undefined,
      savings: { type: 'percent', value: pools.savings.percent },
      plannedFixedObligations: pools.fixed.minorUnits / 100,
      outingsBudget: pools.outings.minorUnits / 100,
      fixedCategoryIds: selectedFixedCatIds,
      includedAccountIds: selectedAccountIds,
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
    startDayInput,
    plannedIncomeInput,
    pools,
    selectedFixedCatIds,
    selectedAccountIds,
    weekendMultiplier,
  ]);

  const currentCycleKey = evaluation.cycle.startDate.slice(0, 7); // YYYY-MM
  const currentOverride = settings.smartBudget?.overrides?.[currentCycleKey];

  if (!isOpen) return null;

  // ==========================================================================
  // DUAL-INPUT REBALANCER (PERCENT SLIDER + COMMAS AMOUNT INPUT)
  // ==========================================================================
  const handlePlannedIncomeChange = (valStr: string) => {
    setPlannedIncomeInput(valStr);
    const newIncome = parseFloat(valStr.replace(/,/g, '')) || 0;
    const newMinor = Math.round(newIncome * 100);

    if (newMinor <= 0) {
      setPools((prev) => ({
        savings: { ...prev.savings, minorUnits: 0, amountText: '0' },
        fixed: { ...prev.fixed, minorUnits: 0, amountText: '0' },
        outings: { ...prev.outings, minorUnits: 0, amountText: '0' },
      }));
      return;
    }

    setPools((prev) => {
      let sMinor = prev.savings.minorUnits;
      let sPct = prev.savings.percent;
      let fMinor = prev.fixed.minorUnits;
      let fPct = prev.fixed.percent;
      let oMinor = prev.outings.minorUnits;
      let oPct = prev.outings.percent;

      // Keep percent pools at their percent
      if (prev.savings.mode === 'percent') {
        sMinor = Math.round(newMinor * (sPct / 100));
      }
      if (prev.fixed.mode === 'percent') {
        fMinor = Math.round(newMinor * (fPct / 100));
      }
      if (prev.outings.mode === 'percent') {
        oMinor = Math.round(newMinor * (oPct / 100));
      }

      // Keep amount pools at their amount and derive percent
      if (prev.savings.mode === 'amount') {
        sPct = Math.round(((sMinor / newMinor) * 100) * 10) / 10;
      }
      if (prev.fixed.mode === 'amount') {
        fPct = Math.round(((fMinor / newMinor) * 100) * 10) / 10;
      }
      if (prev.outings.mode === 'amount') {
        oPct = Math.round(((oMinor / newMinor) * 100) * 10) / 10;
      }

      // Safety clamp if sum exceeds new income
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
    });
  };

  const handleSliderChange = (poolKey: 'savings' | 'fixed' | 'outings', val: number) => {
    if (incomeMinor <= 0) return;
    setPoolHints((h) => ({ ...h, [poolKey]: null }));

    setPools((prev) => {
      let otherMinor = 0;
      if (poolKey === 'savings') otherMinor = prev.fixed.minorUnits + prev.outings.minorUnits;
      if (poolKey === 'fixed') otherMinor = prev.savings.minorUnits + prev.outings.minorUnits;
      if (poolKey === 'outings') otherMinor = prev.savings.minorUnits + prev.fixed.minorUnits;

      const maxMinor = Math.max(0, incomeMinor - otherMinor);
      const maxPct = Math.round(((maxMinor / incomeMinor) * 100) * 10) / 10;

      let clampedPct = val;
      let hint: string | null = null;

      if (poolKey === 'savings' && clampedPct < savingsMinPercent) {
        clampedPct = Math.min(savingsMinPercent, maxPct);
        hint = t('minSavingsHint').replace('{min}', String(savingsMinPercent));
      }

      if (clampedPct > maxPct) {
        clampedPct = maxPct;
        hint = t('maxAllowedPoolHint')
          .replace('{amount}', formatCurrency(maxMinor / 100, currency))
          .replace('{percent}', String(maxPct));
      }

      if (hint) {
        setPoolHints((h) => ({ ...h, [poolKey]: hint }));
      }

      const newMinor = Math.min(maxMinor, Math.round(incomeMinor * (clampedPct / 100)));

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

  const handleAmountChange = (
    poolKey: 'savings' | 'fixed' | 'outings',
    rawInput: string,
    inputEl: HTMLInputElement | null
  ) => {
    if (incomeMinor <= 0) return;

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
    if (poolKey === 'savings') otherMinor = pools.fixed.minorUnits + pools.outings.minorUnits;
    if (poolKey === 'fixed') otherMinor = pools.savings.minorUnits + pools.outings.minorUnits;
    if (poolKey === 'outings') otherMinor = pools.savings.minorUnits + pools.fixed.minorUnits;

    const maxMinor = Math.max(0, incomeMinor - otherMinor);
    const maxPct = Math.round(((maxMinor / incomeMinor) * 100) * 10) / 10;

    let hint: string | null = null;
    if (valMinor > maxMinor) {
      valMinor = maxMinor;
      hint = t('maxAllowedPoolHint')
        .replace('{amount}', formatCurrency(maxMinor / 100, currency))
        .replace('{percent}', String(maxPct));
    } else if (
      poolKey === 'savings' &&
      valMinor < Math.round(incomeMinor * (savingsMinPercent / 100))
    ) {
      hint = t('minSavingsHint').replace('{min}', String(savingsMinPercent));
    }

    setPoolHints((h) => ({ ...h, [poolKey]: hint }));

    const derivedPct = Math.round(((valMinor / incomeMinor) * 100) * 10) / 10;

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

    setPools((prev) => ({
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

  const handleAmountBlur = (poolKey: 'savings' | 'fixed' | 'outings') => {
    setPools((prev) => {
      let minor = prev[poolKey].minorUnits;
      if (poolKey === 'savings' && incomeMinor > 0) {
        const minMinor = Math.round(incomeMinor * (savingsMinPercent / 100));
        if (minor < minMinor) {
          minor = minMinor;
        }
      }
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
  const handleApplyScenario = (scenarioId: 'A' | 'B' | 'C') => {
    const newOverrides = {
      ...(settings.smartBudget?.overrides || {}),
      [currentCycleKey]: {
        appliedScenario: scenarioId,
        appliedAt: Date.now(),
      },
    };

    updateSettings({
      smartBudget: {
        baseline: settings.smartBudget?.baseline || {},
        overrides: newOverrides,
        updatedAt: Date.now(),
      },
    });

    showToast(t('scenarioAppliedSuccess'), 'success');
  };

  const handleRevertToBaseline = () => {
    const newOverrides = { ...(settings.smartBudget?.overrides || {}) };
    delete newOverrides[currentCycleKey];

    updateSettings({
      smartBudget: {
        baseline: settings.smartBudget?.baseline || {},
        overrides: newOverrides,
        updatedAt: Date.now(),
      },
    });

    showToast(t('scenarioRevertedSuccess'), 'info');
  };

  // ==========================================================================
  // ACTIONS: SAVE BASELINE
  // ==========================================================================
  const handleSaveBaseline = () => {
    const planned = parseFloat(plannedIncomeInput.replace(/,/g, '')) || 0;
    const newBaseline: SmartBudgetBaselineConfig = {
      startDay: startDayInput,
      plannedIncome: planned > 0 ? planned : undefined,
      savings: { type: 'percent', value: pools.savings.percent },
      plannedFixedObligations: pools.fixed.minorUnits / 100,
      outingsBudget: pools.outings.minorUnits / 100,
      fixedCategoryIds: selectedFixedCatIds,
      includedAccountIds: selectedAccountIds,
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
        updatedAt: Date.now(),
      },
    });

    showToast(t('baselineSavedSuccess'), 'success');
  };

  // ==========================================================================
  // ACTIONS: AI OPTIMIZE BASELINE
  // ==========================================================================
  const handleAskAIToOptimize = async () => {
    if (!hasAIConsent()) {
      showToast(t('aiConsentRequiredToast'), 'error');
      setActiveTab('aiAdvisor');
      return;
    }
    const canAccess = await hasAIAccess();
    if (!canAccess) {
      showToast(t('aiKeyRequiredToast'), 'error');
      setActiveTab('aiAdvisor');
      return;
    }

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
  // ACTIONS: WHAT-IF SIMULATION WITH AI
  // ==========================================================================
  const simulatedExpenseNumber = parseFloat(whatIfAmount) || 0;
  const instantProjectedAllowance = evaluation.projectedDailyAllowanceAfterSpend(
    simulatedExpenseNumber,
    whatIfPool === 'outings' ? 'outings' : 'daily'
  );

  const handleAskAIWhatIf = async () => {
    if (!hasAIConsent()) {
      showToast(t('aiConsentRequiredToast'), 'error');
      setActiveTab('aiAdvisor');
      return;
    }
    const canAccess = await hasAIAccess();
    if (!canAccess) {
      showToast(t('aiKeyRequiredToast'), 'error');
      setActiveTab('aiAdvisor');
      return;
    }

    setIsAskingAI(true);
    setAiWhatIfAdvice(null);
    try {
      const advice = await evaluatePeriodicHealthAndWhatIf({
        cycleLength: evaluation.cycle.length,
        daysRemaining: evaluation.dailyStatus.remainingDaysInCycle,
        cycleProgressPercent: Math.round(
          (evaluation.dailyStatus.cycleDayIndex / evaluation.cycle.length) * 100
        ),
        dailyPoolRemainingMinor: evaluation.pools.daily.remainingMinor,
        dailySuggestedRateMinor: evaluation.dailyStatus.todayAllowanceMinor,
        outingsRemainingMinor: evaluation.pools.outings.remainingMinor,
        emergencySpentMinor: evaluation.pools.savings.spentMinor,
        currency,
        whatIfExtraExpenseMinor: Math.round(simulatedExpenseNumber * 100),
        whatIfPool,
        language: isArabic ? 'ar' : 'en',
      });
      setAiWhatIfAdvice(advice.whatIfAnalysis || advice.adviceText);
    } catch {
      showToast(t('errorOccurred'), 'error');
    } finally {
      setIsAskingAI(false);
    }
  };

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
      const testRes = await suggestSalaryAllocation({
        plannedIncomeMajor: 10000,
        fixedObligationsMajor: 3000,
        savingsMinPercent: 10,
        language: isArabic ? 'ar' : 'en',
      });
      if (testRes && testRes.source === 'ai') {
        setConnectionTestResult('success');
        showToast(t('connectionSuccess'), 'success');
      } else {
        setConnectionTestResult('error');
        showToast(t('connectionFailed'), 'error');
      }
    } catch {
      setConnectionTestResult('error');
      showToast(t('connectionFailed'), 'error');
    } finally {
      setIsTestingConnection(false);
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
              {/* Today's Safe-to-Spend Meter */}
              <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-emerald-950/60 via-zinc-900 to-zinc-900/90 border border-emerald-500/30 shadow-xl relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <Wallet className="w-4 h-4" />
                    <span>{t('safeToSpendToday')}</span>
                  </span>
                  <span className="text-[11px] font-mono font-semibold text-zinc-400 bg-zinc-850 px-2 py-0.5 rounded-full border border-zinc-750">
                    {isArabic
                      ? `اليوم ${evaluation.dailyStatus.cycleDayIndex} من ${evaluation.dailyStatus.cycleLength} · متبقي ${evaluation.dailyStatus.remainingDaysInCycle} يوماً`
                      : `Day ${evaluation.dailyStatus.cycleDayIndex} of ${evaluation.dailyStatus.cycleLength} · ${evaluation.dailyStatus.remainingDaysInCycle} days left`}
                  </span>
                </div>

                <div className="flex items-baseline gap-2 mb-3">
                  <span
                    className={`text-3xl sm:text-4xl font-extrabold font-mono tracking-tight ${
                      evaluation.dailyStatus.todayRemaining < 0
                        ? 'text-red-400'
                        : 'text-white'
                    }`}
                  >
                    {formatCurrency(evaluation.dailyStatus.todayRemaining, currency)}
                  </span>
                  <span className="text-xs text-zinc-400 font-medium">
                    / {formatCurrency(evaluation.dailyStatus.todayAllowance, currency)} {t('todayAllowance')}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-zinc-800 rounded-full h-2.5 overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      evaluation.dailyStatus.todayRemaining < 0
                        ? 'bg-red-500'
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

                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>
                    {t('todaySpent')}: {formatCurrency(evaluation.dailyStatus.todaySpent, currency)}
                  </span>
                  {evaluation.dailyStatus.overBudgetBy > 0 && (
                    <span className="text-red-400 font-bold">
                      {t('overBudgetBy')}: {formatCurrency(evaluation.dailyStatus.overBudgetBy, currency)}
                    </span>
                  )}
                </div>
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
                    <span className="text-zinc-400 text-xs">{t('poolRemaining')}:</span>
                    <span className="font-bold text-white">
                      {formatCurrency(evaluation.pools.savings.remaining, currency)}
                    </span>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                      {t('whatIfAmount')}
                    </label>
                    <input
                      type="number"
                      value={whatIfAmount}
                      onChange={(e) => setWhatIfAmount(e.target.value)}
                      placeholder="e.g. 500"
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                      {t('whatIfPool')}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setWhatIfPool('outings')}
                        className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition ${
                          whatIfPool === 'outings'
                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                        }`}
                      >
                        {t('poolOutings')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setWhatIfPool('daily')}
                        className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition ${
                          whatIfPool === 'daily'
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                        }`}
                      >
                        {t('poolDaily')}
                      </button>
                    </div>
                  </div>
                </div>

                {simulatedExpenseNumber > 0 && (
                  <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between">
                    <span className="text-xs text-zinc-400 font-medium">
                      {t('whatIfInstantResult')}:
                    </span>
                    <span className="text-sm font-bold font-mono text-emerald-400">
                      {formatCurrency(instantProjectedAllowance, currency)}
                    </span>
                  </div>
                )}

                {/* Optional Ask AI Button */}
                <div className="pt-1 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleAskAIWhatIf}
                    disabled={isAskingAI || simulatedExpenseNumber <= 0}
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{isAskingAI ? t('classifying') : t('askAIWhatIf')}</span>
                  </button>

                  {aiWhatIfAdvice && (
                    <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-200 leading-relaxed">
                      {aiWhatIfAdvice}
                    </div>
                  )}
                </div>
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

                {/* Scenario Cards */}
                <div className="space-y-3">
                  {/* Scenario A: Mild Rebalance */}
                  <div
                    className={`p-4 rounded-2xl border transition ${
                      currentOverride?.appliedScenario === 'A'
                        ? 'bg-emerald-950/30 border-emerald-500'
                        : 'bg-zinc-900/70 border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-white">
                        {t('scenarioMild')}
                      </span>
                      {currentOverride?.appliedScenario === 'A' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {t('activeCurrently')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 mb-3">{t('scenarioMildDesc')}</p>

                    <div className="flex items-center justify-between text-xs font-mono mb-3 p-2.5 rounded-xl bg-zinc-950">
                      <span className="text-zinc-400">
                        {t('beforeDaily')}: {formatCurrency(evaluation.rebalanceScenarios.scenarioA.beforeDailyAllowance, currency)}
                      </span>
                      <span className="text-emerald-400 font-bold">
                        {t('afterDaily')}: {formatCurrency(evaluation.rebalanceScenarios.scenarioA.afterDailyAllowance, currency)}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={!evaluation.rebalanceScenarios.scenarioA.isAvailable}
                      onClick={() => handleApplyScenario('A')}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs transition disabled:opacity-40"
                    >
                      {evaluation.rebalanceScenarios.scenarioA.isAvailable
                        ? t('applyToCurrentMonth')
                        : evaluation.rebalanceScenarios.scenarioA.unavailableReason?.[
                            isArabic ? 'ar' : 'en'
                          ] || t('scenarioUnavailable')}
                    </button>
                  </div>

                  {/* Scenario B: Daily Freeze */}
                  <div
                    className={`p-4 rounded-2xl border transition ${
                      currentOverride?.appliedScenario === 'B'
                        ? 'bg-emerald-950/30 border-emerald-500'
                        : 'bg-zinc-900/70 border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-white">
                        {t('scenarioFreeze')}
                      </span>
                      {currentOverride?.appliedScenario === 'B' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {t('activeCurrently')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 mb-3">{t('scenarioFreezeDesc')}</p>

                    <div className="flex items-center justify-between text-xs font-mono mb-3 p-2.5 rounded-xl bg-zinc-950">
                      <span className="text-zinc-400">
                        {t('beforeDaily')}: {formatCurrency(evaluation.rebalanceScenarios.scenarioB.beforeDailyAllowance, currency)}
                      </span>
                      <span className="text-amber-400 font-bold">
                        {t('afterDaily')}: {formatCurrency(evaluation.rebalanceScenarios.scenarioB.afterDailyAllowance, currency)}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={!evaluation.rebalanceScenarios.scenarioB.isAvailable}
                      onClick={() => handleApplyScenario('B')}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs transition disabled:opacity-40"
                    >
                      {evaluation.rebalanceScenarios.scenarioB.isAvailable
                        ? t('applyToCurrentMonth')
                        : evaluation.rebalanceScenarios.scenarioB.unavailableReason?.[
                            isArabic ? 'ar' : 'en'
                          ] || t('scenarioUnavailable')}
                    </button>
                  </div>

                  {/* Scenario C: Emergency Savings Absorption */}
                  <div
                    className={`p-4 rounded-2xl border transition ${
                      currentOverride?.appliedScenario === 'C'
                        ? 'bg-emerald-950/30 border-emerald-500'
                        : 'bg-zinc-900/70 border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-white">
                        {t('scenarioRescue')}
                      </span>
                      {currentOverride?.appliedScenario === 'C' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {t('activeCurrently')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 mb-3">{t('scenarioRescueDesc')}</p>

                    <div className="flex items-center justify-between text-xs font-mono mb-3 p-2.5 rounded-xl bg-zinc-950">
                      <span className="text-zinc-400">
                        {t('beforeDaily')}: {formatCurrency(evaluation.rebalanceScenarios.scenarioC.beforeDailyAllowance, currency)}
                      </span>
                      <span className="text-blue-400 font-bold">
                        {t('afterDaily')}: {formatCurrency(evaluation.rebalanceScenarios.scenarioC.afterDailyAllowance, currency)}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={!evaluation.rebalanceScenarios.scenarioC.isAvailable}
                      onClick={() => handleApplyScenario('C')}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs transition disabled:opacity-40"
                    >
                      {evaluation.rebalanceScenarios.scenarioC.isAvailable
                        ? t('applyToCurrentMonth')
                        : evaluation.rebalanceScenarios.scenarioC.unavailableReason?.[
                            isArabic ? 'ar' : 'en'
                          ] || t('scenarioUnavailable')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 2: BASELINE PLAN */}
          {/* =============================================================== */}
          {activeTab === 'baseline' && (
            <div className="space-y-6">
              {/* Cycle Start Day & Income */}
              <div className="p-4 sm:p-5 rounded-3xl bg-zinc-900/60 border border-zinc-800 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-white mb-1">
                    {t('cycleStartDay')}
                  </label>
                  <p className="text-[11px] text-zinc-400 mb-2">{t('cycleStartDayDesc')}</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={28}
                      value={startDayInput === 'auto' ? '' : startDayInput}
                      onChange={(e) => setStartDayInput(parseInt(e.target.value, 10) || 1)}
                      disabled={startDayInput === 'auto'}
                      className="w-24 min-h-[44px] px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono text-center text-sm disabled:opacity-40"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setStartDayInput((prev) => (prev === 'auto' ? 1 : 'auto'))
                      }
                      className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold border transition ${
                        startDayInput === 'auto'
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                          : 'bg-zinc-850 border-zinc-750 text-zinc-300'
                      }`}
                    >
                      {t('autoDetectFromSalary')}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-white mb-1">
                    {t('plannedIncome')}
                  </label>
                  <p className="text-[11px] text-zinc-400 mb-2">{t('plannedIncomeDesc')}</p>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={plannedIncomeInput}
                    onChange={(e) => handlePlannedIncomeChange(e.target.value)}
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
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
                        min={savingsMinPercent}
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
                    <span>
                      {t('lockedSavingsMin').replace('{0}', String(savingsMinPercent))}
                    </span>
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
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

              {/* Private Gemini Key Management */}
              <div className="p-4 sm:p-5 rounded-3xl bg-zinc-900/60 border border-zinc-800 space-y-4">
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

                {/* Test Connection Button */}
                {(storedApiKey || hasAIAccessState || Boolean(auth.currentUser)) && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={isTestingConnection}
                      className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-200 font-bold text-xs flex items-center justify-center gap-2 border border-zinc-700 transition disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTestingConnection ? 'animate-spin' : ''}`} />
                      <span>{isTestingConnection ? t('testingConnection') : t('testConnectionBtn')}</span>
                    </button>
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
