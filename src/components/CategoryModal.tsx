import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { X, Trash2, AlertTriangle } from 'lucide-react';
import { Category, TransactionType } from '../types';
import { EMOJI_PICKER_GROUPS } from '../utils/constants';

export const CategoryModal: React.FC = () => {
  const {
    isCategoryModalOpen,
    editingCategory,
    defaultCategoryType,
    closeCategoryModal,
    addCategory,
    updateCategory,
    deleteCategory,
    openEmojiPicker,
    t,
    settings,
    showToast,
  } = useApp();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🛍️');
  const [type, setType] = useState<TransactionType>('expense');
  const [budgetLimit, setBudgetLimit] = useState('0');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    setShowDeleteConfirm(false);
    if (editingCategory) {
      setName(editingCategory.name);
      setIcon(editingCategory.icon || '🛍️');
      setType(editingCategory.type);
      setBudgetLimit(editingCategory.budgetLimit ? String(editingCategory.budgetLimit) : '0');
    } else {
      setName('');
      setIcon(defaultCategoryType === 'income' ? '💵' : '🛍️');
      setType(defaultCategoryType || 'expense');
      setBudgetLimit('0');
    }
  }, [editingCategory, isCategoryModalOpen, defaultCategoryType]);

  if (!isCategoryModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedBudget = parseFloat(budgetLimit) || 0;
    const trimmedName = name.trim() || 'Category';

    if (editingCategory) {
      const updated: Category = {
        ...editingCategory,
        name: trimmedName,
        icon,
        type: type === 'income' ? 'income' : 'expense',
        budgetLimit: type === 'expense' ? parsedBudget : 0,
      };
      updateCategory(updated);
      showToast(
        type === 'income'
          ? (settings.language === 'ar' ? 'تم حفظ الفئة كـ فئة واردة بنجاح' : 'Category updated and saved to Income Categories')
          : (settings.language === 'ar' ? 'تم تحديث الفئة بنجاح' : 'Category updated successfully'),
        'success'
      );
    } else {
      addCategory({
        name: trimmedName,
        icon,
        type: type === 'income' ? 'income' : 'expense',
        budgetLimit: type === 'expense' ? parsedBudget : 0,
      });
      showToast(
        type === 'income'
          ? (settings.language === 'ar' ? 'تمت إضافة الفئة الواردة بنجاح' : 'Income category added successfully')
          : (settings.language === 'ar' ? 'تمت إضافة الفئة بنجاح' : 'Category added successfully'),
        'success'
      );
    }
    closeCategoryModal();
  };

  const handleConfirmDelete = () => {
    if (editingCategory) {
      deleteCategory(editingCategory.id);
      showToast(
        settings.language === 'ar' ? 'تم حذف الفئة بنجاح' : 'Category deleted successfully',
        'success'
      );
      closeCategoryModal();
    }
  };

  const handleAnimatedClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      closeCategoryModal();
    }, 180);
  };

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
            {editingCategory ? t('editCategory') : t('addCategory')}
          </h3>
          <div className="flex items-center gap-2">
            {editingCategory && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                title="Delete category"
                className="p-2 rounded-full text-red-400 hover:bg-red-500/10 hover:text-red-300 transition cursor-pointer"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              type="button"
              onClick={handleAnimatedClose}
              className="p-2 rounded-full text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* In-Modal Delete Confirmation Banner */}
        {showDeleteConfirm && (
          <div className="mx-6 mt-4 p-4 rounded-2xl bg-red-950/50 border border-red-800/80 text-white space-y-3 animate-in fade-in">
            <div className="flex items-center gap-2.5 text-red-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p className="text-xs font-bold">
                {settings.language === 'ar'
                  ? `هل أنت متأكد من حذف الفئة "${name || editingCategory?.name}"؟`
                  : `Are you sure you want to delete "${name || editingCategory?.name}"?`}
              </p>
            </div>
            <p className="text-[11px] text-zinc-300 leading-normal">
              {settings.language === 'ar'
                ? 'لن يتم حذف المعاملات السابقة المرتبطة بهذه الفئة.'
                : 'Existing past transactions linked to this category will be preserved.'}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 transition"
              >
                {settings.language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white transition shadow-lg shadow-red-900/30"
              >
                {settings.language === 'ar' ? 'نعم، احذف الفئة' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Top: Large circular preview of currently selected Emoji (Clickable to open 180+ Icon Picker) */}
          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={() => openEmojiPicker((em) => setIcon(em))}
              title="Change Emoji"
              className="w-20 h-20 rounded-full bg-zinc-900 border-2 border-blue-500/80 hover:border-blue-400 hover:scale-105 active:scale-95 flex items-center justify-center text-4xl shadow-xl transition cursor-pointer group"
            >
              <span>{icon}</span>
            </button>
            <span className="text-[10px] text-zinc-400 mt-1.5 font-medium">
              {settings.language === 'ar' ? 'انقر لتغيير الأيقونة' : 'Tap to change icon'}
            </span>
          </div>

          {/* Type Toggle: Expense or Income (strictly synced with current app language) */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
              {settings.language === 'ar' ? 'نوع الفئة' : 'Category Type'}
            </label>
            <div className="flex p-1 rounded-2xl bg-zinc-900 border border-zinc-800">
              <button
                type="button"
                onClick={() => setType('expense')}
                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer ${
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
                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                  type === 'income'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {t('income')}
              </button>
            </div>
            {type === 'income' && (
              <p className="text-[11px] text-emerald-400 mt-1.5 px-1">
                {settings.language === 'ar'
                  ? '✓ ستظهر هذه الفئة في تبويب الفئات الواردة وعند تسجيل الدخل.'
                  : '✓ This category will be saved under Income Categories and income transactions.'}
              </p>
            )}
          </div>

          {/* Category Name */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
              {settings.language === 'ar' ? 'اسم الفئة' : 'Category Name'}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={settings.language === 'ar' ? 'مثال: الراتب، البقالة، الإيجار' : 'e.g. Salary, Groceries, Rent'}
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
                onFocus={(e) => {
                  if (e.target.value === '0') setBudgetLimit('');
                }}
                onBlur={(e) => {
                  if (!e.target.value.trim()) setBudgetLimit('0');
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.length > 1 && val.startsWith('0') && !val.startsWith('0.')) {
                    setBudgetLimit(val.replace(/^0+/, ''));
                  } else {
                    setBudgetLimit(val);
                  }
                }}
                placeholder="0 = No limit"
                className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-blue-500 text-white text-sm outline-none transition"
              />
            </div>
          )}

          {/* Categorized Emoji Picker Grid */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
                {t('chooseEmoji')}
              </label>
              <button
                type="button"
                onClick={() => openEmojiPicker((em) => setIcon(em))}
                className="text-[11px] font-bold text-blue-400 hover:text-blue-300 transition cursor-pointer"
              >
                {settings.language === 'ar' ? '🔍 180+ أيقونة والبحث' : '🔍 180+ Icons & Search'}
              </button>
            </div>
            <div className="max-h-52 overflow-y-auto pr-2 space-y-4 rounded-2xl bg-zinc-900/60 p-3 border border-zinc-800/80">
              {Object.entries(EMOJI_PICKER_GROUPS).map(([groupTitle, emojis]) => (
                <div key={groupTitle}>
                  <div className="text-[11px] font-semibold text-zinc-500 mb-1.5 px-1">
                    {groupTitle}
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {emojis.map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => setIcon(em)}
                        className={`h-10 rounded-xl flex items-center justify-center text-xl transition active:scale-90 ${
                          icon === em
                            ? 'bg-blue-600/30 border-2 border-blue-500 scale-105'
                            : 'bg-zinc-900 border border-zinc-800 hover:bg-zinc-850'
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

          {/* Submit Action */}
          <div className="pt-2 pb-4">
            <button
              type="submit"
              className="w-full py-3.5 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-bold text-sm shadow-lg shadow-blue-900/40 transition cursor-pointer"
            >
              {editingCategory
                ? (settings.language === 'ar' ? 'تحديث الفئة' : 'Update Category')
                : (settings.language === 'ar' ? 'حفظ الفئة' : 'Save Category')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
