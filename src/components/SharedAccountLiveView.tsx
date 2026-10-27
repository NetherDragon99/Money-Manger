import { TransferBadge } from './TransferBadge';
import { formatNumberWithCommas } from '../utils/formatters';
import React, { useState, useEffect } from 'react';
import {
  Users,
  Copy,
  Check,
  ExternalLink,
  ArrowDown,
  ArrowUp,
  Download,
  Share2,
  X,
  ShieldCheck,
  Folder,
} from 'lucide-react';
import { listenToSharedAccount, SharedAccountData } from '../utils/firebase';
import { format16DigitId } from '../utils/userId';
import { fetchShareFolderFromCloud, ShareFolder } from '../utils/shareFolders';
import { useApp } from '../context/AppContext';
import { Account, Category, Transaction } from '../types';

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
  const { importSharedItems, showToast, settings } = useApp();
  const isArabic = settings.language === 'ar';

  const [folderData, setFolderData] = useState<ShareFolder | null>(() => {
    if (sharedDataSnapshot && sharedDataSnapshot.payload) {
      return sharedDataSnapshot as ShareFolder;
    }
    return null;
  });

  const [legacyAccountData, setLegacyAccountData] = useState<SharedAccountData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!sharedDataSnapshot && !!sharedAccountId);
  const [isCopied, setIsCopied] = useState(false);

  // Selective Import State
  const [isSelectiveMode, setIsSelectiveMode] = useState(false);
  const [selectedAccIds, setSelectedAccIds] = useState<string[]>([]);
  const [selectedCatIds, setSelectedCatIds] = useState<string[]>([]);
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);

  useEffect(() => {
    if (!sharedAccountId || sharedDataSnapshot) return;
    setIsLoading(true);

    // Try fetching as modern ShareFolder first
    fetchShareFolderFromCloud(sharedAccountId).then((folder) => {
      if (folder) {
        setFolderData(folder);
        setIsLoading(false);
      } else {
        // Fallback to legacy single shared account
        const unsub = listenToSharedAccount(sharedAccountId, (incoming) => {
          setLegacyAccountData(incoming);
          setIsLoading(false);
        });
        return () => unsub();
      }
    });
  }, [sharedAccountId, sharedDataSnapshot]);

  // Consolidate data payload
  const accounts: Account[] = folderData?.payload.accounts || (legacyAccountData?.account ? [legacyAccountData.account] : []);
  const categories: Category[] = folderData?.payload.categories || [];
  const transactions: Transaction[] = folderData?.payload.transactions || legacyAccountData?.transactions || [];

  const title = folderData?.name || legacyAccountData?.accountName || 'Shared View';
  const icon = folderData?.icon || legacyAccountData?.account.icon || '📁';
  const ownerName = folderData?.ownerName || legacyAccountData?.ownerEmail || 'User';
  const ownerNumericId = folderData?.ownerNumericId;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setIsCopied(true);
    showToast(isArabic ? 'تم نسخ رابط المشاهدة!' : 'Share link copied!', 'success');
    setTimeout(() => setIsCopied(false), 2000);
  };

  // 1. Add All to My Account
  const handleImportAll = () => {
    if (accounts.length === 0 && categories.length === 0 && transactions.length === 0) {
      showToast(isArabic ? 'لا توجد بيانات للاستيراد' : 'No data to import', 'info');
      return;
    }

    const res = importSharedItems({
      accounts,
      categories,
      transactions,
    });

    showToast(
      isArabic
        ? `تم استيراد وحفظ كافة العناصر بنجاح! (${res.accountsCount} حسابات، ${res.categoriesCount} تصنيفات، ${res.txsCount} معاملات)`
        : `Successfully imported! (${res.accountsCount} accounts, ${res.categoriesCount} categories, ${res.txsCount} transactions)`,
      'success'
    );
  };

  // 2. Select Specific Items to Add
  const handleImportSelected = () => {
    const chosenAccs = accounts.filter((a) => selectedAccIds.includes(a.id));
    const chosenCats = categories.filter((c) => selectedCatIds.includes(c.id));
    const chosenTxs = transactions.filter((t) => selectedTxIds.includes(t.id));

    if (chosenAccs.length === 0 && chosenCats.length === 0 && chosenTxs.length === 0) {
      showToast(isArabic ? 'يرجى اختيار عنصر واحد على الأقل' : 'Please select at least one item', 'info');
      return;
    }

    const res = importSharedItems({
      accounts: chosenAccs,
      categories: chosenCats,
      transactions: chosenTxs,
    });

    showToast(
      isArabic
        ? `تم استيراد العناصر المختارة بنجاح! (${res.accountsCount} حسابات، ${res.categoriesCount} تصنيفات، ${res.txsCount} معاملات)`
        : `Imported selected items! (${res.accountsCount} accounts, ${res.categoriesCount} categories, ${res.txsCount} transactions)`,
      'success'
    );
    setIsSelectiveMode(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black text-white flex flex-col overflow-y-auto"
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      {/* Top Banner / Navbar */}
      <header className="sticky top-0 z-40 h-16 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800/80 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white truncate max-w-[200px] sm:max-w-md">
              {title}
            </h2>
            <div className="text-[11px] text-zinc-400">
              {isArabic ? 'مشاركة بواسطة:' : 'Shared by:'} {ownerName}{' '}
              {ownerNumericId ? `(${format16DigitId(ownerNumericId)})` : ''}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 hover:text-white transition cursor-pointer"
            title="Copy Public Link"
          >
            {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onExit}
            className="px-3.5 py-1.5 rounded-xl bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold transition cursor-pointer"
          >
            {isArabic ? 'خروج / إغلاق' : 'Exit View'}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="w-full max-w-none md:max-w-7xl landscape:max-w-none mx-auto p-4 sm:p-6 space-y-5 pb-24">
        {/* Info Banner & Primary Action Card */}
        <div className="p-5 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{isArabic ? 'صفحة مشاركة عامة (External Share)' : 'Public Shared Dashboard'}</span>
            </span>
            <span className="text-xs font-mono text-zinc-400">
              {accounts.length + categories.length + transactions.length} {isArabic ? 'عناصر' : 'items'}
            </span>
          </div>

          <p className="text-xs sm:text-sm text-zinc-300">
            {isArabic
              ? 'يمكنك معاينة الحسابات والتصنيفات والمعاملات ومزامنتها لحسابك الشخصي عبر الخيارات أدناه.'
              : 'Browse shared accounts, categories, and transactions, and import them into your personal account.'}
          </p>

          {/* Dual Import Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={handleImportAll}
              className="py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg shadow-blue-900/40 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <Download className="w-4 h-4" />
              <span>{isArabic ? 'إضافة كل المعاملات والعناصر لحسابي' : 'Add All to My Account'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsSelectiveMode(!isSelectiveMode);
                if (!isSelectiveMode) {
                  setSelectedAccIds(accounts.map((a) => a.id));
                  setSelectedCatIds(categories.map((c) => c.id));
                  setSelectedTxIds(transactions.map((t) => t.id));
                }
              }}
              className={`py-3 px-4 rounded-2xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer active:scale-98 ${
                isSelectiveMode
                  ? 'bg-purple-600 border-purple-500 text-white'
                  : 'bg-zinc-850 hover:bg-zinc-800 border-zinc-750 text-zinc-200'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{isArabic ? 'اختيار عناصر معينة فقط لإضافتها' : 'Select Specific Items to Add'}</span>
            </button>
          </div>

          {/* Floating Confirm for Selective Mode */}
          {isSelectiveMode && (
            <div className="p-3 rounded-2xl bg-purple-950/40 border border-purple-500/50 flex items-center justify-between animate-in fade-in">
              <span className="text-xs text-purple-200">
                {isArabic
                  ? `محدد (${selectedAccIds.length + selectedCatIds.length + selectedTxIds.length}) عناصر للإضافة`
                  : `Selected (${selectedAccIds.length + selectedCatIds.length + selectedTxIds.length}) items`}
              </span>
              <button
                type="button"
                onClick={handleImportSelected}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow cursor-pointer active:scale-95"
              >
                {isArabic ? 'استيراد العناصر المختارة' : 'Import Selected'}
              </button>
            </div>
          )}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="p-12 text-center text-xs text-zinc-400">
            {isArabic ? 'جارٍ تحميل بيانات الشير من السحابة...' : 'Loading share data...'}
          </div>
        )}

        {/* Section 1: Accounts */}
        {accounts.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 px-1">
              🏦 {isArabic ? 'الحسابات' : 'Accounts'} ({accounts.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {accounts.map((acc) => {
                const isChecked = selectedAccIds.includes(acc.id);
                return (
                  <div
                    key={acc.id}
                    onClick={() => {
                      if (isSelectiveMode) {
                        setSelectedAccIds((prev) =>
                          prev.includes(acc.id) ? prev.filter((id) => id !== acc.id) : [...prev, acc.id]
                        );
                      }
                    }}
                    className={`p-4 rounded-3xl border transition flex items-center justify-between ${
                      isSelectiveMode ? 'cursor-pointer' : ''
                    } ${
                      isChecked && isSelectiveMode
                        ? 'bg-blue-950/40 border-blue-500'
                        : 'bg-zinc-900 border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isSelectiveMode && (
                        <div
                          className={`w-5 h-5 rounded-lg flex items-center justify-center border ${
                            isChecked ? 'bg-blue-600 border-blue-500 text-white' : 'border-zinc-700 bg-zinc-950'
                          }`}
                        >
                          {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      )}
                      <div className="w-11 h-11 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-2xl">
                        {acc.icon}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">{acc.name}</div>
                        <div className="text-xs text-zinc-400">
                          {acc.isPrivate ? (isArabic ? 'حساب خاص' : 'Private Account') : (isArabic ? 'حساب عام' : 'Public Account')}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-black font-mono text-white">{acc.balance}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section 2: Categories */}
        {categories.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 px-1">
              🏷️ {isArabic ? 'التصنيفات' : 'Categories'} ({categories.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {categories.map((cat) => {
                const isChecked = selectedCatIds.includes(cat.id);
                return (
                  <div
                    key={cat.id}
                    onClick={() => {
                      if (isSelectiveMode) {
                        setSelectedCatIds((prev) =>
                          prev.includes(cat.id) ? prev.filter((id) => id !== cat.id) : [...prev, cat.id]
                        );
                      }
                    }}
                    className={`p-3 rounded-2xl border transition flex items-center gap-3 ${
                      isSelectiveMode ? 'cursor-pointer' : ''
                    } ${
                      isChecked && isSelectiveMode
                        ? 'bg-blue-950/40 border-blue-500'
                        : 'bg-zinc-900 border-zinc-800'
                    }`}
                  >
                    {isSelectiveMode && (
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border ${
                          isChecked ? 'bg-blue-600 border-blue-500 text-white' : 'border-zinc-700 bg-zinc-950'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    )}
                    <span className="text-xl">{cat.icon}</span>
                    <span className="text-xs font-bold text-white truncate">{cat.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section 3: Transactions */}
        {transactions.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 px-1">
              💳 {isArabic ? 'المعاملات' : 'Transactions'} ({transactions.length})
            </h3>
            <div className="space-y-2">
              {transactions.map((tx) => {
                const isChecked = selectedTxIds.includes(tx.id);
                return (
                  <div
                    key={tx.id}
                    onClick={() => {
                      if (isSelectiveMode) {
                        setSelectedTxIds((prev) =>
                          prev.includes(tx.id) ? prev.filter((id) => id !== tx.id) : [...prev, tx.id]
                        );
                      }
                    }}
                    className={`p-3.5 rounded-2xl border transition flex items-center justify-between ${
                      isSelectiveMode ? 'cursor-pointer' : ''
                    } ${
                      isChecked && isSelectiveMode
                        ? 'bg-blue-950/40 border-blue-500'
                        : 'bg-zinc-900 border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isSelectiveMode && (
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border ${
                            isChecked ? 'bg-blue-600 border-blue-500 text-white' : 'border-zinc-700 bg-zinc-950'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      )}
                      {tx.type === 'transfer' ? (
                        <TransferBadge
                          fromIcon={tx.fromAccountIcon}
                          fromName={tx.fromAccountName}
                          toIcon={tx.toAccountIcon}
                          toName={tx.toAccountName}
                          size="sm"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-lg">
                          {tx.type === 'income' ? '💵' : '💳'}
                        </div>
                      )}
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-white truncate max-w-[180px] sm:max-w-xs">
                          {tx.type === 'transfer'
                            ? (isArabic
                                ? `من ${tx.fromAccountName || 'حساب'} إلى ${tx.toAccountName || 'حساب'}`
                                : `From ${tx.fromAccountName || 'Account'} → To ${tx.toAccountName || 'Account'}`)
                            : tx.description || tx.categoryName || 'Transaction'}
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          {tx.type === 'transfer' && tx.description ? `${tx.description} • ${tx.date}` : tx.date}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-sm font-mono font-bold ${
                          tx.type === 'income' ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : '-'}{formatNumberWithCommas(tx.amount, 2)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
