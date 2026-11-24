import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useAppActions, useAppAuth, useAppData, useAppUI } from '../context/AppContext';
import { navigateBack } from '../context/NavigationContext';
import {
  X,
  Sliders,
  Download,
  Sparkles,
  RotateCw,
  Coins,
  BookOpen,
  Check,
  RefreshCw,
  Share2,
  Trash2,
  Loader2,
  LogOut,
  LogIn,
  ChevronRight,
  WifiOff,
  CheckCircle2,
} from 'lucide-react';
import { format16DigitId } from '../utils/userId';
import { isRealPhotoUrl } from '../utils/shareFolders';
import { CURRENT_APP_VERSION, formatFullVersionWithBuild } from '../utils/versionChecker';
import { auth, loginWithGoogle } from '../utils/firebase';
import { signOut } from 'firebase/auth';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const Sidebar: React.FC = () => {
  const { settings, recurringTransactions, smartBudgetEvaluation, t } = useAppData();
  const { isSidebarOpen } = useAppUI();
  const {
    setIsSidebarOpen,
    setIsUserProfileModalOpen,
    setIsFeaturesModalOpen,
    setIsRecurringModalOpen,
    setIsSmartBudgetModalOpen,
    setIsSettingsModalOpen,
    setIsTransferFeesModalOpen,
    processDueRecurring,
    setIsSharedHubModalOpen,
    signOutUser,
    showToast,
    showConfirm,
  } = useAppActions();
  const { authUser, syncStatus, lastSyncedAt } = useAppAuth();
  const { isInstalled: isPwaInstalled, install: triggerPwaInstall, offlineStatus, refreshCache } = usePWAInstall();

  const currentUser = authUser;
  const sidebarTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const isArabic = settings.language === 'ar';

  const hasSmartBudgetAlert = useMemo(
    () =>
      !smartBudgetEvaluation.isPaused &&
      (smartBudgetEvaluation.dailyStatus.allowanceState === 'true_deficit' ||
        smartBudgetEvaluation.anomalies.some((a) => a.severity === 'critical')),
    [smartBudgetEvaluation]
  );

  const handleOuterSignIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSigningIn) return;
    setIsSigningIn(true);
    loginWithGoogle()
      .then(() => {
        showToast(
          isArabic ? 'تم تسجيل الدخول بنجاح!' : 'Signed in with Google successfully!',
          'success'
        );
      })
      .catch((err: any) => {
        if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
          showToast(err?.message || (isArabic ? 'فشل تسجيل الدخول' : 'Sign in failed'), 'error');
        }
      })
      .finally(() => {
        setIsSigningIn(false);
      });
  };

  const handleDirectInstallClick = async () => {
    await triggerPwaInstall();
  };

  const [isClosing, setIsClosing] = useState(false);

  const handleAnimatedClose = (afterClose?: () => void) => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      if (afterClose) {
        setIsSidebarOpen(false);
        afterClose();
      } else {
        navigateBack();
      }
    }, 180);
  };

  // 1:1 Finger-tracking state for opening and closing sidebar
  const [openDragProgress, setOpenDragProgress] = useState<number | null>(null);
  const [closeDragDelta, setCloseDragDelta] = useState<number>(0);
  const [isClosingDrag, setIsClosingDrag] = useState<boolean>(false);

  useEffect(() => {
    const handleGlobalSidebarDrag = (e: Event) => {
      const customEvent = e as CustomEvent<{
        phase: 'start' | 'move' | 'end';
        deltaX: number;
        clientX: number;
        isRtl?: boolean;
      }>;
      if (!customEvent.detail) return;
      const { phase, deltaX } = customEvent.detail;
      const drawerWidth = 336;

      if (phase === 'start') {
        setOpenDragProgress(0);
      } else if (phase === 'move') {
        const rtl = customEvent.detail.isRtl ?? (settings.language === 'ar');
        const distance = rtl ? -deltaX : deltaX;
        const prog = Math.min(Math.max(distance / drawerWidth, 0), 1);
        setOpenDragProgress(prog);
      } else if (phase === 'end') {
        const rtl = customEvent.detail.isRtl ?? (settings.language === 'ar');
        const distance = rtl ? -deltaX : deltaX;
        const prog = Math.min(Math.max(distance / drawerWidth, 0), 1);
        if (prog > 0.22) {
          setIsSidebarOpen(true);
        }
        setOpenDragProgress(null);
      }
    };

    window.addEventListener('mm-sidebar-drag', handleGlobalSidebarDrag);
    return () => window.removeEventListener('mm-sidebar-drag', handleGlobalSidebarDrag);
  }, [settings.language, setIsSidebarOpen]);

  const handleSidebarTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    sidebarTouchStartRef.current = { x: touch.clientX, y: touch.clientY };
    setCloseDragDelta(0);
  };

  const handleSidebarTouchMove = (e: React.TouchEvent) => {
    if (!sidebarTouchStartRef.current) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - sidebarTouchStartRef.current.x;
    const deltaY = touch.clientY - sidebarTouchStartRef.current.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absY > 8 && absY >= absX) {
      setIsClosingDrag(false);
      return;
    }
    if (absX < 12 && absY < 12) return;
    if (absY >= absX) {
      setIsClosingDrag(false);
      return;
    }

    if (absX > absY * 1.5 && absX > 12) {
      setIsClosingDrag(true);
      const closingDelta = isArabic ? Math.max(0, deltaX) : Math.min(0, deltaX);
      setCloseDragDelta(closingDelta);
    }
  };

  const handleSidebarTouchEnd = () => {
    if (!sidebarTouchStartRef.current) return;
    sidebarTouchStartRef.current = null;
    setIsClosingDrag(false);

    const drawerWidth = 336;
    const absDelta = Math.abs(closeDragDelta);
    if (absDelta > 70 || absDelta / drawerWidth > 0.22) {
      handleAnimatedClose();
    }
    setCloseDragDelta(0);
  };

  const [isRefreshingApp, setIsRefreshingApp] = useState(false);
  const [isWarmingOffline, setIsWarmingOffline] = useState(false);

  const handleWarmOfflineCache = async () => {
    if (isWarmingOffline) return;
    setIsWarmingOffline(true);
    try {
      const status = await refreshCache();
      showToast(
        status.isReady
          ? isArabic
            ? `التطبيق جاهز بالكامل للعمل بدون إنترنت (${status.cachedCount} ملف)`
            : `Offline mode ready (${status.cachedCount} files cached)`
          : isArabic
          ? 'جارٍ تجهيز الملفات… أعد المحاولة عند توفر الإنترنت'
          : 'Offline cache warming; try again when online',
        status.isReady ? 'success' : 'info'
      );
    } finally {
      setIsWarmingOffline(false);
    }
  };

  const handleReloadApp = async () => {
    if (isRefreshingApp) return;
    setIsRefreshingApp(true);
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const status = await refreshCache();
        showToast(
          isArabic
            ? `أنت في وضع الأوفلاين — البيانات والملفات جاهزة (${status.cachedCount})`
            : `You are offline — app cache verified (${status.cachedCount} files)`,
          'info'
        );
        return;
      }

      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          await reg?.update();
        } catch {}
      }
      await refreshCache();
      setIsSidebarOpen(false);
      window.location.reload();
    } catch (e) {
      console.warn('Safe refresh check failed:', e);
    } finally {
      setIsRefreshingApp(false);
    }
  };

  const isVisible = isSidebarOpen || openDragProgress !== null;
  if (!isVisible) return null;

  let drawerTransform = '';
  let backdropOpacity = 1;
  const isOpening = openDragProgress !== null && !isSidebarOpen;

  if (isOpening) {
    const prog = openDragProgress;
    backdropOpacity = prog;
    drawerTransform = isArabic
      ? `translate3d(${(1 - prog) * 100}%, 0, 0)`
      : `translate3d(${(-1 + prog) * 100}%, 0, 0)`;
  } else if (isClosingDrag && closeDragDelta !== 0) {
    drawerTransform = `translate3d(${closeDragDelta}px, 0, 0)`;
    backdropOpacity = Math.max(0, 1 - Math.abs(closeDragDelta) / 336);
  }

  return (
    <div
      onClick={() => handleAnimatedClose()}
      onTouchStart={handleSidebarTouchStart}
      onTouchMove={handleSidebarTouchMove}
      onTouchEnd={handleSidebarTouchEnd}
      style={{
        opacity: isOpening || (isClosingDrag && closeDragDelta !== 0) ? backdropOpacity : undefined,
        transition: isOpening || isClosingDrag ? 'none' : undefined,
      }}
      className={`fixed inset-0 z-[60] flex bg-black/75 overscroll-contain transition-opacity duration-200 ${
        isClosing ? 'modal-backdrop-closing' : 'modal-backdrop-anim'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleSidebarTouchStart}
        onTouchMove={handleSidebarTouchMove}
        onTouchEnd={handleSidebarTouchEnd}
        style={{
          transform: drawerTransform || undefined,
          transition: isOpening || isClosingDrag ? 'none' : undefined,
        }}
        className={`w-84 max-w-[85vw] h-full flex flex-col bg-zinc-950 border-r rtl:border-l rtl:border-r-0 border-zinc-800/80 shadow-2xl text-white overflow-hidden transition-transform duration-200 ${
          isClosing ? 'opacity-0 -translate-x-full rtl:translate-x-full' : 'animate-in slide-in-from-left rtl:slide-in-from-right duration-300'
        }`}
      >
        {/* User Profile Header: Entire Section is 100% Clickable Card */}
        <div
          onClick={() => {
            setIsSidebarOpen(false);
            setIsUserProfileModalOpen(true);
          }}
          role="button"
          tabIndex={0}
          className="safe-area-top border-b border-zinc-800/80 bg-zinc-900/60 hover:bg-zinc-900/90 p-4 flex items-center justify-between shrink-0 cursor-pointer group active:scale-[0.99] transition select-none"
        >
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <div className="w-13 h-13 rounded-2xl bg-zinc-900 border-2 border-emerald-500/80 overflow-hidden flex items-center justify-center text-3xl shadow-lg group-hover:scale-105 transition shrink-0">
              {currentUser && settings.userProfile?.customAvatarUrl && isRealPhotoUrl(settings.userProfile.customAvatarUrl) ? (
                <img
                  src={settings.userProfile.customAvatarUrl}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{settings.userProfile?.avatarEmoji || '👤'}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-white text-base group-hover:text-emerald-400 transition truncate">
                  {currentUser ? (settings.userProfile?.name || currentUser.displayName || 'My Profile') : (isArabic ? 'حساب ضيف' : 'Guest')}
                </h3>
                {!currentUser && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 shrink-0 font-medium">
                    {isArabic ? 'ضيف' : 'Guest'}
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                {!currentUser && (
                  <button
                    type="button"
                    onClick={handleOuterSignIn}
                    disabled={isSigningIn}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-black text-xs font-bold shadow-md shadow-emerald-900/30 active:scale-95 transition cursor-pointer disabled:opacity-60 min-h-[36px]"
                    title={isArabic ? 'تسجيل الدخول بحساب Google' : 'Sign in with Google'}
                  >
                    {isSigningIn ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>{isArabic ? 'جاري الدخول...' : 'Signing in...'}</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="w-3.5 h-3.5" />
                        <span>{isArabic ? 'تسجيل الدخول' : 'Sign In'}</span>
                      </>
                    )}
                  </button>
                )}

                {currentUser && settings.userProfile?.numericId ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const numId = settings.userProfile?.numericId || '0000000000000000';
                      navigator.clipboard.writeText(numId);
                      showToast(
                        isArabic
                          ? `تم نسخ المعرف (${format16DigitId(numId)})!`
                          : `Copied ID (${format16DigitId(numId)})!`,
                        'success'
                      );
                    }}
                    title={isArabic ? 'انقر مباشرة لنسخ المعرف 16 رقماً' : 'Tap to copy 16-digit ID'}
                    className="inline-flex items-center font-mono text-[11px] text-zinc-300 hover:text-white bg-zinc-950/80 hover:bg-zinc-800/90 border border-zinc-800 hover:border-zinc-700 px-2 py-0.5 rounded-lg transition active:scale-95 cursor-pointer shrink-0"
                  >
                    <span>{format16DigitId(settings.userProfile?.numericId || '0000000000000000')}</span>
                  </button>
                ) : null}

                {/* Subtle Live Sync Status Indicator */}
                <div className="inline-flex items-center gap-1.5 text-[11px] shrink-0 font-medium select-none">
                  {syncStatus === 'syncing' && (
                    <span className="inline-flex items-center gap-1 text-emerald-400">
                      <Loader2 className="w-3 h-3 animate-spin text-emerald-400 shrink-0" />
                      <span>{isArabic ? 'جاري المزامنة...' : 'Syncing...'}</span>
                    </span>
                  )}
                  {syncStatus === 'online' && (
                    <span className="inline-flex items-center gap-1.5 text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50 shrink-0" />
                      <span>{isArabic ? 'متصل' : 'Online'}</span>
                      {lastSyncedAt && (
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </span>
                      )}
                    </span>
                  )}
                  {syncStatus === 'offline' && (
                    <span className="inline-flex items-center gap-1.5 text-amber-400">
                      <span className="w-2 h-2 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50 shrink-0" />
                      <span>{isArabic ? 'أوفلاين' : 'Offline'}</span>
                    </span>
                  )}
                  {syncStatus === 'awaiting_choice' && (
                    <span className="inline-flex items-center gap-1.5 text-purple-400">
                      <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse shrink-0" />
                      <span>{isArabic ? 'بانتظار اختيارك' : 'Awaiting choice'}</span>
                    </span>
                  )}
                  {syncStatus === 'local_only' && (
                    <span className="inline-flex items-center gap-1.5 text-zinc-400">
                      <span className="w-2 h-2 rounded-full bg-zinc-600 shrink-0" />
                      <span>{isArabic ? 'محلي فقط' : 'Local only'}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-1 rtl:ml-0 rtl:mr-1">
            <ChevronRight className={`w-4 h-4 text-zinc-500 group-hover:text-blue-400 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition ${isArabic ? 'rotate-180' : ''}`} />
          </div>

          {currentUser && (
            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation();
                await signOutUser();
              }}
              className="p-2 rounded-xl bg-zinc-800/80 hover:bg-red-950/40 border border-zinc-750 hover:border-red-900/60 text-zinc-400 hover:text-red-400 transition cursor-pointer shrink-0 mr-1 rtl:mr-0 rtl:ml-1"
              title={isArabic ? 'تسجيل الخروج' : 'Sign Out'}
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleAnimatedClose();
            }}
            className="p-2.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer shrink-0 ml-2 rtl:ml-0 rtl:mr-2"
            aria-label="Close Sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y p-4 space-y-4">
          {/* Section 1: Core Navigation & Dedicated Feature Hubs */}
          <div className="space-y-2.5">
            {/* Smart Budget Hub Button */}
            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(false);
                setIsSmartBudgetModalOpen(true);
              }}
              className="w-full group min-h-[48px] p-3 rounded-2xl bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800/90 hover:border-zinc-700 text-xs font-bold text-zinc-100 transition-all cursor-pointer shadow-md shadow-black/20 active:scale-[0.99] flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-emerald-500/25 transition-all">
                  <Sparkles className="w-4.5 h-4.5 stroke-[2.5]" />
                </div>
                <div className="text-start min-w-0">
                  <span className="block truncate text-zinc-100 group-hover:text-emerald-300 transition-colors">
                    {isArabic ? 'الميزانية الذكية' : 'Smart Budget'}
                  </span>
                  <span className="block text-[10px] text-zinc-400 font-normal truncate mt-0.5">
                    {isArabic ? 'المصروف الآمن والمستشار المالي' : 'Safe-to-spend & adaptive advisor'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {hasSmartBudgetAlert ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/25 border border-amber-400/50 text-amber-200 shadow-sm animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>{isArabic ? 'تنبيه' : 'Alert'}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>{isArabic ? 'نشط' : 'Active'}</span>
                  </span>
                )}
                <ChevronRight className={`w-4 h-4 text-zinc-400 group-hover:text-zinc-200 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform ${isArabic ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {/* Recurring Transactions Manager Button */}
            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(false);
                setIsRecurringModalOpen(true);
                processDueRecurring(false);
              }}
              className="w-full group min-h-[48px] p-3 rounded-2xl bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800/90 hover:border-zinc-700 text-xs font-bold text-zinc-100 transition-all cursor-pointer shadow-md shadow-black/20 active:scale-[0.99] flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-emerald-500/25 transition-all">
                  <RefreshCw className="w-4.5 h-4.5" />
                </div>
                <div className="text-start min-w-0">
                  <span className="block truncate text-zinc-100 group-hover:text-emerald-300 transition-colors">
                    {isArabic ? 'المعاملات المتكررة المجدولة' : 'Recurring Transactions'}
                  </span>
                  <span className="block text-[10px] text-zinc-400 font-normal truncate mt-0.5">
                    {isArabic ? 'إدارة الجدولة والتكرار التلقائي' : 'Manage automated schedules'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {recurringTransactions.length > 0 && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm">
                    {recurringTransactions.length}
                  </span>
                )}
                <ChevronRight className={`w-4 h-4 text-zinc-400 group-hover:text-zinc-200 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform ${isArabic ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {/* App Preferences & Settings Modal Button */}
            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(false);
                setIsSettingsModalOpen(true);
              }}
              className="w-full group min-h-[48px] p-3 rounded-2xl bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800/90 hover:border-zinc-700 text-xs font-bold text-zinc-100 transition-all cursor-pointer shadow-md shadow-black/20 active:scale-[0.99] flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-emerald-500/25 transition-all">
                  <Sliders className="w-4.5 h-4.5" />
                </div>
                <div className="text-start min-w-0">
                  <span className="block truncate text-zinc-100 group-hover:text-emerald-300 transition-colors">
                    {t('openSettingsModal')}
                  </span>
                  <span className="block text-[10px] text-zinc-400 font-normal truncate mt-0.5">
                    {t('settingsModalDesc')}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <ChevronRight className={`w-4 h-4 text-zinc-400 group-hover:text-zinc-200 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform ${isArabic ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {/* Transfer Fees & Taxes Modal Button */}
            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(false);
                setIsTransferFeesModalOpen(true);
              }}
              className="w-full group min-h-[48px] p-3 rounded-2xl bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800/90 hover:border-zinc-700 text-xs font-bold text-zinc-100 transition-all cursor-pointer shadow-md shadow-black/20 active:scale-[0.99] flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-amber-500/25 transition-all">
                  <Coins className="w-4.5 h-4.5" />
                </div>
                <div className="text-start min-w-0">
                  <span className="block truncate text-zinc-100 group-hover:text-amber-300 transition-colors">
                    {t('openTransferFeesModal')}
                  </span>
                  <span className="block text-[10px] text-zinc-400 font-normal truncate mt-0.5">
                    {t('transferFeesModalDesc')}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <ChevronRight className={`w-4 h-4 text-zinc-400 group-hover:text-zinc-200 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform ${isArabic ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {/* Shared Accounts / Spaces Hub Button */}
            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(false);
                setIsSharedHubModalOpen(true);
              }}
              className="w-full group min-h-[48px] p-3 rounded-2xl bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800/90 hover:border-zinc-700 text-xs font-bold text-zinc-100 transition-all cursor-pointer shadow-md shadow-black/20 active:scale-[0.99] flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-teal-500/25 transition-all">
                  <Share2 className="w-4.5 h-4.5 stroke-[2.5]" />
                </div>
                <div className="text-start min-w-0">
                  <span className="block truncate text-zinc-100 group-hover:text-teal-300 transition-colors">
                    {isArabic ? 'مساحات الحسابات المشتركة' : 'Shared Accounts & Spaces'}
                  </span>
                  <span className="block text-[10px] text-zinc-400 font-normal truncate mt-0.5">
                    {isArabic ? 'تعاون ومزامنة حية بالمعرف الرقمي' : 'Live collaboration & 16-digit sync'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{isArabic ? 'مباشر' : 'Live'}</span>
                </span>
                <ChevronRight className={`w-4 h-4 text-zinc-400 group-hover:text-zinc-200 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform ${isArabic ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {/* App Guide & Features Directory Button */}
            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(false);
                setIsFeaturesModalOpen(true);
              }}
              className="w-full group min-h-[48px] p-3 rounded-2xl bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800/90 hover:border-zinc-700 text-xs font-bold text-zinc-100 transition-all cursor-pointer shadow-md shadow-black/20 active:scale-[0.99] flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-emerald-500/25 transition-all">
                  <BookOpen className="w-4.5 h-4.5" />
                </div>
                <div className="text-start min-w-0">
                  <span className="block truncate text-zinc-100 group-hover:text-emerald-300 transition-colors">
                    {isArabic ? 'دليل الاستخدام ومميزات التطبيق' : 'App Guide & Features'}
                  </span>
                  <span className="block text-[10px] text-zinc-400 font-normal truncate mt-0.5">
                    {isArabic ? 'شرح الخصائص وسجل التحديثات' : 'Feature directory & release notes'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {isArabic ? 'دليل' : 'Guide'}
                </span>
                <ChevronRight className={`w-4 h-4 text-zinc-400 group-hover:text-zinc-200 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform ${isArabic ? 'rotate-180' : ''}`} />
              </div>
            </button>
          </div>

          {/* Section 2: Offline Readiness, Standalone PWA Installation & Factory Reset */}
          <div className="space-y-2.5 pt-1">
            <div className="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800/90 space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  {offlineStatus.isReady ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
                  )}
                  <span className={`font-bold truncate ${offlineStatus.isReady ? 'text-emerald-400' : 'text-amber-300'}`}>
                    {offlineStatus.isReady
                      ? isArabic
                        ? 'جاهز للعمل أوفلاين ✓'
                        : 'Offline Ready ✓'
                      : isArabic
                      ? 'جارٍ تجهيز الأوفلاين...'
                      : 'Preparing Offline Mode...'}
                  </span>
                </div>
                {offlineStatus.cachedCount > 0 && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 shrink-0">
                    {offlineStatus.cachedCount}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleWarmOfflineCache}
                disabled={isWarmingOffline}
                className="w-full min-h-[38px] py-1.5 px-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-semibold text-zinc-200 flex items-center justify-center gap-1.5 transition active:scale-[0.99] cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isWarmingOffline ? 'animate-spin' : ''}`} />
                <span>
                  {isWarmingOffline
                    ? isArabic ? 'جاري التحقق من الملفات...' : 'Verifying offline files...'
                    : isArabic ? 'تحديث ملفات الأوفلاين' : 'Update Offline Cache'}
                </span>
              </button>
            </div>

            {isPwaInstalled ? (
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs">
                <div className="flex items-center gap-2 text-emerald-400 font-medium">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>
                    {isArabic
                      ? 'مثبت على الشاشة الرئيسية ✓'
                      : 'Installed on Home Screen ✓'}
                  </span>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleDirectInstallClick}
                className="w-full min-h-[44px] py-2.5 text-xs font-bold flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 active:scale-95 text-black shadow-lg shadow-emerald-950/50 transition cursor-pointer"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>{isArabic ? 'تثبيت solv على الجهاز' : 'Install solv App'}</span>
              </button>
            )}

            {/* Complete Factory Reset & Clear All Data */}
            <button
              type="button"
              onClick={async () => {
                const confirmed = await showConfirm({
                  title: isArabic ? 'تحذير شديد الأهمية - ضبط المصنع' : 'Factory Reset & Wipe All Data',
                  message: isArabic
                    ? 'تحذير شديد الأهمية: هل أنت متأكد من حذف جميع البيانات بالكامل وإعادة ضبط المصنع؟ سيتم تسجيل خروجك ومسح كافة الحسابات والمعاملات والنسخ المحلية وقاعدة البيانات نهائياً!'
                    : 'CRITICAL WARNING: Are you sure you want to completely erase all data and reset to factory defaults? You will be signed out and all accounts, transactions, and local databases will be wiped permanently!',
                  confirmText: isArabic ? 'مسح كافة البيانات' : 'Wipe All Data',
                  isDanger: true,
                });
                if (!confirmed) return;

                try {
                  if (typeof window !== 'undefined') {
                    window.sessionStorage.setItem('app_factory_reset_in_progress', 'true');
                  }

                  try {
                    await signOut(auth);
                  } catch (e) {
                    console.warn('Sign out during reset:', e);
                  }

                  try {
                    window.localStorage.clear();
                    window.sessionStorage.clear();
                  } catch (e) {
                    console.warn('Storage clear during reset:', e);
                  }

                  try {
                    if (typeof window !== 'undefined' && window.indexedDB) {
                      window.indexedDB.deleteDatabase('PersonalFinanceTrackerDB');
                      window.indexedDB.deleteDatabase('PersonalFinanceDB');
                    }
                  } catch (e) {
                    console.warn('IndexedDB delete during reset:', e);
                  }

                  showToast(
                    isArabic
                      ? 'تم مسح جميع البيانات وتسجيل الخروج بنجاح. جارٍ إعادة ضبط المصنع...'
                      : 'All data cleared and signed out successfully. Resetting app...',
                    'info'
                  );

                  setTimeout(() => {
                    window.location.href = window.location.origin + window.location.pathname;
                  }, 450);
                } catch (err: any) {
                  showToast(err?.message || 'Error clearing data', 'error');
                }
              }}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-red-950/30 hover:bg-red-950/60 border border-red-900/60 text-xs font-bold text-red-400 hover:text-red-300 transition cursor-pointer active:scale-98"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
              <span>{isArabic ? 'مسح جميع البيانات وإعادة ضبط المصنع' : 'Clear All Data & Factory Reset'}</span>
            </button>
          </div>
        </div>

        {/* Sidebar Footer: solv Version & Refresh Button */}
        <div className="p-3.5 sm:p-4 border-t border-zinc-800/80 bg-zinc-950 flex items-center justify-between text-xs text-zinc-400 font-mono shrink-0 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-sans font-extrabold text-[10px] tracking-wide">
              solv
            </span>
            <span className="font-bold text-zinc-300 truncate">
              {formatFullVersionWithBuild(CURRENT_APP_VERSION)}
            </span>
          </div>

          <button
            type="button"
            onClick={handleReloadApp}
            disabled={isRefreshingApp}
            className="min-h-[40px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition cursor-pointer active:scale-95 shrink-0 disabled:opacity-50"
            title="Refresh App"
          >
            <RotateCw className={`w-3.5 h-3.5 text-emerald-400 ${isRefreshingApp ? 'animate-spin' : ''}`} />
            <span className="text-[11px] font-semibold">
              {isRefreshingApp
                ? (isArabic ? 'جاري التحديث...' : 'Refreshing...')
                : (isArabic ? 'فحص وتحديث' : 'Check & Refresh')}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
