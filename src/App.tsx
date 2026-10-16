/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { HomeView } from './views/HomeView';
import { BudgetView } from './views/BudgetView';
import { InsightsView } from './views/InsightsView';
import { AccountsView } from './views/AccountsView';
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
import { ToastContainer } from './components/Toast';
import { WifiOff, Sparkles } from 'lucide-react';
import { checkForAppUpdates, applyLatestAppUpdate } from './utils/versionChecker';

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

const MainAppContent: React.FC = () => {
  const {
    currentTab,
    selectedAccountId,
    isEmojiPickerOpen,
    closeEmojiPicker,
    selectEmoji,
    showToast,
    settings,
    isFeaturesModalOpen,
    setIsFeaturesModalOpen,
  } = useApp();
  const [updating, setUpdating] = useState(false);

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

    // Check immediately on startup
    performUpdateCheck();

    // Check when user resumes or focuses the app
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

  return (
    <div className="min-h-screen bg-black text-white relative selection:bg-blue-600 selection:text-white">
      <OfflineBanner />
      <ToastContainer />

      {/* Main View Display */}
      {selectedAccountId ? (
        <AccountDetailsView />
      ) : (
        <>
          {currentTab === 'home' && <HomeView />}
          {currentTab === 'budget' && <BudgetView />}
          {currentTab === 'insights' && <InsightsView />}
          {currentTab === 'accounts' && <AccountsView />}
          <Navigation />
        </>
      )}

      {/* Slide-over & Popups */}
      <Sidebar />
      <TransactionModal />
      <TransactionDetailsModal />
      <AccountModal />
      <CategoryModal />
      <UserProfileModal />
      <ResetPeriodModal />
      <AdvancedFilterModal />

      {/* App Features & Release Notes Modal */}
      <AppFeaturesModal
        isOpen={isFeaturesModalOpen}
        onClose={() => setIsFeaturesModalOpen(false)}
      />

      {/* Automatic What's New on First Launch of each version */}
      <WhatsNewModal />

      {/* Global Emoji Picker */}
      <EmojiPickerModal
        isOpen={isEmojiPickerOpen}
        onClose={closeEmojiPicker}
        onSelect={selectEmoji}
      />
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
