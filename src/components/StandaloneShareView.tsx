import React, { useState, useEffect, useMemo } from 'react';
import {
  Share2,
  Copy,
  Check,
  Landmark,
  Tags,
  Receipt,
  ArrowDown,
  ArrowUp,
  ExternalLink,
  ShieldCheck,
  Clock,
  Sparkles,
  RefreshCw,
  Eye,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download,
} from 'lucide-react';
import { fetchShareFolderFromCloud, ShareFolder, subscribeToShareFolder } from '../utils/shareFolders';
import { formatCurrency, formatDateToYYYYMMDD } from '../utils/dateCycle';
import { Account, Category, Transaction } from '../types';
import { format16DigitId } from '../utils/userId';
import { useApp } from '../context/AppContext';

interface StandaloneShareViewProps {
  shareId?: string | null;
  sharedDataSnapshot?: any | null;
  onExploreApp?: () => void;
}

export const StandaloneShareView: React.FC<StandaloneShareViewProps> = ({
  shareId,
  sharedDataSnapshot,
  onExploreApp,
}) => {
  const { importSharedItems, showToast, settings } = useApp();
  const isArabic = settings?.language ? settings.language === 'ar' : true;

  const [folder, setFolder] = useState<ShareFolder | null>(() => {
    if (sharedDataSnapshot && sharedDataSnapshot.payload) {
      return sharedDataSnapshot as ShareFolder;
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(!sharedDataSnapshot && !!shareId);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Collapsible Sections
  const [isAccountsOpen, setIsAccountsOpen] = useState(true);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(true);
  const [isTransactionsOpen, setIsTransactionsOpen] = useState(true);

  useEffect(() => {
    if (!shareId && !sharedDataSnapshot) {
      setError(isArabic ? 'رابط المشاركة غير صالح أو انتهت صلاحيته.' : 'Invalid or expired share link.');
      setIsLoading(false);
      return;
    }

    if (sharedDataSnapshot && sharedDataSnapshot.payload) {
      setFolder(sharedDataSnapshot as ShareFolder);
      setIsLoading(false);
    }

    if (!shareId) return;

    let isMounted = true;
    if (!sharedDataSnapshot) setIsLoading(true);

    // 1. Initial Cloud Fetch with 10s fallback
    fetchShareFolderFromCloud(shareId)
      .then((data) => {
        if (!isMounted) return;
        if (data) {
          setFolder(data);
          setError(null);
        } else if (!sharedDataSnapshot) {
          setError(isArabic ? 'لم يتم العثور على صفحة المشاركة المطلوبة، أو ربما قام المالك بإلغائها.' : 'Shared space not found or was removed by owner.');
        }
        setIsLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('[StandaloneShareView] Fetch error:', err);
        if (!sharedDataSnapshot) {
          setError(isArabic ? 'تعذر تحميل بيانات المشاركة. يرجى التحقق من اتصالك بالإنترنت.' : 'Could not load share data. Check your connection.');
        }
        setIsLoading(false);
      });

    // 2. Real-time Subscription for live updates without page refresh
    const unsub = subscribeToShareFolder(shareId, (liveData) => {
      if (!isMounted) return;
      if (liveData) {
        setFolder(liveData);
        setError(null);
      }
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, [shareId, sharedDataSnapshot, isArabic]);

  const handleCopyLink = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
      setIsCopied(true);
      showToast?.(isArabic ? 'تم نسخ رابط المشاهدة!' : 'Share link copied!', 'success');
      setTimeout(() => setIsCopied(false), 2000);
    } catch {}
  };

  const accounts: Account[] = folder?.payload?.accounts || [];
  const categories: Category[] = folder?.payload?.categories || [];
  const transactions: Transaction[] = folder?.payload?.transactions || [];

  // Optional manual import to user's local manager
  const handleImportToApp = () => {
    if (accounts.length === 0 && categories.length === 0 && transactions.length === 0) {
      showToast?.(isArabic ? 'لا توجد بيانات للاستيراد' : 'No data to import', 'info');
      return;
    }
    const res = importSharedItems?.({ accounts, categories, transactions });
    if (res) {
      showToast?.(
        isArabic
          ? `تم استيراد ${res.accountsCount} حسابات و${res.categoriesCount} تصنيفات و${res.txsCount} معاملات بنجاح!`
          : `Successfully imported ${res.accountsCount} accounts, ${res.categoriesCount} categories, and ${res.txsCount} transactions!`,
        'success'
      );
    }
  };

  // Metrics computation
  const { totalBalance, totalIncome, totalExpense } = useMemo(() => {
    const bal = accounts.reduce((acc, a) => acc + (a.balance || 0), 0);
    let inc = 0;
    let exp = 0;
    for (const t of transactions) {
      if (t.type === 'income') inc += t.amount;
      if (t.type === 'expense') exp += t.amount;
    }
    return { totalBalance: bal, totalIncome: inc, totalExpense: exp };
  }, [accounts, transactions]);

  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    const sorted = [...transactions].sort((a, b) => {
      return (b.date + (b.time || '')).localeCompare(a.date + (a.time || ''));
    });
    for (const tx of sorted) {
      const list = map.get(tx.date) || [];
      list.push(tx);
      map.set(tx.date, list);
    }
    return Array.from(map.entries());
  }, [transactions]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6" dir={isArabic ? 'rtl' : 'ltr'}>
        <div className="w-16 h-16 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-3xl animate-pulse">
          📁
        </div>
        <p className="mt-4 text-sm font-semibold text-zinc-400 animate-pulse">
          {isArabic ? 'جارٍ تحميل لوحة المشاركة المباشرة...' : 'Loading live share dashboard...'}
        </p>
      </div>
    );
  }

  if (error || !folder) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center" dir={isArabic ? 'rtl' : 'ltr'}>
        <div className="w-16 h-16 rounded-3xl bg-red-950/40 border border-red-500/30 flex items-center justify-center text-3xl mb-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-lg font-bold text-white mb-2">
          {isArabic ? 'تعذر فتح صفحة المشاركة' : 'Unable to Open Share Space'}
        </h2>
        <p className="text-xs text-zinc-400 max-w-sm mb-6 leading-relaxed">
          {error || (isArabic ? 'لم يتم العثور على البيانات المطلوبة.' : 'The requested data was not found.')}
        </p>
        {onExploreApp && (
          <button
            type="button"
            onClick={onExploreApp}
            className="px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg cursor-pointer"
          >
            {isArabic ? 'فتح التطبيق الرئيسي' : 'Open Main App'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center selection:bg-blue-600 selection:text-white" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-full md:max-w-4xl lg:max-w-5xl min-h-screen bg-black flex flex-col shadow-2xl relative">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 h-16 px-4 sm:px-6 bg-black/90 backdrop-blur-xl border-b border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-3xl shrink-0">{folder.icon || '📁'}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-white truncate">{folder.name}</h1>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{isArabic ? 'مباشر · للقراءة فقط' : 'Live · Read Only'}</span>
                </span>
              </div>
              <div className="text-xs text-zinc-400 mt-0.5 truncate">
                {isArabic ? 'مشاركة من:' : 'Shared by:'} <span className="text-zinc-200 font-semibold">{folder.ownerName}</span>
                {folder.ownerNumericId && <span className="font-mono text-zinc-500 ml-1">({format16DigitId(folder.ownerNumericId)})</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleImportToApp}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-semibold transition active:scale-95 cursor-pointer"
              title={isArabic ? 'استيراد نسخة إلى تطبيقي' : 'Import snapshot to my app'}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isArabic ? 'استيراد نسخة' : 'Import Copy'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-semibold transition active:scale-95 cursor-pointer shadow"
              title={isArabic ? 'نسخ رابط هذه الصفحة' : 'Copy link'}
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-blue-400" />}
              <span>{isCopied ? (isArabic ? 'تم النسخ!' : 'Copied!') : (isArabic ? 'نسخ الرابط' : 'Copy Link')}</span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-4 sm:p-6 space-y-6 pb-24">
          {/* 1. Global Financial Net Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-md">
              <div className="text-xs font-semibold text-zinc-400">{isArabic ? 'إجمالي الرصيد بالمشاركة' : 'Total Shared Balance'}</div>
              <div className="text-xl sm:text-2xl font-black font-mono text-white mt-1">
                {formatCurrency(totalBalance, '£', isArabic ? 'ar' : 'en')}
              </div>
              <div className="text-[11px] text-zinc-500 mt-1">
                {isArabic ? `مجموع الحسابات المرفقة (${accounts.length})` : `Attached Accounts (${accounts.length})`}
              </div>
            </div>

            <div className="p-4 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-md">
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-400">
                <span>{isArabic ? 'إجمالي الدخل' : 'Total Income'}</span>
                <ArrowDown className="w-3.5 h-3.5" />
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400 mt-1">
                {formatCurrency(totalIncome, '£', isArabic ? 'ar' : 'en')}
              </div>
              <div className="text-[11px] text-zinc-500 mt-1">{isArabic ? 'إجمالي الإيرادات المسجلة' : 'Recorded Incomes'}</div>
            </div>

            <div className="p-4 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-md">
              <div className="flex items-center justify-between text-xs font-semibold text-red-400">
                <span>{isArabic ? 'إجمالي المصروفات' : 'Total Expenses'}</span>
                <ArrowUp className="w-3.5 h-3.5" />
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-red-400 mt-1">
                {formatCurrency(totalExpense, '£', isArabic ? 'ar' : 'en')}
              </div>
              <div className="text-[11px] text-zinc-500 mt-1">{isArabic ? 'إجمالي النفقات المسجلة' : 'Recorded Expenses'}</div>
            </div>
          </div>

          {/* 2. Included Accounts Section (Collapsible) */}
          {accounts.length > 0 && (
            <div className="rounded-3xl bg-zinc-900/40 border border-zinc-800/80 overflow-hidden">
              <button
                type="button"
                onClick={() => setIsAccountsOpen((prev) => !prev)}
                className="w-full flex items-center justify-between p-4 bg-zinc-900/60 hover:bg-zinc-900 border-b border-zinc-800/50 transition cursor-pointer text-right rtl:text-right ltr:text-left"
              >
                <div className="flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-bold text-white">
                    {isArabic ? 'الحسابات المالية المضمنة' : 'Included Financial Accounts'}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-mono font-semibold">
                    {accounts.length}
                  </span>
                </div>
                {isAccountsOpen ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
              </button>

              {isAccountsOpen && (
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {accounts.map((acc) => (
                    <div
                      key={acc.id}
                      className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 shadow-md flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-xl shrink-0">
                          {acc.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white truncate">{acc.name}</div>
                          <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                            {acc.isPrivate ? (isArabic ? 'حساب خاص' : 'Private') : (isArabic ? 'حساب عام' : 'Public')}
                          </div>
                        </div>
                      </div>
                      <div className="text-left font-mono font-bold text-sm text-white shrink-0">
                        {formatCurrency(acc.balance, '£', isArabic ? 'ar' : 'en')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. Included Categories Section (Collapsible) */}
          {categories.length > 0 && (
            <div className="rounded-3xl bg-zinc-900/40 border border-zinc-800/80 overflow-hidden">
              <button
                type="button"
                onClick={() => setIsCategoriesOpen((prev) => !prev)}
                className="w-full flex items-center justify-between p-4 bg-zinc-900/60 hover:bg-zinc-900 border-b border-zinc-800/50 transition cursor-pointer text-right rtl:text-right ltr:text-left"
              >
                <div className="flex items-center gap-2">
                  <Tags className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-bold text-white">
                    {isArabic ? 'التصنيفات المضمنة' : 'Included Categories'}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-semibold">
                    {categories.length}
                  </span>
                </div>
                {isCategoriesOpen ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
              </button>

              {isCategoriesOpen && (
                <div className="p-4 flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <div
                      key={cat.id}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 shadow-sm"
                    >
                      <span>{cat.icon}</span>
                      <span className="font-semibold">{cat.name}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded-full font-medium ${
                          cat.type === 'expense'
                            ? 'bg-red-500/15 text-red-300'
                            : 'bg-emerald-500/15 text-emerald-300'
                        }`}
                      >
                        {cat.type === 'expense' ? (isArabic ? 'مصروف' : 'Expense') : (isArabic ? 'دخل' : 'Income')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. Transactions List (Collapsible) */}
          <div className="rounded-3xl bg-zinc-900/40 border border-zinc-800/80 overflow-hidden">
            <button
              type="button"
              onClick={() => setIsTransactionsOpen((prev) => !prev)}
              className="w-full flex items-center justify-between p-4 bg-zinc-900/60 hover:bg-zinc-900 border-b border-zinc-800/50 transition cursor-pointer text-right rtl:text-right ltr:text-left"
            >
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-bold text-white">
                  {isArabic ? 'المعاملات المالية' : 'Financial Transactions'}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-mono font-semibold">
                  {transactions.length}
                </span>
              </div>
              {isTransactionsOpen ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
            </button>

            {isTransactionsOpen && (
              <div className="p-4 space-y-4">
                {transactions.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-zinc-900/40 border border-zinc-800/60 text-center space-y-2">
                    <div className="text-2xl">💳</div>
                    <div className="text-xs text-zinc-400">
                      {isArabic ? 'لا توجد معاملات مسجلة في هذا الشير بعد.' : 'No transactions recorded in this share yet.'}
                    </div>
                  </div>
                ) : (
                  groupedTransactions.map(([date, txs]) => (
                    <div key={date} className="space-y-2">
                      <div className="text-xs font-bold text-zinc-500 px-1 font-mono">
                        {date} ({txs.length} {isArabic ? 'معاملات' : 'trx'})
                      </div>

                      <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800/80 overflow-hidden divide-y divide-zinc-800/60 shadow-md">
                        {txs.map((tx) => (
                          <div key={tx.id} className="p-3 sm:p-3.5 flex items-center justify-between hover:bg-zinc-850/50 transition">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-lg shrink-0">
                                {tx.categoryIcon || '💸'}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs sm:text-sm font-bold text-white truncate">
                                  {tx.description || tx.categoryName || (isArabic ? 'معاملة' : 'Transaction')}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-0.5">
                                  <span>{tx.time || ''}</span>
                                  {tx.categoryName && <span>· {tx.categoryName}</span>}
                                </div>
                              </div>
                            </div>

                            <div
                              className={`font-mono font-black text-xs sm:text-sm shrink-0 pl-2 ${
                                tx.type === 'income'
                                  ? 'text-emerald-400'
                                  : tx.type === 'expense'
                                  ? 'text-red-400'
                                  : 'text-blue-400'
                              }`}
                            >
                              {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                              {formatCurrency(tx.amount, '£', isArabic ? 'ar' : 'en')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </main>

        {/* Subtle Bottom Footer */}
        <footer className="p-4 border-t border-zinc-800/80 bg-zinc-950/90 text-center flex flex-col items-center justify-center gap-2 text-xs text-zinc-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>{isArabic ? 'عرض عام مباشر ومؤمن عبر Firebase RTDB' : 'Live read-only shared view via Firebase RTDB'}</span>
          </div>
          {onExploreApp && (
            <button
              type="button"
              onClick={onExploreApp}
              className="text-blue-400 hover:text-blue-300 font-medium underline cursor-pointer text-[11px]"
            >
              {isArabic ? 'الانتقال إلى التطبيق لإنشاء وإدارة حساباتك الخاصة' : 'Go to App to manage personal finances'}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};
