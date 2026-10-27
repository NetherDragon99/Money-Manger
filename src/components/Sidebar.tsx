import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { navigateBack } from '../context/NavigationContext';
import {
  X,
  User,
  Calendar,
  Globe,
  Moon,
  Sun,
  Download,
  Upload,
  Layers,
  Sparkles,
  RotateCw,
  Coins,
  BookOpen,
  Folder,
  Clock,
  ShieldCheck,
  Check,
  Search,
  Shield,
  Lock,
  KeyRound,
  RefreshCw,
  Mail,
  Users,
  Share2,
  Trash2,
  Loader2,
  LogOut,
} from 'lucide-react';
import { loadSecuritySettings, saveSecuritySettings, isBiometricAvailable } from '../utils/security';
import { format16DigitId } from '../utils/userId';
import { PWAInstallButton } from './PWAInstallButton';
import { installPwa } from '../utils/pwaInstall';
import { ExportCustomizeModal } from './ExportCustomizeModal';
import { ImportCustomizeModal } from './ImportCustomizeModal';
import {
  checkForAppUpdates,
  applyLatestAppUpdate,
  CURRENT_APP_VERSION,
  isAutoUpdateEnabled,
  setAutoUpdateEnabled,
} from '../utils/versionChecker';
import { auth } from '../utils/firebase';
import { signOut, type User as FirebaseUser } from 'firebase/auth';
import { WeekStartDay } from '../types';
import { WORLD_CURRENCIES, CurrencyOption } from '../utils/currencies';

