import React from 'react';
import { useAppActions, useAppData, useAppUI } from '../context/AppContext';
import { Home, Target, PieChart, Landmark, Calculator, Plus } from 'lucide-react';

export const Navigation: React.FC<{ isBarsVisible?: boolean }> = React.memo(({ isBarsVisible: propBarsVisible }) => {
  const { budgetAlerts, settings, t } = useAppData();
  const {
    currentTab,
    selectedAccountId,
    isHeaderVisible,
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
    shareModalState,
    remainingBalanceModalState,
    activeSharedId,
    activeSharedSnapshot,
    activeShareDetailFolder,
    isTxMultiSelect,
    isCategoryMultiSelect,
    isAccountMultiSelect,
    isGlobalMultiSelect,
  } = useAppUI();
  const {
    setCurrentTab,
    openAddTxModal,
    openAddAccountModal,
    openAddCategoryModal,
  } = useAppActions();

  const isRtl = settings.language === 'ar';

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

  const isNavVisible = (propBarsVisible !== undefined ? propBarsVisible : isHeaderVisible) && !isAnySubPageOrModalOpen;

  // Floating Action Button (+):
  // Hide on calculator tab, subpages, open modals, multi-select mode
  const showFab = currentTab !== 'calculator' && !isAnySubPageOrModalOpen;

  // Floating action button click handler:
  const handleFabClick = () => {
    if (currentTab === 'accounts') {
      openAddAccountModal();
    } else if (currentTab === 'budget') {
      openAddCategoryModal();
    } else {
      openAddTxModal();
    }
  };

  const getFabAriaLabel = () => {
    if (currentTab === 'accounts') return t('addAccount');
    if (currentTab === 'budget') return t('addCategory');
    return t('addTransaction');
  };

  const tabs = [
    { key: 'home' as const, label: t('home'), icon: Home },
    { key: 'budget' as const, label: t('budget'), icon: Target },
    { key: 'insights' as const, label: t('insights'), icon: PieChart },
    { key: 'accounts' as const, label: t('accounts'), icon: Landmark },
    { key: 'calculator' as const, label: t('calculator'), icon: Calculator },
  ];

  const activeIndex = tabs.findIndex((tab) => tab.key === currentTab);

  return (
    <>
      {/* Floating Action Button (+) - Hidden on calculator tab or subpages */}
      {showFab && (
        <div
          data-hidden={!isNavVisible ? 'true' : undefined}
          className="app-auto-fab fixed bottom-24 md:bottom-28 landscape:bottom-20 right-4 md:right-8 rtl:right-auto rtl:left-4 md:rtl:left-8 end-4 md:end-8 pointer-events-none z-30"
        >
          <button
            type="button"
            onClick={handleFabClick}
            aria-label={getFabAriaLabel()}
            className="pointer-events-auto min-w-[44px] min-h-[44px] w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 active:scale-95 text-black flex items-center justify-center shadow-2xl shadow-emerald-950/70 border border-emerald-300/40 transition cursor-pointer"
          >
            <Plus className="w-7 h-7 md:w-8 md:h-8 stroke-[2.5]" />
          </button>
        </div>
      )}

      {/* Bottom Nav Bar with 5 tabs and responsive tablet scaling */}
      <nav
        data-hidden={!isNavVisible ? 'true' : undefined}
        className="app-auto-nav fixed bottom-0 left-0 right-0 z-20 bg-[#07090b]/95 border-t border-zinc-800/80 safe-area-bottom"
      >
        <div className="w-full max-w-md md:max-w-3xl lg:max-w-5xl mx-auto h-16 md:h-20 px-2 md:px-6 grid grid-cols-5 items-center relative">
          {/* Fluid Sliding Active Indicator (Inversion fixed for RTL Arabic) */}
          {activeIndex !== -1 && (
            <div
              className="absolute top-1 bottom-1 md:top-2 md:bottom-2 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 transition-all duration-300 ease-out pointer-events-none"
              style={{
                width: `${100 / tabs.length}%`,
                left: isRtl
                  ? `${(tabs.length - 1 - activeIndex) * (100 / tabs.length)}%`
                  : `${activeIndex * (100 / tabs.length)}%`,
              }}
            />
          )}

          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setCurrentTab(tab.key)}
                className={`flex flex-col md:flex-row md:gap-2 landscape:flex-row landscape:gap-1.5 items-center justify-center py-1 md:py-2 transition-colors duration-200 z-10 cursor-pointer h-full ${
                  isActive ? 'text-emerald-400 font-bold' : 'text-zinc-500 hover:text-zinc-300 font-medium'
                }`}
              >
                <div
                  className={`p-1 rounded-xl transition-transform duration-200 relative ${
                    isActive ? 'scale-110 text-emerald-400' : 'text-zinc-400'
                  }`}
                >
                  <Icon className="w-5 h-5 md:w-7 md:h-7" />
                  {tab.key === 'budget' && budgetAlerts.length > 0 && (
                    <span
                      className={`absolute top-0 right-0 w-2 h-2 md:w-2.5 md:h-2.5 rounded-full ${
                        budgetAlerts.some((a) => a.status === 'danger')
                          ? 'bg-red-500'
                          : 'bg-amber-400'
                      }`}
                    />
                  )}
                </div>
                <span className="text-[10px] md:text-sm font-medium mt-0.5 tracking-tight whitespace-nowrap truncate max-w-full px-1">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
});
