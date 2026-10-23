import React from 'react';
import { useApp } from '../context/AppContext';
import { Home, Target, PieChart, Landmark, Calculator, Plus } from 'lucide-react';

export const Navigation: React.FC<{ isBarsVisible?: boolean }> = ({ isBarsVisible: propBarsVisible }) => {
  const {
    currentTab,
    setCurrentTab,
    openAddTxModal,
    openAddAccountModal,
    selectedAccountId,
    budgetAlerts,
    settings,
    isHeaderVisible,
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
    t,
  } = useApp();

  const isRtl = settings.language === 'ar';

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

  const isNavVisible = (propBarsVisible !== undefined ? propBarsVisible : isHeaderVisible) && !isAnySubPageOrModalOpen;

  // Floating Action Button (+):
  // Hide on calculator tab or subpages
  const showFab = currentTab !== 'calculator' && !isAnySubPageOrModalOpen;

  // Floating action button click handler:
  const handleFabClick = () => {
    if (currentTab === 'accounts') {
      openAddAccountModal();
    } else {
      openAddTxModal();
    }
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
          style={{
            transform: isNavVisible ? 'translateY(0%)' : 'translateY(115%)',
            transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          className={`fixed bottom-20 md:bottom-24 landscape:bottom-14 left-0 right-0 w-full max-w-md md:max-w-3xl lg:max-w-5xl mx-auto pointer-events-none z-30 px-5 flex justify-end ${
            isNavVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <button
            type="button"
            onClick={handleFabClick}
            aria-label="Add Item"
            className="pointer-events-auto w-14 h-14 md:w-16 md:h-16 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white flex items-center justify-center shadow-2xl shadow-blue-900/60 border border-blue-400/40 transition cursor-pointer"
          >
            <Plus className="w-7 h-7 md:w-8 md:h-8 stroke-[2.5]" />
          </button>
        </div>
      )}

      {/* Bottom Nav Bar with 5 tabs and responsive tablet scaling */}
      <nav
        style={{
          transform: isNavVisible ? 'translateY(0%)' : 'translateY(115%)',
          transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        className={`fixed bottom-0 left-0 right-0 z-30 bg-black/95 backdrop-blur-lg border-t border-zinc-800/80 safe-area-bottom ${
          isNavVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="w-full max-w-md md:max-w-3xl lg:max-w-5xl mx-auto h-16 md:h-20 px-2 md:px-6 grid grid-cols-5 items-center relative">
          {/* Fluid Sliding Active Indicator (Inversion fixed for RTL Arabic) */}
          {activeIndex !== -1 && (
            <div
              className="absolute top-1 bottom-1 md:top-2 md:bottom-2 rounded-2xl bg-blue-500/15 border border-blue-500/30 transition-all duration-300 ease-out pointer-events-none"
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
                className={`flex flex-col md:flex-row md:gap-2 landscape:flex-row landscape:gap-1.5 items-center justify-center py-1 md:py-2 transition-all duration-200 z-10 cursor-pointer h-full ${
                  isActive ? 'text-blue-400 font-bold' : 'text-zinc-500 hover:text-zinc-300 font-medium'
                }`}
              >
                <div
                  className={`p-1 rounded-xl transition-all duration-200 relative ${
                    isActive ? 'scale-110 text-blue-400' : 'text-zinc-400'
                  }`}
                >
                  <Icon className="w-5 h-5 md:w-7 md:h-7" />
                  {tab.key === 'budget' && budgetAlerts.length > 0 && (
                    <span
                      className={`absolute top-0 right-0 w-2 h-2 md:w-2.5 md:h-2.5 rounded-full ${
                        budgetAlerts.some((a) => a.status === 'danger')
                          ? 'bg-red-500 animate-ping'
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
};
