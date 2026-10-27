/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { NavigationProvider, useNavigation, navigateBack } from './context/NavigationContext';
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
import { SyncConflictModal } from './components/SyncConflictModal';
import { ResetPeriodModal } from './components/ResetPeriodModal';
import { AdvancedFilterModal } from './components/AdvancedFilterModal';
import { EmojiPickerModal } from './components/EmojiPickerModal';
const AppFeaturesModal = React.lazy(() =>
  import('./components/AppFeaturesModal').then((m) => ({ default: m.AppFeaturesModal }))
);
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
import { ErrorBoundary } from './components/ErrorBoundary';

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
  const { isExitModalOpen, cancelExit, confirmExit } = useNavigation();

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

  // 1:1 Finger-Tracking Drag Carousel & Gesture Hand-off across Main Tabs & Sidebar
  const [mainDragOffset, setMainDragOffset] = useState<number>(0);
  const [isMainDragging, setIsMainDragging] = useState<boolean>(false);
  const [targetAdjacentTab, setTargetAdjacentTab] = useState<TabType | null>(null);

  const mainTouchStateRef = useRef<{
    startX: number;
    startY: number;
    startTime: number;
    isHorizontal: boolean | null;
    isEdgeZone: boolean;
    isSidebarEngaged: boolean;
  }>({
    startX: 0,
    startY: 0,
    startTime: 0,
    isHorizontal: null,
    isEdgeZone: false,
    isSidebarEngaged: false,
  });

  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isAnyModalOpen) return;
    const target = e.target as HTMLElement;
    if (
      target.closest(
        'input, textarea, select, button, [data-no-swipe], [data-no-drag], .no-swipe, .overflow-x-auto, svg, canvas, .recharts-responsive-container'
      )
    ) {
      return;
    }

    const touch = e.touches[0];
    const isRtl = settings.language === 'ar';
    const screenWidth = window.innerWidth;
    const isEdgeZone = isRtl
      ? touch.clientX >= screenWidth - 28
      : touch.clientX <= 28;

    mainTouchStateRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      isHorizontal: null,
      isEdgeZone,
      isSidebarEngaged: isEdgeZone,
    };

    if (isEdgeZone) {
      window.dispatchEvent(
        new CustomEvent('mm-sidebar-drag', {
          detail: { phase: 'start', deltaX: 0, clientX: touch.clientX, isRtl },
        })
      );
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isAnyModalOpen) return;
    const state = mainTouchStateRef.current;
    const touch = e.touches[0];
    const deltaX = touch.clientX - state.startX;
    const deltaY = touch.clientY - state.startY;
    const isRtl = settings.language === 'ar';

    if (state.isSidebarEngaged) {
      window.dispatchEvent(
        new CustomEvent('mm-sidebar-drag', {
          detail: { phase: 'move', deltaX, clientX: touch.clientX, isRtl },
        })
      );
      return;
    }

    if (state.isHorizontal === null) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      if (absX < 8 && absY < 8) return;

      if (absY >= absX) {
        state.isHorizontal = false;
        return;
      }
      state.isHorizontal = true;
      setIsMainDragging(true);
    }

    if (!state.isHorizontal) return;

    const curIdx = TABS.indexOf(currentTab);
    const isDraggingToStart = isRtl ? deltaX < 0 : deltaX > 0;
    const isDraggingToEnd = isRtl ? deltaX > 0 : deltaX < 0;

    // Boundary hand-off on Home tab: pulling toward start edge opens Sidebar with 1:1 tracking
    if (curIdx === 0 && isDraggingToStart) {
      state.isSidebarEngaged = true;
      setIsMainDragging(false);
      setMainDragOffset(0);
      window.dispatchEvent(
        new CustomEvent('mm-sidebar-drag', {
          detail: { phase: 'start', deltaX: 0, clientX: touch.clientX, isRtl },
        })
      );
      return;
    }

    // Determine adjacent tab
    let adj: TabType | null = null;
    if (isDraggingToStart && curIdx > 0) {
      adj = TABS[curIdx - 1];
    } else if (isDraggingToEnd && curIdx < TABS.length - 1) {
      adj = TABS[curIdx + 1];
    }
    setTargetAdjacentTab(adj);

    // Apply live 1:1 translation clamped by bounds
    if ((isDraggingToStart && curIdx === 0) || (isDraggingToEnd && curIdx === TABS.length - 1)) {
      setMainDragOffset(deltaX * 0.25); // Rubber-band effect at hard ends
    } else {
      setMainDragOffset(deltaX);
    }
  };

  const handleTouchCancel = () => {
    setIsMainDragging(false);
    setMainDragOffset(0);
    setTargetAdjacentTab(null);
    mainTouchStateRef.current.isHorizontal = null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const state = mainTouchStateRef.current;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - state.startX;
    const duration = Math.max(Date.now() - state.startTime, 1);
    const velocity = Math.abs(deltaX) / duration;
    const isRtl = settings.language === 'ar';

    if (state.isSidebarEngaged) {
      window.dispatchEvent(
        new CustomEvent('mm-sidebar-drag', {
          detail: { phase: 'end', deltaX, clientX: touch.clientX, isRtl },
        })
      );
      state.isSidebarEngaged = false;
      return;
    }

    if (state.isHorizontal) {
      setIsMainDragging(false);
      const screenWidth = window.innerWidth || 360;
      const curIdx = TABS.indexOf(currentTab);
      const isDraggingToStart = isRtl ? deltaX < 0 : deltaX > 0;
      const isDraggingToEnd = isRtl ? deltaX > 0 : deltaX < 0;

      const shouldSwitch = Math.abs(deltaX) > screenWidth * 0.2 || velocity > 0.25;

      if (shouldSwitch) {
        if (isDraggingToStart && curIdx > 0) {
          setCurrentTab(TABS[curIdx - 1]);
        } else if (isDraggingToEnd && curIdx < TABS.length - 1) {
          setCurrentTab(TABS[curIdx + 1]);
        }
      }
      setMainDragOffset(0);
      setTargetAdjacentTab(null);
    }

    state.isHorizontal = null;
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
          {/* 1:1 Finger-Tracking Main View Carousel Container */}
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchCancel}
            className={`flex-1 min-h-0 w-full flex flex-col relative overflow-x-hidden touch-pan-y overscroll-y-contain ${
              isAnyModalOpen ? 'overflow-y-hidden max-h-[100dvh] select-none pointer-events-none' : ''
            }`}
            style={{
              touchAction: isAnyModalOpen ? 'none' : 'pan-y',
              transform: isMainDragging && mainDragOffset !== 0 ? `translate3d(${mainDragOffset}px, 0, 0)` : undefined,
              transition: isMainDragging || prefersReducedMotion ? 'none' : 'transform 260ms cubic-bezier(0.25, 1, 0.5, 1)',
            }}
          >
            {(() => {
              const curIdx = TABS.indexOf(currentTab);
              const shouldMount = (tab: TabType) => {
                if (tab === currentTab) return true;
                if (isMainDragging && targetAdjacentTab === tab) return true;
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
        <SyncConflictModal />
        <ResetPeriodModal />
        <AdvancedFilterModal />

        {/* Unified Share & Remaining Balance Modals (Items 6 & 8) */}
        <ShareFolderModal />
        <RemainingBalanceModal />

        {/* Shared Accounts Hub Modal */}
        <SharedAccountsHubModal
          isOpen={isSharedHubModalOpen}
          onClose={navigateBack}
        />

        {/* Recurring Transactions Modal */}
        <RecurringTransactionsModal
          isOpen={isRecurringModalOpen}
          onClose={navigateBack}
          onOpenAddModal={() => openAddTxModal()}
        />

        {/* Security PIN Setup Modal */}
        <PinSetupModal
          isOpen={isPinModalOpen}
          onClose={navigateBack}
        />

        {/* App Features & Release Notes Modal (Lazy Loaded) */}
        <React.Suspense fallback={null}>
          <AppFeaturesModal
            isOpen={isFeaturesModalOpen}
            onClose={navigateBack}
          />
        </React.Suspense>

        {/* Automatic What's New on First Launch of each version */}
        <WhatsNewModal />


        {/* Android Exit Confirmation Modal */}
        <ExitConfirmModal
          isOpen={isExitModalOpen}
          onClose={cancelExit}
          onConfirmExit={confirmExit}
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
