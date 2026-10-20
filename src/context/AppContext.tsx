import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
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
import { getOrCreateNumericId, syncNumericIdToFirebase } from '../utils/userId';
import { auth } from '../utils/firebase';
import { decodeShareSnapshot } from '../utils/sharing';

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
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

  // Multi-Select for Transactions
  selectedTxIds: string[];
  isTxMultiSelect: boolean;
  startTxMultiSelect: (initialId?: string) => void;
  toggleTxSelection: (id: string) => void;
  selectAllTxs: (ids: string[]) => void;
  clearTxSelection: () => void;
  deleteSelectedTxs: () => void;
  batchAssignCategory: (txIds: string[], category: Category) => void;

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

  // Toasts
  toasts: ToastItem[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;

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
  openSharedLiveView: (id: string) => void;
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

  // Multi-Select States
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [isTxMultiSelect, setIsTxMultiSelect] = useState<boolean>(false);

  const startTxMultiSelect = (initialId?: string) => {
    setIsTxMultiSelect(true);
    if (initialId) setSelectedTxIds([initialId]);
  };

  const toggleTxSelection = (id: string) => {
    setSelectedTxIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAllTxs = (ids: string[]) => {
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

  const clearTxSelection = () => {
    setSelectedTxIds([]);
    setIsTxMultiSelect(false);
    releaseScrollLocks();
  };

  const deleteSelectedTxs = () => {
    if (selectedTxIds.length === 0) return;
    const count = selectedTxIds.length;
    const updatedList = transactions.filter((t) => !selectedTxIds.includes(t.id));
    setTransactions(updatedList);
    const synced = syncAllAccountBalances(accounts, updatedList);
    setAccounts(synced);
    clearTxSelection();
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

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [isCategoryMultiSelect, setIsCategoryMultiSelect] = useState<boolean>(false);

  const startCategoryMultiSelect = (initialId?: string) => {
    setIsCategoryMultiSelect(true);
    if (initialId) setSelectedCategoryIds([initialId]);
  };

  const toggleCategorySelection = (id: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAllCategories = (ids: string[]) => {
    setSelectedCategoryIds(ids);
  };

  const clearCategorySelection = () => {
    setSelectedCategoryIds([]);
    setIsCategoryMultiSelect(false);
    releaseScrollLocks();
  };

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

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = `${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  };

  // Translation helper
  const t = (key: keyof typeof translations.en): string => {
    const lang = settings.language || 'en';
    return (translations[lang] && translations[lang][key]) || translations.en[key] || key;
  };

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

  useEffect(() => {
    saveRecurringTransactions(recurringTransactions);
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
      const p = new URLSearchParams(window.location.search).get('sharedAccountId');
      return p && p.trim() ? p.trim() : null;
    }
    return null;
  });

  const [activeSharedSnapshot, setActiveSharedSnapshot] = useState<any | null>(() => {
    if (typeof window !== 'undefined') {
      const s = new URLSearchParams(window.location.search).get('sharedData');
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

  const openSharedLiveView = (id: string) => {
    setActiveSharedId(id);
    const u = new URL(window.location.href);
    u.searchParams.set('sharedAccountId', id);
    window.history.pushState({}, '', u.toString());
  };

  const closeSharedLiveView = () => {
    setActiveSharedId(null);
    setActiveSharedSnapshot(null);
    const u = new URL(window.location.href);
    u.searchParams.delete('sharedAccountId');
    u.searchParams.delete('sharedData');
    window.history.replaceState({}, '', u.pathname + (u.search ? u.search : ''));
  };

  // Auto-populate profile name from Google Account / Email & Sync Numeric ID (Item 7 & 12)
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) {
        const currentName = settings.userProfile?.name;
        const isDefaultOrBlank =
          !currentName ||
          currentName === 'My Profile' ||
          currentName === 'User' ||
          currentName.trim() === '';
        const suggestedName = user.displayName || (user.email ? user.email.split('@')[0] : 'User');
        const numId = getOrCreateNumericId(settings.userProfile?.numericId);

        const updatedProfile = {
          ...settings.userProfile,
          numericId: numId,
          name: isDefaultOrBlank && suggestedName ? suggestedName : currentName || 'User',
        };

        if (isDefaultOrBlank || !settings.userProfile?.numericId) {
          updateSettings({ userProfile: updatedProfile });
        }

        syncNumericIdToFirebase(numId, user.uid, updatedProfile.name, user.email || undefined);
      }
    });
    return () => unsub();
  }, [settings.userProfile]);

  return (
    <AppContext.Provider
      value={{
        accounts,
        categories,
        transactions,
        settings,
        currentTab,
        setCurrentTab,
        homeSubView,
        setHomeSubView,
        selectedAccountId,
        setSelectedAccountId,
        periodFilter,
        setPeriodFilter,
        periodOffset,
        setPeriodOffset,
        customDateRange,
        setCustomDateRange,
        advancedFilter,
        setAdvancedFilter,
        clearAdvancedFilter,
        isSidebarOpen,
        setIsSidebarOpen,
        isAddTxModalOpen,
        defaultTxAccountId,
        defaultTxAmount,
        openAddTxModal,
        closeAddTxModal,
        editingTx,
        openEditTxModal,
        closeEditTxModal,
        viewingTx,
        openTxDetailsModal,
        closeTxDetailsModal,
        isAccountModalOpen,
        editingAccount,
        openAddAccountModal,
        openEditAccountModal,
        closeAccountModal,
        isCategoryModalOpen,
        editingCategory,
        defaultCategoryType,
        openAddCategoryModal,
        openEditCategoryModal,
        closeCategoryModal,
        isUserProfileModalOpen,
        setIsUserProfileModalOpen,
        isResetPeriodModalOpen,
        setIsResetPeriodModalOpen,
        isFilterModalOpen,
        setIsFilterModalOpen,
        isFeaturesModalOpen,
        setIsFeaturesModalOpen,
        isRecurringModalOpen,
        setIsRecurringModalOpen,
        isPinModalOpen,
        setIsPinModalOpen,
        isSharedHubModalOpen,
        setIsSharedHubModalOpen,
        isAppLocked,
        setIsAppLocked,
        unlockApp,
        lockApp,
        recurringTransactions,
        addRecurringTransaction,
        updateRecurringTransaction,
        deleteRecurringTransaction,
        processDueRecurring,
        budgetAlerts,
        dismissBudgetAlert,
        dismissedAlertIds,
        isEmojiPickerOpen,
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
        selectedTxIds,
        isTxMultiSelect,
        startTxMultiSelect,
        toggleTxSelection,
        selectAllTxs,
        clearTxSelection,
        deleteSelectedTxs,
        batchAssignCategory,
        selectedCategoryIds,
        isCategoryMultiSelect,
        startCategoryMultiSelect,
        toggleCategorySelection,
        selectAllCategories,
        clearCategorySelection,
        deleteSelectedCategories,
        updateSettings,
        applyPeriodReset,
        importFullData,
        importSingleAccountData,
        toasts,
        showToast,
        showConfirm,
        showPrompt,
        customDialogState,
        closeCustomDialog,
        activeSharedId,
        setActiveSharedId,
        activeSharedSnapshot,
        setActiveSharedSnapshot,
        openSharedLiveView,
        closeSharedLiveView,
        t,
      }}
    >
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
