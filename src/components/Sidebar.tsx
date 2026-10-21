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
  Trash2,
  Copy,
} from 'lucide-react';
import { loadSecuritySettings, saveSecuritySettings, isBiometricAvailable } from '../utils/security';
import { format16DigitId } from '../utils/userId';
import { PWAInstallButton } from './PWAInstallButton';
import { ExportCustomizeModal } from './ExportCustomizeModal';
import { auth, rtdb } from '../utils/firebase';
import { signOut } from 'firebase/auth';
import { ref, set, get } from 'firebase/database';
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
    showConfirm,
    t,
  } = useApp();

  const [isBioSupported, setIsBioSupported] = useState<boolean>(true);

  useEffect(() => {
    isBiometricAvailable().then(setIsBioSupported).catch(() => setIsBioSupported(false));
  }, []);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const currencyMenuRef = useRef<HTMLDivElement | null>(null);
  const sidebarTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');
  const [currencyDropdownOpen, setCurrencyDropdownOpen] = useState(false);
  const [securitySettings, setSecuritySettings] = useState(() => loadSecuritySettings());

  // Keep securitySettings live and synchronized
  useEffect(() => {
    const handleSecUpdate = (e: any) => {
      if (e?.detail) setSecuritySettings(e.detail);
      else setSecuritySettings(loadSecuritySettings());
    };
    window.addEventListener('app_security_updated', handleSecUpdate);
    return () => window.removeEventListener('app_security_updated', handleSecUpdate);
  }, []);

  useEffect(() => {
    if (isSidebarOpen) {
      setSecuritySettings(loadSecuritySettings());
    }
  }, [isSidebarOpen]);

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
  const [backupProgress, setBackupProgress] = useState<number | null>(null);
  const [backupStatusLabel, setBackupStatusLabel] = useState<string>('');

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

  const handleBackupNow = async () => {
    setBackupProgress(25);
    setBackupStatusLabel(isArabic ? 'جارٍ جمع البيانات...' : 'Gathering financial data...');
    try {
      const data = {
        version: '1.1.10',
        exportDate: new Date().toISOString(),
        accounts,
        categories,
        transactions,
        settings,
      };

      setBackupProgress(65);
      setBackupStatusLabel(isArabic ? 'جارٍ إنشاء ملف النسخة الاحتياطية...' : 'Generating backup file...');

      // 1. Export JSON file directly to browser download
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `money-manager-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // 2. Persist local backup snapshot / folder
      await executeAutoBackup({
        accounts,
        categories,
        transactions,
        settings,
      });

      setBackupProgress(100);
      setBackupStatusLabel(isArabic ? 'تم حفظ وتنزيل النسخة بنجاح!' : 'Backup exported and saved successfully!');
      showToast(
        isArabic ? 'تم تنزيل وحفظ النسخة الاحتياطية بنجاح!' : 'Backup exported and saved successfully!',
        'success'
      );
      setBackupConfig(loadAutoBackupConfig());
    } catch (e: any) {
      setBackupProgress(null);
      showToast(e?.message || 'Backup failed', 'error');
    } finally {
      setTimeout(() => {
        setBackupProgress(null);
        setBackupStatusLabel('');
      }, 1500);
    }
  };

  const handleUpdateBackupConfig = (partial: Partial<AutoBackupConfig>) => {
    const next = { ...backupConfig, ...partial };
    setBackupConfig(next);
    saveAutoBackupConfig(next);
  };

  const handleEmailBackup = () => {
    const data = {
      version: '1.1.10',
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
    setBackupProgress(20);
    setBackupStatusLabel(isArabic ? 'جارٍ فحص بيانات الحساب...' : 'Validating account credentials...');
    try {
      setBackupProgress(50);
      setBackupStatusLabel(isArabic ? 'جارٍ تشفير ومزامنة البيانات مع السحابة...' : 'Encrypting and syncing backup...');
      const backupRef = ref(rtdb, `users/${user.uid}/backup`);
      await set(backupRef, {
        version: '1.1.10',
        backupDate: new Date().toISOString(),
        accounts,
        categories,
        transactions,
        settings,
      });
      setBackupProgress(100);
      setBackupStatusLabel(isArabic ? 'اكتمل النسخ السحابي بنجاح!' : 'Cloud backup complete!');
      showToast(isArabic ? 'تم رفع نسخة احتياطية مشفرة إلى السحابة بنجاح!' : 'Encrypted backup synced to secure cloud successfully!', 'success');
    } catch (err: any) {
      setBackupProgress(null);
      showToast(err?.message || 'Cloud backup failed', 'error');
    } finally {
      setTimeout(() => {
        setBackupProgress(null);
        setBackupStatusLabel('');
      }, 1500);
    }
  };

  const handleCloudRestore = async () => {
    const user = auth.currentUser;
    if (!user) {
      setIsUserProfileModalOpen(true);
      showToast(isArabic ? 'يرجى تسجيل الدخول أولاً لاستعادة النسخة السحابية' : 'Please sign in first to restore cloud backup', 'info');
      return;
    }
    setBackupProgress(20);
    setBackupStatusLabel(isArabic ? 'جارٍ الاتصال بالسحابة الآمنة...' : 'Connecting to secure cloud...');
    try {
      const backupRef = ref(rtdb, `users/${user.uid}/backup`);
      setBackupProgress(50);
      setBackupStatusLabel(isArabic ? 'جارٍ فحص النسخة السحابية المتوفرة...' : 'Checking available cloud backup...');
      const snapshot = await get(backupRef);
      if (snapshot.exists()) {
        setBackupProgress(80);
        setBackupStatusLabel(isArabic ? 'جارٍ استيراد وترقية البيانات...' : 'Restoring data...');
        const data = snapshot.val();
        const success = importFullData(data);
        if (success) {
          setBackupProgress(100);
          setBackupStatusLabel(isArabic ? 'تمت استعادة البيانات بنجاح!' : 'Data restored successfully!');
          showToast(isArabic ? 'تم استعادة النسخة السحابية بنجاح!' : 'Cloud backup restored successfully!', 'success');
        } else {
          setBackupProgress(null);
        }
      } else {
        setBackupProgress(null);
        showToast(isArabic ? 'لا توجد نسخة سحابية محفوظة لهذا الحساب' : 'No cloud backup found for this account', 'error');
      }
    } catch (err: any) {
      setBackupProgress(null);
      showToast(err?.message || 'Cloud restore failed', 'error');
    } finally {
      setTimeout(() => {
        setBackupProgress(null);
        setBackupStatusLabel('');
      }, 1500);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBackupProgress(25);
    setBackupStatusLabel(isArabic ? 'جارٍ قراءة ملف النسخة الاحتياطية...' : 'Reading backup file...');
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        setBackupProgress(65);
        setBackupStatusLabel(isArabic ? 'جارٍ التحقق من صحة البيانات...' : 'Validating backup schema...');
        const parsed = JSON.parse(event.target?.result as string);
        const ok = importFullData(parsed);
        if (ok) {
          setBackupProgress(100);
          setBackupStatusLabel(isArabic ? 'تمت الاستعادة بنجاح!' : 'Restored successfully!');
          showToast(isArabic ? 'تمت استعادة النسخة الاحتياطية بنجاح!' : 'Backup restored successfully!', 'success');
          setTimeout(() => {
            setIsSidebarOpen(false);
          }, 600);
        } else {
          setBackupProgress(null);
        }
      } catch (err) {
        setBackupProgress(null);
        console.error(err);
        showToast(t('invalidFileError'), 'error');
      } finally {
        setTimeout(() => {
          setBackupProgress(null);
          setBackupStatusLabel('');
        }, 1500);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Swipe in opposite direction to close sidebar (Item 2)
  const handleSidebarTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    sidebarTouchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleSidebarTouchMove = () => {};

  const handleSidebarTouchEnd = (e: React.TouchEvent) => {
    if (!sidebarTouchStartRef.current) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - sidebarTouchStartRef.current.x;
    const deltaY = touch.clientY - sidebarTouchStartRef.current.y;
    sidebarTouchStartRef.current = null;

    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;

    if (!isArabic && deltaX < -40) {
      handleAnimatedClose();
    } else if (isArabic && deltaX > 40) {
      handleAnimatedClose();
    }
  };

  const handleReloadApp = () => {
    setIsSidebarOpen(false);
    window.location.reload();
  };

  if (!isSidebarOpen) return null;

  return (
    <div
      onClick={() => handleAnimatedClose()}
      onTouchStart={handleSidebarTouchStart}
      onTouchMove={handleSidebarTouchMove}
      onTouchEnd={handleSidebarTouchEnd}
      className={`fixed inset-0 z-[60] flex bg-black/60 backdrop-blur-md overscroll-contain transition-all duration-200 ${
        isClosing ? 'modal-backdrop-closing' : 'modal-backdrop-anim'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleSidebarTouchStart}
        onTouchMove={handleSidebarTouchMove}
        onTouchEnd={handleSidebarTouchEnd}
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

        {/* User Profile Header: Entire Section is 100% Clickable Card (Item 10) */}
        <div
          onClick={() => {
            handleAnimatedClose(() => setIsUserProfileModalOpen(true));
          }}
          role="button"
          tabIndex={0}
          className="border-b border-zinc-800/80 bg-zinc-900/50 hover:bg-zinc-900/90 p-4 flex items-center justify-between shrink-0 cursor-pointer group active:scale-[0.99] transition select-none"
        >
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <div className="w-13 h-13 rounded-2xl bg-zinc-900 border-2 border-blue-500/80 overflow-hidden flex items-center justify-center text-3xl shadow-lg group-hover:scale-105 transition shrink-0">
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
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-white text-base group-hover:text-blue-400 transition truncate">
                  {settings.userProfile?.name || 'My Profile'}
                </h3>
                {auth.currentUser ? (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0 font-medium">
                    {isArabic ? 'سحابي' : 'Cloud'}
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 shrink-0 font-medium">
                    {isArabic ? 'ضيف' : 'Guest'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-zinc-400">
                <span className="font-mono text-[11px] text-zinc-400">
                  {format16DigitId(settings.userProfile?.numericId || '0000000000000000')}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const numId = settings.userProfile?.numericId || '0000000000000000';
                    navigator.clipboard.writeText(numId);
                    showToast(
                      isArabic
                        ? `تم نسخ معرّفك الرقمي (${format16DigitId(numId)}) للحافظة!`
                        : `16-Digit ID (${format16DigitId(numId)}) copied to clipboard!`,
                      'success'
                    );
                  }}
                  className="p-1 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
                  title="Copy 16-digit ID"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleAnimatedClose();
            }}
            className="p-2.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer shrink-0 ml-2 rtl:ml-0 rtl:mr-2"
            aria-label="Close Sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y p-4 space-y-6">
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

                {/* Biometric Hardware Status (Item 17) */}
                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px]">
                  <span className="text-zinc-400 flex items-center gap-1.5">
                    <span>{isArabic ? 'البصمة / Face ID:' : 'Biometrics:'}</span>
                  </span>
                  {!isBioSupported ? (
                    <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-medium border border-zinc-700">
                      {isArabic ? 'العتاد غير مدعوم على هذا الجهاز' : 'Hardware not supported on this device'}
                    </span>
                  ) : securitySettings.isBiometricEnabled ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                      {isArabic ? 'مفعل بنجاح' : 'Enabled & Active'}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-medium border border-zinc-700">
                      {isArabic ? 'معطل' : 'Disabled'}
                    </span>
                  )}
                </div>

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

          {/* Unified "Backup & Restore" Hub (Merged & Streamlined) */}
          <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-3.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>{isArabic ? 'النسخ الاحتياطي والاستعادة' : 'Backup & Restore'}</span>
              </h4>
              <span className="text-[10px] font-mono text-zinc-500">v1.1.10</span>
            </div>

            {/* Mandatory Visual Progress Bar (0% to 100%) */}
            {backupProgress !== null && (
              <div className="p-3 rounded-xl bg-zinc-950 border border-blue-500/40 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-200">{backupStatusLabel}</span>
                  <span className="font-mono font-bold text-blue-400">{backupProgress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-zinc-900 overflow-hidden border border-zinc-800">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-300"
                    style={{ width: `${backupProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* WhatsApp-Style Cloud Backup & Restore Box */}
            <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-zinc-300 flex items-center gap-1.5">
                  <Cloud className="w-3.5 h-3.5 text-purple-400" />
                  <span>{isArabic ? 'النسخ السحابي (WhatsApp Style)' : 'Cloud Backup (WhatsApp Style)'}</span>
                </span>
                <span className="text-[10px] text-zinc-400 font-mono truncate max-w-[130px]">
                  {auth.currentUser?.email || (isArabic ? 'غير مسجل' : 'Not signed in')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleCloudBackup}
                  className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 text-[11px] font-bold transition cursor-pointer active:scale-95"
                >
                  <Cloud className="w-3.5 h-3.5 text-purple-400" />
                  <span>{isArabic ? 'نسخ للسحابة الآن' : 'Backup to Cloud Now'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCloudRestore}
                  className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-[11px] font-bold transition cursor-pointer active:scale-95"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
                  <span>{isArabic ? 'استعادة من السحابة' : 'Restore from Cloud'}</span>
                </button>
              </div>
            </div>

            {/* Manual & File Backup Controls */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {/* Backup Now (Exports file & saves local snapshot) */}
                <button
                  type="button"
                  onClick={handleBackupNow}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shadow-lg shadow-emerald-950/40 transition cursor-pointer active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'نسخ احتياطي الآن' : 'Backup Now'}</span>
                </button>

                {/* Import / Restore Backup */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 text-zinc-200 text-[11px] font-bold transition cursor-pointer active:scale-95"
                >
                  <Upload className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{isArabic ? 'استيراد نسخة' : 'Import / Restore'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(true)}
                  className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 text-[10px] font-semibold transition cursor-pointer"
                >
                  <Download className="w-3 h-3 text-zinc-400" />
                  <span>{isArabic ? 'تخصيص التصدير' : 'Customize Export'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleEmailBackup}
                  className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 text-[10px] font-semibold transition cursor-pointer"
                >
                  <Mail className="w-3 h-3 text-blue-400" />
                  <span>{isArabic ? 'إرسال للإيميل' : 'Email Backup'}</span>
                </button>
              </div>
            </div>

            {/* Scheduled Auto Backup Sub-section */}
            <div className="pt-2 border-t border-zinc-800/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-400">
                  {isArabic ? 'الجدولة التلقائية الدورية' : 'Scheduled Auto-Backup'}
                </span>
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
                </div>
              </div>
            </div>
          </div>

          {/* Standalone PWA Installation Card (Outside Backup) */}
          <div className="space-y-2">
            <PWAInstallButton />

            {/* Complete Factory Reset & Clear All Data (Bug Fix: Delete PersonalFinanceTrackerDB + signOut + clear) */}
            <button
              type="button"
              onClick={async () => {
                const confirmed = await showConfirm({
                  title: isArabic ? 'تحذير شديد الأهمية - ضبط المصنع' : 'Factory Reset & Wipe All Data',
                  message: isArabic
                    ? 'تحذير شديد الأهمية: هل أنت متأكد من حذف جميع البيانات بالكامل وإعادة ضبط المصنع؟ سيتم تسجيل خروجك ومسح كافة الحسابات والمعاملات والنسخ المحلية وقاعدة البيانات نهائياً!'
                    : 'CRITICAL WARNING: Are you sure you want to completely erase all data and reset to factory defaults? You will be signed out and all accounts, transactions, and local databases will be wiped permanently!',
                  confirmText: isArabic ? 'مسح كافة البيانات' : 'Wipe All Data',
                  isDanger: true,
                });
                if (!confirmed) return;

                try {
                  // Prevent beforeunload or component unmount saves
                  if (typeof window !== 'undefined') {
                    window.sessionStorage.setItem('app_factory_reset_in_progress', 'true');
                  }

                  // 1. Explicitly sign out of Firebase Auth
                  try {
                    await signOut(auth);
                  } catch (e) {
                    console.warn('Sign out during reset:', e);
                  }

                  // 2. Wipe all localStorage and sessionStorage
                  try {
                    window.localStorage.clear();
                    window.sessionStorage.clear();
                  } catch (e) {
                    console.warn('Storage clear during reset:', e);
                  }

                  // 3. Delete IndexedDB database 'PersonalFinanceTrackerDB' (and legacy 'PersonalFinanceDB')
                  try {
                    if (typeof window !== 'undefined' && window.indexedDB) {
                      window.indexedDB.deleteDatabase('PersonalFinanceTrackerDB');
                      window.indexedDB.deleteDatabase('PersonalFinanceDB');
                    }
                  } catch (e) {
                    console.warn('IndexedDB delete during reset:', e);
                  }

                  showToast(
                    isArabic
                      ? 'تم مسح جميع البيانات وتسجيل الخروج بنجاح. جارٍ إعادة ضبط المصنع...'
                      : 'All data cleared and signed out successfully. Resetting app...',
                    'info'
                  );

                  setTimeout(() => {
                    window.location.href = window.location.origin + window.location.pathname;
                  }, 450);
                } catch (err: any) {
                  showToast(err?.message || 'Error clearing data', 'error');
                }
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-950/30 hover:bg-red-950/60 border border-red-900/60 text-xs font-bold text-red-400 hover:text-red-300 transition cursor-pointer active:scale-98"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
              <span>{isArabic ? 'مسح جميع البيانات وإعادة ضبط المصنع' : 'Clear All Data & Factory Reset'}</span>
            </button>
          </div>
        </div>

        {/* Sidebar Footer: Version & Refresh Button */}
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-950 flex items-center justify-between text-xs text-zinc-400 font-mono shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-zinc-300">Version: Beta v1.1.18</span>
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
