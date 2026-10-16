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
} from '../types';
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
  currentTab: 'home' | 'budget' | 'insights' | 'accounts';
  setCurrentTab: (tab: 'home' | 'budget' | 'insights' | 'accounts') => void;
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
  openAddTxModal: (defaultAccountId?: string) => void;
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

  // Categories CRUD
  addCategory: (cat: Omit<Category, 'id'>) => void;
  updateCategory: (cat: Category) => void;
  deleteCategory: (id: string) => void;
  reorderCategories: (orderedIds: string[]) => void;

  // Settings & Reset
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  applyPeriodReset: (type: 'now' | 'custom' | 'revert', customDate?: string) => void;

  // Backup & Restore
  importFullData: (data: AppData) => boolean;
  importSingleAccountData: (importedAccount: Account, importedTxs: Transaction[]) => boolean;

  // Toasts
  toasts: ToastItem[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;

  // Localization
  t: (key: keyof typeof translations.en) => string;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const initial = useMemo(() => loadInitialData(), []);

  const [accounts, setAccounts] = useState<Account[]>(initial.accounts);
  const [categories, setCategories] = useState<Category[]>(initial.categories);
  const [transactions, setTransactions] = useState<Transaction[]>(initial.transactions);
  const [settings, setSettings] = useState<AppSettings>(initial.settings);

  // Nav
  const [currentTab, setCurrentTab] = useState<'home' | 'budget' | 'insights' | 'accounts'>('home');
  const [homeSubView, setHomeSubView] = useState<'daily' | 'calendar'>('daily');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  // Period filters
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterType>('this_month');
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

  // Emoji picker
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [emojiCallback, setEmojiCallback] = useState<((emoji: string) => void) | null>(null);

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
  const openAddTxModal = (preselectedAccountId?: string) => {
    setDefaultTxAccountId(preselectedAccountId || (accounts[0] ? accounts[0].id : undefined));
    setEditingTx(null);
    setIsAddTxModalOpen(true);
  };

  const closeAddTxModal = () => {
    setIsAddTxModalOpen(false);
    setDefaultTxAccountId(undefined);
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
        isUneditable: true,
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

    // CRITICAL REQUIREMENT:
    // If the user changes Current Balance from OldValue to NewValue,
    // automatically create a permanent, uneditable transaction:
    // "Manual Adjustment: Changed from £[OldValue] to £[NewValue]"
    // Category/Icon: ⚙️ Manual Adjustment
    // Amount: NewValue - OldValue (Income if positive, Expense if negative)
    // isUneditable: true
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
          isUneditable: true,
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

  // IMPORT / RESTORE
  const importFullData = (data: AppData): boolean => {
    try {
      if (!data || !Array.isArray(data.accounts) || !Array.isArray(data.categories)) {
        showToast(t('invalidFileError'), 'error');
        return false;
      }
      const safeTxs = Array.isArray(data.transactions) ? data.transactions : [];
      const syncedAccounts = syncAllAccountBalances(data.accounts, safeTxs);

      setAccounts(syncedAccounts);
      setCategories(data.categories);
      setTransactions(safeTxs);
      if (data.settings) {
        setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
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
        addCategory,
        updateCategory,
        deleteCategory,
        reorderCategories,
        updateSettings,
        applyPeriodReset,
        importFullData,
        importSingleAccountData,
        toasts,
        showToast,
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
