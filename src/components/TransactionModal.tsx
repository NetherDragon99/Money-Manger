import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { navigateBack } from '../context/NavigationContext';
import { X, ArrowDown, ArrowUp, ArrowLeftRight, Calendar, Clock, Plus, ChevronDown, LayoutGrid, RefreshCw, Trash2, Sparkles, CheckCircle2, AlertTriangle, AlertCircle, Check, PiggyBank, ShieldAlert, Wallet, Zap, Coins } from 'lucide-react';
import { TransactionType, RecurringFrequency, RecurringTransaction, AdvancedScheduleConfig, Transaction, SavingsWithdrawalChoice, TransferFeeMode, ManualFeeInputType, ExpenseBudgetPool } from '../types';
import { formatDateToYYYYMMDD, formatTimeToHHMM, formatCurrency, formatDisplayNumber } from '../utils/dateCycle';
import { calculateNextDueDate, getScheduleSummaryText, migrateRecurringRule, normalizeHHMM, normalizeTimesList, getNextNOccurrences, OccurrencePreviewItem } from '../utils/recurring';
import { evaluateSmartBudget, SmartBudgetEvaluation, parseLocalDate, normalizeExpenseBudgetPool, canSendSmartBudgetNotificationToday, markSmartBudgetNotificationSentToday } from '../utils/smartBudgetEngine';
import { classifyExpenseContext } from '../utils/smartBudgetAI';
import { computeTransferFee, resolveTransferFeeSettings } from '../utils/transferFee';
import { Numpad } from './Numpad';
import { MiniDateTimePicker } from './MiniDateTimePicker';
import { CategoryDirectoryModal } from './CategoryDirectoryModal';
import { getLocalizedCurrencySymbol } from '../utils/currencies';
import { ShareFolder } from '../utils/shareFolders';

const TYPES: TransactionType[] = ['income', 'expense', 'transfer'];

function notifyBudgetAlertIfNeeded(
  evaluation: SmartBudgetEvaluation,
  showToast: (
    message: string,
    type?: 'success' | 'error' | 'info',
    action?: { label: string; onClick: () => void },
    duration?: number
  ) => void,
  openSmartBudget: () => void,
  isArabic: boolean
) {
  if (evaluation.isPaused) return;
  try {
    const todayStr = evaluation.dailyStatus.asOfDate;
    const cycleKey = evaluation.cycle.startDate.slice(0, 7);

    // 1. True Deficit: Daily pool depleted (max 1 notification per type per day)
    if (evaluation.dailyStatus.allowanceState === 'true_deficit' && evaluation.pools.daily.remaining <= 0) {
      const dedupKey = `mm_alert_dedup_${cycleKey}_${todayStr}_daily_depleted`;
      if (!localStorage.getItem(dedupKey) && canSendSmartBudgetNotificationToday('daily_depleted')) {
        localStorage.setItem(dedupKey, Date.now().toString());
        markSmartBudgetNotificationSentToday('daily_depleted');
        showToast(
          isArabic
            ? 'تنبيه الميزانية: استُنفد حوض المصروف اليومي للشهر. اضغط لإعادة التوازن.'
            : 'Budget alert: Monthly Daily Spending pool is exhausted. Tap to rebalance.',
          'error',
          {
            label: isArabic ? 'إعادة التوازن' : 'Rebalance',
            onClick: openSmartBudget,
          },
          8000
        );
        return;
      }
    }

    // 2. Outings pool depleted (max 1 notification per type per day)
    if (evaluation.pools.outings.allocated > 0 && evaluation.pools.outings.remaining <= 0) {
      const dedupKey = `mm_alert_dedup_${cycleKey}_${todayStr}_outings_depleted`;
      if (!localStorage.getItem(dedupKey) && canSendSmartBudgetNotificationToday('outings_depleted')) {
        localStorage.setItem(dedupKey, Date.now().toString());
        markSmartBudgetNotificationSentToday('outings_depleted');
        showToast(
          isArabic
            ? 'ملاحظة: اكتمل حوض الخروجات وسيتم استيعاب أي زيادة بهدوء من المصروف اليومي.'
            : 'Heads-up: Outings pool is full; any extra is calmly absorbed by Daily Spending.',
          'info',
          {
            label: isArabic ? 'مراجعة' : 'Review',
            onClick: openSmartBudget,
          },
          7000
        );
        return;
      }
    }

    // 3. Anomalies (max 1 notification per type per day)
    if (evaluation.anomalies.length > 0) {
      const topAnomaly = evaluation.anomalies[0];
      const notifType = `anomaly_${topAnomaly.type}`;
      const dedupKey = `mm_alert_dedup_${cycleKey}_${todayStr}_${notifType}`;
      if (!localStorage.getItem(dedupKey) && canSendSmartBudgetNotificationToday(notifType)) {
        localStorage.setItem(dedupKey, Date.now().toString());
        markSmartBudgetNotificationSentToday(notifType);
        const msg = isArabic ? topAnomaly.message.ar : topAnomaly.message.en;
        showToast(
          `${isArabic ? 'ملاحظة ميزانية: ' : 'Budget Heads-up: '}${msg}`,
          'info',
          {
            label: isArabic ? 'مراجعة' : 'Review',
            onClick: openSmartBudget,
          },
          7000
        );
      }
    }
  } catch (err) {
    console.error('Failed to notify budget alert:', err);
  }
}

function promptSalaryReviewIfNeeded(
  dateStr: string,
  showConfirm: (options: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
  }) => Promise<boolean>,
  openSmartBudget: () => void,
  isArabic: boolean
) {
  try {
    const cycleKey = dateStr.slice(0, 7);
    const dedupKey = `mm_salary_prompted_${cycleKey}`;
    if (localStorage.getItem(dedupKey) || sessionStorage.getItem(dedupKey)) {
      return;
    }
    localStorage.setItem(dedupKey, Date.now().toString());
    sessionStorage.setItem(dedupKey, 'true');

    showConfirm({
      title: isArabic ? 'تم استلام الراتب' : 'Salary Received',
      message: isArabic
        ? 'تم رصد استلام راتب! هل ترغب في مراجعة وتطبيق توزيع الميزانية الذكية (4 أحواض) للدورة الجديدة الآن؟'
        : 'Salary received: Would you like to review or apply the Smart Budget 4-pool allocation for this cycle?',
      confirmText: isArabic ? 'مراجعة الميزانية' : 'Review Budget',
      cancelText: isArabic ? 'لاحقاً' : 'Later',
    }).then((confirmed) => {
      if (confirmed) {
        openSmartBudget();
      }
    });
  } catch (err) {
    console.error('Failed to prompt salary review:', err);
  }
}

