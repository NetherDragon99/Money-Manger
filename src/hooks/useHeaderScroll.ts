import { useApp } from '../context/AppContext';

/**
 * Smart Auto-Hiding Header on Scroll
 * - Hides completely whenever any sub-page, drawer, or modal is active
 * - Slides out on downward scroll (deltaY > 5 && currentScrollTop > 40)
 * - Slides back into view immediately on upward scroll (deltaY < -2 || currentScrollTop <= 30)
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
    isAddTxModalOpen,
    isAccountModalOpen,
    isCategoryModalOpen,
    isResetPeriodModalOpen,
    isFilterModalOpen,
    shareModalState,
    remainingBalanceModalState,
    activeSharedId,
  } = useApp();

  const isAnySubPageOrModalOpen = Boolean(
    selectedAccountId ||
    isSidebarOpen ||
    isUserProfileModalOpen ||
    isSharedHubModalOpen ||
    isFeaturesModalOpen ||
    isRecurringModalOpen ||
    isPinModalOpen ||
    isAddTxModalOpen ||
    isAccountModalOpen ||
    isCategoryModalOpen ||
    isResetPeriodModalOpen ||
    isFilterModalOpen ||
    shareModalState?.isOpen ||
    remainingBalanceModalState?.isOpen ||
    activeSharedId
  );

  if (isAnySubPageOrModalOpen) {
    return false;
  }

  return isHeaderVisible;
}
