import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import { debouncedPersist, flushOfflineQueue } from '../utils/persistQueue';

/**
 * Wraps every mutator in a permanently stable callback (useCallback with [] deps) that always
 * delegates to the latest implementation via a ref. This gives consumers referentially stable
 * functions (no re-render cascades) while completely avoiding stale-closure bugs.
 */
function useStableCallbacks<T extends Record<string, (...args: any[]) => any>>(fns: T): T {
  const latestRef = useRef(fns);
  latestRef.current = fns;
  const stableRef = useRef<T | null>(null);
  if (!stableRef.current) {
    const out = {} as Record<string, (...args: any[]) => any>;
    Object.keys(fns).forEach((key) => {
      out[key] = (...args: any[]) => latestRef.current[key](...args);
    });
    stableRef.current = out as T;
  }
  return stableRef.current;
}
import {
  Account,
  Category,
  Transaction,
  AppSettings,
  PeriodFilterType,
  DateRange,
  AdvancedFilter,
  AppData,
  TabType,
  RecurringTransaction,
  Tombstone,
  BudgetAdjustment,
} from '../types';
import {
  loadRecurringTransactions,
  saveRecurringTransactions,
  checkAndProcessRecurring,
  getNextScheduledOccurrence,
  buildOccurrenceKey,
  deriveTransactionOccurrenceKeys,
  isTransactionTombstoned,
  migrateRecurringRule,
} from '../utils/recurring';
import {
  loadSecuritySettings,
  isSessionUnlocked,
  setSessionUnlocked,
  isAppLockActive,
  recordAppBackground,
  shouldAppLockOnForeground,
  resetSessionLockState,
  recordSuccessfulUnlock,
} from '../utils/security';
import { evaluateBudgetAlerts, BudgetAlert } from '../utils/budgetAlerts';
import {
  loadInitialData,
  saveAccounts,
  saveCategories,
  saveTransactions,
  saveSettings,
  CustomImportConfig,
  executeCustomDataImport,
} from '../utils/storage';
import { requestPersistentStorage, loadFullDataFromIndexedDB, saveItemToIndexedDB, savePreMigrationSnapshot } from '../utils/indexedDB';
import { migrateSmartBudgetSettingsToUnifiedCycle, getSalaryCycleRange } from '../utils/smartBudgetEngine';
import { ensureBankFeesCategory, buildLinkedTransferFeeTransaction, roundHalfUpToCents } from '../utils/transferFee';
import { syncAllAccountBalances, getHistoricalBalance } from '../utils/balanceEngine';
import { formatDateToYYYYMMDD, formatTimeToHHMM } from '../utils/dateCycle';
import { translations } from '../utils/translations';
import { DEFAULT_SETTINGS } from '../utils/constants';
import { CURRENT_APP_VERSION } from '../utils/versionChecker';
import { ConfirmDialogOptions, PromptDialogOptions } from '../components/CustomDialogModal';
import { getOrCreateNumericId, syncNumericIdToFirebase, resolvePermanent16DigitId, cleanNumericId, clearUserIdentityState } from '../utils/userId';
import { auth, checkAndHandleGoogleRedirect, getCachedAuthUser, setCachedAuthUser, subscribeToCloudBackup, logoutUser, rtdb, getGoogleDriveAccessToken } from '../utils/firebase';
import { ref, get, onValue, off, DataSnapshot } from 'firebase/database';
import {
  FullAppBackupPayload,
  executeDualCloudBackup,
  fetchDualCloudBackup,
  scheduleDualCloudBackup,
  setCloudBackupBlocked,
  isCloudBackupBlockedStatus,
  persistDriveResolutionStatus,
  syncNow,
  hasUserData,
  fetchCloudAccountSnapshot,
  writeV4ResolvedState,
  purgeObsoleteLegacyServerNodes,
  writeGranularDelta,
  writeGranularManifest,
  writeGranularDeletion,
  loadLocalTombstones,
  saveLocalTombstone,
  attachV4LiveListeners,
  loadGranularDirtyQueue,
  saveGranularDirtyQueue,
  enqueueGranularDirtyItem,
  removeGranularDirtyItem,
  hasGranularDirtyItems,
  clearGranularDirtyQueue,
  flushGranularDirtyQueue,
  pullLatestRemoteState,
} from '../utils/autoBackup';
import { fetchGeminiApiKeyFromCloud, removeLocalGeminiApiKeyOnSignOut } from '../utils/geminiApiKey';
import { clearInMemorySharedApiKey } from '../utils/smartBudgetAI';

export type SyncStatus = 'syncing' | 'online' | 'offline' | 'awaiting_choice' | 'local_only';

export interface SyncConflictData {
  uid: string;
  cloudBackup: any;
  cloudProvider: 'google_drive' | 'firebase';
  localCount: number;
  cloudCount: number;
  cloudAccountsCount: number;
}
import { decodeShareSnapshot } from '../utils/sharing';
import {
  publishUserProfileCard,
  syncShareFoldersWithMainData,
  subscribeToMyInbox,
  fetchMyInboxOnce,
  loadMyShareFolders,
  saveMyShareFolders,
  loadReceivedShareFolders,
  saveReceivedShareFolders,
  fetchShareFolderFromCloud,
  registerReceivedShareFolder,
  ShareFolder,
  getSeenShareNotificationHashes,
  computeShareNotificationHash,
  markShareNotificationsSeen,
  normalizeShareId,
  getNotifiedShareIdsForever,
  markShareIdsNotifiedForever,
  isShareIdNotifiedForever,
  getNotifiedShareIdsPerm,
  markShareIdsNotifiedPerm,
  isShareIdNotifiedPerm,
  getDismissedShareIds,
  isShareDismissed,
  repairAndMigrateSharedSpaces,
  saveShareFolder,
  propagateUserProfileToAllSharedSpaces,
  executeOneTimeV3ShareCleanReset,
  syncCloudNotifiedSharesToLocal,
  isShareNotifiedEverywhere,
  recordShareNotifiedEverywhere,
  recordShareNotifiedSynchronously,
  shouldNotifyIncomingShareOnce,
  isSpaceOwnedByUser,
  setShareModalOpenState,
  propagateTransactionToLinkedSpaces,
  subscribeToActiveSpacesTransactions,
} from '../utils/shareFolders';

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
}

interface AppContextType {
  // Core Data
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  settings: AppSettings;

  // Active Navigation & View
  currentTab: TabType;
  setCurrentTab: (tab: TabType) => void;
  isHeaderVisible: boolean;
  setIsHeaderVisible: (visible: boolean) => void;
  homeSubView: 'daily' | 'calendar';
  setHomeSubView: (view: 'daily' | 'calendar') => void;
  selectedAccountId: string | null;
  setSelectedAccountId: (id: string | null) => void;

  // Filter & Periods
  periodFilter: PeriodFilterType;
  setPeriodFilter: (p: PeriodFilterType) => void;
  periodOffset: number;
  setPeriodOffset: (offset: number | ((prev: number) => number)) => void;
  customDateRange: DateRange;
  setCustomDateRange: (range: DateRange) => void;
  advancedFilter: AdvancedFilter;
  setAdvancedFilter: (filter: AdvancedFilter) => void;
  clearAdvancedFilter: () => void;

  // Modals & Sheets
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  isAddTxModalOpen: boolean;
  defaultTxAccountId?: string;
  defaultTxAmount?: number;
  defaultTxIsRecurring?: boolean;
  openAddTxModal: (defaultAccountId?: string, initialAmount?: number, initialIsRecurring?: boolean) => void;
  executeManualRecurringRules: (ruleIds: string[]) => number;
  processDueRecurring: (showUserToast?: boolean) => number;
  closeAddTxModal: () => void;
  editingTx: Transaction | null;
  openEditTxModal: (tx: Transaction) => void;
  closeEditTxModal: () => void;
  editingRecurring: RecurringTransaction | null;
  openEditRecurringModal: (rule: RecurringTransaction) => void;
  applyRecurringRuleEdit: (rule: RecurringTransaction, scope: 'future' | 'all') => number;
  viewingTx: Transaction | null;
  openTxDetailsModal: (tx: Transaction) => void;
  closeTxDetailsModal: () => void;
  isAccountModalOpen: boolean;
  editingAccount: Account | null;
  openAddAccountModal: () => void;
  openEditAccountModal: (acc: Account) => void;
  closeAccountModal: () => void;
  isCategoryModalOpen: boolean;
  editingCategory: Category | null;
  defaultCategoryType: 'expense' | 'income';
  openAddCategoryModal: (defaultType?: 'expense' | 'income') => void;
  openEditCategoryModal: (cat: Category) => void;
  closeCategoryModal: () => void;
  isUserProfileModalOpen: boolean;
  setIsUserProfileModalOpen: (open: boolean) => void;
  isResetPeriodModalOpen: boolean;
  setIsResetPeriodModalOpen: (open: boolean) => void;
  isFilterModalOpen: boolean;
  setIsFilterModalOpen: (open: boolean) => void;
  isFeaturesModalOpen: boolean;
  setIsFeaturesModalOpen: (open: boolean) => void;
  isWhatsNewOpen: boolean;
  setIsWhatsNewOpen: (open: boolean) => void;
  isRecurringModalOpen: boolean;
  setIsRecurringModalOpen: (open: boolean) => void;
  isPinModalOpen: boolean;
  setIsPinModalOpen: (open: boolean) => void;
  isSmartBudgetModalOpen: boolean;
  setIsSmartBudgetModalOpen: (open: boolean) => void;

  // Security & Biometric Lock
  isAppLocked: boolean;
  setIsAppLocked: (locked: boolean) => void;
  unlockApp: () => void;
  lockApp: () => void;

  // Recurring Transactions
  recurringTransactions: RecurringTransaction[];
  addRecurringTransaction: (rec: Omit<RecurringTransaction, 'id' | 'createdAt'>) => void;
  updateRecurringTransaction: (rec: RecurringTransaction) => void;
  deleteRecurringTransaction: (id: string) => void;

  // Smart Budget Alerts
  budgetAlerts: BudgetAlert[];
  dismissBudgetAlert: (categoryId: string) => void;
  dismissedAlertIds: string[];

  // Emoji Picker
  isEmojiPickerOpen: boolean;
  openEmojiPicker: (onSelect: (emoji: string) => void) => void;
  closeEmojiPicker: () => void;
  selectEmoji: (emoji: string) => void;

  // Transactions CRUD
  addTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => void;
  updateTransaction: (tx: Transaction) => void;
  deleteTransaction: (id: string) => void;

  // Accounts CRUD
  addAccount: (acc: Omit<Account, 'id' | 'balance'>, initialBalance?: number) => void;
  updateAccount: (acc: Account, newBalance?: number) => void;
  deleteAccount: (id: string) => boolean;
  reorderAccounts: (ordered: string[] | Account[]) => void;

  // Shared Accounts Hub Modal
  isSharedHubModalOpen: boolean;
  setIsSharedHubModalOpen: (open: boolean) => void;
  isEditingSpace: boolean;
  setIsEditingSpace: (val: boolean) => void;
  editingShareId: string | null;
  setEditingShareId: (id: string | null) => void;

  // Categories CRUD
  addCategory: (cat: Omit<Category, 'id'>) => void;
  updateCategory: (cat: Category) => void;
  deleteCategory: (id: string) => void;
  reorderCategories: (orderedIds: string[]) => void;

  // Unified Multi-Select Across All Tabs
  isGlobalMultiSelect: boolean;
  clearGlobalSelection: () => void;
  selectedTxIds: string[];
  isTxMultiSelect: boolean;
  startTxMultiSelect: (initialId?: string) => void;
  toggleTxSelection: (id: string) => void;
  toggleBatchTxs: (ids: string[]) => void;
  selectAllTxs: (ids: string[]) => void;
  clearTxSelection: () => void;
  deleteSelectedTxs: () => void;
  batchAssignCategory: (txIds: string[], category: Category) => void;

  // Multi-Select for Accounts (Item 7)
  selectedAccountIds: string[];
  isAccountMultiSelect: boolean;
  startAccountMultiSelect: (initialId?: string) => void;
  toggleAccountSelection: (id: string) => void;
  selectAllAccounts: (ids: string[]) => void;
  clearAccountSelection: () => void;
  deleteAccountWithBalanceTransfer: (id: string, transferTargetAccountId?: string) => boolean;
  deleteMultipleAccounts: (ids: string[], transferTargetAccountId?: string) => boolean;

  // Unified Share Folder Modal System (Item 6)
  shareModalState: {
    isOpen: boolean;
    accounts?: Account[];
    categories?: Category[];
    transactions?: Transaction[];
  };
  openShareModal: (items: { accounts?: Account[]; categories?: Category[]; transactions?: Transaction[] }) => void;
  closeShareModal: () => void;

  // Remaining Balance Resolution Modal (Item 8)
  remainingBalanceModalState: {
    isOpen: boolean;
    accounts: Account[];
    onConfirmDelete: (targetAccountId?: string) => void;
  } | null;
  openRemainingBalanceModal: (accounts: Account[], onConfirmDelete: (targetAccountId?: string) => void) => void;
  closeRemainingBalanceModal: () => void;

  // Multi-Select for Categories
  selectedCategoryIds: string[];
  isCategoryMultiSelect: boolean;
  startCategoryMultiSelect: (initialId?: string) => void;
  toggleCategorySelection: (id: string) => void;
  selectAllCategories: (ids: string[]) => void;
  clearCategorySelection: () => void;
  deleteSelectedCategories: () => void;

  // Settings & Reset
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  applyPeriodReset: (type: 'now' | 'custom' | 'revert', customDate?: string) => void;
  signOutUser: () => Promise<void>;

  // Backup & Restore
  importFullData: (data: AppData) => boolean;
  importSingleAccountData: (importedAccount: Account, importedTxs: Transaction[]) => boolean;
  importCustomData: (payload: any, config: CustomImportConfig) => Promise<boolean>;
  importSharedItems: (payload: {
    accounts?: Account[];
    categories?: Category[];
    transactions?: Transaction[];
    targetAccountId?: string;
  }) => { accountsCount: number; categoriesCount: number; txsCount: number };
  triggerCloudBackupNow: () => Promise<{ provider: 'google_drive' | 'firebase'; success: boolean }>;
  triggerCloudRestoreNow: () => Promise<boolean>;
  pendingSyncConflict: SyncConflictData | null;
  pendingCloudBackup: any | null;
  resolveSyncConflict: (choice: 'replace' | 'merge') => Promise<void>;

  // Toasts
  toasts: ToastItem[];
  showToast: (
    message: string,
    type?: 'success' | 'error' | 'info',
    action?: { label: string; onClick: () => void },
    duration?: number
  ) => void;
  dismissToast: (id: string) => void;

  // Custom Dialogs (Replaces browser confirm/prompt/alert)
  showConfirm: (options: ConfirmDialogOptions) => Promise<boolean>;
  showPrompt: (options: PromptDialogOptions) => Promise<string | null>;
  customDialogState: {
    type: 'confirm' | 'prompt';
    options: ConfirmDialogOptions | PromptDialogOptions;
    resolve: (value: any) => void;
  } | null;
  closeCustomDialog: () => void;

  // Sub-pages and Deep Navigation
  activeShareDetailFolder: any | null;
  setActiveShareDetailFolder: (folder: any | null) => void;
  selectedFeatureId: string | null;
  setSelectedFeatureId: (id: string | null) => void;
  featureGuideLayout: 'grid' | 'split' | 'preview' | 'full';
  setFeatureGuideLayout: (layout: 'grid' | 'split' | 'preview' | 'full') => void;

  // Seamless Shared Account Live View Switcher
  activeSharedId: string | null;
  setActiveSharedId: (id: string | null) => void;
  activeSharedSnapshot: any | null;
  setActiveSharedSnapshot: (snapshot: any | null) => void;
  openSharedLiveView: (id?: string, snapshot?: any) => void;
  closeSharedLiveView: () => void;

  // Cloud Sync Status Indicator
  syncStatus: SyncStatus;
  lastSyncedAt: number | null;

  // Localization
  t: (key: keyof typeof translations.en) => string;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [initialData] = useState(() => loadInitialData());

  const [accounts, setAccounts] = useState<Account[]>(initialData.accounts);
  const [categories, setCategories] = useState<Category[]>(initialData.categories);
  const [transactions, setTransactions] = useState<Transaction[]>(initialData.transactions);
  const [settings, setSettings] = useState<AppSettings>(() => {
    const s = initialData.settings;
    const numId = getOrCreateNumericId(s.userProfile?.numericId);
    return {
      ...s,
      userProfile: {
        ...s.userProfile,
        numericId: numId,
      },
    };
  });

  const isArabic = settings.language === 'ar';

  // Nav
  const [currentTab, setCurrentTab] = useState<TabType>('home');
  const [isHeaderVisible, setIsHeaderVisible] = useState<boolean>(true);
  const [homeSubView, setHomeSubView] = useState<'daily' | 'calendar'>('daily');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  // Period filters
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterType>('app_month');
  const [periodOffset, setPeriodOffset] = useState<number>(0);
  const [customDateRange, setCustomDateRange] = useState<DateRange>({
    startDate: formatDateToYYYYMMDD(new Date()),
    endDate: formatDateToYYYYMMDD(new Date()),
  });

  const [advancedFilter, setAdvancedFilter] = useState<AdvancedFilter>({
    accountIds: [],
    categoryIds: [],
    minAmount: undefined,
    maxAmount: undefined,
    type: 'all',
    searchQuery: undefined,
  });

