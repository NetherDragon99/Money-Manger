/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { NavigationProvider, useNavigation, navigateBack } from './context/NavigationContext';
import { useKeyboardInset } from './hooks/useKeyboardInset';
import { HomeView } from './views/HomeView';
import { BudgetView } from './views/BudgetView';
import { InsightsView } from './views/InsightsView';
import { AccountsView } from './views/AccountsView';
import { CalculatorView } from './views/CalculatorView';
import { Navigation } from './components/Navigation';
import { Sidebar } from './components/Sidebar';
import { TransactionModal } from './components/TransactionModal';
import { TransactionDetailsModal } from './components/TransactionDetailsModal';
import { AccountModal } from './components/AccountModal';
import { CategoryModal } from './components/CategoryModal';
import { SyncConflictModal } from './components/SyncConflictModal';
import { EmojiPickerModal } from './components/EmojiPickerModal';

const AccountDetailsView = React.lazy(() =>
  import('./components/AccountDetailsView').then((m) => ({ default: m.AccountDetailsView }))
);
const UserProfileModal = React.lazy(() =>
  import('./components/UserProfileModal').then((m) => ({ default: m.UserProfileModal }))
);
const ResetPeriodModal = React.lazy(() =>
  import('./components/ResetPeriodModal').then((m) => ({ default: m.ResetPeriodModal }))
);
const AdvancedFilterModal = React.lazy(() =>
  import('./components/AdvancedFilterModal').then((m) => ({ default: m.AdvancedFilterModal }))
);
const SmartBudgetModal = React.lazy(() =>
  import('./components/SmartBudgetModal').then((m) => ({ default: m.SmartBudgetModal }))
);
const SettingsModal = React.lazy(() =>
  import('./components/SettingsModal').then((m) => ({ default: m.SettingsModal }))
);
const TransferFeesModal = React.lazy(() =>
  import('./components/TransferFeesModal').then((m) => ({ default: m.TransferFeesModal }))
);
const PinSetupModal = React.lazy(() =>
  import('./components/PinSetupModal').then((m) => ({ default: m.PinSetupModal }))
);
const RecurringTransactionsModal = React.lazy(() =>
  import('./components/RecurringTransactionsModal').then((m) => ({ default: m.RecurringTransactionsModal }))
);
const SharedAccountsHubModal = React.lazy(() =>
  import('./components/SharedAccountsHubModal').then((m) => ({ default: m.SharedAccountsHubModal }))
);
const StandaloneShareView = React.lazy(() =>
  import('./components/StandaloneShareView').then((m) => ({ default: m.StandaloneShareView }))
);

const loadAppFeaturesModal = () =>
  import('./components/AppFeaturesModal').then((m) => ({ default: m.AppFeaturesModal }));
let AppFeaturesModal = React.lazy(loadAppFeaturesModal);

const loadBillSplitPage = () =>
  import('./components/BillSplitPage').then((m) => ({ default: m.BillSplitPage }));
let BillSplitPage = React.lazy(loadBillSplitPage);
const BillSplitGuestView = React.lazy(() =>
  import('./components/BillSplitGuestView').then((m) => ({ default: m.BillSplitGuestView }))
);

