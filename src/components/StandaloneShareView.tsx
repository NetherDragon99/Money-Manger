import { TransferBadge, TransferCard } from './TransferBadge';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  User,
} from 'lucide-react';
import { ref, onValue, off, get } from 'firebase/database';
import { rtdb, ensureFirebaseAuth } from '../utils/firebase';
import {
  ShareFolder,
  useLiveMemberProfiles,
  isRealPhotoUrl,
  resolveOwnerPhoto,
  normalizeParsedShareFolder,
  getCanonicalSharePath,
} from '../utils/shareFolders';
import { cleanNumericId } from '../utils/userId';
import {
  formatCurrency,
  formatTime12h,
  getDayHeaderTitle,
  getMonthHeaderTitle,
} from '../utils/dateCycle';
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
  const currencySymbol = settings?.currencySymbol || '£';

  // Offline fallback snapshot provided via URL parameter (&data=)
  const offlineFallbackSnapshot = useMemo<ShareFolder | null>(() => {
    if (sharedDataSnapshot && sharedDataSnapshot.payload) {
      return sharedDataSnapshot as ShareFolder;
    }
    return null;
  }, [sharedDataSnapshot]);

  // Folder state starts with offline fallback if available, but ALWAYS marked as pending live cloud sync
  const [folder, setFolder] = useState<ShareFolder | null>(offlineFallbackSnapshot);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [isUsingOfflineFallback, setIsUsingOfflineFallback] = useState<boolean>(false);
  // Show full loading spinner only if we have no offline snapshot and are waiting for cloud
  const [isLoading, setIsLoading] = useState<boolean>(!offlineFallbackSnapshot && !!shareId);
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

  // Manual Refresh Handler - fetches live data directly from the mirror / canonical node
  const handleManualRefresh = useCallback(async () => {
    if (!shareId) return;
    setIsRefreshing(true);
    try {
      ensureFirebaseAuth().catch(() => {});
      const targetPath = shareId.startsWith('link_')
        ? `shared_accounts/${shareId}`
        : getCanonicalSharePath(shareId);
      const snap = await get(ref(rtdb, targetPath));
      if (snap.exists() && snap.val() && snap.val().deleted !== true) {
        const parsed = normalizeParsedShareFolder(snap.val(), shareId);
        if (parsed) {
          setFolder(parsed);
          setIsLiveConnected(true);
          setIsUsingOfflineFallback(false);
          setLastUpdated(parsed.updatedAt || Date.now());
          setError(null);
          showToast?.(isArabic ? 'تم تحديث البيانات لحظياً من السحابة!' : 'Updated with latest live data!', 'success');
        }
      } else {
        setFolder(null);
        setError(isArabic ? 'هذا الرابط لم يعد متاحاً.' : 'This link is no longer available.');
      }
    } catch (err) {
      console.warn('[StandaloneShareView] Manual refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [shareId, isArabic, showToast]);

  useEffect(() => {
    if (!shareId && !offlineFallbackSnapshot) {
      setError(isArabic ? 'هذا الرابط لم يعد متاحاً.' : 'This link is no longer available.');
      setIsLoading(false);
      return;
    }

    // Clean URL: Strip &data= snapshot parameter from address bar
    // so any browser reload fetches the live version directly from Firebase RTDB
    if (typeof window !== 'undefined' && shareId && window.location.search.includes('data=')) {
      const cleanUrl = `${window.location.origin}${window.location.pathname}?share=${encodeURIComponent(shareId)}`;
      window.history.replaceState({}, '', cleanUrl);
    }

    if (!shareId) {
      if (offlineFallbackSnapshot) {
        setFolder(offlineFallbackSnapshot);
        setIsUsingOfflineFallback(true);
        setIsLoading(false);
      }
      return;
    }

    let isMounted = true;
    let hasReceivedLiveCloudData = false;

    // Trigger non-blocking anonymous/authenticated Firebase session
    ensureFirebaseAuth().catch(() => {});

    // Target mirror node: flat path shared_accounts/link_${token} (or legacy canonical path)
    const targetPath = shareId.startsWith('link_')
      ? `shared_accounts/${shareId}`
      : getCanonicalSharePath(shareId);

    const targetRef = ref(rtdb, targetPath);
    const connectedRef = ref(rtdb, '.info/connected');

    // Helper to safely apply live streaming data from Firebase RTDB
    const applyLiveData = (liveData: ShareFolder) => {
      if (!isMounted) return;
      hasReceivedLiveCloudData = true;
      setIsLiveConnected(true);
      setIsUsingOfflineFallback(false);
      setIsLoading(false);
      setError(null);
      setLastUpdated(liveData.updatedAt || Date.now());

      setFolder((prev) => {
        if (!prev) return liveData;
        const prevSig = `${prev.updatedAt}_${prev.payload.transactions.length}_${prev.payload.accounts.length}_${prev.payload.categories.length}_${JSON.stringify(prev.payload)}`;
        const liveSig = `${liveData.updatedAt}_${liveData.payload.transactions.length}_${liveData.payload.accounts.length}_${liveData.payload.categories.length}_${JSON.stringify(liveData.payload)}`;
        if (prevSig !== liveSig) {
          return liveData;
        }
        return prev;
      });
    };

    const handleSnapshot = (snap: any) => {
      if (!isMounted) return;
      if (!snap.exists() || !snap.val() || snap.val().deleted === true) {
        setFolder(null);
        setIsLiveConnected(false);
        setIsLoading(false);
        setError(isArabic ? 'هذا الرابط لم يعد متاحاً.' : 'This link is no longer available.');
        return;
      }
      const val = snap.val();
      const parsed = normalizeParsedShareFolder(val, shareId);
      if (parsed) {
        applyLiveData(parsed);
      } else {
        setFolder(null);
        setIsLoading(false);
        setError(isArabic ? 'هذا الرابط لم يعد متاحاً.' : 'This link is no longer available.');
      }
    };

    const handleConnected = (snap: any) => {
      if (!isMounted) return;
      const isConn = Boolean(snap.val());
      setIsLiveConnected(isConn);
      if (isConn) {
        get(targetRef).then(handleSnapshot).catch(() => {});
      }
    };

    // Continuous Real-time Streaming Subscription ONLY on the target mirror node
    onValue(targetRef, handleSnapshot, (err) => {
      if (!isMounted) return;
      console.warn('[StandaloneShareView] onValue error:', err);
      if (!hasReceivedLiveCloudData) {
        if (offlineFallbackSnapshot) {
          setFolder(offlineFallbackSnapshot);
          setIsUsingOfflineFallback(true);
          setIsLoading(false);
        } else {
          setError(isArabic ? 'هذا الرابط لم يعد متاحاً.' : 'This link is no longer available.');
          setIsLoading(false);
        }
      }
    });

    // Re-attach / re-verify when connection status toggles back to online
    onValue(connectedRef, handleConnected);

    return () => {
      isMounted = false;
      off(targetRef, 'value', handleSnapshot);
      off(connectedRef, 'value', handleConnected);
    };
  }, [shareId, offlineFallbackSnapshot, isArabic]);

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

  // Exclusively track the Share Owner's profile (never any members or 16-digit IDs)
  const folderOwner16 = cleanNumericId(folder?.owner16DigitId || folder?.ownerNumericId);
  const ownerLiveMap = useLiveMemberProfiles(folderOwner16 ? [folderOwner16] : []);
  const ownerLiveProf = folderOwner16 ? ownerLiveMap[folderOwner16] : undefined;
  const effectiveOwnerName = ownerLiveProf?.name || folder?.ownerName || 'User';
  const rawOwnerPhoto = (ownerLiveProf?.photoURL && ownerLiveProf.photoURL.trim()) || folder?.ownerPhotoURL || resolveOwnerPhoto(folder || {}, settings?.userProfile);
  const effectiveOwnerPhoto = isRealPhotoUrl(rawOwnerPhoto) ? rawOwnerPhoto.trim() : '';
  const effectiveOwnerAvatar = ownerLiveProf?.avatar || (!isRealPhotoUrl(rawOwnerPhoto) && rawOwnerPhoto ? rawOwnerPhoto : (folder?.ownerAvatar || '👤'));

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
        <div className="w-16 h-16 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-3xl mb-4 shadow-xl">
          🔒
        </div>
        <h2 className="text-lg font-bold text-white mb-2">
          {isArabic ? 'هذا الرابط لم يعد متاحاً' : 'This link is no longer available'}
        </h2>
        <p className="text-xs text-zinc-400 max-w-sm mb-6 leading-relaxed">
          {error || (isArabic
            ? 'قد يكون صاحب الرابط قام بإعادة إنشاء رابط جديد أو حذف مساحة المشاركة.'
            : 'The owner may have regenerated a new link or removed the shared space.')}
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
      <div className="w-full max-w-none md:max-w-7xl landscape:max-w-none min-h-screen bg-black flex flex-col shadow-2xl relative">
        {/* Top Header Bar: Clean Flexbox Container (No Absolute Positioning, Prominent Space Name Center, Refresh Far Right) */}
        <header className="sticky top-0 z-30 px-3 sm:px-6 py-3 bg-black/95 backdrop-blur-xl border-b border-zinc-800/80 flex items-center justify-between gap-3 w-full">
          {/* Left Actions: Open in App / Copy Link */}
          <div className="flex items-center gap-2 shrink-0">
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition active:scale-95 cursor-pointer shadow-sm"
                title={isArabic ? 'فتح في تبويب المشارَك معي داخل التطبيق' : 'Open in Shared with Me'}
              >
                <Folder className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isArabic ? 'تطبيقي' : 'My App'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold transition active:scale-95 cursor-pointer"
              title={isArabic ? 'نسخ رابط هذه الصفحة المباشرة' : 'Copy live link'}
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-blue-400" />}
              <span className="hidden sm:inline">{isCopied ? (isArabic ? 'تم النسخ!' : 'Copied!') : (isArabic ? 'نسخ الرابط' : 'Copy Link')}</span>
            </button>
          </div>

          {/* Center Prominent Heading: Actual Share Space Name */}
          <div className="flex-1 flex flex-col items-center justify-center text-center min-w-0 px-2 sm:px-4">
            <div className="flex items-center justify-center gap-2 min-w-0 max-w-full">
              <span className="text-xl sm:text-2xl shrink-0 leading-none">{folder.icon || '📁'}</span>
              <h1 className="text-sm sm:text-lg md:text-xl font-black text-white truncate tracking-tight">
                {folder.name}
              </h1>
            </div>
            <div className="text-[11px] text-zinc-400 truncate max-w-full flex items-center justify-center gap-1.5 mt-0.5">
              <span className="inline-flex items-center gap-1.5 truncate">
                {effectiveOwnerPhoto ? (
                  <img
                    src={effectiveOwnerPhoto}
                    alt={effectiveOwnerName}
                    className="w-4 h-4 rounded-full object-cover border border-purple-500/40 shrink-0"
                  />
                ) : (
                  <span className="text-xs shrink-0">{effectiveOwnerAvatar}</span>
                )}
                <span className="truncate">
                  {isArabic ? 'مشاركة من:' : 'Shared by:'}{' '}
                  <span className="text-zinc-200 font-semibold">{effectiveOwnerName}</span>
                </span>
              </span>
              <span className="text-zinc-600">•</span>
              <span className="text-zinc-400 font-mono text-[10px] bg-zinc-900 px-2 py-0.5 rounded-md border border-zinc-800">
                {isArabic ? 'آخر تحديث:' : 'Last updated:'}{' '}
                {new Date(lastUpdated).toLocaleTimeString(isArabic ? 'ar-EG' : 'en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>

          {/* Right Actions: Import Copy & Refresh Button neatly on the far right without overlap */}
          <div className="flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={handleImportToApp}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-semibold transition active:scale-95 cursor-pointer"
              title={isArabic ? 'استيراد نسخة إلى تطبيقي' : 'Import snapshot to my app'}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isArabic ? 'استيراد' : 'Import'}</span>
            </button>

            {/* Quick Refresh Button on Far Right */}
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-200 hover:text-white transition active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5 text-xs font-semibold shadow-sm"
              title={isArabic ? 'تحديث البيانات الآن' : 'Refresh live data'}
              aria-label={isArabic ? 'تحديث' : 'Refresh'}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : 'text-zinc-300'}`} />
              <span className="hidden sm:inline">{isArabic ? 'تحديث' : 'Refresh'}</span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-4 sm:p-6 space-y-4 pb-24">
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

                                    const fromAcc = tx.accountId ? accountMap.get(tx.accountId) : undefined;
                                    const toAcc = tx.toAccountId ? accountMap.get(tx.toAccountId) : undefined;

                                    const fromName = tx.fromAccountName || fromAcc?.name || (isArabic ? 'حساب' : 'Account');
                                    const toName = tx.toAccountName || toAcc?.name || (isArabic ? 'حساب' : 'Account');
                                    const fromIcon = tx.fromAccountIcon || fromAcc?.icon || '🏦';
                                    const toIcon = tx.toAccountIcon || toAcc?.icon || '🏦';

                                    const timeFormatted = tx.time ? formatTime12h(tx.time, isArabic ? 'ar' : 'en') : '';

                                    if (isTransfer) {
                                      return (
                                        <TransferCard
                                          key={tx.id}
                                          transaction={tx}
                                          fromAccount={fromAcc}
                                          toAccount={toAcc}
                                          fromName={fromName}
                                          toName={toName}
                                          fromIcon={fromIcon}
                                          toIcon={toIcon}
                                          fromColor={fromAcc?.color}
                                          toColor={toAcc?.color}
                                          currencySymbol={currencySymbol}
                                          language={isArabic ? 'ar' : 'en'}
                                          timeFormatted={timeFormatted}
                                          onClick={() => setViewingTx(tx)}
                                        />
                                      );
                                    }

                                    let title = '';
                                    if (tx.description && tx.description.trim() !== '') {
                                      title = tx.description;
                                    } else {
                                      title = tx.categoryName || (isArabic ? 'معاملة مالية' : 'Transaction');
                                    }

                                    const amountColorClass = isIncome ? 'text-emerald-500' : 'text-red-500';
                                    const amountSign = isIncome ? '+' : '-';

                                    return (
                                      <div
                                        key={tx.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setViewingTx(tx)}
                                        className="flex flex-col p-3.5 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800/90 border border-zinc-800/80 transition cursor-pointer select-none active:scale-[0.99] group shadow-sm"
                                      >
                                        <div className="flex items-center justify-between w-full">
                                          {/* Left: Category Icon */}
                                          <div className="flex items-center gap-3 min-w-0">
                                            <div
                                              className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 ${
                                                isIncome
                                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                              }`}
                                            >
                                              {tx.categoryIcon || '💵'}
                                            </div>

                                            {/* Center: Title & Metadata Subtitle */}
                                            <div className="min-w-0 text-left rtl:text-right">
                                              <div className="flex items-center gap-1.5 min-w-0">
                                                <span className="text-sm font-bold text-white truncate max-w-[180px] sm:max-w-xs group-hover:text-blue-300 transition">
                                                  {title}
                                                </span>
                                                {Boolean(tx.isFromRecurring || tx.recurringRuleId) && (
                                                  <span
                                                    className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded-full text-[9px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0"
                                                    title={isArabic ? 'معاملة متكررة تلقائياً' : 'Automated Recurring'}
                                                  >
                                                    <RefreshCw className="w-2 h-2 shrink-0" />
                                                    <span className="text-[8px]">{isArabic ? 'دورية' : 'Recurring'}</span>
                                                  </span>
                                                )}
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
                {Boolean(viewingTx.isFromRecurring || viewingTx.recurringRuleId) && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                    <span>{isArabic ? 'معاملة متكررة تلقائياً' : 'Automated Recurring Transaction'}</span>
                  </div>
                )}
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
                {viewingTx.type === 'transfer' && (
                  <div className="flex items-center justify-between py-1 border-b border-zinc-800/40">
                    <span className="text-zinc-400 flex items-center gap-1.5">
                      <Landmark className="w-3.5 h-3.5 text-blue-500" />
                      <span>{isArabic ? 'إلى حساب:' : 'To Account:'}</span>
                    </span>
                    <span className="font-semibold text-white flex items-center gap-1">
                      {(() => {
                        const toAcc = viewingTx.toAccountId ? accountMap.get(viewingTx.toAccountId) : undefined;
                        const icon = viewingTx.toAccountIcon || toAcc?.icon || '🏦';
                        const name = viewingTx.toAccountName || toAcc?.name || (isArabic ? 'حساب' : 'Account');
                        return (
                          <>
                            <span>{icon}</span>
                            <span>{name}</span>
                          </>
                        );
                      })()}
                    </span>
                  </div>
                )}

                {/* Transfer Dual Balances in Details Modal */}
                {viewingTx.type === 'transfer' && (viewingTx.fromBalanceBefore !== undefined || viewingTx.toBalanceBefore !== undefined) && (
                  <div className="py-2 border-b border-zinc-800/40 space-y-1.5">
                    <span className="text-xs text-zinc-400 font-semibold block">
                      {isArabic ? 'أرصدة الحسابات قبل وبعد التحويل:' : 'Balances Before & After Transfer:'}
                    </span>
                    <div className="space-y-1.5 text-xs font-mono">
                      {viewingTx.fromBalanceBefore !== undefined && viewingTx.fromBalanceAfter !== undefined && (
                        <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-900 border border-zinc-800">
                          <span className="text-zinc-300 font-semibold flex items-center gap-1">
                            <span>{viewingTx.fromAccountIcon || accountMap.get(viewingTx.accountId)?.icon || '🏦'}</span>
                            <span>{viewingTx.fromAccountName || accountMap.get(viewingTx.accountId)?.name || (isArabic ? 'من حساب' : 'From Account')}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="text-zinc-400">{formatCurrency(viewingTx.fromBalanceBefore, currencySymbol, isArabic ? 'ar' : 'en')}</span>
                            <span className="text-red-400">→</span>
                            <span className="font-bold text-red-400">{formatCurrency(viewingTx.fromBalanceAfter, currencySymbol, isArabic ? 'ar' : 'en')}</span>
                          </span>
                        </div>
                      )}
                      {viewingTx.toBalanceBefore !== undefined && viewingTx.toBalanceAfter !== undefined && (
                        <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-900 border border-zinc-800">
                          <span className="text-zinc-300 font-semibold flex items-center gap-1">
                            <span>{viewingTx.toAccountIcon || (viewingTx.toAccountId ? accountMap.get(viewingTx.toAccountId)?.icon : '🏦') || '🏦'}</span>
                            <span>{viewingTx.toAccountName || (viewingTx.toAccountId ? accountMap.get(viewingTx.toAccountId)?.name : (isArabic ? 'إلى حساب' : 'To Account')) || (isArabic ? 'إلى حساب' : 'To Account')}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="text-zinc-400">{formatCurrency(viewingTx.toBalanceBefore, currencySymbol, isArabic ? 'ar' : 'en')}</span>
                            <span className="text-emerald-400">→</span>
                            <span className="font-bold text-emerald-400">{formatCurrency(viewingTx.toBalanceAfter, currencySymbol, isArabic ? 'ar' : 'en')}</span>
                          </span>
                        </div>
                      )}
                    </div>
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