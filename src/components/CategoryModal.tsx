import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { X, Trash2 } from 'lucide-react';
import { Category, TransactionType } from '../types';
import { EMOJI_PICKER_GROUPS } from '../utils/constants';

export const CategoryModal: React.FC = () => {
  const {
    isCategoryModalOpen,
    editingCategory,
    closeCategoryModal,
    addCategory,
    updateCategory,
    deleteCategory,
    t,
    settings,
  } = useApp();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🛍️');
  const [type, setType] = useState<TransactionType>('expense');
  const [budgetLimit, setBudgetLimit] = useState('0');

  useEffect(() => {
    if (editingCategory) {
      setName(editingCategory.name);
      setIcon(editingCategory.icon || '🛍️');
      setType(editingCategory.type);
      setBudgetLimit(editingCategory.budgetLimit ? String(editingCategory.budgetLimit) : '0');
    } else {
      setName('');
      setIcon('🛍️');
      setType('expense');
      setBudgetLimit('0');
    }
  }, [editingCategory, isCategoryModalOpen]);

  if (!isCategoryModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedBudget = parseFloat(budgetLimit) || 0;

    if (editingCategory) {
      const updated: Category = {
        ...editingCategory,
        name: name.trim() || 'Category',
        icon,
        type: type === 'income' ? 'income' : 'expense',
        budgetLimit: parsedBudget,
      };
      updateCategory(updated);
    } else {
      addCategory({
        name: name.trim() || 'Category',
        icon,
        type: type === 'income' ? 'income' : 'expense',
        budgetLimit: parsedBudget,
      });
    }
    closeCategoryModal();
  };

  const handleDelete = () => {
    if (editingCategory) {
      if (confirm('Delete this category?')) {
        deleteCategory(editingCategory.id);
        closeCategoryModal();
      }
    }
  };

  return (
    <div
      onClick={closeCategoryModal}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden text-white"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80">
          <h3 className="text-lg font-bold">
            {editingCategory ? t('editCategory') : t('addCategory')}
          </h3>
          <div className="flex items-center gap-2">
            {editingCategory && (
              <button
                type="button"
                onClick={handleDelete}
                className="p-2 rounded-full text-red-400 hover:bg-red-500/10 transition"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              type="button"
              onClick={closeCategoryModal}
              className="p-2 rounded-full text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Top: Large circular preview of currently selected Emoji */}
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-zinc-900 border-2 border-blue-500/80 flex items-center justify-center text-4xl shadow-xl">
              {icon}
            </div>
          </div>

          {/* Type Toggle: Expense [Default] or Income */}
          <div className="flex p-1 rounded-2xl bg-zinc-900 border border-zinc-800">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
                type === 'expense'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {t('expense')}
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
                type === 'income'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {t('income')}
            </button>
          </div>

          {/* Category Name */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
              Category Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Groceries, Entertainment"
              className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-blue-500 text-white text-sm outline-none transition"
              required
            />
          </div>

          {/* Monthly Budget Limit (only for expense) */}
          {type === 'expense' && (
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                {t('monthlyBudgetLimit')} ({settings.currencySymbol || '£'})
              </label>
              <input
                type="number"
                step="any"
                value={budgetLimit}
                onChange={(e) => setBudgetLimit(e.target.value)}
                placeholder="0 = No limit"
                className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-blue-500 text-white text-sm outline-none transition"
              />
            </div>
          )}

          {/* Categorized Emoji Picker Grid */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
              {t('chooseEmoji')}
            </label>
            <div className="max-h-52 overflow-y-auto pr-2 space-y-4 rounded-2xl bg-zinc-900/60 p-3 border border-zinc-800/80">
              {Object.entries(EMOJI_PICKER_GROUPS).map(([groupTitle, emojis]) => (
                <div key={groupTitle}>
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                    {groupTitle}
                  </div>
                  <div className="grid grid-cols-6 gap-2">
                    {emojis.map((em, idx) => (
                      <button
                        key={`${groupTitle}_${idx}`}
                        type="button"
                        onClick={() => setIcon(em)}
                        className={`h-11 w-11 flex items-center justify-center text-2xl rounded-xl transition ${
                          icon === em
                            ? 'bg-blue-600 border border-blue-400 scale-105'
                            : 'bg-zinc-900/90 border border-zinc-800 hover:bg-zinc-800'
                        }`}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fixed Save Button */}
          <div className="pt-2 sticky bottom-0 bg-zinc-950 pb-2">
            <button
              type="submit"
              className="w-full py-3.5 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-bold text-sm shadow-xl shadow-blue-900/40 transition"
            >
              {editingCategory ? t('updateTransaction') : t('saveCategory')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
