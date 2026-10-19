import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  X,
  User,
  Calendar,
  Globe,
  Moon,
  Sun,
  Download,
  Upload,
  Layers,
  Sparkles,
  RotateCw,
  Coins,
  BookOpen,
  Folder,
  Clock,
  ShieldCheck,
  Check,
  Search,
  Shield,
  Lock,
  KeyRound,
  RefreshCw,
  Cloud,
  Mail,
  Users,
} from 'lucide-react';
import { loadSecuritySettings, saveSecuritySettings } from '../utils/security';
import { PWAInstallButton } from './PWAInstallButton';
import { ExportCustomizeModal } from './ExportCustomizeModal';
import { auth, rtdb } from '../utils/firebase';
import { ref, set } from 'firebase/database';
import { WeekStartDay } from '../types';
import { WORLD_CURRENCIES, CurrencyOption } from '../utils/currencies';
import {
  loadAutoBackupConfig,
  saveAutoBackupConfig,
  saveDirectoryHandle,
  executeAutoBackup,
  AutoBackupConfig,
  BackupScheduleFrequency,
} from '../utils/autoBackup';

export const Sidebar: React.FC = () => {
  const {
    isSidebarOpen,
    setIsSidebarOpen,
    setIsUserProfileModalOpen,
    setIsFeaturesModalOpen,
    setIsRecurringModalOpen,
    recurringTransactions,
    setIsPinModalOpen,
    setIsSharedHubModalOpen,
    lockApp,
    settings,
    updateSettings,
    accounts,
    categories,
    transactions,
    importFullData,
    showToast,
    t,
  } = useApp();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const currencyMenuRef = useRef<HTMLDivElement | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');
  const [currencyDropdownOpen, setCurrencyDropdownOpen] = useState(false);
  const [securitySettings, setSecuritySettings] = useState(() => loadSecuritySettings());

  // Click outside auto-closes currency dropdown
  useEffect(() => {
    if (!currencyDropdownOpen) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (currencyMenuRef.current && !currencyMenuRef.current.contains(e.target as Node)) {
        setCurrencyDropdownOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [currencyDropdownOpen]);

  // Auto Backup Configuration
  const [backupConfig, setBackupConfig] = useState<AutoBackupConfig>(() => loadAutoBackupConfig());

  const isArabic = settings.language === 'ar';

  const filteredCurrencies = useMemo(() => {
    if (!currencySearch.trim()) return WORLD_CURRENCIES;
    const q = currencySearch.toLowerCase().trim();
    return WORLD_CURRENCIES.filter((c) => {
      const matchCode = c.code.toLowerCase().includes(q);
      const matchSymbol = c.symbol.toLowerCase().includes(q);
      const matchEn = c.name.en.toLowerCase().includes(q);
      const matchAr = c.name.ar.toLowerCase().includes(q);
      return matchCode || matchSymbol || matchEn || matchAr;
    });
  }, [currencySearch]);

  const activeCurrency = useMemo(() => {
    return (
      WORLD_CURRENCIES.find((c) => c.symbol === settings.currencySymbol) ||
      WORLD_CURRENCIES[2] // GBP default
    );
  }, [settings.currencySymbol]);

  const [isClosing, setIsClosing] = useState(false);

  const handleAnimatedClose = (afterClose?: () => void) => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      setIsSidebarOpen(false);
      afterClose?.();
    }, 180);
  };

  if (!isSidebarOpen) return null;

  const handleSelectCurrency = (cur: CurrencyOption) => {
    updateSettings({ currencySymbol: cur.symbol });
    setCurrencyDropdownOpen(false);
    showToast(
      isArabic
        ? `تم تغيير العملة إلى ${cur.name.ar} (${cur.symbol})`
        : `Currency changed to ${cur.name.en} (${cur.symbol})`,
      'success'
    );
  };

  const handleSelectBackupFolder = async () => {
    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      try {
        // @ts-expect-error File System Access API
        const dirHandle = await window.showDirectoryPicker();
        await saveDirectoryHandle(dirHandle);
        const nextConfig: AutoBackupConfig = {
          ...backupConfig,
          enabled: true,
          folderName: dirHandle.name,
        };
        setBackupConfig(nextConfig);
        saveAutoBackupConfig(nextConfig);
        showToast(
          isArabic
            ? `تم تحديد مجلد الحفظ: ${dirHandle.name}`
            : `Backup folder selected: ${dirHandle.name}`,
          'success'
        );
      } catch (err) {
        console.warn('Directory pick cancelled or failed:', err);
      }
    } else {
      showToast(
        isArabic
          ? 'المتصفح لا يدعم الوصول المباشر للمجلدات. سيتم حفظ النسخ الاحتياطية محلياً.'
          : 'Direct folder access not supported on this browser. Local snapshot enabled.',
        'info'
      );
      const nextConfig: AutoBackupConfig = {
        ...backupConfig,
        enabled: true,
        folderName: 'Local Storage Snapshot',
      };
      setBackupConfig(nextConfig);
      saveAutoBackupConfig(nextConfig);
    }
  };

  const handleRunManualBackup = async () => {
    const res = await executeAutoBackup({
      accounts,
      categories,
      transactions,
      settings,
    });
    if (res.folderBackedUp) {
      showToast(
        isArabic ? 'تم حفظ النسخة الاحتياطية بالمجلد بنجاح!' : 'Backup saved to folder successfully!',
        'success'
      );
    } else {
      showToast(
        isArabic ? 'تم حفظ لقطة احتياطية دائمة في الهاتف' : 'Local snapshot backup saved successfully',
        'success'
      );
    }
    setBackupConfig(loadAutoBackupConfig());
  };

  const handleUpdateBackupConfig = (partial: Partial<AutoBackupConfig>) => {
    const next = { ...backupConfig, ...partial };
    setBackupConfig(next);
    saveAutoBackupConfig(next);
  };

  const handleEmailBackup = () => {
    const data = {
      version: '1.1.3',
      exportDate: new Date().toISOString(),
      accounts,
      categories,
      transactions,
      settings,
    };
    const subject = encodeURIComponent(`Personal Finance Tracker Backup (${new Date().toLocaleDateString()})`);
    const body = encodeURIComponent(
      `Hello,\n\nHere is your Personal Finance Tracker backup data for ${new Date().toLocaleString()}.\n\nAccounts: ${accounts.length}\nCategories: ${categories.length}\nTransactions: ${transactions.length}\n\nRAW DATA (JSON):\n${JSON.stringify(data, null, 2)}`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    showToast(isArabic ? 'فتح تطبيق البريد لإرسال النسخة الاحتياطية' : 'Opening email client with backup data', 'info');
  };

  const handleCloudBackup = async () => {
    const user = auth.currentUser;
    if (!user) {
      setIsUserProfileModalOpen(true);
      showToast(isArabic ? 'يرجى تسجيل الدخول أولاً للنسخ السحابي' : 'Please sign in first to back up to cloud', 'info');
      return;
    }
    try {
      const backupRef = ref(rtdb, `users/${user.uid}/backup`);
      await set(backupRef, {
        version: '1.1.3',
        backupDate: new Date().toISOString(),
        accounts,
        categories,
        transactions,
        settings,
      });
      showToast(isArabic ? 'تم رفع نسخة احتياطية مشفرة إلى السحابة بنجاح!' : 'Encrypted backup synced to secure cloud successfully!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Cloud backup failed', 'error');
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const ok = importFullData(parsed);
        if (ok) {
          setIsSidebarOpen(false);
        }
      } catch (err) {
        console.error(err);
        showToast(t('invalidFileError'), 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleReloadApp = () => {
    setIsSidebarOpen(false);
    window.location.reload();
  };

  return (
    <div
      onClick={() => handleAnimatedClose()}
      className={`fixed inset-0 z-50 flex bg-black/60 backdrop-blur-md transition-all duration-200 ${
        isClosing ? 'modal-backdrop-closing' : 'modal-backdrop-anim'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-84 max-w-[85vw] h-full flex flex-col bg-zinc-950/95 backdrop-blur-2xl border-r rtl:border-l rtl:border-r-0 border-zinc-800/80 shadow-2xl text-white overflow-hidden transition-all duration-200 ${
          isClosing ? 'opacity-0 -translate-x-full rtl:translate-x-full' : 'animate-in slide-in-from-left rtl:slide-in-from-right duration-300'
        }`}
      >
        {/* Hidden file input for import */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImportFile}
          accept=".json"
          className="hidden"
        />

        {/* User Profile Header */}
        <div className="p-5 border-b border-zinc-800/80 bg-zinc-900/50 flex items-center justify-between shrink-0">
          <div
            onClick={() => {
              handleAnimatedClose(() => setIsUserProfileModalOpen(true));
            }}
            role="button"
            tabIndex={0}
            className="flex items-center gap-3.5 cursor-pointer group"
          >
            <div className="w-13 h-13 rounded-full bg-zinc-900 border-2 border-blue-500/80 overflow-hidden flex items-center justify-center text-3xl shadow-lg group-hover:scale-105 transition shrink-0">
              {settings.userProfile?.customAvatarUrl ? (
                <img
                  src={settings.userProfile.customAvatarUrl}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{settings.userProfile?.avatarEmoji || '👤'}</span>
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-white text-base group-hover:text-blue-400 transition truncate">
                {settings.userProfile?.name || 'My Profile'}
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">{t('editProfile')}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleAnimatedClose()}
            className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Preferences & Cycle Settings */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-400" />
              <span>{t('preferences')}</span>
            </h4>

            <div className="space-y-3.5">
              {/* World Currency Selector */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1 flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isArabic ? 'العملة الأساسية' : 'Primary Currency'}</span>
                </label>
                <div ref={currencyMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setCurrencyDropdownOpen(!currencyDropdownOpen)}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-white hover:border-zinc-700 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-xs">
                        {activeCurrency.symbol}
                      </span>
                      <span>
                        {activeCurrency.code} — {isArabic ? activeCurrency.name.ar : activeCurrency.name.en}
                      </span>
                    </div>
                    <span className="text-zinc-500 text-[10px]">▼</span>
                  </button>

                  {currencyDropdownOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute z-40 left-0 right-0 mt-1 rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl p-2 max-h-56 overflow-y-auto space-y-1"
                    >
                      <div className="relative mb-2">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input
                          type="text"
                          value={currencySearch}
                          onChange={(e) => setCurrencySearch(e.target.value)}
                          placeholder={isArabic ? 'ابحث في العملات...' : 'Search currencies...'}
                          className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 outline-none focus:border-blue-500"
                        />
                      </div>
                      {filteredCurrencies.map((c) => {
                        const isCurSelected = c.symbol === settings.currencySymbol;
                        return (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => handleSelectCurrency(c)}
                            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left text-xs transition cursor-pointer ${
                              isCurSelected
                                ? 'bg-blue-600/20 text-white font-bold'
                                : 'text-zinc-300 hover:bg-zinc-800'
                            }`}
                          >
                            <span className="truncate">
                              <span className="font-mono font-bold text-amber-400 inline-block w-8">
                                {c.symbol}
                              </span>
                              {c.code} — {isArabic ? c.name.ar : c.name.en}
                            </span>
                            {isCurSelected && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Week Start Day */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">{t('weekStartDay')}</label>
                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
                  {(['saturday', 'sunday', 'monday'] as WeekStartDay[]).map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => updateSettings({ weekStartDay: day })}
                      className={`py-1.5 text-xs font-semibold rounded-lg capitalize transition cursor-pointer ${
                        settings.weekStartDay === day
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {t(day)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Default Month Start Day */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">{t('defaultMonthStartDay')}</label>
                <select
                  value={settings.defaultMonthStartDay}
                  onChange={(e) =>
                    updateSettings({ defaultMonthStartDay: parseInt(e.target.value, 10) })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white outline-none cursor-pointer"
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      Day {d} of month
                    </option>
                  ))}
                </select>
              </div>

              {/* Language Toggle: English / العربية */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('language')}</span>
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => updateSettings({ language: 'en' })}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      settings.language === 'en'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    English (LTR)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSettings({ language: 'ar' })}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      settings.language === 'ar'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    العربية (RTL)
                  </button>
                </div>
              </div>

              {/* Theme Mode: Dark / Light */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1 flex items-center gap-1.5">
                  {settings.themeMode === 'dark' ? (
                    <Moon className="w-3.5 h-3.5 text-indigo-400" />
                  ) : (
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span>{t('theme')}</span>
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => updateSettings({ themeMode: 'dark' })}
                    className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      settings.themeMode === 'dark'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5" />
                    <span>{t('darkMode')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSettings({ themeMode: 'light' })}
                    className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      settings.themeMode === 'light'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5" />
                    <span>{t('lightMode')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Features, Guides, and Scheduled Recurring */}
          <div className="space-y-2.5">
            {/* Recurring Transactions Manager Button */}
            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(false);
                setIsRecurringModalOpen(true);
              }}
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-xs font-bold text-zinc-200 transition cursor-pointer shadow-md active:scale-98"
            >
              <div className="flex items-center gap-2.5">
                <RefreshCw className="w-4 h-4 text-emerald-400" />
                <span>{isArabic ? 'المعاملات المتكررة المجدولة' : 'Recurring Transactions'}</span>
              </div>
              {recurringTransactions.length > 0 && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {recurringTransactions.length}
                </span>
              )}
            </button>

            {/* Single Independent How to Use & Feature Directory Button */}
            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(false);
                setIsFeaturesModalOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2.5 py-3 rounded-2xl bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/40 text-xs font-bold text-blue-400 transition cursor-pointer shadow-lg shadow-blue-950/20 active:scale-98"
            >
              <BookOpen className="w-4 h-4 text-blue-400" />
              <span>{isArabic ? 'دليل الاستخدام ومميزات التطبيق' : 'How to Use & Feature Directory'}</span>
            </button>

            {/* Shared Accounts Manager Hub */}
            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(false);
                setIsSharedHubModalOpen(true);
              }}
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-cyan-950/40 hover:bg-cyan-900/40 border border-cyan-500/40 text-xs font-bold text-white transition cursor-pointer shadow-lg active:scale-98"
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4 text-cyan-400" />
                <span>{isArabic ? 'مركز الحسابات المشتركة' : 'Shared Accounts Hub'}</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {isArabic ? 'مباشر' : 'Live'}
              </span>
            </button>

            {/* Cloud Sync & Account */}
            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(false);
                setIsUserProfileModalOpen(true);
              }}
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-blue-950/70 to-purple-950/70 hover:from-blue-900/70 hover:to-purple-900/70 border border-blue-500/40 text-xs font-bold text-white transition cursor-pointer shadow-lg active:scale-98"
            >
              <div className="flex items-center gap-2.5">
                <Cloud className="w-4 h-4 text-blue-400" />
                <span>{isArabic ? 'حساب المزامنة السحابية' : 'Cloud Sync & Account'}</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {isArabic ? 'حسابك' : 'Profile'}
              </span>
            </button>
          </div>

          {/* App Security & Biometric Lock Section */}
          <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-blue-400" />
                <span>{isArabic ? 'قفل التطبيق والأمان' : 'App Lock & Security'}</span>
              </h4>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={securitySettings.isLockEnabled}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setIsPinModalOpen(true);
                    } else {
                      const updated = { ...securitySettings, isLockEnabled: false };
                      saveSecuritySettings(updated);
                      setSecuritySettings(updated);
                      showToast(isArabic ? 'تم تعطيل قفل التطبيق' : 'App Lock disabled', 'info');
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className={`accordion-wrapper ${securitySettings.isLockEnabled ? 'open' : 'closed'}`}>
              <div className="accordion-inner space-y-2 pt-1 text-xs">
                <button
                  type="button"
                  onClick={() => setIsPinModalOpen(true)}
                  className="w-full py-2 px-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-300 flex items-center justify-between transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isArabic ? 'تغيير رمز PIN' : 'Change 4-Digit PIN'}</span>
                  </span>
                  <span className="text-[10px] text-blue-400 font-bold">{isArabic ? 'تعديل' : 'Edit'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsSidebarOpen(false);
                    lockApp();
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-400 font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'قفل التطبيق الآن' : 'Lock Application Now'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Automated Scheduled Backups Section with Smooth Accordion */}
          <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>{isArabic ? 'النسخ الاحتياطي التلقائي' : 'Auto Backup'}</span>
              </h4>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={backupConfig.enabled}
                  onChange={(e) => handleUpdateBackupConfig({ enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div className={`accordion-wrapper ${backupConfig.enabled ? 'open' : 'closed'}`}>
              <div className="accordion-inner space-y-2.5 pt-1 text-xs">
                {/* Folder Selector */}
                <div>
                  <button
                    type="button"
                    onClick={handleSelectBackupFolder}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-300 transition cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">{backupConfig.folderName || (isArabic ? 'اختر مجلد الحفظ...' : 'Select Target Folder...')}</span>
                    </span>
                    <span className="text-[10px] text-blue-400 font-bold shrink-0">{isArabic ? 'تغيير' : 'Change'}</span>
                  </button>
                </div>

                {/* Frequency selector */}
                <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-zinc-950 border border-zinc-800">
                  {(['daily', 'weekly', 'monthly'] as BackupScheduleFrequency[]).map((freq) => (
                    <button
                      key={freq}
                      type="button"
                      onClick={() => handleUpdateBackupConfig({ frequency: freq })}
                      className={`py-1 rounded-lg text-[11px] font-semibold capitalize transition ${
                        backupConfig.frequency === freq
                          ? 'bg-emerald-600 text-white'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {freq}
                    </button>
                  ))}
                </div>

                {/* Day of Week Selector if Weekly */}
                {backupConfig.frequency === 'weekly' && (
                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-400 font-medium">
                      {isArabic ? 'اليوم المفضل أسبوعياً:' : 'Preferred Day of Week:'}
                    </span>
                    <div className="grid grid-cols-7 gap-1">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, idx) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => handleUpdateBackupConfig({ dayOfWeek: idx })}
                          className={`py-1 rounded-lg text-[10px] font-bold transition ${
                            backupConfig.dayOfWeek === idx
                              ? 'bg-blue-600 text-white'
                              : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Day of Month Selector if Monthly */}
                {backupConfig.frequency === 'monthly' && (
                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-400 font-medium">
                      {isArabic ? 'يوم الشهر (1 - 28):' : 'Preferred Day of Month:'}
                    </span>
                    <div className="grid grid-cols-6 gap-1">
                      {[1, 5, 10, 15, 20, 25].map((dom) => (
                        <button
                          key={dom}
                          type="button"
                          onClick={() => handleUpdateBackupConfig({ dayOfMonth: dom })}
                          className={`py-1 rounded-lg text-[10px] font-bold transition ${
                            backupConfig.dayOfMonth === dom
                              ? 'bg-blue-600 text-white'
                              : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                          }`}
                        >
                          Day {dom}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Backup Actions Row */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleEmailBackup}
                    className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-[11px] font-bold transition cursor-pointer active:scale-95"
                  >
                    <Mail className="w-3.5 h-3.5 text-blue-400" />
                    <span>{isArabic ? 'نسخ للإيميل' : 'Email Backup'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCloudBackup}
                    className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-[11px] font-bold transition cursor-pointer active:scale-95"
                  >
                    <Cloud className="w-3.5 h-3.5 text-purple-400" />
                    <span>{isArabic ? 'نسخ للسحابة' : 'Cloud Backup'}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleRunManualBackup}
                  className="w-full py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold transition cursor-pointer active:scale-98"
                >
                  {isArabic ? 'تشغيل النسخ الاحتياطي الآن' : 'Test & Run Folder Backup'}
                </button>
              </div>
            </div>
          </div>

          {/* PWA & Data Management */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <span>{t('pwaAndData')}</span>
            </h4>

            <div className="space-y-2.5">
              <PWAInstallButton />

              {/* Granular Export Button */}
              <button
                type="button"
                onClick={() => setIsExportModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-200 transition cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>{isArabic ? 'تخصيص تصدير البيانات (JSON)' : 'Customize Data Export (JSON)'}</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-200 transition cursor-pointer"
              >
                <Upload className="w-4 h-4 text-purple-400" />
                <span>{t('importData')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Footer: Version & Refresh Button */}
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-950 flex items-center justify-between text-xs text-zinc-400 font-mono shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-zinc-300">Version: Beta v1.1.3</span>
          </div>

          {/* Refresh App Button */}
          <button
            type="button"
            onClick={handleReloadApp}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition cursor-pointer active:scale-95"
            title="Refresh App"
          >
            <RotateCw className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[11px] font-semibold">{isArabic ? 'تحديث التطبيق' : 'Refresh App'}</span>
          </button>
        </div>
      </div>

      {/* Persistent Customize Export Modal */}
      <ExportCustomizeModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />
    </div>
  );
};
