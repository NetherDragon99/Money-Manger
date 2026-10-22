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
import { debouncedPersist } from '../utils/persistQueue';

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
} from '../types';
import {
  loadRecurringTransactions,
  saveRecurringTransactions,
  checkAndProcessRecurring,
} from '../utils/recurring';
import {
  loadSecuritySettings,
  isSessionUnlocked,
  setSessionUnlocked,
} from '../utils/security';
import { evaluateBudgetAlerts, BudgetAlert } from '../utils/budgetAlerts';
import {
  loadInitialData,
  saveAccounts,
  saveCategories,
  saveTransactions,
  saveSettings,
} from '../utils/storage';
import { requestPersistentStorage, loadFullDataFromIndexedDB } from '../utils/indexedDB';
import { syncAllAccountBalances } from '../utils/balanceEngine';
import { formatDateToYYYYMMDD, formatTimeToHHMM } from '../utils/dateCycle';
import { translations } from '../utils/translations';
import { DEFAULT_SETTINGS } from '../utils/constants';
import { ConfirmDialogOptions, PromptDialogOptions } from '../components/CustomDialogModal';
import { getOrCreateNumericId, syncNumericIdToFirebase, resolvePermanent16DigitId, cleanNumericId } from '../utils/userId';
import { auth } from '../utils/firebase';
import { decodeShareSnapshot } from '../utils/sharing';
import {
  publishUserProfileCard,
  syncShareFoldersWithMainData,
  subscribeToMyInbox,
  loadReceivedShareFolders,
  saveReceivedShareFolders,
  fetchShareFolderFromCloud,
  registerReceivedShareFolder,
  ShareFolder,
} from '../utils/shareFolders';

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  action?: {
    label: string;
    onClick: () => void;
  };
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
  openAddTxModal: (defaultAccountId?: string, initialAmount?: number) => void;
  closeAddTxModal: () => void;
  editingTx: Transaction | null;
  openEditTxModal: (tx: Transaction) => void;
  closeEditTxModal: () => void;
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
  processDueRecurring: () => number;

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

  // Backup & Restore
  importFullData: (data: AppData) => boolean;
  importSingleAccountData: (importedAccount: Account, importedTxs: Transaction[]) => boolean;
  importSharedItems: (payload: {
    accounts?: Account[];
    categories?: Category[];
    transactions?: Transaction[];
  }) => { accountsCount: number; categoriesCount: number; txsCount: number };

  // Toasts
  toasts: ToastItem[];
  showToast: (
    message: string,
    type?: 'success' | 'error' | 'info',
    action?: { label: string; onClick: () => void },
    duration?: number
  ) => void;

  // Custom Dialogs (Replaces browser confirm/prompt/alert)
  showConfirm: (options: ConfirmDialogOptions) => Promise<boolean>;
  showPrompt: (options: PromptDialogOptions) => Promise<string | null>;
  customDialogState: {
    type: 'confirm' | 'prompt';
    options: ConfirmDialogOptions | PromptDialogOptions;
    resolve: (value: any) => void;
  } | null;
  closeCustomDialog: () => void;

  // Seamless Shared Account Live View Switcher
  activeSharedId: string | null;
  setActiveSharedId: (id: string | null) => void;
  activeSharedSnapshot: any | null;
  setActiveSharedSnapshot: (snapshot: any | null) => void;
  openSharedLiveView: (id?: string, snapshot?: any) => void;
  closeSharedLiveView: () => void;

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
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
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
  const [isSharedHubModalOpen, setIsSharedHubModalOpen] = useState(false);

  // Recurring transactions state
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>(() =>
    loadRecurringTransactions()
  );

  // App Lock & Biometrics state
  const [isAppLocked, setIsAppLocked] = useState<boolean>(() => {
    const sec = loadSecuritySettings();
    return sec.isLockEnabled && !isSessionUnlocked();
  });

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

  const deleteSelectedTxs = () => {
    if (selectedTxIds.length === 0) return;
    const count = selectedTxIds.length;
    const updatedList = transactions.filter((t) => !selectedTxIds.includes(t.id));
    setTransactions(updatedList);
    const synced = syncAllAccountBalances(accounts, updatedList);
    setAccounts(synced);
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

    let updatedTxs = transactions.filter(
      (tx) => tx.accountId !== id && tx.toAccountId !== id
    );

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
      };
      updatedTxs.push(transferTx);
    }

    setTransactions(updatedTxs);
    const remainingAccounts = accounts.filter((a) => a.id !== id);
    const synced = syncAllAccountBalances(remainingAccounts, updatedTxs);
    setAccounts(synced);

    if (selectedAccountId === id) {
      setSelectedAccountId(null);
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
    let updatedTxs = transactions.filter(
      (tx) => !ids.includes(tx.accountId) && (!tx.toAccountId || !ids.includes(tx.toAccountId))
    );

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

  // Toasts
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = (
    message: string,
    type: 'success' | 'error' | 'info' = 'success',
    action?: { label: string; onClick: () => void },
    duration: number = 3600
  ) => {
    const id = `${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type, action }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  };

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
    }, 400);
    return () => clearTimeout(timer);
  }, [accounts, categories, transactions]);

  // Active global real-time listener for incoming shares to user's 16-digit ID
  // Delivers instant incoming shares without requiring the recipient to refresh!
  useEffect(() => {
    const rawId = settings.userProfile?.numericId;
    const cleanId = cleanNumericId(rawId || '');
    if (cleanId.length !== 16) return;

    // Track known IDs so we only alert for brand new shares
    const initialReceived = loadReceivedShareFolders();
    const knownIds = new Set(initialReceived.map((f) => f.id));

    const unsub = subscribeToMyInbox(cleanId, (liveReceived) => {
      if (!Array.isArray(liveReceived)) return;

      // Check for brand new shares
      for (const folder of liveReceived) {
        if (!knownIds.has(folder.id)) {
          knownIds.add(folder.id);
          // Show interactive real-time notification toast!
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
      }

      saveReceivedShareFolders(liveReceived);
      // Dispatch event to update any open UI instantly
      window.dispatchEvent(new CustomEvent('received_shares_updated', { detail: liveReceived }));
    });

    return () => unsub();
  }, [settings.userProfile?.numericId, settings.language]);

  useEffect(() => {
    debouncedPersist('recurring_transactions', () => saveRecurringTransactions(recurringTransactions));
  }, [recurringTransactions]);

  // App Lock on resume / visibility change
  useEffect(() => {
    const handleVisibility = () => {
      const sec = loadSecuritySettings();
      if (!sec.isLockEnabled) return;

      if (document.visibilityState === 'visible' && sec.requireLockOnResume) {
        setIsAppLocked(true);
        setSessionUnlocked(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Listen for security settings updates live
  useEffect(() => {
    const handleSecUpdate = (e: any) => {
      const sec = e?.detail || loadSecuritySettings();
      if (!sec.isLockEnabled) {
        setIsAppLocked(false);
      }
    };
    window.addEventListener('app_security_updated', handleSecUpdate);
    return () => window.removeEventListener('app_security_updated', handleSecUpdate);
  }, []);

  const unlockApp = () => {
    setSessionUnlocked(true);
    setIsAppLocked(false);
  };

  const lockApp = () => {
    setSessionUnlocked(false);
    setIsAppLocked(true);
  };

  // Recurring transactions CRUD
  const addRecurringTransaction = (recData: Omit<RecurringTransaction, 'id' | 'createdAt'>) => {
    const newRec: RecurringTransaction = {
      ...recData,
      id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
    };
    setRecurringTransactions((prev) => [...prev, newRec]);
    showToast(t('savedSuccess'), 'success');
  };

  const updateRecurringTransaction = (updated: RecurringTransaction) => {
    setRecurringTransactions((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    showToast(t('updatedSuccess'), 'success');
  };

  const deleteRecurringTransaction = (id: string) => {
    setRecurringTransactions((prev) => prev.filter((r) => r.id !== id));
    showToast(t('deletedSuccess'), 'success');
  };

  const processDueRecurring = (): number => {
    const today = formatDateToYYYYMMDD(new Date());
    const res = checkAndProcessRecurring(recurringTransactions, today);
    if (res.newTransactions.length > 0) {
      setRecurringTransactions(res.updatedRecurring);
      const createdTxs: Transaction[] = res.newTransactions.map((tx) => ({
        ...tx,
        id: `tx_rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        createdAt: Date.now(),
      }));
      const updatedTxs = [...transactions, ...createdTxs];
      setTransactions(updatedTxs);
      const syncedAccounts = syncAllAccountBalances(accounts, updatedTxs);
      setAccounts(syncedAccounts);
      return res.newTransactions.length;
    }
    return 0;
  };

  // Check and process due recurring transactions on initial load
  useEffect(() => {
    processDueRecurring();
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

  // Strictly ensure that EVERY time a user signs in, the app immediately writes/updates their public profile
  // to Firebase RTDB at shared_accounts/profile_${cleanMy16Id} (including numericId, name, avatar, and uid).
  useEffect(() => {
    let isMounted = true;

    const syncIdentity = async (user: any) => {
      if (!user) {
        // Guest user: strictly ensure 16-digit ID is not generated, stored, or published
        try {
          localStorage.removeItem('app_permanent_16digit_id');
        } catch {}
        if (settings.userProfile?.numericId) {
          setSettings((prev) => ({
            ...prev,
            userProfile: {
              ...prev.userProfile,
              numericId: '',
            },
          }));
        }
        return;
      }

      try {
        const resolvedId = await resolvePermanent16DigitId(user.uid);
        const clean16Id = cleanNumericId(resolvedId);

        if (!clean16Id || clean16Id.length !== 16) {
          console.warn('[AppContext] Resolved ID is invalid:', resolvedId);
          return;
        }

        const suggestedName = user.displayName || (user.email ? user.email.split('@')[0] : 'User');
        const currentName = settings.userProfile?.name;
        const isDefaultOrBlank =
          !currentName || currentName === 'My Profile' || currentName === 'User' || currentName.trim() === '';
        const finalName = isDefaultOrBlank && suggestedName ? suggestedName : currentName || suggestedName;
        const finalAvatar = settings.userProfile?.avatarEmoji || '👤';
        const finalPhoto = settings.userProfile?.customAvatarUrl || user.photoURL || '';

        if (isMounted) {
          setSettings((prev) => ({
            ...prev,
            userProfile: {
              ...prev.userProfile,
              numericId: clean16Id,
              name: finalName,
              avatarEmoji: finalAvatar,
              customAvatarUrl: finalPhoto || prev.userProfile?.customAvatarUrl,
            },
          }));
        }

        // IMMEDIATELY publish & update public profile to Firebase RTDB at shared_accounts/profile_${cleanMy16Id}
        await publishUserProfileCard({
          numericId: clean16Id,
          name: finalName,
          avatar: finalAvatar,
          photoURL: finalPhoto,
          uid: user.uid,
        });

        // Also publish to numericIds/${cleanMy16Id} for reverse UID lookup
        await syncNumericIdToFirebase(
          clean16Id,
          user.uid,
          finalName,
          user.email || ''
        );
      } catch (e) {
        console.warn('[AppContext] Error syncing profile on auth state change:', e);
      }
    };

    const unsubAuth = auth.onAuthStateChanged((user) => {
      syncIdentity(user);
    });

    // Also run immediate sync for current session if already signed in
    if (auth.currentUser) {
      syncIdentity(auth.currentUser);
    }

    return () => {
      isMounted = false;
      unsubAuth();
    };
  }, []);

  // Modals open/close handlers
  const openAddTxModal = (preselectedAccountId?: string, initialAmount?: number) => {
    const targetAccountId =
      preselectedAccountId ||
      selectedAccountId ||
      (accounts[0] ? accounts[0].id : undefined);
    setDefaultTxAccountId(targetAccountId);
    setDefaultTxAmount(initialAmount);
    setEditingTx(null);
    setIsAddTxModalOpen(true);
  };

  const closeAddTxModal = () => {
    setIsAddTxModalOpen(false);
    setEditingTx(null);
    setDefaultTxAccountId(undefined);
    setDefaultTxAmount(undefined);
  };

  const openEditTxModal = (tx: Transaction) => {
    setEditingTx(tx);
    setIsAddTxModalOpen(true);
  };

  const closeEditTxModal = () => {
    setEditingTx(null);
    setIsAddTxModalOpen(false);
    setDefaultTxAccountId(undefined);
    setDefaultTxAmount(undefined);
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

  // CRUD TRANSACTIONS
  const addTransaction = (txData: Omit<Transaction, 'id' | 'createdAt'>) => {
    const newTx: Transaction = {
      ...txData,
      id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: Date.now(),
    };

    const updatedTransactions = [...transactions, newTx];
    setTransactions(updatedTransactions);

    // Sync account balances
    const syncedAccounts = syncAllAccountBalances(accounts, updatedTransactions);
    setAccounts(syncedAccounts);

    showToast(t('savedSuccess'), 'success');
  };

  const updateTransaction = (updatedTx: Transaction) => {
    const updatedList = transactions.map((t) => (t.id === updatedTx.id ? updatedTx : t));
    setTransactions(updatedList);

    const syncedAccounts = syncAllAccountBalances(accounts, updatedList);
    setAccounts(syncedAccounts);

    // If currently viewing this transaction details, update it
    if (viewingTx && viewingTx.id === updatedTx.id) {
      setViewingTx(updatedTx);
    }

    showToast(t('updatedSuccess'), 'success');
  };

  const deleteTransaction = (id: string) => {
    const updatedList = transactions.filter((t) => t.id !== id);
    setTransactions(updatedList);

    const syncedAccounts = syncAllAccountBalances(accounts, updatedList);
    setAccounts(syncedAccounts);

    if (viewingTx && viewingTx.id === id) {
      setViewingTx(null);
    }

    showToast(t('deletedSuccess'), 'success');
  };

  // CRUD ACCOUNTS
  const addAccount = (accData: Omit<Account, 'id' | 'balance'>, initialBalance = 0) => {
    const newAccId = `acc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newAcc: Account = {
      ...accData,
      id: newAccId,
      balance: initialBalance,
    };

    let updatedTxs = [...transactions];
    // If starting with non-zero balance, add initial balance transaction
    if (initialBalance !== 0) {
      const now = new Date();
      const initialTx: Transaction = {
        id: `tx_init_${Date.now()}`,
        type: initialBalance > 0 ? 'income' : 'expense',
        amount: Math.abs(initialBalance),
        date: formatDateToYYYYMMDD(now),
        time: formatTimeToHHMM(now),
        accountId: newAccId,
        categoryName: 'Initial Balance',
        categoryIcon: '💵',
        description: 'Initial Account Balance',
        createdAt: Date.now(),
      };
      updatedTxs.push(initialTx);
      setTransactions(updatedTxs);
    }

    const updatedAccounts = syncAllAccountBalances([...accounts, newAcc], updatedTxs);
    setAccounts(updatedAccounts);
    showToast(t('savedSuccess'), 'success');
  };

  const updateAccount = (updatedAcc: Account, newBalanceTarget?: number) => {
    let currentTxs = [...transactions];

    if (typeof newBalanceTarget === 'number') {
      const existingAccount = accounts.find((a) => a.id === updatedAcc.id);
      const oldBalance = existingAccount ? existingAccount.balance : 0;
      const diff = newBalanceTarget - oldBalance;

      if (Math.abs(diff) >= 0.009) {
        const now = new Date();
        const symbol = settings.currencySymbol || '£';
        const adjustmentTx: Transaction = {
          id: `tx_adj_${Date.now()}`,
          type: diff > 0 ? 'income' : 'expense',
          amount: Math.abs(diff),
          date: formatDateToYYYYMMDD(now),
          time: formatTimeToHHMM(now),
          accountId: updatedAcc.id,
          categoryName: 'Manual Adjustment',
          categoryIcon: '⚙️',
          description: `Manual Adjustment: Changed from ${symbol}${oldBalance.toFixed(2)} to ${symbol}${newBalanceTarget.toFixed(2)}`,
          createdAt: Date.now(),
        };
        currentTxs = [...currentTxs, adjustmentTx];
        setTransactions(currentTxs);
      }
    }

    const updatedList = accounts.map((a) => (a.id === updatedAcc.id ? updatedAcc : a));
    const synced = syncAllAccountBalances(updatedList, currentTxs);
    setAccounts(synced);

    showToast(t('updatedSuccess'), 'success');
  };

  const deleteAccount = (id: string): boolean => {
    if (accounts.length <= 1) {
      showToast(t('cannotDeleteOnlyAccount'), 'error');
      return false;
    }

    // Remove transactions linked to this account
    const updatedTxs = transactions.filter(
      (tx) => tx.accountId !== id && tx.toAccountId !== id
    );
    setTransactions(updatedTxs);

    const remainingAccounts = accounts.filter((a) => a.id !== id);
    const synced = syncAllAccountBalances(remainingAccounts, updatedTxs);
    setAccounts(synced);

    if (selectedAccountId === id) {
      setSelectedAccountId(null);
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
    showToast(t('savedSuccess'), 'success');
  };

  const updateCategory = (updatedCat: Category) => {
    setCategories((prev) => prev.map((c) => (c.id === updatedCat.id ? updatedCat : c)));
    showToast(t('updatedSuccess'), 'success');
  };

  const deleteCategory = (id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
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
    setSettings((prev) => ({ ...prev, ...newSettings }));
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

      if (Array.isArray(data.accounts) && data.accounts.length > 0) {
        targetAccounts = data.accounts;
      }
      if (Array.isArray(data.categories) && data.categories.length > 0) {
        targetCategories = data.categories;
      }
      if (Array.isArray(data.transactions)) {
        targetTxs = data.transactions;
      }

      const syncedAccounts = syncAllAccountBalances(targetAccounts, targetTxs);

      setAccounts(syncedAccounts);
      setCategories(targetCategories);
      setTransactions(targetTxs);
      if (Array.isArray(data.recurringTransactions)) {
        setRecurringTransactions(data.recurringTransactions);
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
          let targetAccId = incTx.accountId;
          if (!updatedAccounts.some((a) => a.id === targetAccId)) {
            targetAccId = updatedAccounts[0]?.id || 'default_acc';
          }
          updatedTxs.push({
            ...incTx,
            id: incTx.id || `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            accountId: targetAccId,
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

  // Seamless Shared Account Live View Switcher (Item 13)
  const [activeSharedId, setActiveSharedId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const search = new URLSearchParams(window.location.search);
      const share = search.get('share') || search.get('sharedAccountId');
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
    window.history.replaceState({}, '', u.pathname + (u.search ? u.search : ''));
  };

  // When an invitation link is opened (?share=...), automatically register it into "Shared with Me"
  useEffect(() => {
    if (!activeSharedId) return;
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
    openEditTxModal,
    closeEditTxModal,
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
    setIsSharedHubModalOpen,
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
    importFullData,
    importSingleAccountData,
    importSharedItems,
    showToast,
    showConfirm,
    showPrompt,
    closeCustomDialog,
    setActiveSharedId,
    setActiveSharedSnapshot,
    openSharedLiveView,
    closeSharedLiveView,
  });

  // Context value only changes when actual STATE changes (mutators are stable)
  const contextValue = useMemo<AppContextType>(
    () => ({
      ...stable,
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
      editingTx,
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
      isSharedHubModalOpen,
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
      activeSharedId,
      activeSharedSnapshot,
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
      editingTx,
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
      isSharedHubModalOpen,
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
      activeSharedId,
      activeSharedSnapshot,
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
