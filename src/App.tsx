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
import { isStoredSchemaNewer } from './utils/schemaGuard';
import { SchemaGuardNotice } from './components/SchemaGuardNotice';

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
    // Ignore purely horizontal slider container scrolls
    if (target.classList?.contains('tabs-slider')) {
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

  // Real native horizontal scroll handler: Detects active page cleanly based on viewport center alignment
  const handleSliderScroll = () => {
    const container = tabSliderRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const containerCenter = containerRect.left + containerRect.width / 2;

    // Guard during programmatic smooth scroll (e.g. bottom nav taps)
    if (isProgrammaticScrollRef.current && !isUserTouchingRef.current && targetTabRef.current) {
      const targetIndex = TABS.indexOf(targetTabRef.current);
      if (targetIndex >= 0) {
        const targetPane = container.children[targetIndex] as HTMLElement;
        if (targetPane) {
          const targetPaneRect = targetPane.getBoundingClientRect();
          const targetPaneCenter = targetPaneRect.left + targetPaneRect.width / 2;
          const distToTarget = Math.abs(targetPaneCenter - containerCenter);
          if (distToTarget < 12) {
            isProgrammaticScrollRef.current = false;
            targetTabRef.current = null;
          } else {
            // Still in flight towards the destination tab, strictly block intermediate tab updates
            return;
          }
        }
      }
    }

    let closestTab: TabType = currentTab;
    let minDistance = Infinity;

    for (let i = 0; i < container.children.length; i++) {
      const pane = container.children[i] as HTMLElement;
      const tabName = pane.getAttribute('data-tab') as TabType;
      if (!tabName) continue;
      const paneRect = pane.getBoundingClientRect();
      const paneCenter = paneRect.left + paneRect.width / 2;
      const distance = Math.abs(paneCenter - containerCenter);

      if (distance < minDistance) {
        minDistance = distance;
        closestTab = tabName;
      }
    }

    // Immediately synchronize the active tab and bottom nav indicator in real-time as the user scrolls
    if (closestTab !== currentTab) {
      isHandScrollingRef.current = true;
      setCurrentTab(closestTab);
    }

    if (scrollSettleTimerRef.current) clearTimeout(scrollSettleTimerRef.current);
    scrollSettleTimerRef.current = setTimeout(() => {
      if (isProgrammaticScrollRef.current && targetTabRef.current) return;
      const c = tabSliderRef.current;
      if (!c) return;
      const cRect = c.getBoundingClientRect();
      const cCenter = cRect.left + cRect.width / 2;
      let finalTab: TabType = currentTab;
      let finalMin = Infinity;
      for (let i = 0; i < c.children.length; i++) {
        const p = c.children[i] as HTMLElement;
        const name = p.getAttribute('data-tab') as TabType;
        if (!name) continue;
        const pRect = p.getBoundingClientRect();
        const pCenter = pRect.left + pRect.width / 2;
        const dist = Math.abs(pCenter - cCenter);
        if (dist < finalMin) {
          finalMin = dist;
          finalTab = name;
        }
      }
      if (finalTab && finalTab !== currentTab) {
        isHandScrollingRef.current = true;
        setCurrentTab(finalTab);
      }
    }, 60);
  };

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

    const containerRect = container.getBoundingClientRect();
    const paneRect = targetPane.getBoundingClientRect();
    const distance = Math.abs((paneRect.left + paneRect.width / 2) - (containerRect.left + containerRect.width / 2));
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
        className="w-full max-w-none md:max-w-7xl landscape:max-w-none min-h-[100dvh] h-[100dvh] bg-black relative shadow-2xl flex flex-col overflow-hidden"
        style={{
          height: '100dvh',
          maxHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
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
              <HomeView isBarsVisible={isBarsVisible} />
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
              <BudgetView isBarsVisible={isBarsVisible} />
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
              <InsightsView isBarsVisible={isBarsVisible} />
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
              <AccountsView isBarsVisible={isBarsVisible} />
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
              <CalculatorView isBarsVisible={isBarsVisible} />
            </div>
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
