import React from 'react';
import { useApp } from '../context/AppContext';
import { Home, Target, PieChart, Landmark, Calculator, Plus } from 'lucide-react';

export const Navigation: React.FC = () => {
  const {
    currentTab,
    setCurrentTab,
    openAddTxModal,
    openAddAccountModal,
    selectedAccountId,
    budgetAlerts,
    settings,
    isHeaderVisible,
    t,
  } = useApp();

  const isRtl = settings.language === 'ar';

  // If viewing single Account Details page, hide bottom nav to give full view and use its own context FAB
  if (selectedAccountId) {
    return null;
  }

  // Floating Action Button (+):
  // Hide on calculator tab so it never covers the keypad's "=" button!
  const showFab = currentTab !== 'calculator';

  // Floating action button click handler:
  // When the user is on the Accounts tab, clicking the floating + button
  // opens the Add Account Modal. On all other tabs, + opens Add Transaction.
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
      {/* Floating Action Button (+) - Hidden on calculator tab to prevent blocking = button */}
      {showFab && (
        <div
          className={`fixed bottom-20 left-0 right-0 max-w-md md:max-w-4xl lg:max-w-6xl mx-auto pointer-events-none z-40 px-5 flex justify-end transition-all duration-300 ease-in-out ${
            isHeaderVisible ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0 pointer-events-none'
          }`}
        >
          <button
            type="button"
            onClick={handleFabClick}
            aria-label="Add Item"
            className="pointer-events-auto w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white flex items-center justify-center shadow-2xl shadow-blue-900/60 border border-blue-400/40 transition cursor-pointer"
          >
            <Plus className="w-7 h-7 stroke-[2.5]" />
          </button>
        </div>
      )}

      {/* Bottom Nav Bar with 5 tabs and fluid sliding indicator */}
      <nav
        className={`fixed bottom-0 left-0 right-0 z-30 bg-black/95 backdrop-blur-lg border-t border-zinc-800/80 px-2 py-2 safe-area-bottom transition-all duration-300 ease-in-out ${
          isHeaderVisible ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="max-w-md md:max-w-4xl lg:max-w-6xl mx-auto grid grid-cols-5 items-center relative">
          {/* Fluid Sliding Active Indicator (Inversion fixed for RTL Arabic) */}
          {activeIndex !== -1 && (
            <div
              className="absolute top-0.5 bottom-0.5 rounded-2xl bg-blue-500/15 border border-blue-500/30 transition-all duration-300 ease-out pointer-events-none"
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
                className={`flex flex-col items-center justify-center py-1 transition-all duration-200 z-10 cursor-pointer ${
                  isActive ? 'text-blue-400 font-bold' : 'text-zinc-500 hover:text-zinc-300 font-medium'
                }`}
              >
                <div
                  className={`p-1 rounded-xl transition-all duration-200 relative ${
                    isActive ? 'scale-110 text-blue-400' : 'text-zinc-400'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.key === 'budget' && budgetAlerts.length > 0 && (
                    <span
                      className={`absolute top-0 right-0 w-2 h-2 rounded-full ${
                        budgetAlerts.some((a) => a.status === 'danger')
                          ? 'bg-red-500 animate-ping'
                          : 'bg-amber-400'
                      }`}
                    />
                  )}
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight whitespace-nowrap truncate max-w-full px-1">
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
