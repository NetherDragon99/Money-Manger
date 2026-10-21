import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Share2,
  Copy,
  Check,
  Landmark,
  Tags,
  Receipt,
  ArrowDown,
  ArrowUp,
  Clock,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Download,
  X,
  Calendar,
  FileText,
  Folder,
} from 'lucide-react';
import { fetchShareFolderFromCloud, ShareFolder, subscribeToShareFolder, registerReceivedShareFolder } from '../utils/shareFolders';
import {
  formatCurrency,
  formatTime12h,
  getDayHeaderTitle,
  getMonthHeaderTitle,
} from '../utils/dateCycle';
import { Account, Category, Transaction } from '../types';
import { format16DigitId } from '../utils/userId';
import { useApp } from '../context/AppContext';
import { ensureFirebaseAuth } from '../utils/firebase';

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
  const currencySymbol = settings?.currencySymbol || '£';

  const [folder, setFolder] = useState<ShareFolder | null>(() => {
    if (sharedDataSnapshot && sharedDataSnapshot.payload) {
      return sharedDataSnapshot as ShareFolder;
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(!sharedDataSnapshot && !!shareId);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

  // Read-Only Transaction Details Modal State
  const [viewingTx, setViewingTx] = useState<Transaction | null>(null);

  // Collapsible Month & Day Sets (Same as Home Page)
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});
  const [collapsedDays, setCollapsedDays] = useState<Record<string, boolean>>({});

  const toggleMonth = (monthKey: string) => {
    setCollapsedMonths((prev) => ({ ...prev, [monthKey]: !prev[monthKey] }));
  };

  const toggleDay = (dayKey: string) => {
    setCollapsedDays((prev) => ({ ...prev, [dayKey]: !prev[dayKey] }));
  };

  // Manual Refresh Handler
  const handleManualRefresh = useCallback(async () => {
    if (!shareId) return;
    setIsRefreshing(true);
    try {
      ensureFirebaseAuth().catch(() => {});
      const freshData = await fetchShareFolderFromCloud(shareId);
      if (freshData) {
        setFolder(freshData);
        setLastUpdated(Date.now());
        setError(null);
        registerReceivedShareFolder(
          freshData,
          settings?.userProfile?.numericId,
          settings?.userProfile?.name,
          settings?.userProfile?.avatarEmoji,
          settings?.userProfile?.customAvatarUrl
        );
        showToast?.(isArabic ? 'تم تحديث البيانات لحظياً من السحابة!' : 'Updated with latest live data!', 'success');
      } else {
        showToast?.(isArabic ? 'أنت تشاهد أحدث نسخة متوفرة حالياً' : 'You are viewing the latest data', 'info');
      }
    } catch (err) {
      console.warn('[StandaloneShareView] Manual refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [shareId, isArabic, showToast, settings]);

  useEffect(() => {
    if (!shareId && !sharedDataSnapshot) {
      setError(isArabic ? 'رابط المشاركة غير صالح أو انتهت صلاحيته.' : 'Invalid or expired share link.');
      setIsLoading(false);
      return;
    }

    // If an initial snapshot was embedded in the URL (from legacy links), use it as immediate placeholder
    if (sharedDataSnapshot && sharedDataSnapshot.payload) {
      setFolder(sharedDataSnapshot as ShareFolder);
      setIsLoading(false);

      // Clean URL: Strip &data= so browser reload fetches the live version
      if (typeof window !== 'undefined' && shareId) {
        const cleanUrl = `${window.location.origin}${window.location.pathname}?share=${encodeURIComponent(shareId)}`;
        window.history.replaceState({}, '', cleanUrl);
      }
    }

    if (!shareId) return;

    let isMounted = true;
    if (!sharedDataSnapshot) setIsLoading(true);

    // 1. Trigger background non-blocking auth attempt
    ensureFirebaseAuth().catch(() => {});

    // 2. Immediate cloud fetch
    fetchShareFolderFromCloud(shareId)
      .then((data) => {
        if (!isMounted) return;
        if (data) {
          setFolder(data);
          setLastUpdated(Date.now());
          setError(null);
          registerReceivedShareFolder(
            data,
            settings?.userProfile?.numericId,
            settings?.userProfile?.name,
            settings?.userProfile?.avatarEmoji,
            settings?.userProfile?.customAvatarUrl
          );
        } else if (!sharedDataSnapshot) {
          setError(
            isArabic
              ? 'لم يتم العثور على صفحة المشاركة المطلوبة، أو ربما قام المالك بإلغائها.'
              : 'Shared space not found or was removed by owner.'
          );
        }
        setIsLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('[StandaloneShareView] Fetch error:', err);
        if (!sharedDataSnapshot) {
          setError(
            isArabic
              ? 'تعذر تحميل بيانات المشاركة. يرجى التحقق من اتصالك بالإنترنت.'
              : 'Could not load share data. Check your connection.'
          );
        }
        setIsLoading(false);
      });

    // 2. Real-time Subscription on Firebase RTDB
    const unsub = subscribeToShareFolder(shareId, (liveData) => {
      if (!isMounted) return;
      if (liveData) {
        setFolder(liveData);
        setLastUpdated(Date.now());
        setError(null);
        registerReceivedShareFolder(
          liveData,
          settings?.userProfile?.numericId,
          settings?.userProfile?.name,
          settings?.userProfile?.avatarEmoji,
          settings?.userProfile?.customAvatarUrl
        );
      }
    });

    // 3. Polling fallback every 12s in case mobile browser sleeps WebSocket
    const pollTimer = setInterval(() => {
      if (!isMounted || !shareId) return;
      fetchShareFolderFromCloud(shareId).then((data) => {
        if (isMounted && data) {
          setFolder((prev) => {
            if (!prev || (data.updatedAt && data.updatedAt > (prev.updatedAt || 0))) {
              setLastUpdated(Date.now());
              return data;
            }
            return prev;
          });
        }
      }).catch(() => {});
    }, 12000);

    return () => {
      isMounted = false;
      unsub();
      clearInterval(pollTimer);
    };
  }, [shareId, sharedDataSnapshot, isArabic]);

  const handleCopyLink = () => {
    try {
      const cleanUrl = shareId
        ? `${window.location.origin}${window.location.pathname}?share=${encodeURIComponent(shareId)}`
        : window.location.href;
      navigator.clipboard.writeText(cleanUrl);
      setIsCopied(true);
      showToast?.(isArabic ? 'تم نسخ الرابط المباشر!' : 'Live share link copied!', 'success');
      setTimeout(() => setIsCopied(false), 2000);
    } catch {}
  };

  const accounts: Account[] = folder?.payload?.accounts || [];
  const categories: Category[] = folder?.payload?.categories || [];
  const transactions: Transaction[] = folder?.payload?.transactions || [];

  // Account map for fast lookup
  const accountMap = useMemo(() => {
    const map = new Map<string, Account>();
    for (const a of accounts) {
      map.set(a.id, a);
    }
    return map;
  }, [accounts]);

  // Category map for fast lookup
  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    for (const c of categories) {
      map.set(c.id, c);
    }
    return map;
  }, [categories]);

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
    return {
      totalBalance: accounts.length > 0 ? bal : inc - exp,
      totalIncome: inc,
      totalExpense: exp,
    };
  }, [accounts, transactions]);

  // Group transactions by Month -> Day (Identical to Home Page GroupedTransactionList)
  const groupedData = useMemo(() => {
    // Sort transactions descending (newest first)
    const sorted = [...transactions].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      const timeA = a.time || '00:00';
      const timeB = b.time || '00:00';
      if (timeA !== timeB) return timeB.localeCompare(timeA);
      return b.createdAt - a.createdAt;
    });

    const monthsMap = new Map<
      string,
      {
        monthKey: string;
        monthNet: number;
        daysMap: Map<string, { dayKey: string; dayNet: number; txs: Transaction[] }>;
      }
    >();

    for (const tx of sorted) {
      const monthKey = tx.date.slice(0, 7); // "YYYY-MM"
      const dayKey = tx.date; // "YYYY-MM-DD"

      let monthEntry = monthsMap.get(monthKey);
      if (!monthEntry) {
        monthEntry = { monthKey, monthNet: 0, daysMap: new Map() };
        monthsMap.set(monthKey, monthEntry);
      }

      let dayEntry = monthEntry.daysMap.get(dayKey);
      if (!dayEntry) {
        dayEntry = { dayKey, dayNet: 0, txs: [] };
        monthEntry.daysMap.set(dayKey, dayEntry);
      }

      dayEntry.txs.push(tx);

      let delta = 0;
      if (tx.type === 'income') delta = tx.amount;
      else if (tx.type === 'expense') delta = -tx.amount;

      monthEntry.monthNet += delta;
      dayEntry.dayNet += delta;
    }

    return Array.from(monthsMap.values()).map((m) => ({
      ...m,
      days: Array.from(m.daysMap.values()),
    }));
  }, [transactions]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6" dir={isArabic ? 'rtl' : 'ltr'}>
        <div className="w-16 h-16 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-3xl animate-pulse">
          📁
        </div>
        <p className="mt-4 text-sm font-semibold text-zinc-400 animate-pulse">
          {isArabic ? 'جارٍ الاتصال بالسحابة وتحميل العمليات المباشرة...' : 'Connecting to cloud and loading live transactions...'}
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
        <div className="flex items-center justify-center gap-2">
          {shareId && (
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="px-4 py-2.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
              <span>{isArabic ? 'إعادة المحاولة' : 'Retry'}</span>
            </button>
          )}
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center selection:bg-blue-600 selection:text-white" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-full md:max-w-4xl lg:max-w-5xl min-h-screen bg-black flex flex-col shadow-2xl relative">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 px-4 sm:px-6 py-3 bg-black/90 backdrop-blur-xl border-b border-zinc-800/80 flex items-center justify-between gap-3">
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
              <div className="text-xs text-zinc-400 mt-0.5 truncate flex items-center gap-2">
                <span>
                  {isArabic ? 'مشاركة من:' : 'Shared by:'}{' '}
                  <span className="text-zinc-200 font-semibold">{folder.ownerName}</span>
                  {folder.ownerNumericId && <span className="font-mono text-zinc-500 ml-1">({format16DigitId(folder.ownerNumericId)})</span>}
                </span>
                <span className="text-zinc-600">•</span>
                <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-zinc-500" />
                  <span>{isArabic ? 'آخر مزامنة:' : 'Synced:'} {new Date(lastUpdated).toLocaleTimeString(isArabic ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Quick Refresh Button */}
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 hover:text-white transition active:scale-95 cursor-pointer disabled:opacity-50"
              title={isArabic ? 'تحديث البيانات الآن' : 'Refresh live data'}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
            </button>

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
              title={isArabic ? 'نسخ رابط هذه الصفحة المباشرة' : 'Copy live link'}
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-blue-400" />}
              <span>{isCopied ? (isArabic ? 'تم النسخ!' : 'Copied!') : (isArabic ? 'نسخ الرابط' : 'Copy Link')}</span>
            </button>

            {onExploreApp && (
              <button
                type="button"
                onClick={() => {
                  onExploreApp();
                  window.dispatchEvent(
                    new CustomEvent('open_shared_accounts_hub', {
                      detail: { tab: 'shared_with_me', folderId: folder?.id },
                    })
                  );
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition active:scale-95 cursor-pointer shadow-md"
                title={isArabic ? 'فتح في تبويب المشارَك معي داخل التطبيق' : 'Open in Shared with Me'}
              >
                <Folder className="w-3.5 h-3.5" />
                <span>{isArabic ? 'تطبيقي' : 'My App'}</span>
              </button>
            )}
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-4 sm:p-6 space-y-4 pb-24">
          {/* Automatic Saved-To-App Notice */}
          <div className="p-3 rounded-2xl bg-purple-950/30 border border-purple-500/30 flex items-center justify-between gap-3 text-xs shadow-md">
            <div className="flex items-center gap-2 text-purple-300">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                {isArabic
                  ? 'تمت إضافة هذه الصفحة تلقائياً إلى تبويب "المشارَك معي" في تطبيقك!'
                  : 'Automatically saved to your "Shared with Me" spaces in your app!'}
              </span>
            </div>
            {onExploreApp && (
              <button
                type="button"
                onClick={() => {
                  onExploreApp();
                  window.dispatchEvent(
                    new CustomEvent('open_shared_accounts_hub', {
                      detail: { tab: 'shared_with_me', folderId: folder?.id },
                    })
                  );
                }}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shrink-0 transition active:scale-95 cursor-pointer text-xs"
              >
                {isArabic ? 'عرض في التطبيق' : 'View in App'}
              </button>
            )}
          </div>
          {/* 1. Global Financial Net Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-md">
              <div className="text-xs font-semibold text-zinc-400">
                {accounts.length > 0
                  ? isArabic ? 'إجمالي رصيد الحسابات' : 'Total Account Balance'
                  : isArabic ? 'صافي العمليات المشتركة' : 'Net Flow'}
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-white mt-1">
                {formatCurrency(totalBalance, currencySymbol, isArabic ? 'ar' : 'en')}
              </div>
              <div className="text-[11px] text-zinc-500 mt-1">
                {isArabic
                  ? `إجمالي العمليات: ${transactions.length}`
                  : `Total Transactions: ${transactions.length}`}
              </div>
            </div>

            <div className="p-4 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-md">
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-400">
                <span>{isArabic ? 'إجمالي الدخل' : 'Total Income'}</span>
                <ArrowDown className="w-3.5 h-3.5" />
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400 mt-1">
                {formatCurrency(totalIncome, currencySymbol, isArabic ? 'ar' : 'en')}
              </div>
              <div className="text-[11px] text-zinc-500 mt-1">
                {isArabic ? 'إجمالي الإيرادات المسجلة' : 'Recorded Incomes'}
              </div>
            </div>

            <div className="p-4 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-md">
              <div className="flex items-center justify-between text-xs font-semibold text-red-400">
                <span>{isArabic ? 'إجمالي المصروفات' : 'Total Expenses'}</span>
                <ArrowUp className="w-3.5 h-3.5" />
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-red-400 mt-1">
                {formatCurrency(totalExpense, currencySymbol, isArabic ? 'ar' : 'en')}
              </div>
              <div className="text-[11px] text-zinc-500 mt-1">
                {isArabic ? 'إجمالي النفقات المسجلة' : 'Recorded Expenses'}
              </div>
            </div>
          </div>

          {/* 2. Unified Grouped Transactions List (Identical to Home Page Design) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-purple-400" />
                <h2 className="text-sm font-bold text-white">
                  {isArabic ? 'سجل العمليات المشتركة' : 'Shared Transactions'}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-mono font-semibold">
                  {transactions.length}
                </span>
              </div>
              <span className="text-[11px] text-zinc-500">
                {isArabic ? 'اضغط على أي عملية لعرض تفاصيلها' : 'Tap any transaction to view details'}
              </span>
            </div>

            {transactions.length === 0 ? (
              <div className="py-16 text-center text-xs text-zinc-500 rounded-3xl bg-zinc-900/40 border border-zinc-800/60 space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-xl">
                  🧾
                </div>
                <p className="text-sm font-medium">
                  {isArabic ? 'لا توجد معاملات مسجلة في هذا الشير حتى الآن.' : 'No transactions recorded in this share yet.'}
                </p>
              </div>
            ) : (
              groupedData.map((monthGroup) => {
                const isMonthCollapsed = Boolean(collapsedMonths[monthGroup.monthKey]);
                const monthTitle = getMonthHeaderTitle(monthGroup.monthKey, isArabic ? 'ar' : 'en');
                const isMonthPositive = monthGroup.monthNet >= 0;

                return (
                  <div
                    key={monthGroup.monthKey}
                    className="rounded-2xl bg-zinc-950 border border-zinc-800/80 overflow-hidden shadow-lg"
                  >
                    {/* Month Header */}
                    <button
                      type="button"
                      onClick={() => toggleMonth(monthGroup.monthKey)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900/90 hover:bg-zinc-850/90 transition border-b border-zinc-800/60 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 font-bold text-white text-sm">
                        {isMonthCollapsed ? (
                          <ChevronRight className="w-4 h-4 text-zinc-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-zinc-400" />
                        )}
                        <span>{monthTitle}</span>
                      </div>
                      <div
                        className={`text-xs font-mono font-bold ${
                          isMonthPositive ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {isMonthPositive ? '+' : ''}
                        {formatCurrency(monthGroup.monthNet, currencySymbol, isArabic ? 'ar' : 'en')}
                      </div>
                    </button>

                    {/* Days list inside Month */}
                    {!isMonthCollapsed && (
                      <div className="p-2 sm:p-3 space-y-3">
                        {monthGroup.days.map((dayGroup) => {
                          const isDayCollapsed = Boolean(collapsedDays[dayGroup.dayKey]);
                          const dayTitle = getDayHeaderTitle(dayGroup.dayKey, isArabic ? 'ar' : 'en');
                          const isDayPositive = dayGroup.dayNet >= 0;

                          return (
                            <div
                              key={dayGroup.dayKey}
                              className="rounded-xl bg-zinc-900/40 border border-zinc-800/50 overflow-hidden"
                            >
                              {/* Day Header */}
                              <button
                                type="button"
                                onClick={() => toggleDay(dayGroup.dayKey)}
                                className="w-full flex items-center justify-between px-3 py-2 bg-zinc-900/50 hover:bg-zinc-800/50 transition cursor-pointer"
                              >
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                                  {isDayCollapsed ? (
                                    <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                                  )}
                                  <span>{dayTitle}</span>
                                </div>
                                <div
                                  className={`text-[11px] font-mono font-semibold ${
                                    isDayPositive ? 'text-emerald-400' : 'text-red-400'
                                  }`}
                                >
                                  {isDayPositive ? '+' : ''}
                                  {formatCurrency(dayGroup.dayNet, currencySymbol, isArabic ? 'ar' : 'en')}
                                </div>
                              </button>

                              {/* Transactions for this Day */}
                              {!isDayCollapsed && (
                                <div className="p-2 space-y-2">
                                  {dayGroup.txs.map((tx) => {
                                    const isTransfer = tx.type === 'transfer';
                                    const isIncome = tx.type === 'income';
                                    const isExpense = tx.type === 'expense';

                                    const fromAcc = tx.accountId ? accountMap.get(tx.accountId) : undefined;
                                    const toAcc = tx.toAccountId ? accountMap.get(tx.toAccountId) : undefined;

                                    let title = '';
                                    if (isTransfer) {
                                      title = `${fromAcc?.name || 'Account'} > ${toAcc?.name || 'Account'}`;
                                    } else if (tx.description && tx.description.trim() !== '') {
                                      title = tx.description;
                                    } else {
                                      title = tx.categoryName || (isArabic ? 'معاملة مالية' : 'Transaction');
                                    }

                                    const timeFormatted = tx.time ? formatTime12h(tx.time, isArabic ? 'ar' : 'en') : '';

                                    let amountColorClass = 'text-blue-400';
                                    let amountSign = '';
                                    if (isIncome) {
                                      amountColorClass = 'text-emerald-500';
                                      amountSign = '+';
                                    } else if (isExpense) {
                                      amountColorClass = 'text-red-500';
                                      amountSign = '-';
                                    } else {
                                      amountColorClass = 'text-blue-400';
                                    }

                                    return (
                                      <div
                                        key={tx.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setViewingTx(tx)}
                                        className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800/90 border border-zinc-800/80 transition cursor-pointer select-none active:scale-[0.99] group shadow-sm"
                                      >
                                        {/* Left: Category Icon */}
                                        <div className="flex items-center gap-3 min-w-0">
                                          <div
                                            className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 ${
                                              isIncome
                                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                : isExpense
                                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                            }`}
                                          >
                                            {isTransfer ? '⇄' : tx.categoryIcon || '💵'}
                                          </div>

                                          {/* Center: Title & Metadata Subtitle */}
                                          <div className="min-w-0 text-left rtl:text-right">
                                            <div className="text-sm font-bold text-white truncate max-w-[180px] sm:max-w-xs group-hover:text-blue-300 transition">
                                              {title}
                                            </div>
                                            <div className="text-xs text-zinc-400 truncate mt-0.5 flex items-center gap-1.5 flex-wrap">
                                              {timeFormatted && <span>{timeFormatted}</span>}
                                              {tx.categoryName && (
                                                <>
                                                  <span className="text-zinc-600">•</span>
                                                  <span className="text-zinc-300">{tx.categoryName}</span>
                                                </>
                                              )}
                                              {fromAcc && (
                                                <>
                                                  <span className="text-zinc-600">•</span>
                                                  <span className="px-1.5 py-0.2 rounded-md bg-zinc-800 text-[10px] text-zinc-300 border border-zinc-700">
                                                    {fromAcc.icon || '🏦'} {fromAcc.name}
                                                  </span>
                                                </>
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        {/* Right: Amount */}
                                        <div className="text-right rtl:text-left shrink-0 pl-2 rtl:pr-2">
                                          <div className={`text-sm font-mono font-bold ${amountColorClass}`}>
                                            {amountSign}{formatCurrency(tx.amount, currencySymbol, isArabic ? 'ar' : 'en')}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </main>

        {/* Read-Only Transaction Details Modal */}
        {viewingTx && (
          <div
            onClick={() => setViewingTx(null)}
            onTouchMove={(e) => e.stopPropagation()}
            className="fixed inset-0 z-[80] flex items-end sm:items-center landscape:items-center justify-center bg-black/75 backdrop-blur-md p-0 sm:p-4 landscape:p-2 overflow-y-auto animate-in fade-in duration-150 overscroll-contain"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md max-h-[92dvh] overflow-y-auto my-auto rounded-t-3xl sm:rounded-3xl landscape:rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl p-6 landscape:p-4 text-white space-y-5 animate-in zoom-in-95 duration-200"
              dir={isArabic ? 'rtl' : 'ltr'}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-purple-400" />
                  <h3 className="text-base font-bold text-white">
                    {isArabic ? 'تفاصيل المعاملة (للقراءة فقط)' : 'Transaction Details (Read Only)'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingTx(null)}
                  className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Big Centered Amount */}
              <div className="text-center py-2 space-y-1">
                <div
                  className={`text-3xl sm:text-4xl font-black font-mono tracking-tight ${
                    viewingTx.type === 'income'
                      ? 'text-emerald-400'
                      : viewingTx.type === 'expense'
                      ? 'text-red-400'
                      : 'text-blue-400'
                  }`}
                >
                  {viewingTx.type === 'income' ? '+' : viewingTx.type === 'expense' ? '-' : ''}
                  {formatCurrency(viewingTx.amount, currencySymbol, isArabic ? 'ar' : 'en')}
                </div>
                <div className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-zinc-900 border border-zinc-800 text-zinc-300">
                  {viewingTx.type === 'income'
                    ? isArabic ? 'دخل' : 'Income'
                    : viewingTx.type === 'expense'
                    ? isArabic ? 'مصروف' : 'Expense'
                    : isArabic ? 'تحويل مالي' : 'Transfer'}
                </div>
              </div>

              {/* Details List */}
              <div className="space-y-2.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-3.5 text-xs">
                {/* Category */}
                <div className="flex items-center justify-between py-1 border-b border-zinc-800/40">
                  <span className="text-zinc-400 flex items-center gap-1.5">
                    <Tags className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{isArabic ? 'التصنيف:' : 'Category:'}</span>
                  </span>
                  <span className="font-semibold text-white flex items-center gap-1">
                    <span>{viewingTx.categoryIcon || '🏷️'}</span>
                    <span>{viewingTx.categoryName || (isArabic ? 'غير محدد' : 'Uncategorized')}</span>
                  </span>
                </div>

                {/* Account */}
                <div className="flex items-center justify-between py-1 border-b border-zinc-800/40">
                  <span className="text-zinc-400 flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{isArabic ? 'الحساب:' : 'Account:'}</span>
                  </span>
                  <span className="font-semibold text-white flex items-center gap-1">
                    {(() => {
                      const acc = viewingTx.accountId ? accountMap.get(viewingTx.accountId) : undefined;
                      return (
                        <>
                          <span>{acc?.icon || '🏦'}</span>
                          <span>{acc?.name || (isArabic ? 'حساب' : 'Account')}</span>
                        </>
                      );
                    })()}
                  </span>
                </div>

                {/* Destination Account if Transfer */}
                {viewingTx.type === 'transfer' && viewingTx.toAccountId && (
                  <div className="flex items-center justify-between py-1 border-b border-zinc-800/40">
                    <span className="text-zinc-400 flex items-center gap-1.5">
                      <Landmark className="w-3.5 h-3.5 text-blue-500" />
                      <span>{isArabic ? 'إلى حساب:' : 'To Account:'}</span>
                    </span>
                    <span className="font-semibold text-white flex items-center gap-1">
                      {(() => {
                        const toAcc = accountMap.get(viewingTx.toAccountId);
                        return (
                          <>
                            <span>{toAcc?.icon || '🏦'}</span>
                            <span>{toAcc?.name || (isArabic ? 'حساب' : 'Account')}</span>
                          </>
                        );
                      })()}
                    </span>
                  </div>
                )}

                {/* Date & Time */}
                <div className="flex items-center justify-between py-1 border-b border-zinc-800/40">
                  <span className="text-zinc-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{isArabic ? 'التاريخ والوقت:' : 'Date & Time:'}</span>
                  </span>
                  <span className="font-mono text-zinc-200">
                    {viewingTx.date}
                    {viewingTx.time && ` • ${formatTime12h(viewingTx.time, isArabic ? 'ar' : 'en')}`}
                  </span>
                </div>

                {/* Description / Notes */}
                {viewingTx.description && viewingTx.description.trim() !== '' && (
                  <div className="py-1">
                    <span className="text-zinc-400 flex items-center gap-1.5 mb-1">
                      <FileText className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{isArabic ? 'الوصف / البيان:' : 'Description:'}</span>
                    </span>
                    <p className="text-zinc-200 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 text-xs leading-relaxed">
                      {viewingTx.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Close Button Only - No Edit or Delete Buttons */}
              <button
                type="button"
                onClick={() => setViewingTx(null)}
                className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-300 hover:text-white text-xs font-bold transition cursor-pointer border border-zinc-800"
              >
                {isArabic ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};