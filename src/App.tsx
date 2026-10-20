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
import { MultiSelectActionBar } from './components/MultiSelectActionBar';
import { ToastContainer } from './components/Toast';
import { WifiOff } from 'lucide-react';
import { checkForAppUpdates, applyLatestAppUpdate } from './utils/versionChecker';
import { TabType } from './types';
import { loadAutoBackupConfig, isBackupDue, executeAutoBackup } from './utils/autoBackup';
import { decodeShareSnapshot } from './utils/sharing';

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
    openAddTxModal,
    isTxMultiSelect,
    clearTxSelection,
    isCategoryMultiSelect,
    clearCategorySelection,
  } = useApp();

  const [activeSharedId, setActiveSharedId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('sharedAccountId');
      return p && p.trim() ? p.trim() : null;
    }
    return null;
  });

  const [activeSharedSnapshot, setActiveSharedSnapshot] = useState<any | null>(() => {
    if (typeof window !== 'undefined') {
      const s = new URLSearchParams(window.location.search).get('sharedData');
      if (s && s.trim()) {
        try {
          return decodeShareSnapshot(s.trim());
        } catch (e) {
          console.warn('Failed to parse shared snapshot from query:', e);
        }
      }
    }
    return null;
  });

  const [updating, setUpdating] = useState(false);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);

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

  const isExitingAppRef = useRef(false);
  const navStateRef = useRef({
    isAppLocked,
    isExitModalOpen,
    isPinModalOpen,
    isRecurringModalOpen,
    isEmojiPickerOpen,
    isFeaturesModalOpen,
    isFilterModalOpen,
    isResetPeriodModalOpen,
    isUserProfileModalOpen,
    isCategoryModalOpen,
    isAccountModalOpen,
    viewingTx,
    isAddTxModalOpen,
    editingTx,
    isSidebarOpen,
    selectedAccountId,
    currentTab,
    isTxMultiSelect,
    isCategoryMultiSelect,
  });

  navStateRef.current = {
    isAppLocked,
    isExitModalOpen,
    isPinModalOpen,
    isRecurringModalOpen,
    isEmojiPickerOpen,
    isFeaturesModalOpen,
    isFilterModalOpen,
    isResetPeriodModalOpen,
    isUserProfileModalOpen,
    isCategoryModalOpen,
    isAccountModalOpen,
    viewingTx,
    isAddTxModalOpen,
    editingTx,
    isSidebarOpen,
    selectedAccountId,
    currentTab,
    isTxMultiSelect,
    isCategoryMultiSelect,
  };

  // Android Hardware Back Button navigation & exit interceptor
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

      // 1. Multi-select mode active -> exit multi-select first
      if (s.isTxMultiSelect) {
        clearTxSelection();
        window.history.pushState({ exitGuard: true }, '');
        return;
      }
      if (s.isCategoryMultiSelect) {
        clearCategorySelection();
        window.history.pushState({ exitGuard: true }, '');
        return;
      }

      // 2. Exit modal open -> close it
      if (s.isExitModalOpen) {
        setIsExitModalOpen(false);
        window.history.pushState({ exitGuard: true }, '');
        return;
      }
      // 3. PIN setup modal open -> close it
      if (s.isPinModalOpen) {
        setIsPinModalOpen(false);
        window.history.pushState({ exitGuard: true }, '');
        return;
      }
      // 4. Recurring transactions modal open -> close it
      if (s.isRecurringModalOpen) {
        setIsRecurringModalOpen(false);
        window.history.pushState({ exitGuard: true }, '');
        return;
      }
      // 5. Emoji Picker open -> close it
      if (s.isEmojiPickerOpen) {
        closeEmojiPicker();
        window.history.pushState({ exitGuard: true }, '');
        return;
      }
      // 6. Features modal open -> close it
      if (s.isFeaturesModalOpen) {
        setIsFeaturesModalOpen(false);
        window.history.pushState({ exitGuard: true }, '');
        return;
      }
      // 7. Advanced Filter modal open -> close it
      if (s.isFilterModalOpen) {
        setIsFilterModalOpen(false);
        window.history.pushState({ exitGuard: true }, '');
        return;
      }
      // 8. Reset Period modal open -> close it
      if (s.isResetPeriodModalOpen) {
        setIsResetPeriodModalOpen(false);
        window.history.pushState({ exitGuard: true }, '');
        return;
      }
      // 9. User Profile modal open -> close it
      if (s.isUserProfileModalOpen) {
        setIsUserProfileModalOpen(false);
        window.history.pushState({ exitGuard: true }, '');
        return;
      }
      // 10. Category modal open -> close it
      if (s.isCategoryModalOpen) {
        closeCategoryModal();
        window.history.pushState({ exitGuard: true }, '');
        return;
      }
      // 11. Account modal open -> close it
      if (s.isAccountModalOpen) {
        closeAccountModal();
        window.history.pushState({ exitGuard: true }, '');
        return;
      }
      // 12. Viewing Tx details -> close it
      if (s.viewingTx) {
        closeTxDetailsModal();
        window.history.pushState({ exitGuard: true }, '');
        return;
      }
      // 13. Add/Edit Tx modal open -> close it
      if (s.isAddTxModalOpen || s.editingTx) {
        closeAddTxModal();
        closeEditTxModal();
        window.history.pushState({ exitGuard: true }, '');
        return;
      }
      // 14. Sidebar open -> close it
      if (s.isSidebarOpen) {
        setIsSidebarOpen(false);
        window.history.pushState({ exitGuard: true }, '');
        return;
      }
      // 15. Account Details page active -> back to accounts list
      if (s.selectedAccountId) {
        setSelectedAccountId(null);
        window.history.pushState({ exitGuard: true }, '');
        return;
      }
      // 16. On non-home tab -> navigate back to Home
      if (s.currentTab !== 'home') {
        setCurrentTab('home');
        window.history.pushState({ exitGuard: true }, '');
        return;
      }
      // 17. On root Home tab with no modal open -> Show Sleek Exit Confirmation!
      setIsExitModalOpen(true);
      window.history.pushState({ exitGuard: true }, '');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Touch gesture swipe handling across tabs & sidebar
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, select, [data-no-swipe], .no-swipe, .overflow-x-auto')) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
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

  // Auto-check GitHub for newest updates on every app open and resume
  useEffect(() => {
    let checkInProgress = false;

    const performUpdateCheck = async () => {
      if (checkInProgress || updating || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
      checkInProgress = true;
      try {
        const res = await checkForAppUpdates();
        if (res.hasUpdate) {
          setUpdating(true);
          showToast(
            settings.language === 'ar'
              ? `تم العثور على إصدار جديد (v${res.latestVersion}) في GitHub! جارٍ التحديث التلقائي...`
              : `New version (v${res.latestVersion}) detected on GitHub! Updating automatically...`,
            'info'
          );
          setTimeout(() => {
            applyLatestAppUpdate();
          }, 1200);
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
    !!editingTx ||
    isPinModalOpen ||
    isRecurringModalOpen ||
    isEmojiPickerOpen ||
    isFeaturesModalOpen ||
    isFilterModalOpen ||
    isResetPeriodModalOpen ||
    isUserProfileModalOpen ||
    isSharedHubModalOpen ||
    isExitModalOpen;

  // Background Scroll Lock (Bug Fix): Locks scrolling on underlying page container when ANY modal/drawer is open
  useEffect(() => {
    if (isAnyModalOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isAnyModalOpen]);

  if (activeSharedId || activeSharedSnapshot) {
    return (
      <SharedAccountLiveView
        sharedAccountId={activeSharedId || undefined}
        sharedDataSnapshot={activeSharedSnapshot || undefined}
        onExit={() => {
          setActiveSharedId(null);
          setActiveSharedSnapshot(null);
          const u = new URL(window.location.href);
          u.searchParams.delete('sharedAccountId');
          u.searchParams.delete('sharedData');
          window.history.replaceState({}, '', u.pathname + (u.search ? u.search : ''));
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex justify-center text-white selection:bg-blue-600 selection:text-white">
      {/* Mobile-First Responsive Container Frame (max-w-[480px] on desktop, 100% on mobile) */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="w-full max-w-[480px] min-h-screen bg-black relative shadow-2xl flex flex-col overflow-x-hidden"
      >
        <OfflineBanner />
        <ToastContainer />

        {/* Main View Display with Isolated Per-Tab Heights */}
        <div className="flex-1 flex flex-col relative overflow-hidden">
          {selectedAccountId && (
            <div className="fixed inset-0 z-40 bg-black animate-in slide-in-from-right rtl:slide-in-from-left duration-250 flex flex-col overflow-y-auto">
              <div className="w-full max-w-[480px] mx-auto min-h-screen flex flex-col">
                <AccountDetailsView />
              </div>
            </div>
          )}

          <div className="flex-1 flex flex-col relative">
            <div className={currentTab === 'home' ? 'block animate-in fade-in duration-150' : 'hidden'}>
              <HomeView />
            </div>
            <div className={currentTab === 'budget' ? 'block animate-in fade-in duration-150' : 'hidden'}>
              <BudgetView />
            </div>
            <div className={currentTab === 'insights' ? 'block animate-in fade-in duration-150' : 'hidden'}>
              <InsightsView />
            </div>
            <div className={currentTab === 'accounts' ? 'block animate-in fade-in duration-150' : 'hidden'}>
              <AccountsView />
            </div>
            <div className={currentTab === 'calculator' ? 'h-full flex-1 flex flex-col overflow-hidden animate-in fade-in duration-150' : 'hidden'}>
              <CalculatorView />
            </div>
          </div>
          <MultiSelectActionBar />
          <Navigation />
        </div>

        {/* Slide-over & Popups */}
        <Sidebar />
        <TransactionModal />
        <TransactionDetailsModal />
        <AccountModal />
        <CategoryModal />
        <UserProfileModal />
        <ResetPeriodModal />
        <AdvancedFilterModal />

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
    <AppProvider>
      <MainAppContent />
    </AppProvider>
  );
}
