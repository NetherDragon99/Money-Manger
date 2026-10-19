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
} from 'lucide-react';
import { listenToSharedAccount, SharedAccountData } from '../utils/firebase';

interface SharedAccountLiveViewProps {
  sharedAccountId: string;
  onExit: () => void;
}

export const SharedAccountLiveView: React.FC<SharedAccountLiveViewProps> = ({
  sharedAccountId,
  onExit,
}) => {
  const [data, setData] = useState<SharedAccountData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  useEffect(() => {
    setIsLoading(true);
    const unsub = listenToSharedAccount(sharedAccountId, (incoming) => {
      setData(incoming);
      setIsLoading(false);
      setLastRefreshed(new Date());
    });
    return () => unsub();
  }, [sharedAccountId]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
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
              <span>Live Shared Account</span>
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
            onClick={onExit}
            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow shadow-blue-950/50 flex items-center gap-1.5 active:scale-95 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Open Full App</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-xl w-full mx-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-zinc-400 font-mono">Connecting to live cloud stream...</p>
          </div>
        ) : !data || !account ? (
          <div className="text-center py-20 px-6 space-y-4 rounded-3xl bg-zinc-950 border border-zinc-800">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-3xl">
              🔍
            </div>
            <h2 className="text-lg font-bold text-white">Shared Account Not Found</h2>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
              This shared link may have expired or was revoked by the account owner.
              You can still use the full Personal Finance App to manage your own finances.
            </p>
            <button
              type="button"
              onClick={onExit}
              className="px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg active:scale-95 cursor-pointer"
            >
              Go to Personal Finance App
            </button>
          </div>
        ) : (
          <>
            {/* Account Hero Card */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 shadow-2xl space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-14 h-14 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-3xl shadow-inner shrink-0">
                    {account.icon || '🏦'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h1 className="text-lg font-black text-white truncate">{account.name}</h1>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Live
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                      {sortedTxs.length} {sortedTxs.length === 1 ? 'transaction' : 'transactions'}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-zinc-400 font-mono">
                    Refreshed: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* Running Balance */}
              <div className="p-4 rounded-2xl bg-black/60 border border-zinc-800/80 text-center space-y-1">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  Live Running Balance
                </span>
                <div className="text-3xl sm:text-4xl font-black font-mono text-white tracking-tight">
                  {formatMoney(account.balance || 0)}
                </div>
              </div>

              {/* Income & Expense Metrics */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-900/40 space-y-1">
                  <div className="flex items-center gap-1 text-xs font-bold text-emerald-400">
                    <ArrowDown className="w-3.5 h-3.5" />
                    <span>Total Inflow</span>
                  </div>
                  <div className="text-base sm:text-lg font-black font-mono text-emerald-300">
                    +{formatMoney(totals.income)}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-red-950/20 border border-red-900/40 space-y-1">
                  <div className="flex items-center gap-1 text-xs font-bold text-red-400">
                    <ArrowUp className="w-3.5 h-3.5" />
                    <span>Total Outflow</span>
                  </div>
                  <div className="text-base sm:text-lg font-black font-mono text-red-300">
                    -{formatMoney(totals.expense)}
                  </div>
                </div>
              </div>
            </div>

            {/* Transactions Section */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Transaction History
                </h2>
                <span className="text-[10px] text-zinc-500 font-mono">Real-time Cloud Sync</span>
              </div>

              {sortedTxs.length === 0 ? (
                <div className="p-8 rounded-2xl bg-zinc-950 border border-zinc-900 text-center text-xs text-zinc-500">
                  No transactions recorded for this account yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedTxs.map((tx) => {
                    const isIncome = tx.type === 'income';
                    const isTransfer = tx.type === 'transfer';
                    const colorClass = isIncome
                      ? 'text-emerald-400'
                      : isTransfer
                      ? 'text-blue-400'
                      : 'text-red-400';
                    const sign = isIncome ? '+' : isTransfer ? '⇄ ' : '-';
                    const icon = tx.categoryIcon || (isIncome ? '💰' : '📦');
                    const title = tx.categoryName || tx.description || 'Transaction';

                    return (
                      <div
                        key={tx.id}
                        className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-850 flex items-center justify-between gap-3 shadow-sm hover:border-zinc-700 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-lg shrink-0">
                            {icon}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">{title}</div>
                            <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                              {tx.date}
                              {tx.time ? ` • ${tx.time}` : ''}
                              {tx.description && tx.description !== title ? ` • ${tx.description}` : ''}
                            </div>
                          </div>
                        </div>

                        <div className={`text-sm sm:text-base font-black font-mono shrink-0 ${colorClass}`}>
                          {sign}
                          {formatMoney(tx.amount)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bottom Callout Banner */}
            <div className="p-5 rounded-3xl bg-gradient-to-br from-zinc-900 to-zinc-950 border border-blue-500/30 text-center space-y-3 shadow-xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-[11px] font-bold">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>Track Your Own Money Free</span>
              </div>
              <h3 className="text-sm font-bold text-white">
                Personal Finance Tracker • Offline & Private
              </h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                Enjoy offline-first running balances, custom salary budget cycles, biometric PIN lock,
                multi-account sharing, and zero monthly fees.
              </p>
              <button
                type="button"
                onClick={onExit}
                className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-lg shadow-blue-900/40 active:scale-98 cursor-pointer flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Open Full App / Start Tracking</span>
              </button>
            </div>
          </>
        )}
      </main>

      {/* Footer Branding */}
      <footer className="py-4 border-t border-zinc-900 text-center text-[11px] text-zinc-500 font-mono">
        Personal Finance Tracker • Realtime Live Stream
      </footer>
    </div>
  );
};
