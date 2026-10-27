import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useApp } from './AppContext';
import { CURRENT_APP_VERSION } from '../utils/versionChecker';
import { TabType } from '../types';

export interface NavigationContextType {
  goBack: () => void;
  isExitModalOpen: boolean;
  setIsExitModalOpen: (open: boolean) => void;
  confirmExit: () => void;
  cancelExit: () => void;
}

export const NavigationContext = createContext<NavigationContextType | null>(null);

// Global safe helper so any UI button or handler can trigger popstate navigation
export const navigateBack = () => {
  if (typeof window !== 'undefined') {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }
};

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const app = useApp();
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const isExitingAppRef = useRef(false);

  // Keep live references to app mutators to avoid stale closures inside popstate
  const appRef = useRef(app);
  appRef.current = app;

  const tabHistoryRef = useRef<TabType[]>(['home']);
  const lastPushedTokenRef = useRef<string>('root:home');
  const pushedDepthRef = useRef<number>(1);
  const isPoppingRef = useRef(false);

  // Track tab history changes
  useEffect(() => {
    const cur = app.currentTab;
    const history = tabHistoryRef.current;
    if (cur === 'home') {
      tabHistoryRef.current = ['home'];
    } else if (history[history.length - 1] !== cur) {
      history.push(cur);
    }
  }, [app.currentTab]);

  // 1. Root sentinel initialization on mount (base-path safe)
  useEffect(() => {
    try {
      const currentState = window.history.state;
      if (!currentState || !currentState.__mm_root) {
        // Base-path safe: preserves current pathname, search, and hash
        window.history.replaceState({ __mm_root: true, depth: 0 }, '', window.location.href);
        window.history.pushState({ __mm_frame: true, token: 'root:home', depth: 1 }, '', window.location.href);
      }
    } catch {}
  }, []);

  // 2. Compute current active visual stack descriptor
  const computeActiveStack = (): string[] => {
    const s = appRef.current;
    const stack: string[] = ['root:home'];

    if (s.currentTab !== 'home') {
      stack.push(`tab:${s.currentTab}`);
    }
    if (s.selectedAccountId) {
      stack.push(`subview:account_details:${s.selectedAccountId}`);
    }
    if (s.isSidebarOpen) {
      stack.push('modal:sidebar');
    }
    if (s.isSharedHubModalOpen) {
      stack.push('modal:shared_hub');
    }
    if (s.activeShareDetailFolder) {
      stack.push(`subview:share_detail:${s.activeShareDetailFolder.id || 'space'}`);
    }
    if (s.activeSharedId || s.activeSharedSnapshot) {
      stack.push(`subview:standalone_share:${s.activeSharedId || 'snapshot'}`);
    }
    if (s.isEditingSpace || s.editingShareId) {
      stack.push('modal:editing_space');
    }
    if (s.shareModalState?.isOpen) {
      stack.push('modal:share');
    }
    if (s.remainingBalanceModalState?.isOpen) {
      stack.push('modal:remaining_balance');
    }
    if (s.isPinModalOpen) {
      stack.push('modal:pin');
    }
    if (s.isRecurringModalOpen) {
      stack.push('modal:recurring');
    }
    if (s.isUserProfileModalOpen) {
      stack.push('modal:user_profile');
    }
    if (s.isFeaturesModalOpen) {
      stack.push('modal:features');
      if (s.selectedFeatureId) {
        stack.push(`subview:feature_guide:preview:${s.selectedFeatureId}`);
      }
    }
    if (s.isWhatsNewOpen) {
      stack.push('modal:whats_new');
    }
    if (s.isFilterModalOpen) {
      stack.push('modal:filter');
    }
    if (s.isResetPeriodModalOpen) {
      stack.push('modal:reset_period');
    }
    if (s.isAccountModalOpen) {
      stack.push('modal:account');
    }
    if (s.isCategoryModalOpen) {
      stack.push('modal:category');
    }
    if (s.viewingTx) {
      stack.push(`modal:view_tx:${s.viewingTx.id}`);
    }
    if (s.isAddTxModalOpen || s.editingTx) {
      stack.push(s.editingTx ? `modal:edit_tx:${s.editingTx.id}` : 'modal:add_tx');
    }
    if (s.isEmojiPickerOpen) {
      stack.push('modal:emoji_picker');
    }
    if (s.customDialogState) {
      stack.push('modal:custom_dialog');
    }

    return stack;
  };

  // 3. Synchronize stack expansion: push exactly one state frame when a new layer opens
  useEffect(() => {
    if (isPoppingRef.current) {
      isPoppingRef.current = false;
      return;
    }

    const stack = computeActiveStack();
    const currentTop = stack[stack.length - 1];

    // Guard against duplicate pushes caused by React StrictMode double effect or re-renders
    if (currentTop === lastPushedTokenRef.current) {
      return;
    }

    // Only push if the stack grew or transitioned forward
    if (stack.length >= pushedDepthRef.current) {
      pushedDepthRef.current = stack.length;
      lastPushedTokenRef.current = currentTop;
      try {
        window.history.pushState(
          { __mm_frame: true, token: currentTop, depth: stack.length },
          '',
          window.location.href
        );
      } catch {}
    } else {
      // Stack shrunk (e.g. state updated after pop), update tracking without pushing
      pushedDepthRef.current = stack.length;
      lastPushedTokenRef.current = currentTop;
    }
  }, [
    app.currentTab,
    app.selectedAccountId,
    app.isSidebarOpen,
    app.isSharedHubModalOpen,
    app.activeShareDetailFolder,
    app.activeSharedId,
    app.activeSharedSnapshot,
    app.isEditingSpace,
    app.editingShareId,
    app.shareModalState?.isOpen,
    app.remainingBalanceModalState?.isOpen,
    app.isPinModalOpen,
    app.isRecurringModalOpen,
    app.isUserProfileModalOpen,
    app.isFeaturesModalOpen,
    app.selectedFeatureId,
    app.featureGuideLayout,
    app.isWhatsNewOpen,
    app.isFilterModalOpen,
    app.isResetPeriodModalOpen,
    app.isAccountModalOpen,
    app.isCategoryModalOpen,
    app.viewingTx?.id,
    app.isAddTxModalOpen,
    app.editingTx?.id,
    app.isEmojiPickerOpen,
    app.customDialogState,
  ]);

  // 4. Popstate handler: Step-by-step hardware/browser Back resolution & Root Exit Sentinel
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (isExitingAppRef.current) return;

      const s = appRef.current;

      // NON-DISMISSIBLE MODAL: Replace vs Merge conflict gate must NEVER be closed by Back!
      if (s.pendingSyncConflict) {
        try {
          window.history.pushState({ __mm_non_dismissible: true }, '', window.location.href);
        } catch {}
        return;
      }

      // App Lock: Lock screen must never be dismissed by Back
      if (s.isAppLocked) {
        try {
          window.history.pushState({ __mm_locked: true }, '', window.location.href);
        } catch {}
        return;
      }

      isPoppingRef.current = true;

      // Check if user popped while Exit Confirmation Modal is already showing: dismiss dialog
      if (isExitModalOpen) {
        setIsExitModalOpen(false);
        try {
          window.history.pushState({ __mm_frame: true, token: 'root:home', depth: 1 }, '', window.location.href);
        } catch {}
        return;
      }

      // Step-by-step topmost layer popping:
      // Layer: Dialogs & Pickers
      if (s.customDialogState) {
        s.closeCustomDialog();
        return;
      }
      if (s.isEmojiPickerOpen) {
        s.closeEmojiPicker();
        return;
      }

      // Layer: Transactions & Cards
      if (s.isAddTxModalOpen || s.editingTx) {
        s.closeAddTxModal();
        s.closeEditTxModal();
        return;
      }
      if (s.viewingTx) {
        s.closeTxDetailsModal();
        return;
      }

      // Layer: Feature Modals
      if (s.isCategoryModalOpen) {
        s.closeCategoryModal();
        return;
      }
      if (s.isAccountModalOpen) {
        s.closeAccountModal();
        return;
      }
      if (s.isResetPeriodModalOpen) {
        s.setIsResetPeriodModalOpen(false);
        return;
      }
      if (s.isFilterModalOpen) {
        s.setIsFilterModalOpen(false);
        return;
      }
      if (s.isWhatsNewOpen) {
        s.setIsWhatsNewOpen(false);
        try {
          localStorage.setItem('last_seen_app_version', CURRENT_APP_VERSION);
        } catch {}
        return;
      }
      if (s.isFeaturesModalOpen && s.selectedFeatureId) {
        s.setSelectedFeatureId(null);
        s.setFeatureGuideLayout('grid');
        return;
      }
      if (s.isFeaturesModalOpen) {
        s.setIsFeaturesModalOpen(false);
        s.setSelectedFeatureId(null);
        s.setFeatureGuideLayout('grid');
        return;
      }
      if (s.isUserProfileModalOpen) {
        s.setIsUserProfileModalOpen(false);
        return;
      }
      if (s.isRecurringModalOpen) {
        s.setIsRecurringModalOpen(false);
        return;
      }
      if (s.isPinModalOpen) {
        s.setIsPinModalOpen(false);
        return;
      }
      if (s.remainingBalanceModalState?.isOpen) {
        s.closeRemainingBalanceModal();
        return;
      }
      if (s.shareModalState?.isOpen) {
        s.closeShareModal();
        return;
      }

      // Layer: Shared Spaces & Sub-views
      if (s.isEditingSpace || s.editingShareId) {
        s.setIsEditingSpace(false);
        s.setEditingShareId(null);
        return;
      }
      if (s.activeShareDetailFolder) {
        s.setActiveShareDetailFolder(null);
        return;
      }
      if (s.activeSharedId || s.activeSharedSnapshot) {
        s.closeSharedLiveView();
        return;
      }
      if (s.isSharedHubModalOpen) {
        s.setIsSharedHubModalOpen(false);
        return;
      }

      // Layer: Sidebar Drawer
      if (s.isSidebarOpen) {
        s.setIsSidebarOpen(false);
        return;
      }

      // Layer: Sub-page Account Details View
      if (s.selectedAccountId) {
        s.setSelectedAccountId(null);
        return;
      }

      // Layer: Multi-select Mode
      if (s.isTxMultiSelect || s.isCategoryMultiSelect || s.isAccountMultiSelect) {
        s.clearGlobalSelection();
        return;
      }

      // Layer: Main Navigation Tab (History traversal back to home)
      if (tabHistoryRef.current.length > 1) {
        tabHistoryRef.current.pop();
        const prevTab = tabHistoryRef.current[tabHistoryRef.current.length - 1] || 'home';
        s.setCurrentTab(prevTab);
        return;
      }
      if (s.currentTab !== 'home') {
        s.setCurrentTab('home');
        return;
      }

      // ROOT LEVEL REACHED: User is on root Home view with zero modals open
      // Intercept popstate by re-pushing sentinel and show bilingual Exit Confirmation Dialog
      try {
        window.history.pushState({ __mm_root: false, depth: 1, token: 'root:home' }, '', window.location.href);
      } catch {}
      setIsExitModalOpen(true);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isExitModalOpen]);

  const confirmExit = () => {
    isExitingAppRef.current = true;
    try {
      window.close();
    } catch {}
    setTimeout(() => {
      // Navigate back past sentinel frames to exit
      window.history.go(-2);
    }, 50);
  };

  const cancelExit = () => {
    setIsExitModalOpen(false);
  };

  return (
    <NavigationContext.Provider
      value={{
        goBack: navigateBack,
        isExitModalOpen,
        setIsExitModalOpen,
        confirmExit,
        cancelExit,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    return {
      goBack: navigateBack,
      isExitModalOpen: false,
      setIsExitModalOpen: () => {},
      confirmExit: () => {},
      cancelExit: () => {},
    };
  }
  return context;
};