export const Sidebar: React.FC = () => {
  const {
    isSidebarOpen,
    setIsSidebarOpen,
    setIsUserProfileModalOpen,
    setIsFeaturesModalOpen,
    setIsRecurringModalOpen,
    recurringTransactions,
    processDueRecurring,
    setIsPinModalOpen,
    setIsSharedHubModalOpen,
    lockApp,
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

  const [isBioSupported, setIsBioSupported] = useState<boolean>(true);

  useEffect(() => {
    isBiometricAvailable().then(setIsBioSupported).catch(() => setIsBioSupported(false));
  }, []);

  const currencyMenuRef = useRef<HTMLDivElement | null>(null);
  const sidebarTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');
  const [currencyDropdownOpen, setCurrencyDropdownOpen] = useState(false);
  const [securitySettings, setSecuritySettings] = useState(() => loadSecuritySettings());
  const [autoUpdateEnabled, setAutoUpdateState] = useState(() => isAutoUpdateEnabled());
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateStep, setUpdateStep] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(auth.currentUser);

  // Capture PWA beforeinstallprompt event immediately in Sidebar React state
  const [deferredPwaPrompt, setDeferredPwaPrompt] = useState<any>(() => {
    if (typeof window !== 'undefined') {
      const win = window as any;
      return win.deferredPwaPrompt || win.deferredPWAInstallPrompt || null;
    }
    return null;
  });

  const [isPwaInstalled, setIsPwaInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      (window.navigator as any).standalone === true
    );
  });

  useEffect(() => {
    const handlePrompt = (e: any) => {
      e.preventDefault?.();
      (window as any).deferredPwaPrompt = e;
      (window as any).deferredPWAInstallPrompt = e;
      setDeferredPwaPrompt(e);
    };
    const handleReady = (e: any) => {
      const p = e?.detail || (window as any).deferredPwaPrompt || (window as any).deferredPWAInstallPrompt;
      if (p) setDeferredPwaPrompt(p);
    };
    const handleInstalled = () => {
      (window as any).deferredPwaPrompt = null;
      (window as any).deferredPWAInstallPrompt = null;
      setDeferredPwaPrompt(null);
      setIsPwaInstalled(true);
    };
    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('pwa-install-ready', handleReady);
    window.addEventListener('appinstalled', handleInstalled);
    window.addEventListener('app-installed-event', handleInstalled);
    if ((window as any).deferredPwaPrompt || (window as any).deferredPWAInstallPrompt) {
      setDeferredPwaPrompt((window as any).deferredPwaPrompt || (window as any).deferredPWAInstallPrompt);
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('pwa-install-ready', handleReady);
      window.removeEventListener('appinstalled', handleInstalled);
      window.removeEventListener('app-installed-event', handleInstalled);
    };
  }, []);

  const warmUpOfflineServiceWorkerCache = () => {
    if (typeof window === 'undefined' || !('caches' in window)) return;
    const coreUrls = [
      './',
      './index.html',
      './manifest.webmanifest',
      './manifest.json',
      './version.json',
      './favicon.png',
      './icon.svg',
      './apple-touch-icon.png',
      './pwa-192x192.png',
      './pwa-512x512.png',
      './pwa-maskable-512x512.png',
    ];
    const domUrls = Array.from(
      document.querySelectorAll<HTMLLinkElement | HTMLScriptElement>('link[rel="stylesheet"], script[src]')
    )
      .map((el) => (el as any).src || (el as any).href)
      .filter(Boolean);

    caches
      .open('app-offline-cache')
      .then((cache) => {
        for (const url of [...coreUrls, ...domUrls]) {
          cache.add(url).catch(() => {});
        }
      })
      .catch(() => {});
  };

  const handleDirectInstallClick = () => {
    installPwa({
      isArabic,
      showToast,
      onInstalled: () => {
        setIsPwaInstalled(true);
        setDeferredPwaPrompt(null);
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
            ? `تم العثور على إصدار جديد (v${res.latestVersion})! جاري مسح الذاكرة والتثبيت...`
            : `New version (v${res.latestVersion}) found! Clearing caches & installing...`
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

  // Keep securitySettings live and synchronized
  useEffect(() => {
    const handleSecUpdate = (e: any) => {
      if (e?.detail) setSecuritySettings(e.detail);
      else setSecuritySettings(loadSecuritySettings());
    };
    window.addEventListener('app_security_updated', handleSecUpdate);
    return () => window.removeEventListener('app_security_updated', handleSecUpdate);
  }, []);

  useEffect(() => {
    if (isSidebarOpen) {
      setSecuritySettings(loadSecuritySettings());
    }
  }, [isSidebarOpen]);

  // Click outside auto-closes currency dropdown
  useEffect(() => {
    if (!currencyDropdownOpen) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (currencyMenuRef.current && !currencyMenuRef.current.contains(e.target as Node)) {
        setCurrencyDropdownOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [currencyDropdownOpen]);

  const isArabic = settings.language === 'ar';

  const filteredCurrencies = useMemo(() => {
    if (!currencySearch.trim()) return WORLD_CURRENCIES;
    const q = currencySearch.toLowerCase().trim();
    return WORLD_CURRENCIES.filter((c) => {
      const matchCode = c.code.toLowerCase().includes(q);
      const matchSymbol = c.symbol.toLowerCase().includes(q);
      const matchEn = c.name.en.toLowerCase().includes(q);
      const matchAr = c.name.ar.toLowerCase().includes(q);
      return matchCode || matchSymbol || matchEn || matchAr;
    });
  }, [currencySearch]);

  const activeCurrency = useMemo(() => {
    return (
      WORLD_CURRENCIES.find((c) => c.symbol === settings.currencySymbol) ||
      WORLD_CURRENCIES[2] // GBP default
    );
  }, [settings.currencySymbol]);

  const [isClosing, setIsClosing] = useState(false);

  const handleAnimatedClose = (afterClose?: () => void) => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      navigateBack();
      afterClose?.();
    }, 180);
  };

  const handleSelectCurrency = (cur: CurrencyOption) => {
    updateSettings({ currencySymbol: cur.symbol });
    setCurrencyDropdownOpen(false);
    showToast(
      isArabic
        ? `تم تغيير العملة إلى ${cur.name.ar} (${cur.symbol})`
        : `Currency changed to ${cur.name.en} (${cur.symbol})`,
      'success'
    );
  };

  // 1:1 Finger-tracking state for opening and closing sidebar
  const [openDragProgress, setOpenDragProgress] = useState<number | null>(null);
  const [closeDragDelta, setCloseDragDelta] = useState<number>(0);
  const [isClosingDrag, setIsClosingDrag] = useState<boolean>(false);

  // Listen to 1:1 drag gesture from screen-edge zone (28px) or boundary tab hand-off
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

  // Swipe in opposite direction to close sidebar with 1:1 tracking
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
      // Vertical scrolling inside sidebar takes priority
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

  const handleSidebarTouchEnd = (e: React.TouchEvent) => {
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

  // Dynamic drawer transform and opacity calculation
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
        {/* User Profile Header: Entire Section is 100% Clickable Card (Item 10) */}
        <div
          onClick={() => {
            handleAnimatedClose(() => setIsUserProfileModalOpen(true));
          }}
          role="button"
          tabIndex={0}
          className="border-b border-zinc-800/80 bg-zinc-900/50 hover:bg-zinc-900/90 p-4 flex items-center justify-between shrink-0 cursor-pointer group active:scale-[0.99] transition select-none"
        >
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <div className="w-13 h-13 rounded-2xl bg-zinc-900 border-2 border-blue-500/80 overflow-hidden flex items-center justify-center text-3xl shadow-lg group-hover:scale-105 transition shrink-0">
              {currentUser && settings.userProfile?.customAvatarUrl ? (
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
              <div className="mt-1 flex items-center gap-2 flex-wrap">
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
        <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y p-4 space-y-6">
          {/* Preferences & Cycle Settings */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-400" />
              <span>{t('preferences')}</span>
            </h4>

            <div className="space-y-3.5">
              {/* World Currency Selector */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1 flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isArabic ? 'العملة الأساسية' : 'Primary Currency'}</span>
                </label>
                <div ref={currencyMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setCurrencyDropdownOpen(!currencyDropdownOpen)}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-white hover:border-zinc-700 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-xs">
                        {activeCurrency.symbol}
                      </span>
                      <span>
                        {activeCurrency.code} — {isArabic ? activeCurrency.name.ar : activeCurrency.name.en}
                      </span>
                    </div>
                    <span className="text-zinc-500 text-[10px]">▼</span>
                  </button>

                  {currencyDropdownOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute z-40 left-0 right-0 mt-1 rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl p-2 max-h-56 overflow-y-auto space-y-1"
                    >
                      <div className="relative mb-2">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input
                          type="text"
                          value={currencySearch}
                          onChange={(e) => setCurrencySearch(e.target.value)}
                          placeholder={isArabic ? 'ابحث في العملات...' : 'Search currencies...'}
                          className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 outline-none focus:border-blue-500"
                        />
                      </div>
                      {filteredCurrencies.map((c) => {
                        const isCurSelected = c.symbol === settings.currencySymbol;
                        return (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => handleSelectCurrency(c)}
                            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left text-xs transition cursor-pointer ${
                              isCurSelected
                                ? 'bg-blue-600/20 text-white font-bold'
                                : 'text-zinc-300 hover:bg-zinc-800'
                            }`}
                          >
                            <span className="truncate">
                              <span className="font-mono font-bold text-amber-400 inline-block w-8">
                                {c.symbol}
                              </span>
                              {c.code} — {isArabic ? c.name.ar : c.name.en}
                            </span>
                            {isCurSelected && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Week Start Day */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">{t('weekStartDay')}</label>
                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
                  {(['saturday', 'sunday', 'monday'] as WeekStartDay[]).map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => updateSettings({ weekStartDay: day })}
                      className={`py-1.5 text-xs font-semibold rounded-lg capitalize transition cursor-pointer ${
                        settings.weekStartDay === day
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {t(day)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Default Month Start Day */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">{t('defaultMonthStartDay')}</label>
                <select
                  value={settings.defaultMonthStartDay}
                  onChange={(e) =>
                    updateSettings({ defaultMonthStartDay: parseInt(e.target.value, 10) })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white outline-none cursor-pointer"
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      Day {d} of month
                    </option>
                  ))}
                </select>
              </div>

              {/* Language Toggle: English / العربية */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('language')}</span>
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => updateSettings({ language: 'en' })}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      settings.language === 'en'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    English (LTR)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSettings({ language: 'ar' })}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      settings.language === 'ar'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    العربية (RTL)
                  </button>
                </div>
              </div>

              {/* Theme Mode: Dark / Light */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1 flex items-center gap-1.5">
                  {settings.themeMode === 'dark' ? (
                    <Moon className="w-3.5 h-3.5 text-indigo-400" />
                  ) : (
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span>{t('theme')}</span>
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => updateSettings({ themeMode: 'dark' })}
                    className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      settings.themeMode === 'dark'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5" />
                    <span>{t('darkMode')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSettings({ themeMode: 'light' })}
                    className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      settings.themeMode === 'light'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5" />
                    <span>{t('lightMode')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Features, Guides, and Scheduled Recurring */}
          <div className="space-y-2.5">
            {/* Recurring Transactions Manager Button */}
            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(false);
                setIsRecurringModalOpen(true);
                processDueRecurring(false);
              }}
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-xs font-bold text-zinc-200 transition cursor-pointer shadow-md active:scale-98"
            >
              <div className="flex items-center gap-2.5">
                <RefreshCw className="w-4 h-4 text-emerald-400" />
                <span>{isArabic ? 'المعاملات المتكررة المجدولة' : 'Recurring Transactions'}</span>
              </div>
              {recurringTransactions.length > 0 && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {recurringTransactions.length}
                </span>
              )}
            </button>

            {/* Single Independent How to Use & Feature Directory Button */}
            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(false);
                setIsFeaturesModalOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2.5 py-3 rounded-2xl bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/40 text-xs font-bold text-blue-400 transition cursor-pointer shadow-lg shadow-blue-950/20 active:scale-98"
            >
              <BookOpen className="w-4 h-4 text-blue-400" />
              <span>{isArabic ? 'دليل الاستخدام ومميزات التطبيق' : 'How to Use & Feature Directory'}</span>
            </button>

            {/* Prominent Shared Accounts / Spaces Hub Button */}
            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(false);
                setIsSharedHubModalOpen(true);
              }}
              className="w-full relative overflow-hidden group flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-blue-900/40 via-purple-900/30 to-blue-950/50 hover:from-blue-900/60 hover:via-purple-900/40 hover:to-blue-950/70 border-2 border-blue-500/50 hover:border-blue-400 text-white transition-all duration-200 cursor-pointer shadow-xl shadow-blue-950/40 hover:shadow-blue-900/50 active:scale-[0.98] my-1"
            >
              {/* Subtle Ambient Glow Effect */}
              <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

              <div className="flex items-center gap-3 relative z-10 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-600/30 group-hover:scale-105 transition-transform">
                  <Share2 className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div className="text-start min-w-0">
                  <h4 className="text-xs sm:text-sm font-extrabold text-white tracking-tight flex items-center gap-1.5 truncate">
                    <span>{isArabic ? 'مساحات الحسابات المشتركة' : 'Shared Accounts & Spaces'}</span>
                  </h4>
                  <p className="text-[10px] text-blue-200/80 font-medium truncate mt-0.5">
                    {isArabic ? 'تعاون ومزامنة حية بالمعرف الرقمي' : 'Live collaboration & 16-digit sync'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 relative z-10 shrink-0 rtl:mr-2 ltr:ml-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-500/25 border border-blue-400/50 text-blue-200 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{isArabic ? 'مباشر' : 'Live'}</span>
                </span>
              </div>
            </button>


          </div>

          {/* App Security & Biometric Lock Section */}
          <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-blue-400" />
                <span>{isArabic ? 'قفل التطبيق والأمان' : 'App Lock & Security'}</span>
              </h4>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={securitySettings.isLockEnabled}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setIsPinModalOpen(true);
                    } else {
                      const updated = { ...securitySettings, isLockEnabled: false };
                      saveSecuritySettings(updated);
                      setSecuritySettings(updated);
                      showToast(isArabic ? 'تم تعطيل قفل التطبيق' : 'App Lock disabled', 'info');
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className={`accordion-wrapper ${securitySettings.isLockEnabled ? 'open' : 'closed'}`}>
              <div className="accordion-inner space-y-2 pt-1 text-xs">
                <button
                  type="button"
                  onClick={() => setIsPinModalOpen(true)}
                  className="w-full py-2 px-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-300 flex items-center justify-between transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isArabic ? 'تغيير رمز PIN' : 'Change 4-Digit PIN'}</span>
                  </span>
                  <span className="text-[10px] text-blue-400 font-bold">{isArabic ? 'تعديل' : 'Edit'}</span>
                </button>

                {/* Biometric Hardware Status (Item 17) */}
                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px]">
                  <span className="text-zinc-400 flex items-center gap-1.5">
                    <span>{isArabic ? 'البصمة / Face ID:' : 'Biometrics:'}</span>
                  </span>
                  {!isBioSupported ? (
                    <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-medium border border-zinc-700">
                      {isArabic ? 'العتاد غير مدعوم على هذا الجهاز' : 'Hardware not supported on this device'}
                    </span>
                  ) : securitySettings.isBiometricEnabled ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                      {isArabic ? 'مفعل بنجاح' : 'Enabled & Active'}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-medium border border-zinc-700">
                      {isArabic ? 'معطل' : 'Disabled'}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsSidebarOpen(false);
                    lockApp();
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-400 font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'قفل التطبيق الآن' : 'Lock Application Now'}</span>
                </button>
              </div>
            </div>
          </div>

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
              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition cursor-pointer active:scale-95 shrink-0"
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
              className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 hover:text-white text-xs font-semibold transition cursor-pointer active:scale-95 shrink-0"
            >
              {isArabic ? 'استيراد' : 'Import'}
            </button>
          </div>

          {/* App Updates & Version Controls (Auto-Update Switch & Check & Update Now) */}
          <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                  <RefreshCw className={`w-4 h-4 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-white truncate">
                    {isArabic ? 'تحديثات التطبيق' : 'App Updates'}
                  </h4>
                  <p className="text-[10px] text-zinc-400 truncate mt-0.5 font-mono">
                    {isArabic ? `الإصدار الحالي: Beta v${CURRENT_APP_VERSION}` : `Current: Beta v${CURRENT_APP_VERSION}`}
                  </p>
                </div>
              </div>

              {/* Auto-Update Toggle Switch */}
              <div className="flex items-center gap-2 shrink-0">
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
            </div>

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
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-750 active:scale-98 border border-zinc-700 text-zinc-200 hover:text-white text-xs font-bold transition cursor-pointer disabled:opacity-50 shadow-sm"
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

          {/* Standalone PWA Installation Card (Outside Backup) */}
          <div className="space-y-2">
            {isPwaInstalled ? (
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs">
                <div className="flex items-center gap-2 text-emerald-400 font-medium">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>
                    {isArabic
                      ? 'مثبت على الشاشة الرئيسية (بدون شريط متصفح)'
                      : 'Installed on Home Screen (Standalone)'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleManualCheckAndUpdate}
                  disabled={isCheckingUpdate}
                  aria-label="Check for updates"
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin text-blue-400' : ''}`} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleDirectInstallClick}
                className="w-full py-2.5 text-sm flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-medium shadow-lg shadow-blue-900/30 transition cursor-pointer"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>{isArabic ? 'تثبيت التطبيق' : 'Install App'}</span>
              </button>
            )}

            {/* Complete Factory Reset & Clear All Data (Bug Fix: Delete PersonalFinanceTrackerDB + signOut + clear) */}
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
                  // Prevent beforeunload or component unmount saves
                  if (typeof window !== 'undefined') {
                    window.sessionStorage.setItem('app_factory_reset_in_progress', 'true');
                  }

                  // 1. Explicitly sign out of Firebase Auth
                  try {
                    await signOut(auth);
                  } catch (e) {
                    console.warn('Sign out during reset:', e);
                  }

                  // 2. Wipe all localStorage and sessionStorage
                  try {
                    window.localStorage.clear();
                    window.sessionStorage.clear();
                  } catch (e) {
                    console.warn('Storage clear during reset:', e);
                  }

                  // 3. Delete IndexedDB database 'PersonalFinanceTrackerDB' (and legacy 'PersonalFinanceDB')
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
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-950/30 hover:bg-red-950/60 border border-red-900/60 text-xs font-bold text-red-400 hover:text-red-300 transition cursor-pointer active:scale-98"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
              <span>{isArabic ? 'مسح جميع البيانات وإعادة ضبط المصنع' : 'Clear All Data & Factory Reset'}</span>
            </button>
          </div>
        </div>

        {/* Sidebar Footer: Version (v1.1.52) & Refresh Button */}
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-950 flex items-center justify-between text-xs text-zinc-400 font-mono shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-zinc-300">Version: Beta v{CURRENT_APP_VERSION}</span>
          </div>

          {/* Refresh App Button */}
          <button
            type="button"
            onClick={handleReloadApp}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition cursor-pointer active:scale-95"
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
    </div>
  );
};