interface LazyChunkErrorBoundaryProps {
  isOpen: boolean;
  isArabic: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

interface LazyChunkErrorBoundaryState {
  hasError: boolean;
  retryCount: number;
}

class LazyChunkErrorBoundary extends React.Component<
  LazyChunkErrorBoundaryProps,
  LazyChunkErrorBoundaryState
> {
  state: LazyChunkErrorBoundaryState = { hasError: false, retryCount: 0 };

  static getDerivedStateFromError(): Partial<LazyChunkErrorBoundaryState> {
    return { hasError: true };
  }

  handleRetry = () => {
    AppFeaturesModal = React.lazy(loadAppFeaturesModal);
    BillSplitPage = React.lazy(loadBillSplitPage);
    this.setState((prev) => ({ hasError: false, retryCount: prev.retryCount + 1 }));
  };

  render() {
    if (this.state.hasError) {
      if (!this.props.isOpen) return null;
      const { isArabic, onClose } = this.props;
      return (
        <div
          onClick={onClose}
          dir={isArabic ? 'rtl' : 'ltr'}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-zinc-950 border border-zinc-800 p-6 text-center space-y-4 shadow-2xl"
          >
            <h3 className="text-base font-bold text-white">
              {isArabic ? 'تعذر تحميل النافذة' : 'Failed to Load Module'}
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isArabic
                ? 'تحقق من اتصالك أو اضغط على إعادة المحاولة لتحميل هذا الجزء.'
                : 'Please check your connection or tap Retry to reload this module.'}
            </p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 transition cursor-pointer"
              >
                {isArabic ? 'إغلاق' : 'Close'}
              </button>
              <button
                type="button"
                onClick={this.handleRetry}
                className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition cursor-pointer"
              >
                {isArabic ? 'إعادة المحاولة' : 'Retry'}
              </button>
            </div>
          </div>
        </div>
      );
    }
    return <React.Fragment key={this.state.retryCount}>{this.props.children}</React.Fragment>;
  }
}
import { WhatsNewModal } from './components/WhatsNewModal';
import { ExitConfirmModal } from './components/ExitConfirmModal';
import { AppLockScreen } from './components/AppLockScreen';
import { MultiSelectActionBar } from './components/MultiSelectActionBar';
import { ToastContainer } from './components/Toast';
import { CustomDialogModal } from './components/CustomDialogModal';
import {
  checkForAppUpdates,
  applyLatestAppUpdate,
  CURRENT_APP_VERSION,
  isAutoUpdateEnabled,
} from './utils/versionChecker';
import { TabType } from './types';
import { loadAutoBackupConfig, isBackupDue, executeAutoBackup } from './utils/autoBackup';
import { decodeShareSnapshot } from './utils/sharing';
import { listenToMyNumericIdInbox, publishUserProfileCard } from './utils/shareFolders';
import { cleanNumericId, getOrCreateNumericId } from './utils/userId';
import { auth, getCachedAuthUser } from './utils/firebase';
import { flushOfflineQueue } from './utils/persistQueue';
import { ShareFolderModal } from './components/ShareFolderModal';
import { RemainingBalanceModal } from './components/RemainingBalanceModal';
import { installPwa } from './utils/pwaInstall';
import { isStoredSchemaNewer } from './utils/schemaGuard';
import { SchemaGuardNotice } from './components/SchemaGuardNotice';
import { BetaInstallBanner } from './components/BetaInstallBanner';
import { reconcileBetaChannelStartup, purgeOtherChannelCaches } from './utils/autoUpdateService';

// Run channel reconciliation and cross-channel cache cleanup immediately at module load
// (before any React tree mounts) so the right SW scope is active from the first paint.
reconcileBetaChannelStartup();
purgeOtherChannelCaches().catch(() => {});


const TABS: TabType[] = ['home', 'budget', 'insights', 'accounts', 'calculator'];

