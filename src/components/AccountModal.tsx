import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { X, Smile, ShieldAlert } from 'lucide-react';
import { Account } from '../types';

export const AccountModal: React.FC = () => {
  const {
    isAccountModalOpen,
    editingAccount,
    closeAccountModal,
    addAccount,
    updateAccount,
    openEmojiPicker,
    t,
    settings,
  } = useApp();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('💵');
  const [balance, setBalance] = useState('0');
  const [isPrivate, setIsPrivate] = useState(false);
  const [monthStartDay, setMonthStartDay] = useState<string>('default');
  const [notes, setNotes] = useState('');
  const [isClosing, setIsClosing] = useState(false);

  const prevOpenRef = useRef(false);
  const prevEditingIdRef = useRef<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const balanceInputRef = useRef<HTMLInputElement | null>(null);
  const notesInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const isOpening = isAccountModalOpen && !prevOpenRef.current;
    const isDifferentAccount = editingAccount?.id !== prevEditingIdRef.current;

    if (isOpening || isDifferentAccount) {
      if (editingAccount) {
        setName(editingAccount.name);
        setIcon(editingAccount.icon || '💵');
        setBalance(editingAccount.balance.toString());
        setIsPrivate(editingAccount.isPrivate);
        setMonthStartDay(
          editingAccount.customMonthStartDay === 'default'
            ? 'default'
            : String(editingAccount.customMonthStartDay)
        );
        setNotes(editingAccount.notes || '');
      } else {
        setName('');
        setIcon('💵');
        setBalance('0');
        setIsPrivate(false);
        setMonthStartDay('default');
        setNotes('');
      }
    } else if (isAccountModalOpen && editingAccount) {
      // Live context / background sync: only update fields when user is NOT actively typing/focused!
      if (document.activeElement !== nameInputRef.current && editingAccount.name) {
        setName(editingAccount.name);
      }
      if (document.activeElement !== balanceInputRef.current && editingAccount.balance !== undefined) {
        setBalance(editingAccount.balance.toString());
      }
      if (editingAccount.icon) setIcon(editingAccount.icon);
      setIsPrivate(editingAccount.isPrivate);
      if (editingAccount.customMonthStartDay !== undefined) {
        setMonthStartDay(
          editingAccount.customMonthStartDay === 'default'
            ? 'default'
            : String(editingAccount.customMonthStartDay)
        );
      }
      if (document.activeElement !== notesInputRef.current && editingAccount.notes !== undefined) {
        setNotes(editingAccount.notes || '');
      }
    }

    prevOpenRef.current = isAccountModalOpen;
    prevEditingIdRef.current = editingAccount?.id || null;
  }, [editingAccount, isAccountModalOpen]);

  if (!isAccountModalOpen) return null;

  const handlePickEmoji = () => {
    openEmojiPicker((emoji) => {
      setIcon(emoji);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedBalance = parseFloat(balance) || 0;
    const customStart = monthStartDay === 'default' ? 'default' : parseInt(monthStartDay, 10);

    if (editingAccount) {
      const updated: Account = {
        ...editingAccount,
        name: name.trim() || 'Account',
        icon,
        isPrivate,
        customMonthStartDay: customStart,
        notes: notes.trim(),
      };
      // Pass parsedBalance so updateAccount handles manual balance adjustments if balance changed!
      updateAccount(updated, parsedBalance);
    } else {
      addAccount(
        {
          name: name.trim() || 'Account',
          icon,
          isPrivate,
          customMonthStartDay: customStart,
          notes: notes.trim(),
        },
        parsedBalance
      );
    }
    closeAccountModal();
  };

  const handleAnimatedClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      closeAccountModal();
    }, 180);
  };

  const oldBalance = editingAccount ? editingAccount.balance : 0;
  const currentNumericBalance = parseFloat(balance) || 0;
  const balanceDiff = currentNumericBalance - oldBalance;
  const willTriggerManualAdjustment =
    editingAccount !== null && Math.abs(balanceDiff) >= 0.009;

  return (
    <div
      onClick={handleAnimatedClose}
      onTouchMove={(e) => e.stopPropagation()}
      className={`fixed inset-0 z-[80] flex items-end sm:items-center landscape:items-center justify-center bg-black/60 backdrop-blur-md p-0 sm:p-4 landscape:p-2 overflow-y-auto overscroll-contain transition-all duration-200 ${
        isClosing ? 'modal-backdrop-closing' : 'modal-backdrop-anim'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg max-h-[92dvh] my-auto flex flex-col rounded-t-3xl sm:rounded-3xl landscape:rounded-3xl bg-zinc-950/95 backdrop-blur-2xl border border-zinc-800/80 shadow-2xl overflow-hidden text-white transition-all duration-200 ${
          isClosing ? 'modal-container-closing' : 'modal-container-anim'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80">
          <h3 className="text-lg font-bold">
            {editingAccount ? t('editAccount') : t('addAccount')}
          </h3>
          <button
            type="button"
            onClick={handleAnimatedClose}
            className="p-1 rounded-full text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Top: Large circular preview of the selected Emoji Icon */}
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={handlePickEmoji}
              className="relative w-24 h-24 rounded-full bg-zinc-900 border-2 border-zinc-700 hover:border-blue-500 flex items-center justify-center text-5xl hover:scale-105 active:scale-95 transition shadow-xl group"
            >
              <span>{icon}</span>
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                <Smile className="w-6 h-6 text-white" />
              </div>
            </button>
            <span className="text-xs text-zinc-400">{t('selectEmoji')}</span>
          </div>

          {/* Account Name */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
              {t('accountName')}
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Visa, Cash, Savings"
              className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-blue-500 text-white text-sm outline-none transition"
              required
            />
          </div>

          {/* Current / Initial Balance */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-zinc-400">
                {t('currentBalance')} ({settings.currencySymbol || '£'})
              </label>
              {editingAccount && (
                <span className="text-xs text-zinc-500">
                  Current: {settings.currencySymbol}
                  {oldBalance.toFixed(2)}
                </span>
              )}
            </div>
            <input
              ref={balanceInputRef}
              type="number"
              step="any"
              value={balance}
              onFocus={(e) => {
                if (e.target.value === '0') setBalance('');
              }}
              onBlur={(e) => {
                if (!e.target.value.trim()) setBalance('0');
              }}
              onChange={(e) => {
                const val = e.target.value;
                if (val.length > 1 && val.startsWith('0') && !val.startsWith('0.')) {
                  setBalance(val.replace(/^0+/, ''));
                } else {
                  setBalance(val);
                }
              }}
              placeholder="0.00"
              className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-blue-500 text-white text-sm outline-none transition"
              required
            />
            {willTriggerManualAdjustment && (
              <div className="mt-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-300">
                <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <p className="font-semibold">Manual Adjustment will be created</p>
                  <p className="text-[11px] text-amber-300/80 mt-0.5">
                    Changing balance will automatically generate an uneditable{' '}
                    {balanceDiff > 0 ? 'income' : 'expense'} transaction of{' '}
                    {settings.currencySymbol}
                    {Math.abs(balanceDiff).toFixed(2)}.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Month Start Day Selector */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
              {t('monthStartDay')}
            </label>
            <select
              value={monthStartDay}
              onChange={(e) => setMonthStartDay(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-sm outline-none transition"
            >
              <option value="default">{t('useGlobalDefault')} ({settings.defaultMonthStartDay})</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  Day {d} of month
                </option>
              ))}
            </select>
          </div>

          {/* Privacy Toggle Switch */}
          <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 flex items-center justify-between">
            <div className="pr-4">
              <div className="text-sm font-semibold text-white">
                {isPrivate ? t('privateAccount') : t('includeInGlobalTotal')}
              </div>
              <div className="text-xs text-zinc-400 mt-0.5">
                {isPrivate
                  ? t('privateAccountDesc')
                  : 'Included in Home & Insights calculations'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsPrivate(!isPrivate)}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isPrivate ? 'bg-amber-600' : 'bg-blue-600'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  isPrivate ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
              {t('notes')}
            </label>
            <textarea
              ref={notesInputRef}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes or account details..."
              rows={2}
              className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-blue-500 text-white text-sm outline-none transition resize-none"
            />
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3.5 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-bold text-sm shadow-xl shadow-blue-900/40 transition"
            >
              {editingAccount ? t('updateTransaction') : t('addAccount')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
