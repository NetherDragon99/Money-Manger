import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { X, Search, Plus, Check, Tag } from 'lucide-react';
import { Category } from '../types';

interface CategoryDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCategory: (category: Category) => void;
  selectedCategoryId?: string;
  initialType?: 'expense' | 'income';
}

export const CategoryDirectoryModal: React.FC<CategoryDirectoryModalProps> = ({
  isOpen,
  onClose,
  onSelectCategory,
  selectedCategoryId,
  initialType = 'expense',
}) => {
  const { categories, openAddCategoryModal, settings } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>(initialType);
  const isArabic = settings.language === 'ar';

  const filteredCategories = useMemo(() => {
    const list = categories.filter((cat) => {
      if (filterType !== 'all' && cat.type !== filterType) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = cat.name.toLowerCase().includes(query);
        return matchesName;
      }
      return true;
    });

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
  }, [categories, filterType, searchQuery, settings.categoryOrder]);

  const [isClosing, setIsClosing] = useState(false);

  const handleAnimatedClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 180);
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={handleAnimatedClose}
      className={`fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 landscape:p-2 overflow-y-auto bg-black/60 backdrop-blur-md transition-all duration-200 ${
        isClosing ? 'modal-backdrop-closing' : 'modal-backdrop-anim'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg h-full sm:h-auto sm:max-h-[90dvh] landscape:h-auto landscape:max-h-[92dvh] my-auto flex flex-col rounded-none sm:rounded-3xl landscape:rounded-3xl bg-zinc-950/95 backdrop-blur-2xl border border-zinc-800/80 shadow-2xl text-white overflow-hidden transition-all duration-200 ${
          isClosing ? 'modal-container-closing' : 'modal-container-anim'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isArabic ? 'دليل الفئات والتصنيفات' : 'Categories Directory'}
              </h3>
              <p className="text-[11px] text-zinc-400">
                {filteredCategories.length} {isArabic ? 'فئة متاحة' : 'categories available'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAnimatedClose}
            className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div className="p-4 space-y-3 border-b border-zinc-800/80 bg-zinc-900/40">
          {/* Advanced Real-time Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isArabic ? 'ابحث في الفئات بالاسم أو النوع...' : 'Search categories in real time...'}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Chips & + Create New Category */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex p-0.5 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-3 py-1 rounded-lg transition ${
                  filterType === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {isArabic ? 'الكل' : 'All'}
              </button>
              <button
                type="button"
                onClick={() => setFilterType('expense')}
                className={`px-3 py-1 rounded-lg transition ${
                  filterType === 'expense' ? 'bg-rose-600 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {isArabic ? 'المصروفات' : 'Expense'}
              </button>
              <button
                type="button"
                onClick={() => setFilterType('income')}
                className={`px-3 py-1 rounded-lg transition ${
                  filterType === 'income' ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {isArabic ? 'الإيرادات' : 'Income'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                openAddCategoryModal(filterType === 'income' ? 'income' : 'expense');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg shadow-blue-900/30 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isArabic ? 'إنشاء فئة جديدة' : 'Create Category'}</span>
            </button>
          </div>
        </div>

        {/* Categories Grid List */}
        <div className="flex-1 overflow-y-auto p-4 max-h-[55vh] overscroll-contain">
          {filteredCategories.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-xs">
              {isArabic ? 'لم يتم العثور على فئات مطابقة للبحث' : 'No categories found matching your search.'}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {filteredCategories.map((cat) => {
                const isSelected = cat.id === selectedCategoryId;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      onSelectCategory(cat);
                      onClose();
                    }}
                    className={`flex items-center gap-2.5 p-3 rounded-2xl text-left transition cursor-pointer relative active:scale-95 ${
                      isSelected
                        ? 'bg-blue-600/20 border-2 border-blue-500 text-white shadow-lg shadow-blue-900/30'
                        : 'bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 hover:border-zinc-700 text-zinc-200'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-xl shrink-0">
                      {cat.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold truncate text-white">{cat.name}</div>
                      <div className="text-[10px] text-zinc-400 capitalize">
                        {cat.type === 'expense'
                          ? (isArabic ? 'مصروف' : 'Expense')
                          : (isArabic ? 'إيراد وارد' : 'Income')}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-white shrink-0">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
