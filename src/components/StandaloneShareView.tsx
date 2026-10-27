import { TransferBadge } from './TransferBadge';
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
  User,
} from 'lucide-react';
import {
  fetchShareFolderFromCloud,
  ShareFolder,
  subscribeToShareFolder,
  registerReceivedShareFolder,
  useLiveMemberProfiles,
  isRealPhotoUrl,
  resolveOwnerPhoto,
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

  // Manual Refresh Handler - fetches live data directly from Firebase cloud
  const handleManualRefresh = useCallback(async () => {
    if (!shareId) return;
    setIsRefreshing(true);
    try {
      ensureFirebaseAuth().catch(() => {});
      const freshData = await fetchShareFolderFromCloud(shareId);
      if (freshData) {
        setFolder(freshData);
        setIsLiveConnected(true);
        setIsUsingOfflineFallback(false);
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
    if (!shareId && !offlineFallbackSnapshot) {
      setError(isArabic ? 'رابط المشاركة غير صالح أو انتهت صلاحيته.' : 'Invalid or expired share link.');
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

    // Helper to safely apply live streaming data from Firebase RTDB
    const applyLiveData = (liveData: ShareFolder) => {
      if (!isMounted) return;
      hasReceivedLiveCloudData = true;
      setIsLiveConnected(true);
      setIsUsingOfflineFallback(false);
      setIsLoading(false);
      setError(null);
      setLastUpdated(Date.now());

      setFolder((prev) => {
        if (!prev) return liveData;
        const prevSig = `${prev.updatedAt}_${prev.payload.transactions.length}_${prev.payload.accounts.length}_${prev.payload.categories.length}_${JSON.stringify(prev.payload)}`;
        const liveSig = `${liveData.updatedAt}_${liveData.payload.transactions.length}_${liveData.payload.accounts.length}_${liveData.payload.categories.length}_${JSON.stringify(liveData.payload)}`;
        if (prevSig !== liveSig) {
          return liveData;
        }
        return prev;
      });

      // Register or update received folder in local storage
      registerReceivedShareFolder(
        liveData,
        settings?.userProfile?.numericId,
        settings?.userProfile?.name,
        settings?.userProfile?.avatarEmoji,
        settings?.userProfile?.customAvatarUrl
      );
    };

    // 1. Immediate cloud fetch priority
    fetchShareFolderFromCloud(shareId)
      .then((data) => {
        if (!isMounted) return;
        if (data) {
          applyLiveData(data);
        } else if (!hasReceivedLiveCloudData) {
          // If cloud has no record yet, strictly fallback to offline snapshot if available
          if (offlineFallbackSnapshot) {
            setFolder(offlineFallbackSnapshot);
            setIsUsingOfflineFallback(true);
            setIsLoading(false);
          } else {
            setError(
              isArabic
                ? 'لم يتم العثور على صفحة المشاركة المطلوبة، أو ربما قام المالك بإلغائها.'
                : 'Shared space not found or was removed by owner.'
            );
            setIsLoading(false);
          }
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('[StandaloneShareView] Immediate fetch error:', err);
        if (!hasReceivedLiveCloudData) {
          if (offlineFallbackSnapshot) {
            setFolder(offlineFallbackSnapshot);
            setIsUsingOfflineFallback(true);
            setIsLoading(false);
          } else {
            setError(
              isArabic
                ? 'تعذر تحميل بيانات المشاركة. يرجى التحقق من اتصالك بالإنترنت.'
                : 'Could not load share data. Check your connection.'
            );
            setIsLoading(false);
          }
        }
      });

    // 2. Continuous Real-time Streaming Subscription on Firebase RTDB via onValue()
    const unsub = subscribeToShareFolder(shareId, (liveData) => {
      if (liveData) {
        applyLiveData(liveData);
      }
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, [shareId, offlineFallbackSnapshot, isArabic, settings]);

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

  const allMember16Ids = useMemo(() => {
    const set = new Set<string>();
    const o16 = cleanNumericId(folder?.owner16DigitId || folder?.ownerNumericId);
    if (o16) set.add(o16);
    (folder?.members || []).forEach((m) => {
      const mid = cleanNumericId(m.numericId);
      if (mid) set.add(mid);
    });
    (folder?.member16Ids || []).forEach((id) => {
      const mid = cleanNumericId(id);
      if (mid) set.add(mid);
    });
    (folder?.payload?.transactions || []).forEach((tx: any) => {
      const sid = cleanNumericId(tx.sender16Id);
      if (sid) set.add(sid);
    });
    return Array.from(set);
  }, [folder?.owner16DigitId, folder?.ownerNumericId, folder?.members, folder?.member16Ids, folder?.payload?.transactions]);

  const liveProfiles = useLiveMemberProfiles(allMember16Ids);

  const folderOwner16 = cleanNumericId(folder?.owner16DigitId || folder?.ownerNumericId);
  const ownerLiveProf = folderOwner16 ? liveProfiles[folderOwner16] : undefined;
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
              <span className="text-zinc-500 font-mono text-[10px]">
                {new Date(lastUpdated).toLocaleTimeString(isArabic ? 'ar-EG' : 'en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
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

          {/* Active Members Live Strip */}
          {((folder?.members && folder.members.length > 0) || folderOwner16) && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
              {/* Owner Chip */}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900/90 border border-blue-500/30 shrink-0 shadow-sm">
                <div className="w-5 h-5 rounded-full overflow-hidden bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-[11px] shrink-0">
                  {effectiveOwnerPhoto ? (
                    <img src={effectiveOwnerPhoto} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span>{effectiveOwnerAvatar}</span>
                  )}
                </div>
                <span className="font-semibold text-white max-w-[100px] truncate">{effectiveOwnerName}</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  {isArabic ? 'المالك' : 'Owner'}
                </span>
              </div>

              {/* Members */}
              {(folder?.members || []).map((m, idx) => {
                const mid = cleanNumericId(m.numericId);
                const prof = mid ? liveProfiles[mid] : undefined;
                const mName = prof?.name || m.name || (mid ? `User ${mid.slice(0, 4)}` : 'Member');
                const mRawPhoto = (prof?.photoURL && prof.photoURL.trim()) || m.photoURL || '';
                const mPhoto = isRealPhotoUrl(mRawPhoto) ? mRawPhoto.trim() : '';
                const mAvatar = prof?.avatar || (!isRealPhotoUrl(mRawPhoto) && mRawPhoto ? mRawPhoto : (m.avatar || '👤'));

                return (
                  <div key={m.numericId || idx} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800 shrink-0 shadow-sm">
                    <div className="w-5 h-5 rounded-full overflow-hidden bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-[11px] shrink-0">
                      {mPhoto ? (
                        <img src={mPhoto} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span>{mAvatar}</span>
                      )}
                    </div>
                    <span className="font-semibold text-zinc-300 max-w-[100px] truncate">{mName}</span>
                  </div>
                );
              })}
            </div>
          )}
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

                                    const fromName = tx.fromAccountName || fromAcc?.name || (isArabic ? 'حساب' : 'Account');
                                    const toName = tx.toAccountName || toAcc?.name || (isArabic ? 'حساب' : 'Account');
                                    const fromIcon = tx.fromAccountIcon || fromAcc?.icon || '🏦';
                                    const toIcon = tx.toAccountIcon || toAcc?.icon || '🏦';

                                    let title = '';
                                    if (isTransfer) {
                                      title = isArabic ? `من ${fromName} إلى ${toName}` : `From ${fromName} → To ${toName}`;
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
                                        className="flex flex-col p-3.5 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800/90 border border-zinc-800/80 transition cursor-pointer select-none active:scale-[0.99] group shadow-sm"
                                      >
                                        <div className="flex items-center justify-between w-full">
                                          {/* Left: Category Icon */}
                                          <div className="flex items-center gap-3 min-w-0">
                                            {isTransfer ? (
                                              <TransferBadge
                                                fromIcon={fromIcon}
                                                fromName={fromName}
                                                fromColor={fromAcc?.color}
                                                toIcon={toIcon}
                                                toName={toName}
                                                toColor={toAcc?.color}
                                                size="md"
                                              />
                                            ) : (
                                              <div
                                                className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 ${
                                                  isIncome
                                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                                }`}
                                              >
                                                {tx.categoryIcon || '💵'}
                                              </div>
                                            )}

                                            {/* Center: Title & Metadata Subtitle */}
                                            <div className="min-w-0 text-left rtl:text-right">
                                              <div className="text-sm font-bold text-white truncate max-w-[180px] sm:max-w-xs group-hover:text-blue-300 transition">
                                                {title}
                                              </div>
                                              <div className="text-xs text-zinc-400 truncate mt-0.5 flex items-center gap-1.5 flex-wrap">
                                                {isTransfer && (
                                                  <span className="text-blue-400 font-semibold">{isArabic ? 'تحويل' : 'Transfer'}</span>
                                                )}
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
                                                {/* Live Transaction Author Badge */}
                                                {((tx as any).sender16Id || (tx as any).senderName) && (() => {
                                                  const s16 = cleanNumericId((tx as any).sender16Id);
                                                  const sProf = s16 ? liveProfiles[s16] : undefined;
                                                  const authorName = sProf?.name || (tx as any).senderName || (s16 ? `User ${s16.slice(0, 4)}` : '');
                                                  const authorRawPhoto = (sProf?.photoURL && sProf.photoURL.trim()) || '';
                                                  const authorPhoto = isRealPhotoUrl(authorRawPhoto) ? authorRawPhoto : '';
                                                  const authorAvatar = sProf?.avatar || (!isRealPhotoUrl(authorRawPhoto) && authorRawPhoto ? authorRawPhoto : ((tx as any).senderAvatar || '👤'));

                                                  if (!authorName) return null;

                                                  return (
                                                    <>
                                                      <span className="text-zinc-600">•</span>
                                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-zinc-800 border border-zinc-700/80 text-[10px] text-zinc-300 max-w-[130px] truncate">
                                                        {authorPhoto ? (
                                                          <img src={authorPhoto} alt="" className="w-3 h-3 rounded-full object-cover shrink-0" />
                                                        ) : (
                                                          <span className="text-[9px] shrink-0">{authorAvatar}</span>
                                                        )}
                                                        <span className="truncate">{authorName}</span>
                                                      </span>
                                                    </>
                                                  );
                                                })()}
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

                                        {/* Transfer: Before & After Balances for BOTH accounts */}
                                        {isTransfer && (tx.fromBalanceBefore !== undefined || tx.toBalanceBefore !== undefined) && (
                                          <div className="mt-2.5 pt-2 border-t border-zinc-800/60 flex flex-wrap items-center gap-1.5 sm:gap-2.5 text-[10px] font-mono">
                                            {tx.fromBalanceBefore !== undefined && tx.fromBalanceAfter !== undefined && (
                                              <div className="flex items-center gap-1 bg-zinc-950/90 border border-zinc-800/80 px-2 py-0.5 rounded-lg max-w-full">
                                                <span className="text-xs shrink-0">{fromIcon}</span>
                                                <span className="font-semibold text-zinc-300 truncate max-w-[85px] sm:max-w-[110px]">
                                                  {fromName}:
                                                </span>
                                                <span className="text-zinc-400">{formatCurrency(tx.fromBalanceBefore, currencySymbol, isArabic ? 'ar' : 'en')}</span>
                                                <span className="text-red-400 font-bold">→</span>
                                                <span className="font-bold text-red-400">{formatCurrency(tx.fromBalanceAfter, currencySymbol, isArabic ? 'ar' : 'en')}</span>
                                              </div>
                                            )}

                                            {tx.toBalanceBefore !== undefined && tx.toBalanceAfter !== undefined && (
                                              <div className="flex items-center gap-1 bg-zinc-950/90 border border-zinc-800/80 px-2 py-0.5 rounded-lg max-w-full">
                                                <span className="text-xs shrink-0">{toIcon}</span>
                                                <span className="font-semibold text-zinc-300 truncate max-w-[85px] sm:max-w-[110px]">
                                                  {toName}:
                                                </span>
                                                <span className="text-zinc-400">{formatCurrency(tx.toBalanceBefore, currencySymbol, isArabic ? 'ar' : 'en')}</span>
                                                <span className="text-emerald-400 font-bold">→</span>
                                                <span className="font-bold text-emerald-400">{formatCurrency(tx.toBalanceAfter, currencySymbol, isArabic ? 'ar' : 'en')}</span>
                                              </div>
                                            )}
                                          </div>
                                        )}
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

                {/* Transaction Author in Modal */}
                {((viewingTx as any).sender16Id || (viewingTx as any).senderName) && (() => {
                  const s16 = cleanNumericId((viewingTx as any).sender16Id);
                  const sProf = s16 ? liveProfiles[s16] : undefined;
                  const authorName = sProf?.name || (viewingTx as any).senderName || (s16 ? `User ${s16.slice(0, 4)}` : '');
                  const authorRawPhoto = (sProf?.photoURL && sProf.photoURL.trim()) || '';
                  const authorPhoto = isRealPhotoUrl(authorRawPhoto) ? authorRawPhoto : '';
                  const authorAvatar = sProf?.avatar || (!isRealPhotoUrl(authorRawPhoto) && authorRawPhoto ? authorRawPhoto : ((viewingTx as any).senderAvatar || '👤'));

                  if (!authorName) return null;

                  return (
                    <div className="flex items-center justify-between py-1 border-b border-zinc-800/40">
                      <span className="text-zinc-400 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-purple-400" />
                        <span>{isArabic ? 'بواسطة:' : 'Added by:'}</span>
                      </span>
                      <span className="font-semibold text-white flex items-center gap-1.5">
                        {authorPhoto ? (
                          <img src={authorPhoto} alt="" className="w-4 h-4 rounded-full object-cover" />
                        ) : (
                          <span>{authorAvatar}</span>
                        )}
                        <span>{authorName}</span>
                      </span>
                    </div>
                  );
                })()}

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