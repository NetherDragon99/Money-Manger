import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { navigateBack } from '../context/NavigationContext';
import { X, ArrowDown, ArrowUp, ArrowLeftRight, Calendar, Clock, Plus, ChevronDown, LayoutGrid, RefreshCw } from 'lucide-react';
import { TransactionType, RecurringFrequency, RecurringTransaction } from '../types';
import { formatDateToYYYYMMDD, formatTimeToHHMM, formatCurrency, formatDisplayNumber } from '../utils/dateCycle';
import { calculateNextDueDate } from '../utils/recurring';
import { Numpad } from './Numpad';
import { MiniDateTimePicker } from './MiniDateTimePicker';
import { CategoryDirectoryModal } from './CategoryDirectoryModal';
import { getLocalizedCurrencySymbol } from '../utils/currencies';

const TYPES: TransactionType[] = ['income', 'expense', 'transfer'];

export const TransactionModal: React.FC = () => {
  const {
    isAddTxModalOpen,
    editingTx,
    closeAddTxModal,
    accounts,
    categories,
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
  } = useApp();

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
  const [showDateTimePicker, setShowDateTimePicker] = useState<boolean>(false);
  const [pickerTab, setPickerTab] = useState<'date' | 'time'>('date');
  const [accountDropdownOpen, setAccountDropdownOpen] = useState<'single' | 'from' | 'to' | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [showCategoryDirectory, setShowCategoryDirectory] = useState<boolean>(false);
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [recurringFrequency, setRecurringFrequency] = useState<RecurringFrequency>('monthly');
  const [pendingRecurringEdit, setPendingRecurringEdit] = useState<RecurringTransaction | null>(null);

  // Advanced Recurring Schedule State
  const [isAdvancedSchedule, setIsAdvancedSchedule] = useState<boolean>(false);
  const [advancedScheduleType, setAdvancedScheduleType] = useState<'weekly_days' | 'monthly_days' | 'multiple_times_daily'>('weekly_days');
  const [selectedDaysOfWeek, setSelectedDaysOfWeek] = useState<number[]>([1]); // default Mon
  const [unifiedWeeklyTime, setUnifiedWeeklyTime] = useState<string>('09:00');
  const [customWeeklyTimes, setCustomWeeklyTimes] = useState<Record<number, string>>({});
  const [isCustomDayTimes, setIsCustomDayTimes] = useState<boolean>(false);
  const [selectedDaysOfMonth, setSelectedDaysOfMonth] = useState<number[]>([1]);
  const [monthlyTime, setMonthlyTime] = useState<string>('09:00');
  const [multipleTimesDaily, setMultipleTimesDaily] = useState<string[]>(['09:00', '18:00']);

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
      prev.includes(d) ? (prev.length > 1 ? prev.filter((x) => x !== d) : prev) : [...prev, d].sort((a, b) => a - b)
    );
  };

  const toggleDayOfMonth = (d: number) => {
    setSelectedDaysOfMonth((prev) =>
      prev.includes(d) ? (prev.length > 1 ? prev.filter((x) => x !== d) : prev) : [...prev, d].sort((a, b) => a - b)
    );
  };

  const addMultiTime = () => {
    if (multipleTimesDaily.length < 5) {
      setMultipleTimesDaily((prev) => [...prev, '12:00']);
    }
  };

  const removeMultiTime = (idx: number) => {
    if (multipleTimesDaily.length > 1) {
      setMultipleTimesDaily((prev) => prev.filter((_, i) => i !== idx));
    }
  };

  const updateMultiTime = (idx: number, val: string) => {
    setMultipleTimesDaily((prev) => {
      const copy = [...prev];
      copy[idx] = val;
      return copy;
    });
  };

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
      closeAddTxModal();
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
    if (!isAddTxModalOpen) {
      prevIsOpenRef.current = false;
      prevEditingTxIdRef.current = null;
      setAccountDropdownOpen(null);
      setShowDateTimePicker(false);
      setPendingRecurringEdit(null);
      return;
    }

    const isNewlyOpened = !prevIsOpenRef.current;
    const currentTxId = editingTx ? editingTx.id : editingRecurring ? 'rec:' + editingRecurring.id : null;
    const isDifferentTx = currentTxId !== prevEditingTxIdRef.current;

    if (!isNewlyOpened && !isDifferentTx) {
      return;
    }

    prevIsOpenRef.current = true;
    prevEditingTxIdRef.current = currentTxId;

    if (editingTx) {
      setType(editingTx.type);
      setAmountStr(editingTx.amount.toString());
      setDate(editingTx.date);
      setHasTime(Boolean(editingTx.time));
      setTime(editingTx.time || formatTimeToHHMM(new Date()));
      setAccountId(editingTx.accountId);
      setToAccountId(editingTx.toAccountId || '');
      setCategoryId(editingTx.categoryId || '');
      setDescription(editingTx.description || '');
      setIsRecurring(false);
      setRecurringFrequency('monthly');
      setIsAdvancedSchedule(false);
    } else if (editingRecurring) {
      const r = editingRecurring;
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
      setIsRecurring(true);
      setRecurringFrequency(r.frequency);
      const adv = r.advancedSchedule;
      if (adv && adv.isAdvanced) {
        setIsAdvancedSchedule(true);
        setAdvancedScheduleType((adv.scheduleType as any) || 'weekly_days');
        setSelectedDaysOfWeek(adv.daysOfWeek && adv.daysOfWeek.length > 0 ? adv.daysOfWeek : [1]);
        setUnifiedWeeklyTime(adv.unifiedTime || r.startTime || '09:00');
        const hasCustom = Boolean(adv.customDayTimes && Object.keys(adv.customDayTimes).length > 0);
        setIsCustomDayTimes(hasCustom);
        setCustomWeeklyTimes(adv.customDayTimes || {});
        setSelectedDaysOfMonth(adv.daysOfMonth && adv.daysOfMonth.length > 0 ? adv.daysOfMonth : [1]);
        setMonthlyTime(adv.timeOfMonth || r.startTime || '09:00');
        setMultipleTimesDaily(adv.timesOfDay && adv.timesOfDay.length > 0 ? adv.timesOfDay : ['09:00', '18:00']);
      } else {
        setIsAdvancedSchedule(false);
      }
    } else {
      setType('expense');
      setAmountStr(defaultTxAmount && defaultTxAmount > 0 ? defaultTxAmount.toString() : '0');
      const now = new Date();
      setDate(formatDateToYYYYMMDD(now));
      setHasTime(true);
      setTime(formatTimeToHHMM(now));
      setDescription('');
      const defaultAcc = defaultTxAccountId || selectedAccountId || (accounts[0] ? accounts[0].id : '');
      setAccountId(defaultAcc);
      const otherAcc = accounts.find((a) => a.id !== defaultAcc);
      setToAccountId(otherAcc ? otherAcc.id : '');
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
      setIsRecurring(Boolean(defaultTxIsRecurring));
      setRecurringFrequency('monthly');
      setIsAdvancedSchedule(false);
    }
  }, [isAddTxModalOpen, editingTx?.id, editingRecurring?.id, defaultTxIsRecurring, settings.categoryOrder]);

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

  const handleTypeSelect = useCallback((newType: TransactionType) => {
    setType(newType);
    if (newType === 'transfer') {
      const destination = accounts.find((a) => a.id !== accountId);
      if (destination) {
        setToAccountId(destination.id);
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

  const buildAdvConfig = () =>
    isAdvancedSchedule
      ? {
          isAdvanced: true,
          scheduleType: advancedScheduleType,
          daysOfWeek: advancedScheduleType === 'weekly_days' ? selectedDaysOfWeek : undefined,
          unifiedTime: advancedScheduleType === 'weekly_days' && !isCustomDayTimes ? unifiedWeeklyTime : undefined,
          customDayTimes: advancedScheduleType === 'weekly_days' && isCustomDayTimes ? customWeeklyTimes : undefined,
          daysOfMonth: advancedScheduleType === 'monthly_days' ? selectedDaysOfMonth : undefined,
          timeOfMonth: advancedScheduleType === 'monthly_days' ? monthlyTime : undefined,
          timesOfDay: advancedScheduleType === 'multiple_times_daily' ? multipleTimesDaily : undefined,
        }
      : undefined;

  // Smart Update Rule: In Edit mode, keep Update button disabled until at least one field is modified
  const isModified = useMemo(() => {
    if (editingRecurring) {
      const r = editingRecurring;
      const amt = parseFloat(String(amountStr).replace(/,/g, '')) || 0;
      const origAdv = r.advancedSchedule && r.advancedSchedule.isAdvanced ? r.advancedSchedule : null;
      const curSig = JSON.stringify([
        type, amt, date, hasTime ? time : '09:00', accountId,
        type === 'transfer' ? toAccountId : '',
        type === 'transfer' ? '' : categoryId,
        description.trim(), recurringFrequency, buildAdvConfig() || null,
      ]);
      const origSig = JSON.stringify([
        r.type, r.amount, r.startDate, r.startTime || '09:00', r.accountId,
        r.toAccountId || '', r.categoryId || '', r.description || '', r.frequency, origAdv,
      ]);
      return curSig !== origSig;
    }
    if (!editingTx) return true;
    const numAmt = parseFloat(String(amountStr).replace(/,/g, '')) || 0;
    if (editingTx.type !== type) return true;
    if (Math.abs(editingTx.amount - numAmt) > 0.0001) return true;
    if (editingTx.date !== date) return true;
    if ((editingTx.time || '') !== (hasTime ? time : '')) return true;
    if (editingTx.accountId !== accountId) return true;
    if ((editingTx.toAccountId || '') !== (type === 'transfer' ? toAccountId : '')) return true;
    if ((editingTx.categoryId || '') !== (type === 'transfer' ? '' : categoryId)) return true;
    if ((editingTx.description || '') !== description.trim()) return true;
    return false;
  }, [
    editingTx, editingRecurring, type, amountStr, date, hasTime, time, accountId, toAccountId, categoryId, description,
    recurringFrequency, isAdvancedSchedule, advancedScheduleType, selectedDaysOfWeek, unifiedWeeklyTime,
    customWeeklyTimes, isCustomDayTimes, selectedDaysOfMonth, monthlyTime, multipleTimesDaily,
  ]);

  const numericAmount = parseFloat(String(amountStr).replace(/,/g, '')) || 0;
  const isTransferSameAccount = type === 'transfer' && accountId === toAccountId;
  const canSave = numericAmount > 0 && !isTransferSameAccount && isModified;

  if (!isAddTxModalOpen) return null;

  const handleSave = () => {
    if (!canSave) return;

    const finalAccountId = accountId || selectedAccount?.id || '';
    const finalToAccountId = type === 'transfer' ? (toAccountId || selectedToAccount?.id || '') : undefined;

    const payload = {
      type,
      amount: numericAmount,
      date,
      time: hasTime ? time : '',
      accountId: finalAccountId,
      toAccountId: finalToAccountId,
      categoryId: type === 'transfer' ? undefined : selectedCategory?.id,
      categoryName: type === 'transfer' ? undefined : selectedCategory?.name,
      categoryIcon: type === 'transfer' ? undefined : selectedCategory?.icon,
      description: description.trim(),
    };

    if (editingRecurring) {
      // Ask whether the edit applies to future occurrences only or to past & future ones
      setPendingRecurringEdit({
        ...editingRecurring,
        type,
        amount: numericAmount,
        description: description.trim(),
        accountId: finalAccountId,
        toAccountId: finalToAccountId,
        categoryId: type === 'transfer' ? undefined : selectedCategory?.id,
        categoryName: type === 'transfer' ? undefined : selectedCategory?.name,
        categoryIcon: type === 'transfer' ? undefined : selectedCategory?.icon,
        frequency: recurringFrequency,
        startDate: date,
        startTime: hasTime ? time : '09:00',
        advancedSchedule: buildAdvConfig(),
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
        });
      }
    }
    closeAddTxModal();
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

  const currencySymbol = getLocalizedCurrencySymbol(settings.currencySymbol, settings.language);

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
            <div className="flex items-center justify-center py-1">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 shadow-inner select-none">
                <span className={`text-3xl sm:text-4xl font-black ${
                  type === 'income' ? 'text-emerald-400' : type === 'expense' ? 'text-red-400' : 'text-blue-400'
                }`}>
                  {currencySymbol}
                </span>
                <span className="text-4xl sm:text-5xl font-mono font-black text-white tracking-tight">
                  {formatDisplayNumber(amountStr)}
                </span>
              </div>
            </div>

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
            </div>
          )}

          {/* Modern Responsive Recurring Transaction Toggle (Directly ABOVE Description) */}
          {!editingTx && (
            <div className="rounded-2xl bg-zinc-900/70 border border-zinc-800/80 p-2.5 transition-all shadow-sm">
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (!editingRecurring) setIsRecurring(!isRecurring);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (!editingRecurring) setIsRecurring(!isRecurring);
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
                        onClick={(e) => {
                          e.stopPropagation();
                          setRecurringFrequency(freq);
                          setIsAdvancedSchedule(false);
                        }}
                        className={`py-1.5 px-1 text-[10px] font-bold rounded-lg capitalize transition cursor-pointer text-center truncate ${
                          recurringFrequency === freq && !isAdvancedSchedule
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30 ring-1 ring-blue-400/50'
                            : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800/80 hover:bg-zinc-900'
                        }`}
                      >
                        {getFrequencyLabel(freq)}
                      </button>
                    ))}
                  </div>

                  {/* Advanced custom schedule */}
                  <div className="mt-2.5 pt-2.5 border-t border-zinc-800/60">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsAdvancedSchedule(!isAdvancedSchedule);
                      }}
                      className={'w-full flex items-center justify-between px-3 py-2 rounded-xl text-[11px] font-bold transition cursor-pointer border ' + (isAdvancedSchedule ? 'bg-blue-600/15 border-blue-500/40 text-blue-300' : 'bg-zinc-950 border-zinc-800/80 text-zinc-400 hover:text-white')}
                    >
                      <span>{isArabic ? 'جدول زمني متقدم' : 'Advanced schedule'}</span>
                      <span>{isAdvancedSchedule ? (isArabic ? 'مفعّل' : 'ON') : (isArabic ? 'متوقف' : 'OFF')}</span>
                    </button>

                    {isAdvancedSchedule && (
                      <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                        <div className="grid grid-cols-3 gap-1">
                          {([
                            ['weekly_days', isArabic ? 'أيام الأسبوع' : 'Weekdays'],
                            ['monthly_days', isArabic ? 'أيام الشهر' : 'Month days'],
                            ['multiple_times_daily', isArabic ? 'عدة مرات يومياً' : 'Times daily'],
                          ] as const).map(([key, label]) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setAdvancedScheduleType(key)}
                              className={'py-1.5 px-1 text-[10px] font-bold rounded-lg transition cursor-pointer truncate ' + (advancedScheduleType === key ? 'bg-blue-600 text-white' : 'bg-zinc-950 text-zinc-400 border border-zinc-800/80 hover:text-white')}
                            >
                              {label}
                            </button>
                          ))}
                        </div>

                        {advancedScheduleType === 'weekly_days' && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-7 gap-1">
                              {weekDaysMap.map((w) => (
                                <button
                                  key={w.day}
                                  type="button"
                                  onClick={() => toggleDayOfWeek(w.day)}
                                  className={'py-1.5 text-[10px] font-bold rounded-lg transition cursor-pointer ' + (selectedDaysOfWeek.includes(w.day) ? 'bg-blue-600 text-white' : 'bg-zinc-950 text-zinc-400 border border-zinc-800/80')}
                                >
                                  {isArabic ? w.labelAr : w.labelEn}
                                </button>
                              ))}
                            </div>
                            <label className="flex items-center gap-2 text-[11px] text-zinc-400 cursor-pointer">
                              <input type="checkbox" checked={isCustomDayTimes} onChange={(e) => setIsCustomDayTimes(e.target.checked)} />
                              <span>{isArabic ? 'وقت مختلف لكل يوم' : 'Custom time per day'}</span>
                            </label>
                            {isCustomDayTimes ? (
                              <div className="space-y-1">
                                {selectedDaysOfWeek.map((d) => (
                                  <div key={d} className="flex items-center justify-between text-[11px] text-zinc-300">
                                    <span>{isArabic ? weekDaysMap[d].labelAr : weekDaysMap[d].labelEn}</span>
                                    <input
                                      type="time"
                                      value={customWeeklyTimes[d] || unifiedWeeklyTime}
                                      onChange={(e) => setCustomWeeklyTimes((prev) => ({ ...prev, [d]: e.target.value }))}
                                      className="px-2 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-white text-xs"
                                    />
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <input
                                type="time"
                                value={unifiedWeeklyTime}
                                onChange={(e) => setUnifiedWeeklyTime(e.target.value)}
                                className="w-full px-2 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-white text-xs"
                              />
                            )}
                          </div>
                        )}

                        {advancedScheduleType === 'monthly_days' && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-7 gap-1">
                              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                                <button
                                  key={d}
                                  type="button"
                                  onClick={() => toggleDayOfMonth(d)}
                                  className={'py-1 text-[10px] font-bold rounded-md transition cursor-pointer ' + (selectedDaysOfMonth.includes(d) ? 'bg-blue-600 text-white' : 'bg-zinc-950 text-zinc-400 border border-zinc-800/80')}
                                >
                                  {d}
                                </button>
                              ))}
                            </div>
                            <input
                              type="time"
                              value={monthlyTime}
                              onChange={(e) => setMonthlyTime(e.target.value)}
                              className="w-full px-2 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-white text-xs"
                            />
                          </div>
                        )}

                        {advancedScheduleType === 'multiple_times_daily' && (
                          <div className="space-y-1.5">
                            {multipleTimesDaily.map((tm, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <input
                                  type="time"
                                  value={tm}
                                  onChange={(e) => updateMultiTime(idx, e.target.value)}
                                  className="flex-1 px-2 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-white text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeMultiTime(idx)}
                                  className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                            {multipleTimesDaily.length < 5 && (
                              <button
                                type="button"
                                onClick={addMultiTime}
                                className="w-full py-1.5 rounded-lg bg-zinc-950 border border-zinc-800/80 text-[11px] font-bold text-blue-400 hover:text-blue-300 cursor-pointer flex items-center justify-center gap-1"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>{isArabic ? 'إضافة وقت' : 'Add time'}</span>
                              </button>
                            )}
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
          <div>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('addNotes')}
              className="w-full px-4 py-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>
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
                <button
                  type="button"
                  onClick={() => setShowCategoryDirectory(true)}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-blue-600/20 border border-blue-500/40 text-[11px] font-bold text-blue-400 hover:text-blue-300 hover:bg-blue-600/30 transition shrink-0 active:scale-95 cursor-pointer"
                >
                  <LayoutGrid className="w-3 h-3" />
                  <span>{settings.language === 'ar' ? 'عرض الكل' : 'Show All'}</span>
                </button>
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
                      onClick={() => setCategoryId(cat.id)}
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
            value={amountStr}
            onChange={setAmountStr}
            lang={settings.language}
          />

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
          setShowCategoryDirectory(false);
        }}
      />
    </div>
  );
};
