import { useApp } from '../context/AppContext';

/**
 * Smart Auto-Hiding Header on Scroll
 * - Hides completely whenever any sub-page, drawer, or modal is active
 * - Slides out on downward scroll (deltaY > 5 && currentScrollTop > 40)
 * - Slides back into view immediately on upward scroll (deltaY < -1 || currentScrollTop <= 30)
 */
export function useHeaderScroll() {
  const {
    isHeaderVisible,
    selectedAccountId,
    isSidebarOpen,
    isUserProfileModalOpen,
    isSharedHubModalOpen,
    isFeaturesModalOpen,
    isRecurringModalOpen,
    isPinModalOpen,
    isSmartBudgetModalOpen,
    isAddTxModalOpen,
    editingTx,
    viewingTx,
    isWhatsNewOpen,
    isEditingSpace,
    editingShareId,
    isAccountModalOpen,
    isCategoryModalOpen,
    isResetPeriodModalOpen,
    isFilterModalOpen,
    isSettingsModalOpen,
    customDialogState,
    shareModalState,
    remainingBalanceModalState,
    activeSharedId,
    activeSharedSnapshot,
    activeShareDetailFolder,
    isTxMultiSelect,
    isCategoryMultiSelect,
    isAccountMultiSelect,
    isGlobalMultiSelect,
  } = useApp();

  const isAnySubPageOrModalOpen = Boolean(
    selectedAccountId ||
    isSidebarOpen ||
    isUserProfileModalOpen ||
    isSharedHubModalOpen ||
    isFeaturesModalOpen ||
    isRecurringModalOpen ||
    isPinModalOpen ||
    isSmartBudgetModalOpen ||
    isAddTxModalOpen ||
    editingTx ||
    viewingTx ||
    isWhatsNewOpen ||
    isEditingSpace ||
    editingShareId ||
    isAccountModalOpen ||
    isCategoryModalOpen ||
    isResetPeriodModalOpen ||
    isFilterModalOpen ||
    isSettingsModalOpen ||
    customDialogState ||
    shareModalState?.isOpen ||
    remainingBalanceModalState?.isOpen ||
    activeSharedId ||
    activeSharedSnapshot ||
    activeShareDetailFolder ||
    isTxMultiSelect ||
    isCategoryMultiSelect ||
    isAccountMultiSelect ||
    isGlobalMultiSelect
  );

  if (isAnySubPageOrModalOpen) {
    return false;
  }

  return isHeaderVisible;
}
