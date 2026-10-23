/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { HomeView } from './views/HomeView';
import { BudgetView } from './views/BudgetView';
import { InsightsView } from './views/InsightsView';
import { AccountsView } from './views/AccountsView';
import { CalculatorView } from './views/CalculatorView';
import { AccountDetailsView } from './components/AccountDetailsView';
import { Navigation } from './components/Navigation';
import { Sidebar } from './components/Sidebar';
import { TransactionModal } from './components/TransactionModal';
import { TransactionDetailsModal } from './components/TransactionDetailsModal';
import { AccountModal } from './components/AccountModal';
import { CategoryModal } from './components/CategoryModal';
import { UserProfileModal } from './components/UserProfileModal';
import { DriveStoragePromptModal } from './components/DriveStoragePromptModal';
import { SyncConflictModal } from './components/SyncConflictModal';
import { ResetPeriodModal } from './components/ResetPeriodModal';
import { AdvancedFilterModal } from './components/AdvancedFilterModal';
import { EmojiPickerModal } from './components/EmojiPickerModal';
import { AppFeaturesModal } from './components/AppFeaturesModal';
import { WhatsNewModal } from './components/WhatsNewModal';
import { ExitConfirmModal } from './components/ExitConfirmModal';
import { AppLockScreen } from './components/AppLockScreen';
import { PinSetupModal } from './components/PinSetupModal';
import { RecurringTransactionsModal } from './components/RecurringTransactionsModal';
import { SharedAccountsHubModal } from './components/SharedAccountsHubModal';
import { SharedAccountLiveView } from './components/SharedAccountLiveView';
import { StandaloneShareView } from './components/StandaloneShareView';
import { MultiSelectActionBar } from './components/MultiSelectActionBar';
import { ToastContainer } from './components/Toast';
import { CustomDialogModal } from './components/CustomDialogModal';
import { WifiOff } from 'lucide-react';
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
import { ErrorBoundary } from './components/ErrorBoundary';

const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500 text-black text-xs font-bold shadow-xl animate-pulse">
      <WifiOff className="w-3.5 h-3.5" />
      <span>Offline Mode — All changes saved locally</span>
    </div>
  );
};

const TABS: TabType[] = ['home', 'budget', 'insights', 'accounts', 'calculator'];

