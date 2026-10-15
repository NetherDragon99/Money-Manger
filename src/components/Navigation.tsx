import React from 'react';
import { useApp } from '../context/AppContext';
import { Home, Target, PieChart, Landmark, Plus } from 'lucide-react';

export const Navigation: React.FC = () => {
  const {
    currentTab,
    setCurrentTab,
    openAddTxModal,
    openAddAccountModal,
    selectedAccountId,
    t,
  } = useApp();

  // If viewing single Account Details page, hide bottom nav to give full view and use its own context FAB
  if (selectedAccountId) {
    return null;
  }

  // Floating action button click handler:
  // STRICT RULE: When the user is on the Accounts tab, clicking the floating + button
  // MUST open the Add Account Modal (NOT Add Transaction!). On all other tabs, + opens Add Transaction.
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
  ];

  return (
    <>
      {/* Floating Action Button (+) */}
      <button
        type="button"
        onClick={handleFabClick}
        aria-label="Add Item"
        className="fixed bottom-20 right-6 z-40 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white flex items-center justify-center shadow-2xl shadow-blue-900/60 border border-blue-400/40 transition cursor-pointer"
      >
        <Plus className="w-7 h-7 stroke-[2.5]" />
      </button>

      {/* Bottom Nav Bar with exactly 4 tabs */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-black/95 backdrop-blur-lg border-t border-zinc-800/80 px-4 py-2 safe-area-bottom">
        <div className="max-w-md mx-auto grid grid-cols-4 items-center">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setCurrentTab(tab.key)}
                className={`flex flex-col items-center justify-center py-1.5 transition ${
                  isActive ? 'text-blue-500 font-bold' : 'text-zinc-500 hover:text-zinc-300 font-medium'
                }`}
              >
                <div
                  className={`p-1 rounded-xl transition ${
                    isActive ? 'bg-blue-500/10' : ''
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[11px] mt-0.5 tracking-tight">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
