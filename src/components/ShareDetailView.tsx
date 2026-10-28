import { TransferBadge, TransferCard } from './TransferBadge';
import { formatDisplayNumber, parseFormattedNumber, handleNumericInputChange } from '../utils/formatters';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Share2,
  Copy,
  Users,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Landmark,
  Tags,
  Receipt,
  Download,
  ExternalLink,
  ShieldCheck,
  Check,
  Minus,
  Clock,
  History,
  Sparkles,
  X,
  Shield,
  LogOut,
  Loader2,
  Settings,
  AlertTriangle,
  Calendar,
  Filter,
  Folder,
  Wallet,
  FolderDown,
  Search,
  RefreshCw,
  Edit3,
} from 'lucide-react';
import { matchesTransactionSearch } from '../utils/searchUtils';
import { useApp } from '../context/AppContext';
import { navigateBack } from '../context/NavigationContext';
import { Account, Category, Transaction } from '../types';
import { auth, rtdb } from '../utils/firebase';
import { ref, onValue, off, update } from 'firebase/database';
import { format16DigitId, cleanNumericId, format16DigitInput, getOrCreateNumericId } from '../utils/userId';
import { UserSearchPicker } from './UserSearchPicker';
import { ShareSpaceSettingsModal } from './ShareSpaceSettingsModal';
import { TransactionModal } from './TransactionModal';
import { removeLocalTombstone } from '../utils/autoBackup';
import { syncAllAccountBalances } from '../utils/balanceEngine';
import {
  ShareFolder,
  ShareMember,
  subscribeToShareFolder,
  loadAllSpacesV3,
  fetchShareFolderFromCloud,
  subscribeToMyInbox,
  fetchMyInboxOnce,
  saveReceivedShareFolders,
  addTransactionToShareFolder,
  removeItemFromShareFolder,
  removeItemsFromShareFolderSmart,
  addMemberToShareFolder,
  removeMemberFromShareFolder,
  removeAllMembersFromShareFolder,
  leaveShareFolder,
  updateMemberRoleInShareFolder,
  syncFolderToCloud,
  syncShareFolderToCloud,
  generateShareUrl,
  fetchUserProfileCard,
  getAvatarColorGradient,
  getMemberInitials,
  resolveOwnerPhoto,
  ensureOwnerPhotoLoaded,
  normalizeShareId,
  useLiveMemberProfiles,
  isRealPhotoUrl,
  upsertSpaceInV3Cache,
  getCanonicalSharePath,
  deepSanitizeForFirebase,
  pushTransactionDeltaToCloud,
  ensureShareLinkToken,
  regenerateSecureShareLink,
  ShareActivityEntry,
  logSharedSpaceActivity,
  formatActivityAction,
  formatRelativeActivityTime,
} from '../utils/shareFolders';
import {
  formatCurrency,
  formatDateToYYYYMMDD,
  formatTimeToHHMM,
  getDayHeaderTitle,
  getMonthHeaderTitle,
  formatTime12h,
} from '../utils/dateCycle';
import { useLongPress } from '../hooks/useLongPress';

interface ShareMonthHeaderRowProps {
  monthKey: string;
  monthTitle: string;
  monthNet: number;
  monthTxIds: string[];
  isMonthCollapsed: boolean;
  toggleMonth: (key: string) => void;
  isTxMultiSelect: boolean;
  selectedTxIds: string[];
  toggleBatchTxs: (ids: string[]) => void;
  currencySymbol: string;
  isArabic: boolean;
}

const ShareMonthHeaderRow: React.FC<ShareMonthHeaderRowProps> = ({
  monthKey,
  monthTitle,
  monthNet,
  monthTxIds,
  isMonthCollapsed,
  toggleMonth,
  isTxMultiSelect,
  selectedTxIds,
  toggleBatchTxs,
  currencySymbol,
  isArabic,
}) => {
  const isAllMonthSelected = monthTxIds.length > 0 && monthTxIds.every((id) => selectedTxIds.includes(id));
  const isPartialMonthSelected = !isAllMonthSelected && monthTxIds.some((id) => selectedTxIds.includes(id));
  const isMonthPositive = monthNet >= 0;

  const { handlers } = useLongPress({
    onLongPress: () => {
      if (monthTxIds.length === 0) return;
      toggleBatchTxs(monthTxIds);
    },
    onClick: () => {
      if (isTxMultiSelect) {
        toggleBatchTxs(monthTxIds);
      } else {
        toggleMonth(monthKey);
      }
    },
  });

  return (
    <div
      {...handlers}
      className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900/90 hover:bg-zinc-850 text-start transition border-b border-zinc-800/60 cursor-pointer select-none group"
    >
      <div className="flex items-center gap-2.5 font-bold text-white text-sm min-w-0">
        {/* Select All Checkbox for Month - ONLY rendered when isTxMultiSelect is true */}
        {isTxMultiSelect && (
          <button
            type="button"
            onTouchStart={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              toggleBatchTxs(monthTxIds);
            }}
            className={`w-5 h-5 rounded-lg flex items-center justify-center transition border cursor-pointer shrink-0 ${
              isAllMonthSelected
                ? 'bg-blue-600 border-blue-500 text-white shadow-sm shadow-blue-600/50'
                : isPartialMonthSelected
                ? 'bg-blue-600/40 border-blue-500 text-white'
                : 'bg-zinc-950 border-zinc-700 text-transparent hover:border-blue-400'
            }`}
            title={
              isAllMonthSelected
                ? (isArabic ? 'إلغاء تحديد الشهر بالكامل' : 'Deselect Entire Month')
                : (isArabic ? 'تحديد الشهر بالكامل' : 'Select Entire Month')
            }
          >
            {isPartialMonthSelected ? (
              <Minus className="w-3.5 h-3.5 text-white" />
            ) : (
              <Check className={`w-3.5 h-3.5 ${isAllMonthSelected ? 'text-white' : 'opacity-0'}`} />
            )}
          </button>
        )}

        <button
          type="button"
          onTouchStart={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            toggleMonth(monthKey);
          }}
          className="p-1 -m-1 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
        >
          {isMonthCollapsed ? (
            <ChevronDown className="w-4 h-4 text-zinc-400 rtl:rotate-90 ltr:-rotate-90" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          )}
        </button>

        <span className="truncate">{monthTitle}</span>
        <span className="text-[10px] text-zinc-500 font-mono font-normal">
          ({monthTxIds.length})
        </span>
      </div>
      <div
        className={`text-xs font-mono font-bold shrink-0 ${
          isMonthPositive ? 'text-emerald-400' : 'text-red-400'
        }`}
      >
        {isMonthPositive ? '+' : ''}
        {formatCurrency(monthNet, currencySymbol, isArabic ? 'ar' : 'en')}
      </div>
    </div>
  );
};

interface ShareDayHeaderRowProps {
  dayKey: string;
  dayTitle: string;
  dayNet: number;
  dayTxIds: string[];
  isDayCollapsed: boolean;
  toggleDay: (key: string) => void;
  isTxMultiSelect: boolean;
  selectedTxIds: string[];
  toggleBatchTxs: (ids: string[]) => void;
  currencySymbol: string;
  isArabic: boolean;
}

const ShareDayHeaderRow: React.FC<ShareDayHeaderRowProps> = ({
  dayKey,
  dayTitle,
  dayNet,
  dayTxIds,
  isDayCollapsed,
  toggleDay,
  isTxMultiSelect,
  selectedTxIds,
  toggleBatchTxs,
  currencySymbol,
  isArabic,
}) => {
  const isAllDaySelected = dayTxIds.length > 0 && dayTxIds.every((id) => selectedTxIds.includes(id));
  const isPartialDaySelected = !isAllDaySelected && dayTxIds.some((id) => selectedTxIds.includes(id));
  const isDayPositive = dayNet >= 0;

  const { handlers } = useLongPress({
    onLongPress: () => {
      if (dayTxIds.length === 0) return;
      toggleBatchTxs(dayTxIds);
    },
    onClick: () => {
      if (isTxMultiSelect) {
        toggleBatchTxs(dayTxIds);
      } else {
        toggleDay(dayKey);
      }
    },
  });

  return (
    <div
      {...handlers}
      className="w-full flex items-center justify-between px-3.5 py-2 bg-zinc-900/90 hover:bg-zinc-850 text-start transition border-b border-zinc-800/40 cursor-pointer select-none group"
    >
      <div className="flex items-center gap-2 font-semibold text-xs text-zinc-300 min-w-0">
        {/* Select All Checkbox for Day - ONLY rendered when isTxMultiSelect is true */}
        {isTxMultiSelect && (
          <button
            type="button"
            onTouchStart={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              toggleBatchTxs(dayTxIds);
            }}
            className={`w-4.5 h-4.5 rounded-md flex items-center justify-center transition border cursor-pointer shrink-0 ${
              isAllDaySelected
                ? 'bg-blue-600 border-blue-500 text-white shadow-sm shadow-blue-600/50'
                : isPartialDaySelected
                ? 'bg-blue-600/40 border-blue-500 text-white'
                : 'bg-zinc-950 border-zinc-700 text-transparent hover:border-blue-400'
            }`}
            title={
              isAllDaySelected
                ? (isArabic ? 'إلغاء تحديد اليوم بالكامل' : 'Deselect Entire Day')
                : (isArabic ? 'تحديد اليوم بالكامل' : 'Select Entire Day')
            }
          >
            {isPartialDaySelected ? (
              <Minus className="w-3.5 h-3.5 text-white" />
            ) : (
              <Check className={`w-3.5 h-3.5 ${isAllDaySelected ? 'text-white' : 'opacity-0'}`} />
            )}
          </button>
        )}

        <button
          type="button"
          onTouchStart={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            toggleDay(dayKey);
          }}
          className="p-1 -m-1 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
        >
          {isDayCollapsed ? (
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500 rtl:rotate-90 ltr:-rotate-90" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
          )}
        </button>

        <span className="truncate">{dayTitle}</span>
        <span className="text-[10px] text-zinc-500 font-mono">
          ({dayTxIds.length})
        </span>
      </div>

      <div
        className={`text-[11px] font-mono font-semibold shrink-0 ${
          isDayPositive ? 'text-emerald-400' : 'text-red-400'
        }`}
      >
        {isDayPositive ? '+' : ''}
        {formatCurrency(dayNet, currencySymbol, isArabic ? 'ar' : 'en')}
      </div>
    </div>
  );
};

interface ShareTxRowProps {
  tx: Transaction & { sender16Id?: string };
  folderAccounts: Account[];
  isTxMultiSelect: boolean;
  isSelected: boolean;
  canEdit: boolean;
  currencySymbol: string;
  isArabic: boolean;
  liveProfiles?: Record<string, any>;
  onToggleSelect: (id: string) => void;
  onStartMultiSelect: (id: string) => void;
  onDeleteClick: (tx: Transaction, title: string, icon?: string) => void;
  onEditClick?: (tx: Transaction) => void;
}