const MainAppContent: React.FC = () => {
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
    customDialogState,
    closeCustomDialog,
    isHeaderVisible,
    setIsHeaderVisible,
    shareModalState,
    closeShareModal,
    remainingBalanceModalState,
    closeRemainingBalanceModal,
    isAccountMultiSelect,
    clearAccountSelection,
    clearGlobalSelection,
  } = useApp();

  const [isBarsVisible, setIsBarsVisible] = useState<boolean>(true);
  const [updating, setUpdating] = useState(false);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const tabHistoryRef = useRef<TabType[]>(['home']);

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

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    if ((window as any).deferredPwaPrompt || (window as any).deferredPWAInstallPrompt) {
      setDeferredPwaPrompt((window as any).deferredPwaPrompt || (window as any).deferredPWAInstallPrompt);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

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

  useEffect(() => {
    const current = tabHistoryRef.current;
    if (current[current.length - 1] !== currentTab) {
      current.push(currentTab);
    }
  }, [currentTab]);

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

  // Real-time listener for incoming bundles on my 16-digit Numeric ID (Item 7)
  useEffect(() => {
    const myNumericId = settings.userProfile?.numericId;
    if (!myNumericId) return;

    const unsub = listenToMyNumericIdInbox(myNumericId, (folders) => {
      if (Array.isArray(folders) && folders.length > 0) {
        const latest = folders[folders.length - 1];
        showToast(
          settings.language === 'ar'
            ? `وصلك مجلد مشاركة جديد من ${latest.ownerName}: "${latest.name}"!`
            : `New share folder received from ${latest.ownerName}: "${latest.name}"!`,
          'success'
        );
      }
    });

    return () => unsub();
  }, [settings.userProfile?.numericId, settings.language]);

  const isExitingAppRef = useRef(false);
  const navStateRef = useRef({
    isAppLocked,
    isExitModalOpen,
    isPinModalOpen,
    isRecurringModalOpen,
    isEmojiPickerOpen,
    isFeaturesModalOpen,
    isWhatsNewOpen,
    isFilterModalOpen,
    isResetPeriodModalOpen,
    isUserProfileModalOpen,
    isCategoryModalOpen,
    isAccountModalOpen,
    viewingTx,
    isAddTxModalOpen,
    editingTx,
    isSidebarOpen,
    isSharedHubModalOpen,
    isEditingSpace,
    editingShareId,
    customDialogState,
    selectedAccountId,
    currentTab,
    isTxMultiSelect,
    isCategoryMultiSelect,
    isAccountMultiSelect,
    activeSharedId,
    activeSharedSnapshot,
    shareModalState,
    remainingBalanceModalState,
  });

  navStateRef.current = {
    isAppLocked,
    isExitModalOpen,
    isPinModalOpen,
    isRecurringModalOpen,
    isEmojiPickerOpen,
    isFeaturesModalOpen,
    isWhatsNewOpen,
    isFilterModalOpen,
    isResetPeriodModalOpen,
    isUserProfileModalOpen,
    isCategoryModalOpen,
    isAccountModalOpen,
    viewingTx,
    isAddTxModalOpen,
    editingTx,
    isSidebarOpen,
    isSharedHubModalOpen,
    isEditingSpace,
    editingShareId,
    customDialogState,
    selectedAccountId,
    currentTab,
    isTxMultiSelect,
    isCategoryMultiSelect,
    isAccountMultiSelect,
    activeSharedId,
    activeSharedSnapshot,
    shareModalState,
    remainingBalanceModalState,
  };

  // Android Hardware Back Button navigation & exit interceptor: Strict Priority Chain
  useEffect(() => {
    if (!window.history.state || !window.history.state.exitGuard) {
      window.history.pushState({ exitGuard: true }, '');
    }

    const handlePopState = () => {
      if (isExitingAppRef.current) return;

      const s = navStateRef.current;

      // 0. If App is locked, prevent any back navigation
      if (s.isAppLocked) {
        window.history.pushState({ exitGuard: true }, '');
        return;
      }

      // Layer 7: High-Priority Dialogs & Confirmations
      if (s.isWhatsNewOpen) {
        setIsWhatsNewOpen(false);
        try {
          localStorage.setItem('last_seen_app_version', CURRENT_APP_VERSION);
        } catch {}
        window.history.pushState({ exitGuard: true }, '');
        return;
      }
      if (s.customDialogState) {
        closeCustomDialog();
        window.history.pushState({ exitGuard: true }, '');
        return;
      }
      if (s.isExitModalOpen) {
        setIsExitModalOpen(false);
        window.history.pushState({ exitGuard: true }, '');
        return;
      }
      if (s.remainingBalanceModalState?.isOpen) {
        closeRemainingBalanceModal();
        window.history.pushState({ exitGuard: true }, '');
        return;
      }
      if (s.isPinModalOpen) {
        setIsPinModalOpen(false);
        window.history.pushState({ exitGuard: true }, '');
        return;
      }

      // Layer 6: Feature & Action Modals
      if (s.shareModalState?.isOpen) {
        closeShareModal();
        window.history.pushState({ exitGuard: true }, '');
        return;
      }
      if (s.isEmojiPickerOpen) {
        closeEmojiPicker();
        window.history.pushState({ exitGuard: true }, '');
        return;
      }
      if (s.isCategoryModalOpen) {
        closeCategoryModal();
        window.history.pushState({ exitGuard: true }, '');
        return;
      }
      if (s.isAccountModalOpen) {
        closeAccountModal();
        window.history.pushState({ exitGuard: true }, '');
        return;
      }
      if (s.viewingTx) {
        closeTxDetailsModal();
        window.history.pushState({ exitGuard: true }, '');
        return;
      }
      if (s.isAddTxModalOpen || s.editingTx) {
        closeAddTxModal();
        closeEditTxModal();
        window.history.pushState({ exitGuard: true }, '');
        return;
      }
      if (s.isRecurringModalOpen) {
        setIsRecurringModalOpen(false);
        window.history.pushState({ exitGuard: true }, '');
        return;
      }

      // Layer 4: Sidebars & Sheet Overlays (Dismiss BEFORE underlying sub-pages!)
      if (s.isFeaturesModalOpen) {
        setIsFeaturesModalOpen(false);
        window.history.pushState({ exitGuard: true }, '');
        return;
      }
      if (s.isFilterModalOpen) {
        setIsFilterModalOpen(false);
        window.history.pushState({ exitGuard: true }, '');
        return;
      }
      if (s.isResetPeriodModalOpen) {
        setIsResetPeriodModalOpen(false);
        window.history.pushState({ exitGuard: true }, '');
        return;
      }
      if (s.isUserProfileModalOpen) {
        setIsUserProfileModalOpen(false);
        window.history.pushState({ exitGuard: true }, '');
        return;
      }
      if (s.isSidebarOpen) {
        setIsSidebarOpen(false);
        window.history.pushState({ exitGuard: true }, '');
        return;
      }

      // Layer 4.5: Space Edit Settings Modal
      if (s.isEditingSpace || s.editingShareId) {
        setIsEditingSpace(false);
        setEditingShareId(null);
        window.history.pushState({ exitGuard: true }, '');
        return;
      }

      // Layer 2: Full-Screen Sub-pages
      if (s.isSharedHubModalOpen) {
        setIsSharedHubModalOpen(false);
        setIsEditingSpace(false);
        setEditingShareId(null);
        window.history.pushState({ exitGuard: true }, '');
        return;
      }
      if (s.selectedAccountId) {
        setSelectedAccountId(null);
        window.history.pushState({ exitGuard: true }, '');
        return;
      }
      if (s.activeSharedId || s.activeSharedSnapshot) {
        closeSharedLiveView();
        window.history.pushState({ exitGuard: true }, '');
        return;
      }

      // Layer 1: Multi-Select Mode active -> Clear selection and return (keep active tab untouched)
      if (s.isTxMultiSelect || s.isCategoryMultiSelect || s.isAccountMultiSelect) {
        clearGlobalSelection();
        window.history.pushState({ exitGuard: true }, '');
        return;
      }

      // Active tab !== 'home' -> Reset active tab to 'home'
      if (s.currentTab !== 'home') {
        setCurrentTab('home');
        window.history.pushState({ exitGuard: true }, '');
        return;
      }

      // On root Home tab with zero modals/sub-views open -> Show Sleek Exit Confirmation!
      setIsExitModalOpen(true);
      window.history.pushState({ exitGuard: true }, '');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Unified bulletproof scroll tracker (window + container)
  const lastScrollTopRef = useRef<number>(0);

  useEffect(() => {
    const handleWindowScroll = () => {
      const currentScrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      const deltaY = currentScrollTop - lastScrollTopRef.current;
      lastScrollTopRef.current = currentScrollTop;

      if (currentScrollTop <= 25 || deltaY < -2) {
        setIsBarsVisible(true);
        setIsHeaderVisible(true);
      } else if (deltaY > 6 && currentScrollTop > 40) {
        setIsBarsVisible(false);
        setIsHeaderVisible(false);
      }
    };

    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleWindowScroll);
  }, []);

  const handleScrollCapture = (e: React.UIEvent) => {
    const target = e.target as HTMLElement;
    if (!target || typeof target.scrollTop !== 'number') return;
    // Ignore scrolls originating from inside modal overlays, sidebars, or dropdowns
    if (target.closest?.('[role="dialog"], [data-modal], .modal-container-anim, .overflow-y-auto.fixed, [data-no-header-scroll], aside')) {
      return;
    }

    const currentScrollTop = target.scrollTop;
    const deltaY = currentScrollTop - lastScrollTopRef.current;
    lastScrollTopRef.current = currentScrollTop;

    // Synchronized Header & Navigation Visibility
    // Immediate Show on Slight Scroll Up (currentScrollTop <= 25 OR deltaY < -2)
    if (currentScrollTop <= 25 || deltaY < -2) {
      setIsBarsVisible(true);
      setIsHeaderVisible(true);
    } else if (deltaY > 6 && currentScrollTop > 40) {
      // Hide on Scroll Down (deltaY > 6 AND currentScrollTop > 40)
      setIsBarsVisible(false);
      setIsHeaderVisible(false);
    }
  };

  useEffect(() => {
    lastScrollTopRef.current = 0;
    setIsBarsVisible(true);
    setIsHeaderVisible(true);
  }, [currentTab]);

  // Touch gesture swipe handling across tabs & sidebar (Item 1)
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isAnyModalOpen) return;
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, select, [data-no-swipe], .no-swipe, .overflow-x-auto, button')) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isAnyModalOpen || !touchStartRef.current) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    if (Math.abs(deltaX) > 15 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      if (!isSwiping) setIsSwiping(true);
    }
  };

  const handleTouchCancel = () => {
    setIsSwiping(false);
    touchStartRef.current = null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsSwiping(false);
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    // Must be predominantly horizontal gesture
    if (Math.abs(deltaX) < 60 || Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return;

    const isRtl = settings.language === 'ar';
    const swipeRight = deltaX > 0;
    const swipeLeft = deltaX < 0;

    const currentIndex = TABS.indexOf(currentTab);

    if ((!isRtl && swipeRight) || (isRtl && swipeLeft)) {
      // Swiping right: go to previous tab or open sidebar if on Home
      if (currentIndex === 0) {
        setIsSidebarOpen(true);
      } else if (currentIndex > 0) {
        setCurrentTab(TABS[currentIndex - 1]);
      }
    } else {
      // Swiping left: go to next tab
      if (currentIndex < TABS.length - 1) {
        setCurrentTab(TABS[currentIndex + 1]);
      }
    }
  };

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

  const isAnyModalOpen =
    isSidebarOpen ||
    isCategoryModalOpen ||
    isAccountModalOpen ||
    !!viewingTx ||
    isAddTxModalOpen ||
    isPinModalOpen ||
    isRecurringModalOpen ||
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
    !!selectedAccountId;

  // Background Scroll Lock (Safe Hotfix): Locks scrolling without position:fixed or touch-target freezing
  useEffect(() => {
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = '';
      };
    } else {
      document.body.style.overflow = '';
      // Restore bars visibility when all overlays/sub-pages are closed
      setIsBarsVisible(true);
      setIsHeaderVisible(true);
    }
  }, [isAnyModalOpen]);

  if (activeSharedId || activeSharedSnapshot) {
    return (
      <StandaloneShareView
        shareId={activeSharedId || undefined}
        sharedDataSnapshot={activeSharedSnapshot || undefined}
        onExploreApp={closeSharedLiveView}
      />
    );
  }

  return (
    <div className="w-full min-h-[100dvh] h-[100dvh] bg-zinc-950 flex justify-center text-white selection:bg-blue-600 selection:text-white">
      {/* Responsive Container Frame across Mobile, Tablet & Desktop (Landscape & Portrait adaptive) */}
      <div
        onScrollCapture={handleScrollCapture}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        className="w-full max-w-none md:max-w-7xl landscape:max-w-none min-h-[100dvh] h-[100dvh] bg-black relative shadow-2xl flex flex-col overflow-x-hidden"
      >
        <OfflineBanner />
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
              <div className="w-full max-w-none md:max-w-7xl landscape:max-w-none mx-auto min-h-[100dvh] flex flex-col bg-black">
                <AccountDetailsView />
              </div>
            </div>
          )}

          {/* Active Tab View Display: Scroll Container Enforces Smooth Scrolling across ALL Breakpoints */}
          <div
            className={`flex-1 min-h-0 w-full flex flex-col relative overflow-y-auto overflow-x-hidden touch-pan-y overscroll-y-contain ${
              isAnyModalOpen ? 'overflow-y-hidden max-h-[100dvh] select-none pointer-events-none' : ''
            }`}
            style={isAnyModalOpen ? { touchAction: 'none' } : { touchAction: 'pan-y' }}
          >
            {(() => {
              const curIdx = TABS.indexOf(currentTab);
              const shouldMount = (tab: TabType) => {
                if (tab === currentTab) return true;
                if (isSwiping) {
                  const idx = TABS.indexOf(tab);
                  return Math.abs(idx - curIdx) === 1;
                }
                return false;
              };

              return (
                <>
                  {shouldMount('home') && (
                    <div className={currentTab === 'home' ? 'w-full min-h-0 flex-1 flex flex-col' : 'hidden'}>
                      <HomeView isBarsVisible={isBarsVisible} />
                    </div>
                  )}
                  {shouldMount('budget') && (
                    <div className={currentTab === 'budget' ? 'w-full min-h-0 flex-1 flex flex-col' : 'hidden'}>
                      <BudgetView isBarsVisible={isBarsVisible} />
                    </div>
                  )}
                  {shouldMount('insights') && (
                    <div className={currentTab === 'insights' ? 'w-full min-h-0 flex-1 flex flex-col' : 'hidden'}>
                      <InsightsView isBarsVisible={isBarsVisible} />
                    </div>
                  )}
                  {shouldMount('accounts') && (
                    <div className={currentTab === 'accounts' ? 'w-full min-h-0 flex-1 flex flex-col' : 'hidden'}>
                      <AccountsView isBarsVisible={isBarsVisible} />
                    </div>
                  )}
                  {shouldMount('calculator') && (
                    <div className={currentTab === 'calculator' ? 'h-full flex-1 min-h-0 flex flex-col overflow-hidden pb-20 md:pb-28 landscape:pb-14' : 'hidden'}>
                      <CalculatorView isBarsVisible={isBarsVisible} />
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          <MultiSelectActionBar />
          <Navigation isBarsVisible={isBarsVisible} />
        </div>

        {/* Slide-over & Popups */}
        <Sidebar />
        <TransactionModal />
        <TransactionDetailsModal />
        <AccountModal />
        <CategoryModal />
        <UserProfileModal />
        <DriveStoragePromptModal />
        <SyncConflictModal />
        <ResetPeriodModal />
        <AdvancedFilterModal />

        {/* Unified Share & Remaining Balance Modals (Items 6 & 8) */}
        <ShareFolderModal />
        <RemainingBalanceModal />

        {/* Shared Accounts Hub Modal */}
        <SharedAccountsHubModal
          isOpen={isSharedHubModalOpen}
          onClose={() => setIsSharedHubModalOpen(false)}
        />

        {/* Recurring Transactions Modal */}
        <RecurringTransactionsModal
          isOpen={isRecurringModalOpen}
          onClose={() => setIsRecurringModalOpen(false)}
          onOpenAddModal={() => openAddTxModal()}
        />

        {/* Security PIN Setup Modal */}
        <PinSetupModal
          isOpen={isPinModalOpen}
          onClose={() => setIsPinModalOpen(false)}
        />

        {/* App Features & Release Notes Modal */}
        <AppFeaturesModal
          isOpen={isFeaturesModalOpen}
          onClose={() => setIsFeaturesModalOpen(false)}
        />

        {/* Automatic What's New on First Launch of each version */}
        <WhatsNewModal />

        {/* Android Exit Confirmation Modal */}
        <ExitConfirmModal
          isOpen={isExitModalOpen}
          onClose={() => {
            setIsExitModalOpen(false);
            if (!window.history.state || !window.history.state.exitGuard) {
              window.history.pushState({ exitGuard: true }, '');
            }
          }}
          onConfirmExit={() => {
            isExitingAppRef.current = true;
            setIsExitModalOpen(false);
            try {
              window.close();
            } catch (e) {}
            if (window.history.length > 1) {
              window.history.go(-window.history.length);
            }
          }}
        />

        {/* Global Emoji Picker */}
        <EmojiPickerModal
          isOpen={isEmojiPickerOpen}
          onClose={closeEmojiPicker}
          onSelect={selectEmoji}
        />

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
  return (
    <ErrorBoundary>
      <AppProvider>
        <MainAppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}
