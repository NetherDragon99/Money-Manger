import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/dateCycle';
import { AlertTriangle, ArrowRightLeft, Trash2, X } from 'lucide-react';

export const RemainingBalanceModal: React.FC = () => {
  const {
    remainingBalanceModalState,
    closeRemainingBalanceModal,
    accounts,
    settings,
  } = useApp();

  if (!remainingBalanceModalState || !remainingBalanceModalState.isOpen) {
    return null;
  }

  const isArabic = settings.language === 'ar';
  const currencySymbol = settings.currencySymbol || '£';
  const deletingAccounts = remainingBalanceModalState.accounts;
  const onConfirm = remainingBalanceModalState.onConfirmDelete;

  // Remaining accounts that are NOT being deleted
  const deletingIds = new Set(deletingAccounts.map((a) => a.id));
  const availableTargetAccounts = accounts.filter((a) => !deletingIds.has(a.id));

  // Compute total non-zero remaining balance
  const totalBalance = deletingAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);

  const [selectedTargetId, setSelectedTargetId] = useState<string>(
    availableTargetAccounts[0]?.id || ''
  );
  const [resolutionMode, setResolutionMode] = useState<'transfer' | 'discard'>('transfer');

  const handleExecute = () => {
    if (resolutionMode === 'transfer' && selectedTargetId) {
      onConfirm(selectedTargetId);
    } else {
      onConfirm(undefined); // discard balance
    }
    closeRemainingBalanceModal();
  };

  return (
    <div
      onClick={closeRemainingBalanceModal}
      onTouchMove={(e) => e.stopPropagation()}
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overscroll-contain"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl p-6 text-white space-y-5 animate-in zoom-in-95 duration-200"
        dir={isArabic ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isArabic ? 'تنبيه: يوجد رصيد متبقي في الحساب!' : 'Attention: Remaining Balance Detected!'}
              </h3>
              <p className="text-xs text-zinc-400">
                {isArabic ? 'الحساب المراد حذفه يحتوي على أموال' : 'Account to be deleted contains funds'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeRemainingBalanceModal}
            className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Balance Card */}
        <div className="p-4 rounded-2xl bg-zinc-900 border border-amber-500/30 text-center space-y-1">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            {isArabic ? 'إجمالي الرصيد المتبقي' : 'Total Remaining Balance'}
          </span>
          <div className="text-2xl sm:text-3xl font-black font-mono text-amber-400">
            {formatCurrency(totalBalance, currencySymbol)}
          </div>
          <p className="text-[11px] text-zinc-400 pt-1">
            {deletingAccounts.map((a) => `${a.icon} ${a.name}: ${formatCurrency(a.balance, currencySymbol)}`).join(' • ')}
          </p>
        </div>

        {/* Options */}
        {availableTargetAccounts.length > 0 ? (
          <div className="space-y-3">
            <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
              {isArabic ? 'كيف تود التعامل مع الرصيد المتبقي؟' : 'How would you like to handle this balance?'}
            </span>

            {/* Option 1: Transfer */}
            <div
              onClick={() => setResolutionMode('transfer')}
              className={`p-3.5 rounded-2xl border transition cursor-pointer space-y-2.5 ${
                resolutionMode === 'transfer'
                  ? 'bg-blue-950/30 border-blue-500'
                  : 'bg-zinc-900/60 border-zinc-800 hover:bg-zinc-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="balanceResolution"
                  checked={resolutionMode === 'transfer'}
                  onChange={() => setResolutionMode('transfer')}
                  className="text-blue-600 focus:ring-0"
                />
                <ArrowRightLeft className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-white">
                  {isArabic ? 'تحويل الرصيد المتبقي إلى حساب آخر (موصى به)' : 'Transfer Balance to Another Account (Recommended)'}
                </span>
              </div>

              {resolutionMode === 'transfer' && (
                <div className="pl-6 rtl:pl-0 rtl:pr-6 space-y-1">
                  <label className="block text-[11px] text-zinc-400">
                    {isArabic ? 'اختر الحساب المحول إليه:' : 'Select destination account:'}
                  </label>
                  <select
                    value={selectedTargetId}
                    onChange={(e) => setSelectedTargetId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    {availableTargetAccounts.map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.icon} {target.name} ({formatCurrency(target.balance, currencySymbol)})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Option 2: Discard */}
            <div
              onClick={() => setResolutionMode('discard')}
              className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                resolutionMode === 'discard'
                  ? 'bg-red-950/30 border-red-500'
                  : 'bg-zinc-900/60 border-zinc-800 hover:bg-zinc-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="balanceResolution"
                  checked={resolutionMode === 'discard'}
                  onChange={() => setResolutionMode('discard')}
                  className="text-red-600 focus:ring-0"
                />
                <Trash2 className="w-4 h-4 text-red-400" />
                <span className="text-xs font-bold text-red-400">
                  {isArabic ? 'تجاهل الرصيد وحذف الحساب نهائياً' : 'Discard Balance and Delete Account'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-zinc-400 text-center">
            {isArabic
              ? 'هذا هو حسابك الوحيد في التطبيق. سيتم حذف الرصيد نهائياً عند التأكيد.'
              : 'This is your only account. The balance will be closed upon deletion.'}
          </p>
        )}

        {/* Buttons */}
        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            onClick={closeRemainingBalanceModal}
            className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition cursor-pointer"
          >
            {isArabic ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleExecute}
            className={`flex-1 py-2.5 rounded-xl text-white text-xs font-bold transition cursor-pointer shadow-lg active:scale-95 ${
              resolutionMode === 'transfer'
                ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/30'
                : 'bg-red-600 hover:bg-red-500 shadow-red-900/30'
            }`}
          >
            {resolutionMode === 'transfer'
              ? isArabic ? 'تحويل وحذف' : 'Transfer & Delete'
              : isArabic ? 'تأكيد الحذف' : 'Confirm Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};