export interface TransactionModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  sharedSpace?: ShareFolder | null;
  editingTransaction?: Transaction | null;
  onSaveSharedTransaction?: (tx: Transaction, isEdit: boolean) => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen: propIsOpen,
  onClose: propOnClose,
  sharedSpace = null,
  editingTransaction = null,
  onSaveSharedTransaction,
}) => {
  const {
    isAddTxModalOpen,
    editingTx,
    closeAddTxModal,
    accounts: appAccounts,
    categories: appCategories,
    addTransaction,
    updateTransaction,
    addRecurringTransaction,
    openAddAccountModal,
    t,
    settings,
    defaultTxAccountId,
    defaultTxAmount,
    defaultTxIsRecurring,
    selectedAccountId,
    editingRecurring,
    applyRecurringRuleEdit,
    transactions,
    setIsSmartBudgetModalOpen,
    showToast,
    showConfirm,
  } = useApp();

  const isSharedMode = Boolean(sharedSpace);
  const effectiveIsOpen = propIsOpen !== undefined ? propIsOpen : isAddTxModalOpen;
  const activeEditingTx = isSharedMode ? editingTransaction : editingTx;

  const accounts = useMemo(() => {
    return isSharedMode && sharedSpace?.payload?.accounts && sharedSpace.payload.accounts.length > 0
      ? sharedSpace.payload.accounts
      : appAccounts;
  }, [isSharedMode, sharedSpace, appAccounts]);

  const categories = useMemo(() => {
    return isSharedMode && sharedSpace?.payload?.categories && sharedSpace.payload.categories.length > 0
      ? sharedSpace.payload.categories
      : appCategories;
  }, [isSharedMode, sharedSpace, appCategories]);

  const isArabic = settings.language === 'ar';

  const [type, setType] = useState<TransactionType>('expense');
  const [amountStr, setAmountStr] = useState<string>('0');
  const [date, setDate] = useState<string>(formatDateToYYYYMMDD(new Date()));
  const [hasTime, setHasTime] = useState<boolean>(true);
  const [time, setTime] = useState<string>(formatTimeToHHMM(new Date()));
  const [accountId, setAccountId] = useState<string>('');
  const [toAccountId, setToAccountId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [taxAmountStr, setTaxAmountStr] = useState<string>('');
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [budgetPool, setBudgetPool] = useState<ExpenseBudgetPool>('daily');
  const userManuallyPickedPoolRef = useRef<boolean>(false);
  const [isSalary, setIsSalary] = useState<boolean>(false);
  const [isSavingsAllocation, setIsSavingsAllocation] = useState<boolean>(false);
  const [savingsWithdrawalChoice, setSavingsWithdrawalChoice] = useState<SavingsWithdrawalChoice | undefined>(undefined);
  const [showWithdrawalPrompt, setShowWithdrawalPrompt] = useState<boolean>(false);
  const [transferFeeMode, setTransferFeeMode] = useState<TransferFeeMode>('none');
  const [manualFeeInputType, setManualFeeInputType] = useState<ManualFeeInputType>('amount');
  const [manualFeeStr, setManualFeeStr] = useState<string>('0');
  const [transferFeeBudgetPool, setTransferFeeBudgetPool] = useState<ExpenseBudgetPool>('daily');
  const [activeKeypadTarget, setActiveKeypadTarget] = useState<'amount' | 'fee'>('amount');
  const [isClassifyingPool, setIsClassifyingPool] = useState<boolean>(false);
  const [showDateTimePicker, setShowDateTimePicker] = useState<boolean>(false);
  const [pickerTab, setPickerTab] = useState<'date' | 'time'>('date');
  const [accountDropdownOpen, setAccountDropdownOpen] = useState<'single' | 'from' | 'to' | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [showCategoryDirectory, setShowCategoryDirectory] = useState<boolean>(false);
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [recurringFrequency, setRecurringFrequency] = useState<RecurringFrequency>('monthly');
  const [savedSimpleFrequency, setSavedSimpleFrequency] = useState<RecurringFrequency>('monthly');
  const [pendingRecurringEdit, setPendingRecurringEdit] = useState<RecurringTransaction | null>(null);

  // Advanced Recurring Schedule State
  const [isAdvancedSchedule, setIsAdvancedSchedule] = useState<boolean>(false);
  const [advancedTab, setAdvancedTab] = useState<'weekdays' | 'month_days' | 'times_daily'>('weekdays');
  const [useWeekdayFilter, setUseWeekdayFilter] = useState<boolean>(false);
  const [selectedDaysOfWeek, setSelectedDaysOfWeek] = useState<number[]>([1]); // default Mon
  const [intervalWeeks, setIntervalWeeks] = useState<number>(1); // range 1-12, anchored to rule's start week
  const [useMonthDayFilter, setUseMonthDayFilter] = useState<boolean>(false);
  const [selectedDaysOfMonth, setSelectedDaysOfMonth] = useState<number[]>([1]);
  const [timesOfDay, setTimesOfDay] = useState<string[]>(['09:00']);
  const [hasCustomTimes, setHasCustomTimes] = useState<boolean>(false);
  const [weekdayTimes, setWeekdayTimes] = useState<Record<number, string[]>>({});
  const [monthDayTimes, setMonthDayTimes] = useState<Record<number, string[]>>({});
  const [selectedDayOverrideToAdd, setSelectedDayOverrideToAdd] = useState<string>('');

  const weekDaysMap = [
    { day: 0, labelEn: 'Sun', labelAr: 'أحد' },
    { day: 1, labelEn: 'Mon', labelAr: 'إثنين' },
    { day: 2, labelEn: 'Tue', labelAr: 'ثلاثاء' },
    { day: 3, labelEn: 'Wed', labelAr: 'أربعاء' },
    { day: 4, labelEn: 'Thu', labelAr: 'خميس' },
    { day: 5, labelEn: 'Fri', labelAr: 'جمعة' },
    { day: 6, labelEn: 'Sat', labelAr: 'سبت' },
  ];

  const toggleDayOfWeek = (d: number) => {
    setSelectedDaysOfWeek((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)
    );
  };

  const selectAllDaysOfWeek = () => {
    setSelectedDaysOfWeek([0, 1, 2, 3, 4, 5, 6]);
  };

  const clearDaysOfWeek = () => {
    setSelectedDaysOfWeek([]);
  };

  const toggleDayOfMonth = (d: number) => {
    setSelectedDaysOfMonth((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)
    );
  };

  const selectAllDaysOfMonth = () => {
    setSelectedDaysOfMonth(Array.from({ length: 31 }, (_, i) => i + 1));
  };

  const clearDaysOfMonth = () => {
    setSelectedDaysOfMonth([]);
  };

  const addTimeSlot = () => {
    if (timesOfDay.length < 6) {
      setTimesOfDay((prev) => [...prev, '12:00']);
    }
  };

  const removeTimeSlot = (idx: number) => {
    if (timesOfDay.length > 1) {
      setTimesOfDay((prev) => prev.filter((_, i) => i !== idx));
    }
  };

  const updateTimeSlot = (idx: number, val: string) => {
    setTimesOfDay((prev) => {
      const copy = [...prev];
      copy[idx] = val;
      return copy;
    });
  };

  const addDayOverride = (overrideType: 'weekday' | 'month_day', dayNum: number) => {
    if (overrideType === 'weekday') {
      setWeekdayTimes((prev) => ({
        ...prev,
        [dayNum]: ['09:00'],
      }));
    } else {
      setMonthDayTimes((prev) => ({
        ...prev,
        [dayNum]: ['09:00'],
      }));
    }
  };

  const removeDayOverride = (overrideType: 'weekday' | 'month_day', dayNum: number) => {
    if (overrideType === 'weekday') {
      setWeekdayTimes((prev) => {
        const copy = { ...prev };
        delete copy[dayNum];
        return copy;
      });
    } else {
      setMonthDayTimes((prev) => {
        const copy = { ...prev };
        delete copy[dayNum];
        return copy;
      });
    }
  };

  const addTimeSlotToDay = (overrideType: 'weekday' | 'month_day', dayNum: number) => {
    if (overrideType === 'weekday') {
      setWeekdayTimes((prev) => {
        const list = prev[dayNum] || ['09:00'];
        if (list.length >= 5) return prev;
        return { ...prev, [dayNum]: [...list, '12:00'] };
      });
    } else {
      setMonthDayTimes((prev) => {
        const list = prev[dayNum] || ['09:00'];
        if (list.length >= 5) return prev;
        return { ...prev, [dayNum]: [...list, '12:00'] };
      });
    }
  };

  const removeTimeSlotFromDay = (overrideType: 'weekday' | 'month_day', dayNum: number, timeIdx: number) => {
    if (overrideType === 'weekday') {
      setWeekdayTimes((prev) => {
        const list = prev[dayNum];
        if (!list || list.length <= 1) {
          // Deleting last time slot removes the day override entirely
          const copy = { ...prev };
          delete copy[dayNum];
          return copy;
        }
        return { ...prev, [dayNum]: list.filter((_, i) => i !== timeIdx) };
      });
    } else {
      setMonthDayTimes((prev) => {
        const list = prev[dayNum];
        if (!list || list.length <= 1) {
          // Deleting last time slot removes the day override entirely
          const copy = { ...prev };
          delete copy[dayNum];
          return copy;
        }
        return { ...prev, [dayNum]: list.filter((_, i) => i !== timeIdx) };
      });
    }
  };

  const updateTimeSlotInDay = (overrideType: 'weekday' | 'month_day', dayNum: number, timeIdx: number, val: string) => {
    if (overrideType === 'weekday') {
      setWeekdayTimes((prev) => {
        const list = [...(prev[dayNum] || ['09:00'])];
        list[timeIdx] = val;
        return { ...prev, [dayNum]: list };
      });
    } else {
      setMonthDayTimes((prev) => {
        const list = [...(prev[dayNum] || ['09:00'])];
        list[timeIdx] = val;
        return { ...prev, [dayNum]: list };
      });
    }
  };

  const availableWeekdayOverrides = useMemo(() => {
    const baseDays = useWeekdayFilter && selectedDaysOfWeek.length > 0
      ? selectedDaysOfWeek
      : [0, 1, 2, 3, 4, 5, 6];
    return baseDays.filter((d) => !(d in weekdayTimes));
  }, [useWeekdayFilter, selectedDaysOfWeek, weekdayTimes]);

  const availableMonthDayOverrides = useMemo(() => {
    const baseDays = useMonthDayFilter && selectedDaysOfMonth.length > 0
      ? selectedDaysOfMonth
      : Array.from({ length: 31 }, (_, i) => i + 1);
    return baseDays.filter((d) => !(d in monthDayTimes));
  }, [useMonthDayFilter, selectedDaysOfMonth, monthDayTimes]);

  // Visual viewport height for seamless on-screen keyboard dock support
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const updateViewport = () => {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
      }
    };
    window.visualViewport.addEventListener('resize', updateViewport);
    window.visualViewport.addEventListener('scroll', updateViewport);
    updateViewport();
    return () => {
      window.visualViewport?.removeEventListener('resize', updateViewport);
      window.visualViewport?.removeEventListener('scroll', updateViewport);
    };
  }, []);

  // Check prefers-reduced-motion
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const handleAnimatedClose = () => {
    setIsClosing(true);
    setAccountDropdownOpen(null);
    setTimeout(() => {
      setIsClosing(false);
      if (propOnClose) {
        propOnClose();
      } else {
        closeAddTxModal();
      }
    }, 180);
  };

  useEffect(() => {
    if (!accountDropdownOpen) return;
    const handleOutside = (e: MouseEvent | PointerEvent) => {
      if (dropdownRef.current && dropdownRef.current.contains(e.target as Node)) {
        return;
      }
      setAccountDropdownOpen(null);
    };

    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', handleOutside);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', handleOutside);
    };
  }, [accountDropdownOpen]);

  // Clean Reset Rule & Initialize on Open / Edit
  const prevIsOpenRef = useRef(false);
  const prevEditingTxIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!effectiveIsOpen) {
      prevIsOpenRef.current = false;
      prevEditingTxIdRef.current = null;
      setAccountDropdownOpen(null);
      setShowDateTimePicker(false);
      setPendingRecurringEdit(null);
      setShowWithdrawalPrompt(false);
      setActiveKeypadTarget('amount');
      return;
    }

    const isNewlyOpened = !prevIsOpenRef.current;
    const currentTxId = activeEditingTx ? activeEditingTx.id : (!isSharedMode && editingRecurring) ? 'rec:' + editingRecurring.id : null;
    const isDifferentTx = currentTxId !== prevEditingTxIdRef.current;

    if (!isNewlyOpened && !isDifferentTx) {
      return;
    }

    prevIsOpenRef.current = true;
    prevEditingTxIdRef.current = currentTxId;
    setShowWithdrawalPrompt(false);
    setActiveKeypadTarget('amount');
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const feeCfg = resolveTransferFeeSettings(settings.transferFeeSettings);
    const defaultRuleActive = Boolean(feeCfg.defaultRule.enabled && feeCfg.defaultRule.ruleType !== 'none');

    if (activeEditingTx) {
      setType(activeEditingTx.type);
      setAmountStr(activeEditingTx.amount.toString());
      setDate(activeEditingTx.date);
      setHasTime(Boolean(activeEditingTx.time));
      setTime(activeEditingTx.time || formatTimeToHHMM(new Date()));
      setAccountId(activeEditingTx.accountId);
      setToAccountId(activeEditingTx.toAccountId || '');
      setCategoryId(activeEditingTx.categoryId || '');
      setDescription(activeEditingTx.description || '');
      setTaxAmountStr(
        activeEditingTx.taxAmount && activeEditingTx.taxAmount > 0
          ? activeEditingTx.taxAmount.toString()
          : ''
      );
      userManuallyPickedPoolRef.current = Boolean(activeEditingTx.budgetPool);
      setBudgetPool(
        normalizeExpenseBudgetPool(
          activeEditingTx.budgetPool,
          Boolean(activeEditingTx.isFromRecurring || activeEditingTx.recurringRuleId)
        )
      );
      setIsSalary(Boolean(activeEditingTx.isSalary));
      const destAcc = accounts.find((a) => a.id === activeEditingTx.toAccountId);
      const destIsSavingsOrInv = destAcc?.accountRole === 'savings' || destAcc?.accountRole === 'investment';
      setIsSavingsAllocation(
        activeEditingTx.isSavingsAllocation !== undefined
          ? Boolean(activeEditingTx.isSavingsAllocation)
          : destIsSavingsOrInv
      );
      setSavingsWithdrawalChoice(
        activeEditingTx.savingsWithdrawalChoice || activeEditingTx.budgetAdjustment?.choice
      );
      const initMode: TransferFeeMode =
        activeEditingTx.transferFeeMode ||
        (activeEditingTx.transferFee && activeEditingTx.transferFee > 0 ? 'manual' : 'none');
      setTransferFeeMode(initMode);
      setManualFeeInputType(activeEditingTx.transferFeeInputType || 'amount');
      setManualFeeStr(
        activeEditingTx.transferFeeRawValue !== undefined
          ? activeEditingTx.transferFeeRawValue.toString()
          : activeEditingTx.transferFee && activeEditingTx.transferFee > 0
          ? activeEditingTx.transferFee.toString()
          : '0'
      );
      setTransferFeeBudgetPool(normalizeExpenseBudgetPool(activeEditingTx.transferFeeBudgetPool, false));
      setIsRecurring(false);
      setRecurringFrequency('monthly');
      setIsAdvancedSchedule(false);
    } else if (!isSharedMode && editingRecurring) {
      const r = migrateRecurringRule(editingRecurring);
      setType(r.type);
      setAmountStr(r.amount.toString());
      setDate(r.startDate);
      setHasTime(true);
      setTime(r.startTime || '09:00');
      setAccountId(r.accountId);
      const fallbackTo = accounts.find((a) => a.id !== r.accountId);
      setToAccountId(r.toAccountId || (fallbackTo ? fallbackTo.id : ''));
      setCategoryId(r.categoryId || '');
      setDescription(r.description || '');
      setTaxAmountStr(
        r.taxAmount && r.taxAmount > 0
          ? r.taxAmount.toString()
          : ''
      );
      userManuallyPickedPoolRef.current = Boolean(r.budgetPool);
      setBudgetPool(normalizeExpenseBudgetPool(r.budgetPool, true));
      const recDestAcc = accounts.find((a) => a.id === (r.toAccountId || fallbackTo?.id));
      const recDestIsSavings = recDestAcc?.accountRole === 'savings' || recDestAcc?.accountRole === 'investment';
      setIsSavingsAllocation(
        r.isSavingsAllocation !== undefined ? Boolean(r.isSavingsAllocation) : recDestIsSavings
      );
      setSavingsWithdrawalChoice(r.savingsWithdrawalChoice);
      const recFeeMode: TransferFeeMode =
        r.transferFeeMode || (r.transferFee && r.transferFee > 0 ? 'manual' : 'none');
      setTransferFeeMode(recFeeMode);
      setManualFeeInputType(r.transferFeeInputType || 'amount');
      setManualFeeStr(
        r.transferFeeRawValue !== undefined
          ? r.transferFeeRawValue.toString()
          : r.transferFee && r.transferFee > 0
          ? r.transferFee.toString()
          : '0'
      );
      setTransferFeeBudgetPool(normalizeExpenseBudgetPool(r.transferFeeBudgetPool, false));
      setIsRecurring(true);
      setRecurringFrequency(r.frequency);
      setSavedSimpleFrequency(r.frequency || 'monthly');
      const adv = r.advancedSchedule;
      if (adv && adv.isAdvanced) {
        setIsAdvancedSchedule(true);
        setUseWeekdayFilter(Boolean(adv.useWeekdayFilter ?? r.useWeekdayFilter));
        setSelectedDaysOfWeek(adv.daysOfWeek && adv.daysOfWeek.length > 0 ? adv.daysOfWeek : [1]);
        setIntervalWeeks(adv.intervalWeeks && adv.intervalWeeks >= 1 && adv.intervalWeeks <= 12 ? adv.intervalWeeks : 1);
        setUseMonthDayFilter(Boolean(adv.useMonthDayFilter ?? r.useMonthDayFilter));
        setSelectedDaysOfMonth(adv.daysOfMonth && adv.daysOfMonth.length > 0 ? adv.daysOfMonth : [1]);
        const times = adv.timesOfDay && adv.timesOfDay.length > 0
          ? adv.timesOfDay
          : [adv.unifiedTime || adv.timeOfMonth || r.startTime || '09:00'];
        setTimesOfDay(times);
        setHasCustomTimes(Boolean(adv.hasCustomTimes));
        setWeekdayTimes(adv.weekdayTimes || {});
        setMonthDayTimes(adv.monthDayTimes || {});
        setSelectedDayOverrideToAdd('');
        if (adv.useWeekdayFilter) {
          setAdvancedTab('weekdays');
        } else if (adv.useMonthDayFilter) {
          setAdvancedTab('month_days');
        } else {
          setAdvancedTab('times_daily');
        }
      } else {
        setIsAdvancedSchedule(false);
        setUseWeekdayFilter(false);
        setSelectedDaysOfWeek([1]);
        setIntervalWeeks(1);
        setUseMonthDayFilter(false);
        setSelectedDaysOfMonth([1]);
        setTimesOfDay([r.startTime || '09:00']);
        setHasCustomTimes(false);
        setWeekdayTimes({});
        setMonthDayTimes({});
        setSelectedDayOverrideToAdd('');
        setAdvancedTab('weekdays');
      }
    } else {
      setType('expense');
      setAmountStr(defaultTxAmount && defaultTxAmount > 0 && !isSharedMode ? defaultTxAmount.toString() : '0');
      const now = new Date();
      setDate(formatDateToYYYYMMDD(now));
      setHasTime(true);
      const nowTime = formatTimeToHHMM(now);
      setTime(nowTime);
      setDescription('');
      setTaxAmountStr('');
      userManuallyPickedPoolRef.current = false;
      setBudgetPool(!isSharedMode && defaultTxIsRecurring ? 'fixed' : 'daily');
      setIsSalary(false);
      const defaultAcc = (!isSharedMode && (defaultTxAccountId || selectedAccountId)) || (accounts[0] ? accounts[0].id : '');
      setAccountId(defaultAcc);
      const otherAcc = accounts.find((a) => a.id !== defaultAcc);
      setToAccountId(otherAcc ? otherAcc.id : '');
      setIsSavingsAllocation(
        otherAcc?.accountRole === 'savings' || otherAcc?.accountRole === 'investment'
      );
      setSavingsWithdrawalChoice(undefined);
      setTransferFeeMode(defaultRuleActive ? 'default_rule' : 'none');
      setManualFeeInputType('amount');
      setManualFeeStr('0');
      setTransferFeeBudgetPool('daily');
      const expCats = categories.filter((c) => c.type === 'expense');
      let defaultCat = expCats[0];
      if (settings.categoryOrder && settings.categoryOrder.length > 0) {
        const orderMap = new Map(settings.categoryOrder.map((id, index) => [id, index]));
        const sorted = [...expCats].sort((a, b) => {
          const orderA = orderMap.has(a.id) ? (orderMap.get(a.id) as number) : 9999;
          const orderB = orderMap.has(b.id) ? (orderMap.get(b.id) as number) : 9999;
          return orderA - orderB;
        });
        if (sorted[0]) defaultCat = sorted[0];
      }
      setCategoryId(defaultCat ? defaultCat.id : '');
      setIsRecurring(Boolean(!isSharedMode && defaultTxIsRecurring));
      setRecurringFrequency('monthly');
      setSavedSimpleFrequency('monthly');
      setIsAdvancedSchedule(false);
      setUseWeekdayFilter(false);
      setSelectedDaysOfWeek([1]);
      setIntervalWeeks(1);
      setUseMonthDayFilter(false);
      setSelectedDaysOfMonth([1]);
      setTimesOfDay([nowTime || '09:00']);
      setHasCustomTimes(false);
      setWeekdayTimes({});
      setMonthDayTimes({});
      setSelectedDayOverrideToAdd('');
      setAdvancedTab('weekdays');
    }
  }, [effectiveIsOpen, activeEditingTx?.id, editingRecurring?.id, defaultTxIsRecurring, settings.categoryOrder, isSharedMode, accounts, categories]);

  // Dynamic auto-expanding height for note textarea (up to ~6 lines / 144px)
  useEffect(() => {
    if (noteTextareaRef.current) {
      noteTextareaRef.current.style.height = 'auto';
      noteTextareaRef.current.style.height = `${Math.min(noteTextareaRef.current.scrollHeight, 144)}px`;
    }
  }, [description, effectiveIsOpen]);

  // When type changes, ensure valid category selection & Transfer destination
  const prevTypeRef = useRef(type);
  useEffect(() => {
    if (prevTypeRef.current === type) return;
    prevTypeRef.current = type;

    if (type === 'transfer') {
      if (!toAccountId || toAccountId === accountId) {
        const destination = accounts.find((a) => a.id !== accountId);
        if (destination) {
          setToAccountId(destination.id);
        }
      }
    } else {
      const matchCats = categories.filter((c) => c.type === type);
      let matchCat = matchCats[0];
      if (settings.categoryOrder && settings.categoryOrder.length > 0) {
        const orderMap = new Map(settings.categoryOrder.map((id, index) => [id, index]));
        const sorted = [...matchCats].sort((a, b) => {
          const orderA = orderMap.has(a.id) ? (orderMap.get(a.id) as number) : 9999;
          const orderB = orderMap.has(b.id) ? (orderMap.get(b.id) as number) : 9999;
          return orderA - orderB;
        });
        if (sorted[0]) matchCat = sorted[0];
      }
      if (matchCat && (!categoryId || !categories.find((c) => c.id === categoryId && c.type === type))) {
        setCategoryId(matchCat.id);
      }
    }
  }, [type, settings.categoryOrder]);

  const getFrequencyLabel = (freq: RecurringFrequency) => {
    switch (freq) {
      case 'daily':
        return t('repeatDaily');
      case 'weekly':
        return t('repeatWeekly');
      case 'biweekly':
        return t('repeatBiweekly');
      case 'monthly':
        return t('repeatMonthly');
      case 'yearly':
        return t('repeatYearly');
      default:
        return freq;
    }
  };

  const availableCategories = useMemo(() => {
    const list = categories.filter((c) => c.type === type);
    if (settings.categoryOrder && settings.categoryOrder.length > 0) {
      const orderMap = new Map(settings.categoryOrder.map((id, index) => [id, index]));
      return [...list].sort((a, b) => {
        const orderA = orderMap.has(a.id) ? (orderMap.get(a.id) as number) : 9999;
        const orderB = orderMap.has(b.id) ? (orderMap.get(b.id) as number) : 9999;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });
    }
    return list;
  }, [categories, type, settings.categoryOrder]);

  const selectedCategory = useMemo(() => {
    if (type === 'transfer') return null;
    return categories.find((c) => c.id === categoryId) || availableCategories[0] || null;
  }, [categories, categoryId, availableCategories, type]);

  const selectedAccount = useMemo(() => {
    return accounts.find((a) => a.id === accountId) || accounts[0];
  }, [accounts, accountId]);

  const selectedToAccount = useMemo(() => {
    return accounts.find((a) => a.id === toAccountId) || accounts.find((a) => a.id !== accountId);
  }, [accounts, toAccountId, accountId]);

  const isSavingsWithdrawal = useMemo(() => {
    if (isSharedMode || type !== 'transfer' || !selectedAccount || !selectedToAccount) return false;
    if (selectedAccount.id === selectedToAccount.id) return false;
    const fromRole = selectedAccount.accountRole || 'spending';
    const toRole = selectedToAccount.accountRole || 'spending';
    return (fromRole === 'savings' || fromRole === 'investment') && toRole === 'spending';
  }, [isSharedMode, type, selectedAccount, selectedToAccount]);

  // Automatically toggle "Savings / Investment Allocation" ON when destination account has 'savings' or 'investment' role
  const prevDestIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!effectiveIsOpen) {
      prevDestIdRef.current = undefined;
      return;
    }
    const currentDestId = selectedToAccount?.id;
    if (prevDestIdRef.current === currentDestId) return;
    prevDestIdRef.current = currentDestId;

    // If editing an existing transfer and destination hasn't changed from the original, keep its saved flag
    if (
      activeEditingTx &&
      activeEditingTx.type === 'transfer' &&
      activeEditingTx.toAccountId === currentDestId &&
      activeEditingTx.isSavingsAllocation !== undefined
    ) {
      setIsSavingsAllocation(Boolean(activeEditingTx.isSavingsAllocation));
      return;
    }

    const destRole = selectedToAccount?.accountRole || 'spending';
    setIsSavingsAllocation(destRole === 'savings' || destRole === 'investment');
  }, [effectiveIsOpen, selectedToAccount?.id, selectedToAccount?.accountRole, activeEditingTx]);

  const handleTypeSelect = useCallback((newType: TransactionType) => {
    setType(newType);
    if (newType !== 'transfer') {
      setActiveKeypadTarget('amount');
    }
    if (newType === 'transfer') {
      const destination = accounts.find((a) => a.id !== accountId);
      if (destination) {
        setToAccountId(destination.id);
        const destRole = destination.accountRole || 'spending';
        setIsSavingsAllocation(destRole === 'savings' || destRole === 'investment');
      }
    }
  }, [accounts, accountId]);

  // Swipe & Drag Gesture State
  const modalContainerRef = useRef<HTMLDivElement | null>(null);
  const [dragDeltaX, setDragDeltaX] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const gestureRef = useRef<{
    startX: number;
    startY: number;
    startTime: number;
    active: boolean;
    cancelled: boolean;
  }>({
    startX: 0,
    startY: 0,
    startTime: 0,
    active: false,
    cancelled: false,
  });

  const currentTypeIndex = useMemo(() => TYPES.indexOf(type), [type]);

  const handleSwipePointerDown = (e: React.PointerEvent) => {
    // 1. Ignore 28px screen edge zone (Sidebar swipe & browser edge navigation safety)
    if (e.clientX < 28 || e.clientX > window.innerWidth - 28) return;

    // 2. Ignore interactive elements: category scroll row, keypad, inputs, dropdowns
    const target = e.target as HTMLElement;
    if (
      target.closest('[data-category-scroll="true"]') ||
      target.closest('[data-keypad="true"]') ||
      target.closest('[data-dropdown="true"]') ||
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    ) {
      return;
    }

    gestureRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startTime: Date.now(),
      active: true,
      cancelled: false,
    };
    setIsDragging(false);
    setDragDeltaX(0);
  };

  const handleSwipePointerMove = (e: React.PointerEvent) => {
    if (!gestureRef.current.active || gestureRef.current.cancelled) return;

    const deltaX = e.clientX - gestureRef.current.startX;
    const deltaY = e.clientY - gestureRef.current.startY;

    if (!isDragging) {
      // If user moved vertically more than horizontally, cancel swipe tracking to allow normal scroll
      if (Math.abs(deltaY) > Math.abs(deltaX) || Math.abs(deltaY) > 12) {
        gestureRef.current.cancelled = true;
        return;
      }
      // If horizontal movement exceeds 8px, lock horizontal drag mode
      if (Math.abs(deltaX) > 8) {
        setIsDragging(true);
      }
    }

    if (isDragging) {
      setDragDeltaX(deltaX);
    }
  };

  const handleSwipePointerUp = () => {
    if (!gestureRef.current.active) return;
    gestureRef.current.active = false;

    if (isDragging) {
      const deltaX = dragDeltaX;
      // Reversing drag direction in RTL:
      // In LTR: drag left (deltaX < 0) advances to next tab; drag right (deltaX > 0) goes to prev tab
      // In RTL: drag right (deltaX > 0) advances to next tab; drag left (deltaX < 0) goes to prev tab
      const normDelta = isArabic ? -deltaX : deltaX;
      const threshold = 40;

      let nextIndex = currentTypeIndex;
      if (normDelta < -threshold && currentTypeIndex < TYPES.length - 1) {
        nextIndex = currentTypeIndex + 1;
      } else if (normDelta > threshold && currentTypeIndex > 0) {
        nextIndex = currentTypeIndex - 1;
      }

      if (nextIndex !== currentTypeIndex) {
        handleTypeSelect(TYPES[nextIndex]);
      }

      setIsDragging(false);
      setDragDeltaX(0);
    }
  };

  // Live Tracking Active Tab Indicator Calculation
  const indicatorOffsetPercent = useMemo(() => {
    const basePercent = currentTypeIndex * 33.3333;
    if (!isDragging || !modalContainerRef.current) {
      return basePercent;
    }
    const modalWidth = modalContainerRef.current.offsetWidth || 360;
    // Normalized drag ratio (drag left -> moves indicator right in LTR)
    const dragRatio = (isArabic ? dragDeltaX : -dragDeltaX) / modalWidth;
    const dragOffset = dragRatio * 33.3333;
    return Math.max(0, Math.min(66.6666, basePercent + dragOffset));
  }, [currentTypeIndex, isDragging, dragDeltaX, isArabic]);

  const buildAdvConfig = (): AdvancedScheduleConfig | undefined => {
    if (!isAdvancedSchedule) return undefined;
    const cleanDefaultTimes = normalizeTimesList(timesOfDay);
    const safeDefaultTimes = cleanDefaultTimes.length > 0 ? cleanDefaultTimes : [hasTime ? time : '09:00'];

    const cleanWeekdayTimes: Record<number, string[]> = {};
    if (hasCustomTimes) {
      for (const [k, v] of Object.entries(weekdayTimes)) {
        const d = Number(k);
        const list = normalizeTimesList(v);
        if (!isNaN(d) && list.length > 0) cleanWeekdayTimes[d] = list;
      }
    }

    const cleanMonthDayTimes: Record<number, string[]> = {};
    if (hasCustomTimes) {
      for (const [k, v] of Object.entries(monthDayTimes)) {
        const d = Number(k);
        const list = normalizeTimesList(v);
        if (!isNaN(d) && list.length > 0) cleanMonthDayTimes[d] = list;
      }
    }

    const hasActiveOverrides = hasCustomTimes && (Object.keys(cleanWeekdayTimes).length > 0 || Object.keys(cleanMonthDayTimes).length > 0);

    return {
      isAdvanced: true,
      scheduleType: 'advanced',
      useWeekdayFilter,
      daysOfWeek: useWeekdayFilter ? selectedDaysOfWeek : undefined,
      intervalWeeks: Math.max(1, Math.min(12, intervalWeeks || 1)),
      useMonthDayFilter,
      daysOfMonth: useMonthDayFilter ? selectedDaysOfMonth : undefined,
      timesOfDay: safeDefaultTimes,
      defaultTimes: safeDefaultTimes,
      unifiedTime: safeDefaultTimes[0] || '09:00',
      hasCustomTimes: hasActiveOverrides,
      weekdayTimes: hasActiveOverrides && Object.keys(cleanWeekdayTimes).length > 0 ? cleanWeekdayTimes : undefined,
      monthDayTimes: hasActiveOverrides && Object.keys(cleanMonthDayTimes).length > 0 ? cleanMonthDayTimes : undefined,
    };
  };

  const scheduleSummaryText = useMemo(() => {
    return getScheduleSummaryText(
      {
        frequency: recurringFrequency,
        startDate: date,
        isAdvanced: isAdvancedSchedule,
        useWeekdayFilter,
        daysOfWeek: selectedDaysOfWeek,
        intervalWeeks: isAdvancedSchedule ? intervalWeeks : 1,
        useMonthDayFilter,
        daysOfMonth: selectedDaysOfMonth,
        timesOfDay: timesOfDay.length > 0 ? timesOfDay : [hasTime && time ? time : '09:00'],
        startTime: hasTime && time ? time : '09:00',
        hasCustomTimes,
        weekdayTimes,
        monthDayTimes,
      },
      isArabic ? 'ar' : 'en'
    );
  }, [
    recurringFrequency,
    date,
    isAdvancedSchedule,
    useWeekdayFilter,
    selectedDaysOfWeek,
    intervalWeeks,
    useMonthDayFilter,
    selectedDaysOfMonth,
    timesOfDay,
    hasCustomTimes,
    weekdayTimes,
    monthDayTimes,
    hasTime,
    time,
    isArabic,
  ]);

  const isFilterEmpty = useMemo(() => {
    if (!isRecurring || !isAdvancedSchedule) return false;
    if (useWeekdayFilter && selectedDaysOfWeek.length === 0) return true;
    if (useMonthDayFilter && selectedDaysOfMonth.length === 0) return true;
    if (timesOfDay.length === 0) return true;
    return false;
  }, [isRecurring, isAdvancedSchedule, useWeekdayFilter, selectedDaysOfWeek, useMonthDayFilter, selectedDaysOfMonth, timesOfDay]);

  const filterEmptyHint = useMemo(() => {
    if (!isRecurring || !isAdvancedSchedule) return '';
    if (useWeekdayFilter && selectedDaysOfWeek.length === 0) {
      return isArabic
        ? 'يرجى تحديد يوم واحد على الأقل من أيام الأسبوع'
        : 'Please select at least one weekday';
    }
    if (useMonthDayFilter && selectedDaysOfMonth.length === 0) {
      return isArabic
        ? 'يرجى تحديد يوم واحد على الأقل من أيام الشهر'
        : 'Please select at least one day of the month';
    }
    if (timesOfDay.length === 0) {
      return isArabic
        ? 'يرجى تحديد وقت واحد على الأقل للتنفيذ'
        : 'Please specify at least one execution time';
    }
    return '';
  }, [isRecurring, isAdvancedSchedule, useWeekdayFilter, selectedDaysOfWeek, useMonthDayFilter, selectedDaysOfMonth, timesOfDay, isArabic]);

  const draftRecurringRule = useMemo<RecurringTransaction | null>(() => {
    if (!isRecurring) return null;
    const advConfig = buildAdvConfig();
    const cleanAmount = parseFloat(String(amountStr).replace(/,/g, '')) || 0;
    return {
      id: editingRecurring?.id || 'draft',
      type,
      amount: cleanAmount,
      description: description.trim(),
      accountId: accountId,
      toAccountId: toAccountId,
      categoryId: categoryId,
      frequency: recurringFrequency,
      startDate: date,
      startTime: hasTime ? time : '09:00',
      nextDueDate: date,
      autoProcess: true,
      createdAt: Date.now(),
      effectiveFrom: editingRecurring?.effectiveFrom,
      advancedSchedule: advConfig,
      useWeekdayFilter: advConfig?.useWeekdayFilter,
      useMonthDayFilter: advConfig?.useMonthDayFilter,
    };
  }, [
    isRecurring,
    editingRecurring,
    type,
    amountStr,
    description,
    accountId,
    toAccountId,
    categoryId,
    recurringFrequency,
    date,
    hasTime,
    time,
    isAdvancedSchedule,
    useWeekdayFilter,
    selectedDaysOfWeek,
    intervalWeeks,
    useMonthDayFilter,
    selectedDaysOfMonth,
    timesOfDay,
    hasCustomTimes,
    weekdayTimes,
    monthDayTimes,
  ]);

  const next5Occurrences = useMemo<OccurrencePreviewItem[]>(() => {
    if (!draftRecurringRule) return [];
    return getNextNOccurrences(draftRecurringRule, 5, Date.now(), isArabic ? 'ar' : 'en');
  }, [draftRecurringRule, isArabic]);

  const numericAmount = parseFloat(String(amountStr).replace(/,/g, '')) || 0;
  const numericTaxAmount = (type === 'expense' || type === 'income') ? (parseFloat(String(taxAmountStr).replace(/,/g, '')) || 0) : 0;
  const effectiveExpenseAmount = numericAmount + numericTaxAmount;
  const currencySymbol = getLocalizedCurrencySymbol(settings.currencySymbol, settings.language);
  const sourceCurrencySymbol = getLocalizedCurrencySymbol(
    selectedAccount?.currency || settings.currencySymbol,
    settings.language
  );

  const feeConfig = useMemo(
    () => resolveTransferFeeSettings(settings.transferFeeSettings),
    [settings.transferFeeSettings]
  );

  const manualFeeRawNumeric = useMemo(
    () => parseFloat(String(manualFeeStr).replace(/,/g, '')) || 0,
    [manualFeeStr]
  );

  const calculatedTransferFee = useMemo(() => {
    if (isSharedMode || type !== 'transfer') return 0;
    return computeTransferFee({
      transferAmount: numericAmount,
      mode: transferFeeMode,
      manualInputType: manualFeeInputType,
      manualRawValue: manualFeeRawNumeric,
      feeSettings: feeConfig,
    });
  }, [isSharedMode, type, numericAmount, transferFeeMode, manualFeeInputType, manualFeeRawNumeric, feeConfig]);

  const availableSourceBalance = useMemo(() => {
    if (!selectedAccount) return 0;
    let base = selectedAccount.balance;
    if (activeEditingTx && activeEditingTx.type === 'transfer' && activeEditingTx.accountId === selectedAccount.id) {
      base += activeEditingTx.amount + (activeEditingTx.transferFee || 0);
    }
    return base;
  }, [selectedAccount, activeEditingTx]);

  const exceedsAvailableWithFee = useMemo(() => {
    if (isSharedMode || type !== 'transfer' || !selectedAccount || numericAmount <= 0) return false;
    return numericAmount + calculatedTransferFee > availableSourceBalance + 0.0001;
  }, [isSharedMode, type, selectedAccount, numericAmount, calculatedTransferFee, availableSourceBalance]);

  // Smart Update Rule: In Edit mode, keep Update button disabled until at least one field is modified
  const isModified = useMemo(() => {
    if (editingRecurring) {
      const r = migrateRecurringRule(editingRecurring);
      const amt = parseFloat(String(amountStr).replace(/,/g, '')) || 0;
      const curTax = (type === 'expense' || type === 'income') ? (parseFloat(String(taxAmountStr).replace(/,/g, '')) || 0) : 0;
      const origAdv = r.advancedSchedule && r.advancedSchedule.isAdvanced ? r.advancedSchedule : null;
      const curAdv = buildAdvConfig() || null;
      const curSig = JSON.stringify([
        type, amt, curTax, date, hasTime ? time : '09:00', accountId,
        type === 'transfer' ? toAccountId : '',
        type === 'transfer' ? '' : categoryId,
        description.trim(), recurringFrequency, curAdv,
        type === 'transfer' ? Boolean(isSavingsAllocation) : false,
        type === 'transfer' ? (savingsWithdrawalChoice || '') : '',
        type === 'transfer' ? (transferFeeMode || 'none') : 'none',
        type === 'transfer' ? (calculatedTransferFee || 0) : 0,
        type === 'transfer' ? (transferFeeBudgetPool || 'daily') : 'daily',
        type === 'expense' ? (budgetPool || 'fixed') : '',
      ]);
      const origSig = JSON.stringify([
        r.type, r.amount, r.taxAmount || 0, r.startDate, r.startTime || '09:00', r.accountId,
        r.toAccountId || '', r.categoryId || '', r.description || '', r.frequency, origAdv,
        r.type === 'transfer' ? Boolean(r.isSavingsAllocation) : false,
        r.type === 'transfer' ? (r.savingsWithdrawalChoice || '') : '',
        r.type === 'transfer' ? (r.transferFeeMode || (r.transferFee && r.transferFee > 0 ? 'manual' : 'none')) : 'none',
        r.type === 'transfer' ? (r.transferFee || 0) : 0,
        r.type === 'transfer' ? normalizeExpenseBudgetPool(r.transferFeeBudgetPool, false) : 'daily',
        r.type === 'expense' ? normalizeExpenseBudgetPool(r.budgetPool, true) : '',
      ]);
      return curSig !== origSig;
    }
    if (!activeEditingTx) return true;
    const numAmt = parseFloat(String(amountStr).replace(/,/g, '')) || 0;
    const curTax = (type === 'expense' || type === 'income') ? (parseFloat(String(taxAmountStr).replace(/,/g, '')) || 0) : 0;
    const origTax = activeEditingTx.taxAmount || 0;
    if (Math.abs(origTax - curTax) > 0.0001) return true;
    if (activeEditingTx.type !== type) return true;
    if (Math.abs(activeEditingTx.amount - numAmt) > 0.0001) return true;
    if (activeEditingTx.date !== date) return true;
    if ((activeEditingTx.time || '') !== (hasTime ? time : '')) return true;
    if (activeEditingTx.accountId !== accountId) return true;
    if ((activeEditingTx.toAccountId || '') !== (type === 'transfer' ? toAccountId : '')) return true;
    if ((activeEditingTx.categoryId || '') !== (type === 'transfer' ? '' : categoryId)) return true;
    if ((activeEditingTx.description || '') !== description.trim()) return true;
    if (type === 'expense' && (activeEditingTx.budgetPool || 'daily') !== budgetPool) return true;
    if (type === 'income' && Boolean(activeEditingTx.isSalary) !== isSalary) return true;
    if (type === 'transfer') {
      if (Boolean(activeEditingTx.isSavingsAllocation) !== isSavingsAllocation) return true;
      const origChoice = activeEditingTx.savingsWithdrawalChoice || activeEditingTx.budgetAdjustment?.choice;
      if ((origChoice || undefined) !== savingsWithdrawalChoice) return true;
      const origFee = activeEditingTx.transferFee || 0;
      if (Math.abs(origFee - calculatedTransferFee) > 0.0001) return true;
      const origFeeMode = activeEditingTx.transferFeeMode || (origFee > 0 ? 'manual' : 'none');
      if (origFeeMode !== transferFeeMode) return true;
      if (calculatedTransferFee > 0 && (activeEditingTx.transferFeeBudgetPool || 'daily') !== transferFeeBudgetPool) return true;
    }
    return false;
  }, [
    activeEditingTx, editingRecurring, type, amountStr, taxAmountStr, date, hasTime, time, accountId, toAccountId, categoryId, description,
    recurringFrequency, isAdvancedSchedule, useWeekdayFilter, selectedDaysOfWeek, intervalWeeks, useMonthDayFilter,
    selectedDaysOfMonth, timesOfDay, hasCustomTimes, weekdayTimes, monthDayTimes, budgetPool, isSalary,
    isSavingsAllocation, savingsWithdrawalChoice, transferFeeMode, calculatedTransferFee, transferFeeBudgetPool,
  ]);

  // Filter out the transaction currently being edited so its previous amount isn't double-counted
  const evalTransactions = useMemo(() => {
    if (!activeEditingTx) return transactions;
    return transactions.filter((t) => t.id !== activeEditingTx.id);
  }, [transactions, activeEditingTx]);

  const smartBudgetEval = useMemo(() => {
    if (type !== 'expense') return null;
    const cfg = {
      ...settings.smartBudget?.baseline,
      startDay: settings.defaultMonthStartDay || 1,
      overrides: settings.smartBudget?.overrides,
      adjustments: settings.smartBudget?.adjustments,
      baseCurrency: currencySymbol,
    };
    return evaluateSmartBudget(evalTransactions, accounts, cfg, new Date());
  }, [type, evalTransactions, accounts, settings.smartBudget?.baseline, settings.smartBudget?.overrides, settings.smartBudget?.adjustments, settings.defaultMonthStartDay, currencySymbol]);

  const isDateInCycle = useMemo(() => {
    if (!smartBudgetEval) return false;
    return date >= smartBudgetEval.cycle.startDate && date <= smartBudgetEval.cycle.endDate;
  }, [smartBudgetEval, date]);

  const impactEstimate = useMemo(() => {
    if (type !== 'expense' || !smartBudgetEval || smartBudgetEval.isPaused || !isDateInCycle || effectiveExpenseAmount <= 0) {
      return null;
    }

    const todayAllowance = smartBudgetEval.dailyStatus.todayAllowance;
    const todayRemainingBefore = smartBudgetEval.dailyStatus.todayRemaining;
    const monthlyDailyRemBefore = smartBudgetEval.pools.daily.remaining;
    const projectedAllowance = smartBudgetEval.projectedDailyAllowanceAfterSpend(
      effectiveExpenseAmount,
      budgetPool,
      date
    );

    if (budgetPool === 'oneoff') {
      return {
        status: 'safe' as const,
        todayAllowance,
        projectedAllowance: todayAllowance,
        overTodayBy: 0,
        budgetPool,
      };
    }

    let status: 'safe' | 'warning' | 'danger' = 'safe';
    let overTodayBy = 0;

    if (budgetPool === 'daily') {
      const remAfter = todayRemainingBefore - effectiveExpenseAmount;
      overTodayBy = remAfter < 0 ? Math.abs(remAfter) : 0;
      const monthlyDailyRemAfter = monthlyDailyRemBefore - effectiveExpenseAmount;
      if (monthlyDailyRemAfter <= 0) {
        status = 'danger';
      } else if (overTodayBy > 0 || effectiveExpenseAmount > todayAllowance * 0.8) {
        status = 'warning';
      } else {
        status = 'safe';
      }
    } else if (budgetPool === 'outings') {
      const outingsRem = smartBudgetEval.pools.outings.remaining;
      const spillToDaily = Math.max(0, effectiveExpenseAmount - Math.max(0, outingsRem));
      if (spillToDaily > 0 && monthlyDailyRemBefore - spillToDaily <= 0) {
        status = 'danger';
      } else if (spillToDaily > 0 || effectiveExpenseAmount > outingsRem * 0.8) {
        status = 'warning';
      } else {
        status = 'safe';
      }
    } else if (budgetPool === 'fixed') {
      const fixedRem = smartBudgetEval.pools.fixed.remaining;
      const spillToDaily = Math.max(0, effectiveExpenseAmount - Math.max(0, fixedRem));
      if (spillToDaily > 0 && monthlyDailyRemBefore - spillToDaily <= 0) {
        status = 'danger';
      } else if (spillToDaily > 0) {
        status = 'warning';
      } else {
        status = 'safe';
      }
    }

    return {
      status,
      todayAllowance,
      projectedAllowance,
      overTodayBy,
      budgetPool,
    };
  }, [type, smartBudgetEval, isDateInCycle, effectiveExpenseAmount, budgetPool, date]);

  const handleClassifyWithAI = async () => {
    if (isClassifyingPool) return;
    setIsClassifyingPool(true);
    try {
      const selectedCat = categories.find((c) => c.id === categoryId);
      const res = await classifyExpenseContext({
        note: description,
        categoryName: selectedCat?.name,
        amount: numericAmount,
        language: isArabic ? 'ar' : 'en',
      });
      userManuallyPickedPoolRef.current = true;
      const isOneOff = res.context === 'oneoff' || res.context === 'emergency';
      if (res.context === 'outings') {
        setBudgetPool('outings');
      } else if (isOneOff) {
        setBudgetPool('oneoff');
      } else {
        setBudgetPool(isRecurring ? 'fixed' : 'daily');
      }
      showToast(
        isArabic
          ? `تم التصنيف ذكياً: ${res.context === 'outings' ? t('poolOutings') : isOneOff ? t('poolOneOff') : isRecurring ? t('poolFixed') : t('poolDaily')}`
          : `Classified as ${res.context === 'outings' ? t('poolOutings') : isOneOff ? t('poolOneOff') : isRecurring ? t('poolFixed') : t('poolDaily')}`,
        'info'
      );
    } catch (err) {
      console.warn('AI classification error:', err);
    } finally {
      setIsClassifyingPool(false);
    }
  };
  const isTransferSameAccount = type === 'transfer' && accountId === toAccountId;
  const canSave = numericAmount > 0 && !isTransferSameAccount && isModified && !isFilterEmpty;

  // Desktop physical keyboard support for in-app numeric keypad target ('amount' or 'fee')
  // Only active when no real text input / textarea / select is focused.
  useEffect(() => {
    if (!effectiveIsOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const active = document.activeElement as HTMLElement | null;
      if (
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.tagName === 'SELECT' ||
          active.isContentEditable)
      ) {
        return;
      }

      const isEditingFee = type === 'transfer' && transferFeeMode === 'manual' && activeKeypadTarget === 'fee';
      const currentVal = isEditingFee ? manualFeeStr : amountStr;
      const setVal = isEditingFee ? setManualFeeStr : setAmountStr;

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        if (currentVal === '0' || currentVal === '') {
          setVal(e.key);
          return;
        }
        if (currentVal.includes('.')) {
          const parts = currentVal.split('.');
          if (parts[1] && parts[1].length >= 2) return;
        }
        if (currentVal.length >= 10) return;
        setVal(currentVal + e.key);
      } else if (e.key === '.' || e.key === 'Decimal') {
        e.preventDefault();
        if (!currentVal.includes('.')) {
          setVal(currentVal === '' || currentVal === '0' ? '0.' : currentVal + '.');
        }
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        if (currentVal.length <= 1 || currentVal === '0') {
          setVal('0');
        } else {
          const next = currentVal.slice(0, -1);
          setVal(next === '' ? '0' : next);
        }
      } else if (e.key === 'Delete') {
        e.preventDefault();
        setVal('0');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [effectiveIsOpen, type, transferFeeMode, activeKeypadTarget, amountStr, manualFeeStr]);

  if (!effectiveIsOpen) return null;

  const executeSave = (chosenWithdrawalChoice?: SavingsWithdrawalChoice) => {
    if (!canSave) return;

    const finalAccountId = accountId || selectedAccount?.id || '';
    const finalToAccountId = type === 'transfer' ? (toAccountId || selectedToAccount?.id || '') : undefined;

    if (isSharedMode && onSaveSharedTransaction && sharedSpace) {
      const finalTx: Transaction = {
        id: activeEditingTx ? activeEditingTx.id : `tx_shared_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type,
        amount: numericAmount,
        taxAmount: (type === 'expense' || type === 'income') && numericTaxAmount > 0 ? numericTaxAmount : undefined,
        date,
        time: hasTime ? time : '',
        accountId: finalAccountId,
        toAccountId: finalToAccountId,
        fromAccountName: selectedAccount?.name,
        fromAccountIcon: selectedAccount?.icon,
        toAccountName: selectedToAccount?.name,
        toAccountIcon: selectedToAccount?.icon,
        categoryId: type === 'transfer' ? undefined : selectedCategory?.id,
        categoryName: type === 'transfer' ? undefined : selectedCategory?.name,
        categoryIcon: type === 'transfer' ? undefined : selectedCategory?.icon,
        description: description.trim(),
        createdAt: activeEditingTx?.createdAt || Date.now(),
        updatedAt: Date.now(),
        shareId: sharedSpace.id,
        sender16Id: activeEditingTx?.sender16Id,
      };
      onSaveSharedTransaction(finalTx, Boolean(activeEditingTx));
      handleAnimatedClose();
      return;
    }

    const effectiveWithdrawalChoice =
      type === 'transfer' && isSavingsWithdrawal
        ? (chosenWithdrawalChoice || savingsWithdrawalChoice || 'just_moving')
        : undefined;

    const payload = {
      type,
      amount: numericAmount,
      taxAmount: (type === 'expense' || type === 'income') && numericTaxAmount > 0 ? numericTaxAmount : undefined,
      date,
      time: hasTime ? time : '',
      accountId: finalAccountId,
      toAccountId: finalToAccountId,
      categoryId: type === 'transfer' ? undefined : selectedCategory?.id,
      categoryName: type === 'transfer' ? undefined : selectedCategory?.name,
      categoryIcon: type === 'transfer' ? undefined : selectedCategory?.icon,
      description: description.trim(),
      budgetPool: type === 'expense' ? budgetPool : undefined,
      isSalary: type === 'income' ? isSalary : undefined,
      isSavingsAllocation: type === 'transfer' ? isSavingsAllocation : undefined,
      savingsWithdrawalChoice: effectiveWithdrawalChoice,
      transferFee: type === 'transfer' && calculatedTransferFee > 0 ? calculatedTransferFee : undefined,
      transferFeeMode: type === 'transfer' ? transferFeeMode : undefined,
      transferFeeInputType:
        type === 'transfer' && transferFeeMode === 'manual' ? manualFeeInputType : undefined,
      transferFeeRawValue:
        type === 'transfer' && transferFeeMode === 'manual' ? manualFeeRawNumeric : undefined,
      transferFeeBudgetPool:
        type === 'transfer' && calculatedTransferFee > 0 ? transferFeeBudgetPool : undefined,
    };

    if (editingRecurring) {
      const advConfig = buildAdvConfig();
      // Ask whether the edit applies to future occurrences only or to past & future ones
      setPendingRecurringEdit({
        ...editingRecurring,
        type,
        amount: numericAmount,
        taxAmount: (type === 'expense' || type === 'income') && numericTaxAmount > 0 ? numericTaxAmount : undefined,
        description: description.trim(),
        accountId: finalAccountId,
        toAccountId: finalToAccountId,
        categoryId: type === 'transfer' ? undefined : selectedCategory?.id,
        categoryName: type === 'transfer' ? undefined : selectedCategory?.name,
        categoryIcon: type === 'transfer' ? undefined : selectedCategory?.icon,
        frequency: recurringFrequency,
        startDate: date,
        startTime: hasTime ? time : '09:00',
        advancedSchedule: advConfig,
        useWeekdayFilter: advConfig?.useWeekdayFilter,
        useMonthDayFilter: advConfig?.useMonthDayFilter,
        budgetPool: type === 'expense' ? budgetPool : undefined,
        isSavingsAllocation: type === 'transfer' ? isSavingsAllocation : undefined,
        savingsWithdrawalChoice: effectiveWithdrawalChoice,
        transferFee: type === 'transfer' && calculatedTransferFee > 0 ? calculatedTransferFee : undefined,
        transferFeeMode: type === 'transfer' ? transferFeeMode : undefined,
        transferFeeInputType:
          type === 'transfer' && transferFeeMode === 'manual' ? manualFeeInputType : undefined,
        transferFeeRawValue:
          type === 'transfer' && transferFeeMode === 'manual' ? manualFeeRawNumeric : undefined,
        transferFeeBudgetPool:
          type === 'transfer' && calculatedTransferFee > 0 ? transferFeeBudgetPool : undefined,
      });
      return;
    }

    if (editingTx) {
      updateTransaction({
        ...editingTx,
        ...payload,
      });
    } else {
      addTransaction(payload);
      if (isRecurring) {
        const advConfig = buildAdvConfig();

        addRecurringTransaction({
          type,
          amount: numericAmount,
          taxAmount: (type === 'expense' || type === 'income') && numericTaxAmount > 0 ? numericTaxAmount : undefined,
          description: description.trim(),
          accountId: finalAccountId,
          toAccountId: finalToAccountId,
          categoryId: type === 'transfer' ? undefined : selectedCategory?.id,
          categoryName: type === 'transfer' ? undefined : selectedCategory?.name,
          categoryIcon: type === 'transfer' ? undefined : selectedCategory?.icon,
          frequency: recurringFrequency,
          startDate: date,
          startTime: hasTime ? time : '09:00',
          nextDueDate: calculateNextDueDate(date, recurringFrequency),
          autoProcess: true,
          advancedSchedule: advConfig,
          useWeekdayFilter: advConfig?.useWeekdayFilter,
          useMonthDayFilter: advConfig?.useMonthDayFilter,
          budgetPool: type === 'expense' ? budgetPool : undefined,
          isSavingsAllocation: type === 'transfer' ? isSavingsAllocation : undefined,
          savingsWithdrawalChoice: effectiveWithdrawalChoice,
          transferFee: type === 'transfer' && calculatedTransferFee > 0 ? calculatedTransferFee : undefined,
          transferFeeMode: type === 'transfer' ? transferFeeMode : undefined,
          transferFeeInputType:
            type === 'transfer' && transferFeeMode === 'manual' ? manualFeeInputType : undefined,
          transferFeeRawValue:
            type === 'transfer' && transferFeeMode === 'manual' ? manualFeeRawNumeric : undefined,
          transferFeeBudgetPool:
            type === 'transfer' && calculatedTransferFee > 0 ? transferFeeBudgetPool : undefined,
        });
      }
    }

    // 1. Post-transaction deduplicated deficit/pool-drain/anomaly alert
    if (type === 'expense') {
      const updatedTxs = editingTx
        ? transactions.map((tx) => (tx.id === editingTx.id ? { ...tx, ...payload } : tx))
        : [...transactions, { ...payload, id: 'temp_eval', createdAt: Date.now() }];

      const postEval = evaluateSmartBudget(
        updatedTxs,
        accounts,
        {
          ...settings.smartBudget?.baseline,
          startDay: settings.defaultMonthStartDay || 1,
          overrides: settings.smartBudget?.overrides,
          adjustments: settings.smartBudget?.adjustments,
          baseCurrency: currencySymbol,
        },
        new Date()
      );

      notifyBudgetAlertIfNeeded(
        postEval,
        showToast,
        () => setIsSmartBudgetModalOpen(true),
        isArabic
      );
    }

    // 2. Post-transaction deduplicated salary received confirmation prompt
    if (
      type === 'income' &&
      (isSalary ||
        payload.categoryName?.toLowerCase().includes('salary') ||
        payload.categoryName?.includes('راتب') ||
        payload.categoryName?.includes('مرتب') ||
        payload.description?.toLowerCase().includes('salary') ||
        payload.description?.includes('راتب') ||
        payload.description?.includes('مرتب'))
    ) {
      promptSalaryReviewIfNeeded(
        date,
        showConfirm,
        () => setIsSmartBudgetModalOpen(true),
        isArabic
      );
    }

    setShowWithdrawalPrompt(false);
    closeAddTxModal();
  };

  const handleSave = () => {
    if (!canSave) return;
    if (!isSharedMode && !editingRecurring && type === 'transfer' && isSavingsWithdrawal && !savingsWithdrawalChoice) {
      setShowWithdrawalPrompt(true);
      return;
    }
    executeSave(savingsWithdrawalChoice);
  };

  const confirmRecurringEdit = (scope: 'future' | 'all') => {
    if (!pendingRecurringEdit) return;
    applyRecurringRuleEdit(pendingRecurringEdit, scope);
    setPendingRecurringEdit(null);
    closeAddTxModal();
  };

  const linkedPastCount = pendingRecurringEdit
    ? transactions.filter((tx) => tx.recurringRuleId === pendingRecurringEdit.id).length
    : 0;

  return (
    <div
      onClick={handleAnimatedClose}
      onTouchMove={(e) => e.stopPropagation()}
      className={`fixed inset-0 z-[80] flex items-end sm:items-center landscape:items-center justify-center bg-black/60 backdrop-blur-md p-0 sm:p-4 landscape:p-2 overflow-y-auto overscroll-contain transition-all duration-200 ${
        isClosing ? 'modal-backdrop-closing' : 'modal-backdrop-anim'
      }`}
    >
      <div
        ref={modalContainerRef}
        onClick={(e) => {
          e.stopPropagation();
          setAccountDropdownOpen(null);
        }}
        onPointerDown={handleSwipePointerDown}
        onPointerMove={handleSwipePointerMove}
        onPointerUp={handleSwipePointerUp}
        onPointerCancel={handleSwipePointerUp}
        style={{
          maxHeight: viewportHeight ? `${Math.min(viewportHeight, window.innerHeight)}px` : '96dvh',
        }}
        className={`w-full max-w-lg my-auto flex flex-col rounded-t-3xl sm:rounded-3xl landscape:rounded-3xl bg-zinc-950/95 backdrop-blur-2xl border border-zinc-800/80 shadow-2xl overflow-hidden text-white transition-all duration-200 touch-pan-y select-none ${
          isClosing ? 'modal-container-closing' : 'modal-container-anim'
        }`}
      >
        {/* Top Bar: Close X & Interactive 3-Way Type Pill Toggle */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/80 shrink-0">
          <button
            type="button"
            onClick={handleAnimatedClose}
            className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* 3-Way Type Pill Toggle with Live 1:1 Tracking Indicator */}
          <div className="relative flex items-center p-1 rounded-full bg-zinc-900 border border-zinc-800 w-64 sm:w-72 select-none overflow-hidden">
            {/* Live-Tracking Sliding Background Pill */}
            <div
              className={`absolute top-1 bottom-1 rounded-full shadow-md ${
                isDragging || prefersReducedMotion ? 'transition-none' : 'transition-all duration-200 ease-out'
              } ${
                type === 'income'
                  ? 'bg-emerald-600'
                  : type === 'expense'
                  ? 'bg-red-600'
                  : 'bg-blue-600'
              }`}
              style={{
                width: 'calc((100% - 8px) / 3)',
                [isArabic ? 'right' : 'left']: `calc(4px + ${indicatorOffsetPercent}%)`,
              }}
            />

            {/* Income Button */}
            <button
              type="button"
              onClick={() => handleTypeSelect('income')}
              className={`relative z-10 flex-1 flex items-center justify-center gap-1 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                type === 'income' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ArrowDown className="w-3.5 h-3.5 text-emerald-300" />
              <span>{t('income')}</span>
            </button>

            {/* Expense Button */}
            <button
              type="button"
              onClick={() => handleTypeSelect('expense')}
              className={`relative z-10 flex-1 flex items-center justify-center gap-1 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                type === 'expense' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ArrowUp className="w-3.5 h-3.5 text-red-300" />
              <span>{t('expense')}</span>
            </button>

            {/* Transfer Button */}
            <button
              type="button"
              onClick={() => handleTypeSelect('transfer')}
              className={`relative z-10 flex-1 flex items-center justify-center gap-1 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                type === 'transfer' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-blue-300" />
              <span>{t('transfer')}</span>
            </button>
          </div>

          <div className="w-9" /> {/* Spacer */}
        </div>

        {/* Scrollable Upper Section with Subtle Fluid Drag Feedback */}
        <div
          style={{
            transform: isDragging && !prefersReducedMotion ? `translateX(${dragDeltaX * 0.15}px)` : 'none',
            transition: isDragging || prefersReducedMotion ? 'none' : 'transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}
          className="flex-1 overflow-y-auto overscroll-contain touch-pan-y px-5 py-3 space-y-3.5"
        >
          {editingRecurring && (
            <div className="rounded-2xl bg-blue-600/10 border border-blue-500/30 px-3 py-2 text-[11px] font-semibold text-blue-300 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 shrink-0" />
              <span>{isArabic ? 'تعديل قاعدة المعاملة الدورية' : 'Editing recurring rule'}</span>
            </div>
          )}

          {/* Amount Display & Read-Only Context in Edit Mode */}
          <div className="text-center py-1">
            {editingTx && selectedAccount && (
              <div className="text-xs text-zinc-400 mb-2 font-mono">
                {t('previousAmount')}: {formatCurrency(editingTx.amount, currencySymbol)} | {t('currentAccountBalance')}: {formatCurrency(selectedAccount.balance, currencySymbol)}
              </div>
            )}
            {/* Inline Tightly Coupled Amount & Currency Wrapper */}
            <div className="flex flex-col items-center justify-center py-1">
              <button
                type="button"
                role="status"
                aria-live="polite"
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                  }
                }}
                onClick={() => setActiveKeypadTarget('amount')}
                className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-2xl bg-zinc-900/60 border shadow-inner select-none transition cursor-pointer ${
                  activeKeypadTarget === 'amount'
                    ? 'border-blue-500/60 ring-2 ring-blue-500/20'
                    : 'border-zinc-800 opacity-75 hover:opacity-100'
                }`}
              >
                <span className={`text-3xl sm:text-4xl font-black ${
                  type === 'income' ? 'text-emerald-400' : type === 'expense' ? 'text-red-400' : 'text-blue-400'
                }`}>
                  {currencySymbol}
                </span>
                <span className="text-4xl sm:text-5xl font-mono font-black text-white tracking-tight">
                  {formatDisplayNumber(amountStr)}
                </span>
              </button>
              {type === 'transfer' && activeKeypadTarget === 'fee' && (
                <span className="mt-1 text-[10px] font-semibold text-amber-400 animate-pulse">
                  {t('editingFeeKeypadHint')}
                </span>
              )}
            </div>

            {/* Live Non-Blocking Impact Estimate for Expense Transactions */}
            {type === 'expense' && impactEstimate && (
              <div
                className={`mt-1.5 mx-auto max-w-sm px-3.5 py-2 rounded-xl text-xs flex items-center justify-between gap-2 border transition ${
                  impactEstimate.status === 'safe'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : impactEstimate.status === 'warning'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-red-500/10 border-red-500/30 text-red-300'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {impactEstimate.status === 'safe' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : impactEstimate.status === 'warning' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 animate-pulse" />
                  )}
                  <span className="leading-snug break-words">
                    {impactEstimate.budgetPool === 'oneoff' && t('poolOneOffHint')}
                    {impactEstimate.budgetPool !== 'oneoff' &&
                      impactEstimate.status === 'safe' &&
                      (isArabic ? 'ضمن المسموح اليوم بهدوء' : "Within today's allowed amount")}
                    {impactEstimate.budgetPool !== 'oneoff' &&
                      impactEstimate.status === 'warning' &&
                      (impactEstimate.overTodayBy > 0
                        ? t('calmOverTodayMessage')
                            .replace('{over}', formatCurrency(impactEstimate.overTodayBy, currencySymbol))
                            .replace('{nextDaily}', formatCurrency(impactEstimate.projectedAllowance, currencySymbol))
                        : isArabic
                        ? `سيصبح المبلغ اليومي للأيام الجاية ${formatCurrency(impactEstimate.projectedAllowance, currencySymbol)}`
                        : `Upcoming days' daily amount will be ${formatCurrency(impactEstimate.projectedAllowance, currencySymbol)}`)}
                    {impactEstimate.budgetPool !== 'oneoff' &&
                      impactEstimate.status === 'danger' &&
                      (isArabic
                        ? 'هذا المصروف يستنفد كامل حوض المصروف اليومي المتبقي لهذا الشهر'
                        : 'This expense exhausts the remaining monthly Daily Spending pool')}
                  </span>
                </div>
              </div>
            )}

            {/* Date & Time Separate Pill Buttons for Instant Access */}
            <div className="flex items-center justify-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => {
                  setPickerTab('date');
                  setShowDateTimePicker(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:border-zinc-700 transition cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                <span>{date}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPickerTab('time');
                  setShowDateTimePicker(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:border-zinc-700 transition cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>{hasTime ? time : (settings.language === 'ar' ? 'بدون وقت' : 'No time')}</span>
              </button>
            </div>

            {/* Interactive Visual Full-Screen Floating Calendar & Analogue Clock Picker */}
            {showDateTimePicker && (
              <MiniDateTimePicker
                isOpen={showDateTimePicker}
                onClose={() => setShowDateTimePicker(false)}
                date={date}
                time={time}
                hasTime={hasTime}
                onDateChange={setDate}
                onTimeChange={setTime}
                onToggleHasTime={setHasTime}
                initialTab={pickerTab}
                lang={settings.language}
              />
            )}
          </div>

          {/* Account Selection */}
          {type !== 'transfer' ? (
            /* Single Account Selector */
            <div className="relative">
              <label className="block text-xs font-semibold text-zinc-400 mb-1">
                {t('account')}
              </label>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setAccountDropdownOpen(accountDropdownOpen === 'single' ? null : 'single');
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{selectedAccount?.icon || '💵'}</span>
                  <div className="text-left rtl:text-right">
                    <div className="text-sm font-semibold text-white">{selectedAccount?.name}</div>
                    <div className="text-xs text-zinc-400">
                      Balance: {selectedAccount ? formatCurrency(selectedAccount.balance, currencySymbol) : ''}
                    </div>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-zinc-400" />
              </button>

              {accountDropdownOpen === 'single' && (
                <div
                  ref={dropdownRef}
                  data-dropdown="true"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute z-30 left-0 right-0 mt-1 rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl p-1.5 max-h-52 overflow-y-auto"
                >
                  {accounts.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setAccountId(acc.id);
                        setAccountDropdownOpen(null);
                      }}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left rtl:text-right transition cursor-pointer ${
                        acc.id === accountId ? 'bg-blue-600/20 text-white' : 'text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{acc.icon}</span>
                        <span className="text-xs font-semibold">{acc.name}</span>
                      </div>
                      <span className="text-xs text-zinc-400">
                        {formatCurrency(acc.balance, currencySymbol)}
                      </span>
                    </button>
                  ))}
                  {!isSharedMode && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setAccountDropdownOpen(null);
                        openAddAccountModal();
                      }}
                      className="w-full flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold text-blue-400 hover:bg-blue-500/10 border-t border-zinc-800 mt-1 transition cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{t('addNewAccount')}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Transfer: Two Dropdowns Side-by-Side with Swap */
            <div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                {/* From Account */}
                <div className="relative">
                  <span className="block text-[11px] text-zinc-400 mb-1">{t('fromAccount')}</span>
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setAccountDropdownOpen(accountDropdownOpen === 'from' ? null : 'from');
                    }}
                    className="w-full flex flex-col p-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-left rtl:text-right cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-lg">{selectedAccount?.icon}</span>
                      <span className="text-xs font-semibold truncate">{selectedAccount?.name}</span>
                    </div>
                    <span className="text-[10px] text-zinc-400 mt-0.5">
                      {selectedAccount ? formatCurrency(selectedAccount.balance, currencySymbol) : ''}
                    </span>
                  </button>

                  {accountDropdownOpen === 'from' && (
                    <div
                      ref={dropdownRef}
                      data-dropdown="true"
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="absolute z-30 left-0 w-48 mt-1 rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl p-1.5 max-h-48 overflow-y-auto"
                    >
                      {accounts.map((acc) => (
                        <button
                          key={acc.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            if (acc.id === toAccountId) {
                              setToAccountId(accountId);
                            }
                            setAccountId(acc.id);
                            setAccountDropdownOpen(null);
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-xl text-left rtl:text-right text-xs cursor-pointer ${
                            acc.id === accountId ? 'bg-blue-600/20 text-white' : 'text-zinc-300 hover:bg-zinc-800'
                          }`}
                        >
                          <span className="truncate">{acc.icon} {acc.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Swap button */}
                <button
                  type="button"
                  onClick={() => {
                    const temp = accountId;
                    setAccountId(toAccountId);
                    setToAccountId(temp);
                  }}
                  className="p-2.5 rounded-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-blue-400 mt-4 active:scale-90 transition cursor-pointer"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                </button>

                {/* To Account */}
                <div className="relative">
                  <span className="block text-[11px] text-zinc-400 mb-1">{t('toAccount')}</span>
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setAccountDropdownOpen(accountDropdownOpen === 'to' ? null : 'to');
                    }}
                    className="w-full flex flex-col p-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-left rtl:text-right cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-lg">{selectedToAccount?.icon || '🏦'}</span>
                      <span className="text-xs font-semibold truncate">{selectedToAccount?.name || 'Select'}</span>
                    </div>
                    <span className="text-[10px] text-zinc-400 mt-0.5">
                      {selectedToAccount ? formatCurrency(selectedToAccount.balance, currencySymbol) : ''}
                    </span>
                  </button>

                  {accountDropdownOpen === 'to' && (
                    <div
                      ref={dropdownRef}
                      data-dropdown="true"
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="absolute z-30 right-0 w-48 mt-1 rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl p-1.5 max-h-48 overflow-y-auto"
                    >
                      {accounts.map((acc) => {
                        const isSelected = acc.id === toAccountId;
                        return (
                          <button
                            key={acc.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              if (acc.id === accountId) {
                                setAccountId(toAccountId);
                              }
                              setToAccountId(acc.id);
                              setAccountDropdownOpen(null);
                            }}
                            className={`w-full flex items-center justify-between p-2 rounded-xl text-left rtl:text-right text-xs cursor-pointer ${
                              isSelected
                                ? 'bg-blue-600/20 text-white'
                                : 'text-zinc-300 hover:bg-zinc-800'
                            }`}
                          >
                            <span className="truncate">{acc.icon} {acc.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {isTransferSameAccount && (
                <div className="mt-2 text-xs text-red-400 text-center font-medium">
                  {t('sameAccountError')}
                </div>
              )}

              {/* Savings / Investment Allocation Toggle & Withdrawal 3-Choice Selector */}
              {!isSharedMode && !isTransferSameAccount && (
                <div className="mt-3 space-y-2.5">
                  {/* Savings / Investment Allocation Toggle */}
                  {!isSavingsWithdrawal && (
                    <button
                      type="button"
                      onClick={() => setIsSavingsAllocation((prev) => !prev)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl border text-left rtl:text-right transition cursor-pointer ${
                        isSavingsAllocation
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200 shadow-sm'
                          : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2 rtl:pr-0 rtl:pl-2">
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition ${
                            isSavingsAllocation
                              ? 'bg-emerald-600 text-white shadow'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          <PiggyBank className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">
                            {t('savingsInvestmentAllocation')}
                          </div>
                          <div className="text-[10px] text-zinc-400 truncate">
                            {t('savingsInvestmentAllocationDesc')}
                          </div>
                        </div>
                      </div>
                      <div
                        className={`w-10 h-5.5 rounded-full p-0.5 transition-colors shrink-0 flex items-center ${
                          isSavingsAllocation ? 'bg-emerald-600 justify-end' : 'bg-zinc-800 justify-start'
                        }`}
                      >
                        <div className="w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition" />
                      </div>
                    </button>
                  )}

                  {/* Inline 3-Choice Withdrawal Selector when transferring OUT of 'savings'/'investment' to 'spending' */}
                  {isSavingsWithdrawal && (
                    <div className="p-3 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                        <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
                        <span>{t('savingsWithdrawalPromptTitle')}</span>
                      </div>
                      <p className="text-[11px] text-zinc-400">
                        {t('savingsWithdrawalPromptDesc')}
                      </p>
                      <div className="grid grid-cols-1 gap-1.5 pt-1">
                        {(
                          [
                            {
                              id: 'emergency_expense' as SavingsWithdrawalChoice,
                              title: t('withdrawalChoiceEmergency'),
                              desc: t('withdrawalChoiceEmergencyDesc'),
                              activeCls: 'bg-red-500/20 border-red-500/50 text-red-200',
                            },
                            {
                              id: 'add_to_spending' as SavingsWithdrawalChoice,
                              title: t('withdrawalChoiceSpending'),
                              desc: t('withdrawalChoiceSpendingDesc'),
                              activeCls: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200',
                            },
                            {
                              id: 'just_moving' as SavingsWithdrawalChoice,
                              title: t('withdrawalChoiceMoving'),
                              desc: t('withdrawalChoiceMovingDesc'),
                              activeCls: 'bg-blue-500/20 border-blue-500/50 text-blue-200',
                            },
                          ]
                        ).map((opt) => {
                          const isChosen = savingsWithdrawalChoice === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setSavingsWithdrawalChoice(opt.id)}
                              className={`w-full text-left rtl:text-right px-3 py-2 rounded-xl border transition cursor-pointer ${
                                isChosen
                                  ? opt.activeCls
                                  : 'bg-zinc-900/90 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold">{opt.title}</span>
                                {isChosen && <Check className="w-3.5 h-3.5 shrink-0" />}
                              </div>
                              <div className="text-[10px] text-zinc-400 mt-0.5">{opt.desc}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Transfer Fee / Tax Section (Req 7) */}
                  <div className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                        <Coins className="w-3.5 h-3.5 text-amber-400" />
                        <span>{t('transferFeeSectionTitle')}</span>
                      </span>
                      {calculatedTransferFee > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-[11px] font-bold text-amber-300 font-mono">
                          +{formatCurrency(calculatedTransferFee, sourceCurrencySymbol)}
                        </span>
                      )}
                    </div>

                    {/* Fee Mode Selector Pills */}
                    <div className={`grid gap-1.5 ${feeConfig.defaultRule.enabled && feeConfig.defaultRule.ruleType !== 'none' ? 'grid-cols-4' : 'grid-cols-3'}`}>
                      <button
                        type="button"
                        onClick={() => {
                          setTransferFeeMode('none');
                          setActiveKeypadTarget('amount');
                        }}
                        className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition cursor-pointer truncate ${
                          transferFeeMode === 'none'
                            ? 'bg-zinc-800 border-zinc-600 text-white shadow'
                            : 'bg-zinc-950/70 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {t('feeModeNone')}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setTransferFeeMode('instapay');
                          setActiveKeypadTarget('amount');
                        }}
                        className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition cursor-pointer flex items-center justify-center gap-1 truncate ${
                          transferFeeMode === 'instapay'
                            ? 'bg-purple-600/25 border-purple-500/60 text-purple-200 shadow'
                            : 'bg-zinc-950/70 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <Zap className="w-3 h-3 text-purple-400 shrink-0" />
                        <span className="truncate">{t('feeModeInstaPay')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setTransferFeeMode('manual');
                          setActiveKeypadTarget('fee');
                        }}
                        className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition cursor-pointer truncate ${
                          transferFeeMode === 'manual'
                            ? 'bg-amber-600/25 border-amber-500/60 text-amber-200 shadow'
                            : 'bg-zinc-950/70 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {t('feeModeManual')}
                      </button>

                      {feeConfig.defaultRule.enabled && feeConfig.defaultRule.ruleType !== 'none' && (
                        <button
                          type="button"
                          onClick={() => {
                            setTransferFeeMode('default_rule');
                            setActiveKeypadTarget('amount');
                          }}
                          className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition cursor-pointer truncate ${
                            transferFeeMode === 'default_rule'
                              ? 'bg-blue-600/25 border-blue-500/60 text-blue-200 shadow'
                              : 'bg-zinc-950/70 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          {t('feeModeDefaultRule')}
                        </button>
                      )}
                    </div>

                    {/* InstaPay Quick Preset Details */}
                    {transferFeeMode === 'instapay' && (
                      <div className="p-2.5 rounded-xl bg-purple-950/20 border border-purple-500/30 flex items-center justify-between gap-2 text-xs">
                        <span className="text-[11px] text-purple-200">
                          {t('instaPayPresetSummary')
                            .replace('{rate}', String(feeConfig.instaPayPreset.ratePercent))
                            .replace('{min}', formatCurrency(feeConfig.instaPayPreset.minFee, sourceCurrencySymbol))
                            .replace('{max}', formatCurrency(feeConfig.instaPayPreset.maxFee, sourceCurrencySymbol))}
                        </span>
                        <span className="font-mono font-bold text-purple-300 shrink-0">
                          {formatCurrency(calculatedTransferFee, sourceCurrencySymbol)}
                        </span>
                      </div>
                    )}

                    {/* Manual Fee Input with [ EGP | % ] Toggle & In-App Keypad Binding */}
                    {transferFeeMode === 'manual' && (
                      <div className="space-y-2 pt-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-zinc-400">
                            {t('manualFeeInputLabel')}
                          </span>
                          {/* [ EGP | % ] Toggle */}
                          <div className="inline-flex p-0.5 rounded-lg bg-zinc-950 border border-zinc-800">
                            <button
                              type="button"
                              onClick={() => {
                                setManualFeeInputType('amount');
                                setActiveKeypadTarget('fee');
                              }}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                                manualFeeInputType === 'amount'
                                  ? 'bg-amber-600 text-white'
                                  : 'text-zinc-400 hover:text-white'
                              }`}
                            >
                              {selectedAccount?.currency || (isArabic ? 'ج.م' : 'EGP')}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setManualFeeInputType('percent');
                                setActiveKeypadTarget('fee');
                              }}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                                manualFeeInputType === 'percent'
                                  ? 'bg-amber-600 text-white'
                                  : 'text-zinc-400 hover:text-white'
                              }`}
                            >
                              %
                            </button>
                          </div>
                        </div>

                        {/* Tap-to-edit keypad target button (never opens OS keyboard) */}
                        <div className="grid grid-cols-2 gap-2 items-center">
                          <button
                            type="button"
                            role="status"
                            aria-live="polite"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              if (document.activeElement instanceof HTMLElement) {
                                document.activeElement.blur();
                              }
                            }}
                            onClick={() => setActiveKeypadTarget('fee')}
                            className={`flex items-center justify-between px-3 py-2 rounded-xl border font-mono text-sm font-bold transition cursor-pointer ${
                              activeKeypadTarget === 'fee'
                                ? 'bg-amber-500/15 border-amber-500 text-amber-200 ring-2 ring-amber-500/25'
                                : 'bg-zinc-950 border-zinc-800 text-zinc-200 hover:border-zinc-700'
                            }`}
                          >
                            <span className="text-xs text-amber-400">
                              {manualFeeInputType === 'percent' ? '%' : sourceCurrencySymbol}
                            </span>
                            <span className="truncate">{formatDisplayNumber(manualFeeStr)}</span>
                          </button>

                          <div className="px-3 py-2 rounded-xl bg-zinc-950/90 border border-zinc-800/80 flex items-center justify-between text-xs">
                            <span className="text-[10px] text-zinc-400 truncate">
                              {t('calculatedFeeLabel')}
                            </span>
                            <span className="font-mono font-bold text-amber-300">
                              {formatCurrency(calculatedTransferFee, sourceCurrencySymbol)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Summary Breakdown, Balance Warning & Fee Budget Pool when Fee > 0 */}
                    {calculatedTransferFee > 0 && (
                      <div className="pt-2 border-t border-zinc-800/80 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-zinc-400">{t('totalDeductedWithFee')}:</span>
                          <span className="font-mono font-bold text-red-300">
                            {formatCurrency(numericAmount + calculatedTransferFee, sourceCurrencySymbol)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-zinc-400">{t('recipientReceivesLabel')}:</span>
                          <span className="font-mono font-bold text-emerald-300">
                            {formatCurrency(numericAmount, sourceCurrencySymbol)}
                          </span>
                        </div>

                        {exceedsAvailableWithFee && (
                          <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center gap-2 text-[11px] text-amber-200">
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>
                              {t('insufficientBalanceWithFeeWarning')
                                .replace(
                                  '{total}',
                                  formatCurrency(numericAmount + calculatedTransferFee, sourceCurrencySymbol)
                                )
                                .replace(
                                  '{balance}',
                                  formatCurrency(availableSourceBalance, sourceCurrencySymbol)
                                )}
                            </span>
                          </div>
                        )}

                        {/* Fee Budget Pool Selector (default 'daily', never a savings withdrawal) */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                          <span className="text-[11px] text-zinc-400">{t('feeBudgetPoolLabel')}:</span>
                          <div className="inline-flex flex-wrap gap-1 p-0.5 rounded-xl bg-zinc-950 border border-zinc-800">
                            {(
                              [
                                { id: 'daily' as const, label: t('poolDaily') },
                                { id: 'fixed' as const, label: t('poolFixed') },
                                { id: 'outings' as const, label: t('poolOutings') },
                                { id: 'oneoff' as const, label: t('poolOneOff') },
                              ]
                            ).map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => setTransferFeeBudgetPool(p.id)}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                                  transferFeeBudgetPool === p.id
                                    ? 'bg-blue-600 text-white'
                                    : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Optional Tax / Extra Fee Input (for Expense & Income) */}
          {(type === 'expense' || type === 'income') && (
            <div className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t('taxExtraFeeLabel')}</span>
                </label>
                {numericTaxAmount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-[11px] font-bold text-amber-300 font-mono">
                    +{formatCurrency(numericTaxAmount, currencySymbol)}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-zinc-400">
                {t('taxExtraFeeDesc')}
              </p>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={taxAmountStr}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/[^0-9.]/g, '');
                    const parts = cleaned.split('.');
                    const sanitized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned;
                    setTaxAmountStr(sanitized);
                  }}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-amber-500/60 transition"
                />
                {Boolean(taxAmountStr) && (
                  <button
                    type="button"
                    onClick={() => setTaxAmountStr('')}
                    className="absolute right-2.5 rtl:right-auto rtl:left-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Explicit Breakdown Preview if tax > 0 */}
              {numericTaxAmount > 0 && numericAmount > 0 && (
                <div className="pt-1.5 border-t border-zinc-800/80 grid grid-cols-3 gap-1.5 text-center font-mono">
                  <div className="p-1.5 rounded-lg bg-zinc-950/60 border border-zinc-800/60">
                    <div className="text-[9px] text-zinc-400 font-sans truncate">{t('amountBeforeTax')}</div>
                    <div className="text-xs font-semibold text-zinc-200 mt-0.5">
                      {formatCurrency(numericAmount, currencySymbol)}
                    </div>
                  </div>
                  <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <div className="text-[9px] text-amber-300/80 font-sans truncate">{t('taxAmount')}</div>
                    <div className="text-xs font-semibold text-amber-300 mt-0.5">
                      +{formatCurrency(numericTaxAmount, currencySymbol)}
                    </div>
                  </div>
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                    <div className="text-[9px] text-emerald-300/80 font-sans truncate">{t('totalAfterTax')}</div>
                    <div className="text-xs font-bold text-emerald-300 mt-0.5">
                      {formatCurrency(numericAmount + numericTaxAmount, currencySymbol)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Modern Responsive Recurring Transaction Toggle (Directly ABOVE Description) */}
          {!editingTx && !isSharedMode && (
            <div className="rounded-2xl bg-zinc-900/70 border border-zinc-800/80 p-2.5 transition-all shadow-sm">
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (!editingRecurring) {
                    const nextRec = !isRecurring;
                    setIsRecurring(nextRec);
                    if (!userManuallyPickedPoolRef.current) {
                      setBudgetPool(nextRec ? 'fixed' : 'daily');
                    }
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (!editingRecurring) {
                      const nextRec = !isRecurring;
                      setIsRecurring(nextRec);
                      if (!userManuallyPickedPoolRef.current) {
                        setBudgetPool(nextRec ? 'fixed' : 'daily');
                      }
                    }
                  }
                }}
                className={`flex items-center justify-between w-full px-3 py-2 rounded-xl transition cursor-pointer select-none ${
                  isRecurring
                    ? 'bg-blue-600/15 border border-blue-500/40 text-blue-300'
                    : 'bg-zinc-950/60 hover:bg-zinc-900 border border-zinc-800/60 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition ${
                      isRecurring
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-zinc-800/80 text-zinc-400'
                    }`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 transition-transform duration-300 ${isRecurring ? 'rotate-180' : ''}`} />
                  </div>
                  <div className="text-left rtl:text-right truncate">
                    <span className="text-xs font-bold block truncate">
                      {settings.language === 'ar' ? 'معاملة دورية متكررة' : 'Recurring Transaction'}
                    </span>
                    <span className="text-[10px] text-zinc-500 block truncate">
                      {isRecurring
                        ? (settings.language === 'ar' ? `تتكرر: ${getFrequencyLabel(recurringFrequency)}` : `Repeats: ${getFrequencyLabel(recurringFrequency)}`)
                        : (settings.language === 'ar' ? 'تلقائي وفق جدول زمني' : 'Auto-repeats on schedule')}
                    </span>
                  </div>
                </div>

                {/* Modern Switch Toggle Track */}
                <div
                  className={`w-10 h-5.5 rounded-full p-0.5 transition-colors shrink-0 flex items-center ${
                    isRecurring ? 'bg-blue-600 justify-end' : 'bg-zinc-800 justify-start'
                  }`}
                >
                  <div className="w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition" />
                </div>
              </div>

              {/* Accordion smooth expansion */}
              <div className={`accordion-wrapper ${isRecurring ? 'open' : 'closed'}`}>
                <div className="accordion-inner pt-2.5 mt-2 border-t border-zinc-800/60">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5 px-1">
                    {settings.language === 'ar' ? 'دورة التكرار' : 'Repeat Frequency'}
                  </span>
                  <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
                    {(['daily', 'weekly', 'biweekly', 'monthly', 'yearly'] as RecurringFrequency[]).map((freq) => (
                      <button
                        key={freq}
                        type="button"
                        disabled={isAdvancedSchedule}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isAdvancedSchedule) return;
                          setRecurringFrequency(freq);
                        }}
                        className={`py-1.5 px-1 text-[10px] font-bold rounded-lg capitalize transition text-center truncate ${
                          isAdvancedSchedule
                            ? 'opacity-40 cursor-not-allowed bg-zinc-950 text-zinc-500 border border-zinc-850'
                            : recurringFrequency === freq
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30 ring-1 ring-blue-400/50 cursor-pointer'
                            : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800/80 hover:bg-zinc-900 cursor-pointer'
                        }`}
                      >
                        {getFrequencyLabel(freq)}
                      </button>
                    ))}
                  </div>
                  {isAdvancedSchedule && (
                    <div className="mt-1 flex items-center justify-center gap-1 text-[10px] text-zinc-500 font-medium">
                      <span>🔒</span>
                      <span>{isArabic ? 'مقفلة: الجدول المتقدم هو المصدر المعتمد للتكرار' : 'Locked: Advanced schedule controls the repeat pattern'}</span>
                    </div>
                  )}

                  {/* Live Human-Readable Summary Banner */}
                  <div className="mt-2.5 p-2.5 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-start gap-2 text-blue-200">
                    <Calendar className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-blue-400/80 mb-0.5">
                        {isArabic ? 'ملخص جدول التكرار' : 'Schedule Summary'}
                      </div>
                      <div className="text-xs font-semibold leading-relaxed text-blue-100">
                        {scheduleSummaryText}
                      </div>
                    </div>
                  </div>

                  {/* Next 5 Occurrences Preview Banner */}
                  <div className="mt-2 p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-blue-400" />
                        <span>{isArabic ? 'الـ5 مرات القادمة للتنفيذ' : 'Next 5 Occurrences'}</span>
                      </div>
                      {next5Occurrences.length > 0 && (
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {next5Occurrences.length} / 5
                        </span>
                      )}
                    </div>

                    {isFilterEmpty ? (
                      <div className="py-1 px-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10.5px] text-amber-400 font-medium text-center">
                        {filterEmptyHint}
                      </div>
                    ) : next5Occurrences.length === 0 ? (
                      <div className="py-2 text-center text-[11px] text-zinc-500 italic">
                        {isArabic ? 'لا توجد معاملات مجدولة قادمة ضمن الإعدادات الحالية' : 'No upcoming occurrences scheduled with current settings'}
                      </div>
                    ) : (
                      <div className="space-y-1 pt-0.5">
                        {next5Occurrences.map((occ, idx) => (
                          <div
                            key={`${occ.date}_${occ.time}_${idx}`}
                            className="flex items-center justify-between px-2 py-1 rounded-lg bg-zinc-950/70 border border-zinc-800/60 text-xs font-mono"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 text-[9px] font-bold flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <span className="font-semibold text-zinc-200 truncate">
                                {occ.dayName}
                              </span>
                              <span className="text-zinc-500 text-[11px]">
                                {occ.formattedDate}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700/80 text-[10.5px] font-bold text-blue-300">
                                {occ.formattedTime}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Advanced custom schedule */}
                  <div className="mt-2.5 pt-2.5 border-t border-zinc-800/60">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const nextVal = !isAdvancedSchedule;
                        if (nextVal) {
                          setSavedSimpleFrequency(recurringFrequency);
                        } else {
                          setRecurringFrequency(savedSimpleFrequency);
                        }
                        setIsAdvancedSchedule(nextVal);
                      }}
                      className={'w-full flex items-center justify-between px-3 py-2 rounded-xl text-[11px] font-bold transition cursor-pointer border ' + (isAdvancedSchedule ? 'bg-blue-600/15 border-blue-500/40 text-blue-300' : 'bg-zinc-950 border-zinc-800/80 text-zinc-400 hover:text-white')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{isArabic ? 'جدول زمني متقدم' : 'Advanced schedule'}</span>
                        <span className="text-[10px] font-normal text-zinc-500">
                          {isArabic ? '(تصفية الأيام والأوقات)' : '(Day filters & daily times)'}
                        </span>
                      </div>
                      <span className={'px-2 py-0.5 rounded-full text-[10px] ' + (isAdvancedSchedule ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400')}>
                        {isAdvancedSchedule ? (isArabic ? 'مفعّل' : 'ON') : (isArabic ? 'متوقف' : 'OFF')}
                      </span>
                    </button>

                    {isAdvancedSchedule && (
                      <div className="mt-2.5 space-y-2.5" onClick={(e) => e.stopPropagation()}>
                        {/* 3 Advanced Schedule Tabs */}
                        <div className="grid grid-cols-3 gap-1 p-1 bg-zinc-950 rounded-xl border border-zinc-800/80">
                          <button
                            type="button"
                            onClick={() => setAdvancedTab('weekdays')}
                            className={`py-1.5 px-1 text-[11px] font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1 truncate ${
                              advancedTab === 'weekdays'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-zinc-400 hover:text-white'
                            }`}
                          >
                            <span>{isArabic ? 'أيام الأسبوع' : 'Weekdays'}</span>
                            {useWeekdayFilter && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setAdvancedTab('month_days')}
                            className={`py-1.5 px-1 text-[11px] font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1 truncate ${
                              advancedTab === 'month_days'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-zinc-400 hover:text-white'
                            }`}
                          >
                            <span>{isArabic ? 'أيام الشهر' : 'Month days'}</span>
                            {useMonthDayFilter && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setAdvancedTab('times_daily')}
                            className={`py-1.5 px-1 text-[11px] font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1 truncate ${
                              advancedTab === 'times_daily'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-zinc-400 hover:text-white'
                            }`}
                          >
                            <span>{isArabic ? 'أوقات اليوم' : 'Times daily'}</span>
                            <span className="text-[10px] opacity-75 font-mono">({timesOfDay.length})</span>
                            {hasCustomTimes && (Object.keys(weekdayTimes).length > 0 || Object.keys(monthDayTimes).length > 0) && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                            )}
                          </button>
                        </div>

                        {/* Tab 1: Weekdays */}
                        {advancedTab === 'weekdays' && (
                          <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-2.5">
                            {/* Toggle: Filter by specific weekdays */}
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-zinc-300">
                                {isArabic ? 'تحديد أيام معينة من الأسبوع' : 'Filter by specific weekdays'}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = !useWeekdayFilter;
                                  setUseWeekdayFilter(next);
                                  if (next && selectedDaysOfWeek.length === 0) {
                                    setSelectedDaysOfWeek([1]);
                                  }
                                }}
                                className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                                  useWeekdayFilter ? 'bg-blue-600 justify-end' : 'bg-zinc-800 justify-start'
                                }`}
                              >
                                <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                              </button>
                            </div>

                            {useWeekdayFilter ? (
                              <div className="space-y-2 pt-1 border-t border-zinc-800/60">
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="text-zinc-400">
                                    {isArabic
                                      ? `تم اختيار ${selectedDaysOfWeek.length} من 7 أيام`
                                      : `${selectedDaysOfWeek.length} of 7 days selected`}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={selectAllDaysOfWeek}
                                      className="text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                                    >
                                      {isArabic ? 'تحديد الكل' : 'Select All'}
                                    </button>
                                    <span className="text-zinc-600">•</span>
                                    <button
                                      type="button"
                                      onClick={clearDaysOfWeek}
                                      className="text-zinc-400 hover:text-zinc-200 font-semibold cursor-pointer"
                                    >
                                      {isArabic ? 'مسح' : 'Clear'}
                                    </button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-7 gap-1">
                                  {weekDaysMap.map((w) => {
                                    const isSel = selectedDaysOfWeek.includes(w.day);
                                    return (
                                      <button
                                        key={w.day}
                                        type="button"
                                        onClick={() => toggleDayOfWeek(w.day)}
                                        className={`py-2 text-[11px] font-bold rounded-lg transition cursor-pointer ${
                                          isSel
                                            ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400/40'
                                            : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'
                                        }`}
                                      >
                                        {isArabic ? w.labelAr : w.labelEn}
                                      </button>
                                    );
                                  })}
                                </div>

                                {selectedDaysOfWeek.length === 0 && (
                                  <div className="text-[11px] text-amber-400/90 font-medium text-center py-1">
                                    {isArabic
                                      ? '⚠️ يرجى اختيار يوم واحد على الأقل من أيام الأسبوع'
                                      : '⚠️ Please select at least one weekday'}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-[11px] text-zinc-500 py-1">
                                {isArabic
                                  ? 'جميع أيام الأسبوع الـ 7 مشمولة دون استثناء.'
                                  : 'All 7 weekdays are included (no weekday restriction).'}
                              </div>
                            )}

                            {/* Stepper: Every N weeks (default 1, range 1-12, anchored to the rule's start week) */}
                            <div className="pt-2.5 border-t border-zinc-800/60 flex items-center justify-between gap-2">
                              <div>
                                <div className="text-xs font-semibold text-zinc-200">
                                  {isArabic ? 'تكرار كل (بالأسابيع)' : 'Repeat Every (Weeks)'}
                                </div>
                                <div className="text-[10px] text-zinc-500">
                                  {isArabic
                                    ? `مرتبط ببداية الأسبوع المحدد (${date})`
                                    : `Anchored to start week (${date})`}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl p-1 shrink-0">
                                <button
                                  type="button"
                                  disabled={intervalWeeks <= 1}
                                  onClick={() => setIntervalWeeks((prev) => Math.max(1, prev - 1))}
                                  className="w-7 h-7 rounded-lg bg-zinc-950 text-zinc-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center font-bold text-sm transition cursor-pointer"
                                  title={isArabic ? 'تقليل الأسابيع' : 'Decrease weeks'}
                                >
                                  -
                                </button>
                                <span className="font-mono text-xs font-bold text-blue-400 min-w-[55px] text-center">
                                  {intervalWeeks} {isArabic ? (intervalWeeks === 1 ? 'أسبوع' : intervalWeeks === 2 ? 'أسبوعين' : 'أسابيع') : (intervalWeeks === 1 ? 'week' : 'weeks')}
                                </span>
                                <button
                                  type="button"
                                  disabled={intervalWeeks >= 12}
                                  onClick={() => setIntervalWeeks((prev) => Math.min(12, prev + 1))}
                                  className="w-7 h-7 rounded-lg bg-zinc-950 text-zinc-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center font-bold text-sm transition cursor-pointer"
                                  title={isArabic ? 'زيادة الأسابيع' : 'Increase weeks'}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Tab 2: Month days */}
                        {advancedTab === 'month_days' && (
                          <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-2.5">
                            {/* Toggle: Filter by specific month days (OFF by default) */}
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-zinc-300">
                                {isArabic ? 'تحديد أيام معينة من الشهر' : 'Filter by specific month days'}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = !useMonthDayFilter;
                                  setUseMonthDayFilter(next);
                                  if (next && selectedDaysOfMonth.length === 0) {
                                    setSelectedDaysOfMonth([1]);
                                  }
                                }}
                                className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                                  useMonthDayFilter ? 'bg-blue-600 justify-end' : 'bg-zinc-800 justify-start'
                                }`}
                              >
                                <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                              </button>
                            </div>

                            {useMonthDayFilter ? (
                              <div className="space-y-2 pt-1 border-t border-zinc-800/60">
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="text-zinc-400">
                                    {isArabic
                                      ? `تم اختيار ${selectedDaysOfMonth.length} من 31 يوماً`
                                      : `${selectedDaysOfMonth.length} of 31 days selected`}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={selectAllDaysOfMonth}
                                      className="text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                                    >
                                      {isArabic ? 'تحديد الكل (1–31)' : 'Select All (1–31)'}
                                    </button>
                                    <span className="text-zinc-600">•</span>
                                    <button
                                      type="button"
                                      onClick={clearDaysOfMonth}
                                      className="text-zinc-400 hover:text-zinc-200 font-semibold cursor-pointer"
                                    >
                                      {isArabic ? 'مسح' : 'Clear'}
                                    </button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-7 gap-1">
                                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
                                    const isSel = selectedDaysOfMonth.includes(d);
                                    return (
                                      <button
                                        key={d}
                                        type="button"
                                        onClick={() => toggleDayOfMonth(d)}
                                        className={`py-1.5 text-[11px] font-mono font-bold rounded-lg transition cursor-pointer ${
                                          isSel
                                            ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400/40'
                                            : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'
                                        }`}
                                      >
                                        {d}
                                      </button>
                                    );
                                  })}
                                </div>

                                <div className="text-[10px] text-zinc-500 leading-tight pt-1">
                                  {isArabic
                                    ? '* في الأشهر الأقصر، تُنفّذ أيام 29 و30 و31 تلقائياً في آخر يوم من ذلك الشهر.'
                                    : '* In shorter months, days 29, 30, and 31 automatically execute on the last day of the month.'}
                                </div>

                                {selectedDaysOfMonth.length === 0 && (
                                  <div className="text-[11px] text-amber-400/90 font-medium text-center py-1">
                                    {isArabic
                                      ? '⚠️ يرجى اختيار يوم واحد على الأقل من أيام الشهر'
                                      : '⚠️ Please select at least one day of the month'}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-[11px] text-zinc-500 py-1">
                                {isArabic
                                  ? 'جميع أيام الشهر مفعلة (لن يتم حظر أي يوم من الشهر).'
                                  : 'All month days are allowed (no month-day restriction).'}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Tab 3: Times daily */}
                        {advancedTab === 'times_daily' && (
                          <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-3">
                            {/* Section 1: Default Time(s) */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="text-xs font-semibold text-zinc-200 block">
                                    {isArabic ? 'التوقيت الافتراضي' : 'Default Time(s)'}
                                  </span>
                                  <span className="text-[10px] text-zinc-500 block">
                                    {isArabic
                                      ? 'يُطبّق على جميع الأيام المجدولة التي ليس لها توقيت مخصص'
                                      : 'Applies to all active days without a custom override'}
                                  </span>
                                </div>
                                <span className="text-[10px] font-mono text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                                  {timesOfDay.length} {isArabic ? 'أوقات' : 'slot(s)'}
                                </span>
                              </div>

                              <div className="space-y-1.5">
                                {timesOfDay.map((tm, idx) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <div className="w-6 text-[11px] font-mono text-zinc-500 text-center">
                                      #{idx + 1}
                                    </div>
                                    <input
                                      type="time"
                                      value={tm}
                                      onChange={(e) => updateTimeSlot(idx, e.target.value)}
                                      className="flex-1 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs font-mono focus:outline-none focus:border-blue-500"
                                    />
                                    {timesOfDay.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => removeTimeSlot(idx)}
                                        className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition cursor-pointer"
                                        title={isArabic ? 'حذف هذا الوقت' : 'Remove time'}
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                ))}

                                {timesOfDay.length < 5 && (
                                  <button
                                    type="button"
                                    onClick={addTimeSlot}
                                    className="w-full py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-blue-500/50 text-xs font-semibold text-blue-400 hover:text-blue-300 cursor-pointer flex items-center justify-center gap-1.5 transition"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>{isArabic ? 'إضافة وقت افتراضي إضافي' : 'Add default time'}</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Section 2: Custom Times for Specific Days */}
                            <div className="pt-2.5 border-t border-zinc-800/70 space-y-2.5">
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="text-xs font-semibold text-zinc-200 block">
                                    {isArabic ? 'تخصيص توقيت لأيام محددة' : 'Custom Times for Specific Days'}
                                  </span>
                                  <span className="text-[10px] text-zinc-500 block">
                                    {isArabic
                                      ? 'تحديد أوقات مخصصة لأيام معينة من الأسبوع أو الشهر'
                                      : 'Set custom execution times for specific weekdays or month days'}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setHasCustomTimes(!hasCustomTimes)}
                                  className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center shrink-0 ${
                                    hasCustomTimes ? 'bg-blue-600 justify-end' : 'bg-zinc-800 justify-start'
                                  }`}
                                >
                                  <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                                </button>
                              </div>

                              {hasCustomTimes ? (
                                <div className="space-y-2.5 pt-1">
                                  {/* Day Override Selector Dropdown */}
                                  {(availableWeekdayOverrides.length > 0 || availableMonthDayOverrides.length > 0) && (
                                    <div className="flex items-center gap-2">
                                      <select
                                        value={selectedDayOverrideToAdd}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          if (!val) return;
                                          if (val.startsWith('w:')) {
                                            addDayOverride('weekday', Number(val.slice(2)));
                                          } else if (val.startsWith('m:')) {
                                            addDayOverride('month_day', Number(val.slice(2)));
                                          }
                                          setSelectedDayOverrideToAdd('');
                                        }}
                                        className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                                      >
                                        <option value="">
                                          {isArabic ? '+ اختر يوماً لتخصيص توقيت له...' : '+ Add custom time for a specific day...'}
                                        </option>
                                        {availableWeekdayOverrides.length > 0 && (
                                          <optgroup label={isArabic ? 'أيام الأسبوع' : 'Weekdays'}>
                                            {availableWeekdayOverrides.map((d) => (
                                              <option key={`w:${d}`} value={`w:${d}`}>
                                                {isArabic ? weekDaysMap[d].labelAr : weekDaysMap[d].labelEn}
                                              </option>
                                            ))}
                                          </optgroup>
                                        )}
                                        {availableMonthDayOverrides.length > 0 && (
                                          <optgroup label={isArabic ? 'أيام الشهر' : 'Month days'}>
                                            {availableMonthDayOverrides.map((d) => (
                                              <option key={`m:${d}`} value={`m:${d}`}>
                                                {isArabic ? `يوم ${d}` : `Day ${d}`}
                                              </option>
                                            ))}
                                          </optgroup>
                                        )}
                                      </select>
                                    </div>
                                  )}

                                  {/* List of active day overrides */}
                                  {Object.keys(weekdayTimes).length === 0 && Object.keys(monthDayTimes).length === 0 ? (
                                    <div className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/60 text-center text-[11px] text-zinc-500">
                                      {isArabic
                                        ? 'لم تتم إضافة أي أيام مخصصة بعد. اختر يوماً من القائمة أعلاه لتعيين توقيت مخصص له.'
                                        : 'No custom day overrides added yet. Select a day from the dropdown above to customize its times.'}
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      {/* Weekday overrides */}
                                      {Object.entries(weekdayTimes).map(([dStr, timesList]) => {
                                        const dNum = Number(dStr);
                                        const dayInfo = weekDaysMap[dNum] || { labelEn: `Day ${dNum}`, labelAr: `يوم ${dNum}` };
                                        return (
                                          <div
                                            key={`weekday-${dNum}`}
                                            className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2"
                                          >
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-1.5">
                                                <span className="text-xs font-bold text-blue-300">
                                                  📅 {isArabic ? dayInfo.labelAr : dayInfo.labelEn}
                                                </span>
                                                <span className="text-[10px] text-zinc-500">
                                                  ({isArabic ? 'يوم من الأسبوع' : 'Weekday'})
                                                </span>
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() => removeDayOverride('weekday', dNum)}
                                                className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer transition"
                                                title={isArabic ? 'حذف هذا التخصيص' : 'Delete override'}
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                <span>{isArabic ? 'إلغاء التخصيص' : 'Remove'}</span>
                                              </button>
                                            </div>

                                            <div className="space-y-1.5">
                                              {timesList.map((tm, tIdx) => (
                                                <div key={tIdx} className="flex items-center gap-2">
                                                  <input
                                                    type="time"
                                                    value={tm}
                                                    onChange={(e) => updateTimeSlotInDay('weekday', dNum, tIdx, e.target.value)}
                                                    className="flex-1 px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:outline-none focus:border-blue-500"
                                                  />
                                                  <button
                                                    type="button"
                                                    onClick={() => removeTimeSlotFromDay('weekday', dNum, tIdx)}
                                                    className="p-1 rounded-md text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition cursor-pointer"
                                                    title={isArabic ? 'حذف هذا الوقت' : 'Remove time'}
                                                  >
                                                    <X className="w-3.5 h-3.5" />
                                                  </button>
                                                </div>
                                              ))}

                                              {timesList.length < 5 && (
                                                <button
                                                  type="button"
                                                  onClick={() => addTimeSlotToDay('weekday', dNum)}
                                                  className="w-full py-1 rounded-lg bg-zinc-950 border border-zinc-800/80 hover:border-blue-500/40 text-[11px] font-semibold text-blue-400 hover:text-blue-300 cursor-pointer flex items-center justify-center gap-1 transition"
                                                >
                                                  <Plus className="w-3 h-3" />
                                                  <span>{isArabic ? 'إضافة وقت لهذا اليوم' : 'Add time for this day'}</span>
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}

                                      {/* Month day overrides */}
                                      {Object.entries(monthDayTimes).map(([dStr, timesList]) => {
                                        const dNum = Number(dStr);
                                        return (
                                          <div
                                            key={`monthday-${dNum}`}
                                            className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2"
                                          >
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-1.5">
                                                <span className="text-xs font-bold text-emerald-300">
                                                  🗓️ {isArabic ? `يوم ${dNum}` : `Day ${dNum}`}
                                                </span>
                                                <span className="text-[10px] text-zinc-500">
                                                  ({isArabic ? 'يوم من الشهر' : 'Month day'})
                                                </span>
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() => removeDayOverride('month_day', dNum)}
                                                className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer transition"
                                                title={isArabic ? 'حذف هذا التخصيص' : 'Delete override'}
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                <span>{isArabic ? 'إلغاء التخصيص' : 'Remove'}</span>
                                              </button>
                                            </div>

                                            <div className="space-y-1.5">
                                              {timesList.map((tm, tIdx) => (
                                                <div key={tIdx} className="flex items-center gap-2">
                                                  <input
                                                    type="time"
                                                    value={tm}
                                                    onChange={(e) => updateTimeSlotInDay('month_day', dNum, tIdx, e.target.value)}
                                                    className="flex-1 px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:outline-none focus:border-blue-500"
                                                  />
                                                  <button
                                                    type="button"
                                                    onClick={() => removeTimeSlotFromDay('month_day', dNum, tIdx)}
                                                    className="p-1 rounded-md text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition cursor-pointer"
                                                    title={isArabic ? 'حذف هذا الوقت' : 'Remove time'}
                                                  >
                                                    <X className="w-3.5 h-3.5" />
                                                  </button>
                                                </div>
                                              ))}

                                              {timesList.length < 5 && (
                                                <button
                                                  type="button"
                                                  onClick={() => addTimeSlotToDay('month_day', dNum)}
                                                  className="w-full py-1 rounded-lg bg-zinc-950 border border-zinc-800/80 hover:border-emerald-500/40 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 cursor-pointer flex items-center justify-center gap-1 transition"
                                                >
                                                  <Plus className="w-3 h-3" />
                                                  <span>{isArabic ? 'إضافة وقت لهذا اليوم' : 'Add time for this day'}</span>
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  <div className="text-[10px] text-zinc-500 leading-tight pt-1">
                                    {isArabic
                                      ? '* الأولوية: تخصيص يوم الشهر > تخصيص يوم الأسبوع > التوقيت الافتراضي. في الأيام المخصصة، تُنفذ المعاملة في أوقات التخصيص فقط.'
                                      : '* Precedence: Month-day override > Weekday override > Default Time(s). Overridden days run ONLY at their custom times.'}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-[11px] text-zinc-500 py-0.5">
                                  {isArabic
                                    ? 'جميع الأيام النشطة تستخدم التوقيت الافتراضي أعلاه.'
                                    : 'All active scheduled days use the default execution time(s) above.'}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notes / Description Input (Directly BELOW Recurring Toggle) */}
          <div className="relative">
            <textarea
              ref={noteTextareaRef}
              rows={1}
              dir="auto"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                const el = e.target;
                el.style.height = 'auto';
                el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
              }}
              placeholder={t('addNotes')}
              className={`w-full ${type === 'expense' ? 'pl-4 pr-11 rtl:pl-11 rtl:pr-4' : 'px-4'} py-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition resize-none overflow-y-auto leading-relaxed`}
              style={{ maxHeight: '144px' }}
            />
            {type === 'expense' && (
              <button
                type="button"
                disabled={isClassifyingPool}
                onClick={handleClassifyWithAI}
                title={isArabic ? 'تصنيف بحوض الميزانية المناسب بالذكاء الاصطناعي' : 'Classify into budget pool with AI'}
                className="absolute right-2.5 rtl:right-auto rtl:left-2.5 top-2.5 p-1.5 rounded-xl text-indigo-400 hover:text-indigo-300 hover:bg-zinc-800 transition cursor-pointer disabled:opacity-50"
              >
                <Sparkles className={`w-4 h-4 ${isClassifyingPool ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>

          {/* Budget Pool Selector for Expense Transactions (4 Standardized Pools) */}
          {type === 'expense' && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-xs font-semibold text-zinc-400">
                  {t('budgetPoolLabel')}
                </span>
                <button
                  type="button"
                  disabled={isClassifyingPool}
                  onClick={handleClassifyWithAI}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition cursor-pointer"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isClassifyingPool ? 'animate-spin' : ''}`} />
                  <span>
                    {isClassifyingPool ? t('classifyingPool') : t('classifyWithAIBtn')}
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    userManuallyPickedPoolRef.current = true;
                    setBudgetPool('daily');
                  }}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer min-w-0 ${
                    budgetPool === 'daily'
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span className="shrink-0">🛒</span>
                  <span className="truncate">{t('poolDaily')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    userManuallyPickedPoolRef.current = true;
                    setBudgetPool('fixed');
                  }}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer min-w-0 ${
                    budgetPool === 'fixed'
                      ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 shadow'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span className="shrink-0">🧾</span>
                  <span className="truncate">{t('poolFixed')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    userManuallyPickedPoolRef.current = true;
                    setBudgetPool('outings');
                  }}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer min-w-0 ${
                    budgetPool === 'outings'
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span className="shrink-0">☕</span>
                  <span className="truncate">{t('poolOutings')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    userManuallyPickedPoolRef.current = true;
                    setBudgetPool('oneoff');
                  }}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer min-w-0 ${
                    budgetPool === 'oneoff'
                      ? 'bg-sky-500/20 border-sky-500/50 text-sky-300 shadow'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span className="shrink-0">✨</span>
                  <span className="truncate">{t('poolOneOff')}</span>
                </button>
              </div>
              {budgetPool === 'oneoff' && (
                <div className="text-[11px] text-sky-300/90 px-1 pt-0.5">
                  {t('poolOneOffHint')}
                </div>
              )}
            </div>
          )}

          {/* Salary Confirmation Toggle for Income Transactions */}
          {type === 'income' && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setIsSalary(!isSalary)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-medium transition cursor-pointer ${
                  isSalary
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">💼</span>
                  <div className="text-left rtl:text-right">
                    <div className="font-semibold text-white">
                      {isArabic ? 'هل هذا راتبك الشهري؟' : 'Is this your regular salary?'}
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      {isArabic
                        ? 'يساعد في ضبط بداية دورة الميزانية الذكية وتوزيع الأحواض'
                        : 'Helps auto-align the Smart Budget cycle & 4-pool allocation'}
                    </div>
                  </div>
                </div>
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center border transition ${
                    isSalary
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'border-zinc-700 bg-zinc-800 text-transparent'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Fixed Bottom Dock Container (Category Bar Pinned Above Keypad, with safe-area & visualViewport) */}
        <div
          data-keypad="true"
          className="border-t border-zinc-800/80 bg-zinc-950 px-5 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] shrink-0 z-10 shadow-[0_-8px_20px_rgba(0,0,0,0.5)]"
        >
          {/* Sticky Category Selector Row (Pinned Directly Above Keypad, Hidden for Transfer) */}
          {type !== 'transfer' && (
            <div className="pb-2">
              <div className="flex items-center justify-between mb-1 px-0.5">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  {settings.language === 'ar' ? 'التصنيف' : 'Category'}
                </span>
                {!isSharedMode && (
                  <button
                    type="button"
                    onClick={() => setShowCategoryDirectory(true)}
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-blue-600/20 border border-blue-500/40 text-[11px] font-bold text-blue-400 hover:text-blue-300 hover:bg-blue-600/30 transition shrink-0 active:scale-95 cursor-pointer"
                  >
                    <LayoutGrid className="w-3 h-3" />
                    <span>{settings.language === 'ar' ? 'عرض الكل' : 'Show All'}</span>
                  </button>
                )}
              </div>

              {/* Horizontally scrollable row of Category pills */}
              <div
                data-category-scroll="true"
                className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none overscroll-contain touch-pan-x"
              >
                {availableCategories.map((cat) => {
                  const isSelected = cat.id === selectedCategory?.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setCategoryId(cat.id);
                        if (type === 'income' && (cat.name.toLowerCase().includes('salary') || cat.name.includes('راتب') || cat.name.includes('مرتب'))) {
                          setIsSalary(true);
                        }
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30 ring-1 ring-blue-400/40'
                          : 'bg-zinc-900 border border-zinc-800/90 text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      <span className="text-base">{cat.icon}</span>
                      <span className="whitespace-nowrap">{cat.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Keypad */}
          <Numpad
            value={type === 'transfer' && activeKeypadTarget === 'fee' ? manualFeeStr : amountStr}
            onChange={type === 'transfer' && activeKeypadTarget === 'fee' ? setManualFeeStr : setAmountStr}
            lang={settings.language}
          />

          {/* Validation warning hint when active recurring filter has 0 days/times selected */}
          {isRecurring && isAdvancedSchedule && isFilterEmpty && (
            <div className="pt-2 text-center">
              <span className="text-[11px] text-amber-400 font-semibold px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 inline-block">
                {filterEmptyHint}
              </span>
            </div>
          )}

          {/* Full-width Blue Save / Update Transaction Button */}
          <div className="pt-2">
            <button
              type="button"
              disabled={!canSave}
              onClick={handleSave}
              className={`w-full py-3.5 rounded-full font-bold text-sm transition shadow-lg ${
                canSave
                  ? 'bg-blue-600 hover:bg-blue-500 active:scale-98 text-white shadow-blue-900/40 cursor-pointer'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-60'
              }`}
            >
              {editingTx || editingRecurring ? t('updateTransaction') : t('saveTransaction')}
            </button>
          </div>
        </div>
      </div>

      {/* Savings / Investment Withdrawal 3-Choice Prompt Modal */}
      {showWithdrawalPrompt && (
        <div
          role="dialog"
          className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={(e) => {
            e.stopPropagation();
            setShowWithdrawalPrompt(false);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            dir={isArabic ? 'rtl' : 'ltr'}
            className="w-full max-w-sm rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl p-5 space-y-4 text-white"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-amber-400">
                <ShieldAlert className="w-5 h-5 shrink-0" />
                <h3 className="text-base font-bold text-white">
                  {t('savingsWithdrawalPromptTitle')}
                </h3>
              </div>
              <p className="text-xs text-zinc-400">
                {t('savingsWithdrawalPromptDesc')}
              </p>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setSavingsWithdrawalChoice('emergency_expense');
                  executeSave('emergency_expense');
                }}
                className="w-full text-left rtl:text-right p-3 rounded-2xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 transition cursor-pointer"
              >
                <div className="text-sm font-bold text-red-200">
                  {t('withdrawalChoiceEmergency')}
                </div>
                <div className="text-[11px] text-zinc-300 mt-0.5">
                  {t('withdrawalChoiceEmergencyDesc')}
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSavingsWithdrawalChoice('add_to_spending');
                  executeSave('add_to_spending');
                }}
                className="w-full text-left rtl:text-right p-3 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 transition cursor-pointer"
              >
                <div className="text-sm font-bold text-emerald-200">
                  {t('withdrawalChoiceSpending')}
                </div>
                <div className="text-[11px] text-zinc-300 mt-0.5">
                  {t('withdrawalChoiceSpendingDesc')}
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSavingsWithdrawalChoice('just_moving');
                  executeSave('just_moving');
                }}
                className="w-full text-left rtl:text-right p-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-blue-500/50 transition cursor-pointer"
              >
                <div className="text-sm font-bold text-white">
                  {t('withdrawalChoiceMoving')}
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  {t('withdrawalChoiceMovingDesc')}
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowWithdrawalPrompt(false)}
              className="w-full py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-900 transition cursor-pointer"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Recurring edit scope confirmation */}
      {pendingRecurringEdit && (
        <div
          role="dialog"
          className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={(e) => {
            e.stopPropagation();
            setPendingRecurringEdit(null);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            dir={isArabic ? 'rtl' : 'ltr'}
            className="w-full max-w-sm rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl p-5 space-y-4 text-white"
          >
            <div className="space-y-1">
              <h3 className="text-base font-bold">
                {isArabic ? 'تطبيق التعديلات على:' : 'Apply your changes to:'}
              </h3>
              <p className="text-xs text-zinc-400">
                {isArabic
                  ? 'اختر نطاق تطبيق التعديلات على هذه المعاملة المتكررة.'
                  : 'Choose how far these edits should reach for this recurring rule.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => confirmRecurringEdit('future')}
              className="w-full text-left rtl:text-right p-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-blue-500/50 transition cursor-pointer"
            >
              <div className="text-sm font-bold text-white">
                {isArabic ? 'المعاملات القادمة فقط' : 'Future occurrences only'}
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5">
                {isArabic
                  ? 'تحديث قالب القاعدة فقط، دون المساس بالمعاملات المسجلة سابقاً.'
                  : 'Updates the rule template only; past transactions stay untouched.'}
              </div>
            </button>

            <button
              type="button"
              onClick={() => confirmRecurringEdit('all')}
              className="w-full text-left rtl:text-right p-3 rounded-2xl bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/40 transition cursor-pointer"
            >
              <div className="text-sm font-bold text-blue-200">
                {isArabic ? 'المعاملات السابقة والقادمة' : 'Past & future occurrences'}
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5">
                {isArabic
                  ? 'تحديث القاعدة وجميع المعاملات المولّدة منها (' + linkedPastCount + ') مع إعادة حساب الأرصدة والمزامنة مع السحابة والمساحات المشتركة.'
                  : 'Updates the rule and all ' + linkedPastCount + ' transaction(s) generated from it, recalculates balances and syncs to the cloud backup and shared spaces.'}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setPendingRecurringEdit(null)}
              className="w-full py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-900 transition cursor-pointer"
            >
              {isArabic ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {/* Full-Screen Category Directory Modal with Search & Create */}
      <CategoryDirectoryModal
        isOpen={showCategoryDirectory}
        onClose={() => setShowCategoryDirectory(false)}
        selectedCategoryId={categoryId}
        initialType={type === 'income' ? 'income' : 'expense'}
        onSelectCategory={(cat) => {
          setCategoryId(cat.id);
          if (type === 'income' && (cat.name.toLowerCase().includes('salary') || cat.name.includes('راتب') || cat.name.includes('مرتب'))) {
            setIsSalary(true);
          }
          setShowCategoryDirectory(false);
        }}
      />
    </div>
  );
};