const ShareTxRow: React.FC<ShareTxRowProps> = ({
  tx,
  folderAccounts,
  isTxMultiSelect,
  isSelected,
  canEdit,
  currencySymbol,
  isArabic,
  liveProfiles,
  onToggleSelect,
  onStartMultiSelect,
  onDeleteClick,
  onEditClick,
}) => {
  const isTransfer = tx.type === 'transfer';

  const fromAcc = folderAccounts.find((a) => a.id === tx.accountId);
  const toAcc = tx.toAccountId ? folderAccounts.find((a) => a.id === tx.toAccountId) : undefined;

  const fromName = tx.fromAccountName || fromAcc?.name || (isArabic ? 'حساب' : 'Account');
  const toName = tx.toAccountName || toAcc?.name || (isArabic ? 'حساب' : 'Account');
  const fromIcon = tx.fromAccountIcon || fromAcc?.icon || '🏦';
  const toIcon = tx.toAccountIcon || toAcc?.icon || '🏦';

  let title = '';
  if (tx.description && tx.description.trim() !== '') {
    title = tx.description;
  } else {
    title = tx.categoryName || (isArabic ? 'معاملة مالية' : 'Transaction');
  }

  let authorBadge: React.ReactNode = null;
  if (tx.sender16Id && liveProfiles?.[tx.sender16Id]) {
    const profile = liveProfiles[tx.sender16Id];
    authorBadge = (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-zinc-800 border border-zinc-700/80 text-[10px] text-zinc-300">
        {isRealPhotoUrl(profile.photoURL) ? (
          <img src={profile.photoURL} alt="" className="w-3 h-3 rounded-full object-cover" />
        ) : (
          <span>{profile.avatar || '👤'}</span>
        )}
        <span className="truncate max-w-[65px] font-medium">{profile.name}</span>
      </span>
    );
  }

  const { handlers } = useLongPress({
    onLongPress: () => {
      if (isTxMultiSelect) {
        onToggleSelect(tx.id);
      } else {
        onStartMultiSelect(tx.id);
      }
    },
    onClick: () => {
      if (isTxMultiSelect) {
        onToggleSelect(tx.id);
      } else if (canEdit && onEditClick) {
        onEditClick(tx);
      }
    },
  });

  if (isTransfer) {
    return (
      <TransferCard
        transaction={tx}
        fromAccount={fromAcc}
        toAccount={toAcc}
        fromName={fromName}
        toName={toName}
        fromIcon={fromIcon}
        toIcon={toIcon}
        fromColor={fromAcc?.color}
        toColor={toAcc?.color}
        currencySymbol={currencySymbol}
        language={isArabic ? 'ar' : 'en'}
        isSelected={isSelected}
        isMultiSelect={isTxMultiSelect}
        timeFormatted={tx.time ? formatTime12h(tx.time, isArabic ? 'ar' : 'en') : ''}
        authorBadge={authorBadge}
        canEdit={canEdit}
        onDeleteClick={onDeleteClick}
        handlers={handlers}
        onContextMenu={(e) => {
          e.preventDefault();
          if (isTxMultiSelect) {
            onToggleSelect(tx.id);
          } else {
            onStartMultiSelect(tx.id);
          }
        }}
      />
    );
  }

  return (
    <div
      {...handlers}
      onContextMenu={(e) => {
        e.preventDefault();
        if (isTxMultiSelect) {
          onToggleSelect(tx.id);
        } else {
          onStartMultiSelect(tx.id);
        }
      }}
      className={`p-2.5 rounded-xl border flex flex-col transition group select-none ${
        isSelected
          ? 'bg-blue-950/40 border-blue-500/80 shadow-md shadow-blue-950/50 cursor-pointer'
          : isTxMultiSelect
          ? 'bg-zinc-900/80 hover:bg-zinc-850 border-zinc-800/60 cursor-pointer'
          : canEdit
          ? 'bg-zinc-900/80 hover:bg-zinc-850 border-zinc-800/60 cursor-pointer'
          : 'bg-zinc-900/80 hover:bg-zinc-850 border-zinc-800/60'
      }`}
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2.5 min-w-0">
          {isTxMultiSelect && (
            <div
              className={`w-5 h-5 rounded-lg flex items-center justify-center transition border shrink-0 ${
                isSelected
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-zinc-950 border-zinc-700 text-transparent'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
            </div>
          )}

          <div
            className={`w-8 h-8 rounded-xl border flex items-center justify-center text-sm shrink-0 ${
              tx.type === 'income'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}
          >
            {tx.categoryIcon || '💸'}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-semibold text-white truncate max-w-[140px] sm:max-w-xs block">
                {title}
              </span>
              {Boolean(tx.isFromRecurring || tx.recurringRuleId) && (
                <span
                  className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded-full text-[9px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0"
                  title={isArabic ? 'معاملة متكررة تلقائية' : 'Automated Recurring'}
                >
                  <RefreshCw className="w-2 h-2 shrink-0" />
                  <span className="hidden xs:inline text-[8px]">{isArabic ? 'دورية' : 'Recurring'}</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
              <span className="truncate">{tx.categoryName}</span>
              {authorBadge && (
                <>
                  <span>·</span>
                  {authorBadge}
                </>
              )}
              {tx.time && (
                <>
                  <span>·</span>
                  <span className="font-mono text-zinc-500">
                    {formatTime12h(tx.time, isArabic ? 'ar' : 'en')}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`font-mono text-xs font-bold ${
              tx.type === 'income'
                ? 'text-emerald-400'
                : 'text-red-400'
            }`}
          >
            {tx.type === 'income' ? '+' : '-'}
            {formatCurrency(tx.amount, currencySymbol, isArabic ? 'ar' : 'en')}
          </span>

          {canEdit && (
            <button
              type="button"
              onTouchStart={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteClick(tx, title, tx.categoryIcon);
              }}
              className="p-1 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition cursor-pointer"
              title={isArabic ? 'حذف المعاملة' : 'Delete Transaction'}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface ShareDetailViewProps {
  folder: ShareFolder;
  onExit: () => void;
}

export const ShareDetailView: React.FC<ShareDetailViewProps> = ({ folder: initialFolder, onExit }) => {
  const {
    settings,
    transactions: personalTransactions,
    accounts: myPersonalAccounts,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    importSharedItems,
    showToast,
    showConfirm,
    t,
    setIsEditingSpace: setGlobalIsEditingSpace,
    setEditingShareId: setGlobalEditingShareId,
    selectedTxIds,
    isTxMultiSelect,
    toggleTxSelection,
    toggleBatchTxs,
    startTxMultiSelect,
    clearGlobalSelection,
  } = useApp();

  const isArabic = settings.language === 'ar';
  const currencySymbol = settings.currencySymbol || '£';
  const myCleanNumericId = cleanNumericId(settings.userProfile?.numericId || '') || getOrCreateNumericId();

  const [folder, setFolder] = useState<ShareFolder>(initialFolder);
  const [isCopied, setIsCopied] = useState(false);

  // Multi-Select Import Confirmation Sheet State
  const [isImportSheetOpen, setIsImportSheetOpen] = useState(false);
  const [importScope, setImportScope] = useState<'selected' | 'all'>('selected');
  const [selectedTargetAccountId, setSelectedTargetAccountId] = useState<string>('');

  // Collapsed state sets for grouped timeline (months and days)
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});
  const [collapsedDays, setCollapsedDays] = useState<Record<string, boolean>>({});

  const [searchQuery, setSearchQuery] = useState('');
  // Active filter by included account or category
  const [activeEntityFilter, setActiveEntityFilter] = useState<{
    type: 'account' | 'category';
    id: string;
    name: string;
    icon: string;
  } | null>(null);

  // Full TransactionModal integration state for Share Space
  const [isShareTxModalOpen, setIsShareTxModalOpen] = useState(false);
  const [editingShareTx, setEditingShareTx] = useState<Transaction | null>(null);

  // Delete Confirmation State with Owner Scope / Editor Confirmation Dialog
  const [deleteDialog, setDeleteDialog] = useState<{
    txIds: string[];
    scope: 'share_only' | 'both';
  } | null>(null);

  // Add Member State
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isManageMembersOpen, setIsManageMembersOpen] = useState(false);
  // Dedicated Share Space Settings / Edit Space Modal state without premature render resets
  const [activeSettingsSpace, setActiveSettingsSpace] = useState<ShareFolder | null>(null);
  const activeSettingsSpaceRef = useRef<ShareFolder | null>(null);
  activeSettingsSpaceRef.current = activeSettingsSpace;

  const handleOpenEditSpace = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActiveSettingsSpace(folder);
    setGlobalIsEditingSpace?.(true);
    setGlobalEditingShareId?.(folder.id);
  };

  const handleCloseEditSpace = () => {
    setActiveSettingsSpace(null);
    setGlobalIsEditingSpace?.(false);
    setGlobalEditingShareId?.(null);
  };

  // Hardware Back button / Popstate handling: closes edit space when active without wiping on render
  useEffect(() => {
    const handlePop = () => {
      if (activeSettingsSpaceRef.current) {
        handleCloseEditSpace();
      }
    };

    window.addEventListener('popstate', handlePop);
    return () => {
      window.removeEventListener('popstate', handlePop);
    };
  }, []);

  // When unmounting ShareDetailView, safely clean up
  useEffect(() => {
    return () => {
      handleCloseEditSpace();
      clearGlobalSelection();
    };
  }, []);
  const [newMemberId, setNewMemberId] = useState('');
  const [selectedMemberUser, setSelectedMemberUser] = useState<any>(null);
  const [isVerifyingMember, setIsVerifyingMember] = useState(false);
  const [isSubmittingMember, setIsSubmittingMember] = useState(false);

  // Recent Changes (أحدث التغييرات) Collapsible Activity Strip State
  const [isRecentActivityOpen, setIsRecentActivityOpen] = useState(false);

  const recentActivities: ShareActivityEntry[] = useMemo(() => {
    if (!folder.recent_activity || typeof folder.recent_activity !== 'object') return [];
    const list = Object.values(folder.recent_activity).filter(
      (entry): entry is ShareActivityEntry => Boolean(entry && entry.actor16Id && entry.action && entry.ts)
    );
    return list.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  }, [folder.recent_activity]);

  // Pre-Delete Review Modal State (with overlap warning & smart cleanup)
  const [preDeleteState, setPreDeleteState] = useState<{
    targetType: 'account' | 'category' | 'transaction';
    targetId: string;
    targetName: string;
    targetIcon?: string;
    candidates: Array<{
      tx: Transaction;
      overlappingWith: Array<{
        type: 'account' | 'category';
        name: string;
        icon: string;
      }>;
    }>;
    selectedTxIds: Set<string>;
    deleteFromPersonal: boolean;
  } | null>(null);

  // Subscribe to real-time updates for this space at canonical shared_accounts/share_${space.id}
  useEffect(() => {
    if (!initialFolder.id) return;
    const unsub = subscribeToShareFolder(initialFolder.id, (liveFolder) => {
      if (liveFolder) {
        setFolder((prev) => {
          const prevTxs = prev.payload?.transactions || prev.transactions || [];
          const liveTxs = liveFolder.payload?.transactions || liveFolder.transactions || [];

          // If local metadata is newer, preserve local metadata but merge transactions by ID
          if ((prev.updatedAt || 0) > (liveFolder.updatedAt || 0)) {
            const txMap = new Map<string, Transaction>();
            for (const t of prevTxs) txMap.set(t.id, t);
            for (const t of liveTxs) txMap.set(t.id, t);
            const mergedTxs = Array.from(txMap.values());
            return {
              ...prev,
              transactions: mergedTxs,
              recent_activity: liveFolder.recent_activity || prev.recent_activity,
              payload: {
                ...prev.payload,
                transactions: mergedTxs,
              },
              itemCount: (prev.payload?.accounts?.length || 0) + (prev.payload?.categories?.length || 0) + mergedTxs.length,
            };
          }

          return {
            ...liveFolder,
            ownerNumericId: liveFolder.ownerNumericId || prev.ownerNumericId,
            owner16DigitId: liveFolder.owner16DigitId || prev.owner16DigitId || liveFolder.ownerNumericId || prev.ownerNumericId,
            ownerUid: liveFolder.ownerUid || prev.ownerUid,
            ownerName: liveFolder.ownerName || prev.ownerName,
            ownerAvatar: liveFolder.ownerAvatar || prev.ownerAvatar,
            ownerPhotoURL: liveFolder.ownerPhotoURL || prev.ownerPhotoURL,
          };
        });
      } else {
        showToast(
          isArabic ? 'تم حذف مساحة المشاركة من قِبل المالك' : 'This shared space was deleted by the owner',
          'info'
        );
        onExit();
      }
    });
    return () => unsub();
  }, [initialFolder.id, isArabic, onExit, showToast]);

  // Real-time listener for space cache updates & deletion events
  useEffect(() => {
    const handleSpacesUpdated = (e: any) => {
      const all: ShareFolder[] = e?.detail || loadAllSpacesV3();
      const match = all.find((s) => normalizeShareId(s.id) === normalizeShareId(initialFolder.id));
      if (match) {
        setFolder((prev) => {
          if (!prev) return match;
          const txMap = new Map<string, Transaction>();
          for (const t of prev.payload?.transactions || prev.transactions || []) txMap.set(t.id, t);
          for (const t of match.payload?.transactions || match.transactions || []) txMap.set(t.id, t);
          const mergedTxs = Array.from(txMap.values());
          return {
            ...match,
            transactions: mergedTxs,
            payload: {
              ...match.payload,
              transactions: mergedTxs,
            },
            itemCount: (match.payload?.accounts?.length || 0) + (match.payload?.categories?.length || 0) + mergedTxs.length,
          };
        });
      }
    };
    window.addEventListener('spaces_v3_updated', handleSpacesUpdated);

    const handlePurged = (e: any) => {
      if (e?.detail?.shareId && normalizeShareId(e.detail.shareId) === normalizeShareId(initialFolder.id)) {
        showToast(
          isArabic ? 'تم حذف مساحة المشاركة من قِبل المالك' : 'This shared space was deleted by the owner',
          'info'
        );
        onExit();
      }
    };
    window.addEventListener('share_space_purged', handlePurged);
    return () => {
      window.removeEventListener('spaces_v3_updated', handleSpacesUpdated);
      window.removeEventListener('share_space_purged', handlePurged);
    };
  }, [initialFolder.id, onExit, isArabic, showToast]);

  // Ensure owner photo is loaded if missing
  useEffect(() => {
    if (!folder.ownerPhotoURL && (folder.owner16DigitId || folder.ownerNumericId)) {
      ensureOwnerPhotoLoaded(folder).then((loadedPhoto) => {
        if (loadedPhoto) {
          setFolder((prev) => ({
            ...prev,
            ownerPhotoURL: loadedPhoto,
          }));
        }
      });
    }
  }, [folder.id, folder.owner16DigitId, folder.ownerNumericId, folder.ownerPhotoURL]);

  const allMember16Ids = useMemo(() => {
    const set = new Set<string>();
    const o16 = cleanNumericId(folder.owner16DigitId || folder.ownerNumericId);
    if (o16) set.add(o16);
    (folder.members || []).forEach((m) => {
      const mid = cleanNumericId(m.numericId);
      if (mid) set.add(mid);
    });
    (folder.member16Ids || []).forEach((id) => {
      const mid = cleanNumericId(id);
      if (mid) set.add(mid);
    });
    const txList = folder.payload?.transactions || folder.transactions || [];
    txList.forEach((tx: any) => {
      const sid = cleanNumericId(tx.sender16Id);
      if (sid) set.add(sid);
    });
    if (folder.recent_activity && typeof folder.recent_activity === 'object') {
      Object.values(folder.recent_activity).forEach((act) => {
        const aid = cleanNumericId(act?.actor16Id);
        if (aid) set.add(aid);
      });
    }
    return Array.from(set);
  }, [
    folder.owner16DigitId,
    folder.ownerNumericId,
    folder.members,
    folder.member16Ids,
    folder.payload?.transactions,
    folder.transactions,
    folder.recent_activity,
  ]);

  const liveProfiles = useLiveMemberProfiles(allMember16Ids);

  const cleanFolderId = normalizeShareId(folder.id);
  const folderOwner16 = cleanNumericId(folder.owner16DigitId || folder.ownerNumericId);
  const ownerLiveProf = folderOwner16 ? liveProfiles[folderOwner16] : undefined;
  const effectiveOwnerName = ownerLiveProf?.name || folder.ownerName || 'User';
  const rawOwnerPhoto = (ownerLiveProf?.photoURL && ownerLiveProf.photoURL.trim()) || resolveOwnerPhoto(folder, settings.userProfile);
  const effectiveOwnerPhoto = isRealPhotoUrl(rawOwnerPhoto) ? rawOwnerPhoto.trim() : '';
  const effectiveOwnerAvatar = ownerLiveProf?.avatar || (!isRealPhotoUrl(rawOwnerPhoto) && rawOwnerPhoto ? rawOwnerPhoto : (folder.ownerAvatar || '👤'));

  const isOwner = Boolean(
    (myCleanNumericId && folderOwner16 && folderOwner16 === myCleanNumericId) ||
    (auth.currentUser?.uid && folder.ownerUid && folder.ownerUid === auth.currentUser.uid)
  );

  // Dynamically overlay member names, avatars, and photos, and filter out left members
  const activeOverlaidMembers = useMemo(() => {
    return (folder.members || [])
      .filter((m) => {
        const mid = cleanNumericId(m.numericId);
        if (!mid) return false;
        const prof = liveProfiles[mid];
        const leftAt = prof?.leftSpaces?.[cleanFolderId] || 0;
        const invitedAt = m.invitedAt || m.addedAt || 0;
        if (leftAt && leftAt >= invitedAt) {
          return false;
        }
        return true;
      })
      .map((m) => {
        const mid = cleanNumericId(m.numericId);
        const prof = mid ? liveProfiles[mid] : undefined;
        if (!prof) return m;
        const rawPhoto = prof.photoURL !== undefined && prof.photoURL !== '' ? prof.photoURL : (m.photoURL || '');
        const cleanPhoto = isRealPhotoUrl(rawPhoto) ? rawPhoto.trim() : '';
        const cleanAvatar = prof.avatar || (!isRealPhotoUrl(rawPhoto) && rawPhoto ? rawPhoto : (m.avatar || '👤'));
        return {
          ...m,
          name: prof.name || m.name,
          photoURL: cleanPhoto,
          avatar: cleanAvatar,
        };
      });
  }, [folder.members, liveProfiles, cleanFolderId]);

  // Current user leave detection
  useEffect(() => {
    if (!myCleanNumericId) return;
    const myProf = liveProfiles[myCleanNumericId];
    const leftAt = myProf?.leftSpaces?.[cleanFolderId] || 0;
    const myMember = (folder.members || []).find((m) => cleanNumericId(m.numericId) === myCleanNumericId);
    const invitedAt = myMember?.invitedAt || myMember?.addedAt || 0;
    if (leftAt && leftAt >= invitedAt) {
      onExit();
    }
  }, [liveProfiles, myCleanNumericId, cleanFolderId, folder.members, onExit]);

  // Space owner pruning left members in cloud
  useEffect(() => {
    if (!isOwner || !Array.isArray(folder.members)) return;
    folder.members.forEach((m) => {
      const mid = cleanNumericId(m.numericId);
      if (!mid || mid === folderOwner16) return;
      const prof = liveProfiles[mid];
      const leftAt = prof?.leftSpaces?.[cleanFolderId] || 0;
      const invitedAt = m.invitedAt || m.addedAt || 0;
      if (leftAt && leftAt >= invitedAt) {
        removeMemberFromShareFolder(folder.id, mid).catch(() => {});
      }
    });
  }, [isOwner, folder.id, folder.members, liveProfiles, cleanFolderId, folderOwner16]);
  const myMemberEntry = folder.members.find((m) => cleanNumericId(m.numericId) === myCleanNumericId);
  const canCurrentUserEdit = Boolean(
    isOwner ||
    (myMemberEntry?.role as any) === 'edit' ||
    myMemberEntry?.role === 'editor'
  );
  const canEdit = canCurrentUserEdit;
  const ownerPhoto = effectiveOwnerPhoto;


  // Active member profile listener for leftSpaces detection
  useEffect(() => {
    if (!folder?.id || !Array.isArray(folder.members)) return;
    const cleanFolderId = normalizeShareId(folder.id);
    const unsubs: (() => void)[] = [];
    const owner16 = cleanNumericId(folder.owner16DigitId || folder.ownerNumericId);

    folder.members.forEach((m) => {
      const cleanMid = cleanNumericId(m.numericId);
      if (!cleanMid || cleanMid === owner16) return;

      const profileRef = ref(rtdb, `shared_accounts/profile_${cleanMid}`);
      const listener = (snap: any) => {
        if (snap.exists()) {
          const val = snap.val();
          const leftAt = val?.leftSpaces?.[cleanFolderId];
          const invitedAt = m.invitedAt || m.addedAt || 0;
          if (leftAt && leftAt >= invitedAt) {
            // Member has left this space!
            if (cleanMid === myCleanNumericId) {
              onExit();
              return;
            }
            // Automatically hide/purge that member from the space UI in real time
            setFolder((prev) => ({
              ...prev,
              members: prev.members.filter((mem) => cleanNumericId(mem.numericId) !== cleanMid),
              member16Ids: (prev.member16Ids || []).filter((id) => cleanNumericId(id) !== cleanMid),
            }));
            // If current user is space owner, remove member from cloud share_${shareId}
            if (isOwner) {
              removeMemberFromShareFolder(folder.id, cleanMid).catch(() => {});
            }
          }
        }
      };
      onValue(profileRef, listener);
      unsubs.push(() => off(profileRef, 'value', listener));
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [folder?.id, folder?.members?.length, isOwner, myCleanNumericId, onExit]);

  const accounts = folder.payload.accounts || [];
  const categories = folder.payload.categories || [];
  const transactions = folder.payload.transactions || [];

  // Total balance computation for the share
  const totalBalance = useMemo(() => {
    if (accounts.length > 0) {
      return accounts.reduce((acc, a) => acc + a.balance, 0);
    }
    let inc = 0;
    let exp = 0;
    for (const t of transactions) {
      if (t.type === 'income') inc += t.amount;
      if (t.type === 'expense') exp += t.amount;
    }
    return inc - exp;
  }, [accounts, transactions]);

  // Displayed transactions (filtered by active entity or full list and search query)
  const displayedTransactions = useMemo(() => {
    let list = transactions;
    if (activeEntityFilter) {
      if (activeEntityFilter.type === 'account') {
        list = list.filter(
          (t) => t.accountId === activeEntityFilter.id || t.toAccountId === activeEntityFilter.id
        );
      } else {
        list = list.filter(
          (t) => t.categoryId === activeEntityFilter.id || t.categoryName === activeEntityFilter.name
        );
      }
    }

    if (searchQuery.trim()) {
      list = list.filter((t) =>
        matchesTransactionSearch(t, searchQuery, {
          accounts,
          categories,
          currencySymbol: settings.currencySymbol,
        })
      );
    }

    return list;
  }, [transactions, activeEntityFilter, searchQuery, accounts, categories, settings.currencySymbol]);

  // Group by Month -> Day identical to HomeView
  const groupedData = useMemo(() => {
    const sorted = [...displayedTransactions].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      const timeA = a.time || '00:00';
      const timeB = b.time || '00:00';
      if (timeA !== timeB) return timeB.localeCompare(timeA);
      return b.createdAt - a.createdAt;
    });

    const monthsMap = new Map<
      string,
      {
        monthKey: string;
        monthNet: number;
        daysMap: Map<string, { dayKey: string; dayNet: number; txs: Transaction[] }>;
      }
    >();

    for (const tx of sorted) {
      const monthKey = tx.date.slice(0, 7); // "YYYY-MM"
      const dayKey = tx.date; // "YYYY-MM-DD"

      let monthEntry = monthsMap.get(monthKey);
      if (!monthEntry) {
        monthEntry = { monthKey, monthNet: 0, daysMap: new Map() };
        monthsMap.set(monthKey, monthEntry);
      }

      let dayEntry = monthEntry.daysMap.get(dayKey);
      if (!dayEntry) {
        dayEntry = { dayKey, dayNet: 0, txs: [] };
        monthEntry.daysMap.set(dayKey, dayEntry);
      }

      dayEntry.txs.push(tx);

      let delta = 0;
      if (tx.type === 'income') delta = tx.amount;
      else if (tx.type === 'expense') delta = -tx.amount;

      monthEntry.monthNet += delta;
      dayEntry.dayNet += delta;
    }

    return Array.from(monthsMap.values()).map((m) => ({
      ...m,
      days: Array.from(m.daysMap.values()),
    }));
  }, [displayedTransactions]);

  const handleCopyLink = async () => {
    try {
      const { folder: updated, shareUrl } = await ensureShareLinkToken(folder);
      setFolder(updated);
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      showToast(isArabic ? 'تم نسخ رابط المشاركة الآمن!' : 'Secure share link copied!', 'success');
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      showToast(isArabic ? 'تعذر نسخ الرابط' : 'Failed to copy link', 'error');
    }
  };

  const toggleMonth = (monthKey: string) => {
    setCollapsedMonths((prev) => ({ ...prev, [monthKey]: !prev[monthKey] }));
  };

  const toggleDay = (dayKey: string) => {
    setCollapsedDays((prev) => ({ ...prev, [dayKey]: !prev[dayKey] }));
  };

  // Pre-Delete Review: calculates candidates, detects overlap with accounts/categories, and opens modal
  const initiatePreDeleteReview = (
    type: 'account' | 'category' | 'transaction',
    id: string,
    name: string,
    icon?: string
  ) => {
    if (!canCurrentUserEdit) {
      showToast(
        isArabic
          ? 'ليس لديك صلاحية لحذف العناصر من هذه المساحة (وضع المشاهدة فقط)'
          : 'You do not have permission to delete items from this share (Viewer mode only)',
        'error'
      );
      return;
    }

    const allTxs = folder.payload?.transactions || [];
    const allAccounts = folder.payload?.accounts || [];
    const allCategories = folder.payload?.categories || [];

    let candidateTxs: Transaction[] = [];

    if (type === 'account') {
      candidateTxs = allTxs.filter((t) => t.accountId === id || t.toAccountId === id);
    } else if (type === 'category') {
      candidateTxs = allTxs.filter((t) => t.categoryId === id || t.categoryName === name);
    } else {
      const found = allTxs.find((t) => t.id === id);
      if (found) candidateTxs = [found];
    }

    // Overlap detection
    const candidates = candidateTxs.map((tx) => {
      const overlappingWith: Array<{ type: 'account' | 'category'; name: string; icon: string }> = [];

      // Check overlap with other included accounts
      for (const acc of allAccounts) {
        if (type === 'account' && acc.id === id) continue;
        if (tx.accountId === acc.id || tx.toAccountId === acc.id) {
          overlappingWith.push({
            type: 'account',
            name: acc.name,
            icon: acc.icon || '🏦',
          });
        }
      }

      // Check overlap with other included categories
      for (const cat of allCategories) {
        if (type === 'category' && (cat.id === id || cat.name === name)) continue;
        if (tx.categoryId === cat.id || tx.categoryName === cat.name) {
          overlappingWith.push({
            type: 'category',
            name: cat.name,
            icon: cat.icon || '🏷️',
          });
        }
      }

      return {
        tx,
        overlappingWith,
      };
    });

    setPreDeleteState({
      targetType: type,
      targetId: id,
      targetName: name,
      targetIcon: icon,
      candidates,
      selectedTxIds: new Set(candidateTxs.map((t) => t.id)),
      deleteFromPersonal: false,
    });
  };

  // Check if any deleted item exists in the user's personal local transactions
  const hasAnyPersonalTx = useMemo(() => {
    if (!preDeleteState) return false;
    const personalTxIdSet = new Set((personalTransactions || []).map((t) => t.id));
    return Array.from(preDeleteState.selectedTxIds).some((id) => personalTxIdSet.has(id));
  }, [preDeleteState, personalTransactions]);

  const shouldShowPersonalDeleteChoice = isOwner || hasAnyPersonalTx;

  // Confirm Pre-Delete: removes items smartly, auto-cleans empty accounts/categories, and updates cloud
  const handleConfirmPreDelete = async () => {
    if (!preDeleteState) return;

    const { targetType, targetId, selectedTxIds, deleteFromPersonal } = preDeleteState;
    const deletedTxIds = Array.from(selectedTxIds);

    // Optional sync deletion from personal feed (strictly guarded)
    if (shouldShowPersonalDeleteChoice && deleteFromPersonal) {
      for (const txId of deletedTxIds) {
        deleteTransaction(txId);
      }
    }

    const deletedAccountIds = targetType === 'account' ? [targetId] : [];
    const deletedCategoryIds = targetType === 'category' ? [targetId] : [];

    const updated = removeItemsFromShareFolderSmart(folder.id, {
      deletedAccountIds,
      deletedCategoryIds,
      deletedTxIds,
    });

    if (updated) {
      setFolder(updated);
    }

    if (deletedTxIds.length > 0) {
      logSharedSpaceActivity(folder.id, {
        actor16Id: myCleanNumericId,
        action: deletedTxIds.length > 1 ? 'bulk_delete' : 'delete',
        count: deletedTxIds.length,
      }).catch(() => {});
    }

    if (activeEntityFilter?.id === targetId) {
      setActiveEntityFilter(null);
    }

    setPreDeleteState(null);

    showToast(
      isArabic
        ? 'تم حذف العناصر وتحديث المساحة المشتركة تلقائياً'
        : 'Items deleted and share space auto-updated',
      'success'
    );
  };

  const handleOpenAddTx = () => {
    if (!canCurrentUserEdit) {
      showToast(
        isArabic
          ? 'ليس لديك صلاحية لإضافة معاملات (وضع المشاهدة فقط)'
          : 'You do not have permission to add transactions (Viewer mode only)',
        'error'
      );
      return;
    }
    setEditingShareTx(null);
    setIsShareTxModalOpen(true);
  };

  const handleOpenEditTx = (tx: Transaction) => {
    if (!canCurrentUserEdit) return;
    setEditingShareTx(tx);
    setIsShareTxModalOpen(true);
  };

  const handleSaveSharedTransaction = (savedTx: Transaction, isEdit: boolean) => {
    if (!canCurrentUserEdit) return;

    const currentTxs = [...(folder.payload?.transactions || [])];
    let nextTxs: Transaction[];
    if (isEdit) {
      nextTxs = currentTxs.map((t) => (t.id === savedTx.id ? savedTx : t));
    } else {
      nextTxs = [savedTx, ...currentTxs];
    }

    const nextAccounts = syncAllAccountBalances(folder.payload?.accounts || [], nextTxs);

    const updatedFolder: ShareFolder = {
      ...folder,
      updatedAt: Date.now(),
      itemCount: nextAccounts.length + (folder.payload?.categories?.length || 0) + nextTxs.length,
      accounts: nextAccounts,
      transactions: nextTxs,
      payload: {
        ...folder.payload,
        accounts: nextAccounts,
        transactions: nextTxs,
      },
    };

    upsertSpaceInV3Cache(updatedFolder);
    setFolder(updatedFolder);

    pushTransactionDeltaToCloud(folder.id, isEdit ? 'update' : 'add', savedTx).catch(() => {});
    logSharedSpaceActivity(folder.id, {
      actor16Id: myCleanNumericId,
      action: isEdit ? 'edit' : 'add',
      count: 1,
    }).catch(() => {});

    // Writes only to the shared space node unless the shared item is linked to a personal item (which updates personal item and balance too)
    const isLinkedToPersonal = (personalTransactions || []).some((p) => p.id === savedTx.id);
    if (isLinkedToPersonal) {
      updateTransaction(savedTx);
    }

    setIsShareTxModalOpen(false);
    setEditingShareTx(null);

    showToast(
      isEdit
        ? (isArabic ? 'تم تحديث المعاملة في المساحة المشتركة' : 'Transaction updated in shared space')
        : (isArabic ? 'تمت إضافة المعاملة للمساحة المشتركة' : 'Transaction added to shared space'),
      'success'
    );
  };

  const handleInitiateDeleteTxs = (txIds: string[]) => {
    if (!canCurrentUserEdit) {
      showToast(
        isArabic
          ? 'ليس لديك صلاحية لحذف المعاملات (وضع المشاهدة فقط)'
          : 'You do not have permission to delete transactions (Viewer mode only)',
        'error'
      );
      return;
    }
    if (!txIds || txIds.length === 0) return;
    setDeleteDialog({
      txIds,
      scope: 'share_only',
    });
  };

  const handleConfirmScopeDelete = async () => {
    if (!deleteDialog || deleteDialog.txIds.length === 0) return;
    const { txIds, scope } = deleteDialog;
    setDeleteDialog(null);

    const allTxs = folder.payload?.transactions || [];
    const txsToDelete = allTxs.filter((t) => txIds.includes(t.id));
    if (txsToDelete.length === 0) return;

    const cleanFolderId = normalizeShareId(folder.id);
    const now = Date.now();

    // Track undo data
    const deletedPersonalTxIds: string[] = [];
    const modifiedPersonalTxs: Array<{ id: string; prevExcluded?: string[] }> = [];

    // 1. If scope === 'both', delete matching personal transactions using tombstone-first rule
    if (scope === 'both') {
      for (const tx of txsToDelete) {
        const personalMatch = (personalTransactions || []).find((p) => p.id === tx.id);
        if (personalMatch) {
          deletedPersonalTxIds.push(personalMatch.id);
          deleteTransaction(personalMatch.id);
        }
      }
    }

    // 2. If scope === 'share_only', add exclusion marker (excludedShareIds) on matching personal transactions
    if (scope === 'share_only') {
      for (const tx of txsToDelete) {
        const personalMatch = (personalTransactions || []).find((p) => p.id === tx.id);
        if (personalMatch) {
          const currentExcluded = personalMatch.excludedShareIds || [];
          if (!currentExcluded.includes(cleanFolderId)) {
            modifiedPersonalTxs.push({ id: personalMatch.id, prevExcluded: personalMatch.excludedShareIds });
            const nextExcluded = [...currentExcluded, cleanFolderId];
            updateTransaction({
              ...personalMatch,
              excludedShareIds: nextExcluded,
              updatedAt: now,
            });
          }
        }
      }
    }

    // 3. Remove transactions from shared space locally & recalculate balances
    const remainingTxs = allTxs.filter((t) => !txIds.includes(t.id));
    const remainingAccounts = syncAllAccountBalances(folder.payload?.accounts || [], remainingTxs);

    const updatedFolder: ShareFolder = {
      ...folder,
      updatedAt: now,
      itemCount: remainingAccounts.length + (folder.payload?.categories?.length || 0) + remainingTxs.length,
      accounts: remainingAccounts,
      transactions: remainingTxs,
      payload: {
        ...folder.payload,
        accounts: remainingAccounts,
        transactions: remainingTxs,
      },
    };

    upsertSpaceInV3Cache(updatedFolder);
    setFolder(updatedFolder);

    // 4. Update cloud RTDB via single-item path updates keeping root rule fields (ownerUid, accountName, updatedAt)
    // sanitized via JSON.parse(JSON.stringify())
    const updates: Record<string, any> = {
      updatedAt: now,
      ownerUid: folder.ownerUid || auth.currentUser?.uid || 'authenticated_user',
      accountName: folder.name || 'Share',
    };
    for (const id of txIds) {
      updates[`transactions/${id}`] = null;
      updates[`payload/transactions/${id}`] = null;
    }
    const sanitizedUpdates = JSON.parse(JSON.stringify(updates));
    try {
      await update(ref(rtdb, getCanonicalSharePath(folder.id)), sanitizedUpdates);
    } catch (err) {
      console.warn('[ShareDetailView] Error pushing delete updates to RTDB:', err);
    }

    logSharedSpaceActivity(folder.id, {
      actor16Id: myCleanNumericId,
      action: txIds.length > 1 ? 'bulk_delete' : 'delete',
      count: txIds.length,
    }).catch(() => {});

    // Clear selection if multi-select was active
    clearGlobalSelection();

    // 5. Show 6-second Undo Toast
    showToast(
      t('deleteSuccess'),
      'success',
      {
        label: t('undo'),
        onClick: () => {
          handleUndoDelete({
            scope,
            deletedTransactions: txsToDelete,
            deletedPersonalTxIds,
            modifiedPersonalTxs,
            folderId: folder.id,
          });
        },
      },
      6000
    );
  };

  const handleUndoDelete = async (undoData: {
    scope: 'share_only' | 'both';
    deletedTransactions: Transaction[];
    deletedPersonalTxIds: string[];
    modifiedPersonalTxs: Array<{ id: string; prevExcluded?: string[] }>;
    folderId: string;
  }) => {
    const { scope, deletedTransactions, deletedPersonalTxIds, modifiedPersonalTxs, folderId } = undoData;
    const now = Date.now();

    // 1. Restore personal transactions if deleted
    if (scope === 'both') {
      for (const txId of deletedPersonalTxIds) {
        removeLocalTombstone(txId);
        const originalTx = deletedTransactions.find((t) => t.id === txId);
        if (originalTx) {
          addTransaction({
            ...originalTx,
            updatedAt: now,
          });
        }
      }
    }

    // 2. Revert exclusion marker if scope was share_only
    if (scope === 'share_only' && modifiedPersonalTxs.length > 0) {
      for (const mod of modifiedPersonalTxs) {
        const pTx = (personalTransactions || []).find((p) => p.id === mod.id);
        if (pTx) {
          updateTransaction({
            ...pTx,
            excludedShareIds: mod.prevExcluded || undefined,
            updatedAt: now,
          });
        }
      }
    }

    // 3. Restore in shared space
    const currentFolder = loadAllSpacesV3().find((s) => normalizeShareId(s.id) === normalizeShareId(folderId)) || folder;
    const restoredTxs = [
      ...deletedTransactions.map((t) => ({ ...t, updatedAt: now })),
      ...(currentFolder.payload?.transactions || []),
    ];
    const seenIds = new Set<string>();
    const uniqueTxs: Transaction[] = [];
    for (const t of restoredTxs) {
      if (!seenIds.has(t.id)) {
        seenIds.add(t.id);
        uniqueTxs.push(t);
      }
    }

    const restoredAccounts = syncAllAccountBalances(currentFolder.payload?.accounts || [], uniqueTxs);
    const updatedFolder: ShareFolder = {
      ...currentFolder,
      updatedAt: now,
      itemCount: restoredAccounts.length + (currentFolder.payload?.categories?.length || 0) + uniqueTxs.length,
      accounts: restoredAccounts,
      transactions: uniqueTxs,
      payload: {
        ...currentFolder.payload,
        accounts: restoredAccounts,
        transactions: uniqueTxs,
      },
    };

    upsertSpaceInV3Cache(updatedFolder);
    setFolder(updatedFolder);

    // RTDB cloud update for restored transactions
    try {
      const updates: Record<string, any> = {
        updatedAt: now,
        ownerUid: currentFolder.ownerUid || auth.currentUser?.uid || 'authenticated_user',
        accountName: currentFolder.name || 'Share',
      };
      for (const tx of deletedTransactions) {
        const sanitized = deepSanitizeForFirebase({ ...tx, updatedAt: now });
        updates[`transactions/${tx.id}`] = sanitized;
        updates[`payload/transactions/${tx.id}`] = sanitized;
      }
      await update(ref(rtdb, getCanonicalSharePath(folderId)), updates);
    } catch (err) {
      console.warn('[ShareDetailView] Error restoring transactions to RTDB:', err);
    }

    showToast(t('undoSuccess'), 'success');
  };



  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = cleanNumericId(selectedMemberUser?.numericId || newMemberId);
    if (cleanId.length !== 16) {
      showToast(isArabic ? 'يرجى اختيار مستخدم صالح أولاً' : 'Please select a valid user first', 'error');
      return;
    }

    setIsSubmittingMember(true);
    const res = await addMemberToShareFolder(
      folder.id,
      cleanId,
      selectedMemberUser?.name,
      'viewer',
      selectedMemberUser?.avatar,
      selectedMemberUser?.photoURL
    );
    setIsSubmittingMember(false);

    if (res.success && res.folder) {
      setFolder(res.folder);
      await syncShareFolderToCloud(res.folder).catch(() => {});
      setNewMemberId('');
      setSelectedMemberUser(null);
      setIsAddMemberOpen(false);
      showToast(
        res.cloudSynced === false
          ? (isArabic
              ? 'تمت إضافة العضو بنجاح محلياً! (بانتظار تحديث صلاحيات قواعد Firebase للمزامنة السحابية)'
              : 'Member added locally! (Firebase RTDB rules update needed for cloud sync)')
          : (isArabic
              ? 'تمت إضافة العضو وإرسال الدعوة لحظياً!'
              : 'Member added and invite sent instantly!'),
        res.cloudSynced === false ? 'info' : 'success'
      );
    } else {
      showToast(res.error || (isArabic ? 'فشلت إضافة العضو' : 'Failed to add member'), 'error');
    }
  };

  const transactionsToImport = useMemo(() => {
    if (importScope === 'selected') {
      return transactions.filter((t) => selectedTxIds.includes(t.id));
    }
    return transactions;
  }, [importScope, transactions, selectedTxIds]);

  const importStats = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const tx of transactionsToImport) {
      if (tx.type === 'income') income += tx.amount;
      else if (tx.type === 'expense') expense += tx.amount;
    }
    return {
      count: transactionsToImport.length,
      income,
      expense,
      net: income - expense,
    };
  }, [transactionsToImport]);

  const openImportConfirmationSheet = (scope: 'selected' | 'all') => {
    const list = scope === 'selected' ? transactions.filter((t) => selectedTxIds.includes(t.id)) : transactions;
    if (list.length === 0) {
      showToast(isArabic ? 'لا توجد معاملات لإضافتها' : 'No transactions to add', 'info');
      return;
    }
    setImportScope(scope);
    if (!selectedTargetAccountId && myPersonalAccounts.length > 0) {
      setSelectedTargetAccountId(myPersonalAccounts[0].id);
    }
    setIsImportSheetOpen(true);
  };

  const handleConfirmImport = () => {
    if (transactionsToImport.length === 0) {
      showToast(isArabic ? 'لا توجد معاملات لإضافتها' : 'No transactions to import', 'info');
      setIsImportSheetOpen(false);
      return;
    }

    const res = importSharedItems({
      accounts,
      categories,
      transactions: transactionsToImport,
      targetAccountId: selectedTargetAccountId || undefined,
    });

    if (res.txsCount > 0) {
      showToast(
        isArabic
          ? `تمت إضافة ${res.txsCount} معاملة بنجاح إلى حسابك!${(res as any).skippedTxsCount ? ` (تم تخطي ${(res as any).skippedTxsCount} مكررة)` : ''}`
          : `Successfully imported ${res.txsCount} transactions into your account!${(res as any).skippedTxsCount ? ` (${(res as any).skippedTxsCount} duplicates skipped)` : ''}`,
        'success'
      );
    } else if ((res as any).skippedTxsCount && (res as any).skippedTxsCount > 0) {
      showToast(
        isArabic
          ? `كافة المعاملات (${(res as any).skippedTxsCount}) مستوردة مسبقاً في حسابك الشخصي!`
          : `All ${(res as any).skippedTxsCount} transactions are already imported in your personal feed!`,
        'info'
      );
    } else {
      showToast(
        isArabic
          ? 'تم استيراد البيانات إلى حسابك الشخصي بنجاح!'
          : 'Data imported to your personal feed successfully!',
        'success'
      );
    }

    clearGlobalSelection();
    setIsImportSheetOpen(false);
  };

  const handleLeaveShare = async () => {
    const ok = await showConfirm({
      title: isArabic ? 'مغادرة صفحة المشاركة' : 'Leave Share Space',
      message: isArabic
        ? `هل أنت متأكد من مغادرة شير "${folder.name}"؟ ستفقد إمكانية الوصول إلى هذه العناصر إلا إذا تمت دعوتك مجدداً.`
        : `Are you sure you want to leave "${folder.name}"? You will lose access unless invited again.`,
      confirmLabel: isArabic ? 'نعم، مغادرة' : 'Yes, Leave',
      cancelLabel: isArabic ? 'إلغاء' : 'Cancel',
      isDanger: true,
    });
    if (!ok) return;

    await leaveShareFolder(folder.id, myCleanNumericId);
    showToast(isArabic ? 'تمت مغادرة المشاركة بنجاح' : 'Left share successfully', 'info');
    onExit();
  };

  return (
    <div
      role="region"
      aria-label="Share Detail View"
      className="fixed inset-0 z-50 bg-black text-white flex flex-col overflow-y-auto animate-in fade-in"
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-none md:max-w-7xl landscape:max-w-none mx-auto min-h-screen flex flex-col bg-black pb-20">
        {/* Top Header Bar: Responsive 2-Row Layout with Min 44px Touch Targets */}
        <header className="sticky top-0 z-20 px-3 sm:px-4 py-2.5 bg-black/90 backdrop-blur-md border-b border-zinc-800/80 flex flex-col gap-2 shrink-0">
          {/* Row 1: Back + Title + Action Buttons */}
          <div className="flex items-center justify-between gap-2 w-full min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => {
                  clearGlobalSelection();
                  onExit();
                }}
                aria-label={isArabic ? 'رجوع' : 'Go Back'}
                className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0 border border-zinc-800"
              >
                <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
              </button>
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-xl sm:text-2xl shrink-0 select-none">{folder.icon || '📁'}</span>
                <h1 className="text-sm sm:text-base font-bold text-white truncate leading-tight min-w-0">
                  {folder.name}
                </h1>
              </div>
            </div>

            {/* Compact Grouped Action Buttons with 44px min touch target */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleCopyLink}
                className="min-w-[44px] min-h-[44px] px-2.5 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                title={isCopied ? (isArabic ? 'تم النسخ' : 'Copied') : (isArabic ? 'نسخ الرابط' : 'Copy Link')}
              >
                {isCopied ? <Check className="w-4 h-4 text-emerald-400 shrink-0" /> : <Copy className="w-4 h-4 shrink-0" />}
                <span className="hidden sm:inline">{isCopied ? (isArabic ? 'تم النسخ' : 'Copied') : (isArabic ? 'رابط' : 'Link')}</span>
              </button>

              {isOwner && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenEditSpace(e);
                  }}
                  className="min-w-[44px] min-h-[44px] px-2.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 text-xs font-semibold"
                  title={isArabic ? 'إعدادات المساحة' : 'Space Settings'}
                  aria-label={isArabic ? 'إعدادات المساحة' : 'Space Settings'}
                >
                  <Settings className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span className="hidden sm:inline">{isArabic ? 'الإعدادات' : 'Settings'}</span>
                </button>
              )}

              {!isOwner && (
                <>
                  <button
                    type="button"
                    onClick={() => openImportConfirmationSheet(selectedTxIds.length > 0 ? 'selected' : 'all')}
                    className="min-w-[44px] min-h-[44px] px-2.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-md"
                    title={
                      selectedTxIds.length > 0
                        ? (isArabic ? 'إضافة المعاملات المحددة لحسابي' : 'Add Selected to My Account')
                        : (isArabic ? 'إضافة كافة المعاملات لحسابي' : 'Add All to My Account')
                    }
                  >
                    <Download className="w-4 h-4 shrink-0" />
                    <span className="hidden sm:inline">
                      {selectedTxIds.length > 0
                        ? (isArabic ? `إضافة (${selectedTxIds.length})` : `Add (${selectedTxIds.length})`)
                        : (isArabic ? 'إضافة لحسابي' : 'Add to My Account')}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLeaveShare}
                    className="min-w-[44px] min-h-[44px] px-2.5 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                    title={isArabic ? 'مغادرة المشاركة' : 'Leave Share'}
                  >
                    <LogOut className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="hidden sm:inline">{isArabic ? 'مغادرة' : 'Leave'}</span>
                  </button>
                </>
              )}

              {isOwner && selectedTxIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => openImportConfirmationSheet('selected')}
                  className="min-w-[44px] min-h-[44px] px-2.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-md animate-in fade-in"
                  title={isArabic ? 'إضافة المعاملات المحددة لحسابي' : 'Add Selected to My Account'}
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">
                    {isArabic ? `إضافة (${selectedTxIds.length})` : `Add (${selectedTxIds.length})`}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Badges row (Owner with photo/avatar, Live, Role badge, Total items count) */}
          <div className="flex items-center flex-wrap gap-2 text-[11px] text-zinc-400 min-w-0">
            {/* Owner Badge */}
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-900/80 border border-zinc-800 text-zinc-300 text-[10px] font-medium shrink-0 max-w-[200px] truncate">
              {ownerPhoto && isRealPhotoUrl(ownerPhoto) ? (
                <img
                  src={ownerPhoto}
                  alt={effectiveOwnerName}
                  className="w-3.5 h-3.5 rounded-full object-cover border border-purple-500/40 inline-block shrink-0"
                />
              ) : effectiveOwnerAvatar && effectiveOwnerAvatar !== '👤' ? (
                <span className="text-[10px] shrink-0">{effectiveOwnerAvatar}</span>
              ) : (
                <span
                  className={`w-3.5 h-3.5 rounded-full inline-flex items-center justify-center text-[8px] font-bold text-white bg-gradient-to-tr ${getAvatarColorGradient(
                    folder.owner16DigitId || folder.ownerNumericId || folder.ownerName
                  )} shrink-0`}
                >
                  {getMemberInitials(folder.ownerName, folder.owner16DigitId || folder.ownerNumericId).slice(0, 1)}
                </span>
              )}
              <span className="truncate">
                {isOwner ? (isArabic ? 'أنت المالك' : 'Owned by You') : `${isArabic ? 'المالك:' : 'Owner:'} ${effectiveOwnerName}`}
              </span>
            </span>

            {/* Live Pulse Badge */}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 font-medium text-[10px] shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live</span>
            </span>

            {/* Role Badge (Owner, Editor, Viewer) */}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium shrink-0 ${
              isOwner
                ? 'bg-purple-950/40 border-purple-500/30 text-purple-300'
                : canEdit
                ? 'bg-blue-950/40 border-blue-500/30 text-blue-300'
                : 'bg-zinc-850 border-zinc-700 text-zinc-400'
            }`}>
              <Shield className="w-3 h-3" />
              <span>
                {isOwner
                  ? (isArabic ? 'مالك' : 'Owner')
                  : canEdit
                  ? (isArabic ? 'محرر' : 'Editor')
                  : (isArabic ? 'مشاهد' : 'Viewer')}
              </span>
            </span>

            {/* Total Transactions Count Badge */}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-900/80 border border-zinc-800 text-zinc-400 text-[10px] shrink-0">
              <span>{folder.payload?.transactions?.length || 0}</span>
              <span>{isArabic ? 'معاملة' : 'txs'}</span>
            </span>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-4 space-y-4 flex-1">
          {/* Summary Metric Card */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 shadow-xl space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>{isArabic ? 'إجمالي الرصيد بالشير' : 'Total Share Balance'}</span>
              <span className="font-mono text-[11px] bg-zinc-800/80 px-2 py-0.5 rounded-full text-zinc-300">
                {folder.itemCount} {isArabic ? 'عنصر' : 'items'}
              </span>
            </div>
            <div className="text-3xl font-black font-mono tracking-tight text-white">
              {formatCurrency(totalBalance, currencySymbol, isArabic ? 'ar' : 'en')}
            </div>
          </div>

          {/* Members Bar - Two-Row Layout */}
          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex flex-col gap-3">
            {/* Row 1: Title on left, Action buttons on right */}
            <div className="flex items-center justify-between gap-3 w-full">
              <div className="flex items-center gap-2 min-w-0">
                <Users className="w-4 h-4 text-purple-400 shrink-0" />
                <span className="text-xs font-bold text-zinc-200 truncate">
                  {isArabic ? 'الأعضاء المشاركون' : 'Share Members'} ({activeOverlaidMembers.length + 1})
                </span>
              </div>

              {isOwner && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {activeOverlaidMembers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsManageMembersOpen(true)}
                      className="px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 flex items-center gap-1.5 transition active:scale-95 cursor-pointer border border-zinc-800"
                    >
                      <Users className="w-3.5 h-3.5 text-purple-400" />
                      <span>{isArabic ? 'إدارة' : 'Manage'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsAddMemberOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-sm shadow-purple-950/40"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isArabic ? 'إضافة عضو' : 'Add Member'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Row 2: Full-width horizontal list of member chips/avatars */}
            <div className="w-full overflow-x-auto pt-3 pb-1 flex items-center gap-2.5 no-scrollbar">
              {/* Owner Chip */}
              <div
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-zinc-950/70 border border-blue-500/30 shrink-0"
                title={`${effectiveOwnerName || 'Owner'} (${isArabic ? 'المالك' : 'Owner'})`}
              >
                <div className="shrink-0 w-10 h-10 rounded-full overflow-visible relative bg-blue-600/30 border border-blue-500/60 flex items-center justify-center text-xs font-bold text-blue-300">
                  {ownerPhoto && isRealPhotoUrl(ownerPhoto) ? (
                    <img
                      src={ownerPhoto}
                      alt={effectiveOwnerName}
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    <span>{effectiveOwnerAvatar || getMemberInitials(effectiveOwnerName, folder.ownerNumericId)}</span>
                  )}
                  <span
                    className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-zinc-900"
                    title={isArabic ? 'المالك' : 'Owner'}
                  />
                </div>
                <div className="flex flex-col min-w-0 pr-1 rtl:pr-0 rtl:pl-1">
                  <span className="text-xs font-bold text-white max-w-[120px] truncate leading-tight">
                    {effectiveOwnerName || 'Owner'}
                  </span>
                  <span className="text-[10px] font-semibold text-blue-400 leading-tight mt-0.5">
                    {isArabic ? 'المالك' : 'Owner'}
                  </span>
                </div>
              </div>

              {/* Members Chips */}
              {folder.members
                .filter(
                  (m) =>
                    cleanNumericId(m.numericId) !==
                    cleanNumericId(folder.owner16DigitId || folder.ownerNumericId || '')
                )
                .map((m) => {
                const isCurrent = cleanNumericId(m.numericId) === myCleanNumericId;
                const isAccepted = m.status === 'accepted' || (m.status as string) === 'active';
                return (
                  <div
                    key={m.numericId}
                    onClick={() => isOwner && setIsManageMembersOpen(true)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl bg-zinc-950/70 border border-zinc-800 shrink-0 ${
                      isOwner ? 'cursor-pointer hover:border-purple-500/50 transition' : ''
                    }`}
                    title={`${m.name} (${m.role})`}
                  >
                    <div
                      className={`shrink-0 w-10 h-10 rounded-full overflow-visible relative flex items-center justify-center text-xs font-bold text-white border ${
                        isAccepted ? 'border-purple-500/60' : 'border-amber-500/60'
                      } bg-gradient-to-tr ${getAvatarColorGradient(m.numericId || m.name)}`}
                    >
                      {m.photoURL ? (
                        <img
                          src={m.photoURL}
                          alt={m.name}
                          className="w-full h-full object-cover rounded-full"
                        />
                      ) : m.avatar && m.avatar !== '👤' ? (
                        <span className="text-base">{m.avatar}</span>
                      ) : (
                        <span>{getMemberInitials(m.name, m.numericId)}</span>
                      )}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-900 ${
                          isAccepted ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                        title={isAccepted ? 'Active' : 'Pending'}
                      />
                    </div>
                    <div className="flex flex-col min-w-0 pr-1 rtl:pr-0 rtl:pl-1">
                      <span className="text-xs font-bold text-white max-w-[120px] truncate leading-tight">
                        {m.name || 'Member'}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-semibold text-zinc-400 capitalize leading-tight">
                          {m.role === 'editor'
                            ? isArabic
                              ? 'محرر'
                              : 'Editor'
                            : isArabic
                            ? 'مشاهد'
                            : 'Viewer'}
                        </span>
                        {isCurrent && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 font-bold leading-tight">
                            {isArabic ? 'أنت' : 'You'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Action Toolbar if Editor */}
          {canEdit && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenAddTx}
                className="flex-1 py-2.5 px-3 rounded-2xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{isArabic ? 'تسجيل معاملة في هذا الشير' : 'Add Transaction in this Share'}</span>
              </button>
            </div>
          )}

          {/* Recent Changes (أحدث التغييرات) Activity Strip - Collapsible */}
          <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => setIsRecentActivityOpen((prev) => !prev)}
              className="w-full p-3.5 flex items-center justify-between text-start hover:bg-zinc-850/60 transition cursor-pointer select-none"
              aria-expanded={isRecentActivityOpen}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                  <History className="w-3.5 h-3.5" />
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-zinc-200 truncate">
                    {isArabic ? 'أحدث التغييرات' : 'Recent Changes'}
                  </span>
                  {recentActivities.length > 0 && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                      {recentActivities.length}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-400 shrink-0">
                <span className="text-[11px] text-zinc-500 hidden sm:inline">
                  {isRecentActivityOpen
                    ? (isArabic ? 'إخفاء' : 'Hide')
                    : (isArabic ? 'عرض' : 'Show')}
                </span>
                {isRecentActivityOpen ? (
                  <ChevronUp className="w-4 h-4 text-zinc-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-zinc-400" />
                )}
              </div>
            </button>

            {isRecentActivityOpen && (
              <div className="p-3 pt-0 border-t border-zinc-800/60 space-y-2 animate-in fade-in">
                {recentActivities.length === 0 ? (
                  <div className="py-4 text-center text-xs text-zinc-500">
                    {isArabic ? 'لا توجد تغييرات حديثة مسجلة بعد' : 'No recent activity recorded yet'}
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1 rtl:pr-0 rtl:pl-1">
                    {recentActivities.map((act, idx) => {
                      const actor16 = cleanNumericId(act.actor16Id);
                      const prof = actor16 ? liveProfiles[actor16] : undefined;
                      const isMe = actor16 === myCleanNumericId;
                      const actorName = prof?.name || (isMe ? (isArabic ? 'أنت' : 'You') : (actor16 ? `User ${actor16.slice(0, 4)}` : 'User'));
                      const rawPhoto = prof?.photoURL || '';
                      const hasRealPhoto = isRealPhotoUrl(rawPhoto);
                      const avatar = prof?.avatar || (!hasRealPhoto && rawPhoto ? rawPhoto : '👤');

                      const isAdd = act.action === 'add';
                      const isEdit = act.action === 'edit';
                      const isDelete = act.action === 'delete' || act.action === 'bulk_delete';

                      return (
                        <div
                          key={`${act.ts}_${idx}`}
                          className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-850 hover:border-zinc-800 transition"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Actor Avatar */}
                            <div
                              className={`w-7 h-7 rounded-full border border-purple-500/40 flex items-center justify-center text-[10px] font-bold text-white shrink-0 overflow-hidden bg-gradient-to-tr ${getAvatarColorGradient(
                                actor16 || actorName
                              )}`}
                            >
                              {hasRealPhoto ? (
                                <img src={rawPhoto} alt="" className="w-full h-full object-cover" />
                              ) : avatar !== '👤' ? (
                                <span className="text-xs">{avatar}</span>
                              ) : (
                                <span>{getMemberInitials(actorName, actor16).slice(0, 2)}</span>
                              )}
                            </div>

                            <div className="min-w-0 flex flex-col">
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200 truncate">
                                <span className="truncate">{actorName}</span>
                                {isMe && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 font-bold shrink-0">
                                    {isArabic ? 'أنت' : 'You'}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-0.5">
                                <span
                                  className={`inline-flex items-center gap-1 font-medium ${
                                    isAdd
                                      ? 'text-emerald-400'
                                      : isEdit
                                      ? 'text-blue-400'
                                      : 'text-red-400'
                                  }`}
                                >
                                  {isAdd && <Plus className="w-3 h-3" />}
                                  {isEdit && <Edit3 className="w-3 h-3" />}
                                  {isDelete && <Trash2 className="w-3 h-3" />}
                                  <span>{formatActivityAction(act.action, act.count, isArabic)}</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="text-[10px] text-zinc-500 font-mono shrink-0 whitespace-nowrap">
                            {formatRelativeActivityTime(act.ts, isArabic)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* CONTROL SECTION: Included Accounts & Categories */}
          {(accounts.length > 0 || categories.length > 0) && (
            <div className="p-4 rounded-3xl bg-zinc-900/80 border border-zinc-800 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-purple-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    {isArabic ? 'الحسابات والتصنيفات المضمنة' : 'Included Accounts & Categories'}
                  </h3>
                </div>
                {activeEntityFilter && (
                  <button
                    type="button"
                    onClick={() => setActiveEntityFilter(null)}
                    className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>{isArabic ? 'عرض كافة المعاملات' : 'Show All'}</span>
                  </button>
                )}
              </div>

              {/* Accounts Bar */}
              {accounts.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5 text-blue-400" />
                    <span>{isArabic ? 'الحسابات المضمنة' : 'Included Accounts'} ({accounts.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {accounts.map((acc) => {
                      const accTxs = transactions.filter((t) => t.accountId === acc.id || t.toAccountId === acc.id);
                      const isSelected = activeEntityFilter?.type === 'account' && activeEntityFilter?.id === acc.id;

                      return (
                        <div
                          key={acc.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-2xl border text-xs transition cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600/20 border-blue-500 text-blue-200 ring-1 ring-blue-500/50 shadow-sm'
                              : 'bg-zinc-950/80 hover:bg-zinc-850 border-zinc-800 text-zinc-200'
                          }`}
                          onClick={() => {
                            if (isSelected) {
                              setActiveEntityFilter(null);
                            } else {
                              setActiveEntityFilter({
                                type: 'account',
                                id: acc.id,
                                name: acc.name,
                                icon: acc.icon || '🏦',
                              });
                            }
                          }}
                        >
                          <span className="text-xl">{acc.icon || '🏦'}</span>
                          <div className="min-w-0">
                            <span className="font-bold block leading-tight truncate max-w-[130px] sm:max-w-xs">{acc.name}</span>
                            <span className="text-[10px] font-mono text-zinc-400">
                              {formatCurrency(acc.balance, currencySymbol, isArabic ? 'ar' : 'en')} · {accTxs.length} {isArabic ? 'معاملة' : 'txs'}
                            </span>
                          </div>

                          {canEdit && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                initiatePreDeleteReview('account', acc.id, acc.name, acc.icon);
                              }}
                              className="p-1 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition cursor-pointer rtl:mr-1 ltr:ml-1 shrink-0"
                              title={isArabic ? 'إزالة الحساب من الشير' : 'Remove Account from Share'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Categories Bar */}
              {categories.length > 0 && (
                <div className="space-y-1.5 pt-1.5 border-t border-zinc-800/60">
                  <div className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5">
                    <Tags className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isArabic ? 'التصنيفات المضمنة' : 'Included Categories'} ({categories.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => {
                      const catTxs = transactions.filter(
                        (t) => t.categoryId === cat.id || t.categoryName === cat.name
                      );
                      const isSelected = activeEntityFilter?.type === 'category' && activeEntityFilter?.id === cat.id;

                      return (
                        <div
                          key={cat.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-2xl border text-xs transition cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200 ring-1 ring-emerald-500/50 shadow-sm'
                              : 'bg-zinc-950/80 hover:bg-zinc-850 border-zinc-800 text-zinc-200'
                          }`}
                          onClick={() => {
                            if (isSelected) {
                              setActiveEntityFilter(null);
                            } else {
                              setActiveEntityFilter({
                                type: 'category',
                                id: cat.id,
                                name: cat.name,
                                icon: cat.icon || '🏷️',
                              });
                            }
                          }}
                        >
                          <span className="text-xl">{cat.icon || '🏷️'}</span>
                          <div className="min-w-0">
                            <span className="font-bold block leading-tight truncate max-w-[130px] sm:max-w-xs">{cat.name}</span>
                            <span className="text-[10px] text-zinc-400">
                              {catTxs.length} {isArabic ? 'معاملة' : 'txs'}
                            </span>
                          </div>

                          {canEdit && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                initiatePreDeleteReview('category', cat.id, cat.name, cat.icon);
                              }}
                              className="p-1 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition cursor-pointer rtl:mr-1 ltr:ml-1 shrink-0"
                              title={isArabic ? 'إزالة التصنيف من الشير' : 'Remove Category from Share'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Active Filter Pill if Filtering by specific entity */}
          {activeEntityFilter && (
            <div className="p-3 rounded-2xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-between gap-2 animate-in fade-in">
              <div className="flex items-center gap-2 text-xs text-blue-300 min-w-0">
                <Filter className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                <span className="truncate">
                  {isArabic ? 'تصفية حسب:' : 'Filtered by:'}{' '}
                  <span className="font-bold text-white">
                    {activeEntityFilter.icon} {activeEntityFilter.name}
                  </span>{' '}
                  ({displayedTransactions.length} {isArabic ? 'معاملة' : 'txs'})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveEntityFilter(null)}
                className="px-2.5 py-1 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 text-xs font-semibold flex items-center gap-1 transition cursor-pointer shrink-0"
              >
                <X className="w-3 h-3" />
                <span>{isArabic ? 'إلغاء التصفية' : 'Clear'}</span>
              </button>
            </div>
          )}

          {/* Transaction Search Bar (Matches Comments/Notes/Descriptions/Amounts/Categories) */}
          <div className="relative w-full">
            <Search className="absolute left-3.5 rtl:left-auto rtl:right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isArabic
                  ? 'البحث في المعاملات (الملاحظات، التصنيف، المبلغ)...'
                  : 'Search transactions (notes, category, amount)...'
              }
              className="w-full pl-10 pr-10 rtl:pl-10 rtl:pr-10 py-2.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 rtl:right-auto rtl:left-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* SECTION: Timeline Grouped Identically to HomeView by Months and Days */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-amber-400" />
                <span>{isArabic ? 'الجدول الزمني للمعاملات' : 'Transaction Timeline'}</span>
                <span className="font-mono text-[10px] text-zinc-500">
                  ({displayedTransactions.length})
                </span>
              </h3>
            </div>

            {displayedTransactions.length === 0 ? (
              <div className="py-12 px-4 rounded-3xl bg-zinc-900/40 border border-zinc-850 text-center text-xs text-zinc-500 space-y-1">
                <p className="font-medium text-zinc-400">
                  {searchQuery
                    ? (isArabic ? 'لا توجد نتائج بحث مطابقة' : 'No matching search results')
                    : activeEntityFilter
                    ? (isArabic
                        ? `لا توجد معاملات مسجلة مرتبطة بـ "${activeEntityFilter.name}"`
                        : `No transactions found for "${activeEntityFilter.name}"`)
                    : (isArabic
                        ? 'لا توجد معاملات في هذه المساحة المشتركة بعد'
                        : 'No transactions inside this share space yet')}
                </p>
                {activeEntityFilter && (
                  <button
                    type="button"
                    onClick={() => setActiveEntityFilter(null)}
                    className="text-blue-400 hover:text-blue-300 font-semibold pt-1 underline cursor-pointer"
                  >
                    {isArabic ? 'عرض كافة المعاملات' : 'Show All Transactions'}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {groupedData.map((monthGroup) => {
                  const isMonthCollapsed = Boolean(collapsedMonths[monthGroup.monthKey]);
                  const monthTitle = getMonthHeaderTitle(monthGroup.monthKey, isArabic ? 'ar' : 'en');
                  const isMonthPositive = monthGroup.monthNet >= 0;
                  const monthTxIds = monthGroup.days.flatMap((d) => d.txs).map((t) => t.id);
                  const isAllMonthSelected = monthTxIds.length > 0 && monthTxIds.every((id) => selectedTxIds.includes(id));
                  const isPartialMonthSelected = !isAllMonthSelected && monthTxIds.some((id) => selectedTxIds.includes(id));

                  return (
                    <div
                      key={monthGroup.monthKey}
                      className="rounded-3xl bg-zinc-950 border border-zinc-800/80 overflow-hidden shadow-lg"
                    >
                      {/* Month Header with Select All Checkbox */}
                      <ShareMonthHeaderRow
                        monthKey={monthGroup.monthKey}
                        monthTitle={monthTitle}
                        monthNet={monthGroup.monthNet}
                        monthTxIds={monthTxIds}
                        isMonthCollapsed={isMonthCollapsed}
                        toggleMonth={toggleMonth}
                        isTxMultiSelect={isTxMultiSelect}
                        selectedTxIds={selectedTxIds}
                        toggleBatchTxs={toggleBatchTxs}
                        currencySymbol={currencySymbol}
                        isArabic={isArabic}
                      />

                      {/* Days list inside Month */}
                      {!isMonthCollapsed && (
                        <div className="p-2 sm:p-3 space-y-3">
                          {monthGroup.days.map((dayGroup) => {
                            const isDayCollapsed = Boolean(collapsedDays[dayGroup.dayKey]);
                            const dayTitle = getDayHeaderTitle(dayGroup.dayKey, isArabic ? 'ar' : 'en');
                            const dayTxIds = dayGroup.txs.map((t) => t.id);

                            return (
                              <div
                                key={dayGroup.dayKey}
                                className="rounded-2xl bg-zinc-900/50 border border-zinc-800/60 overflow-hidden"
                              >
                                {/* Day Header with Select All Checkbox */}
                                <ShareDayHeaderRow
                                  dayKey={dayGroup.dayKey}
                                  dayTitle={dayTitle}
                                  dayNet={dayGroup.dayNet}
                                  dayTxIds={dayTxIds}
                                  isDayCollapsed={isDayCollapsed}
                                  toggleDay={toggleDay}
                                  isTxMultiSelect={isTxMultiSelect}
                                  selectedTxIds={selectedTxIds}
                                  toggleBatchTxs={toggleBatchTxs}
                                  currencySymbol={currencySymbol}
                                  isArabic={isArabic}
                                />

                                {/* Day Transactions */}
                                {!isDayCollapsed && (
                                  <div className="p-1.5 space-y-1">
                                    {dayGroup.txs.map((tx) => (
                                      <ShareTxRow
                                        key={tx.id}
                                        tx={tx}
                                        folderAccounts={folder.payload.accounts || accounts}
                                        isTxMultiSelect={isTxMultiSelect}
                                        isSelected={selectedTxIds.includes(tx.id)}
                                        canEdit={canEdit}
                                        currencySymbol={currencySymbol}
                                        isArabic={isArabic}
                                        onToggleSelect={toggleTxSelection}
                                        onStartMultiSelect={startTxMultiSelect}
                                        onDeleteClick={(t) =>
                                          handleInitiateDeleteTxs([t.id])
                                        }
                                        onEditClick={handleOpenEditTx}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Multi-Select Action Bar in ShareDetailView */}
      {isTxMultiSelect && selectedTxIds.length > 0 && (
        <div className="fixed bottom-4 inset-x-4 max-w-md mx-auto z-40 bg-zinc-900/95 backdrop-blur-xl border border-blue-500/40 rounded-2xl shadow-2xl p-3 flex items-center justify-between gap-2.5 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-400 font-bold text-xs flex items-center justify-center shrink-0 font-mono">
              {selectedTxIds.length}
            </span>
            <div className="min-w-0">
              <span className="text-xs font-bold text-white block truncate">
                {isArabic ? `${selectedTxIds.length} معاملة محددة` : `${selectedTxIds.length} selected`}
              </span>
              <span className="text-[10px] text-zinc-400 block truncate">
                {isArabic ? 'إضافة للحساب الشخصي' : 'Import to personal account'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canEdit && (
              <button
                type="button"
                onClick={() => handleInitiateDeleteTxs(selectedTxIds)}
                className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-red-600/30 cursor-pointer min-h-[40px]"
                title={isArabic ? `حذف (${selectedTxIds.length})` : `Delete (${selectedTxIds.length})`}
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                <span>{isArabic ? `حذف (${selectedTxIds.length})` : `Delete (${selectedTxIds.length})`}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => openImportConfirmationSheet('selected')}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-blue-600/30 cursor-pointer min-h-[40px]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isArabic ? 'إضافة لحسابي' : 'Add to My Account'}</span>
            </button>

            <button
              type="button"
              onClick={() => clearGlobalSelection()}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition active:scale-95 cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center"
              title={isArabic ? 'إلغاء التحديد' : 'Cancel Selection'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal: Confirmation Sheet - Import to Personal Account */}
      {isImportSheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => setIsImportSheetOpen(false)}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl p-5 space-y-4 animate-in zoom-in-95 my-auto"
            onClick={(e) => e.stopPropagation()}
            dir={isArabic ? 'rtl' : 'ltr'}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                  <FolderDown className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">
                    {isArabic ? 'إضافة إلى حسابي الشخصي' : 'Add to My Personal Account'}
                  </h3>
                  <p className="text-[11px] text-zinc-400 truncate">
                    {importScope === 'selected'
                      ? (isArabic ? `إضافة (${transactionsToImport.length}) معاملة محددة من "${folder.name}"` : `Add (${transactionsToImport.length}) selected items from "${folder.name}"`)
                      : (isArabic ? `إضافة كافة المعاملات (${transactionsToImport.length}) من "${folder.name}"` : `Add all (${transactionsToImport.length}) transactions from "${folder.name}"`)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsImportSheetOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Summary Card */}
            <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 text-center">
              <div>
                <span className="text-[10px] text-zinc-400 block">{isArabic ? 'العدد' : 'Count'}</span>
                <span className="text-xs font-mono font-bold text-white">{importStats.count}</span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block">{isArabic ? 'الدخل' : 'Income'}</span>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  +{formatCurrency(importStats.income, currencySymbol, isArabic ? 'ar' : 'en')}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block">{isArabic ? 'المصروف' : 'Expense'}</span>
                <span className="text-xs font-mono font-bold text-red-400">
                  -{formatCurrency(importStats.expense, currencySymbol, isArabic ? 'ar' : 'en')}
                </span>
              </div>
            </div>

            {/* Target Account Picker */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-blue-400" />
                <span>{isArabic ? 'اختر الحساب الشخصي لإيداع المعاملات فيه:' : 'Select Target Personal Account:'}</span>
              </label>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {myPersonalAccounts.map((acc) => {
                  const isChosen = selectedTargetAccountId === acc.id;
                  return (
                    <div
                      key={acc.id}
                      onClick={() => setSelectedTargetAccountId(acc.id)}
                      className={`p-2.5 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                        isChosen
                          ? 'bg-blue-950/40 border-blue-500 text-white shadow-md shadow-blue-950/30'
                          : 'bg-zinc-950/60 hover:bg-zinc-800/60 border-zinc-800 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xl shrink-0">{acc.icon || '🏦'}</span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate">{acc.name}</div>
                          <div className="text-[10px] text-zinc-400 font-mono">
                            {formatCurrency(acc.balance, currencySymbol, isArabic ? 'ar' : 'en')}
                          </div>
                        </div>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          isChosen ? 'border-blue-500 bg-blue-600 text-white' : 'border-zinc-700'
                        }`}
                      >
                        {isChosen && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                    </div>
                  );
                })}

                {/* Match Share Accounts Structure Option */}
                <div
                  onClick={() => setSelectedTargetAccountId('')}
                  className={`p-2.5 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                    selectedTargetAccountId === ''
                      ? 'bg-blue-950/40 border-blue-500 text-white shadow-md shadow-blue-950/30'
                      : 'bg-zinc-950/60 hover:bg-zinc-800/60 border-zinc-800 text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xl shrink-0">📁</span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">
                        {isArabic ? 'إنشاء حسابات مطابقة لحسابات الشير' : 'Create Matching Share Accounts'}
                      </div>
                      <div className="text-[10px] text-zinc-400 truncate">
                        {isArabic ? 'الحفاظ على نفس هيكل حسابات المساحة' : 'Keep original shared space accounts structure'}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      selectedTargetAccountId === '' ? 'border-blue-500 bg-blue-600 text-white' : 'border-zinc-700'
                    }`}
                  >
                    {selectedTargetAccountId === '' && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                </div>
              </div>
            </div>

            {/* Smart Duplication & Category Sync Notice */}
            <div className="p-3 rounded-2xl bg-blue-950/20 border border-blue-500/20 text-[11px] text-blue-200 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span>
                {isArabic
                  ? 'المزامنة الذكية: يتم ربط التصنيفات تلقائياً بنفس الاسم أو إنشاؤها فورياً، مع تخطي أي معاملات تم استيرادها سابقاً لتفادي تكرار الأرصدة.'
                  : 'Smart Sync: Categories are matched automatically by name or created, and previously imported transactions are skipped to avoid duplicate balances.'}
              </span>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsImportSheetOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition active:scale-95 cursor-pointer"
              >
                {isArabic ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/30"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isArabic ? 'تأكيد الإضافة' : 'Confirm Import'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full TransactionModal Integration pre-bound to this Share Space */}
      <TransactionModal
        isOpen={isShareTxModalOpen}
        onClose={() => {
          setIsShareTxModalOpen(false);
          setEditingShareTx(null);
        }}
        sharedSpace={folder}
        editingTransaction={editingShareTx}
        onSaveSharedTransaction={handleSaveSharedTransaction}
      />

      {/* Delete Confirmation Modal: Owner Scope Dialog vs Editor Plain Confirmation */}
      {deleteDialog && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => setDeleteDialog(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 animate-in zoom-in-95"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-white leading-tight">
                  {isOwner ? t('deleteSharedScopeTitle') : t('deleteEditorConfirmTitle')}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {isArabic
                    ? `${deleteDialog.txIds.length} معاملة محددة`
                    : `${deleteDialog.txIds.length} transaction(s) selected`}
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              {isOwner ? t('deleteSharedScopeDesc') : t('deleteEditorConfirmDesc')}
            </p>

            {/* Scope Selection Options (Owner only) */}
            {isOwner && (
              <div className="space-y-2.5 pt-1">
                {/* Option (a): Shared Space Only */}
                <label
                  onClick={() => setDeleteDialog((prev) => prev ? { ...prev, scope: 'share_only' } : null)}
                  className={`w-full p-3.5 rounded-2xl border flex items-start gap-3 transition cursor-pointer select-none text-start ${
                    deleteDialog.scope === 'share_only'
                      ? 'bg-blue-600/15 border-blue-500/50 shadow-sm'
                      : 'bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-900'
                  }`}
                >
                  <input
                    type="radio"
                    name="deleteScope"
                    checked={deleteDialog.scope === 'share_only'}
                    onChange={() => setDeleteDialog((prev) => prev ? { ...prev, scope: 'share_only' } : null)}
                    className="mt-1 w-4 h-4 text-blue-600 border-zinc-700 bg-zinc-950 focus:ring-0 shrink-0 cursor-pointer"
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-white block">
                      {t('deleteSharedSpaceOnly')}
                    </span>
                    <span className="text-[11px] text-zinc-400 block mt-0.5 leading-snug">
                      {t('deleteSharedSpaceOnlyDesc')}
                    </span>
                  </div>
                </label>

                {/* Option (b): Both Personal Account & Shared Space */}
                <label
                  onClick={() => setDeleteDialog((prev) => prev ? { ...prev, scope: 'both' } : null)}
                  className={`w-full p-3.5 rounded-2xl border flex items-start gap-3 transition cursor-pointer select-none text-start ${
                    deleteDialog.scope === 'both'
                      ? 'bg-red-600/15 border-red-500/50 shadow-sm'
                      : 'bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-900'
                  }`}
                >
                  <input
                    type="radio"
                    name="deleteScope"
                    checked={deleteDialog.scope === 'both'}
                    onChange={() => setDeleteDialog((prev) => prev ? { ...prev, scope: 'both' } : null)}
                    className="mt-1 w-4 h-4 text-red-600 border-zinc-700 bg-zinc-950 focus:ring-0 shrink-0 cursor-pointer"
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-white block">
                      {t('deleteBothPersonalAndShared')}
                    </span>
                    <span className="text-[11px] text-zinc-400 block mt-0.5 leading-snug">
                      {t('deleteBothPersonalAndSharedDesc')}
                    </span>
                  </div>
                </label>
              </div>
            )}

            {/* Modal Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteDialog(null)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white text-xs font-bold transition cursor-pointer min-h-[44px]"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmScopeDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-white text-xs font-bold shadow-lg shadow-red-600/30 transition cursor-pointer min-h-[44px]"
              >
                {isOwner ? t('confirmDelete') : t('deleteFromShare')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Member by 16-Digit ID */}
      {isAddMemberOpen && (
        <div
          role="dialog"
          className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/80 backdrop-blur-sm animate-in fade-in overscroll-contain"
          onClick={() => {
            setIsAddMemberOpen(false);
            setSelectedMemberUser(null);
            setNewMemberId('');
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[92dvh] overflow-y-auto my-auto bg-zinc-950 border border-zinc-800 rounded-3xl p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400" />
                <span>{isArabic ? 'إضافة عضو بالمعرّف الرقمي' : 'Add Member by User ID'}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsAddMemberOpen(false);
                  setSelectedMemberUser(null);
                  setNewMemberId('');
                }}
                className="p-1.5 rounded-xl hover:bg-zinc-900 text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              {isArabic
                ? 'أدخل المعرّف المكوّن من 16 رقماً للبحث والتحقق من المستخدم، وسيظهر اسمه وصورته لتأكيد اختياره قبل الإرسال.'
                : 'Enter the 16-digit ID to search and verify the user. Their verified name and photo will appear for confirmation before inviting.'}
            </p>

            <form onSubmit={handleAddMember} className="space-y-3.5">
              <UserSearchPicker
                selectedUser={selectedMemberUser}
                onSelectUser={(u) => {
                  setSelectedMemberUser(u);
                  if (u) {
                    setNewMemberId(u.numericId);
                  } else {
                    setNewMemberId('');
                  }
                }}
                onVerifyingChange={setIsVerifyingMember}
                currentUserId={myCleanNumericId}
                accentColor="purple"
                isArabic={isArabic}
                autoFocus
              />

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddMemberOpen(false);
                    setSelectedMemberUser(null);
                    setNewMemberId('');
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-400 text-xs font-bold transition cursor-pointer"
                >
                  {isArabic ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingMember || isVerifyingMember || !selectedMemberUser}
                  className={`flex-1 py-2.5 rounded-xl text-white text-xs font-bold shadow-md transition flex items-center justify-center gap-1.5 ${
                    selectedMemberUser && !isVerifyingMember && !isSubmittingMember
                      ? 'bg-purple-600 hover:bg-purple-500 cursor-pointer shadow-purple-900/30 active:scale-95'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-60'
                  }`}
                >
                  {isSubmittingMember ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{isArabic ? 'جارٍ الإرسال...' : 'Sending...'}</span>
                    </>
                  ) : isVerifyingMember ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-300" />
                      <span>{isArabic ? 'جارٍ التحقق...' : 'Verifying...'}</span>
                    </>
                  ) : (
                    <>
                      <Users className="w-3.5 h-3.5" />
                      <span>
                        {selectedMemberUser
                          ? (isArabic ? `تأكيد وإضافة ${selectedMemberUser.name || 'العضو'}` : `Confirm & Add ${selectedMemberUser.name || 'Member'}`)
                          : (isArabic ? 'إرسال الدعوة' : 'Send Invite')}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Full Member Management (Item 7) */}
      {isManageMembersOpen && (
        <div
          role="dialog"
          className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/80 backdrop-blur-sm animate-in fade-in overscroll-contain"
          onClick={() => setIsManageMembersOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90dvh] my-auto flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {isArabic ? 'إدارة الأعضاء والطلبات' : 'Manage Members & Requests'}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {activeOverlaidMembers.length} {isArabic ? 'أعضاء في هذه المشاركة' : 'members in this share'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isOwner && activeOverlaidMembers.length > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      const confirmed = await showConfirm({
                        title: isArabic ? 'إفراغ جميع الأعضاء' : 'Remove All Members',
                        message: isArabic
                          ? 'هل تريد بالتأكيد إزالة جميع الأعضاء من صفحة المشاركة هذه والبدء من جديد؟'
                          : 'Are you sure you want to remove all members from this share and start fresh?',
                        confirmLabel: isArabic ? 'نعم، إفراغ الكل' : 'Remove All',
                        cancelLabel: isArabic ? 'تراجع' : 'Cancel',
                        isDanger: true,
                      });
                      if (!confirmed) return;
                      const res = await removeAllMembersFromShareFolder(folder.id);
                      if (res.success && res.folder) {
                        setFolder(res.folder);
                        showToast(isArabic ? 'تمت إزالة جميع الأعضاء بنجاح' : 'All members removed', 'success');
                      }
                    }}
                    className="text-[11px] text-red-400 hover:text-red-300 font-semibold px-2 py-1 rounded-lg bg-red-950/30 hover:bg-red-900/40 border border-red-500/20 transition cursor-pointer"
                  >
                    {isArabic ? 'إفراغ الأعضاء' : 'Clear All'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsManageMembersOpen(false)}
                  className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 overscroll-contain">
              {/* Owner Display */}
              <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-blue-600/30 border border-blue-500/50 flex items-center justify-center text-sm font-bold text-blue-300 shrink-0 overflow-hidden">
                    {ownerPhoto && isRealPhotoUrl(ownerPhoto) ? (
                      <img src={ownerPhoto} alt={effectiveOwnerName} className="w-full h-full object-cover" />
                    ) : (
                      <span>{effectiveOwnerAvatar || folder.ownerAvatar || '👑'}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate flex items-center gap-2">
                      <span>{effectiveOwnerName}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-semibold">
                        {isArabic ? 'المالك' : 'Owner'}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-400 font-mono mt-0.5">
                      {format16DigitId(folder.ownerNumericId)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Members List */}
              {folder.members.filter(
                (m) =>
                  cleanNumericId(m.numericId) !==
                  cleanNumericId(folder.owner16DigitId || folder.ownerNumericId || '')
              ).length === 0 ? (
                <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800 text-center text-xs text-zinc-400">
                  {isArabic ? 'لا يوجد أعضاء مضافون حتى الآن. اضغط على "إضافة عضو" لمشاركة الصفحة.' : 'No members added yet. Click "Add Member" to share.'}
                </div>
              ) : (
                folder.members
                  .filter(
                    (m) =>
                      cleanNumericId(m.numericId) !==
                      cleanNumericId(folder.owner16DigitId || folder.ownerNumericId || '')
                  )
                  .map((m) => {
                  const isCurrentMember = cleanNumericId(m.numericId) === myCleanNumericId;
                  return (
                    <div
                      key={m.numericId}
                      className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800/90 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-full border border-purple-500/40 flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden bg-gradient-to-tr ${getAvatarColorGradient(
                            m.numericId || m.name
                          )}`}
                        >
                          {m.photoURL && isRealPhotoUrl(m.photoURL) ? (
                            <img src={m.photoURL} alt={m.name} className="w-full h-full object-cover" />
                          ) : m.avatar && m.avatar !== '👤' ? (
                            <span className="text-base">{m.avatar}</span>
                          ) : (
                            <span>{getMemberInitials(m.name, m.numericId)}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                            <span>{m.name}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              {isArabic ? 'نشط' : 'Active'}
                            </span>
                            {isCurrentMember && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
                                {isArabic ? 'أنت' : 'You'}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                            {format16DigitId(m.numericId)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Role Selector / Toggle for Owner */}
                        {isOwner && (
                          <button
                            type="button"
                            onClick={async () => {
                              const nextRole = m.role === 'editor' ? 'viewer' : 'editor';
                              const res = await updateMemberRoleInShareFolder(folder.id, m.numericId, nextRole);
                              if (res.success && res.folder) {
                                setFolder(res.folder);
                                showToast(
                                  isArabic
                                    ? `تم تغيير صلاحية "${m.name}" إلى: ${nextRole === 'editor' ? 'محرر (تعديل)' : 'مشاهد (قراءة فقط)'}`
                                    : `Changed role for "${m.name}" to: ${nextRole === 'editor' ? 'Editor' : 'Viewer'}`,
                                  'info'
                                );
                              }
                            }}
                            className={`px-2 py-1 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-1 ${
                              m.role === 'editor'
                                ? 'bg-blue-950/40 border-blue-500/40 text-blue-300'
                                : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                            }`}
                            title={isArabic ? 'تبديل الصلاحية بين محرر ومشاهد' : 'Toggle between Editor and Viewer'}
                          >
                            <Shield className="w-3 h-3" />
                            <span>{m.role === 'editor' ? (isArabic ? 'محرر' : 'Editor') : (isArabic ? 'مشاهد' : 'Viewer')}</span>
                          </button>
                        )}

                        {/* Read-only Role Badge for Non-Owner */}
                        {!isOwner && (
                          <span
                            className={`px-2 py-1 rounded-xl text-xs font-semibold border flex items-center gap-1 ${
                              m.role === 'editor'
                                ? 'bg-purple-950/40 border-purple-500/40 text-purple-300'
                                : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                            }`}
                          >
                            <Shield className="w-3 h-3" />
                            <span>{m.role === 'editor' ? (isArabic ? 'محرر' : 'Editor') : (isArabic ? 'مشاهد' : 'Viewer')}</span>
                          </span>
                        )}

                        {/* Leave Button for Current Member */}
                        {!isOwner && isCurrentMember && (
                          <button
                            type="button"
                            onClick={handleLeaveShare}
                            className="px-2.5 py-1 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                            title={isArabic ? 'مغادرة المشاركة' : 'Leave Share'}
                          >
                            <LogOut className="w-3 h-3 text-red-400" />
                            <span>{isArabic ? 'مغادرة' : 'Leave'}</span>
                          </button>
                        )}

                        {/* Remove Member for Owner with 5s Undo */}
                        {isOwner && (
                          <button
                            type="button"
                            onClick={async () => {
                              const confirmed = await showConfirm({
                                title: isArabic ? 'استبعاد العضو' : 'Remove Member',
                                message: isArabic
                                  ? `هل تريد بالتأكيد استبعاد العضو "${m.name}" من هذه المشاركة؟`
                                  : `Are you sure you want to remove member "${m.name}" from this share?`,
                                confirmLabel: isArabic ? 'تأكيد الاستبعاد' : 'Confirm',
                                cancelLabel: isArabic ? 'تراجع' : 'Cancel',
                                isDanger: true,
                              });
                              if (!confirmed) return;

                              const backupMember = { ...m };
                              const res = await removeMemberFromShareFolder(folder.id, m.numericId);
                              if (res.success && res.folder) {
                                setFolder(res.folder);
                                showToast(
                                  isArabic ? `تم استبعاد "${m.name}" بنجاح` : `Member "${m.name}" removed`,
                                  'info',
                                  {
                                    label: isArabic ? 'تراجع' : 'Undo',
                                    onClick: async () => {
                                      await addMemberToShareFolder(folder.id, backupMember.numericId, backupMember.name, backupMember.role);
                                      showToast(isArabic ? 'تمت استعادة العضو بنجاح' : 'Member restored', 'success');
                                    },
                                  },
                                  5000
                                );
                              }
                            }}
                            className="p-1.5 rounded-xl bg-red-950/30 hover:bg-red-900/40 text-red-400 border border-red-500/30 transition cursor-pointer"
                            title={isArabic ? 'استبعاد العضو' : 'Remove Member'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setIsManageMembersOpen(false);
                  setIsAddMemberOpen(true);
                }}
                className="w-full py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>{isArabic ? 'إضافة عضو جديد بالمعرّف الرقمي' : 'Add New Member by ID'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Pre-Delete Review with Overlap Detection & Empty Entity Smart Cleanup */}
      {preDeleteState && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[85] flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/85 backdrop-blur-md animate-in fade-in overscroll-contain"
          onClick={() => setPreDeleteState(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[92dvh] overflow-y-auto my-auto bg-zinc-950 border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 relative"
            dir={isArabic ? 'rtl' : 'ltr'}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    {isArabic ? 'مراجعة العناصر قبل الحذف' : 'Pre-Delete Review'}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {isArabic ? 'أنت بصدد حذف:' : 'Deleting:'}{' '}
                    <span className="font-semibold text-zinc-200">
                      {preDeleteState.targetIcon || ''} {preDeleteState.targetName}
                    </span>{' '}
                    <span className="text-[11px] text-zinc-500">
                      ({preDeleteState.targetType === 'account'
                        ? isArabic ? 'حساب' : 'Account'
                        : preDeleteState.targetType === 'category'
                        ? isArabic ? 'تصنيف' : 'Category'
                        : isArabic ? 'معاملة' : 'Transaction'})
                    </span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreDeleteState(null)}
                className="p-1.5 rounded-full hover:bg-zinc-850 text-zinc-400 hover:text-white transition cursor-pointer"
                title={isArabic ? 'إغلاق' : 'Close'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Overlap Summary Warning if any overlapping transactions exist */}
            {preDeleteState.candidates.some((c) => c.overlappingWith.length > 0) && (
              <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-amber-300 text-xs leading-relaxed flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <div>
                  <div className="font-bold">
                    {isArabic ? 'تنبيه المعاملات المتداخلة / المشتركة:' : 'Overlapping / Shared Transactions Warning:'}
                  </div>
                  <div>
                    {isArabic
                      ? 'بعض المعاملات أدناه مرتبطة بحسابات أو تصنيفات أخرى مضمنة بالشير. تم تمييزها بشارة تحذير باللون البرتقالي لتراجعها بدقة قبل التأكيد.'
                      : 'Some transactions below link to other included accounts or categories in this share. They are highlighted with an orange warning badge for careful review.'}
                  </div>
                </div>
              </div>
            )}

            {/* Candidate Transactions List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>
                  {isArabic ? 'المعاملات المتأثرة بالحذف' : 'Transactions Affected by Deletion'}{' '}
                  ({preDeleteState.selectedTxIds.size} / {preDeleteState.candidates.length})
                </span>
                {preDeleteState.candidates.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (preDeleteState.selectedTxIds.size === preDeleteState.candidates.length) {
                        setPreDeleteState((prev) => (prev ? { ...prev, selectedTxIds: new Set() } : null));
                      } else {
                        setPreDeleteState((prev) =>
                          prev
                            ? {
                                ...prev,
                                selectedTxIds: new Set(prev.candidates.map((c) => c.tx.id)),
                              }
                            : null
                        );
                      }
                    }}
                    className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                  >
                    {preDeleteState.selectedTxIds.size === preDeleteState.candidates.length
                      ? (isArabic ? 'إلغاء تحديد الكل' : 'Deselect All')
                      : (isArabic ? 'تحديد الكل' : 'Select All')}
                  </button>
                )}
              </div>

              {preDeleteState.candidates.length === 0 ? (
                <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-center text-xs text-zinc-400">
                  {isArabic
                    ? 'لا توجد معاملات مسجلة مرتبطة بهذا العنصر في هذه المساحة المشتركة.'
                    : 'No recorded transactions associated with this entity in this share.'}
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {preDeleteState.candidates.map(({ tx, overlappingWith }) => {
                    const isChecked = preDeleteState.selectedTxIds.has(tx.id);
                    const hasOverlap = overlappingWith.length > 0;

                    return (
                      <div
                        key={tx.id}
                        onClick={() => {
                          setPreDeleteState((prev) => {
                            if (!prev) return null;
                            const nextSet = new Set(prev.selectedTxIds);
                            if (nextSet.has(tx.id)) {
                              nextSet.delete(tx.id);
                            } else {
                              nextSet.add(tx.id);
                            }
                            return { ...prev, selectedTxIds: nextSet };
                          });
                        }}
                        className={`p-3 rounded-2xl border transition cursor-pointer select-none space-y-1.5 ${
                          isChecked
                            ? 'bg-zinc-900/90 border-zinc-700'
                            : 'bg-zinc-950/40 border-zinc-850 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-0 bg-zinc-800 border-zinc-700"
                            />
                            <span className="text-base">{tx.type === 'transfer' ? '⇄' : tx.categoryIcon || '💸'}</span>
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-white block truncate">
                                {tx.type === 'transfer'
                                  ? `${isArabic ? 'تحويل' : 'Transfer'}: ${tx.fromAccountName || (folder.payload.accounts?.find(a => a.id === tx.accountId)?.name) || 'Account'} → ${tx.toAccountName || (folder.payload.accounts?.find(a => a.id === tx.toAccountId)?.name) || 'Account'}`
                                  : (tx.description || tx.categoryName)}
                              </span>
                              <span className="text-[10px] font-mono text-zinc-500">
                                {tx.date} {tx.time ? `· ${formatTime12h(tx.time, isArabic ? 'ar' : 'en')}` : ''}
                              </span>
                            </div>
                          </div>

                          <div className="text-xs font-mono font-bold shrink-0">
                            <span className={tx.type === 'income' ? 'text-emerald-400' : tx.type === 'expense' ? 'text-red-400' : 'text-blue-400'}>
                              {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                              {formatCurrency(tx.amount, currencySymbol, isArabic ? 'ar' : 'en')}
                            </span>
                          </div>
                        </div>

                        {/* Overlap Badge */}
                        {hasOverlap && (
                          <div className="flex flex-wrap gap-1 pt-1 rtl:pr-6 ltr:pl-6">
                            {overlappingWith.map((ov, oIdx) => (
                              <span
                                key={oIdx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-950/60 border border-amber-500/50 text-[10px] font-semibold text-amber-300"
                              >
                                <AlertTriangle className="w-2.5 h-2.5" />
                                <span>
                                  {isArabic ? 'مشتركة مع' : 'Shared with'}: {ov.icon} {ov.name}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Automatic Cleanup Info Banner (Requirement 4) */}
            <div className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-[11px] text-zinc-400 leading-relaxed flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span>
                {isArabic
                  ? 'تنظيف تلقائي ذكي: في حال تم حذف جميع المعاملات التابعة لأي حساب أو تصنيف داخل الشير، فسيتم حذفه تلقائياً من المساحة لمنع وجود عناصر فارغة.'
                  : 'Smart auto-cleanup: If all transactions belonging to an Account or Category inside this share are deleted, it will be automatically removed from the Share Space.'}
              </span>
            </div>

            {/* Delete from Personal Feed Checkbox: Only shown if Space Owner OR transaction exists in personal local account */}
            {shouldShowPersonalDeleteChoice && (
              <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-zinc-900/40 border border-zinc-850 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={preDeleteState.deleteFromPersonal}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setPreDeleteState((prev) => (prev ? { ...prev, deleteFromPersonal: val } : null));
                  }}
                  className="w-4 h-4 rounded text-red-600 focus:ring-0 bg-zinc-800 border-zinc-700"
                />
                <div className="text-xs">
                  <span className="font-bold text-zinc-200 block">
                    {isArabic ? 'حذف المعاملات أيضاً من حسابي الشخصي' : 'Also delete transactions from my personal account'}
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    {isArabic
                      ? 'إذا لم يتم التحديد، فستُحذف فقط من الشير وتبقى آمنة في سجلك الشخصي'
                      : 'If unchecked, items will be removed only from this share and remain safe in your feed'}
                  </span>
                </div>
              </label>
            )}

            {/* Modal Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setPreDeleteState(null)}
                className="flex-1 py-2.5 rounded-2xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 text-xs font-bold transition cursor-pointer"
              >
                {isArabic ? 'إلغاء وتراجع' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmPreDelete}
                className="flex-1 py-2.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition cursor-pointer shadow-lg flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isArabic ? 'تأكيد الحذف' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Share Space Settings Modal - High Priority Layer */}
      {activeSettingsSpace && (
        <ShareSpaceSettingsModal
          isOpen={!!activeSettingsSpace}
          onClose={handleCloseEditSpace}
          folder={activeSettingsSpace}
          onUpdated={(updated) => {
            setFolder(updated);
            handleCloseEditSpace();
          }}
          onDeleted={() => {
            handleCloseEditSpace();
            onExit();
          }}
        />
      )}
    </div>
  );
};
