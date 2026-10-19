import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, Filter, Check } from 'lucide-react';
import { AdvancedFilter } from '../types';

export const AdvancedFilterModal: React.FC = () => {
  const {
    isFilterModalOpen,
    setIsFilterModalOpen,
    advancedFilter,
    setAdvancedFilter,
    clearAdvancedFilter,
    accounts,
    categories,
    t,
  } = useApp();

  const [localFilter, setLocalFilter] = useState<AdvancedFilter>({ ...advancedFilter });
  const [isClosing, setIsClosing] = useState(false);

  if (!isFilterModalOpen) return null;

  const toggleAccount = (id: string) => {
    setLocalFilter((prev) => {
      const exists = prev.accountIds.includes(id);
      return {
        ...prev,
        accountIds: exists ? prev.accountIds.filter((x) => x !== id) : [...prev.accountIds, id],
      };
    });
  };

  const toggleCategory = (id: string) => {
    setLocalFilter((prev) => {
      const exists = prev.categoryIds.includes(id);
      return {
        ...prev,
        categoryIds: exists ? prev.categoryIds.filter((x) => x !== id) : [...prev.categoryIds, id],
      };
    });
  };

  const handleApply = () => {
    setAdvancedFilter(localFilter);
    setIsFilterModalOpen(false);
  };

  const handleClear = () => {
    clearAdvancedFilter();
    setIsFilterModalOpen(false);
  };

  const handleAnimatedClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      setIsFilterModalOpen(false);
    }, 180);
  };

  return (
    <div
      onClick={handleAnimatedClose}
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md p-0 sm:p-4 transition-all duration-200 ${
        isClosing ? 'modal-backdrop-closing' : 'modal-backdrop-anim'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-zinc-950/95 backdrop-blur-2xl border border-zinc-800/80 shadow-2xl overflow-hidden text-white transition-all duration-200 ${
          isClosing ? 'modal-container-closing' : 'modal-container-anim'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Filter className="w-5 h-5 text-blue-400" />
            {t('advancedFilterTitle')}
          </h3>
          <button
            type="button"
            onClick={handleAnimatedClose}
            className="p-1 rounded-full text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Filters */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Type Filter */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
              {t('transactionType')}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['all', 'expense', 'income', 'transfer'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setLocalFilter((prev) => ({ ...prev, type }))}
                  className={`py-2 px-1 text-xs font-semibold rounded-xl border capitalize transition ${
                    localFilter.type === type
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800/80'
                  }`}
                >
                  {type === 'all' ? t('allTypes') : t(type)}
                </button>
              ))}
            </div>
          </div>

          {/* Amount range */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
              Amount Range
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-zinc-500 mb-1 block">{t('minAmount')}</span>
                <input
                  type="number"
                  step="any"
                  value={localFilter.minAmount ?? ''}
                  onChange={(e) =>
                    setLocalFilter((prev) => ({
                      ...prev,
                      minAmount: e.target.value === '' ? undefined : Number(e.target.value),
                    }))
                  }
                  placeholder="£ 0"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white"
                />
              </div>
              <div>
                <span className="text-[11px] text-zinc-500 mb-1 block">{t('maxAmount')}</span>
                <input
                  type="number"
                  step="any"
                  value={localFilter.maxAmount ?? ''}
                  onChange={(e) =>
                    setLocalFilter((prev) => ({
                      ...prev,
                      maxAmount: e.target.value === '' ? undefined : Number(e.target.value),
                    }))
                  }
                  placeholder="£ 1000"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white"
                />
              </div>
            </div>
          </div>

          {/* Accounts filter */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
              {t('filterByAccount')}
            </label>
            <div className="flex flex-wrap gap-2">
              {accounts.map((acc) => {
                const isSelected = localFilter.accountIds.includes(acc.id);
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => toggleAccount(acc.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition ${
                      isSelected
                        ? 'bg-blue-600/30 border-blue-500 text-white'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <span>{acc.icon}</span>
                    <span>{acc.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Categories filter */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
              {t('filterByCategory')}
            </label>
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
              {categories.map((cat) => {
                const isSelected = localFilter.categoryIds.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition ${
                      isSelected
                        ? 'bg-blue-600/30 border-blue-500 text-white'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span className="truncate max-w-[120px]">{cat.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-zinc-800/80 bg-zinc-900/50">
          <button
            type="button"
            onClick={handleClear}
            className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition"
          >
            {t('clearFilters')}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsFilterModalOpen(false)}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 transition"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-lg shadow-blue-900/40 transition"
            >
              {t('applyFilters')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