const MainAppContent: React.FC = () => {
  useKeyboardInset();
  const {
    currentTab,
    setCurrentTab,
    selectedAccountId,
    setSelectedAccountId,
    isEmojiPickerOpen,
    closeEmojiPicker,
    selectEmoji,
    showToast,
    settings,
    accounts,
    categories,
    transactions,
    isFeaturesModalOpen,
    setIsFeaturesModalOpen,
    isWhatsNewOpen,
    setIsWhatsNewOpen,
    isFilterModalOpen,
    setIsFilterModalOpen,
    isResetPeriodModalOpen,
    setIsResetPeriodModalOpen,
    isUserProfileModalOpen,
    setIsUserProfileModalOpen,
    isCategoryModalOpen,
    closeCategoryModal,
    isAccountModalOpen,
    closeAccountModal,
    viewingTx,
    closeTxDetailsModal,
    isAddTxModalOpen,
    closeAddTxModal,
    editingTx,
    closeEditTxModal,
    isSidebarOpen,
    setIsSidebarOpen,
    isAppLocked,
    unlockApp,
    isPinModalOpen,
    setIsPinModalOpen,
    isSmartBudgetModalOpen,
    isSettingsModalOpen,
    isTransferFeesModalOpen,
    isRecurringModalOpen,
    setIsRecurringModalOpen,
    isSharedHubModalOpen,
    setIsSharedHubModalOpen,
    isEditingSpace,
    setIsEditingSpace,
    editingShareId,
    setEditingShareId,
    openAddTxModal,
    isTxMultiSelect,
    clearTxSelection,
    isCategoryMultiSelect,
    clearCategorySelection,
    activeSharedId,
    activeSharedSnapshot,
    closeSharedLiveView,
    activeLiveBillId,
    closeLiveBillView,
    isBillSplitOpen,
    closeBillSplit,
    customDialogState,
    closeCustomDialog,
    shareModalState,
    closeShareModal,
    remainingBalanceModalState,
    closeRemainingBalanceModal,
    isAccountMultiSelect,
    clearAccountSelection,
    clearGlobalSelection,
  } = useApp();

  const appShellRef = useRef<HTMLDivElement | null>(null);
  const barsHiddenRef = useRef<boolean>(false);
  const setBarsHidden = (hidden: boolean) => {
    if (barsHiddenRef.current === hidden) return;
    barsHiddenRef.current = hidden;
    appShellRef.current?.setAttribute('data-bars-hidden', hidden ? 'true' : 'false');
  };
  const [updating, setUpdating] = useState(false);
  const { isExitModalOpen, cancelExit, confirmExit, exitHint } = useNavigation();

  const isAnyModalOpen =
    isSidebarOpen ||
    isCategoryModalOpen ||
    isAccountModalOpen ||
    !!viewingTx ||
    isAddTxModalOpen ||
    isPinModalOpen ||
    isRecurringModalOpen ||
    isSettingsModalOpen ||
    isTransferFeesModalOpen ||
    isEmojiPickerOpen ||
    isFeaturesModalOpen ||
    isWhatsNewOpen ||
    isFilterModalOpen ||
    isResetPeriodModalOpen ||
    isUserProfileModalOpen ||
    isSharedHubModalOpen ||
    isExitModalOpen ||
    !!customDialogState ||
    shareModalState.isOpen ||
    !!remainingBalanceModalState?.isOpen ||
    !!selectedAccountId ||
    isBillSplitOpen;

  // Capture PWA beforeinstallprompt event immediately in React state and window.deferredPwaPrompt
  const [deferredPwaPrompt, setDeferredPwaPrompt] = useState<any>(() => {
    if (typeof window !== 'undefined') {
      return (window as any).deferredPwaPrompt || (window as any).deferredPWAInstallPrompt || null;
    }
    return null;
  });

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault?.();
      (window as any).deferredPwaPrompt = e;
      (window as any).deferredPWAInstallPrompt = e;
      setDeferredPwaPrompt(e);
      window.dispatchEvent(new CustomEvent('pwa-install-ready', { detail: e }));
    };

    const handleAppInstalled = () => {
      (window as any).deferredPwaPrompt = null;
      (window as any).deferredPWAInstallPrompt = null;
      setDeferredPwaPrompt(null);
      showToast(
        settings.language === 'ar'
          ? 'تم تثبيت التطبيق بنجاح على جهازك!'
          : 'App installed successfully to your device!',
        'success'
      );
    };

    const handleTriggerInstall = () => {
      installPwa({
        isArabic: settings.language === 'ar',
        showToast,
      });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('trigger-pwa-install', handleTriggerInstall);

    if ((window as any).deferredPwaPrompt || (window as any).deferredPWAInstallPrompt) {
      setDeferredPwaPrompt((window as any).deferredPwaPrompt || (window as any).deferredPWAInstallPrompt);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('trigger-pwa-install', handleTriggerInstall);
    };
  }, [settings.language, showToast]);

  // Force unlock screen orientation to support landscape & portrait mode in installed PWAs and mobile browsers
  useEffect(() => {
    const unlockOrientation = () => {
      try {
        if (typeof screen !== 'undefined') {
          if (screen.orientation && typeof (screen.orientation as any).unlock === 'function') {
            const res = (screen.orientation as any).unlock();
            if (res && typeof res.catch === 'function') res.catch(() => {});
          } else if (typeof (screen as any).unlockOrientation === 'function') {
            (screen as any).unlockOrientation();
          } else if (typeof (screen as any).mozUnlockOrientation === 'function') {
            (screen as any).mozUnlockOrientation();
          } else if (typeof (screen as any).msUnlockOrientation === 'function') {
            (screen as any).msUnlockOrientation();
          }
        }
      } catch {}
    };

    unlockOrientation();

    window.addEventListener('orientationchange', unlockOrientation);
    window.addEventListener('resize', unlockOrientation);
    return () => {
      window.removeEventListener('orientationchange', unlockOrientation);
      window.removeEventListener('resize', unlockOrientation);
    };
  }, []);

  

  // Background Auto Backup Loop
  useEffect(() => {
    const checkAndExecuteBackup = async () => {
      try {
        const config = loadAutoBackupConfig();
        if (isBackupDue(config)) {
          await executeAutoBackup({ accounts, categories, transactions, settings });
        }
      } catch (e) {
        console.warn('Background auto backup error:', e);
      }
    };

    checkAndExecuteBackup();
    const interval = setInterval(checkAndExecuteBackup, 60000); // Check every minute
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkAndExecuteBackup();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [accounts, categories, transactions, settings]);

  // Trigger profile cloud-registration on startup when signed in, and every time UserProfileModal, SharedAccountsHubModal, or ShareFolderModal is opened
  useEffect(() => {
    const syncProfileToCloud = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      const user = auth.currentUser || getCachedAuthUser();
      if (!user) return;
      const clean16 = cleanNumericId(settings.userProfile?.numericId) || getOrCreateNumericId();
      if (clean16.length === 16) {
        publishUserProfileCard({
          numericId: clean16,
          name: settings.userProfile?.name || user.displayName || 'User',
          avatar: settings.userProfile?.avatarEmoji || '👤',
          photoURL: settings.userProfile?.customAvatarUrl || user.photoURL || '',
          uid: user.uid,
        }).catch((e) => console.warn('[App] Offline profile sync skipped:', e));
      }
    };

    syncProfileToCloud();

    const handleOnline = () => {
      flushOfflineQueue();
      syncProfileToCloud();
    };
    window.addEventListener('online', handleOnline);

    const unsub = auth.onAuthStateChanged((user) => {
      if (user) syncProfileToCloud();
    });

    return () => {
      unsub();
      window.removeEventListener('online', handleOnline);
    };
  }, [
    isUserProfileModalOpen,
    isSharedHubModalOpen,
    shareModalState?.isOpen,
    settings.userProfile?.numericId,
    settings.userProfile?.name,
    settings.userProfile?.avatarEmoji,
    settings.userProfile?.customAvatarUrl,
  ]);

  

  // Unified GPU scroll tracker (zero React re-renders during scroll)
  const lastScrollTopRef = useRef<number>(0);
  const accumulatedDeltaRef = useRef<number>(0);
  const sliderRafRef = useRef<number | null>(null);

  useEffect(() => {
    const handleWindowScroll = () => {
      if (isAnyModalOpen || selectedAccountId) return;
      const currentScrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      const prevScrollTop = lastScrollTopRef.current;
      const deltaY = currentScrollTop - prevScrollTop;
      lastScrollTopRef.current = currentScrollTop;

      if (currentScrollTop <= 30 || deltaY < -1) {
        accumulatedDeltaRef.current = 0;
        setBarsHidden(false);
      } else if (deltaY > 8 && currentScrollTop > 45) {
        setBarsHidden(true);
      }
    };

    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleWindowScroll);
  }, [isAnyModalOpen, selectedAccountId]);

  const handleScrollCapture = (e: React.UIEvent) => {
    // Never trigger scroll-hide while a modal, secondary sub-view, or drawer is active
    if (isAnyModalOpen || selectedAccountId) return;

    const target = e.target as HTMLElement;
    if (!target || typeof target.scrollTop !== 'number') return;

    // Ignore scrolls originating from inside modal overlays, sidebars, or dropdowns
    if (target.closest?.('[role="dialog"], [data-modal], .modal-container-anim, .overflow-y-auto.fixed, [data-no-header-scroll], aside')) {
      return;
    }
    // Ignore purely horizontal slider container scrolls
    if (target.classList?.contains('tabs-slider')) {
      return;
    }

    // Only respond to primary view tab containers
    const tabContainer = target.closest?.('[data-tab]');
    if (!tabContainer && !target.hasAttribute?.('data-tab')) {
      return;
    }

    const currentScrollTop = target.scrollTop;
    const prevScrollTop = lastScrollTopRef.current;
    const deltaY = currentScrollTop - prevScrollTop;
    lastScrollTopRef.current = currentScrollTop;

    if (currentScrollTop <= 30) {
      accumulatedDeltaRef.current = 0;
      setBarsHidden(false);
      return;
    }

    if (deltaY < -1) {
      accumulatedDeltaRef.current = 0;
      setBarsHidden(false);
      return;
    }

    if (deltaY > 0) {
      accumulatedDeltaRef.current = Math.max(0, accumulatedDeltaRef.current) + deltaY;
      if (accumulatedDeltaRef.current > 10 && currentScrollTop > 45) {
        setBarsHidden(true);
      }
    }
  };

  useEffect(() => {
    lastScrollTopRef.current = 0;
    accumulatedDeltaRef.current = 0;
    setBarsHidden(false);
  }, [currentTab]);

  // Native CSS Horizontal Page Swiping Engine across Main Views
  const tabSliderRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScrollRef = useRef<boolean>(false);
  const targetTabRef = useRef<TabType | null>(null);
  const isUserTouchingRef = useRef<boolean>(false);
  const isHandScrollingRef = useRef<boolean>(false);
  const programmaticScrollTimerRef = useRef<any>(null);
  const scrollSettleTimerRef = useRef<any>(null);

  // Home Page Edge Pulling gesture to open Sidebar with 1:1 real-time drag
  const homePullRef = useRef<{
    startX: number;
    startY: number;
    isPullingSidebar: boolean;
  } | null>(null);

  const handleHomeTouchStart = (e: React.TouchEvent) => {
    if (currentTab !== 'home') return;
    const touch = e.touches[0];
    homePullRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      isPullingSidebar: false,
    };
  };

  const handleHomeTouchMove = (e: React.TouchEvent) => {
    if (!homePullRef.current || currentTab !== 'home') return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - homePullRef.current.startX;
    const deltaY = touch.clientY - homePullRef.current.startY;
    const isRtl = settings.language === 'ar';
    const isPullingTowardsSidebar = isRtl ? deltaX < 0 : deltaX > 0;

    if (!homePullRef.current.isPullingSidebar) {
      // If user starts vertical scrolling first, cancel sidebar pull so native vertical scroll proceeds
      if (Math.abs(deltaY) > 8 && Math.abs(deltaY) >= Math.abs(deltaX)) {
        homePullRef.current = null;
        return;
      }
      // If pulling towards sidebar with clear horizontal dominant intent
      if (isPullingTowardsSidebar && Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
        homePullRef.current.isPullingSidebar = true;
        window.dispatchEvent(
          new CustomEvent('mm-sidebar-drag', {
            detail: { phase: 'start', deltaX: 0, clientX: touch.clientX, isRtl },
          })
        );
      } else if (!isPullingTowardsSidebar && Math.abs(deltaX) > 10) {
        // Swiping towards budget, let native scroll handle it
        homePullRef.current = null;
        return;
      }
    }

    if (homePullRef.current?.isPullingSidebar) {
      window.dispatchEvent(
        new CustomEvent('mm-sidebar-drag', {
          detail: { phase: 'move', deltaX, clientX: touch.clientX, isRtl },
        })
      );
    }
  };

  const handleHomeTouchEnd = (e: React.TouchEvent) => {
    if (!homePullRef.current) return;
    if (homePullRef.current.isPullingSidebar) {
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - homePullRef.current.startX;
      const isRtl = settings.language === 'ar';
      window.dispatchEvent(
        new CustomEvent('mm-sidebar-drag', {
          detail: { phase: 'end', deltaX, clientX: touch.clientX, isRtl },
        })
      );
    }
    homePullRef.current = null;
  };

  const handleHomeTouchCancel = () => {
    if (homePullRef.current?.isPullingSidebar) {
      window.dispatchEvent(
        new CustomEvent('mm-sidebar-drag', {
          detail: { phase: 'end', deltaX: 0, clientX: 0, isRtl: settings.language === 'ar' },
        })
      );
    }
    homePullRef.current = null;
  };

  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // rAF-throttled horizontal slider tracker using scrollLeft/clientWidth (zero per-frame getBoundingClientRect loops)
  const syncSliderTabFromScroll = () => {
    sliderRafRef.current = null;
    const container = tabSliderRef.current;
    if (!container) return;
    const paneWidth = Math.max(1, container.clientWidth);
    const scrollOffset = Math.abs(container.scrollLeft);

    if (isProgrammaticScrollRef.current && !isUserTouchingRef.current && targetTabRef.current) {
      const targetIndex = TABS.indexOf(targetTabRef.current);
      if (targetIndex >= 0) {
        const distToTarget = Math.abs(scrollOffset - targetIndex * paneWidth);
        if (distToTarget < 12) {
          isProgrammaticScrollRef.current = false;
          targetTabRef.current = null;
        } else {
          return;
        }
      }
    }

    const idx = Math.min(TABS.length - 1, Math.max(0, Math.round(scrollOffset / paneWidth)));
    const closestTab = TABS[idx] || currentTab;
    if (closestTab !== currentTab) {
      isHandScrollingRef.current = true;
      setCurrentTab(closestTab);
    }
  };

  const handleSliderScroll = () => {
    if (sliderRafRef.current === null) {
      sliderRafRef.current = window.requestAnimationFrame(syncSliderTabFromScroll);
    }
    if (scrollSettleTimerRef.current) clearTimeout(scrollSettleTimerRef.current);
    scrollSettleTimerRef.current = setTimeout(() => {
      if (isProgrammaticScrollRef.current && targetTabRef.current) return;
      const c = tabSliderRef.current;
      if (!c) return;
      const paneWidth = Math.max(1, c.clientWidth);
      const idx = Math.min(TABS.length - 1, Math.max(0, Math.round(Math.abs(c.scrollLeft) / paneWidth)));
      const finalTab = TABS[idx];
      if (finalTab && finalTab !== currentTab) {
        isHandScrollingRef.current = true;
        setCurrentTab(finalTab);
      }
    }, 65);
  };

  useEffect(() => {
    return () => {
      if (sliderRafRef.current !== null) window.cancelAnimationFrame(sliderRafRef.current);
    };
  }, []);

  // Synchronize the slider when currentTab is updated programmatically (from bottom navigation or internal links)
  useEffect(() => {
    // If this tab change was triggered by user hand-scrolling,
    // do NOT call scrollIntoView because the user's hand is already actively moving the page!
    if (isHandScrollingRef.current) {
      isHandScrollingRef.current = false;
      return;
    }

    const container = tabSliderRef.current;
    if (!container) return;
    const targetIndex = TABS.indexOf(currentTab);
    if (targetIndex < 0) return;
    const targetPane = container.children[targetIndex] as HTMLElement;
    if (!targetPane) return;

    const paneWidth = Math.max(1, container.clientWidth);
    const distance = Math.abs(Math.abs(container.scrollLeft) - targetIndex * paneWidth);
    if (distance < 8) return;

    targetTabRef.current = currentTab;
    isProgrammaticScrollRef.current = true;
    if (programmaticScrollTimerRef.current) clearTimeout(programmaticScrollTimerRef.current);

    targetPane.scrollIntoView({
      behavior: prefersReducedMotion ? 'instant' : 'smooth',
      inline: 'start',
      block: 'nearest',
    });

    programmaticScrollTimerRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
      targetTabRef.current = null;
    }, 1200);
  }, [currentTab, prefersReducedMotion]);

  // Handle scrollend event to cleanly unlock programmatic scroll once animation completes
  useEffect(() => {
    const container = tabSliderRef.current;
    if (!container) return;

    const handleScrollEnd = () => {
      if (isProgrammaticScrollRef.current) {
        isProgrammaticScrollRef.current = false;
        targetTabRef.current = null;
      }
    };

    container.addEventListener('scrollend', handleScrollEnd);
    return () => container.removeEventListener('scrollend', handleScrollEnd);
  }, []);

  // Ensure instant alignment on language direction change or initial mount
  useEffect(() => {
    const container = tabSliderRef.current;
    if (!container) return;
    const targetIndex = TABS.indexOf(currentTab);
    if (targetIndex < 0) return;
    const targetPane = container.children[targetIndex] as HTMLElement;
    if (!targetPane) return;

    targetPane.scrollIntoView({
      behavior: 'instant',
      inline: 'start',
      block: 'nearest',
    });
  }, [settings.language]);
  // Auto-check for newest updates on every app open and resume
  useEffect(() => {
    let checkInProgress = false;

    const performUpdateCheck = async () => {
      if (checkInProgress || updating || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
      checkInProgress = true;
      try {
        const res = await checkForAppUpdates();
        if (res.hasUpdate) {
          if (isAutoUpdateEnabled()) {
            setUpdating(true);
            showToast(
              settings.language === 'ar'
                ? `تم توفر إصدار أحدث (v${res.latestVersion})! جاري التحديث التلقائي...`
                : `New version (v${res.latestVersion}) available! Updating automatically...`,
              'info'
            );
            setTimeout(() => {
              applyLatestAppUpdate();
            }, 1200);
          } else {
            showToast(
              settings.language === 'ar'
                ? `يتوفر إصدار جديد للتطبيق (v${res.latestVersion})`
                : `A new version (v${res.latestVersion}) is available`,
              'info',
              {
                label: settings.language === 'ar' ? 'تحديث الآن' : 'Update Now',
                onClick: () => {
                  setUpdating(true);
                  applyLatestAppUpdate();
                },
              },
              10000
            );
          }
        }
      } catch (e) {
        console.warn('Update check failed:', e);
      } finally {
        checkInProgress = false;
      }
    };

    performUpdateCheck();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        performUpdateCheck();
      }
    };

    window.addEventListener('focus', performUpdateCheck);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('focus', performUpdateCheck);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [settings.language]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [currentTab]);

  // Background Scroll Lock (Safe Hotfix): Locks scrolling without position:fixed or touch-target freezing
  useEffect(() => {
    (window as any).__isAnyModalOpen = isAnyModalOpen;
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = '';
      };
    } else {
      document.body.style.overflow = '';
      // Restore bars visibility when all overlays/sub-pages are closed
      setBarsHidden(false);
    }
  }, [isAnyModalOpen]);

  if (activeLiveBillId) {
    return (
      <React.Suspense fallback={null}>
        <BillSplitGuestView billId={activeLiveBillId} onExit={closeLiveBillView} />
      </React.Suspense>
    );
  }

  if (activeSharedId || activeSharedSnapshot) {
    return (
      <React.Suspense fallback={null}>
        <StandaloneShareView
          shareId={activeSharedId || undefined}
          sharedDataSnapshot={activeSharedSnapshot || undefined}
          onExploreApp={closeSharedLiveView}
        />
      </React.Suspense>
    );
  }

  return (
    <div className="w-full h-full max-h-full bg-zinc-950 flex justify-center text-white selection:bg-emerald-600 selection:text-white overflow-hidden">
      {/* Responsive Container Frame across Mobile, Tablet & Desktop (Landscape & Portrait adaptive) */}
      <div
        ref={appShellRef}
        data-bars-hidden="false"
        onScrollCapture={handleScrollCapture}
        className="w-full max-w-none md:max-w-7xl landscape:max-w-none h-full max-h-full bg-black relative shadow-2xl flex flex-col overflow-hidden"
      >
        <ToastContainer />
        <CustomDialogModal
          dialogState={customDialogState}
          onClose={closeCustomDialog}
          isArabic={settings.language === 'ar'}
        />

        {/* Main View Display with Isolated Per-Tab Heights */}
        <div className="flex-1 min-h-0 flex flex-col relative w-full">
          {selectedAccountId && (
            <div className="fixed inset-0 z-40 bg-black animate-in slide-in-from-right rtl:slide-in-from-left duration-250 flex flex-col overflow-y-auto overscroll-contain">
              <div className="w-full max-w-none md:max-w-7xl landscape:max-w-none mx-auto min-h-full flex flex-col bg-black">
                <React.Suspense fallback={null}>
                  <AccountDetailsView />
                </React.Suspense>
              </div>
            </div>
          )}

          {isBillSplitOpen && (
            <div className="fixed inset-0 z-40 bg-[var(--bg-primary)] animate-in slide-in-from-right rtl:slide-in-from-left duration-250 flex flex-col overflow-hidden">
              <LazyChunkErrorBoundary
                isOpen={isBillSplitOpen}
                isArabic={settings.language === 'ar'}
                onClose={closeBillSplit}
              >
                <React.Suspense
                  fallback={
                    <div className="w-full h-[100dvh] bg-[var(--bg-primary)] p-6 space-y-4">
                      <div className="h-12 rounded-2xl bg-[var(--bg-secondary)] animate-pulse" />
                      <div className="h-24 rounded-2xl bg-[var(--bg-secondary)] animate-pulse" />
                      <div className="h-44 rounded-2xl bg-[var(--bg-secondary)] animate-pulse" />
                    </div>
                  }
                >
                  <BillSplitPage />
                </React.Suspense>
              </LazyChunkErrorBoundary>
            </div>
          )}

          {/* Native CSS Horizontal Scroll-Snap Slider Across Main Views */}
          <div
            ref={tabSliderRef}
            onScroll={handleSliderScroll}
            onTouchStart={() => {
              isUserTouchingRef.current = true;
              isProgrammaticScrollRef.current = false;
              targetTabRef.current = null;
            }}
            onTouchEnd={() => {
              isUserTouchingRef.current = false;
            }}
            onTouchCancel={() => {
              isUserTouchingRef.current = false;
            }}
            className="tabs-slider w-full flex-1 min-h-0 flex flex-row overflow-x-auto overflow-y-hidden snap-x snap-mandatory no-scrollbar"
            style={{
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch',
              overscrollBehaviorX: 'contain',
              scrollbarWidth: 'none',
            }}
          >
            {/* Tab 0: Home */}
            <div
              data-tab="home"
              onTouchStart={handleHomeTouchStart}
              onTouchMove={handleHomeTouchMove}
              onTouchEnd={handleHomeTouchEnd}
              onTouchCancel={handleHomeTouchCancel}
              className="w-full min-w-full h-full flex-shrink-0 snap-start snap-always overflow-y-auto overscroll-y-contain flex flex-col"
              style={{
                flex: '0 0 100%',
                width: '100%',
                minWidth: '100%',
                height: '100%',
                scrollSnapAlign: 'start',
                scrollSnapStop: 'always',
                overflowY: 'auto',
                overflowX: 'hidden',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <HomeView isBarsVisible={true} />
            </div>

            {/* Tab 1: Budget */}
            <div
              data-tab="budget"
              className="w-full min-w-full h-full flex-shrink-0 snap-start snap-always overflow-y-auto overscroll-y-contain flex flex-col"
              style={{
                flex: '0 0 100%',
                width: '100%',
                minWidth: '100%',
                height: '100%',
                scrollSnapAlign: 'start',
                scrollSnapStop: 'always',
                overflowY: 'auto',
                overflowX: 'hidden',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <BudgetView isBarsVisible={true} />
            </div>

            {/* Tab 2: Insights */}
            <div
              data-tab="insights"
              className="w-full min-w-full h-full flex-shrink-0 snap-start snap-always overflow-y-auto overscroll-y-contain flex flex-col"
              style={{
                flex: '0 0 100%',
                width: '100%',
                minWidth: '100%',
                height: '100%',
                scrollSnapAlign: 'start',
                scrollSnapStop: 'always',
                overflowY: 'auto',
                overflowX: 'hidden',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <InsightsView isBarsVisible={true} />
            </div>

            {/* Tab 3: Accounts */}
            <div
              data-tab="accounts"
              className="w-full min-w-full h-full flex-shrink-0 snap-start snap-always overflow-y-auto overscroll-y-contain flex flex-col"
              style={{
                flex: '0 0 100%',
                width: '100%',
                minWidth: '100%',
                height: '100%',
                scrollSnapAlign: 'start',
                scrollSnapStop: 'always',
                overflowY: 'auto',
                overflowX: 'hidden',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <AccountsView isBarsVisible={true} />
            </div>

            {/* Tab 4: Calculator */}
            <div
              data-tab="calculator"
              className="w-full min-w-full h-full flex-shrink-0 snap-start snap-always overflow-y-auto overscroll-y-contain flex flex-col pb-20 md:pb-28 landscape:pb-14"
              style={{
                flex: '0 0 100%',
                width: '100%',
                minWidth: '100%',
                height: '100%',
                scrollSnapAlign: 'start',
                scrollSnapStop: 'always',
                overflowY: 'auto',
                overflowX: 'hidden',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <CalculatorView isBarsVisible={true} />
            </div>
          </div>
          <MultiSelectActionBar />
          <Navigation isBarsVisible={true} />
        </div>

        {/* Slide-over & Conditionally Mounted Popups */}
        <BetaInstallBanner />
        <Sidebar />
        {(isAddTxModalOpen || !!editingTx) && <TransactionModal />}
        {!!viewingTx && <TransactionDetailsModal />}
        {isAccountModalOpen && <AccountModal />}
        {isCategoryModalOpen && <CategoryModal />}
        <SyncConflictModal />
        {shareModalState.isOpen && <ShareFolderModal />}
        {!!remainingBalanceModalState?.isOpen && <RemainingBalanceModal />}

        <React.Suspense fallback={null}>
          {isUserProfileModalOpen && <UserProfileModal />}
          {isResetPeriodModalOpen && <ResetPeriodModal />}
          {isFilterModalOpen && <AdvancedFilterModal />}

          {isSharedHubModalOpen && (
            <SharedAccountsHubModal
              isOpen={isSharedHubModalOpen}
              onClose={navigateBack}
            />
          )}

          {isRecurringModalOpen && (
            <RecurringTransactionsModal
              isOpen={isRecurringModalOpen}
              onClose={navigateBack}
              onOpenAddModal={() => openAddTxModal()}
            />
          )}

          {isPinModalOpen && (
            <PinSetupModal
              isOpen={isPinModalOpen}
              onClose={navigateBack}
            />
          )}

          {isFeaturesModalOpen && (
            <LazyChunkErrorBoundary
              isOpen={isFeaturesModalOpen}
              isArabic={settings.language === 'ar'}
              onClose={navigateBack}
            >
              <AppFeaturesModal
                isOpen={isFeaturesModalOpen}
                onClose={navigateBack}
              />
            </LazyChunkErrorBoundary>
          )}

          {isSmartBudgetModalOpen && (
            <SmartBudgetModal
              isOpen={isSmartBudgetModalOpen}
              onClose={navigateBack}
            />
          )}

          {isSettingsModalOpen && (
            <SettingsModal
              isOpen={isSettingsModalOpen}
              onClose={navigateBack}
            />
          )}

          {isTransferFeesModalOpen && (
            <TransferFeesModal
              isOpen={isTransferFeesModalOpen}
              onClose={navigateBack}
            />
          )}
        </React.Suspense>

        {/* Automatic What's New on First Launch of each version */}
        <WhatsNewModal />

        {/* Android Exit Confirmation Modal */}
        <ExitConfirmModal
          isOpen={isExitModalOpen}
          onClose={cancelExit}
          onConfirmExit={confirmExit}
          exitHint={exitHint}
        />

        {/* Global Emoji Picker */}
        {isEmojiPickerOpen && (
          <EmojiPickerModal
            isOpen={isEmojiPickerOpen}
            onClose={closeEmojiPicker}
            onSelect={selectEmoji}
          />
        )}

        {/* Biometric & PIN App Lock Screen */}
        <AppLockScreen
          isLocked={isAppLocked}
          onUnlocked={unlockApp}
        />
      </div>
    </div>
  );
};

export default function App() {
  const [newerSchemaDetected] = useState(() => isStoredSchemaNewer());

  if (newerSchemaDetected) {
    return <SchemaGuardNotice />;
  }

  return (
    <AppProvider>
      <NavigationProvider>
        <MainAppContent />
      </NavigationProvider>
    </AppProvider>
  );
}