  // Modals
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAddTxModalOpen, setIsAddTxModalOpen] = useState(false);
  const [defaultTxAccountId, setDefaultTxAccountId] = useState<string | undefined>(undefined);
  const [defaultTxAmount, setDefaultTxAmount] = useState<number | undefined>(undefined);
  const [defaultTxIsRecurring, setDefaultTxIsRecurring] = useState<boolean>(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editingRecurring, setEditingRecurring] = useState<RecurringTransaction | null>(null);
  const [viewingTx, setViewingTx] = useState<Transaction | null>(null);

  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [defaultCategoryType, setDefaultCategoryType] = useState<'expense' | 'income'>('expense');

  const [isUserProfileModalOpen, setIsUserProfileModalOpen] = useState(false);
  const [isResetPeriodModalOpen, setIsResetPeriodModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isFeaturesModalOpen, setIsFeaturesModalOpen] = useState(false);
  const [isWhatsNewOpen, setIsWhatsNewOpen] = useState(false);
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isSmartBudgetModalOpen, setIsSmartBudgetModalOpen] = useState(false);
  const [isSharedHubModalOpen, setIsSharedHubModalOpen] = useState(false);
  const [isEditingSpace, setIsEditingSpace] = useState(false);
  const [editingShareId, setEditingShareId] = useState<string | null>(null);

  // Recurring transactions state
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>(() =>
    loadRecurringTransactions()
  );

  // App Lock & Biometrics state
  const [isAppLocked, setIsAppLocked] = useState<boolean>(() => {
    return isAppLockActive();
  });

  // Cloud Sync & Dual-Layer Hydration Engine
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  const isCloudHydratedRef = useRef(false);
  const isHydratingCloudRef = useRef(false);
  const lastRestoredUidRef = useRef<string | null>(null);
  const isSyncUnlockedRef = useRef<boolean>(false);
  const isApplyingRemoteSyncRef = useRef<boolean>(false);
  const unsubV4ListenersRef = useRef<(() => void) | null>(null);
  const unsubRemoteBackupRef = useRef<(() => void) | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(() => {
    try {
      const stored = localStorage.getItem('mm_last_sync_timestamp');
      return stored ? Number(stored) : Date.now();
    } catch {
      return Date.now();
    }
  });
  const [dirtyCount, setDirtyCount] = useState<number>(() => {
    try {
      return Object.keys(loadGranularDirtyQueue()).length;
    } catch {
      return 0;
    }
  });
  const [isDeviceOnline, setIsDeviceOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isConnectedToRtdb, setIsConnectedToRtdb] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const inFlightSyncCountRef = useRef(0);
  const [inFlightSyncCount, setInFlightSyncCount] = useState(0);
  const syncSafetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    (window as any).__isSyncFlushRunning = isSyncing || inFlightSyncCount > 0;
  }, [isSyncing, inFlightSyncCount]);

  const triggerGranularPush = useCallback(async (fn: () => Promise<void>) => {
    inFlightSyncCountRef.current++;
    setInFlightSyncCount(inFlightSyncCountRef.current);

    if (syncSafetyTimeoutRef.current) {
      clearTimeout(syncSafetyTimeoutRef.current);
    }
    syncSafetyTimeoutRef.current = setTimeout(() => {
      inFlightSyncCountRef.current = 0;
      setInFlightSyncCount(0);
      setIsSyncing(false);
    }, 15000);

    try {
      await fn();
    } catch (err) {
      console.warn('[Sync] Push delta error:', err);
    } finally {
      inFlightSyncCountRef.current = Math.max(0, inFlightSyncCountRef.current - 1);
      setInFlightSyncCount(inFlightSyncCountRef.current);
      if (inFlightSyncCountRef.current === 0 && syncSafetyTimeoutRef.current) {
        clearTimeout(syncSafetyTimeoutRef.current);
        syncSafetyTimeoutRef.current = null;
      }
      try {
        setDirtyCount(Object.keys(loadGranularDirtyQueue()).length);
        const nowTime = Date.now();
        setLastSyncedAt(nowTime);
        localStorage.setItem('mm_last_sync_timestamp', String(nowTime));
      } catch {}
    }
  }, []);

  const recordSyncActivity = useCallback(() => {
    try {
      setDirtyCount(Object.keys(loadGranularDirtyQueue()).length);
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        const nowTime = Date.now();
        setLastSyncedAt(nowTime);
        localStorage.setItem('mm_last_sync_timestamp', String(nowTime));
      }
    } catch {}
  }, []);

  const [pendingSyncConflict, setPendingSyncConflict] = useState<SyncConflictData | null>(null);
  const [pendingCloudBackup, setPendingCloudBackup] = useState<any | null>(null);
  const pendingCloudBackupRef = useRef<any | null>(null);
  pendingCloudBackupRef.current = pendingCloudBackup;
  const pendingSyncConflictRef = useRef<SyncConflictData | null>(null);
  pendingSyncConflictRef.current = pendingSyncConflict;

  // Single derived source of truth for cloud synchronization status
  const syncStatus: SyncStatus = useMemo(() => {
    if (!auth.currentUser && !getCachedAuthUser()) {
      return 'local_only';
    }
    if (pendingSyncConflict) {
      return 'awaiting_choice';
    }
    const isOnline = isDeviceOnline && (typeof navigator !== 'undefined' ? navigator.onLine : true);
    if (!isOnline || !isConnectedToRtdb) {
      return 'offline';
    }
    if (isSyncing || inFlightSyncCount > 0 || dirtyCount > 0) {
      return 'syncing';
    }
    return 'online';
  }, [
    pendingSyncConflict,
    isDeviceOnline,
    isConnectedToRtdb,
    isSyncing,
    inFlightSyncCount,
    dirtyCount,
  ]);

  // References to keep data accessible synchronously in async auth callbacks
  const transactionsRef = useRef(transactions);
  transactionsRef.current = transactions;
  const accountsRef = useRef(accounts);
  accountsRef.current = accounts;
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;
  const recurringTransactionsRef = useRef(recurringTransactions);
  recurringTransactionsRef.current = recurringTransactions;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Smart Budget Alerts dismissed state
  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>([]);

  // Emoji picker
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [emojiCallback, setEmojiCallback] = useState<((emoji: string) => void) | null>(null);

  // Unified Multi-Select States across all tabs
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [isGlobalMultiSelect, setIsGlobalMultiSelect] = useState<boolean>(false);

  const isAnyMultiSelectActive =
    isGlobalMultiSelect ||
    selectedTxIds.length > 0 ||
    selectedAccountIds.length > 0 ||
    selectedCategoryIds.length > 0;

  const isTxMultiSelect = isAnyMultiSelectActive;
  const isAccountMultiSelect = isAnyMultiSelectActive;
  const isCategoryMultiSelect = isAnyMultiSelectActive;

  const startTxMultiSelect = (initialId?: string) => {
    setIsGlobalMultiSelect(true);
    if (initialId) setSelectedTxIds((prev) => (prev.includes(initialId) ? prev : [...prev, initialId]));
  };

  const toggleTxSelection = (id: string) => {
    setIsGlobalMultiSelect(true);
    setSelectedTxIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleBatchTxs = (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    setIsGlobalMultiSelect(true);
    setSelectedTxIds((prev) => {
      const allSelected = ids.every((id) => prev.includes(id));
      if (allSelected) {
        return prev.filter((id) => !ids.includes(id));
      } else {
        const next = new Set(prev);
        ids.forEach((id) => next.add(id));
        return Array.from(next);
      }
    });
  };

  const selectAllTxs = (ids: string[]) => {
    setIsGlobalMultiSelect(true);
    setSelectedTxIds(ids);
  };

  const releaseScrollLocks = () => {
    if (typeof document !== 'undefined') {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      try {
        window.getSelection()?.removeAllRanges();
      } catch {}
    }
  };

  const clearGlobalSelection = () => {
    setSelectedTxIds([]);
    setSelectedAccountIds([]);
    setSelectedCategoryIds([]);
    setIsGlobalMultiSelect(false);
    releaseScrollLocks();
  };

  const clearTxSelection = clearGlobalSelection;

  /**
   * Writes persistent local and cloud tombstones for BOTH the transaction ID and all derived
   * recurring occurrenceKeys (ruleId + local scheduled date/time, plus deterministic rec_ ID)
   * so deleted recurring occurrences are NEVER recreated on reload, catch-up, restore, or merge.
   */
  const recordTransactionTombstones = (
    txsToDelete: Transaction | Transaction[],
    explicitIds: string[] = []
  ) => {
    const list = Array.isArray(txsToDelete) ? txsToDelete : [txsToDelete];
    const nowTs = syncNow();
    const allKeys = new Set<string>(explicitIds.filter(Boolean));

    for (const tx of list) {
      if (!tx) continue;
      for (const k of deriveTransactionOccurrenceKeys(tx)) {
        if (k) allKeys.add(k);
      }
    }

    for (const key of allKeys) {
      saveLocalTombstone({
        id: key,
        collection: 'transactions',
        deletedAt: nowTs,
      });
    }

    if (auth.currentUser && isSyncUnlockedRef.current) {
      const uid = auth.currentUser.uid;
      for (const key of allKeys) {
        triggerGranularPush(() =>
          writeGranularDeletion(uid, 'transactions', key, isSyncUnlockedRef.current)
        );
      }
    }
  };

  /**
   * Preserves the highest monotonic watermark (effectiveFrom, lastRun, lastProcessed)
   * when merging or restoring recurring rules so an older backup or second device cannot
   * rewind the watermark and resurrect past deleted occurrences.
   */
  const mergeRecurringRuleWatermarks = (
    incoming: RecurringTransaction,
    existing?: RecurringTransaction
  ): RecurringTransaction => {
    const norm = migrateRecurringRule(incoming);
    if (!existing) return norm;
    const maxWatermark = Math.max(
      existing.lastRun || 0,
      existing.lastProcessed || 0,
      norm.lastRun || 0,
      norm.lastProcessed || 0
    );
    const maxEffectiveFrom = Math.max(
      existing.effectiveFrom || 0,
      norm.effectiveFrom || 0
    );
    const baseWinner =
      Number(norm.updatedAt || norm.createdAt || 0) >=
      Number(existing.updatedAt || existing.createdAt || 0)
        ? norm
        : migrateRecurringRule(existing);
    const nextWatermarked: RecurringTransaction = {
      ...baseWinner,
      effectiveFrom: maxEffectiveFrom > 0 ? maxEffectiveFrom : baseWinner.effectiveFrom,
      lastRun: maxWatermark > 0 ? maxWatermark : baseWinner.lastRun,
      lastProcessed: maxWatermark > 0 ? maxWatermark : baseWinner.lastProcessed,
    };
    if (maxWatermark > 0 || maxEffectiveFrom > 0) {
      const anchorMs = Math.max(maxWatermark, maxEffectiveFrom ? maxEffectiveFrom - 1 : 0);
      const nextOcc = getNextScheduledOccurrence(nextWatermarked, new Date(anchorMs));
      nextWatermarked.nextRun = nextOcc.getTime();
      nextWatermarked.nextDueDate = formatDateToYYYYMMDD(nextOcc);
    }
    return nextWatermarked;
  };

  const compareTxChronologicallyDesc = (a: Transaction, b: Transaction): number => {
    if (a.date !== b.date) return (b.date || '').localeCompare(a.date || '');
    const tCmp = (b.time || '').localeCompare(a.time || '');
    if (tCmp !== 0) return tCmp;
    return (b.createdAt || 0) - (a.createdAt || 0);
  };

  const deleteSelectedTxs = () => {
    if (selectedTxIds.length === 0) return;
    const expandedIds = new Set<string>(selectedTxIds);
    for (const tx of transactions) {
      if (expandedIds.has(tx.id)) {
        if (tx.linkedFeeTxId) expandedIds.add(tx.linkedFeeTxId);
      }
      if (tx.feeOfTransferId && expandedIds.has(tx.feeOfTransferId)) {
        expandedIds.add(tx.id);
      }
    }
    const txsToDelete = transactions.filter((t) => expandedIds.has(t.id));
    const count = txsToDelete.length;
    const deletedFeeParentIds = new Set<string>();
    for (const tx of txsToDelete) {
      if (tx.feeOfTransferId && !expandedIds.has(tx.feeOfTransferId)) {
        deletedFeeParentIds.add(tx.feeOfTransferId);
      }
      propagateTransactionToLinkedSpaces('delete', tx, accounts).catch(() => {});
    }
    const updatedParentsToPush: Transaction[] = [];
    const updatedList = transactions
      .filter((t) => !expandedIds.has(t.id))
      .map((t) => {
        if (deletedFeeParentIds.has(t.id)) {
          const cleared: Transaction = {
            ...t,
            transferFee: undefined,
            transferFeeMode: 'none',
            linkedFeeTxId: undefined,
            updatedAt: Date.now(),
          };
          updatedParentsToPush.push(cleared);
          return cleared;
        }
        return t;
      });
    setTransactions(updatedList);
    const synced = syncAllAccountBalances(accounts, updatedList);
    setAccounts(synced);
    removeLinkedAdjustmentsForTxs(txsToDelete);
    recordTransactionTombstones(txsToDelete, Array.from(expandedIds));
    if (auth.currentUser && isSyncUnlockedRef.current) {
      const uid = auth.currentUser.uid;
      for (const pTx of updatedParentsToPush) {
        triggerGranularPush(() => writeGranularDelta(uid, 'transactions', pTx, isSyncUnlockedRef.current));
      }
    }
    setSelectedTxIds([]);
    showToast(
      settings.language === 'ar' ? `تم حذف ${count} معاملة بنجاح` : `Deleted ${count} transactions successfully!`,
      'success'
    );
  };

  const batchAssignCategory = (txIds: string[], category: Category) => {
    if (txIds.length === 0) return;
    const count = txIds.length;
    const updatedList = transactions.map((tx) => {
      if (txIds.includes(tx.id)) {
        return {
          ...tx,
          categoryId: category.id,
          categoryName: category.name,
          categoryIcon: category.icon,
        };
      }
      return tx;
    });
    setTransactions(updatedList);
    clearTxSelection();
    showToast(
      settings.language === 'ar'
        ? `تم تعيين التصنيف "${category.name}" لـ ${count} معاملة بنجاح!`
        : `Assigned category "${category.name}" to ${count} transactions!`,
      'success'
    );
  };

  // Account Multi-Select (Item 7)
  const startAccountMultiSelect = (initialId?: string) => {
    setIsGlobalMultiSelect(true);
    if (initialId) setSelectedAccountIds((prev) => (prev.includes(initialId) ? prev : [...prev, initialId]));
  };

  const toggleAccountSelection = (id: string) => {
    setIsGlobalMultiSelect(true);
    setSelectedAccountIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAllAccounts = (ids: string[]) => {
    setIsGlobalMultiSelect(true);
    setSelectedAccountIds(ids);
  };

  const clearAccountSelection = clearGlobalSelection;

  // Unified Share Modal (Item 6)
  const [shareModalState, setShareModalState] = useState<{
    isOpen: boolean;
    accounts?: Account[];
    categories?: Category[];
    transactions?: Transaction[];
  }>({ isOpen: false });

  const openShareModal = (items: { accounts?: Account[]; categories?: Category[]; transactions?: Transaction[] }) => {
    setShareModalState({
      isOpen: true,
      accounts: items.accounts,
      categories: items.categories,
      transactions: items.transactions,
    });
  };

  const closeShareModal = () => {
    setShareModalState({ isOpen: false });
  };

  // Keep global modal-open flag synced so remote onValue listeners never overwrite active modal edits
  useEffect(() => {
    const anyShareEditModalOpen = Boolean(shareModalState.isOpen || isEditingSpace);
    if (typeof window !== 'undefined') {
      (window as any).__mmShareModalOpen = anyShareEditModalOpen;
    }
    setShareModalOpenState(anyShareEditModalOpen);
  }, [shareModalState.isOpen, isEditingSpace]);

  // Remaining Balance Modal (Item 8)
  const [remainingBalanceModalState, setRemainingBalanceModalState] = useState<{
    isOpen: boolean;
    accounts: Account[];
    onConfirmDelete: (targetAccountId?: string) => void;
  } | null>(null);

  const openRemainingBalanceModal = (
    accs: Account[],
    onConfirmDelete: (targetAccountId?: string) => void
  ) => {
    setRemainingBalanceModalState({
      isOpen: true,
      accounts: accs,
      onConfirmDelete,
    });
  };

  const closeRemainingBalanceModal = () => {
    setRemainingBalanceModalState(null);
  };

  const deleteAccountWithBalanceTransfer = (id: string, transferTargetAccountId?: string): boolean => {
    if (accounts.length <= 1) {
      showToast(t('cannotDeleteOnlyAccount'), 'error');
      return false;
    }

    const accToDelete = accounts.find((a) => a.id === id);
    if (!accToDelete) return false;

    const directRemovedIds = new Set(
      transactions
        .filter((tx) => tx.accountId === id || tx.toAccountId === id)
        .map((tx) => tx.id)
    );
    const removedTxs = transactions.filter(
      (tx) =>
        directRemovedIds.has(tx.id) ||
        (tx.feeOfTransferId && directRemovedIds.has(tx.feeOfTransferId))
    );
    const removedTxIdSet = new Set(removedTxs.map((tx) => tx.id));
    let updatedTxs = transactions.filter((tx) => !removedTxIdSet.has(tx.id));

    if (transferTargetAccountId && accToDelete.balance !== 0) {
      const now = new Date();
      const transferTx: Transaction = {
        id: `tx_rem_bal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        accountId: transferTargetAccountId,
        type: accToDelete.balance > 0 ? 'income' : 'expense',
        amount: Math.abs(accToDelete.balance),
        date: formatDateToYYYYMMDD(now),
        time: formatTimeToHHMM(now),
        categoryName: 'Remaining Balance Transfer',
        categoryIcon: '🔄',
        description: settings.language === 'ar'
          ? `تحويل الرصيد المتبقي من حساب "${accToDelete.name}" المحذوف`
          : `Remaining balance transferred from deleted account "${accToDelete.name}"`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      updatedTxs.push(transferTx);
    }

    setTransactions(updatedTxs);
    const remainingAccounts = accounts.filter((a) => a.id !== id);
    const synced = syncAllAccountBalances(remainingAccounts, updatedTxs);
    setAccounts(synced);
    removeLinkedAdjustmentsForTxs(removedTxs);
    recordTransactionTombstones(removedTxs);
    saveLocalTombstone({ id, collection: 'accounts', deletedAt: syncNow() });

    if (selectedAccountId === id) {
      setSelectedAccountId(null);
    }

    if (auth.currentUser && isSyncUnlockedRef.current) {
      triggerGranularPush(() => writeGranularDeletion(auth.currentUser!.uid, 'accounts', id, isSyncUnlockedRef.current));
    }

    showToast(t('deletedSuccess'), 'success');
    return true;
  };

  const deleteMultipleAccounts = (ids: string[], transferTargetAccountId?: string): boolean => {
    if (accounts.length - ids.length < 1) {
      showToast(t('cannotDeleteOnlyAccount'), 'error');
      return false;
    }

    const accountsToDelete = accounts.filter((a) => ids.includes(a.id));
    const directMultiRemovedIds = new Set(
      transactions
        .filter((tx) => ids.includes(tx.accountId) || (tx.toAccountId && ids.includes(tx.toAccountId)))
        .map((tx) => tx.id)
    );
    const removedMultiTxs = transactions.filter(
      (tx) =>
        directMultiRemovedIds.has(tx.id) ||
        (tx.feeOfTransferId && directMultiRemovedIds.has(tx.feeOfTransferId))
    );
    const removedMultiIdSet = new Set(removedMultiTxs.map((tx) => tx.id));
    let updatedTxs = transactions.filter((tx) => !removedMultiIdSet.has(tx.id));

    if (transferTargetAccountId) {
      const now = new Date();
      accountsToDelete.forEach((acc) => {
        if (acc.balance !== 0) {
          const transferTx: Transaction = {
            id: `tx_rem_bal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            accountId: transferTargetAccountId,
            type: acc.balance > 0 ? 'income' : 'expense',
            amount: Math.abs(acc.balance),
            date: formatDateToYYYYMMDD(now),
            time: formatTimeToHHMM(now),
            categoryName: 'Remaining Balance Transfer',
            categoryIcon: '🔄',
            description: settings.language === 'ar'
              ? `تحويل الرصيد المتبقي من حساب "${acc.name}" المحذوف`
              : `Remaining balance transferred from deleted account "${acc.name}"`,
            createdAt: Date.now(),
          };
          updatedTxs.push(transferTx);
        }
      });
    }

    setTransactions(updatedTxs);
    const remainingAccounts = accounts.filter((a) => !ids.includes(a.id));
    const synced = syncAllAccountBalances(remainingAccounts, updatedTxs);
    setAccounts(synced);
    removeLinkedAdjustmentsForTxs(removedMultiTxs);
    recordTransactionTombstones(removedMultiTxs);
    const nowTomb = syncNow();
    for (const accId of ids) {
      saveLocalTombstone({ id: accId, collection: 'accounts', deletedAt: nowTomb });
      if (auth.currentUser && isSyncUnlockedRef.current) {
        const uid = auth.currentUser.uid;
        triggerGranularPush(() => writeGranularDeletion(uid, 'accounts', accId, isSyncUnlockedRef.current));
      }
    }

    if (selectedAccountId && ids.includes(selectedAccountId)) {
      setSelectedAccountId(null);
    }

    clearAccountSelection();
    showToast(
      settings.language === 'ar'
        ? `تم حذف ${ids.length} حساب بنجاح!`
        : `Deleted ${ids.length} accounts successfully!`,
      'success'
    );
    return true;
  };

  const startCategoryMultiSelect = (initialId?: string) => {
    setIsGlobalMultiSelect(true);
    if (initialId) setSelectedCategoryIds((prev) => (prev.includes(initialId) ? prev : [...prev, initialId]));
  };

  const toggleCategorySelection = (id: string) => {
    setIsGlobalMultiSelect(true);
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAllCategories = (ids: string[]) => {
    setIsGlobalMultiSelect(true);
    setSelectedCategoryIds(ids);
  };

  const clearCategorySelection = clearGlobalSelection;

  const deleteSelectedCategories = () => {
    if (selectedCategoryIds.length === 0) return;
    const count = selectedCategoryIds.length;
    setCategories((prev) => prev.filter((c) => !selectedCategoryIds.includes(c.id)));
    clearCategorySelection();
    showToast(
      settings.language === 'ar' ? `تم حذف ${count} تصنيف بنجاح` : `Deleted ${count} categories successfully!`,
      'success'
    );
  };

  // Toasts with active deduplication and spam throttling
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const recentToastCooldownRef = useRef<Map<string, number>>(new Map());

  const showToast = useCallback((
    message: string,
    type: 'success' | 'error' | 'info' = 'success',
    action?: { label: string; onClick: () => void },
    duration?: number
  ) => {
    if (!message || !message.trim()) return;
    const cleanMsg = message.trim();
    const now = Date.now();

    // 1. Throttle / Debounce identical messages within 3 seconds
    const lastSeen = recentToastCooldownRef.current.get(cleanMsg) || 0;
    if (now - lastSeen < 3000) {
      return;
    }
    recentToastCooldownRef.current.set(cleanMsg, now);

    // Prune cooldown map to prevent growth
    if (recentToastCooldownRef.current.size > 50) {
      const entries = Array.from(recentToastCooldownRef.current.entries()).slice(-25);
      recentToastCooldownRef.current = new Map(entries);
    }

    // Scale auto-dismiss duration with message length (Math.min(8000, Math.max(3500, message.length * 60)))
    const autoDismissDuration = duration ?? Math.min(8000, Math.max(3500, cleanMsg.length * 60));

    const id = `${now}_${Math.random().toString(36).substring(2, 7)}`;
    setToasts((prev) => {
      // 2. Deduplicate against active toasts on screen
      if (prev.some((t) => t.message.trim() === cleanMsg)) {
        return prev;
      }
      // 3. Keep at most the latest 2 active toasts + new one (max 3)
      const trimmed = prev.slice(-2);
      return [...trimmed, { id, message: cleanMsg, type, action, duration: autoDismissDuration }];
    });

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, autoDismissDuration);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Listen for decoupled app_toast events from background utilities
  useEffect(() => {
    const handleAppToast = (e: any) => {
      if (e?.detail?.message) {
        showToast(e.detail.message, e.detail.type || 'info', e.detail.action, e.detail.duration);
      }
    };
    window.addEventListener('app_toast', handleAppToast);
    return () => window.removeEventListener('app_toast', handleAppToast);
  }, [showToast]);

  // Translation helper
  const t = useCallback(
    (key: keyof typeof translations.en): string => {
      const lang = settings.language || 'en';
      return (translations[lang] && translations[lang][key]) || translations.en[key] || key;
    },
    [settings.language]
  );

  // Initialize Permanent IndexedDB Storage and verify backup
  useEffect(() => {
    // Request permanent browser storage permission
    requestPersistentStorage();

    // Check if IndexedDB has preserved data
    loadFullDataFromIndexedDB()
      .then((idbData) => {
        if (idbData) {
          if (idbData.transactions && idbData.transactions.length > 0 && transactions.length === 0) {
            setTransactions(idbData.transactions);
            if (idbData.accounts && idbData.accounts.length > 0) {
              setAccounts(syncAllAccountBalances(idbData.accounts, idbData.transactions));
            }
          }
          if (idbData.categories && idbData.categories.length > categories.length) {
            setCategories(idbData.categories);
          }
          if (idbData.recurringTransactions && idbData.recurringTransactions.length > 0 && recurringTransactions.length === 0) {
            setRecurringTransactions(idbData.recurringTransactions);
          }
        }
      })
      .catch((err) => console.warn('[Storage] IDB startup check:', err));
  }, []);

  // Sync to localStorage & IndexedDB
  useEffect(() => {
    saveAccounts(accounts);
  }, [accounts]);

  useEffect(() => {
    saveCategories(categories);
  }, [categories]);

  useEffect(() => {
    saveTransactions(transactions);
  }, [transactions]);

  // Auto-synchronize any created Share Pages with live accounts, categories, and transactions
  // and broadcast the updates to Firebase RTDB in real time so external shared pages are 100% live
  useEffect(() => {
    if (!accounts || !transactions || !categories) return;
    const timer = setTimeout(() => {
      syncShareFoldersWithMainData(accounts, categories, transactions);
    }, 200);
    return () => clearTimeout(timer);
  }, [accounts, categories, transactions]);

  // Active global real-time listener for incoming shares to user's 16-digit ID
  // Delivers instant incoming shares without requiring the recipient to refresh!
  useEffect(() => {
    // Execute one-time V3 clean reset of legacy share keys & Firebase nodes
    executeOneTimeV3ShareCleanReset().catch(() => {});

    let isDisposed = false;
    let unsubInbox: (() => void) | null = null;
    let unsubActiveSpaces: (() => void) | null = null;
    let activeCleanId = '';

    const setupListenerForUser = (targetUid?: string) => {
      if (isDisposed) return;
      const activeUid = targetUid || auth.currentUser?.uid || getCachedAuthUser()?.uid || settings.userProfile?.uid || '';
      const isAuthed = Boolean(activeUid);

      // Attempt to resolve clean 16-digit numeric ID from profile, userId utility, or localStorage
      let rawId = settings.userProfile?.numericId || '';
      if (!rawId && isAuthed) {
        rawId = getOrCreateNumericId();
      }
      if (!rawId && typeof localStorage !== 'undefined') {
        try {
          rawId = localStorage.getItem('mm_user_numeric_16_id') || localStorage.getItem('pwa_finance_user_numeric_id') || '';
        } catch {}
      }

      let cleanId = cleanNumericId(rawId || '');

      if (cleanId.length !== 16) {
        if (activeUid) {
          resolvePermanent16DigitId(activeUid)
            .then((resolved) => {
              if (!isDisposed && resolved && cleanNumericId(resolved).length === 16) {
                setupListenerForUser(activeUid);
              }
            })
            .catch(() => {});
        }
        return;
      }

      if (unsubInbox && activeCleanId === cleanId) {
        return; // Already actively subscribed to this exact cleanId
      }

      if (unsubInbox) {
        unsubInbox();
        unsubInbox = null;
      }

      activeCleanId = cleanId;
      repairAndMigrateSharedSpaces(cleanId, activeUid);
      let cloudNotifiedReady = syncCloudNotifiedSharesToLocal(activeUid).catch(() => {});

      const handleDiscoveredShares = (incomingList: ShareFolder[]) => {
        if (!Array.isArray(incomingList) || isDisposed) return;
        const dismissedIds = getDismissedShareIds();
        const liveReceived = incomingList.filter(
          (f) => f && f.id && f.deleted !== true && !dismissedIds.has(normalizeShareId(f.id))
        );

        saveReceivedShareFolders(liveReceived);
        window.dispatchEvent(new CustomEvent('received_shares_updated', { detail: liveReceived }));

        cloudNotifiedReady.then(async () => {
          if (isDisposed) return;
          for (const folder of liveReceived) {
            if (!folder || !folder.id || isDisposed) continue;
            const cleanShareId = normalizeShareId(folder.id);
            if (!cleanShareId) continue;

            const folderOwner16 = cleanNumericId(folder.owner16DigitId || folder.ownerNumericId || '');

            // (1) NEVER notify if cleanId(space.owner16DigitId) === myClean16Id or space.ownerUid === currentUser.uid
            if (
              (activeUid && folder.ownerUid && folder.ownerUid === activeUid) ||
              (folderOwner16 && folderOwner16 === cleanId) ||
              isSpaceOwnedByUser(folder, cleanId, activeUid)
            ) {
              markShareIdsNotifiedForever([cleanShareId]);
              continue;
            }

            // (2) Atomic check against timestamps / 'mm_notified_share_ids_forever' and users/${uid}/notifiedShares
            const shouldFire = await shouldNotifyIncomingShareOnce(folder, cleanId, activeUid);
            if (!shouldFire || isDisposed) continue;

            recordShareNotifiedSynchronously(folder, cleanId, activeUid);

            showToast(
              settings.language === 'ar'
                ? `📬 وصلتك مشاركة جديدة من "${folder.ownerName}": "${folder.name}"!`
                : `📬 New share received from "${folder.ownerName}": "${folder.name}"!`,
              'info',
              {
                label: settings.language === 'ar' ? 'عرض المشاركة' : 'View Share',
                onClick: () => {
                  setIsSharedHubModalOpen(true);
                  window.dispatchEvent(
                    new CustomEvent('open_shared_accounts_hub', {
                      detail: { tab: 'shared_with_me', folderId: folder.id },
                    })
                  );
                },
              },
              7000
            );
          }
        });
      };

      unsubInbox = subscribeToMyInbox(cleanId, (rawLiveReceived) => {
        handleDiscoveredShares(rawLiveReceived);
      });
      if (unsubActiveSpaces) unsubActiveSpaces();
      unsubActiveSpaces = subscribeToActiveSpacesTransactions();

      // Run one initial check on mount and flush offline queue
      if (typeof navigator === 'undefined' || navigator.onLine) {
        flushOfflineQueue()
          .then(() => fetchMyInboxOnce(cleanId))
          .then((polledShares) => {
            if (Array.isArray(polledShares)) {
              handleDiscoveredShares(polledShares);
            }
          })
          .catch(() => {});
      }
    };

    // Initial setup with currently available credentials
    setupListenerForUser();

    // Listen to Firebase Auth state directly so listener attaches immediately on sign-in
    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (isDisposed) return;
      if (user?.uid) {
        setupListenerForUser(user.uid);
      } else {
        const cached = getCachedAuthUser();
        if (cached?.uid) {
          setupListenerForUser(cached.uid);
        } else if (unsubInbox) {
          unsubInbox();
          unsubInbox = null;
          if (unsubActiveSpaces) { unsubActiveSpaces(); unsubActiveSpaces = null; }
          activeCleanId = '';
        }
      }
    });

    const handleReconnect = () => {
      setupListenerForUser();
    };
    window.addEventListener('online', handleReconnect);

    return () => {
      isDisposed = true;
      window.removeEventListener('online', handleReconnect);
      unsubAuth();
      if (unsubInbox) {
        unsubInbox();
        unsubInbox = null;
      }
      if (typeof unsubActiveSpaces === 'function') {
        unsubActiveSpaces();
      }
    };
  }, [settings.userProfile?.numericId, settings.userProfile?.uid, settings.language]);

  useEffect(() => {
    debouncedPersist('recurring_transactions', () => saveRecurringTransactions(recurringTransactions));
    saveItemToIndexedDB('recurring_transactions', recurringTransactions).catch(() => {});
  }, [recurringTransactions]);

  // App Lock & Recurring catch-up on resume / visibility change / pagehide / pageshow
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        recordAppBackground();
      } else if (document.visibilityState === 'visible') {
        if (shouldAppLockOnForeground()) {
          setIsAppLocked(true);
        }
        processDueRecurring();
      }
    };

    const handlePageHide = () => {
      recordAppBackground();
    };

    const handlePageShow = () => {
      if (shouldAppLockOnForeground()) {
        setIsAppLocked(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

  // Periodic catch-up check for due recurring rules while app is active
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        processDueRecurring();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Listen for security settings updates live
  useEffect(() => {
    const handleSecUpdate = () => {
      if (!isAppLockActive()) {
        setIsAppLocked(false);
      }
    };
    window.addEventListener('app_security_updated', handleSecUpdate);
    return () => window.removeEventListener('app_security_updated', handleSecUpdate);
  }, []);

  const unlockApp = () => {
    recordSuccessfulUnlock();
    setIsAppLocked(false);
  };

  const lockApp = () => {
    resetSessionLockState();
    setIsAppLocked(true);
  };

  // Recurring transactions CRUD
  const addRecurringTransaction = (recData: Omit<RecurringTransaction, 'id' | 'createdAt'>) => {
    const nowMs = Date.now();
    const tempRule: RecurringTransaction = {
      ...recData,
      id: 'temp',
      createdAt: nowMs,
    };
    const [sy, sm, sd] = (recData.startDate || formatDateToYYYYMMDD(new Date())).split('-').map(Number);
    const [sh, smin] = (recData.startTime || '09:00').split(':').map(Number);
    const startAnchor = new Date(sy, sm - 1, sd, sh || 0, smin || 0, 0, 0);
    const effFrom = recData.effectiveFrom || nowMs;
    const nextOcc = getNextScheduledOccurrence(
      tempRule,
      new Date(Math.max(startAnchor.getTime() - 1, effFrom - 1))
    );

    const newRec: RecurringTransaction = {
      ...recData,
      id: `rec_${nowMs}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: nowMs,
      effectiveFrom: effFrom,
      lastRun: recData.lastRun,
      lastProcessed: recData.lastProcessed ?? recData.lastRun,
      nextRun: nextOcc ? nextOcc.getTime() : undefined,
      nextDueDate: nextOcc ? formatDateToYYYYMMDD(nextOcc) : recData.nextDueDate,
      updatedAt: nowMs,
    };
    setRecurringTransactions((prev) => [...prev, newRec]);

    if (auth.currentUser && isSyncUnlockedRef.current) {
      triggerGranularPush(() => writeGranularDelta(auth.currentUser!.uid, 'recurring', newRec, isSyncUnlockedRef.current));
    }

    showToast(t('savedSuccess'), 'success');
  };

  const updateRecurringTransaction = (updated: RecurringTransaction) => {
    const nowMs = Date.now();
    const watermarkNow = Math.max(updated.lastRun || 0, updated.lastProcessed || 0, nowMs);
    const nextOcc = getNextScheduledOccurrence(updated, new Date(watermarkNow));
    const finalUpdated: RecurringTransaction = {
      ...updated,
      effectiveFrom: nowMs,
      lastRun: watermarkNow,
      lastProcessed: watermarkNow,
      lastProcessedDate: formatDateToYYYYMMDD(new Date(watermarkNow)),
      nextRun: nextOcc ? nextOcc.getTime() : updated.nextRun,
      nextDueDate: nextOcc ? formatDateToYYYYMMDD(nextOcc) : updated.nextDueDate,
      updatedAt: nowMs,
    };
    setRecurringTransactions((prev) => prev.map((r) => (r.id === finalUpdated.id ? finalUpdated : r)));

    if (auth.currentUser && isSyncUnlockedRef.current) {
      triggerGranularPush(() => writeGranularDelta(auth.currentUser!.uid, 'recurring', finalUpdated, isSyncUnlockedRef.current));
    }

    showToast(t('updatedSuccess'), 'success');
  };

  const deleteRecurringTransaction = (id: string) => {
    setRecurringTransactions((prev) => prev.filter((r) => r.id !== id));
    saveLocalTombstone({ id, collection: 'recurring', deletedAt: syncNow() });

    if (auth.currentUser && isSyncUnlockedRef.current) {
      triggerGranularPush(() => writeGranularDeletion(auth.currentUser!.uid, 'recurring', id, isSyncUnlockedRef.current));
    }

    showToast(t('deletedSuccess'), 'success');
  };

  /**
   * Applies an edited recurring rule.
   * - 'future': only the rule template (and its schedule) is updated, and watermarks advance to now.
   * - 'all': the rule template is updated (watermarks advance to now so deleted occurrences never backfill)
   *   AND every previously generated non-deleted transaction linked to it is updated in-place
   *   (date/time of past occurrences are kept), balances are recalculated, and all deltas are
   *   pushed to Cloud Auto-Backup and every linked Shared Space (ID & link shares).
   * Returns the number of past transactions that were retroactively updated.
   */
  const applyRecurringRuleEdit = (edited: RecurringTransaction, scope: 'future' | 'all'): number => {
    const original = recurringTransactions.find((r) => r.id === edited.id);
    const nowMs = Date.now();
    const isTransfer = edited.type === 'transfer';

    const normalized: RecurringTransaction = {
      ...edited,
      toAccountId: isTransfer ? edited.toAccountId : undefined,
      categoryId: isTransfer ? undefined : edited.categoryId,
      categoryName: isTransfer ? undefined : edited.categoryName,
      categoryIcon: isTransfer ? undefined : edited.categoryIcon,
    };

    const watermarkNow = Math.max(
      original?.lastRun || 0,
      original?.lastProcessed || 0,
      edited.lastRun || 0,
      edited.lastProcessed || 0,
      nowMs
    );
    const nextDate = getNextScheduledOccurrence(normalized, new Date(watermarkNow));

    const finalRule: RecurringTransaction = {
      ...normalized,
      effectiveFrom: nowMs,
      lastRun: watermarkNow,
      lastProcessed: watermarkNow,
      lastProcessedDate: formatDateToYYYYMMDD(new Date(watermarkNow)),
      nextRun: nextDate.getTime(),
      nextDueDate: formatDateToYYYYMMDD(nextDate),
      updatedAt: nowMs,
    };

    setRecurringTransactions((prev) => prev.map((r) => (r.id === finalRule.id ? finalRule : r)));
    if (auth.currentUser && isSyncUnlockedRef.current) {
      triggerGranularPush(() => writeGranularDelta(auth.currentUser!.uid, 'recurring', finalRule, isSyncUnlockedRef.current));
    }

    let affected = 0;

    if (scope === 'all') {
      const linkedIds = new Set(
        transactions
          .filter((tx) => tx.recurringRuleId === finalRule.id && !tx.isIndividuallyEdited && !tx.feeOfTransferId)
          .map((tx) => tx.id)
      );

      if (linkedIds.size > 0) {
        const TRANSFER_FIELDS = [
          'fromBalanceBefore', 'fromBalanceAfter', 'toBalanceBefore', 'toBalanceAfter',
          'fromAccountName', 'fromAccountIcon', 'toAccountName', 'toAccountIcon',
        ];

        const hasFee = Boolean(
          finalRule.type === 'transfer' &&
          finalRule.toAccountId &&
          finalRule.transferFee &&
          finalRule.transferFee > 0
        );
        let workingCats = categories;
        let feeCategory: Category | null = null;
        if (hasFee) {
          const feeEnsure = ensureBankFeesCategory(workingCats, settings.language);
          feeCategory = feeEnsure.category;
          if (feeEnsure.created) {
            workingCats = feeEnsure.updatedCategories;
            setCategories(workingCats);
            if (auth.currentUser && isSyncUnlockedRef.current) {
              const catToPush = feeCategory;
              triggerGranularPush(() => writeGranularDelta(auth.currentUser!.uid, 'categories', catToPush, isSyncUnlockedRef.current));
            }
          }
        }

        const retro = (tx: Transaction): Transaction => {
          const next: any = {
            ...tx,
            occurrenceKey: tx.occurrenceKey || buildOccurrenceKey(finalRule.id, tx.date, tx.time || '09:00'),
            type: finalRule.type,
            amount: finalRule.amount,
            accountId: finalRule.accountId,
            toAccountId: finalRule.toAccountId,
            categoryId: finalRule.categoryId,
            categoryName: finalRule.categoryName,
            categoryIcon: finalRule.categoryIcon,
            description: finalRule.description,
            budgetPool: finalRule.budgetPool,
            isSavingsAllocation: finalRule.isSavingsAllocation,
            savingsWithdrawalChoice: finalRule.savingsWithdrawalChoice,
            transferFee: hasFee ? roundHalfUpToCents(finalRule.transferFee!) : undefined,
            transferFeeMode: finalRule.transferFeeMode,
            transferFeeInputType: finalRule.transferFeeInputType,
            transferFeeRawValue: finalRule.transferFeeRawValue,
            transferFeeBudgetPool: finalRule.transferFeeBudgetPool,
            linkedFeeTxId: hasFee ? `tx_fee_${tx.id}` : undefined,
            updatedAt: nowMs,
          };
          for (const k of TRANSFER_FIELDS) delete next[k];
          return next as Transaction;
        };

        const deletedFeeTxs: Transaction[] = [];
        const upsertedFeeMap = new Map<string, Transaction>();
        for (const tx of transactions) {
          if (tx.feeOfTransferId && linkedIds.has(tx.feeOfTransferId)) {
            if (!hasFee) {
              deletedFeeTxs.push(tx);
            }
          }
        }
        const deletedFeeIdSet = new Set(deletedFeeTxs.map((t) => t.id));
        if (deletedFeeTxs.length > 0) {
          recordTransactionTombstones(deletedFeeTxs);
        }

        // Recalculate affected balances strictly in chronological order
        let list = transactions
          .filter((tx) => !deletedFeeIdSet.has(tx.id))
          .map((tx) => (linkedIds.has(tx.id) ? retro(tx) : tx));

        if (hasFee && feeCategory) {
          for (const tx of list) {
            if (linkedIds.has(tx.id)) {
              const existingFee = list.find((f) => f.feeOfTransferId === tx.id || f.id === `tx_fee_${tx.id}`);
              const feeTx = buildLinkedTransferFeeTransaction(tx, feeCategory, settings.language, existingFee);
              upsertedFeeMap.set(feeTx.id, feeTx);
            }
          }
          list = list.map((tx) => upsertedFeeMap.get(tx.id) || tx);
          for (const [fId, fTx] of upsertedFeeMap.entries()) {
            if (!list.some((x) => x.id === fId)) {
              list.push(fTx);
            }
          }
        }

        list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        const updatedLinked: Transaction[] = [];
        const snapshot = [...list];
        list = snapshot.map((tx) => {
          if (!linkedIds.has(tx.id) && !upsertedFeeMap.has(tx.id)) return tx;
          let nt = tx;
          if (tx.type === 'transfer' && tx.toAccountId) {
            const fromAcc = accounts.find((a) => a.id === tx.accountId);
            const toAcc = accounts.find((a) => a.id === tx.toAccountId);
            if (fromAcc && toAcc) {
              const fh = getHistoricalBalance(tx.id, fromAcc, snapshot);
              const th = getHistoricalBalance(tx.id, toAcc, snapshot);
              nt = {
                ...tx,
                fromBalanceBefore: fh.balanceBefore,
                fromBalanceAfter: fh.balanceAfter,
                toBalanceBefore: th.balanceBefore,
                toBalanceAfter: th.balanceAfter,
              };
            }
          }
          updatedLinked.push(nt);
          return nt;
        });

        const syncedAccounts = syncAllAccountBalances(accounts, list);
        setTransactions(list);
        setAccounts(syncedAccounts);
        affected = linkedIds.size;

        if (viewingTx && linkedIds.has(viewingTx.id)) {
          const refreshed = updatedLinked.find((t) => t.id === viewingTx.id);
          if (refreshed) setViewingTx(refreshed);
        }

        // Cloud Auto-Backup granular deltas (transactions + changed account balances)
        if (auth.currentUser && isSyncUnlockedRef.current) {
          const uid = auth.currentUser.uid;
          for (const tx of updatedLinked) {
            triggerGranularPush(() => writeGranularDelta(uid, 'transactions', tx, isSyncUnlockedRef.current));
          }
          const oldBal = new Map(accounts.map((a) => [a.id, a.balance]));
          for (const acc of syncedAccounts) {
            if (oldBal.get(acc.id) !== acc.balance) {
              triggerGranularPush(() => writeGranularDelta(uid, 'accounts', acc, isSyncUnlockedRef.current));
            }
          }
        }

        // Shared Spaces (in-app ID shares & external link shares), including accounts moved in/out
        (async () => {
          for (const tx of updatedLinked) {
            try {
              await propagateTransactionToLinkedSpaces('update', tx, syncedAccounts);
            } catch {
              /* keep going so one failing space never blocks the others */
            }
          }
          for (const delFee of deletedFeeTxs) {
            try {
              await propagateTransactionToLinkedSpaces('delete', delFee, syncedAccounts);
            } catch {}
          }
        })();
      }
    }

    const isArabic = settings.language === 'ar';
    showToast(
      scope === 'all'
        ? isArabic
          ? ('تم تحديث القاعدة و' + affected + ' معاملة سابقة')
          : ('Rule updated, plus ' + affected + ' past transaction(s)')
        : isArabic
        ? 'تم تحديث القاعدة للمعاملات القادمة'
        : 'Rule updated for future occurrences',
      'success'
    );
    return affected;
  };

  const processDueRecurring = (showUserToast = false): number => {
    const tombstones = loadLocalTombstones();
    const tombstoneIds = new Set(Object.keys(tombstones));
    const currentRecs = recurringTransactionsRef.current || recurringTransactions;
    const currentTxs = transactionsRef.current || transactions;
    const currentAccs = accountsRef.current || accounts;
    const currentCats = categoriesRef.current || categories;
    const res = checkAndProcessRecurring(currentRecs, currentTxs, tombstoneIds, Date.now());

    if (res.newTransactions.length > 0) {
      setRecurringTransactions(res.updatedRecurring);

      const allGeneratedTxs: Transaction[] = [];
      let workingCats = currentCats;
      let newlyCreatedFeeCategory: Category | null = null;
      const existingTxIds = new Set(currentTxs.map((t) => t.id));

      for (const genTx of res.newTransactions) {
        allGeneratedTxs.push(genTx);
        if (genTx.type === 'transfer' && genTx.transferFee && genTx.transferFee > 0) {
          const feeEnsure = ensureBankFeesCategory(workingCats, settings.language);
          if (feeEnsure.created) {
            workingCats = feeEnsure.updatedCategories;
            newlyCreatedFeeCategory = feeEnsure.category;
          }
          const feeTx = buildLinkedTransferFeeTransaction(genTx, feeEnsure.category, settings.language);
          if (!existingTxIds.has(feeTx.id) && !tombstoneIds.has(feeTx.id)) {
            allGeneratedTxs.push(feeTx);
            existingTxIds.add(feeTx.id);
          }
        }
      }

      if (newlyCreatedFeeCategory) {
        setCategories(workingCats);
      }

      // Merge newly generated transactions chronologically
      const combinedTxs = [...currentTxs, ...allGeneratedTxs].sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.time || '').localeCompare(b.time || '');
      });

      const syncedAccounts = syncAllAccountBalances(currentAccs, combinedTxs);
      setTransactions(combinedTxs);
      setAccounts(syncedAccounts);

      // Save to IndexedDB & RTDB deltas
      if (auth.currentUser && isSyncUnlockedRef.current) {
        const uid = auth.currentUser.uid;
        if (newlyCreatedFeeCategory) {
          const catToPush = newlyCreatedFeeCategory;
          triggerGranularPush(() => writeGranularDelta(uid, 'categories', catToPush, isSyncUnlockedRef.current));
        }
        for (const newTx of allGeneratedTxs) {
          triggerGranularPush(() => writeGranularDelta(uid, 'transactions', newTx, isSyncUnlockedRef.current));
        }
        for (const updRec of res.updatedRecurring) {
          triggerGranularPush(() => writeGranularDelta(uid, 'recurring', updRec, isSyncUnlockedRef.current));
        }
        // Granular push for accounts whose balances changed
        const affectedAccountIds = new Set<string>();
        for (const newTx of allGeneratedTxs) {
          if (newTx.accountId) affectedAccountIds.add(newTx.accountId);
          if (newTx.toAccountId) affectedAccountIds.add(newTx.toAccountId);
        }
        for (const acc of syncedAccounts) {
          if (affectedAccountIds.has(acc.id)) {
            triggerGranularPush(() => writeGranularDelta(uid, 'accounts', acc, isSyncUnlockedRef.current));
          }
        }
      }

      // Propagate newly added transactions and updated account balances to any linked Shared Spaces (both ID shares and link shares) in real time
      for (const newTx of allGeneratedTxs) {
        propagateTransactionToLinkedSpaces('add', newTx, syncedAccounts).catch((err) => {
          console.warn('[Recurring] Failed to propagate recurring transaction to linked space:', err);
        });
      }

      const isArabic = settings.language === 'ar';
      showToast(
        isArabic
          ? `تمت إضافة ${res.totalAdded} معاملة متكررة`
          : `${res.totalAdded} recurring transaction(s) were added`,
        'success'
      );
      return res.totalAdded;
    } else if (showUserToast) {
      const isArabic = settings.language === 'ar';
      showToast(
        isArabic ? 'لا توجد معاملات دورية مستحقة اليوم' : 'No recurring transactions due today',
        'info'
      );
    }
    return 0;
  };

  const executeManualRecurringRules = (ruleIds: string[]): number => {
    if (!ruleIds || ruleIds.length === 0) return 0;
    const now = new Date();
    const dateStr = formatDateToYYYYMMDD(now);
    const timeStr = formatTimeToHHMM(now);
    const nowMs = Date.now();

    const selectedRules = recurringTransactions.filter((r) => ruleIds.includes(r.id));
    if (selectedRules.length === 0) return 0;

    const manualTxs: Transaction[] = [];
    let workingCats = categories;
    let newlyCreatedFeeCategory: Category | null = null;

    selectedRules.forEach((rec, idx) => {
      const detId = `rec_${rec.id}_manual_${nowMs}_${idx}`;
      const occKey = buildOccurrenceKey(rec.id, dateStr, timeStr);
      const hasFee = Boolean(rec.type === 'transfer' && rec.transferFee && rec.transferFee > 0);
      const parentTx: Transaction = {
        id: detId,
        occurrenceKey: occKey,
        type: rec.type,
        amount: rec.amount,
        date: dateStr,
        time: timeStr,
        accountId: rec.accountId,
        toAccountId: rec.toAccountId,
        categoryId: rec.categoryId,
        categoryName: rec.categoryName,
        categoryIcon: rec.categoryIcon,
        description: rec.description,
        budgetPool: rec.budgetPool,
        isSavingsAllocation: rec.isSavingsAllocation,
        savingsWithdrawalChoice: rec.savingsWithdrawalChoice,
        transferFee: rec.transferFee,
        transferFeeMode: rec.transferFeeMode,
        transferFeeInputType: rec.transferFeeInputType,
        transferFeeRawValue: rec.transferFeeRawValue,
        transferFeeBudgetPool: rec.transferFeeBudgetPool,
        linkedFeeTxId: hasFee ? `tx_fee_${detId}` : undefined,
        createdAt: nowMs + idx * 2,
        updatedAt: nowMs + idx * 2,
        isFromRecurring: true,
        recurringRuleId: rec.id,
      };
      manualTxs.push(parentTx);
      if (hasFee) {
        const feeEnsure = ensureBankFeesCategory(workingCats, settings.language);
        if (feeEnsure.created) {
          workingCats = feeEnsure.updatedCategories;
          newlyCreatedFeeCategory = feeEnsure.category;
        }
        const feeTx = buildLinkedTransferFeeTransaction(parentTx, feeEnsure.category, settings.language);
        manualTxs.push(feeTx);
      }
    });

    if (newlyCreatedFeeCategory) {
      setCategories(workingCats);
    }

    const combinedTxs = [...transactions, ...manualTxs].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.time || '').localeCompare(b.time || '');
    });

    const syncedAccounts = syncAllAccountBalances(accounts, combinedTxs);
    setTransactions(combinedTxs);
    setAccounts(syncedAccounts);

    const affectedAccountIds = new Set<string>();
    for (const mTx of manualTxs) {
      if (mTx.accountId) affectedAccountIds.add(mTx.accountId);
      if (mTx.toAccountId) affectedAccountIds.add(mTx.toAccountId);
    }

    if (auth.currentUser && isSyncUnlockedRef.current) {
      for (const mTx of manualTxs) {
        triggerGranularPush(() => writeGranularDelta(auth.currentUser!.uid, 'transactions', mTx, isSyncUnlockedRef.current));
      }
      for (const acc of syncedAccounts) {
        if (affectedAccountIds.has(acc.id)) {
          triggerGranularPush(() => writeGranularDelta(auth.currentUser!.uid, 'accounts', acc, isSyncUnlockedRef.current));
        }
      }
    }

    // Propagate manual transactions to linked shared spaces in real time
    for (const mTx of manualTxs) {
      propagateTransactionToLinkedSpaces('add', mTx, syncedAccounts).catch((err) => {
        console.warn('[Recurring] Failed to propagate manual recurring transaction to linked space:', err);
      });
    }

    const isArabic = settings.language === 'ar';
    showToast(
      isArabic
        ? `تم تنفيذ ${manualTxs.length} معاملة بنجاح`
        : `Processed ${manualTxs.length} transaction(s) successfully`,
      'success'
    );
    return manualTxs.length;
  };

  // One-Time Idempotent Recurring Watermark & OccurrenceKey Migration (with Pre-Migration Snapshot in IndexedDB)
  // Runs BEFORE processDueRecurring() on startup so previously deleted ghost occurrences can NEVER be backfilled.
  useEffect(() => {
    const RECURRING_WATERMARK_MIGRATION_FLAG = 'mm_recurring_watermark_migrated_v1';
    const alreadyMigrated = localStorage.getItem(RECURRING_WATERMARK_MIGRATION_FLAG) === 'true';

    if (!alreadyMigrated) {
      const migrationNowMs = Date.now();
      const migrationDateStr = formatDateToYYYYMMDD(new Date(migrationNowMs));
      const rawRules = recurringTransactionsRef.current || [];
      const rawTxs = transactionsRef.current || [];

      // Advance watermarks immediately in memory before any catch-up check runs
      const migratedRules: RecurringTransaction[] = rawRules.map((rule) => {
        const norm = migrateRecurringRule(rule);
        const effFrom = Math.max(norm.effectiveFrom || 0, migrationNowMs);
        const watermark = Math.max(norm.lastRun || 0, norm.lastProcessed || 0, migrationNowMs);
        const nextOcc = getNextScheduledOccurrence(norm, new Date(watermark));
        return {
          ...norm,
          effectiveFrom: effFrom,
          lastRun: watermark,
          lastProcessed: watermark,
          lastProcessedDate: migrationDateStr,
          nextRun: nextOcc.getTime(),
          nextDueDate: formatDateToYYYYMMDD(nextOcc),
          updatedAt: migrationNowMs,
        };
      });

      let txsBackfilled = false;
      const migratedTxs: Transaction[] = rawTxs.map((tx) => {
        if (tx.recurringRuleId && !tx.occurrenceKey && tx.date) {
          txsBackfilled = true;
          return {
            ...tx,
            occurrenceKey: buildOccurrenceKey(tx.recurringRuleId, tx.date, tx.time || '09:00'),
          };
        }
        return tx;
      });

      if (migratedRules.length > 0) {
        recurringTransactionsRef.current = migratedRules;
        setRecurringTransactions(migratedRules);
        saveRecurringTransactions(migratedRules);
      }
      if (txsBackfilled) {
        transactionsRef.current = migratedTxs;
        setTransactions(migratedTxs);
        saveTransactions(migratedTxs);
      }

      (async () => {
        try {
          await savePreMigrationSnapshot('recurring_watermark_v1', {
            accounts: accountsRef.current,
            categories: categoriesRef.current,
            transactions: rawTxs,
            settings: settingsRef.current,
            recurringTransactions: rawRules,
          });
          localStorage.setItem(RECURRING_WATERMARK_MIGRATION_FLAG, 'true');
          if (auth.currentUser && isSyncUnlockedRef.current && migratedRules.length > 0) {
            const uid = auth.currentUser.uid;
            for (const r of migratedRules) {
              triggerGranularPush(() => writeGranularDelta(uid, 'recurring', r, isSyncUnlockedRef.current));
            }
          }
        } catch (err) {
          console.warn('[Migration] Failed recurring watermark v1 migration snapshot:', err);
          localStorage.setItem(RECURRING_WATERMARK_MIGRATION_FLAG, 'true');
        } finally {
          processDueRecurring();
        }
      })();
    } else {
      processDueRecurring();
    }
  }, []);

  // One-time Unified Financial Cycle Migration (with Pre-Migration Snapshot in IndexedDB)
  useEffect(() => {
    const UNIFIED_CYCLE_MIGRATION_FLAG = 'mm_unified_cycle_migrated_v1';
    const currentSettings = settingsRef.current;
    const sb = currentSettings.smartBudget;
    const globalStartDay = currentSettings.defaultMonthStartDay || 1;
    const alreadyMigrated = localStorage.getItem(UNIFIED_CYCLE_MIGRATION_FLAG) === 'true';
    const hasLegacyOverrides =
      sb?.overrides && Object.keys(sb.overrides).some((k) => /^\d{4}-\d{2}$/.test(k));
    const hasDivergentStartDay =
      typeof sb?.baseline?.startDay === 'number' && sb.baseline.startDay !== globalStartDay;

    if (!alreadyMigrated || hasLegacyOverrides || hasDivergentStartDay) {
      (async () => {
        try {
          await savePreMigrationSnapshot('unified_financial_cycle_v1', {
            accounts: accountsRef.current,
            categories: categoriesRef.current,
            transactions: transactionsRef.current,
            settings: currentSettings,
            recurringTransactions: recurringTransactionsRef.current,
          });
          if (sb) {
            // If user had a custom start day in Smart Budget (> 1) while global App Month was still default 1,
            // adopt their Smart Budget start day as the unified global App Month start day.
            const unifiedStartDay =
              !alreadyMigrated &&
              globalStartDay === 1 &&
              typeof sb.baseline?.startDay === 'number' &&
              sb.baseline.startDay > 1 &&
              sb.baseline.startDay <= 31
                ? sb.baseline.startDay
                : globalStartDay;

            const { migrated, changed } = migrateSmartBudgetSettingsToUnifiedCycle(
              sb,
              unifiedStartDay
            );
            if (changed || unifiedStartDay !== globalStartDay) {
              setSettings((prev) => {
                const next: AppSettings = {
                  ...prev,
                  defaultMonthStartDay: unifiedStartDay,
                  smartBudget: migrated,
                };
                saveSettings(next);
                return next;
              });
            }
          }
          localStorage.setItem(UNIFIED_CYCLE_MIGRATION_FLAG, 'true');
        } catch (err) {
          console.warn('[Migration] Failed unified financial cycle migration:', err);
        }
      })();
    }
  }, []);

  // One-time Idempotent Migration: Convert legacy 'emergency' budgetPool / transferFeeBudgetPool to 'oneoff' (with Pre-Migration Snapshot)
  useEffect(() => {
    const BUDGET_POOL_ONEOFF_MIGRATION_FLAG = 'mm_budget_pool_oneoff_migrated_v1';
    const alreadyMigrated = localStorage.getItem(BUDGET_POOL_ONEOFF_MIGRATION_FLAG) === 'true';
    const rawTxs = transactionsRef.current || [];
    const rawRules = recurringTransactionsRef.current || [];

    const hasLegacyPoolOnTxs = rawTxs.some(
      (tx) =>
        (tx.budgetPool as string | undefined) === 'emergency' ||
        (tx.transferFeeBudgetPool as string | undefined) === 'emergency'
    );
    const hasLegacyPoolOnRules = rawRules.some(
      (r) =>
        (r.budgetPool as string | undefined) === 'emergency' ||
        (r.transferFeeBudgetPool as string | undefined) === 'emergency'
    );

    if (!alreadyMigrated || hasLegacyPoolOnTxs || hasLegacyPoolOnRules) {
      (async () => {
        try {
          if (hasLegacyPoolOnTxs || hasLegacyPoolOnRules || !alreadyMigrated) {
            await savePreMigrationSnapshot('budget_pool_oneoff_v1', {
              accounts: accountsRef.current,
              categories: categoriesRef.current,
              transactions: rawTxs,
              settings: settingsRef.current,
              recurringTransactions: rawRules,
            });
          }

          const nowMs = Date.now();
          if (hasLegacyPoolOnTxs) {
            const migratedTxs: Transaction[] = rawTxs.map((tx) => {
              const nextPool =
                (tx.budgetPool as string | undefined) === 'emergency' ? 'oneoff' : tx.budgetPool;
              const nextFeePool =
                (tx.transferFeeBudgetPool as string | undefined) === 'emergency'
                  ? 'oneoff'
                  : tx.transferFeeBudgetPool;
              if (nextPool !== tx.budgetPool || nextFeePool !== tx.transferFeeBudgetPool) {
                return {
                  ...tx,
                  budgetPool: nextPool,
                  transferFeeBudgetPool: nextFeePool,
                  updatedAt: nowMs,
                };
              }
              return tx;
            });
            transactionsRef.current = migratedTxs;
            setTransactions(migratedTxs);
            saveTransactions(migratedTxs);
            if (auth.currentUser && isSyncUnlockedRef.current) {
              const uid = auth.currentUser.uid;
              for (const tx of migratedTxs) {
                if (tx.updatedAt === nowMs) {
                  triggerGranularPush(() => writeGranularDelta(uid, 'transactions', tx, isSyncUnlockedRef.current));
                }
              }
            }
          }

          if (hasLegacyPoolOnRules) {
            const migratedRules: RecurringTransaction[] = rawRules.map((r) => {
              const nextPool =
                (r.budgetPool as string | undefined) === 'emergency' ? 'oneoff' : r.budgetPool;
              const nextFeePool =
                (r.transferFeeBudgetPool as string | undefined) === 'emergency'
                  ? 'oneoff'
                  : r.transferFeeBudgetPool;
              if (nextPool !== r.budgetPool || nextFeePool !== r.transferFeeBudgetPool) {
                return {
                  ...r,
                  budgetPool: nextPool,
                  transferFeeBudgetPool: nextFeePool,
                  updatedAt: nowMs,
                };
              }
              return r;
            });
            recurringTransactionsRef.current = migratedRules;
            setRecurringTransactions(migratedRules);
            saveRecurringTransactions(migratedRules);
            if (auth.currentUser && isSyncUnlockedRef.current) {
              const uid = auth.currentUser.uid;
              for (const r of migratedRules) {
                if (r.updatedAt === nowMs) {
                  triggerGranularPush(() => writeGranularDelta(uid, 'recurring', r, isSyncUnlockedRef.current));
                }
              }
            }
          }

          localStorage.setItem(BUDGET_POOL_ONEOFF_MIGRATION_FLAG, 'true');
        } catch (err) {
          console.warn('[Migration] Failed budgetPool oneoff migration:', err);
          localStorage.setItem(BUDGET_POOL_ONEOFF_MIGRATION_FLAG, 'true');
        }
      })();
    }
  }, []);

  // Smart Budget Alerts calculation
  const budgetAlerts = useMemo(() => {
    return evaluateBudgetAlerts(categories, transactions, settings.budgetAlertThreshold || 80);
  }, [categories, transactions, settings.budgetAlertThreshold]);

  const dismissBudgetAlert = (categoryId: string) => {
    setDismissedAlertIds((prev) => [...prev, categoryId]);
  };

  useEffect(() => {
    saveSettings(settings);
    // Apply theme & RTL direction
    if (settings.themeMode === 'light') {
      document.documentElement.classList.add('light-mode');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.remove('light-mode');
      document.documentElement.classList.add('dark');
    }

    if (settings.language === 'ar') {
      document.documentElement.setAttribute('dir', 'rtl');
      document.documentElement.setAttribute('lang', 'ar');
    } else {
      document.documentElement.setAttribute('dir', 'ltr');
      document.documentElement.setAttribute('lang', 'en');
    }
  }, [settings]);

  // Check for Google OAuth redirect credentials on startup
  useEffect(() => {
    checkAndHandleGoogleRedirect().catch((err) =>
      console.warn('[AppContext] Google redirect check error:', err)
    );
  }, []);

  // Build current full application state payload for cloud backups
  const buildCurrentBackupPayload = (overrideSettings?: AppSettings): FullAppBackupPayload => {
    const effectiveSettings = overrideSettings || settings;
    const now = Date.now();
    const uid = auth.currentUser?.uid || effectiveSettings.userProfile?.uid || '';
    return {
      version: CURRENT_APP_VERSION,
      backupDate: new Date().toISOString(),
      timestamp: now,
      updatedAt: now,
      ownerUid: uid,
      accountName: effectiveSettings.userProfile?.name || 'Cloud Backup',
      accounts,
      categories,
      transactions,
      recurringTransactions,
      tombstones: loadLocalTombstones(),
      settings: effectiveSettings,
      sharedSpaces: {
        myFolders: loadMyShareFolders(),
        receivedFolders: loadReceivedShareFolders(),
      },
      userProfile: {
        name: effectiveSettings.userProfile?.name || 'User',
        numericId: effectiveSettings.userProfile?.numericId || '',
        avatarEmoji: effectiveSettings.userProfile?.avatarEmoji || '👤',
        customAvatarUrl: effectiveSettings.userProfile?.customAvatarUrl || auth.currentUser?.photoURL || '',
        email: auth.currentUser?.email || '',
        uid,
        driveAccessGranted: Boolean(effectiveSettings.userProfile?.driveAccessGranted || getGoogleDriveAccessToken()),
        drivePromptResolved: Boolean(
          effectiveSettings.userProfile?.drivePromptResolved ||
          (typeof localStorage !== 'undefined' && localStorage.getItem(`mm_drive_perm_prompted_${uid}`) === 'true')
        ),
      },
    };
  };

  // Debounced Automatic Cloud Backup whenever data changes
  useEffect(() => {
    const activeUid = auth.currentUser?.uid || getCachedAuthUser()?.uid || settings.userProfile?.uid;
    if (!activeUid || !isCloudHydratedRef.current) return;
    localStorage.setItem('mm_last_local_data_update', String(Date.now()));
    scheduleDualCloudBackup(activeUid, () => buildCurrentBackupPayload(), 2500);
  }, [accounts, categories, transactions, recurringTransactions, settings]);

  const applyCloudData = (d: any) => {
    if (!d || typeof d !== 'object') return;
    if (d.tombstones && typeof d.tombstones === 'object') {
      Object.values(d.tombstones).forEach((t: any) => {
        if (t && t.id) saveLocalTombstone(t);
      });
    }
    const allTombs = loadLocalTombstones();
    const filteredTxs: Transaction[] = Array.isArray(d.transactions)
      ? d.transactions.filter(
          (tx: Transaction) =>
            tx &&
            tx.id &&
            !isTransactionTombstoned(tx, allTombs, Number(tx.updatedAt || tx.createdAt || 0))
        )
      : transactionsRef.current;

    if (Array.isArray(d.accounts) && d.accounts.length > 0) {
      setAccounts(syncAllAccountBalances(d.accounts, filteredTxs));
    }
    if (Array.isArray(d.categories) && d.categories.length > 0) {
      setCategories(d.categories);
    }
    if (Array.isArray(d.transactions)) {
      setTransactions(filteredTxs);
    }
    if (Array.isArray(d.recurringTransactions)) {
      const localRecMap = new Map<string, RecurringTransaction>(
        (recurringTransactionsRef.current || []).map((r) => [r.id, r])
      );
      const mergedRecs = d.recurringTransactions
        .filter((r: RecurringTransaction) => r && r.id && !allTombs[r.id])
        .map((r: RecurringTransaction) => mergeRecurringRuleWatermarks(r, localRecMap.get(r.id)));
      setRecurringTransactions(mergedRecs);
    }
    if (d.settings && typeof d.settings === 'object') {
      setSettings((prev) => ({
        ...prev,
        ...d.settings,
        userProfile: d.settings.userProfile
          ? { ...prev.userProfile, ...d.settings.userProfile }
          : prev.userProfile,
        smartBudget: d.smartBudget || d.settings.smartBudget || prev.smartBudget,
      }));
    } else if (d.smartBudget) {
      setSettings((prev) => ({
        ...prev,
        smartBudget: d.smartBudget,
      }));
    }
    if (d.sharedSpaces) {
      if (Array.isArray(d.sharedSpaces.notifiedShareIds)) {
        markShareIdsNotifiedForever(d.sharedSpaces.notifiedShareIds);
      }
      if (Array.isArray(d.sharedSpaces.myFolders)) {
        saveMyShareFolders(d.sharedSpaces.myFolders);
      }
      if (Array.isArray(d.sharedSpaces.receivedFolders)) {
        saveReceivedShareFolders(d.sharedSpaces.receivedFolders);
      }
      const my16 = cleanNumericId(settings.userProfile?.numericId || getOrCreateNumericId());
      repairAndMigrateSharedSpaces(my16, auth.currentUser?.uid || settings.userProfile?.uid);
    }
  };

  /**
   * Attaches real-time remote cloud backup subscription strictly after identity binding
   * and sync conflict resolution are confirmed, protecting local state from pre-hydration overwrites.
   */
  const attachV4ListenersForUser = useCallback((uid: string) => {
    if (!uid) return;
    if (unsubV4ListenersRef.current) {
      unsubV4ListenersRef.current();
      unsubV4ListenersRef.current = null;
    }

    const unsub = attachV4LiveListeners(uid, {
      onTransactions: (remoteTxs) => {
        if (!isSyncUnlockedRef.current || isApplyingRemoteSyncRef.current) return;
        const tombstones = loadLocalTombstones();
        const local = transactionsRef.current;
        const localMap = new Map<string, Transaction>(local.map((t) => [t.id, t]));
        const localOccMap = new Map<string, string>();
        for (const t of local) {
          if (t.occurrenceKey) localOccMap.set(t.occurrenceKey, t.id);
        }
        let changed = false;

        for (const r of remoteTxs) {
          if (!r || !r.id) continue;
          const rUpdated = Number(r.updatedAt || r.createdAt || 0);
          if (isTransactionTombstoned(r, tombstones, rUpdated)) {
            if (localMap.has(r.id)) {
              localMap.delete(r.id);
              changed = true;
            }
            if (r.occurrenceKey && localOccMap.has(r.occurrenceKey)) {
              const dupId = localOccMap.get(r.occurrenceKey)!;
              if (localMap.has(dupId)) {
                localMap.delete(dupId);
                changed = true;
              }
            }
            continue;
          }
          // Deduplicate by occurrenceKey if another device generated the same recurring occurrence
          const rOccKey =
            r.occurrenceKey ||
            (r.recurringRuleId && r.date
              ? buildOccurrenceKey(r.recurringRuleId, r.date, r.time || '09:00')
              : undefined);
          if (rOccKey && localOccMap.has(rOccKey) && localOccMap.get(rOccKey) !== r.id) {
            const existingId = localOccMap.get(rOccKey)!;
            const existingTx = localMap.get(existingId);
            if (existingTx && rUpdated > Number(existingTx.updatedAt || existingTx.createdAt || 0)) {
              localMap.delete(existingId);
              localMap.set(r.id, { ...r, occurrenceKey: rOccKey });
              localOccMap.set(rOccKey, r.id);
              changed = true;
            }
            continue;
          }
          const loc = localMap.get(r.id);
          if (!loc || rUpdated > Number(loc.updatedAt || loc.createdAt || 0)) {
            const stampedR = rOccKey ? { ...r, occurrenceKey: rOccKey } : r;
            localMap.set(r.id, stampedR);
            if (rOccKey) localOccMap.set(rOccKey, r.id);
            changed = true;
          }
        }

        if (changed) {
          isApplyingRemoteSyncRef.current = true;
          const nextTxs = Array.from(localMap.values()).sort(compareTxChronologicallyDesc);
          setTransactions(nextTxs);
          setAccounts((prevAccs) => syncAllAccountBalances(prevAccs, nextTxs));
          setTimeout(() => {
            isApplyingRemoteSyncRef.current = false;
          }, 100);
        }
      },

      onAccounts: (remoteAccs) => {
        if (!isSyncUnlockedRef.current || isApplyingRemoteSyncRef.current) return;
        const tombstones = loadLocalTombstones();
        const local = accountsRef.current;
        const localMap = new Map<string, Account>(local.map((a) => [a.id, a]));
        let changed = false;

        for (const r of remoteAccs) {
          if (!r || !r.id) continue;
          const tomb = tombstones[r.id];
          const rUpdated = Number(r.updatedAt || 0);
          if (tomb && tomb.deletedAt > rUpdated) {
            if (localMap.has(r.id)) {
              localMap.delete(r.id);
              changed = true;
            }
            continue;
          }
          const loc = localMap.get(r.id);
          if (!loc || rUpdated > Number(loc.updatedAt || 0)) {
            localMap.set(r.id, r);
            changed = true;
          }
        }

        if (changed) {
          isApplyingRemoteSyncRef.current = true;
          const nextAccs = syncAllAccountBalances(Array.from(localMap.values()), transactionsRef.current);
          setAccounts(nextAccs);
          setTimeout(() => {
            isApplyingRemoteSyncRef.current = false;
          }, 100);
        }
      },

      onCategories: (remoteCats) => {
        if (!isSyncUnlockedRef.current || isApplyingRemoteSyncRef.current) return;
        const tombstones = loadLocalTombstones();
        const local = categoriesRef.current;
        const localMap = new Map<string, Category>(local.map((c) => [c.id, c]));
        let changed = false;

        for (const r of remoteCats) {
          if (!r || !r.id) continue;
          const tomb = tombstones[r.id];
          const rUpdated = Number(r.updatedAt || 0);
          if (tomb && tomb.deletedAt > rUpdated) {
            if (localMap.has(r.id)) {
              localMap.delete(r.id);
              changed = true;
            }
            continue;
          }
          const loc = localMap.get(r.id);
          if (!loc || rUpdated > Number(loc.updatedAt || 0)) {
            localMap.set(r.id, r);
            changed = true;
          }
        }

        if (changed) {
          isApplyingRemoteSyncRef.current = true;
          setCategories(Array.from(localMap.values()));
          setTimeout(() => {
            isApplyingRemoteSyncRef.current = false;
          }, 100);
        }
      },

      onRecurring: (remoteRecs) => {
        if (!isSyncUnlockedRef.current || isApplyingRemoteSyncRef.current) return;
        const tombstones = loadLocalTombstones();
        const local = recurringTransactionsRef.current;
        const localMap = new Map<string, RecurringTransaction>(local.map((r) => [r.id, r]));
        let changed = false;

        for (const r of remoteRecs) {
          if (!r || !r.id) continue;
          const tomb = tombstones[r.id];
          const rUpdated = Number(r.updatedAt || r.createdAt || 0);
          if (tomb && tomb.deletedAt > rUpdated) {
            if (localMap.has(r.id)) {
              localMap.delete(r.id);
              changed = true;
            }
            continue;
          }
          const loc = localMap.get(r.id);
          if (!loc || rUpdated > Number(loc.updatedAt || loc.createdAt || 0)) {
            localMap.set(r.id, mergeRecurringRuleWatermarks(r, loc));
            changed = true;
          }
        }

        if (changed) {
          isApplyingRemoteSyncRef.current = true;
          setRecurringTransactions(Array.from(localMap.values()));
          setTimeout(() => {
            isApplyingRemoteSyncRef.current = false;
          }, 100);
        }
      },

      onTombstones: (remoteTombs) => {
        if (!isSyncUnlockedRef.current || isApplyingRemoteSyncRef.current) return;
        let anyApplied = false;
        for (const t of remoteTombs) {
          if (!t || !t.id) continue;
          saveLocalTombstone(t);
          anyApplied = true;
        }
        if (anyApplied) {
          const allTombs = loadLocalTombstones();
          const hasMatchingLocal =
            transactionsRef.current.some((x) =>
              isTransactionTombstoned(x, allTombs, Number(x.updatedAt || x.createdAt || 0))
            ) ||
            recurringTransactionsRef.current.some(
              (x) => allTombs[x.id] && allTombs[x.id].deletedAt > Number(x.updatedAt || x.createdAt || 0)
            ) ||
            accountsRef.current.some(
              (x) => allTombs[x.id] && allTombs[x.id].deletedAt > Number(x.updatedAt || 0)
            ) ||
            categoriesRef.current.some(
              (x) => allTombs[x.id] && allTombs[x.id].deletedAt > Number(x.updatedAt || 0)
            );
          if (!hasMatchingLocal) return;

          isApplyingRemoteSyncRef.current = true;
          setTransactions((prev) =>
            prev.filter(
              (tx) => !isTransactionTombstoned(tx, allTombs, Number(tx.updatedAt || tx.createdAt || 0))
            )
          );
          setRecurringTransactions((prev) =>
            prev.filter((r) => !allTombs[r.id] || allTombs[r.id].deletedAt <= Number(r.updatedAt || r.createdAt || 0))
          );
          setAccounts((prev) => {
            const remaining = prev.filter(
              (a) => !allTombs[a.id] || allTombs[a.id].deletedAt <= Number(a.updatedAt || 0)
            );
            return syncAllAccountBalances(remaining, transactionsRef.current);
          });
          setCategories((prev) =>
            prev.filter((c) => !allTombs[c.id] || allTombs[c.id].deletedAt <= Number(c.updatedAt || 0))
          );
          setTimeout(() => {
            isApplyingRemoteSyncRef.current = false;
          }, 100);
        }
      },

      onManifest: (remoteSettings, remoteProfile, remoteSmartBudget) => {
        if (!isSyncUnlockedRef.current || isApplyingRemoteSyncRef.current) return;
        const effRemoteSmartBudget = remoteSmartBudget || remoteSettings?.smartBudget;
        const curSettingsUpdated = Number(settingsRef.current.updatedAt || 0);
        const remSettingsUpdated = Number(remoteSettings?.updatedAt || 0);
        const curSmartUpdated = Number(settingsRef.current.smartBudget?.updatedAt || 0);
        const remSmartUpdated = Number(effRemoteSmartBudget?.updatedAt || 0);

        if (remSettingsUpdated > curSettingsUpdated || remSmartUpdated > curSmartUpdated) {
          isApplyingRemoteSyncRef.current = true;
          setSettings((prev) => {
            const next = { ...prev };
            if (remoteSettings && remSettingsUpdated > Number(prev.updatedAt || 0)) {
              Object.assign(next, remoteSettings);
            }
            if (remoteProfile) {
              next.userProfile = { ...prev.userProfile, ...remoteProfile };
            }
            if (effRemoteSmartBudget && remSmartUpdated > Number(prev.smartBudget?.updatedAt || 0)) {
              next.smartBudget = effRemoteSmartBudget;
            }
            return next;
          });
          setTimeout(() => {
            isApplyingRemoteSyncRef.current = false;
          }, 100);
        }
      },
    });

    unsubV4ListenersRef.current = unsub;
  }, []);

  const isFlushingQueueRef = useRef(false);

  const handleReconnectAndFlush = useCallback(async () => {
    if (!auth.currentUser || !isSyncUnlockedRef.current) return;
    const uid = auth.currentUser.uid;
    if (localStorage.getItem('mm_bound_account_uid') !== uid) return;
    if (!navigator.onLine) return;
    if (isFlushingQueueRef.current) return;

    isFlushingQueueRef.current = true;
    setIsSyncing(true);
    try {
      // 1. Flush any offline dirty items
      await flushGranularDirtyQueue(uid);

      // 2. Pull remote updates to reconcile
      const remote = await pullLatestRemoteState(uid);
      if (!remote) return;

      // Apply remote tombstones first
      const remoteTombs = Object.values(remote.tombstones || {});
      for (const t of remoteTombs) {
        if (t && t.id) {
          saveLocalTombstone(t);
        }
      }
      const allTombs = loadLocalTombstones();

      // Prevent echo loops
      isApplyingRemoteSyncRef.current = true;

      // Reconcile transactions
      let txsChanged = false;
      const currentTxs = transactionsRef.current;
      const txMap = new Map<string, Transaction>(currentTxs.map((t) => [t.id, t]));
      const occMap = new Map<string, string>();

      // Remote deletes (by ID or occurrenceKey)
      for (const [id, tx] of txMap.entries()) {
        if (isTransactionTombstoned(tx, allTombs, Number(tx.updatedAt || tx.createdAt || 0))) {
          txMap.delete(id);
          txsChanged = true;
        } else {
          const occKey =
            tx.occurrenceKey ||
            (tx.recurringRuleId && tx.date
              ? buildOccurrenceKey(tx.recurringRuleId, tx.date, tx.time || '09:00')
              : undefined);
          if (occKey) occMap.set(occKey, id);
        }
      }
      // Remote upserts
      for (const rTx of Object.values(remote.transactions || {})) {
        if (!rTx || !rTx.id) continue;
        const rUpdated = Number(rTx.updatedAt || rTx.createdAt || 0);
        if (isTransactionTombstoned(rTx, allTombs, rUpdated)) {
          continue;
        }
        const rOccKey =
          rTx.occurrenceKey ||
          (rTx.recurringRuleId && rTx.date
            ? buildOccurrenceKey(rTx.recurringRuleId, rTx.date, rTx.time || '09:00')
            : undefined);
        if (rOccKey && occMap.has(rOccKey) && occMap.get(rOccKey) !== rTx.id) {
          const existingId = occMap.get(rOccKey)!;
          const existingTx = txMap.get(existingId);
          if (existingTx && rUpdated > Number(existingTx.updatedAt || existingTx.createdAt || 0)) {
            txMap.delete(existingId);
            txMap.set(rTx.id, { ...rTx, occurrenceKey: rOccKey });
            occMap.set(rOccKey, rTx.id);
            txsChanged = true;
          }
          continue;
        }
        const loc = txMap.get(rTx.id);
        if (!loc || rUpdated > Number(loc.updatedAt || loc.createdAt || 0)) {
          const stampedR = rOccKey ? { ...rTx, occurrenceKey: rOccKey } : rTx;
          txMap.set(rTx.id, stampedR);
          if (rOccKey) occMap.set(rOccKey, rTx.id);
          txsChanged = true;
        }
      }
      const nextTxs = txsChanged
        ? Array.from(txMap.values()).sort(compareTxChronologicallyDesc)
        : currentTxs;
      if (txsChanged) {
        setTransactions(nextTxs);
      }

      // Reconcile accounts
      let accsChanged = false;
      const currentAccs = accountsRef.current;
      const accMap = new Map<string, Account>(currentAccs.map((a) => [a.id, a]));
      for (const [id, acc] of accMap.entries()) {
        if (allTombs[id] && allTombs[id].deletedAt > Number(acc.updatedAt || 0)) {
          accMap.delete(id);
          accsChanged = true;
        }
      }
      for (const rAcc of Object.values(remote.accounts || {})) {
        if (!rAcc || !rAcc.id) continue;
        if (allTombs[rAcc.id] && allTombs[rAcc.id].deletedAt > Number(rAcc.updatedAt || 0)) {
          continue;
        }
        const loc = accMap.get(rAcc.id);
        const rUpdated = Number(rAcc.updatedAt || 0);
        if (!loc || rUpdated > Number(loc.updatedAt || 0)) {
          accMap.set(rAcc.id, rAcc);
          accsChanged = true;
        }
      }
      if (accsChanged || txsChanged) {
        const remainingAccounts = Array.from(accMap.values());
        const syncedAccounts = syncAllAccountBalances(remainingAccounts, nextTxs);
        setAccounts(syncedAccounts);
      }

      // Reconcile categories
      let catsChanged = false;
      const currentCats = categoriesRef.current;
      const catMap = new Map<string, Category>(currentCats.map((c) => [c.id, c]));
      for (const [id, cat] of catMap.entries()) {
        if (allTombs[id] && allTombs[id].deletedAt > Number(cat.updatedAt || 0)) {
          catMap.delete(id);
          catsChanged = true;
        }
      }
      for (const rCat of Object.values(remote.categories || {})) {
        if (!rCat || !rCat.id) continue;
        if (allTombs[rCat.id] && allTombs[rCat.id].deletedAt > Number(rCat.updatedAt || 0)) {
          continue;
        }
        const loc = catMap.get(rCat.id);
        const rUpdated = Number(rCat.updatedAt || 0);
        if (!loc || rUpdated > Number(loc.updatedAt || 0)) {
          catMap.set(rCat.id, rCat);
          catsChanged = true;
        }
      }
      if (catsChanged) {
        setCategories(Array.from(catMap.values()));
      }

      // Reconcile recurring
      let recsChanged = false;
      const currentRecs = recurringTransactionsRef.current;
      const recMap = new Map<string, RecurringTransaction>(currentRecs.map((r) => [r.id, r]));
      for (const [id, rec] of recMap.entries()) {
        if (allTombs[id] && allTombs[id].deletedAt > Number(rec.updatedAt || rec.createdAt || 0)) {
          recMap.delete(id);
          recsChanged = true;
        }
      }
      for (const rRec of Object.values(remote.recurring || {})) {
        if (!rRec || !rRec.id) continue;
        if (allTombs[rRec.id] && allTombs[rRec.id].deletedAt > Number(rRec.updatedAt || rRec.createdAt || 0)) {
          continue;
        }
        const loc = recMap.get(rRec.id);
        const rUpdated = Number(rRec.updatedAt || rRec.createdAt || 0);
        if (!loc || rUpdated > Number(loc.updatedAt || loc.createdAt || 0)) {
          recMap.set(rRec.id, mergeRecurringRuleWatermarks(rRec, loc));
          recsChanged = true;
        }
      }
      if (recsChanged) {
        setRecurringTransactions(Array.from(recMap.values()));
      }

      // Reconcile manifest (settings / profile / smartBudget)
      if (remote.manifest) {
        const remoteSettings = remote.manifest.settings;
        const remoteProfile = remote.manifest.profile;
        const remoteSmartBudget = remote.manifest.smartBudget || remoteSettings?.smartBudget;
        const curSettingsUpdated = Number(settingsRef.current.updatedAt || 0);
        const remSettingsUpdated = Number(remoteSettings?.updatedAt || 0);
        const curSmartUpdated = Number(settingsRef.current.smartBudget?.updatedAt || 0);
        const remSmartUpdated = Number(remoteSmartBudget?.updatedAt || 0);

        if (remSettingsUpdated > curSettingsUpdated || remSmartUpdated > curSmartUpdated) {
          setSettings((prev) => {
            const next = { ...prev };
            if (remoteSettings && remSettingsUpdated > Number(prev.updatedAt || 0)) {
              Object.assign(next, remoteSettings);
            }
            if (remoteProfile) {
              next.userProfile = { ...prev.userProfile, ...remoteProfile };
            }
            if (remoteSmartBudget && remSmartUpdated > Number(prev.smartBudget?.updatedAt || 0)) {
              next.smartBudget = remoteSmartBudget;
            }
            return next;
          });
        }
      }

      setTimeout(() => {
        isApplyingRemoteSyncRef.current = false;
      }, 200);
      recordSyncActivity();
    } catch (err) {
      console.warn('[AppContext] handleReconnectAndFlush error:', err);
      isApplyingRemoteSyncRef.current = false;
    } finally {
      isFlushingQueueRef.current = false;
      setIsSyncing(false);
      recordSyncActivity();
    }
  }, []);

  // Task 7 & 8: Reconnection auto-flush listeners (.info/connected + window online) and sync state tracking
  useEffect(() => {
    const onOnline = () => {
      setIsDeviceOnline(true);
      setIsConnectedToRtdb(true);
      recordSyncActivity();
      if (isSyncUnlockedRef.current) {
        handleReconnectAndFlush();
      }
    };
    const onOffline = () => {
      setIsDeviceOnline(false);
      setIsConnectedToRtdb(false);
      recordSyncActivity();
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    let unsubConnected: (() => void) | null = null;
    if (rtdb) {
      try {
        const connectedRef = ref(rtdb, '.info/connected');
        const listener = onValue(connectedRef, (snap: DataSnapshot) => {
          const val = snap.val();
          if (val === true) {
            setIsConnectedToRtdb(true);
            setIsDeviceOnline(true);
            if (isSyncUnlockedRef.current) {
              handleReconnectAndFlush();
            }
          } else if (val === false) {
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
              setIsConnectedToRtdb(false);
            }
          }
          recordSyncActivity();
        });
        unsubConnected = () => {
          try {
            if (rtdb) off(connectedRef, 'value', listener as any);
          } catch {}
        };
      } catch (err) {
        console.warn('[Sync] .info/connected listener failed:', err);
      }
    }

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      if (unsubConnected) unsubConnected();
    };
  }, [handleReconnectAndFlush, recordSyncActivity]);

  const attachRemoteBackupListener = useCallback((uid: string) => {
    if (!uid) return;
    if (unsubRemoteBackupRef.current) {
      unsubRemoteBackupRef.current();
      unsubRemoteBackupRef.current = null;
    }
    unsubRemoteBackupRef.current = subscribeToCloudBackup(uid, (remoteBackup) => {
      if (!isMountedRef.current || !remoteBackup || typeof remoteBackup !== 'object') return;
      if (isCloudBackupBlockedStatus()) return;
      if (pendingSyncConflictRef.current || pendingCloudBackupRef.current) return;
      if (localStorage.getItem('mm_bound_account_uid') !== uid) return;

      const remoteUpdatedAt = Number(
        remoteBackup.updatedAt ||
        remoteBackup.timestamp ||
        (remoteBackup.backupDate ? new Date(remoteBackup.backupDate).getTime() : 0) ||
        remoteBackup.serverUpdatedAt ||
        0
      );
      const localUpdatedAt = Number(localStorage.getItem('mm_last_local_data_update')) || 0;

      if (remoteUpdatedAt > localUpdatedAt + 1000) {
        console.log('[AppContext] Remote cloud change detected. Silently applying latest cloud snapshot.');
        applyCloudData(remoteBackup);
        localStorage.setItem('mm_last_local_data_update', String(remoteUpdatedAt));
      }
    });
  }, []);

  /**
   * Immediately hydrates full profile & 16-digit ID upon cloud restore or merge,
   * restoring local state and publishing to shared_accounts/profile_${clean16Id} in Firebase RTDB.
   */
  const hydrateAndPublishUserProfile = async (uid: string, cloudBackupData?: any) => {
    try {
      const d = cloudBackupData || {};
      const backupProfile = d.userProfile || d.settings?.userProfile || {};

      // 1. Resolve permanent 16-digit numeric ID from users/${uid}/numeric16Id, profile, or cloud backup hint
      const fallbackHint = backupProfile.numericId || settingsRef.current.userProfile?.numericId;
      const resolvedId = await resolvePermanent16DigitId(uid, fallbackHint);
      const clean16Id = cleanNumericId(resolvedId);

      // 2. Resolve display name, avatar, and photoURL
      const currentUser = auth.currentUser || getCachedAuthUser();
      const suggestedName =
        currentUser?.displayName || (currentUser?.email ? currentUser.email.split('@')[0] : 'User');
      const cloudName = backupProfile.name;
      const currentName = settingsRef.current.userProfile?.name;

      const finalName =
        cloudName && cloudName !== 'User' && cloudName !== 'My Profile' && cloudName.trim() !== ''
          ? cloudName
          : currentName && currentName !== 'User' && currentName !== 'My Profile' && currentName.trim() !== ''
          ? currentName
          : suggestedName;

      const finalAvatar = backupProfile.avatarEmoji || settingsRef.current.userProfile?.avatarEmoji || '👤';
      const finalPhoto =
        backupProfile.customAvatarUrl ||
        settingsRef.current.userProfile?.customAvatarUrl ||
        currentUser?.photoURL ||
        '';

      // 3. Resolve Google Drive storage permission resolution status across devices
      let driveAccessGranted = Boolean(
        backupProfile.driveAccessGranted ??
        d.settings?.userProfile?.driveAccessGranted ??
        settingsRef.current.userProfile?.driveAccessGranted
      );
      let drivePromptResolved = Boolean(
        backupProfile.drivePromptResolved ??
        d.settings?.userProfile?.drivePromptResolved ??
        settingsRef.current.userProfile?.drivePromptResolved
      );

      // If not yet resolved from backup payload, inspect Firebase RTDB at users/${uid}/profile
      if (!drivePromptResolved) {
        try {
          const profSnap = await get(ref(rtdb, `users/${uid}/profile`));
          if (profSnap && profSnap.exists()) {
            const p = profSnap.val();
            if (p?.drivePromptResolved || p?.driveAccessGranted) {
              drivePromptResolved = true;
              if (p.driveAccessGranted) driveAccessGranted = true;
            }
          }
        } catch {}
      }

      // Fallback inspect shared_accounts/profile_${clean16Id}
      if (!drivePromptResolved && clean16Id.length === 16) {
        try {
          const sharedSnap = await get(ref(rtdb, `shared_accounts/profile_${clean16Id}`));
          if (sharedSnap && sharedSnap.exists()) {
            const sp = sharedSnap.val();
            if (sp?.drivePromptResolved || sp?.driveAccessGranted) {
              drivePromptResolved = true;
              if (sp.driveAccessGranted) driveAccessGranted = true;
            }
          }
        } catch {}
      }

      // Check local storage flags
      if (typeof localStorage !== 'undefined') {
        if (localStorage.getItem(`mm_drive_perm_prompted_${uid}`) === 'true') {
          drivePromptResolved = true;
        }
        if (localStorage.getItem(`mm_drive_access_granted_${uid}`) === 'true') {
          driveAccessGranted = true;
        }
      }
      if (getGoogleDriveAccessToken()) {
        driveAccessGranted = true;
        drivePromptResolved = true;
      }

      // Persist locally if resolved on account so this device never prompts again!
      if (drivePromptResolved) {
        try {
          localStorage.setItem(`mm_drive_perm_prompted_${uid}`, 'true');
          if (driveAccessGranted) {
            localStorage.setItem(`mm_drive_access_granted_${uid}`, 'true');
          }
        } catch {}
      }

      // 4. Update local state and localStorage immediately
      setSettings((prev) => ({
        ...prev,
        userProfile: {
          ...prev.userProfile,
          uid: uid,
          numericId: clean16Id,
          name: finalName,
          avatarEmoji: finalAvatar,
          customAvatarUrl: finalPhoto,
          driveAccessGranted: driveAccessGranted || prev.userProfile?.driveAccessGranted,
          drivePromptResolved: drivePromptResolved || prev.userProfile?.drivePromptResolved,
        },
      }));

      try {
        localStorage.setItem('app_permanent_16digit_id', clean16Id);
      } catch {}

      // 5. Publish immediately to Firebase RTDB at shared_accounts/profile_${clean16Id} and users/${uid}/profile
      if (typeof navigator !== 'undefined' && navigator.onLine && clean16Id.length === 16) {
        await publishUserProfileCard({
          numericId: clean16Id,
          name: finalName,
          avatar: finalAvatar,
          photoURL: finalPhoto,
          uid: uid,
          driveAccessGranted,
          drivePromptResolved,
        }).catch((err) => console.warn('[AppContext] Profile cloud publish note:', err));

        // Also publish to numericIds/${clean16Id} for reverse UID lookup
        await syncNumericIdToFirebase(
          clean16Id,
          uid,
          finalName,
          currentUser?.email || ''
        ).catch((err) => console.warn('[AppContext] Numeric ID sync note:', err));
      }

      return { clean16Id, finalName, finalAvatar, finalPhoto };
    } catch (err) {
      console.warn('[AppContext] Error hydrating user profile:', err);
      return null;
    }
  };

  // Strictly ensure that EVERY time a user signs in, the app:
  // 1. Checks device account binding ('mm_bound_account_uid'): if already bound, NEVER prompts with conflict modal on refresh.
  // 2. Checks Google Drive first (and Firebase users/${uid}/cloud_backup as fallback) for existing data.
  // 3. Silently syncs newest state (cloud.updatedAt vs. local.updatedAt) without interruption.
  // 4. ONLY prompts with "Merge vs. Replace" during a true initial transition from an unbound guest state with local transactions.
  useEffect(() => {
    let isMounted = true;

    const syncIdentity = async (user: any) => {
      if (!user) {
        const cached = getCachedAuthUser();
        if (cached) {
          return;
        }
        localStorage.removeItem('mm_bound_account_uid');
        localStorage.removeItem('mm_cached_authenticated_user');
        localStorage.removeItem('google_drive_access_token');
        clearUserIdentityState();
        clearInMemorySharedApiKey();
        lastRestoredUidRef.current = null;
        isCloudHydratedRef.current = false;
        isSyncUnlockedRef.current = false;
        setCloudBackupBlocked(true);
        setPendingSyncConflict(null);
        setPendingCloudBackup(null);
        if (unsubV4ListenersRef.current) {
          unsubV4ListenersRef.current();
          unsubV4ListenersRef.current = null;
        }
        if (unsubRemoteBackupRef.current) {
          unsubRemoteBackupRef.current();
          unsubRemoteBackupRef.current = null;
        }

        // Guest user: immediately reset userProfile to clean default Guest profile
        const cleanGuestProfile = {
          name: 'Guest',
          avatarEmoji: '👤',
          customAvatarUrl: '',
          numericId: '',
          uid: undefined,
        };
        setSettings((prev) => {
          const next = {
            ...prev,
            userProfile: cleanGuestProfile,
          };
          saveSettings(next);
          return next;
        });
        return;
      }

      try {
        setCachedAuthUser({
          uid: user.uid,
          email: user.email || null,
          displayName: user.displayName || null,
          photoURL: user.photoURL || null,
          phoneNumber: user.phoneNumber || null,
        });

        // Fetch user's private Gemini API key from secure secrets path if available
        fetchGeminiApiKeyFromCloud(user.uid).catch((err) => {
          console.warn('[AppContext] fetchGeminiApiKeyFromCloud error:', err);
        });

        const boundUid = localStorage.getItem('mm_bound_account_uid');
        const isDeviceBoundToUser = boundUid === user.uid;

        if (!isDeviceBoundToUser) {
          // STAGE 1: SIGN-IN FREEZE & CLOUD INSPECTION
          isSyncUnlockedRef.current = false;
          setCloudBackupBlocked(true);
          isCloudHydratedRef.current = false;

          try {
            const cloudRes = await fetchCloudAccountSnapshot(user.uid);
            const pendingSnapshot = cloudRes?.snapshot;

            // STAGE 2: DECISION GATE
            const localHasData = hasUserData({
              transactions: transactionsRef.current,
              recurringTransactions: recurringTransactionsRef.current,
              budgets: (pendingSnapshot?.budgets || []),
              accounts: accountsRef.current,
              categories: categoriesRef.current,
            });
            const cloudHasData = hasUserData(pendingSnapshot);

            if (cloudHasData && !localHasData) {
              // 2a. Cloud has data, local device empty -> Auto-hydrate
              console.log('[AppContext] Unbound sign-in on empty device: Auto-hydrating cloud snapshot.');
              applyCloudData(pendingSnapshot);
              await hydrateAndPublishUserProfile(user.uid, pendingSnapshot);
              localStorage.setItem('mm_bound_account_uid', user.uid);
              isSyncUnlockedRef.current = true;
              setCloudBackupBlocked(false);
              isCloudHydratedRef.current = true;
              setPendingSyncConflict(null);
              setPendingCloudBackup(null);

              // STAGE 3 & 4: V4 Migration & Live Listeners
              await writeV4ResolvedState(user.uid, {
                transactions: transactionsRef.current,
                recurringTransactions: recurringTransactionsRef.current,
                accounts: accountsRef.current,
                categories: categoriesRef.current,
                settings: settingsRef.current,
                userProfile: settingsRef.current.userProfile,
                tombstones: loadLocalTombstones(),
              });
              attachV4ListenersForUser(user.uid);
              if (navigator.onLine && hasGranularDirtyItems()) {
                handleReconnectAndFlush();
              }

              showToast(
                isArabic
                  ? 'تمت استعادة حساباتك وبياناتك تلقائياً من النسخة السحابية!'
                  : 'All accounts & data automatically restored from Cloud Backup!',
                'success'
              );
            } else if (!cloudHasData && localHasData) {
              // 2b. Cloud empty, local device has data -> Upload local data to v4 nodes
              console.log('[AppContext] Local data exists, cloud is empty: Uploading to v4 nodes.');
              localStorage.setItem('mm_bound_account_uid', user.uid);
              isSyncUnlockedRef.current = true;
              setCloudBackupBlocked(false);
              isCloudHydratedRef.current = true;
              setPendingSyncConflict(null);
              setPendingCloudBackup(null);
              await hydrateAndPublishUserProfile(user.uid);

              // STAGE 3 & 4
              await writeV4ResolvedState(user.uid, {
                transactions: transactionsRef.current,
                recurringTransactions: recurringTransactionsRef.current,
                accounts: accountsRef.current,
                categories: categoriesRef.current,
                settings: settingsRef.current,
                userProfile: settingsRef.current.userProfile,
                tombstones: loadLocalTombstones(),
              });
              attachV4ListenersForUser(user.uid);
              if (navigator.onLine && hasGranularDirtyItems()) {
                handleReconnectAndFlush();
              }
            } else if (!cloudHasData && !localHasData) {
              // 2c. Neither has data -> Bind and unlock
              console.log('[AppContext] Both local and cloud are empty: Binding and unlocking.');
              localStorage.setItem('mm_bound_account_uid', user.uid);
              isSyncUnlockedRef.current = true;
              setCloudBackupBlocked(false);
              isCloudHydratedRef.current = true;
              setPendingSyncConflict(null);
              setPendingCloudBackup(null);
              await hydrateAndPublishUserProfile(user.uid);

              // STAGE 3 & 4
              await writeV4ResolvedState(user.uid, {
                transactions: transactionsRef.current,
                recurringTransactions: recurringTransactionsRef.current,
                accounts: accountsRef.current,
                categories: categoriesRef.current,
                settings: settingsRef.current,
                userProfile: settingsRef.current.userProfile,
                tombstones: loadLocalTombstones(),
              });
              attachV4ListenersForUser(user.uid);
              if (navigator.onLine && hasGranularDirtyItems()) {
                handleReconnectAndFlush();
              }
            } else {
              // 2d. BOTH have data -> Keep locked and show Replace vs. Merge modal
              console.log('[AppContext] Data conflict detected between local and cloud: Engaging decision gate.');
              isSyncUnlockedRef.current = false;
              setCloudBackupBlocked(true);
              setPendingCloudBackup(pendingSnapshot);
              setPendingSyncConflict({
                uid: user.uid,
                cloudBackup: pendingSnapshot,
                cloudProvider: cloudRes?.provider || 'firebase',
                localCount: transactionsRef.current.filter((t) => !t.isUneditable).length,
                cloudCount: Array.isArray(pendingSnapshot.transactions) ? pendingSnapshot.transactions.length : 0,
                cloudAccountsCount: Array.isArray(pendingSnapshot.accounts) ? pendingSnapshot.accounts.length : 0,
              });
            }
          } catch (restoreErr) {
            console.warn('[AppContext] Cloud inspection on login failed:', restoreErr);
          }
        } else {
          // Device already bound to this user:
          isSyncUnlockedRef.current = true;
          setCloudBackupBlocked(false);
          isCloudHydratedRef.current = true;
          setPendingSyncConflict(null);
          setPendingCloudBackup(null);
          await hydrateAndPublishUserProfile(user.uid);

          // STAGE 3 & 4
          await writeV4ResolvedState(user.uid, {
            transactions: transactionsRef.current,
            recurringTransactions: recurringTransactionsRef.current,
            accounts: accountsRef.current,
            categories: categoriesRef.current,
            settings: settingsRef.current,
            userProfile: settingsRef.current.userProfile,
            tombstones: loadLocalTombstones(),
          });
          attachV4ListenersForUser(user.uid);
          if (navigator.onLine && hasGranularDirtyItems()) {
            handleReconnectAndFlush();
          }
        }
      } catch (err) {
        console.warn('[AppContext] syncIdentity auth error:', err);
      }
    };

    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        syncIdentity(user);
      } else {
        const cached = getCachedAuthUser();
        if (cached) {
          console.log('[AppContext] Network offline: Preserving cached user session', cached.uid);
          syncIdentity(cached);
        } else {
          syncIdentity(null);
        }
      }
    });

    if (auth.currentUser) {
      syncIdentity(auth.currentUser);
    } else {
      const cached = getCachedAuthUser();
      if (cached) {
        syncIdentity(cached);
      }
    }

    return () => {
      isMounted = false;
      if (unsubRemoteBackupRef.current) {
        unsubRemoteBackupRef.current();
        unsubRemoteBackupRef.current = null;
      }
      if (unsubV4ListenersRef.current) {
        unsubV4ListenersRef.current();
        unsubV4ListenersRef.current = null;
      }
      unsubAuth();
    };
  }, []);

    // Modals open/close handlers
  const openAddTxModal = (
    preselectedAccountId?: string,
    initialAmount?: number,
    initialIsRecurring?: boolean
  ) => {
    const targetAccountId =
      preselectedAccountId ||
      selectedAccountId ||
      (accounts[0] ? accounts[0].id : undefined);
    setDefaultTxAccountId(targetAccountId);
    setDefaultTxAmount(initialAmount);
    setDefaultTxIsRecurring(Boolean(initialIsRecurring));
    setEditingTx(null);
    setEditingRecurring(null);
    setIsAddTxModalOpen(true);
  };

  const closeAddTxModal = () => {
    setIsAddTxModalOpen(false);
    setEditingTx(null);
    setEditingRecurring(null);
    setDefaultTxAccountId(undefined);
    setDefaultTxAmount(undefined);
  };

  const openEditTxModal = (tx: Transaction) => {
    setEditingRecurring(null);
    setEditingTx(tx);
    setIsAddTxModalOpen(true);
  };

  const closeEditTxModal = () => {
    setEditingTx(null);
    setEditingRecurring(null);
    setIsAddTxModalOpen(false);
    setDefaultTxAccountId(undefined);
    setDefaultTxAmount(undefined);
  };

  const openEditRecurringModal = (rule: RecurringTransaction) => {
    setEditingTx(null);
    setEditingRecurring(rule);
    setDefaultTxIsRecurring(true);
    setIsAddTxModalOpen(true);
  };

  const openTxDetailsModal = (tx: Transaction) => {
    setViewingTx(tx);
  };

  const closeTxDetailsModal = () => {
    setViewingTx(null);
  };

  const openAddAccountModal = () => {
    setEditingAccount(null);
    setIsAccountModalOpen(true);
  };

  const openEditAccountModal = (acc: Account) => {
    setEditingAccount(acc);
    setIsAccountModalOpen(true);
  };

  const closeAccountModal = () => {
    setIsAccountModalOpen(false);
    setEditingAccount(null);
  };

  const openAddCategoryModal = (defaultType: 'expense' | 'income' = 'expense') => {
    setDefaultCategoryType(defaultType);
    setEditingCategory(null);
    setIsCategoryModalOpen(true);
  };

  const openEditCategoryModal = (cat: Category) => {
    setDefaultCategoryType(cat.type);
    setEditingCategory(cat);
    setIsCategoryModalOpen(true);
  };

  const closeCategoryModal = () => {
    setIsCategoryModalOpen(false);
    setEditingCategory(null);
    setDefaultCategoryType('expense');
  };

  const openEmojiPicker = (onSelect: (emoji: string) => void) => {
    setEmojiCallback(() => onSelect);
    setIsEmojiPickerOpen(true);
  };

  const closeEmojiPicker = () => {
    setIsEmojiPickerOpen(false);
    setEmojiCallback(null);
  };

  const selectEmoji = (emoji: string) => {
    if (emojiCallback) {
      emojiCallback(emoji);
    }
    closeEmojiPicker();
  };

  const clearAdvancedFilter = () => {
    setAdvancedFilter({
      accountIds: [],
      categoryIds: [],
      minAmount: undefined,
      maxAmount: undefined,
      type: 'all',
      searchQuery: undefined,
    });
  };

  // Linked Budget Adjustment Helpers for Reversible Savings/Investment Withdrawals
  const reconcileTransferAdjustment = (
    tx: Transaction,
    currentAccounts: Account[]
  ): {
    finalTx: Transaction;
    upsertAdjustment?: BudgetAdjustment;
    removeAdjustmentId?: string;
  } => {
    const nowTs = Date.now();
    const adjId = tx.linkedAdjustmentId || `adj_tx_${tx.id}`;

    if (tx.type === 'transfer' && tx.toAccountId && tx.accountId !== tx.toAccountId) {
      const fromAcc = currentAccounts.find((a) => a.id === tx.accountId);
      const toAcc = currentAccounts.find((a) => a.id === tx.toAccountId);
      const fromRole = fromAcc?.accountRole || 'spending';
      const toRole = toAcc?.accountRole || 'spending';
      const isSavingsWithdrawal =
        (fromRole === 'savings' || fromRole === 'investment') && toRole === 'spending';

      if (isSavingsWithdrawal) {
        const choice = tx.savingsWithdrawalChoice || tx.budgetAdjustment?.choice || 'just_moving';
        const adj: BudgetAdjustment = {
          id: adjId,
          linkedTransferId: tx.id,
          date: tx.date,
          amount: tx.amount,
          amountMinor: Math.round(tx.amount * 100),
          choice,
          fromAccountId: tx.accountId,
          toAccountId: tx.toAccountId,
          createdAt: tx.budgetAdjustment?.createdAt || tx.createdAt || nowTs,
          updatedAt: nowTs,
        };
        return {
          finalTx: {
            ...tx,
            savingsWithdrawalChoice: choice,
            linkedAdjustmentId: adjId,
            budgetAdjustment: adj,
            updatedAt: nowTs,
          },
          upsertAdjustment: adj,
        };
      }
    }

    return {
      finalTx: {
        ...tx,
        savingsWithdrawalChoice: undefined,
        linkedAdjustmentId: undefined,
        budgetAdjustment: undefined,
        updatedAt: nowTs,
      },
      removeAdjustmentId: adjId,
    };
  };

  const syncAdjustmentsInSettings = (
    upsertAdj?: BudgetAdjustment,
    removeIds?: string[]
  ) => {
    const currentAdjustments = settings.smartBudget?.adjustments || {};
    let changed = false;
    const nextAdjustments: Record<string, BudgetAdjustment> = { ...currentAdjustments };

    if (removeIds && removeIds.length > 0) {
      for (const rId of removeIds) {
        if (rId && nextAdjustments[rId]) {
          delete nextAdjustments[rId];
          changed = true;
        }
      }
    }

    if (upsertAdj) {
      nextAdjustments[upsertAdj.id] = upsertAdj;
      changed = true;
    }

    if (!changed) return;

    const nowTs = Date.now();
    const nextSettings: AppSettings = {
      ...settings,
      updatedAt: nowTs,
      smartBudget: {
        baseline: settings.smartBudget?.baseline || {},
        overrides: settings.smartBudget?.overrides || {},
        adjustments: nextAdjustments,
        updatedAt: nowTs,
      },
    };
    setSettings(nextSettings);
    saveSettings(nextSettings);
    if (auth.currentUser && isSyncUnlockedRef.current) {
      const uid = auth.currentUser.uid;
      triggerGranularPush(() =>
        writeGranularManifest(uid, nextSettings, nextSettings.userProfile, isSyncUnlockedRef.current)
      );
    }
  };

  const removeLinkedAdjustmentsForTxs = (deletedTxs: Transaction[]) => {
    if (!deletedTxs || deletedTxs.length === 0) return;
    const idsToRemove: string[] = [];
    for (const tx of deletedTxs) {
      if (tx.linkedAdjustmentId) idsToRemove.push(tx.linkedAdjustmentId);
      idsToRemove.push(`adj_tx_${tx.id}`);
    }
    syncAdjustmentsInSettings(undefined, idsToRemove);
  };

  // CRUD TRANSACTIONS
  const addTransaction = (txData: Omit<Transaction, 'id' | 'createdAt'>) => {
    const nowTs = Date.now();
    const txId = `tx_${nowTs}_${Math.random().toString(36).slice(2, 7)}`;
    const hasTransferFee = Boolean(
      txData.type === 'transfer' &&
      txData.toAccountId &&
      txData.transferFee &&
      txData.transferFee > 0
    );
    const feeVal = hasTransferFee ? roundHalfUpToCents(txData.transferFee!) : undefined;

    let newTx: Transaction = {
      ...txData,
      id: txId,
      transferFee: feeVal,
      linkedFeeTxId: hasTransferFee ? `tx_fee_${txId}` : undefined,
      createdAt: nowTs,
      updatedAt: nowTs,
    };

    const { finalTx: reconciledTx, upsertAdjustment, removeAdjustmentId } =
      reconcileTransferAdjustment(newTx, accounts);
    newTx = reconciledTx;

    let linkedFeeTx: Transaction | null = null;
    let newlyCreatedCategory: Category | null = null;
    if (hasTransferFee && feeVal && feeVal > 0) {
      const feeEnsure = ensureBankFeesCategory(categories, settings.language);
      if (feeEnsure.created) {
        setCategories(feeEnsure.updatedCategories);
        newlyCreatedCategory = feeEnsure.category;
      }
      linkedFeeTx = buildLinkedTransferFeeTransaction(newTx, feeEnsure.category, settings.language);
    }

    let updatedTransactions = linkedFeeTx
      ? [...transactions, newTx, linkedFeeTx]
      : [...transactions, newTx];

    // If transfer transaction, compute and record before & after balances for BOTH accounts
    if (newTx.type === 'transfer' && newTx.toAccountId) {
      const fromAcc = accounts.find((a) => a.id === newTx.accountId);
      const toAcc = accounts.find((a) => a.id === newTx.toAccountId);
      if (fromAcc && toAcc) {
        const fromHist = getHistoricalBalance(newTx.id, fromAcc, updatedTransactions);
        const toHist = getHistoricalBalance(newTx.id, toAcc, updatedTransactions);
        newTx = {
          ...newTx,
          fromBalanceBefore: fromHist.balanceBefore,
          fromBalanceAfter: fromHist.balanceAfter,
          toBalanceBefore: toHist.balanceBefore,
          toBalanceAfter: toHist.balanceAfter,
        };
        if (linkedFeeTx) {
          const feeHist = getHistoricalBalance(linkedFeeTx.id, fromAcc, updatedTransactions);
          linkedFeeTx = {
            ...linkedFeeTx,
            balanceBefore: feeHist.balanceBefore,
            balanceAfter: feeHist.balanceAfter,
          };
        }
        updatedTransactions = linkedFeeTx
          ? [...transactions, newTx, linkedFeeTx]
          : [...transactions, newTx];
      }
    }

    setTransactions(updatedTransactions);

    // Sync account balances (deducts X + F from source account and adds X to destination account)
    const syncedAccounts = syncAllAccountBalances(accounts, updatedTransactions);
    setAccounts(syncedAccounts);

    // Sync linked budget adjustment if applicable
    if (upsertAdjustment || removeAdjustmentId) {
      syncAdjustmentsInSettings(
        upsertAdjustment,
        removeAdjustmentId ? [removeAdjustmentId] : undefined
      );
    }

    // Propagate transaction(s) to linked shared spaces in real-time
    propagateTransactionToLinkedSpaces('add', newTx, syncedAccounts).catch(() => {});
    if (linkedFeeTx) {
      propagateTransactionToLinkedSpaces('add', linkedFeeTx, syncedAccounts).catch(() => {});
    }

    if (auth.currentUser && isSyncUnlockedRef.current) {
      const uid = auth.currentUser.uid;
      if (newlyCreatedCategory) {
        const catToPush = newlyCreatedCategory;
        triggerGranularPush(() => writeGranularDelta(uid, 'categories', catToPush, isSyncUnlockedRef.current));
      }
      triggerGranularPush(() => writeGranularDelta(uid, 'transactions', newTx, isSyncUnlockedRef.current));
      if (linkedFeeTx) {
        const feeToPush = linkedFeeTx;
        triggerGranularPush(() => writeGranularDelta(uid, 'transactions', feeToPush, isSyncUnlockedRef.current));
      }
    }

    showToast(t('savedSuccess'), 'success');
  };

  const updateTransaction = (updatedTx: Transaction) => {
    const nowTs = Date.now();
    let finalTx: Transaction = {
      ...updatedTx,
      updatedAt: nowTs,
    };
    if (finalTx.recurringRuleId) {
      finalTx = {
        ...finalTx,
        isIndividuallyEdited: true,
      };
    }

    const { finalTx: reconciledTx, upsertAdjustment, removeAdjustmentId } =
      reconcileTransferAdjustment(finalTx, accounts);
    finalTx = reconciledTx;

    const existingFeeTx = transactions.find(
      (t) =>
        t.feeOfTransferId === finalTx.id ||
        (finalTx.linkedFeeTxId && t.id === finalTx.linkedFeeTxId)
    );

    const hasTransferFee = Boolean(
      finalTx.type === 'transfer' &&
      finalTx.toAccountId &&
      finalTx.transferFee &&
      finalTx.transferFee > 0
    );
    const feeVal = hasTransferFee ? roundHalfUpToCents(finalTx.transferFee!) : undefined;

    let upsertedFeeTx: Transaction | null = null;
    let deletedFeeTx: Transaction | null = null;
    let newlyCreatedCategory: Category | null = null;

    if (hasTransferFee && feeVal && feeVal > 0) {
      const feeEnsure = ensureBankFeesCategory(categories, settings.language);
      if (feeEnsure.created) {
        setCategories(feeEnsure.updatedCategories);
        newlyCreatedCategory = feeEnsure.category;
      }
      const feeTxId = existingFeeTx?.id || finalTx.linkedFeeTxId || `tx_fee_${finalTx.id}`;
      finalTx = {
        ...finalTx,
        transferFee: feeVal,
        linkedFeeTxId: feeTxId,
      };
      upsertedFeeTx = buildLinkedTransferFeeTransaction(
        finalTx,
        feeEnsure.category,
        settings.language,
        existingFeeTx
      );
    } else {
      finalTx = {
        ...finalTx,
        transferFee: undefined,
        linkedFeeTxId: undefined,
      };
      if (existingFeeTx) {
        deletedFeeTx = existingFeeTx;
      }
    }

    // If the user directly edited a linked fee transaction, keep its parent transfer's transferFee in sync
    let syncedParentTx: Transaction | null = null;
    if (finalTx.feeOfTransferId) {
      const parentTx = transactions.find((t) => t.id === finalTx.feeOfTransferId);
      if (parentTx && parentTx.type === 'transfer') {
        syncedParentTx = {
          ...parentTx,
          transferFee: roundHalfUpToCents(finalTx.amount),
          transferFeeMode: 'manual',
          transferFeeInputType: 'amount',
          transferFeeRawValue: roundHalfUpToCents(finalTx.amount),
          transferFeeBudgetPool: finalTx.budgetPool || parentTx.transferFeeBudgetPool || 'daily',
          updatedAt: nowTs,
        };
      }
    }

    let updatedList = transactions
      .filter((t) => !deletedFeeTx || t.id !== deletedFeeTx.id)
      .map((t) => {
        if (t.id === finalTx.id) return finalTx;
        if (upsertedFeeTx && t.id === upsertedFeeTx.id) return upsertedFeeTx;
        if (syncedParentTx && t.id === syncedParentTx.id) return syncedParentTx;
        return t;
      });

    if (upsertedFeeTx && !updatedList.some((t) => t.id === upsertedFeeTx!.id)) {
      updatedList = [...updatedList, upsertedFeeTx];
    }

    // If transfer transaction, recalculate and record before & after balances for BOTH accounts
    if (finalTx.type === 'transfer' && finalTx.toAccountId) {
      const fromAcc = accounts.find((a) => a.id === finalTx.accountId);
      const toAcc = accounts.find((a) => a.id === finalTx.toAccountId);
      if (fromAcc && toAcc) {
        const fromHist = getHistoricalBalance(finalTx.id, fromAcc, updatedList);
        const toHist = getHistoricalBalance(finalTx.id, toAcc, updatedList);
        finalTx = {
          ...finalTx,
          fromBalanceBefore: fromHist.balanceBefore,
          fromBalanceAfter: fromHist.balanceAfter,
          toBalanceBefore: toHist.balanceBefore,
          toBalanceAfter: toHist.balanceAfter,
        };
        if (upsertedFeeTx) {
          const feeHist = getHistoricalBalance(upsertedFeeTx.id, fromAcc, updatedList);
          upsertedFeeTx = {
            ...upsertedFeeTx,
            balanceBefore: feeHist.balanceBefore,
            balanceAfter: feeHist.balanceAfter,
          };
        }
        updatedList = updatedList.map((t) => {
          if (t.id === finalTx.id) return finalTx;
          if (upsertedFeeTx && t.id === upsertedFeeTx.id) return upsertedFeeTx;
          return t;
        });
      }
    }

    setTransactions(updatedList);

    const syncedAccounts = syncAllAccountBalances(accounts, updatedList);
    setAccounts(syncedAccounts);

    // Sync or reverse linked budget adjustment
    if (upsertAdjustment || removeAdjustmentId) {
      syncAdjustmentsInSettings(
        upsertAdjustment,
        removeAdjustmentId ? [removeAdjustmentId] : undefined
      );
    }

    // Propagate transaction(s) to linked shared spaces in real-time
    propagateTransactionToLinkedSpaces('update', finalTx, syncedAccounts).catch(() => {});
    if (upsertedFeeTx) {
      propagateTransactionToLinkedSpaces(
        existingFeeTx ? 'update' : 'add',
        upsertedFeeTx,
        syncedAccounts
      ).catch(() => {});
    }
    if (deletedFeeTx) {
      propagateTransactionToLinkedSpaces('delete', deletedFeeTx, syncedAccounts).catch(() => {});
    }
    if (syncedParentTx) {
      propagateTransactionToLinkedSpaces('update', syncedParentTx, syncedAccounts).catch(() => {});
    }

    // If currently viewing this transaction details, update it
    if (viewingTx && viewingTx.id === finalTx.id) {
      setViewingTx(finalTx);
    }

    if (deletedFeeTx) {
      recordTransactionTombstones(deletedFeeTx);
    }

    if (auth.currentUser && isSyncUnlockedRef.current) {
      const uid = auth.currentUser.uid;
      if (newlyCreatedCategory) {
        const catToPush = newlyCreatedCategory;
        triggerGranularPush(() => writeGranularDelta(uid, 'categories', catToPush, isSyncUnlockedRef.current));
      }
      triggerGranularPush(() => writeGranularDelta(uid, 'transactions', finalTx, isSyncUnlockedRef.current));
      if (upsertedFeeTx) {
        const feeToPush = upsertedFeeTx;
        triggerGranularPush(() => writeGranularDelta(uid, 'transactions', feeToPush, isSyncUnlockedRef.current));
      }
      if (syncedParentTx) {
        const parentToPush = syncedParentTx;
        triggerGranularPush(() => writeGranularDelta(uid, 'transactions', parentToPush, isSyncUnlockedRef.current));
      }
    }

    showToast(t('updatedSuccess'), 'success');
  };

  const deleteTransaction = (id: string) => {
    const txToDelete = transactions.find((t) => t.id === id);
    const linkedFeeTx = txToDelete
      ? transactions.find(
          (t) =>
            t.feeOfTransferId === txToDelete.id ||
            (txToDelete.linkedFeeTxId && t.id === txToDelete.linkedFeeTxId)
        )
      : undefined;

    const idsToDelete = new Set<string>([id]);
    if (linkedFeeTx) idsToDelete.add(linkedFeeTx.id);

    let clearedParentTx: Transaction | null = null;
    if (txToDelete?.feeOfTransferId) {
      const parentTx = transactions.find((t) => t.id === txToDelete.feeOfTransferId);
      if (parentTx && !idsToDelete.has(parentTx.id)) {
        clearedParentTx = {
          ...parentTx,
          transferFee: undefined,
          transferFeeMode: 'none',
          linkedFeeTxId: undefined,
          updatedAt: Date.now(),
        };
      }
    }

    const updatedList = transactions
      .filter((t) => !idsToDelete.has(t.id))
      .map((t) => (clearedParentTx && t.id === clearedParentTx.id ? clearedParentTx : t));
    setTransactions(updatedList);

    const syncedAccounts = syncAllAccountBalances(accounts, updatedList);
    setAccounts(syncedAccounts);

    if (txToDelete) {
      removeLinkedAdjustmentsForTxs(linkedFeeTx ? [txToDelete, linkedFeeTx] : [txToDelete]);
    }

    // Propagate transaction(s) to linked shared spaces in real-time
    propagateTransactionToLinkedSpaces('delete', txToDelete || ({ id } as Transaction), syncedAccounts).catch(() => {});
    if (linkedFeeTx) {
      propagateTransactionToLinkedSpaces('delete', linkedFeeTx, syncedAccounts).catch(() => {});
    }
    if (clearedParentTx) {
      propagateTransactionToLinkedSpaces('update', clearedParentTx, syncedAccounts).catch(() => {});
    }

    if (viewingTx && idsToDelete.has(viewingTx.id)) {
      setViewingTx(null);
    }

    const txsForTombstone: Transaction[] = [];
    if (txToDelete) txsForTombstone.push(txToDelete);
    if (linkedFeeTx) txsForTombstone.push(linkedFeeTx);
    recordTransactionTombstones(txsForTombstone, Array.from(idsToDelete));

    if (auth.currentUser && isSyncUnlockedRef.current && clearedParentTx) {
      const uid = auth.currentUser.uid;
      const pToPush = clearedParentTx;
      triggerGranularPush(() => writeGranularDelta(uid, 'transactions', pToPush, isSyncUnlockedRef.current));
    }

    showToast(t('deletedSuccess'), 'success');
  };

  // CRUD ACCOUNTS
  const addAccount = (accData: Omit<Account, 'id' | 'balance'>, initialBalance = 0) => {
    const nowTs = Date.now();
    const newAccId = `acc_${nowTs}_${Math.random().toString(36).slice(2, 6)}`;
    const newAcc: Account = {
      ...accData,
      id: newAccId,
      accountRole: accData.accountRole || 'spending',
      balance: initialBalance,
      updatedAt: nowTs,
    };

    let updatedTxs = [...transactions];
    let initialTx: Transaction | null = null;
    // If starting with non-zero balance, add initial balance transaction
    if (initialBalance !== 0) {
      const now = new Date();
      initialTx = {
        id: `tx_init_${nowTs}`,
        type: initialBalance > 0 ? 'income' : 'expense',
        amount: Math.abs(initialBalance),
        date: formatDateToYYYYMMDD(now),
        time: formatTimeToHHMM(now),
        accountId: newAccId,
        categoryName: 'Initial Balance',
        categoryIcon: '💵',
        description: 'Initial Account Balance',
        createdAt: nowTs,
        updatedAt: nowTs,
      };
      updatedTxs.push(initialTx);
      setTransactions(updatedTxs);
    }

    const updatedAccounts = syncAllAccountBalances([...accounts, newAcc], updatedTxs);
    setAccounts(updatedAccounts);

    if (auth.currentUser && isSyncUnlockedRef.current) {
      const uid = auth.currentUser.uid;
      triggerGranularPush(() => writeGranularDelta(uid, 'accounts', newAcc, isSyncUnlockedRef.current));
      if (initialBalance !== 0) {
        const txToPush = initialTx;
        triggerGranularPush(() => writeGranularDelta(uid, 'transactions', txToPush, isSyncUnlockedRef.current));
      }
    }

    showToast(t('savedSuccess'), 'success');
  };

  const updateAccount = (updatedAcc: Account, newBalanceTarget?: number) => {
    const nowTs = Date.now();
    const stampedAcc: Account = {
      ...updatedAcc,
      accountRole: updatedAcc.accountRole || 'spending',
      updatedAt: nowTs,
    };
    let currentTxs = [...transactions];

    if (typeof newBalanceTarget === 'number') {
      const existingAccount = accounts.find((a) => a.id === stampedAcc.id);
      const oldBalance = existingAccount ? existingAccount.balance : 0;
      const diff = newBalanceTarget - oldBalance;

      if (Math.abs(diff) >= 0.009) {
        const now = new Date();
        const symbol = settings.currencySymbol || '£';
        const adjustmentTx: Transaction = {
          id: `tx_adj_${nowTs}`,
          type: diff > 0 ? 'income' : 'expense',
          amount: Math.abs(diff),
          date: formatDateToYYYYMMDD(now),
          time: formatTimeToHHMM(now),
          accountId: stampedAcc.id,
          categoryName: 'Manual Adjustment',
          categoryIcon: '⚙️',
          isAdjustment: true,
          description: `Manual Adjustment: Changed from ${symbol}${oldBalance.toFixed(2)} to ${symbol}${newBalanceTarget.toFixed(2)}`,
          createdAt: nowTs,
          updatedAt: nowTs,
        };
        currentTxs = [...currentTxs, adjustmentTx];
        setTransactions(currentTxs);
      }
    }

    const updatedList = accounts.map((a) => (a.id === stampedAcc.id ? stampedAcc : a));
    const synced = syncAllAccountBalances(updatedList, currentTxs);
    setAccounts(synced);

    if (auth.currentUser && isSyncUnlockedRef.current) {
      triggerGranularPush(() => writeGranularDelta(auth.currentUser!.uid, 'accounts', stampedAcc, isSyncUnlockedRef.current));
    }

    showToast(t('updatedSuccess'), 'success');
  };

  const deleteAccount = (id: string): boolean => {
    if (accounts.length <= 1) {
      showToast(t('cannotDeleteOnlyAccount'), 'error');
      return false;
    }

    const directDelIds = new Set(
      transactions
        .filter((tx) => tx.accountId === id || tx.toAccountId === id)
        .map((tx) => tx.id)
    );
    const removedTxs = transactions.filter(
      (tx) =>
        directDelIds.has(tx.id) ||
        (tx.feeOfTransferId && directDelIds.has(tx.feeOfTransferId))
    );
    const removedDelIdSet = new Set(removedTxs.map((tx) => tx.id));
    // Remove transactions linked to this account
    const updatedTxs = transactions.filter((tx) => !removedDelIdSet.has(tx.id));
    setTransactions(updatedTxs);

    const remainingAccounts = accounts.filter((a) => a.id !== id);
    const synced = syncAllAccountBalances(remainingAccounts, updatedTxs);
    setAccounts(synced);
    removeLinkedAdjustmentsForTxs(removedTxs);
    recordTransactionTombstones(removedTxs);
    saveLocalTombstone({ id, collection: 'accounts', deletedAt: syncNow() });

    if (selectedAccountId === id) {
      setSelectedAccountId(null);
    }

    if (auth.currentUser && isSyncUnlockedRef.current) {
      const uid = auth.currentUser.uid;
      triggerGranularPush(() => writeGranularDeletion(uid, 'accounts', id, isSyncUnlockedRef.current));
    }

    showToast(t('deletedSuccess'), 'success');
    return true;
  };

  // CRUD CATEGORIES
  const addCategory = (catData: Omit<Category, 'id'>) => {
    const newCat: Category = {
      ...catData,
      id: `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      orderIndex: categories.length,
    };
    setCategories((prev) => [...prev, newCat]);

    if (auth.currentUser && isSyncUnlockedRef.current) {
      triggerGranularPush(() => writeGranularDelta(auth.currentUser!.uid, 'categories', newCat, isSyncUnlockedRef.current));
    }

    showToast(t('savedSuccess'), 'success');
  };

  const updateCategory = (updatedCat: Category) => {
    setCategories((prev) => prev.map((c) => (c.id === updatedCat.id ? updatedCat : c)));

    if (auth.currentUser && isSyncUnlockedRef.current) {
      triggerGranularPush(() => writeGranularDelta(auth.currentUser!.uid, 'categories', updatedCat, isSyncUnlockedRef.current));
    }

    showToast(t('updatedSuccess'), 'success');
  };

  const deleteCategory = (id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
    saveLocalTombstone({ id, collection: 'categories', deletedAt: syncNow() });

    if (auth.currentUser && isSyncUnlockedRef.current) {
      triggerGranularPush(() => writeGranularDeletion(auth.currentUser!.uid, 'categories', id, isSyncUnlockedRef.current));
    }

    showToast(t('deletedSuccess'), 'success');
  };

  const reorderCategories = (orderedIds: string[]) => {
    const map = new Map(categories.map((c) => [c.id, c]));
    const reordered: Category[] = [];
    orderedIds.forEach((id, idx) => {
      const cat = map.get(id);
      if (cat) {
        reordered.push({ ...cat, orderIndex: idx });
        map.delete(id);
      }
    });
    // Append any unmentioned categories
    map.forEach((cat) => {
      reordered.push({ ...cat, orderIndex: reordered.length });
    });
    setCategories(reordered);
    setSettings((prev) => ({ ...prev, categoryOrder: orderedIds }));
  };

  const reorderAccounts = (ordered: string[] | Account[]) => {
    let orderedIds: string[] = [];
    if (ordered.length > 0 && typeof ordered[0] === 'object') {
      orderedIds = (ordered as Account[]).map((a) => a.id);
    } else {
      orderedIds = ordered as string[];
    }
    const map = new Map(accounts.map((a) => [a.id, a]));
    const reordered: Account[] = [];
    orderedIds.forEach((id) => {
      const acc = map.get(id);
      if (acc) {
        reordered.push(acc);
        map.delete(id);
      }
    });
    map.forEach((acc) => {
      reordered.push(acc);
    });
    setAccounts(reordered);
    saveAccounts(reordered);
    setSettings((prev) => ({ ...prev, accountOrder: orderedIds }));
  };

  // SETTINGS
  const updateSettings = (newSettings: Partial<AppSettings>) => {
    const updated: AppSettings = { ...settings, ...newSettings };
    if (
      newSettings.defaultMonthStartDay !== undefined &&
      newSettings.defaultMonthStartDay !== settings.defaultMonthStartDay &&
      updated.smartBudget?.baseline
    ) {
      const oldStartDay = settings.defaultMonthStartDay || 1;
      const newStartDay = Math.max(1, Math.min(31, Math.round(newSettings.defaultMonthStartDay)));
      const now = new Date();
      const oldCycle = getSalaryCycleRange(now, oldStartDay);
      const newCycle = getSalaryCycleRange(now, newStartDay);
      const nextOverrides = { ...(updated.smartBudget.overrides || {}) };
      if (nextOverrides[oldCycle.startDate] && !nextOverrides[newCycle.startDate]) {
        nextOverrides[newCycle.startDate] = { ...nextOverrides[oldCycle.startDate] };
      }
      updated.smartBudget = {
        ...updated.smartBudget,
        baseline: {
          ...updated.smartBudget.baseline,
          startDay: newStartDay,
        },
        overrides: nextOverrides,
      };
    }
    setSettings(updated);
    if (auth.currentUser && isSyncUnlockedRef.current) {
      triggerGranularPush(() => writeGranularManifest(auth.currentUser!.uid, updated, updated.userProfile, isSyncUnlockedRef.current));
    }
    if (newSettings.userProfile) {
      const up = newSettings.userProfile;
      const clean16 = String(up.numericId || '').replace(/\D/g, '');
      if (clean16.length === 16) {
        publishUserProfileCard({
          numericId: clean16,
          name: up.name || 'User',
          avatar: up.avatarEmoji || '👤',
          photoURL: up.customAvatarUrl || '',
          uid: auth.currentUser?.uid || up.uid,
          driveAccessGranted: up.driveAccessGranted,
          drivePromptResolved: up.drivePromptResolved,
        }).catch((err) => console.warn('[AppContext] publishUserProfileCard error:', err));
        propagateUserProfileToAllSharedSpaces({
          numericId: clean16,
          name: up.name || 'User',
          avatar: up.avatarEmoji || '👤',
          photoURL: up.customAvatarUrl || '',
          uid: auth.currentUser?.uid || up.uid,
        }).catch((err) => console.warn('[AppContext] propagateUserProfileToAllSharedSpaces error:', err));
      }
    }
    showToast(t('updatedSuccess'), 'success');
  };

  const applyPeriodReset = (type: 'now' | 'custom' | 'revert', customDate?: string) => {
    if (type === 'revert') {
      setSettings((prev) => {
        const next = { ...prev };
        delete next.resetStartDate;
        return next;
      });
      showToast(t('updatedSuccess'), 'success');
    } else if (type === 'now') {
      const nowIso = new Date().toISOString();
      setSettings((prev) => ({ ...prev, resetStartDate: nowIso }));
      showToast(t('updatedSuccess'), 'success');
    } else if (type === 'custom' && customDate) {
      setSettings((prev) => ({ ...prev, resetStartDate: customDate }));
      showToast(t('updatedSuccess'), 'success');
    }
    setIsResetPeriodModalOpen(false);
  };

  // Immediate Sign-Out: wipes cached auth, resets identity, and clears userProfile to clean Guest state
  const signOutUser = async (): Promise<void> => {
    try {
      // 1. Unsubscribe active remote backup listener immediately
      if (unsubRemoteBackupRef.current) {
        unsubRemoteBackupRef.current();
        unsubRemoteBackupRef.current = null;
      }

      // 2. Perform low-level auth & storage cleanup
      await logoutUser();
      clearUserIdentityState();
      removeLocalGeminiApiKeyOnSignOut();
      clearInMemorySharedApiKey();

      // 3. Reset internal cloud hydration and conflict refs
      lastRestoredUidRef.current = null;
      isCloudHydratedRef.current = false;
      setCloudBackupBlocked(false);
      setPendingSyncConflict(null);
      setPendingCloudBackup(null);

      // 4. Immediately reset userProfile state and storage back to clean Guest profile
      const cleanGuestProfile = {
        name: 'Guest',
        avatarEmoji: '👤',
        customAvatarUrl: '',
        numericId: '',
        uid: undefined,
      };

      setSettings((prev) => {
        const next = {
          ...prev,
          userProfile: cleanGuestProfile,
        };
        saveSettings(next);
        return next;
      });

      // 5. Notify all components
      try {
        window.dispatchEvent(new CustomEvent('app_user_signed_out'));
      } catch {}

      showToast(
        settings.language === 'ar' ? 'تم تسجيل الخروج بنجاح' : 'Signed out successfully',
        'info'
      );
    } catch (err: any) {
      console.error('[AppContext] Error signing out user:', err);
      showToast(err?.message || 'Failed to sign out', 'error');
    }
  };

  // IMPORT / RESTORE (Supports both 100% full backups and granular customized exports)
  const importFullData = (data: Partial<AppData>): boolean => {
    try {
      if (!data || typeof data !== 'object') {
        showToast(t('invalidFileError'), 'error');
        return false;
      }

      let targetAccounts = accounts;
      let targetCategories = categories;
      let targetTxs = transactions;

      if (data.tombstones && typeof data.tombstones === 'object') {
        Object.values(data.tombstones).forEach((t: any) => {
          if (t && t.id) saveLocalTombstone(t);
        });
      }
      const allTombs = loadLocalTombstones();

      if (Array.isArray(data.accounts) && data.accounts.length > 0) {
        targetAccounts = data.accounts;
      }
      if (Array.isArray(data.categories) && data.categories.length > 0) {
        targetCategories = data.categories;
      }
      if (Array.isArray(data.transactions)) {
        targetTxs = data.transactions.filter(
          (tx) =>
            tx &&
            tx.id &&
            !isTransactionTombstoned(tx, allTombs, Number(tx.updatedAt || tx.createdAt || 0))
        );
      }

      const syncedAccounts = syncAllAccountBalances(targetAccounts, targetTxs);

      setAccounts(syncedAccounts);
      setCategories(targetCategories);
      setTransactions(targetTxs);
      if (Array.isArray(data.recurringTransactions)) {
        const localRecMap = new Map<string, RecurringTransaction>(
          (recurringTransactionsRef.current || []).map((r) => [r.id, r])
        );
        const mergedRecs = data.recurringTransactions
          .filter((r) => r && r.id && !allTombs[r.id])
          .map((r) => mergeRecurringRuleWatermarks(r, localRecMap.get(r.id)));
        setRecurringTransactions(mergedRecs);
      }

      if (data.settings && typeof data.settings === 'object') {
        setSettings((prev) => ({
          ...prev,
          ...data.settings,
          userProfile: data.settings?.userProfile
            ? { ...prev.userProfile, ...data.settings.userProfile }
            : prev.userProfile,
        }));
      }

      showToast(t('importedSuccess'), 'success');
      return true;
    } catch (err) {
      console.error(err);
      showToast(t('invalidFileError'), 'error');
      return false;
    }
  };

  const importCustomData = async (
    payload: any,
    config: CustomImportConfig
  ): Promise<boolean> => {
    try {
      const result = executeCustomDataImport(
        {
          accounts,
          categories,
          transactions,
          settings,
          recurringTransactions,
        },
        payload,
        config
      );

      if (config.importAccounts || config.importTransactions) {
        setAccounts(result.updatedAccounts);
      }
      if (config.importCategories || config.importBudgets) {
        setCategories(result.updatedCategories);
      }
      if (config.importTransactions) {
        setTransactions(result.updatedTransactions);
        if (result.updatedRecurring) {
          setRecurringTransactions(result.updatedRecurring);
        }
      }

      // Automatically trigger cloud backup sync immediately
      try {
        await triggerCloudBackupNow();
      } catch (cloudErr) {
        console.warn('[CustomImport] Automatic cloud sync trigger error:', cloudErr);
      }

      showToast(
        settings.language === 'ar'
          ? 'تم استيراد وحفظ البيانات المحددة بنجاح ومزامنتها سحابياً!'
          : 'Selected data imported, saved, and synced to cloud successfully!',
        'success'
      );
      return true;
    } catch (err: any) {
      console.error('[CustomImport] Execution error:', err);
      showToast(
        settings.language === 'ar'
          ? 'حدث خطأ أثناء استيراد البيانات: ' + (err?.message || 'خطأ غير معروف')
          : 'Failed to import custom data: ' + (err?.message || 'Unknown error'),
        'error'
      );
      return false;
    }
  };

  const importSingleAccountData = (
    importedAccount: Account,
    importedTxs: Transaction[]
  ): boolean => {
    try {
      if (!importedAccount || !importedAccount.id || !importedAccount.name) {
        showToast(t('invalidFileError'), 'error');
        return false;
      }

      // Check if account already exists
      const existingIdx = accounts.findIndex((a) => a.id === importedAccount.id);
      let updatedAccounts = [...accounts];
      if (existingIdx >= 0) {
        updatedAccounts[existingIdx] = importedAccount;
      } else {
        updatedAccounts.push(importedAccount);
      }

      // Filter out existing transactions with same ids and merge
      const existingTxIds = new Set(transactions.map((t) => t.id));
      const newTxsToAdd = (importedTxs || []).filter((tx) => !existingTxIds.has(tx.id));
      const updatedAllTxs = [...transactions, ...newTxsToAdd];

      const synced = syncAllAccountBalances(updatedAccounts, updatedAllTxs);
      setAccounts(synced);
      setTransactions(updatedAllTxs);

      showToast(t('importedSuccess'), 'success');
      return true;
    } catch (err) {
      console.error(err);
      showToast(t('invalidFileError'), 'error');
      return false;
    }
  };

  const importSharedItems = (payload: {
    accounts?: Account[];
    categories?: Category[];
    transactions?: Transaction[];
    targetAccountId?: string;
  }): { accountsCount: number; categoriesCount: number; txsCount: number } => {
    try {
      const incomingAccounts = payload.accounts || [];
      const incomingCategories = payload.categories || [];
      const incomingTransactions = payload.transactions || [];

      // 1. Accounts with duplicate detection by ID or Name
      const updatedAccounts = [...accounts];
      let accountsAdded = 0;
      for (const incAcc of incomingAccounts) {
        if (!incAcc || !incAcc.name) continue;
        const exists = updatedAccounts.some(
          (a) => a.id === incAcc.id || a.name.toLowerCase().trim() === incAcc.name.toLowerCase().trim()
        );
        if (!exists) {
          updatedAccounts.push({
            ...incAcc,
            id: incAcc.id || `acc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          });
          accountsAdded++;
        }
      }

      // 2. Categories with duplicate detection by name & type
      const updatedCategories = [...categories];
      let categoriesAdded = 0;
      for (const incCat of incomingCategories) {
        if (!incCat || !incCat.name) continue;
        const exists = updatedCategories.some(
          (c) => c.name.toLowerCase().trim() === incCat.name.toLowerCase().trim() && c.type === incCat.type
        );
        if (!exists) {
          updatedCategories.push({
            ...incCat,
            id: incCat.id || `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          });
          categoriesAdded++;
        }
      }

      // 3. Transactions with duplicate detection by ID or (date + amount + description + type)
      const updatedTxs = [...transactions];
      let txsAdded = 0;
      for (const incTx of incomingTransactions) {
        if (!incTx) continue;
        const exists = updatedTxs.some(
          (t) =>
            t.id === incTx.id ||
            (t.date === incTx.date &&
              Math.abs(t.amount - incTx.amount) < 0.001 &&
              t.type === incTx.type &&
              (t.description || '').trim() === (incTx.description || '').trim())
        );
        if (!exists) {
          let targetAccId = payload.targetAccountId || incTx.accountId;
          if (!updatedAccounts.some((a) => a.id === targetAccId)) {
            targetAccId = updatedAccounts[0]?.id || 'default_acc';
          }
          let targetCatId = incTx.categoryId;
          if (incTx.categoryId && !updatedCategories.some((c) => c.id === incTx.categoryId)) {
            const match = updatedCategories.find(
              (c) =>
                incTx.categoryName &&
                c.name.toLowerCase().trim() === incTx.categoryName.toLowerCase().trim() &&
                c.type === incTx.type
            );
            if (match) targetCatId = match.id;
          }
          updatedTxs.push({
            ...incTx,
            id: incTx.id || `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            accountId: targetAccId,
            categoryId: targetCatId,
          });
          txsAdded++;
        }
      }

      const syncedAccounts = syncAllAccountBalances(updatedAccounts, updatedTxs);
      setAccounts(syncedAccounts);
      setCategories(updatedCategories);
      setTransactions(updatedTxs);

      return {
        accountsCount: accountsAdded,
        categoriesCount: categoriesAdded,
        txsCount: txsAdded,
      };
    } catch (err) {
      console.error('[AppContext] Failed to import shared items:', err);
      return { accountsCount: 0, categoriesCount: 0, txsCount: 0 };
    }
  };

  // Manual Dual-Layer Cloud Backup (Google Drive with Firebase Server Fallback)
  const triggerCloudBackupNow = async (): Promise<{ provider: 'google_drive' | 'firebase'; success: boolean }> => {
    const user = auth.currentUser;
    if (!user) {
      showToast(isArabic ? 'يرجى تسجيل الدخول أولاً للنسخ السحابي' : 'Please sign in first to back up', 'error');
      return { provider: 'firebase', success: false };
    }
    showToast(isArabic ? 'جارٍ النسخ السحابي الاحتياطي...' : 'Saving cloud backup...', 'info');
    const payload = buildCurrentBackupPayload();
    const result = await executeDualCloudBackup(user.uid, payload);
    if (result.success) {
      const isDrive = result.provider === 'google_drive';
      showToast(
        isArabic
          ? (isDrive ? 'تم حفظ النسخة الاحتياطية بنجاح على Google Drive!' : 'تم حفظ النسخة الاحتياطية على الخادم السحابي!')
          : (isDrive ? 'Backup saved successfully to Google Drive!' : 'Backup saved successfully to Cloud Server!'),
        'success'
      );
    } else {
      showToast(isArabic ? 'فشل حفظ النسخة الاحتياطية' : 'Failed to save cloud backup', 'error');
    }
    return result;
  };

  // Manual Dual-Layer Cloud Restore (Google Drive first, Firebase Server Fallback)
  const triggerCloudRestoreNow = async (): Promise<boolean> => {
    const user = auth.currentUser;
    if (!user) {
      showToast(isArabic ? 'يرجى تسجيل الدخول أولاً لاستعادة البيانات' : 'Please sign in first to restore', 'error');
      return false;
    }
    showToast(isArabic ? 'جارٍ فحص النسخ السحابية المتاحة...' : 'Checking for cloud backups...', 'info');
    const cloudBackup = await fetchDualCloudBackup(user.uid);
    if (!cloudBackup || !cloudBackup.data) {
      showToast(isArabic ? 'لم يتم العثور على نسخة احتياطية سحابية' : 'No cloud backup found', 'info');
      return false;
    }
    const data = cloudBackup.data;
    isHydratingCloudRef.current = true;
    if (data.tombstones && typeof data.tombstones === 'object') {
      Object.values(data.tombstones).forEach((t: any) => {
        if (t && t.id) saveLocalTombstone(t);
      });
    }
    const allTombs = loadLocalTombstones();
    const filteredTxs: Transaction[] = Array.isArray(data.transactions)
      ? data.transactions.filter(
          (tx: Transaction) =>
            tx &&
            tx.id &&
            !isTransactionTombstoned(tx, allTombs, Number(tx.updatedAt || tx.createdAt || 0))
        )
      : transactionsRef.current;

    if (Array.isArray(data.accounts) && data.accounts.length > 0) {
      setAccounts(syncAllAccountBalances(data.accounts, filteredTxs));
    }
    if (Array.isArray(data.categories) && data.categories.length > 0) {
      setCategories(data.categories);
    }
    if (Array.isArray(data.transactions)) {
      setTransactions(filteredTxs);
    }
    if (Array.isArray(data.recurringTransactions)) {
      const localRecMap = new Map<string, RecurringTransaction>(
        (recurringTransactionsRef.current || []).map((r) => [r.id, r])
      );
      const mergedRecs = data.recurringTransactions
        .filter((r: RecurringTransaction) => r && r.id && !allTombs[r.id])
        .map((r: RecurringTransaction) => mergeRecurringRuleWatermarks(r, localRecMap.get(r.id)));
      setRecurringTransactions(mergedRecs);
    }
    if (data.settings && typeof data.settings === 'object') {
      setSettings((prev) => ({
        ...prev,
        ...data.settings,
        userProfile: data.settings.userProfile
          ? { ...prev.userProfile, ...data.settings.userProfile }
          : prev.userProfile,
      }));
    }
    if (data.sharedSpaces) {
      if (Array.isArray(data.sharedSpaces.myFolders)) {
        saveMyShareFolders(data.sharedSpaces.myFolders);
      }
      if (Array.isArray(data.sharedSpaces.receivedFolders)) {
        saveReceivedShareFolders(data.sharedSpaces.receivedFolders);
      }
    }
    setTimeout(() => {
      isHydratingCloudRef.current = false;
    }, 1000);

    const isDrive = cloudBackup.provider === 'google_drive';
    showToast(
      isArabic
        ? (isDrive ? 'تمت استعادة جميع بياناتك بنجاح من Google Drive!' : 'تمت استعادة بياناتك من الخادم السحابي!')
        : (isDrive ? 'All data successfully restored from Google Drive!' : 'Data successfully restored from Cloud Server!'),
      'success'
    );
    return true;
  };

  const resolveSyncConflict = async (choice: 'replace' | 'merge') => {
    if (!pendingSyncConflict) return;
    const d = pendingCloudBackup || pendingSyncConflict.cloudBackup;
    const uid = pendingSyncConflict.uid;
    if (!d) return;

    if (choice === 'replace') {
      try {
        localStorage.setItem(
          'mm_pre_replace_backup',
          JSON.stringify({
            transactions: transactionsRef.current,
            accounts: accountsRef.current,
            categories: categoriesRef.current,
            recurringTransactions: recurringTransactionsRef.current,
            settings: settingsRef.current,
            savedAt: Date.now(),
          })
        );
      } catch (err) {
        console.warn('[AppContext] Failed to write mm_pre_replace_backup:', err);
      }

      applyCloudData(d);
      await hydrateAndPublishUserProfile(uid, d);
      localStorage.setItem('mm_bound_account_uid', uid);
      const cloudTime = Number(d.updatedAt || d.timestamp || Date.now());
      localStorage.setItem('mm_last_local_data_update', String(cloudTime));
      isCloudHydratedRef.current = true;
      isSyncUnlockedRef.current = true;
      setCloudBackupBlocked(false);
      setPendingSyncConflict(null);
      setPendingCloudBackup(null);

      // STAGE 3: write resolved state into v4 flat nodes & purge obsolete legacy server nodes
      await writeV4ResolvedState(uid, {
        transactions: transactionsRef.current,
        recurringTransactions: recurringTransactionsRef.current,
        accounts: accountsRef.current,
        categories: categoriesRef.current,
        settings: settingsRef.current,
        userProfile: settingsRef.current.userProfile,
        tombstones: loadLocalTombstones(),
      });
      // STAGE 4: Attach live listeners
      attachV4ListenersForUser(uid);
      if (navigator.onLine && hasGranularDirtyItems()) {
        handleReconnectAndFlush();
      }

      showToast(
        isArabic
          ? 'تم استبدال بيانات الجهاز ببيانات الحساب السحابي بنجاح!'
          : 'Device data replaced with cloud account data successfully!',
        'success'
      );
    } else {
      // Merge: deduplicate by item ID, keeping newer updatedAt per item
      const localTombstones = loadLocalTombstones();
      const cloudTombstones: Record<string, Tombstone> = d.tombstones || {};
      const allTombstones: Record<string, Tombstone> = { ...localTombstones, ...cloudTombstones };
      Object.values(allTombstones).forEach((t) => saveLocalTombstone(t));

      // 1. Categories
      const localCats = categoriesRef.current;
      const cloudCats: Category[] = Array.isArray(d.categories) ? d.categories : [];
      const catMap = new Map<string, Category>();
      [...localCats, ...cloudCats].forEach((c) => {
        if (!c || !c.id) return;
        const tomb = allTombstones[c.id];
        const cUpdated = Number(c.updatedAt || 0);
        if (tomb && tomb.deletedAt > cUpdated) return;
        const existing = catMap.get(c.id);
        if (!existing || cUpdated > Number(existing.updatedAt || 0)) {
          catMap.set(c.id, c);
        }
      });
      const mergedCategories = Array.from(catMap.values());

      // 2. Transactions (respecting both ID and occurrenceKey tombstones, deduplicating recurring occurrences)
      const localTxs = transactionsRef.current;
      const cloudTxs: Transaction[] = Array.isArray(d.transactions) ? d.transactions : [];
      const txMap = new Map<string, Transaction>();
      const occMap = new Map<string, string>();
      [...localTxs, ...cloudTxs].forEach((t) => {
        if (!t || !t.id) return;
        const tUpdated = Number(t.updatedAt || t.createdAt || 0);
        if (isTransactionTombstoned(t, allTombstones, tUpdated)) return;

        const tOccKey =
          t.occurrenceKey ||
          (t.recurringRuleId && t.date
            ? buildOccurrenceKey(t.recurringRuleId, t.date, t.time || '09:00')
            : undefined);

        if (tOccKey && occMap.has(tOccKey) && occMap.get(tOccKey) !== t.id) {
          const existingId = occMap.get(tOccKey)!;
          const existingTx = txMap.get(existingId);
          if (existingTx && tUpdated > Number(existingTx.updatedAt || existingTx.createdAt || 0)) {
            txMap.delete(existingId);
            txMap.set(t.id, { ...t, occurrenceKey: tOccKey });
            occMap.set(tOccKey, t.id);
          }
          return;
        }

        const existing = txMap.get(t.id);
        if (!existing || tUpdated > Number(existing.updatedAt || existing.createdAt || 0)) {
          txMap.set(t.id, tOccKey ? { ...t, occurrenceKey: tOccKey } : t);
          if (tOccKey) occMap.set(tOccKey, t.id);
        }
      });
      const mergedTransactions = Array.from(txMap.values());
      mergedTransactions.sort(compareTxChronologicallyDesc);

      // 3. Accounts
      const localAccs = accountsRef.current;
      const cloudAccs: Account[] = Array.isArray(d.accounts) ? d.accounts : [];
      const accMap = new Map<string, Account>();
      [...localAccs, ...cloudAccs].forEach((a) => {
        if (!a || !a.id) return;
        const tomb = allTombstones[a.id];
        const aUpdated = Number(a.updatedAt || 0);
        if (tomb && tomb.deletedAt > aUpdated) return;
        const existing = accMap.get(a.id);
        if (!existing || aUpdated > Number(existing.updatedAt || 0)) {
          accMap.set(a.id, a);
        }
      });
      let mergedAccounts = Array.from(accMap.values());
      mergedAccounts = syncAllAccountBalances(mergedAccounts, mergedTransactions);

      // 4. Recurring Transactions (preserving highest monotonic watermark)
      const localRecs = recurringTransactionsRef.current;
      const cloudRecs: RecurringTransaction[] = Array.isArray(d.recurringTransactions) ? d.recurringTransactions : [];
      const recMap = new Map<string, RecurringTransaction>();
      [...localRecs, ...cloudRecs].forEach((r) => {
        if (!r || !r.id) return;
        const tomb = allTombstones[r.id];
        const rUpdated = Number(r.updatedAt || r.createdAt || 0);
        if (tomb && tomb.deletedAt > rUpdated) return;
        const existing = recMap.get(r.id);
        recMap.set(r.id, mergeRecurringRuleWatermarks(r, existing));
      });
      const mergedRecurring = Array.from(recMap.values());

      // Apply merged state
      setCategories(mergedCategories);
      setAccounts(mergedAccounts);
      setTransactions(mergedTransactions);
      setRecurringTransactions(mergedRecurring);

      // Merge shared spaces if any
      if (d.sharedSpaces) {
        if (Array.isArray(d.sharedSpaces.myFolders)) {
          const existing = loadMyShareFolders();
          const map = new Map<string, ShareFolder>();
          d.sharedSpaces.myFolders.forEach((f: ShareFolder) => { if (f && f.id) map.set(f.id, f); });
          existing.forEach((f: ShareFolder) => { if (f && f.id && !map.has(f.id)) map.set(f.id, f); });
          saveMyShareFolders(Array.from(map.values()));
        }
        if (Array.isArray(d.sharedSpaces.receivedFolders)) {
          const existing = loadReceivedShareFolders();
          const map = new Map<string, ShareFolder>();
          d.sharedSpaces.receivedFolders.forEach((f: ShareFolder) => { if (f && f.id) map.set(f.id, f); });
          existing.forEach((f: ShareFolder) => { if (f && f.id && !map.has(f.id)) map.set(f.id, f); });
          saveReceivedShareFolders(Array.from(map.values()));
        }
        const my16 = cleanNumericId(settings.userProfile?.numericId || getOrCreateNumericId());
        repairAndMigrateSharedSpaces(my16, uid);
      }

      await hydrateAndPublishUserProfile(uid, d);

      localStorage.setItem('mm_bound_account_uid', uid);
      const mergeTime = syncNow();
      localStorage.setItem('mm_last_local_data_update', String(mergeTime));

      isCloudHydratedRef.current = true;
      isSyncUnlockedRef.current = true;
      setCloudBackupBlocked(false);
      setPendingSyncConflict(null);
      setPendingCloudBackup(null);

      // 5. Merge settings & smartBudget
      const cloudSettings = d.settings;
      const cloudSmartBudget = d.smartBudget || cloudSettings?.smartBudget;
      const curSettingsUpdated = Number(settingsRef.current.updatedAt || 0);
      const cloudSettingsUpdated = Number(cloudSettings?.updatedAt || 0);
      const curSmartUpdated = Number(settingsRef.current.smartBudget?.updatedAt || 0);
      const cloudSmartUpdated = Number(cloudSmartBudget?.updatedAt || 0);

      let mergedSettings = { ...settingsRef.current };
      if (cloudSettings && cloudSettingsUpdated > curSettingsUpdated) {
        mergedSettings = { ...mergedSettings, ...cloudSettings };
      }
      if (cloudSmartBudget && cloudSmartUpdated > curSmartUpdated) {
        mergedSettings.smartBudget = cloudSmartBudget;
      }
      setSettings(mergedSettings);

      // STAGE 3: write merged state into v4 flat nodes & purge obsolete legacy server nodes
      await writeV4ResolvedState(uid, {
        transactions: mergedTransactions,
        recurringTransactions: mergedRecurring,
        accounts: mergedAccounts,
        categories: mergedCategories,
        settings: mergedSettings,
        userProfile: mergedSettings.userProfile || settingsRef.current.userProfile,
        tombstones: allTombstones,
      });
      // STAGE 4: Attach live listeners
      attachV4ListenersForUser(uid);
      if (navigator.onLine && hasGranularDirtyItems()) {
        handleReconnectAndFlush();
      }

      showToast(
        isArabic
          ? 'تم دمج البيانات ومزامنتها سحابياً بنجاح!'
          : 'Data merged and synced with cloud successfully!',
        'success'
      );
    }
  };

    // Custom In-App Confirm and Prompt System (Item 6)
  const [customDialogState, setCustomDialogState] = useState<{
    type: 'confirm' | 'prompt';
    options: ConfirmDialogOptions | PromptDialogOptions;
    resolve: (value: any) => void;
  } | null>(null);

  const showConfirm = (options: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setCustomDialogState({
        type: 'confirm',
        options,
        resolve,
      });
    });
  };

  const showPrompt = (options: PromptDialogOptions): Promise<string | null> => {
    return new Promise((resolve) => {
      setCustomDialogState({
        type: 'prompt',
        options,
        resolve,
      });
    });
  };

  const closeCustomDialog = () => {
    setCustomDialogState(null);
  };

  // Sub-pages and Deep Navigation
  const [activeShareDetailFolder, setActiveShareDetailFolder] = useState<any | null>(null);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [featureGuideLayout, setFeatureGuideLayout] = useState<'grid' | 'split' | 'preview' | 'full'>('grid');

  // Seamless Shared Account Live View Switcher (Item 13)
  const [activeSharedId, setActiveSharedId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const search = new URLSearchParams(window.location.search);
      const share = search.get('share') || search.get('sharedAccountId') || (search.get('link') ? `link_${search.get('link')}` : null);
      return share && share.trim() ? share.trim() : null;
    }
    return null;
  });

  const [activeSharedSnapshot, setActiveSharedSnapshot] = useState<any | null>(() => {
    if (typeof window !== 'undefined') {
      const search = new URLSearchParams(window.location.search);
      const s = search.get('data') || search.get('sharedData');
      if (s && s.trim()) {
        try {
          return decodeShareSnapshot(s.trim());
        } catch (e) {
          console.warn('Failed to parse shared snapshot from query:', e);
        }
      }
    }
    return null;
  });

  const openSharedLiveView = (id?: string, snapshot?: any) => {
    if (id) {
      setActiveSharedId(id);
      const u = new URL(window.location.href);
      u.searchParams.set('sharedAccountId', id);
      window.history.pushState({}, '', u.toString());
    } else if (snapshot) {
      setActiveSharedSnapshot(snapshot);
    }
  };

  const closeSharedLiveView = () => {
    setActiveSharedId(null);
    setActiveSharedSnapshot(null);
    const u = new URL(window.location.href);
    u.searchParams.delete('sharedAccountId');
    u.searchParams.delete('sharedData');
    u.searchParams.delete('share');
    u.searchParams.delete('link');
    window.history.replaceState({}, '', u.pathname + (u.search ? u.search : ''));
  };

  // When an invitation link is opened (?share=...), automatically register it into "Shared with Me"
  useEffect(() => {
    if (!activeSharedId) return;
    if (activeSharedId.startsWith('link_')) return; // Do not auto-register public link mirrors into member slots
    fetchShareFolderFromCloud(activeSharedId).then((folder) => {
      if (folder) {
        registerReceivedShareFolder(
          folder,
          settings.userProfile?.numericId,
          settings.userProfile?.name,
          settings.userProfile?.avatarEmoji,
          settings.userProfile?.customAvatarUrl
        );
      }
    });
  }, [activeSharedId, settings.userProfile?.numericId, settings.userProfile?.name]);

  // All mutators: permanently stable identities, always executing the latest logic
  const stable = useStableCallbacks({
    setCurrentTab,
    setIsHeaderVisible,
    setHomeSubView,
    setSelectedAccountId,
    setPeriodFilter,
    setPeriodOffset,
    setCustomDateRange,
    setAdvancedFilter,
    clearAdvancedFilter,
    setIsSidebarOpen,
    openAddTxModal,
    closeAddTxModal,
    executeManualRecurringRules,
    openEditTxModal,
    closeEditTxModal,
    openEditRecurringModal,
    applyRecurringRuleEdit,
    openTxDetailsModal,
    closeTxDetailsModal,
    openAddAccountModal,
    openEditAccountModal,
    closeAccountModal,
    openAddCategoryModal,
    openEditCategoryModal,
    closeCategoryModal,
    setIsUserProfileModalOpen,
    setIsResetPeriodModalOpen,
    setIsFilterModalOpen,
    setIsFeaturesModalOpen,
    setIsWhatsNewOpen,
    setIsRecurringModalOpen,
    setIsPinModalOpen,
    setIsSmartBudgetModalOpen,
    setIsSharedHubModalOpen,
    setIsEditingSpace,
    setEditingShareId,
    setIsAppLocked,
    unlockApp,
    lockApp,
    addRecurringTransaction,
    updateRecurringTransaction,
    deleteRecurringTransaction,
    processDueRecurring,
    dismissBudgetAlert,
    openEmojiPicker,
    closeEmojiPicker,
    selectEmoji,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addAccount,
    updateAccount,
    deleteAccount,
    reorderAccounts,
    addCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
    startAccountMultiSelect,
    toggleAccountSelection,
    selectAllAccounts,
    clearAccountSelection,
    clearGlobalSelection,
    deleteAccountWithBalanceTransfer,
    deleteMultipleAccounts,
    openShareModal,
    closeShareModal,
    openRemainingBalanceModal,
    closeRemainingBalanceModal,
    startTxMultiSelect,
    toggleTxSelection,
    toggleBatchTxs,
    selectAllTxs,
    clearTxSelection,
    deleteSelectedTxs,
    batchAssignCategory,
    startCategoryMultiSelect,
    toggleCategorySelection,
    selectAllCategories,
    clearCategorySelection,
    deleteSelectedCategories,
    updateSettings,
    applyPeriodReset,
    signOutUser,
    importFullData,
    importSingleAccountData,
    importCustomData,
    importSharedItems,
    triggerCloudBackupNow,
    triggerCloudRestoreNow,
    showToast,
    dismissToast,
    showConfirm,
    showPrompt,
    closeCustomDialog,
    setActiveSharedId,
    setActiveSharedSnapshot,
    openSharedLiveView,
    closeSharedLiveView,
    resolveSyncConflict,
  });

  // Context value only changes when actual STATE changes (mutators are stable)
  const contextValue = useMemo<AppContextType>(
    () => ({
      ...stable,
      pendingSyncConflict,
      pendingCloudBackup,
      resolveSyncConflict,
      accounts,
      categories,
      transactions,
      settings,
      currentTab,
      isHeaderVisible,
      homeSubView,
      selectedAccountId,
      periodFilter,
      periodOffset,
      customDateRange,
      advancedFilter,
      isSidebarOpen,
      isAddTxModalOpen,
      defaultTxAccountId,
      defaultTxAmount,
      defaultTxIsRecurring,
      editingTx,
      editingRecurring,
      viewingTx,
      isAccountModalOpen,
      editingAccount,
      isCategoryModalOpen,
      editingCategory,
      defaultCategoryType,
      isUserProfileModalOpen,
      isResetPeriodModalOpen,
      isFilterModalOpen,
      isFeaturesModalOpen,
      isWhatsNewOpen,
      isRecurringModalOpen,
      isPinModalOpen,
      isSmartBudgetModalOpen,
      isSharedHubModalOpen,
      isEditingSpace,
      editingShareId,
      isAppLocked,
      recurringTransactions,
      budgetAlerts,
      dismissedAlertIds,
      isEmojiPickerOpen,
      selectedAccountIds,
      isAccountMultiSelect,
      isGlobalMultiSelect,
      shareModalState,
      remainingBalanceModalState,
      selectedTxIds,
      isTxMultiSelect,
      selectedCategoryIds,
      isCategoryMultiSelect,
      toasts,
      customDialogState,
      activeShareDetailFolder,
      setActiveShareDetailFolder,
      selectedFeatureId,
      setSelectedFeatureId,
      featureGuideLayout,
      setFeatureGuideLayout,
      activeSharedId,
      activeSharedSnapshot,
      syncStatus,
      lastSyncedAt,
      t,
    }),
    [
      stable,
      accounts,
      categories,
      transactions,
      settings,
      currentTab,
      homeSubView,
      selectedAccountId,
      periodFilter,
      periodOffset,
      customDateRange,
      advancedFilter,
      isSidebarOpen,
      isAddTxModalOpen,
      defaultTxAccountId,
      defaultTxAmount,
      defaultTxIsRecurring,
      editingTx,
      editingRecurring,
      viewingTx,
      isAccountModalOpen,
      editingAccount,
      isCategoryModalOpen,
      editingCategory,
      defaultCategoryType,
      isUserProfileModalOpen,
      isResetPeriodModalOpen,
      isFilterModalOpen,
      isFeaturesModalOpen,
      isWhatsNewOpen,
      isRecurringModalOpen,
      isPinModalOpen,
      isSmartBudgetModalOpen,
      isSharedHubModalOpen,
      isEditingSpace,
      editingShareId,
      isAppLocked,
      recurringTransactions,
      budgetAlerts,
      dismissedAlertIds,
      isEmojiPickerOpen,
      selectedAccountIds,
      isAccountMultiSelect,
      isGlobalMultiSelect,
      shareModalState,
      remainingBalanceModalState,
      isHeaderVisible,
      selectedTxIds,
      isTxMultiSelect,
      selectedCategoryIds,
      isCategoryMultiSelect,
      toasts,
      customDialogState,
      activeShareDetailFolder,
      setActiveShareDetailFolder,
      selectedFeatureId,
      setSelectedFeatureId,
      featureGuideLayout,
      setFeatureGuideLayout,
      activeSharedId,
      activeSharedSnapshot,
      syncStatus,
      lastSyncedAt,
      t,
    ]
  );

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
