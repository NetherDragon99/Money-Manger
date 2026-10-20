import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { X, ArrowDown, ArrowUp, ArrowLeftRight, Calendar, Clock, Plus, ChevronDown, LayoutGrid, RefreshCw } from 'lucide-react';
import { TransactionType, RecurringFrequency } from '../types';
import { formatDateToYYYYMMDD, formatTimeToHHMM, formatCurrency, formatFullDateTime } from '../utils/dateCycle';
import { calculateNextDueDate } from '../utils/recurring';
import { Numpad } from './Numpad';
import { MiniDateTimePicker } from './MiniDateTimePicker';
import { CategoryDirectoryModal } from './CategoryDirectoryModal';
import { getLocalizedCurrencySymbol } from '../utils/currencies';

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
    openAddCategoryModal,
    t,
    settings,
    defaultTxAccountId,
    defaultTxAmount,
    selectedAccountId,
  } = useApp();

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
  const [showCategoryDirectory, setShowCategoryDirectory] = useState<boolean>(false);
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [recurringFrequency, setRecurringFrequency] = useState<RecurringFrequency>('monthly');

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
    const handleOutside = () => setAccountDropdownOpen(null);
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [accountDropdownOpen]);

  // Clean Reset Rule & Initialize on Open / Edit
  useEffect(() => {
    if (!isAddTxModalOpen) {
      setAccountDropdownOpen(null);
      setShowDateTimePicker(false);
      return;
    }

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
    } else {
      // Clean Reset Rule: reset amount to 0 or defaultTxAmount, note to "", type to Expense
      setType('expense');
      setAmountStr(defaultTxAmount && defaultTxAmount > 0 ? defaultTxAmount.toString() : '0');
      const now = new Date();
      setDate(formatDateToYYYYMMDD(now));
      setHasTime(true);
      setTime(formatTimeToHHMM(now));
      setDescription('');
      const defaultAcc = defaultTxAccountId || selectedAccountId || (accounts[0] ? accounts[0].id : '');
      setAccountId(defaultAcc);
      // Destination account for transfers: always auto-select a valid different account
      const otherAcc = accounts.find((a) => a.id !== defaultAcc);
      setToAccountId(otherAcc ? otherAcc.id : '');
      // Select first matching category
      const defaultCat = categories.find((c) => c.type === 'expense');
      setCategoryId(defaultCat ? defaultCat.id : '');
      setIsRecurring(false);
      setRecurringFrequency('monthly');
    }
  }, [isAddTxModalOpen, editingTx, accounts, categories, defaultTxAccountId, defaultTxAmount, selectedAccountId]);

  // When type changes, ensure valid category selection & Transfer Auto-Select destination
  useEffect(() => {
    if (type === 'transfer') {
      // Auto-select second available account if empty or same as source
      if (!toAccountId || toAccountId === accountId) {
        const destination = accounts.find((a) => a.id !== accountId);
        if (destination) {
          setToAccountId(destination.id);
        }
      }
    } else {
      const matchCat = categories.find((c) => c.type === type);
      if (matchCat && (!categoryId || !categories.find((c) => c.id === categoryId && c.type === type))) {
        setCategoryId(matchCat.id);
      }
    }
  }, [type, accounts, accountId, toAccountId, categories, categoryId]);

  // Filtered categories for the active type
  const availableCategories = useMemo(() => {
    return categories.filter((c) => c.type === type);
  }, [categories, type]);

  const selectedCategory = useMemo(() => {
    return categories.find((c) => c.id === categoryId) || availableCategories[0];
  }, [categories, categoryId, availableCategories]);

  const selectedAccount = useMemo(() => {
    return accounts.find((a) => a.id === accountId) || accounts[0];
  }, [accounts, accountId]);

  const selectedToAccount = useMemo(() => {
    return accounts.find((a) => a.id === toAccountId) || accounts.find((a) => a.id !== accountId);
  }, [accounts, toAccountId, accountId]);

  // Smart Update Rule: In Edit mode, keep Update button disabled until at least one field is modified
  const isModified = useMemo(() => {
    if (!editingTx) return true;
    const numAmt = parseFloat(amountStr) || 0;
    if (editingTx.type !== type) return true;
    if (Math.abs(editingTx.amount - numAmt) > 0.0001) return true;
    if (editingTx.date !== date) return true;
    if ((editingTx.time || '') !== (hasTime ? time : '')) return true;
    if (editingTx.accountId !== accountId) return true;
    if ((editingTx.toAccountId || '') !== (type === 'transfer' ? toAccountId : '')) return true;
    if ((editingTx.categoryId || '') !== (type === 'transfer' ? '' : categoryId)) return true;
    if ((editingTx.description || '') !== description.trim()) return true;
    return false;
  }, [editingTx, type, amountStr, date, hasTime, time, accountId, toAccountId, categoryId, description]);

  const numericAmount = parseFloat(amountStr) || 0;
  const isTransferSameAccount = type === 'transfer' && accountId === toAccountId;
  const canSave = numericAmount > 0 && !isTransferSameAccount && isModified;

  if (!isAddTxModalOpen) return null;

  const handleSave = () => {
    if (!canSave) return;

    const payload = {
      type,
      amount: numericAmount,
      date,
      time: hasTime ? time : '',
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : undefined,
      categoryId: type === 'transfer' ? undefined : selectedCategory?.id,
      categoryName: type === 'transfer' ? undefined : selectedCategory?.name,
      categoryIcon: type === 'transfer' ? undefined : selectedCategory?.icon,
      description: description.trim(),
    };

    if (editingTx) {
      updateTransaction({
        ...editingTx,
        ...payload,
      });
    } else {
      addTransaction(payload);
      if (isRecurring) {
        addRecurringTransaction({
          type,
          amount: numericAmount,
          description: description.trim(),
          accountId,
          toAccountId: type === 'transfer' ? toAccountId : undefined,
          categoryId: type === 'transfer' ? undefined : selectedCategory?.id,
          categoryName: type === 'transfer' ? undefined : selectedCategory?.name,
          categoryIcon: type === 'transfer' ? undefined : selectedCategory?.icon,
          frequency: recurringFrequency,
          startDate: date,
          nextDueDate: calculateNextDueDate(date, recurringFrequency),
          autoProcess: true,
        });
      }
    }
    closeAddTxModal();
  };

  const currencySymbol = getLocalizedCurrencySymbol(settings.currencySymbol, settings.language);

  return (
    <div
      onClick={handleAnimatedClose}
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md p-0 sm:p-4 transition-all duration-200 ${
        isClosing ? 'modal-backdrop-closing' : 'modal-backdrop-anim'
      }`}
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
          setAccountDropdownOpen(null);
        }}
        className={`w-full max-w-lg max-h-[96vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-zinc-950/95 backdrop-blur-2xl border border-zinc-800/80 shadow-2xl overflow-hidden text-white transition-all duration-200 ${
          isClosing ? 'modal-container-closing' : 'modal-container-anim'
        }`}
      >
        {/* Top Bar: Close X & 3-Way Type Pill Toggle */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/80">
          <button
            type="button"
            onClick={handleAnimatedClose}
            className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition"
          >
            <X className="w-5 h-5" />
          </button>

          {/* 3-Way Type Pill Toggle */}
          <div className="flex items-center p-1 rounded-full bg-zinc-900 border border-zinc-800">
            <button
              type="button"
              onClick={() => setType('income')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition ${
                type === 'income'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ArrowDown className="w-3.5 h-3.5 text-emerald-300" />
              <span>{t('income')}</span>
            </button>
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition ${
                type === 'expense'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ArrowUp className="w-3.5 h-3.5 text-red-300" />
              <span>{t('expense')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setType('transfer');
                const destination = accounts.find((a) => a.id !== accountId);
                if (destination) {
                  setToAccountId(destination.id);
                }
              }}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition ${
                type === 'transfer'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-blue-300" />
              <span>{t('transfer')}</span>
            </button>
          </div>

          <div className="w-9" /> {/* Spacer */}
        </div>

        {/* Scrollable Upper Section */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
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
                  {amountStr}
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
                onClick={(e) => {
                  e.stopPropagation();
                  setAccountDropdownOpen(accountDropdownOpen === 'single' ? null : 'single');
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{selectedAccount?.icon || '💵'}</span>
                  <div className="text-left">
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
                  onClick={(e) => e.stopPropagation()}
                  className="absolute z-30 left-0 right-0 mt-1 rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl p-1.5 max-h-52 overflow-y-auto"
                >
                  {accounts.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => {
                        setAccountId(acc.id);
                        setAccountDropdownOpen(null);
                      }}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition ${
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
                  {/* The very last item inside this dropdown menu MUST be "+ Add New Account" */}
                  <button
                    type="button"
                    onClick={() => {
                      setAccountDropdownOpen(null);
                      openAddAccountModal();
                    }}
                    className="w-full flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold text-blue-400 hover:bg-blue-500/10 border-t border-zinc-800 mt-1 transition"
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
                    onClick={(e) => {
                      e.stopPropagation();
                      setAccountDropdownOpen(accountDropdownOpen === 'from' ? null : 'from');
                    }}
                    className="w-full flex flex-col p-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-left"
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
                      onClick={(e) => e.stopPropagation()}
                      className="absolute z-30 left-0 w-48 mt-1 rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl p-1.5 max-h-48 overflow-y-auto"
                    >
                      {accounts.map((acc) => (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => {
                            setAccountId(acc.id);
                            setAccountDropdownOpen(null);
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs ${
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
                  className="p-2.5 rounded-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-blue-400 mt-4 active:scale-90 transition"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                </button>

                {/* To Account */}
                <div className="relative">
                  <span className="block text-[11px] text-zinc-400 mb-1">{t('toAccount')}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAccountDropdownOpen(accountDropdownOpen === 'to' ? null : 'to');
                    }}
                    className="w-full flex flex-col p-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-left"
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
                      onClick={(e) => e.stopPropagation()}
                      className="absolute z-30 right-0 w-48 mt-1 rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl p-1.5 max-h-48 overflow-y-auto"
                    >
                      {accounts.map((acc) => {
                        const isSameAsFrom = acc.id === accountId;
                        return (
                          <button
                            key={acc.id}
                            type="button"
                            disabled={isSameAsFrom}
                            onClick={() => {
                              setToAccountId(acc.id);
                              setAccountDropdownOpen(null);
                            }}
                            className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs ${
                              isSameAsFrom
                                ? 'opacity-30 cursor-not-allowed text-zinc-500'
                                : acc.id === toAccountId
                                ? 'bg-blue-600/20 text-white'
                                : 'text-zinc-300 hover:bg-zinc-800'
                            }`}
                          >
                            <span className="truncate">{acc.icon} {acc.name}</span>
                            {isSameAsFrom && <span className="text-[9px] text-red-400">Same</span>}
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

          {/* Notes / Description Input */}
          <div>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('addNotes')}
              className="w-full px-4 py-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          {/* Recurring Schedule Switch & Frequency Selection */}
          {!editingTx && (
            <div className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <RefreshCw className={`w-4 h-4 ${isRecurring ? 'text-blue-400' : 'text-zinc-500'}`} />
                  <span className="text-xs font-semibold text-zinc-300">
                    {settings.language === 'ar' ? 'معاملة دورية متكررة' : 'Make this a Recurring Transaction'}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 bg-zinc-800 border-zinc-700 cursor-pointer"
                />
              </label>

              {/* Accordion smooth expansion */}
              <div className={`accordion-wrapper ${isRecurring ? 'open' : 'closed'}`}>
                <div className="accordion-inner pt-2 border-t border-zinc-800/60">
                  <span className="block text-[11px] text-zinc-400 mb-1.5 font-medium">
                    {settings.language === 'ar' ? 'دورة التكرار' : 'Repeat Frequency'}
                  </span>
                  <div className="grid grid-cols-5 gap-1">
                    {(['daily', 'weekly', 'biweekly', 'monthly', 'yearly'] as RecurringFrequency[]).map((freq) => (
                      <button
                        key={freq}
                        type="button"
                        onClick={() => setRecurringFrequency(freq)}
                        className={`py-1.5 text-[10px] font-bold rounded-lg capitalize transition cursor-pointer ${
                          recurringFrequency === freq
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                        }`}
                      >
                        {freq === 'biweekly' ? '2-Wk' : freq}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Category Selector: Completely HIDE for Transfer */}
          {type !== 'transfer' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  Category
                </span>
                {/* "Show All" button opens full Categories Directory modal */}
                <button
                  type="button"
                  onClick={() => setShowCategoryDirectory(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600/20 border border-blue-500/40 text-xs font-bold text-blue-400 hover:text-blue-300 hover:bg-blue-600/30 transition shrink-0 active:scale-95"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>{settings.language === 'ar' ? 'عرض الكل' : 'Show All'}</span>
                </button>
              </div>

              {/* Horizontally scrollable row of Category pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none overscroll-contain">
                {availableCategories.map((cat) => {
                  const isSelected = cat.id === selectedCategory?.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategoryId(cat.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shrink-0 transition ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
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
        </div>

        {/* Custom In-App Numpad & Save (Always Visible at Bottom) */}
        <div className="border-t border-zinc-800/80 bg-zinc-950 px-5 pt-1 pb-4">
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
              {editingTx ? t('updateTransaction') : t('saveTransaction')}
            </button>
          </div>
        </div>
      </div>

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
