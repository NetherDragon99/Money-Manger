import React, { useState, useEffect } from 'react';
import {
  Users,
  Copy,
  Check,
  ExternalLink,
  ArrowDown,
  ArrowUp,
  RotateCw,
  Sparkles,
  ShieldCheck,
  Download,
  Share2,
} from 'lucide-react';
import { listenToSharedAccount, SharedAccountData } from '../utils/firebase';
import { buildShareUrl } from '../utils/sharing';
import { useApp } from '../context/AppContext';

interface SharedAccountLiveViewProps {
  sharedAccountId?: string | null;
  sharedDataSnapshot?: any | null;
  onExit: () => void;
}

export const SharedAccountLiveView: React.FC<SharedAccountLiveViewProps> = ({
  sharedAccountId,
  sharedDataSnapshot,
  onExit,
}) => {
  const { importSingleAccountData, importFullData, showToast, settings } = useApp();
  const isArabic = settings.language === 'ar';

  const [data, setData] = useState<SharedAccountData | null>(() => {
    if (sharedDataSnapshot) {
      if (sharedDataSnapshot.account) {
        return sharedDataSnapshot as SharedAccountData;
      }
      // If it's a bundle with multiple accounts, wrap the primary one
      const primaryAcc = sharedDataSnapshot.accounts?.[0] || {
        id: 'bundle_acc',
        name: sharedDataSnapshot.title || 'Shared Bundle',
        balance: 0,
        icon: '📁',
        
        color: 'blue',
        isPrivate: false,
        customMonthStartDay: 'default',
      };
      return {
        sharedId: 'guest_snapshot',
        ownerUid: 'guest',
        ownerEmail: sharedDataSnapshot.ownerName || 'Guest User',
        accountName: primaryAcc.name,
        account: primaryAcc,
        transactions: sharedDataSnapshot.transactions || [],
        updatedAt: sharedDataSnapshot.createdAt || Date.now(),
      };
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(() => !sharedDataSnapshot && !!sharedAccountId);
  const [isCopied, setIsCopied] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  useEffect(() => {
    if (!sharedAccountId || sharedDataSnapshot) return;
    setIsLoading(true);
    const unsub = listenToSharedAccount(sharedAccountId, (incoming) => {
      setData(incoming);
      setIsLoading(false);
      setLastRefreshed(new Date());
    });
    return () => unsub();
  }, [sharedAccountId, sharedDataSnapshot]);

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setIsCopied(true);
    showToast(isArabic ? 'تم نسخ رابط المشاركة!' : 'Share link copied to clipboard!', 'info');
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleImportToApp = () => {
    if (!data) return;
    try {
      if (sharedDataSnapshot && sharedDataSnapshot.accounts && sharedDataSnapshot.accounts.length > 1) {
        importFullData({
          accounts: sharedDataSnapshot.accounts,
          categories: sharedDataSnapshot.categories || [],
          transactions: sharedDataSnapshot.transactions || [],
          settings,
        });
      } else {
        importSingleAccountData(data.account, data.transactions || []);
      }
      showToast(
        isArabic ? 'تم استيراد وحفظ البيانات في جهازك بنجاح!' : 'Data imported and saved to your device!',
        'success'
      );
      onExit();
    } catch (err: any) {
      showToast(err?.message || 'Error importing data', 'error');
    }
  };

  const account = data?.account;
  const rawTxs = data?.transactions || [];

  // Sort descending by date and time
  const sortedTxs = [...rawTxs].sort((a, b) => {
    const dtA = `${a.date || ''} ${a.time || '00:00'}`;
    const dtB = `${b.date || ''} ${b.time || '00:00'}`;
    return dtB.localeCompare(dtA);
  });

  const totals = sortedTxs.reduce(
    (acc, tx) => {
      if (tx.type === 'income') acc.income += Number(tx.amount) || 0;
      if (tx.type === 'expense') acc.expense += Number(tx.amount) || 0;
      return acc;
    },
    { income: 0, expense: 0 }
  );

  const formatMoney = (amount: number, currency = '£') => {
    return `${currency}${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col antialiased selection:bg-blue-600 selection:text-white">
      {/* Top Banner */}
      <header className="sticky top-0 z-30 bg-gradient-to-r from-blue-950/90 via-zinc-950/95 to-purple-950/90 backdrop-blur-md border-b border-blue-500/30 px-4 py-2.5 flex items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
              <span>{sharedDataSnapshot ? 'External Shared Snapshot' : 'Live Shared Account'}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Read-Only
              </span>
            </div>
            {data?.ownerEmail && (
              <p className="text-[10px] text-zinc-400 truncate">
                Shared by: <span className="text-zinc-200 font-medium">{data.ownerEmail}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopyLink}
            className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white transition active:scale-95"
            title="Copy Share Link"
          >
            {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={handleImportToApp}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow"
            title="Import into your app"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isArabic ? 'استيراد' : 'Import'}</span>
          </button>

          <button
            type="button"
            onClick={onExit}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition active:scale-95 cursor-pointer"
          >
            <span>{isArabic ? 'فتح التطبيق' : 'Open App'}</span>
            <ExternalLink className="w-3 h-3 rtl:rotate-180" />
          </button>
        </div>
      </header>

      {/* Main View Body */}
      <main className="flex-1 max-w-xl w-full mx-auto p-4 space-y-4">
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-3">
            <RotateCw className="w-8 h-8 text-blue-400 animate-spin" />
            <p className="text-sm text-zinc-400 font-medium">Connecting to secure shared account...</p>
          </div>
        ) : !data ? (
          <div className="py-24 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-red-950/40 border border-red-800/60 mx-auto flex items-center justify-center text-red-400">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-white">Shared Data Unavailable</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              This shared link may have expired, was stopped by the owner, or is invalid.
            </p>
            <button
              type="button"
              onClick={onExit}
              className="mt-3 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-semibold text-zinc-200 hover:text-white"
            >
              Return to Main Application
            </button>
          </div>
        ) : (
          <>
            {/* Account Hero Card */}
            <div className="p-5 rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 shadow-2xl relative overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-2xl shadow-inner">
                    {account?.icon || '💳'}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                      <span>{account?.name || data.accountName}</span>
                      <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    </h2>
                    <span className="text-[11px] text-zinc-400 font-mono">
                      Currency: {settings.currencySymbol || '£'}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">
                    Current Balance
                  </span>
                  <span className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">
                    {formatMoney(account?.balance ?? 0, settings.currencySymbol || '£')}
                  </span>
                </div>
              </div>

              {/* Income vs Expenses summary row */}
              <div className="grid grid-cols-2 gap-3 pt-3 text-xs">
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-900/40 text-emerald-400 font-semibold">
                  <ArrowDown className="w-4 h-4 shrink-0" />
                  <div>
                    <div className="text-[10px] text-zinc-400 font-normal uppercase">Total In</div>
                    <div className="font-mono font-bold">
                      {formatMoney(totals.income, settings.currencySymbol || '£')}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-950/30 border border-red-900/40 text-red-400 font-semibold">
                  <ArrowUp className="w-4 h-4 shrink-0" />
                  <div>
                    <div className="text-[10px] text-zinc-400 font-normal uppercase">Total Out</div>
                    <div className="font-mono font-bold">
                      {formatMoney(totals.expense, settings.currencySymbol || '£')}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Transactions Header */}
            <div className="flex items-center justify-between px-1 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Shared Transactions ({sortedTxs.length})
              </h3>
              <span className="text-[10px] font-mono text-zinc-500">
                Updated: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {/* Transactions List */}
            <div className="space-y-2">
              {sortedTxs.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-zinc-950 border border-zinc-900 text-xs text-zinc-500">
                  No transactions recorded in this shared account yet.
                </div>
              ) : (
                sortedTxs.map((tx) => {
                  const isInc = tx.type === 'income';
                  const isExp = tx.type === 'expense';
                  return (
                    <div
                      key={tx.id}
                      className="p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                            isInc
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : isExp
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}
                        >
                          {tx.categoryIcon || (isInc ? '💵' : '💸')}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-white truncate">
                            {tx.description || tx.categoryName || 'Transaction'}
                          </div>
                          <div className="text-[10px] text-zinc-400 mt-0.5 truncate">
                            {tx.date} {tx.time ? `• ${tx.time}` : ''} {tx.categoryName ? `• ${tx.categoryName}` : ''}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`text-sm font-black font-mono ${
                            isInc ? 'text-emerald-400' : isExp ? 'text-red-400' : 'text-blue-400'
                          }`}
                        >
                          {isInc ? '+' : isExp ? '-' : ''}
                          {formatMoney(Number(tx.amount) || 0, settings.currencySymbol || '£')}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="p-4 border-t border-zinc-900 text-center text-[11px] text-zinc-500 flex items-center justify-center gap-2">
        <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
        <span>Personal Finance Tracker — Zero Server Data Storage</span>
      </footer>
    </div>
  );
};
