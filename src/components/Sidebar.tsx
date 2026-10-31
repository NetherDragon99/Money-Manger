import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { navigateBack } from '../context/NavigationContext';
import {
  X,
  Sliders,
  Download,
  Upload,
  Sparkles,
  RotateCw,
  Coins,
  BookOpen,
  Folder,
  Check,
  RefreshCw,
  Share2,
  Trash2,
  Loader2,
  LogOut,
  LogIn,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import {
  IS_BETA_BUILD,
  checkBetaAvailability,
  STABLE_BASE_URL,
  BETA_BASE_URL,
  switchChannelWithHistoryUnwind,
} from '../utils/channel';
import { useNavigation } from '../context/NavigationContext';
import { format16DigitId } from '../utils/userId';
import { isRealPhotoUrl } from '../utils/shareFolders';
import { installPwa } from '../utils/pwaInstall';
import { ExportCustomizeModal } from './ExportCustomizeModal';
import { ImportCustomizeModal } from './ImportCustomizeModal';
import { JoinBetaWarningModal } from './JoinBetaWarningModal';
import { saveItemToIndexedDB } from '../utils/indexedDB';
import { exportAllDataAsJSON } from '../utils/storage';
import {
  checkForAppUpdates,
  applyLatestAppUpdate,
  CURRENT_APP_VERSION,
  formatVersionLabel,
  checkForNewerOfficialRelease,
  type StableReleaseCheckResult,
  isAutoUpdateEnabled,
  setAutoUpdateEnabled,
} from '../utils/versionChecker';
import {
  applyUpdateSafely,
  getIsUpdateReady,
  getLatestPreUpdateSnapshot,
  restoreFromPreUpdateSnapshot,
} from '../utils/autoUpdateService';
import { auth, loginWithGoogle } from '../utils/firebase';
import { signOut, type User as FirebaseUser } from 'firebase/auth';
import { evaluateSmartBudget } from '../utils/smartBudgetEngine';

export const Sidebar: React.FC = () => {
  const {
    isSidebarOpen,
    setIsSidebarOpen,
    setIsUserProfileModalOpen,
    setIsFeaturesModalOpen,
    setIsRecurringModalOpen,
    setIsSmartBudgetModalOpen,
    setIsSettingsModalOpen,
    setIsTransferFeesModalOpen,
    recurringTransactions,
    processDueRecurring,
    setIsSharedHubModalOpen,
    settings,
    updateSettings,
    signOutUser,
    accounts,
    categories,
    transactions,
    showToast,
    showConfirm,
    syncStatus,
    lastSyncedAt,
    t,
  } = useApp();

  const { getPushedFramesCount } = useNavigation();

  const sidebarTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const [autoUpdateEnabled, setAutoUpdateState] = useState(() => isAutoUpdateEnabled());
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateStep, setUpdateStep] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(auth.currentUser);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [newerStableInfo, setNewerStableInfo] = useState<StableReleaseCheckResult | null>(null);
  const [isStableNoticeDismissed, setIsStableNoticeDismissed] = useState(false);

  const isArabic = settings.language === 'ar';

  const hasSmartBudgetAlert = useMemo(() => {
    try {
      const evaluation = evaluateSmartBudget(
        transactions,
        accounts,
        {
          ...settings.smartBudget?.baseline,
          startDay: settings.defaultMonthStartDay || 1,
          overrides: settings.smartBudget?.overrides,
          adjustments: settings.smartBudget?.adjustments,
          baseCurrency: settings.currencySymbol || 'EGP',
        },
        new Date()
      );
      return (
        evaluation.dailyStatus.allowanceState === 'true_deficit' ||
        evaluation.anomalies.some((a) => a.severity === 'critical')
      );
    } catch {
      return false;
    }
  }, [transactions, accounts, settings.currencySymbol, settings.defaultMonthStartDay, settings.smartBudget]);

  useEffect(() => {
    if (!IS_BETA_BUILD) return;
    let active = true;
    checkForNewerOfficialRelease()
      .then((res) => {
        if (!active || !res?.hasNewerStable) return;
        try {
          const dismissed = sessionStorage.getItem('mm_dismiss_stable_notice');
          if (dismissed === res.stableVersion) return;
        } catch {}
        setNewerStableInfo(res);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const handleDismissStableNotice = () => {
    setIsStableNoticeDismissed(true);
    try {
      if (newerStableInfo?.stableVersion) {
        sessionStorage.setItem('mm_dismiss_stable_notice', newerStableInfo.stableVersion);
      }
    } catch {}
  };

  const handleSwitchToStable = () => {
    const message = t('confirmSwitchToStable');
    const confirmed = window.confirm(message);
    if (confirmed) {
      try {
        localStorage.removeItem('mm_join_beta');
      } catch {}
      if (newerStableInfo?.stableBaseUrl) {
        window.location.href = newerStableInfo.stableBaseUrl;
      }
    }
  };

  const [isJoinBetaModalOpen, setIsJoinBetaModalOpen] = useState(false);
  const [isBetaAvailable, setIsBetaAvailable] = useState<boolean | null>(() => {
    if (IS_BETA_BUILD) return null;
    try {
      const cached = sessionStorage.getItem('mm_beta_reachable');
      return cached !== null ? cached === 'true' : null;
    } catch {
      return null;
    }
  });
  const [isUpdateReady, setIsUpdateReady] = useState(() => getIsUpdateReady());

  useEffect(() => {
    const onUpdateReady = () => setIsUpdateReady(true);
    window.addEventListener('mm_update_ready', onUpdateReady);
    return () => window.removeEventListener('mm_update_ready', onUpdateReady);
  }, []);

  useEffect(() => {
    if (IS_BETA_BUILD) return;
    checkBetaAvailability().then((reachable) => {
      setIsBetaAvailable(reachable);
    });
  }, []);

  const handleToggleJoinBeta = () => {
    if (isBetaAvailable === false) {
      showToast(t('betaNotAvailable'), 'info');
      return;
    }
    setIsJoinBetaModalOpen(true);
  };

  const handleConfirmJoinBeta = async (downloadBackup: boolean) => {
    try {
      // 1. Create local safety backup in IndexedDB
      const snapshotPayload = {
        version: CURRENT_APP_VERSION,
        versionLabel: formatVersionLabel(CURRENT_APP_VERSION),
        type: 'pre_beta_safety_backup',
        backupDate: new Date().toISOString(),
        timestamp: Date.now(),
        accounts,
        categories,
        transactions,
        settings,
        recurringTransactions,
      };
      await saveItemToIndexedDB('mm_pre_beta_backup', snapshotPayload);

      // 2. Download file if chosen
      if (downloadBackup) {
        exportAllDataAsJSON({ accounts, categories, transactions, settings, recurringTransactions });
      }

      // 3. Verify reachability at that exact moment
      const isReachable = await checkBetaAvailability(true);
      if (!isReachable) {
        showToast(t('betaUnreachableToast'), 'error');
        setIsJoinBetaModalOpen(false);
        return;
      }

      // 4. Set mm_join_beta in localStorage and settings
      try {
        localStorage.setItem('mm_join_beta', 'true');
      } catch {}
      updateSettings({ joinBeta: true });

      showToast(t('switchingToBetaToast'), 'info');
      setIsJoinBetaModalOpen(false);

      // 5. Navigate to beta channel safely
      const frames = typeof getPushedFramesCount === 'function' ? getPushedFramesCount() : 1;
      setTimeout(() => {
        switchChannelWithHistoryUnwind(BETA_BASE_URL, frames);
      }, 350);
    } catch (err) {
      console.error('Error switching to beta channel:', err);
      showToast(isArabic ? 'حدث خطأ أثناء الانتقال للبيتا' : 'Error switching to Beta', 'error');
      setIsJoinBetaModalOpen(false);
    }
  };

  const handleLeaveBeta = () => {
    const message = t('confirmLeaveBeta');
    const confirmed = window.confirm(message);
    if (confirmed) {
      try {
        localStorage.removeItem('mm_join_beta');
      } catch {}
      updateSettings({ joinBeta: false });
      showToast(t('leavingBetaToast'), 'info');
      const frames = typeof getPushedFramesCount === 'function' ? getPushedFramesCount() : 1;
      setTimeout(() => {
        switchChannelWithHistoryUnwind(STABLE_BASE_URL, frames);
      }, 350);
    }
  };

  const handleApplyUpdateNow = async () => {
    setIsCheckingUpdate(true);
    setUpdateStep(isArabic ? 'جاري تطبيق التحديث بأمان...' : 'Applying update safely...');
    try {
      await applyUpdateSafely({ force: true });
    } catch (err: any) {
      setIsCheckingUpdate(false);
      setUpdateStep(null);
      showToast(err?.message || 'Failed to apply update', 'error');
    }
  };

  const handleRestorePreUpdateSnapshot = async () => {
    try {
      const snapshot = await getLatestPreUpdateSnapshot();
      if (!snapshot) {
        showToast(t('noPreUpdateSnapshotFound'), 'info');
        return;
      }

      const dateStr = new Date(snapshot.timestamp).toLocaleString(isArabic ? 'ar-EG' : 'en-US');
      const confirmPrompt = `${t('confirmRestorePreUpdateSnapshot')}\n\n${t('snapshotDate')}: ${dateStr}\n${t('snapshotVersion')}: ${snapshot.versionLabel || snapshot.version}`;

      if (window.confirm(confirmPrompt)) {
        const ok = await restoreFromPreUpdateSnapshot(snapshot.id);
        if (ok) {
          showToast(t('preUpdateSnapshotRestored'), 'success');
          setTimeout(() => {
            window.location.reload();
          }, 600);
        } else {
          showToast(isArabic ? 'فشلت الاستعادة من النسخة' : 'Failed to restore snapshot', 'error');
        }
      }
    } catch (err) {
      console.error('[Sidebar] Error restoring pre-update snapshot:', err);
      showToast(isArabic ? 'حدث خطأ أثناء الاستعادة' : 'Error during restoration', 'error');
    }
  };

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

  const [isPwaInstalled, setIsPwaInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      (window.navigator as any).standalone === true
    );
  });

  useEffect(() => {
    const handleInstalled = () => {
      setIsPwaInstalled(true);
    };
    window.addEventListener('appinstalled', handleInstalled);
    window.addEventListener('app-installed-event', handleInstalled);
    return () => {
      window.removeEventListener('appinstalled', handleInstalled);
      window.removeEventListener('app-installed-event', handleInstalled);
    };
  }, []);

  const handleDirectInstallClick = () => {
    installPwa({
      isArabic,
      showToast,
      onInstalled: () => {
        setIsPwaInstalled(true);
      },
    });
  };

  // Keep auth state synchronized in Sidebar
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    const handleSignedOut = () => setCurrentUser(null);
    window.addEventListener('app_user_signed_out', handleSignedOut);
    return () => {
      unsub();
      window.removeEventListener('app_user_signed_out', handleSignedOut);
    };
  }, []);

  // Sync auto-update state across components
  useEffect(() => {
    const handleAutoUpdateChange = (e: any) => {
      if (typeof e?.detail === 'boolean') {
        setAutoUpdateState(e.detail);
      } else {
        setAutoUpdateState(isAutoUpdateEnabled());
      }
    };
    window.addEventListener('mm_auto_update_changed', handleAutoUpdateChange);
    return () => window.removeEventListener('mm_auto_update_changed', handleAutoUpdateChange);
  }, []);

  const handleToggleAutoUpdate = () => {
    const nextVal = !autoUpdateEnabled;
    setAutoUpdateState(nextVal);
    setAutoUpdateEnabled(nextVal);
    showToast(
      isArabic
        ? nextVal
          ? 'تم تفعيل التحديث التلقائي في الخلفية'
          : 'تم تعطيل التحديث التلقائي'
        : nextVal
        ? 'Automatic background updates enabled'
        : 'Automatic background updates disabled',
      'info'
    );
  };

  const handleManualCheckAndUpdate = async () => {
    if (isCheckingUpdate) return;
    setIsCheckingUpdate(true);
    setUpdateStep(isArabic ? 'جاري فحص التحديثات...' : 'Checking for updates...');

    try {
      const res = await checkForAppUpdates();
      if (res.hasUpdate) {
        setUpdateStep(
          isArabic
            ? `تم العثور على إصدار جديد (v${res.latestVersion})! جاري التثبيت...`
            : `New version (v${res.latestVersion}) found! Installing...`
        );
        showToast(
          isArabic
            ? `تم توفر إصدار جديد (v${res.latestVersion})! جاري تحديث التطبيق الآن...`
            : `New version available (v${res.latestVersion})! Updating app now...`,
          'info'
        );
        setTimeout(() => {
          applyLatestAppUpdate((step) => {
            if (step === 'service_worker') {
              setUpdateStep(isArabic ? 'تحديث مشغل الخدمة...' : 'Updating Service Worker...');
            } else if (step === 'cache_cleanup') {
              setUpdateStep(isArabic ? 'مسح الذاكرة المؤقتة القديمة...' : 'Clearing outdated caches...');
            } else if (step === 'reloading') {
              setUpdateStep(isArabic ? 'إعادة تشغيل التطبيق بالنسخة الجديدة...' : 'Reloading into new version...');
            }
          });
        }, 500);
      } else {
        setUpdateStep(null);
        setIsCheckingUpdate(false);
        showToast(
          isArabic
            ? 'تطبيقك مُحدّث بالكامل إلى أحدث إصدار!'
            : 'Your app is up to date with the latest version!',
          'success'
        );
      }
    } catch (err) {
      console.warn('[Sidebar] Manual update check error:', err);
      setUpdateStep(null);
      setIsCheckingUpdate(false);
      showToast(
        isArabic ? 'تعذر فحص التحديثات في الوقت الحالي' : 'Could not check for updates right now',
        'error'
      );
    }
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

  const handleReloadApp = () => {
    setIsSidebarOpen(false);
    window.location.reload();
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
      className={`fixed inset-0 z-[60] flex bg-black/60 backdrop-blur-md overscroll-contain transition-all duration-200 ${
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
        className={`w-84 max-w-[85vw] h-full flex flex-col bg-zinc-950/95 backdrop-blur-2xl border-r rtl:border-l rtl:border-r-0 border-zinc-800/80 shadow-2xl text-white overflow-hidden transition-all duration-200 ${
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
          className="border-b border-zinc-800/80 bg-zinc-900/50 hover:bg-zinc-900/90 p-4 flex items-center justify-between shrink-0 cursor-pointer group active:scale-[0.99] transition select-none"
        >
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <div className="w-13 h-13 rounded-2xl bg-zinc-900 border-2 border-blue-500/80 overflow-hidden flex items-center justify-center text-3xl shadow-lg group-hover:scale-105 transition shrink-0">
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
                <h3 className="font-bold text-white text-base group-hover:text-blue-400 transition truncate">
                  {currentUser ? (settings.userProfile?.name || 'My Profile') : (isArabic ? 'حساب ضيف' : 'Guest')}
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:via-indigo-500 hover:to-blue-400 text-white text-xs font-bold shadow-md shadow-blue-600/30 active:scale-95 transition cursor-pointer disabled:opacity-60 min-h-[36px]"
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
                    <span className="inline-flex items-center gap-1 text-blue-400">
                      <Loader2 className="w-3 h-3 animate-spin text-blue-400 shrink-0" />
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
            {/* Prominent Smart Budget Hub Button */}
            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(false);
                setIsSmartBudgetModalOpen(true);
              }}
              className="w-full relative overflow-hidden group min-h-[52px] flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/70 via-teal-950/50 to-zinc-900/90 hover:from-emerald-900/80 hover:via-teal-900/60 hover:to-zinc-850 border border-emerald-500/40 hover:border-emerald-400 text-white transition-all duration-200 cursor-pointer shadow-lg shadow-emerald-950/30 active:scale-[0.99]"
            >
              <div className="flex items-center gap-3 relative z-10 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/30 group-hover:scale-105 transition-transform">
                  <Sparkles className="w-4.5 h-4.5 stroke-[2.5]" />
                </div>
                <div className="text-start min-w-0">
                  <h4 className="text-xs font-bold text-white tracking-tight flex items-center gap-1.5 truncate">
                    <span>{isArabic ? 'الميزانية الذكية' : 'Smart Budget'}</span>
                  </h4>
                  <p className="text-[10px] text-emerald-300/80 font-normal truncate mt-0.5">
                    {isArabic ? 'المصروف الآمن والمستشار المالي' : 'Safe-to-spend & adaptive advisor'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 relative z-10 shrink-0 rtl:mr-2 ltr:ml-2">
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
                <ChevronRight className={`w-4 h-4 text-emerald-300 group-hover:text-white group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform ${isArabic ? 'rotate-180' : ''}`} />
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
              className="w-full group min-h-[48px] p-3 rounded-2xl bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800/90 hover:border-emerald-500/40 text-xs font-bold text-zinc-100 transition-all cursor-pointer shadow-md shadow-black/20 active:scale-[0.99] flex items-center justify-between gap-3"
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
                <ChevronRight className={`w-4 h-4 text-zinc-400 group-hover:text-emerald-300 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform ${isArabic ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {/* App Preferences & Settings Modal Button */}
            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(false);
                setIsSettingsModalOpen(true);
              }}
              className="w-full group min-h-[48px] p-3 rounded-2xl bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800/90 hover:border-blue-500/40 text-xs font-bold text-zinc-100 transition-all cursor-pointer shadow-md shadow-black/20 active:scale-[0.99] flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-blue-500/25 transition-all">
                  <Sliders className="w-4.5 h-4.5" />
                </div>
                <div className="text-start min-w-0">
                  <span className="block truncate text-zinc-100 group-hover:text-blue-300 transition-colors">
                    {t('openSettingsModal')}
                  </span>
                  <span className="block text-[10px] text-zinc-400 font-normal truncate mt-0.5">
                    {t('settingsModalDesc')}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <ChevronRight className={`w-4 h-4 text-zinc-400 group-hover:text-blue-300 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform ${isArabic ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {/* Transfer Fees & Taxes Modal Button */}
            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(false);
                setIsTransferFeesModalOpen(true);
              }}
              className="w-full group min-h-[48px] p-3 rounded-2xl bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800/90 hover:border-amber-500/40 text-xs font-bold text-zinc-100 transition-all cursor-pointer shadow-md shadow-black/20 active:scale-[0.99] flex items-center justify-between gap-3"
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
                <ChevronRight className={`w-4 h-4 text-zinc-400 group-hover:text-amber-300 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform ${isArabic ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {/* Prominent Shared Accounts / Spaces Hub Button */}
            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(false);
                setIsSharedHubModalOpen(true);
              }}
              className="w-full relative overflow-hidden group min-h-[52px] flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-blue-900/40 via-purple-900/30 to-blue-950/50 hover:from-blue-900/60 hover:via-purple-900/40 hover:to-blue-950/70 border-2 border-blue-500/50 hover:border-blue-400 text-white transition-all duration-200 cursor-pointer shadow-xl shadow-blue-950/40 hover:shadow-blue-900/50 active:scale-[0.99]"
            >
              <div className="flex items-center gap-3 relative z-10 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-600/30 group-hover:scale-105 transition-transform">
                  <Share2 className="w-4.5 h-4.5 stroke-[2.5]" />
                </div>
                <div className="text-start min-w-0">
                  <h4 className="text-xs font-bold text-white tracking-tight flex items-center gap-1.5 truncate">
                    <span>{isArabic ? 'مساحات الحسابات المشتركة' : 'Shared Accounts & Spaces'}</span>
                  </h4>
                  <p className="text-[10px] text-blue-200/80 font-normal truncate mt-0.5">
                    {isArabic ? 'تعاون ومزامنة حية بالمعرف الرقمي' : 'Live collaboration & 16-digit sync'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 relative z-10 shrink-0 rtl:mr-2 ltr:ml-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/25 border border-blue-400/50 text-blue-200 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{isArabic ? 'مباشر' : 'Live'}</span>
                </span>
                <ChevronRight className={`w-4 h-4 text-blue-300 group-hover:text-white group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform ${isArabic ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {/* App Guide & Features Directory Button */}
            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(false);
                setIsFeaturesModalOpen(true);
              }}
              className="w-full group min-h-[48px] p-3 rounded-2xl bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800/90 hover:border-blue-500/40 text-xs font-bold text-zinc-100 transition-all cursor-pointer shadow-md shadow-black/20 active:scale-[0.99] flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-blue-500/25 transition-all">
                  <BookOpen className="w-4.5 h-4.5" />
                </div>
                <div className="text-start min-w-0">
                  <span className="block truncate text-zinc-100 group-hover:text-blue-300 transition-colors">
                    {isArabic ? 'دليل الاستخدام ومميزات التطبيق' : 'App Guide & Features'}
                  </span>
                  <span className="block text-[10px] text-zinc-400 font-normal truncate mt-0.5">
                    {isArabic ? 'شرح الخصائص وسجل التحديثات' : 'Feature directory & release notes'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {isArabic ? 'دليل' : 'Guide'}
                </span>
                <ChevronRight className={`w-4 h-4 text-zinc-400 group-hover:text-blue-300 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform ${isArabic ? 'rotate-180' : ''}`} />
              </div>
            </button>
          </div>

          {/* Section 2: Data Management & Backup Snapshots */}
          <div className="space-y-2 pt-1">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-1">
              {isArabic ? 'إدارة البيانات والنسخ الاحتياطي' : 'Data & Backups'}
            </h4>

            {/* Custom Data Export */}
            <div className="p-3.5 rounded-2xl bg-zinc-900/70 border border-zinc-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                  <Download className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-white truncate">
                    {isArabic ? 'تصدير البيانات المخصصة' : 'Custom Data Export'}
                  </h4>
                  <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                    {isArabic ? 'تصدير التقارير والمعاملات' : 'Export reports & transactions'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExportModalOpen(true)}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition cursor-pointer active:scale-95 shrink-0"
              >
                {isArabic ? 'تخصيص' : 'Customize'}
              </button>
            </div>

            {/* Custom Data Import */}
            <div className="p-3.5 rounded-2xl bg-zinc-900/70 border border-zinc-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <Upload className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-white truncate">
                    {isArabic ? 'استيراد البيانات المخصص' : 'Custom Data Import'}
                  </h4>
                  <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                    {isArabic ? 'معاينة ودمج أو استبدال الأقسام' : 'Preview, merge, or replace'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 hover:text-white text-xs font-semibold transition cursor-pointer active:scale-95 shrink-0"
              >
                {isArabic ? 'استيراد' : 'Import'}
              </button>
            </div>

            {/* Restore from Pre-Update Snapshot */}
            <button
              type="button"
              onClick={handleRestorePreUpdateSnapshot}
              className="w-full min-h-[44px] flex items-center justify-between p-3 rounded-2xl bg-zinc-900/60 hover:bg-zinc-850 active:scale-98 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
                  <Folder className="w-3.5 h-3.5" />
                </div>
                <span className="truncate">{t('restorePreUpdateSnapshot')}</span>
              </div>
              <ChevronRight className={`w-3.5 h-3.5 text-zinc-500 shrink-0 ${isArabic ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Official Stable Release Notice for Beta Channel Users */}
          {IS_BETA_BUILD && newerStableInfo && !isStableNoticeDismissed && (
            <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-950/70 to-indigo-950/70 border border-blue-500/40 text-white relative shadow-sm">
              <button
                type="button"
                onClick={handleDismissStableNotice}
                className="absolute top-2 right-2 rtl:right-auto rtl:left-2 p-1 text-zinc-400 hover:text-white rounded-lg transition cursor-pointer"
                title={isArabic ? 'إغلاق' : 'Dismiss'}
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <div className="flex items-start gap-2.5 pr-6 rtl:pr-0 rtl:pl-6">
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-blue-200 leading-snug">
                    {t('newerOfficialReleaseAvailable')}
                  </p>
                  <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                    v{newerStableInfo.stableVersion}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSwitchToStable}
                className="mt-2.5 w-full min-h-[40px] py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 transition cursor-pointer"
              >
                <span>{t('switchToStable')}</span>
                <ExternalLink className={`w-3.5 h-3.5 ${isArabic ? 'rotate-180' : ''}`} />
              </button>
            </div>
          )}

          {/* Section 3: Clean App Updates & Maintenance Footer (aligned for 320px width) */}
          <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3 shadow-sm min-w-0">
            {/* Header: Title & Current Version */}
            <div className="flex items-center justify-between min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                  <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-white truncate">
                    {isArabic ? 'تحديثات التطبيق' : 'App Updates'}
                  </h4>
                  <p className="text-[10px] text-zinc-400 truncate font-mono">
                    {formatVersionLabel(CURRENT_APP_VERSION)}
                  </p>
                </div>
              </div>
            </div>

            {/* Clean Flex-Wrap Controls Bar at 320px width */}
            <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
              {/* Auto-Update Switch */}
              <div className="flex items-center gap-1.5 bg-zinc-950/80 border border-zinc-800 px-2.5 py-1.5 rounded-xl shrink-0 min-h-[40px]">
                <span className="text-[10px] font-semibold text-zinc-300">
                  {isArabic ? 'تلقائي' : 'Auto'}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoUpdateEnabled}
                  onClick={handleToggleAutoUpdate}
                  className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                    autoUpdateEnabled ? 'bg-emerald-600' : 'bg-zinc-750 border border-zinc-700'
                  }`}
                  title={isArabic ? 'تفعيل/تعطيل التحديث التلقائي' : 'Toggle background auto-update'}
                >
                  <span
                    className={`block w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform absolute top-0.75 ${
                      autoUpdateEnabled
                        ? (isArabic ? 'right-1' : 'left-4.5')
                        : (isArabic ? 'right-4.5' : 'left-1')
                    }`}
                  />
                </button>
              </div>

              {/* Join / Leave Beta Switch */}
              <div className="flex items-center gap-1.5 bg-zinc-950/80 border border-zinc-800 px-2.5 py-1.5 rounded-xl shrink-0 min-h-[40px]">
                {IS_BETA_BUILD ? (
                  <>
                    <span className="text-[10px] font-semibold text-amber-400">
                      {isArabic ? 'بيتا' : 'Beta'}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={true}
                      onClick={handleLeaveBeta}
                      className="w-9 h-5 rounded-full transition-colors relative cursor-pointer bg-amber-600"
                      title={t('leaveBeta')}
                    >
                      <span
                        className={`block w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform absolute top-0.75 ${
                          isArabic ? 'right-1' : 'left-4.5'
                        }`}
                      />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-[10px] font-semibold text-zinc-300">
                      {isArabic ? 'بيتا' : 'Beta'}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      disabled={isBetaAvailable === false}
                      aria-checked={false}
                      onClick={handleToggleJoinBeta}
                      className={`w-9 h-5 rounded-full transition-colors relative ${
                        isBetaAvailable === false
                          ? 'opacity-40 cursor-not-allowed bg-zinc-800 border border-zinc-700'
                          : 'bg-zinc-750 border border-zinc-700 cursor-pointer'
                      }`}
                    >
                      <span
                        className={`block w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform absolute top-0.75 ${
                          isArabic ? 'right-4.5' : 'left-1'
                        }`}
                      />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Notice when beta is unavailable */}
            {!IS_BETA_BUILD && isBetaAvailable === false && (
              <p className="text-[10px] text-zinc-500 italic px-0.5">
                {t('betaNotAvailable')}
              </p>
            )}

            {/* In Beta channel banner */}
            {IS_BETA_BUILD && (
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
                <span className="truncate font-medium">{t('leaveBeta')}</span>
                <button
                  type="button"
                  onClick={handleLeaveBeta}
                  className="shrink-0 font-bold underline hover:text-white ms-2 text-[10px] cursor-pointer"
                >
                  {isArabic ? 'العودة للمستقرة' : 'Switch to Stable'}
                </button>
              </div>
            )}

            {/* Update Ready Notice */}
            {isUpdateReady && (
              <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-950/80 to-teal-950/80 border border-emerald-500/40 text-white flex items-center justify-between gap-2 shadow-sm animate-in fade-in">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-emerald-200 truncate">
                      {t('updateReadyTitle')}
                    </p>
                    <p className="text-[10px] text-zinc-400 truncate">
                      {t('updateReadyTapToApply')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleApplyUpdateNow}
                  className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-[11px] font-bold shrink-0 transition cursor-pointer shadow-md shadow-emerald-600/20"
                >
                  {t('updateNow')}
                </button>
              </div>
            )}

            {/* In-App Progress Indicator during Update Checking & Applying */}
            {updateStep && (
              <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/30 flex items-center gap-2 text-purple-300 text-[11px] animate-in fade-in">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-purple-400" />
                <span className="truncate">{updateStep}</span>
              </div>
            )}

            {/* Manual Check & Update Now Button */}
            <button
              type="button"
              disabled={isCheckingUpdate}
              onClick={handleManualCheckAndUpdate}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-750 active:scale-98 border border-zinc-700 text-zinc-200 hover:text-white text-xs font-bold transition cursor-pointer disabled:opacity-50 shadow-sm"
            >
              {isCheckingUpdate ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                  <span>{isArabic ? 'جارٍ الفحص والتحديث...' : 'Checking & Updating...'}</span>
                </>
              ) : (
                <>
                  <RotateCw className="w-3.5 h-3.5 text-purple-400" />
                  <span>{isArabic ? 'فحص وتحديث الآن' : 'Check & Update Now'}</span>
                </>
              )}
            </button>
          </div>

          {/* Section 4: Standalone PWA Installation & Factory Reset */}
          <div className="space-y-2.5 pt-1">
            {isPwaInstalled ? (
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs">
                <div className="flex items-center gap-2 text-emerald-400 font-medium">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>
                    {isArabic
                      ? 'مثبت على الشاشة الرئيسية (PWA)'
                      : 'Installed on Home Screen (PWA)'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleManualCheckAndUpdate}
                  disabled={isCheckingUpdate}
                  aria-label="Check for updates"
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin text-blue-400' : ''}`} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleDirectInstallClick}
                className="w-full min-h-[44px] py-2.5 text-xs font-bold flex items-center justify-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white shadow-lg shadow-blue-900/30 transition cursor-pointer"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>{isArabic ? 'تثبيت التطبيق على الجهاز' : 'Install App (PWA)'}</span>
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

        {/* Sidebar Footer: Version & Refresh Button */}
        <div className="p-3.5 sm:p-4 border-t border-zinc-800/80 bg-zinc-950 flex items-center justify-between text-xs text-zinc-400 font-mono shrink-0 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold text-zinc-300 truncate">
              {formatVersionLabel(CURRENT_APP_VERSION)}
            </span>
          </div>

          <button
            type="button"
            onClick={handleReloadApp}
            className="min-h-[40px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition cursor-pointer active:scale-95 shrink-0"
            title="Refresh App"
          >
            <RotateCw className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[11px] font-semibold">{isArabic ? 'تحديث التطبيق' : 'Refresh App'}</span>
          </button>
        </div>
      </div>

      {/* Persistent Customize Export Modal */}
      <ExportCustomizeModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />

      {/* Persistent Customize Import Modal */}
      <ImportCustomizeModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />

      {/* High-Severity Join Beta Warning Modal */}
      <JoinBetaWarningModal
        isOpen={isJoinBetaModalOpen}
        onClose={() => setIsJoinBetaModalOpen(false)}
        onConfirm={handleConfirmJoinBeta}
      />
    </div>
  );
};
