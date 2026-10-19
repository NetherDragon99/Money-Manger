import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Download, CheckSquare, Square, X, ShieldCheck, Check } from 'lucide-react';
import { AppData } from '../types';

interface ExportCustomizeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ExportOptions {
  profile: boolean;
  settings: boolean;
  accounts: boolean;
  categories: boolean;
  recurringRules: boolean;
  transactions: boolean;
}

const STORAGE_KEY = 'pwa_finance_export_preferences';

export const ExportCustomizeModal: React.FC<ExportCustomizeModalProps> = ({ isOpen, onClose }) => {
  const { accounts, categories, transactions, settings, recurringTransactions, showToast, t } = useApp();
  const isArabic = settings.language === 'ar';

  const [options, setOptions] = useState<ExportOptions>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return {
          recurringRules: true,
          ...JSON.parse(saved),
        };
      }
    } catch {}
    return {
      profile: true,
      settings: true,
      accounts: true,
      categories: true,
      recurringRules: true,
      transactions: true,
    };
  });

  // Save preferences to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
    } catch {}
  }, [options]);

  const [isClosing, setIsClosing] = useState(false);

  const handleAnimatedClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 180);
  };

  if (!isOpen) return null;

  const isAllSelected =
    options.profile &&
    options.settings &&
    options.accounts &&
    options.categories &&
    options.recurringRules &&
    options.transactions;

  const handleToggleAll = () => {
    const nextVal = !isAllSelected;
    setOptions({
      profile: nextVal,
      settings: nextVal,
      accounts: nextVal,
      categories: nextVal,
      recurringRules: nextVal,
      transactions: nextVal,
    });
  };

  const handleToggleOption = (key: keyof ExportOptions) => {
    setOptions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleExecuteExport = () => {
    const exportData: Partial<AppData> & {
      version: string;
      exportDate: string;
      appName: string;
    } = {
      version: '1.1.3',
      exportDate: new Date().toISOString(),
      appName: 'Personal Finance PWA',
    };

    if (options.accounts) {
      exportData.accounts = accounts;
    }
    if (options.categories) {
      exportData.categories = categories;
    }
    if (options.recurringRules && recurringTransactions) {
      exportData.recurringTransactions = recurringTransactions;
    }
    if (options.transactions) {
      exportData.transactions = transactions;
    }
    if (options.settings) {
      exportData.settings = settings;
    }
    if (options.profile && settings.userProfile) {
      if (!exportData.settings) {
        exportData.settings = { ...settings };
      }
      exportData.settings.userProfile = settings.userProfile;
    }

    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance_tracker_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(
      isArabic ? 'تم تصدير البيانات المحددة بنجاح!' : 'Selected data exported successfully!',
      'success'
    );
    onClose();
  };

  const items: Array<{ key: keyof ExportOptions; labelEn: string; labelAr: string; descEn: string; descAr: string }> = [
    {
      key: 'profile',
      labelEn: 'Profile & Avatar Data',
      labelAr: 'بيانات الملف الشخصي والصورة الرمزية',
      descEn: 'Username, avatar emoji, and custom cropped photo',
      descAr: 'اسم المستخدم والصورة الرمزية أو الشخصية المعدلة',
    },
    {
      key: 'settings',
      labelEn: 'App Settings, Currency & Preferences',
      labelAr: 'إعدادات التطبيق، العملة والتفضيلات',
      descEn: 'Currency symbol, language, theme, and billing month start day',
      descAr: 'رمز العملة، اللغة، المظهر، وبداية شهر التطبيق المالي',
    },
    {
      key: 'accounts',
      labelEn: 'Accounts & Balances',
      labelAr: 'الحسابات المالية والأرصدة',
      descEn: 'Bank, cash, savings, and wallets with current balances',
      descAr: 'حسابات البنك، النقدية، المحافظ والمدخرات مع الأرصدة',
    },
    {
      key: 'categories',
      labelEn: 'Categories, Custom Order & Budgets',
      labelAr: 'الفئات، الترتيب المخصص والميزانيات',
      descEn: 'Expense & income categories, monthly limits, and sequence',
      descAr: 'فئات المصروفات والإيرادات، الحدود الشهرية والترتيب المخصص',
    },
    {
      key: 'recurringRules',
      labelEn: 'Recurring Rules & Schedules',
      labelAr: 'قواعد المعاملات المتكررة المجدولة',
      descEn: 'Daily, weekly, bi-weekly, monthly, and yearly recurring schedules',
      descAr: 'جداول تكرار المعاملات الدورية التلقائية والتردد',
    },
    {
      key: 'transactions',
      labelEn: 'Transactions & Audit History',
      labelAr: 'المعاملات وسجل التدقيق التاريخي',
      descEn: 'Complete ledger of income, expense, and transfers with balances',
      descAr: 'كافة المعاملات المسجلة مع الأرصدة التراكمية السابقة واللاحقة',
    },
  ];

  const hasAtLeastOne = Object.values(options).some(Boolean);

  return (
    <div
      onClick={handleAnimatedClose}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-all duration-200 ${
        isClosing ? 'modal-backdrop-closing' : 'modal-backdrop-anim'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md max-h-[90vh] flex flex-col rounded-3xl bg-zinc-950/95 backdrop-blur-2xl border border-zinc-800/80 shadow-2xl text-white overflow-hidden transition-all duration-200 ${
          isClosing ? 'modal-container-closing' : 'modal-container-anim'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isArabic ? 'تخصيص تصدير البيانات' : 'Customize Export Data'}
              </h3>
              <p className="text-[11px] text-zinc-400">
                {isArabic ? 'تصدير نسخة مطابقة 100% لاستعادتها بأي جهاز' : '100% identical clone for any device'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAnimatedClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Select All Toggle */}
          <button
            type="button"
            onClick={handleToggleAll}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 transition cursor-pointer"
          >
            <span className="text-xs font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{isArabic ? 'تحديد الكل (نسخة احتياطية شاملة)' : 'Select All (Full State Clone)'}</span>
            </span>
            <div className={`w-5 h-5 rounded-md flex items-center justify-center transition ${
              isAllSelected ? 'bg-emerald-600 text-white' : 'border border-zinc-600'
            }`}>
              {isAllSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>
          </button>

          {/* Granular Checkboxes */}
          <div className="space-y-2.5">
            {items.map((item) => {
              const isChecked = options[item.key];
              return (
                <div
                  key={item.key}
                  onClick={() => handleToggleOption(item.key)}
                  className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                    isChecked
                      ? 'bg-zinc-900/90 border-blue-500/40 text-white'
                      : 'bg-zinc-950 border-zinc-800/80 text-zinc-400 hover:bg-zinc-900/50'
                  }`}
                >
                  <div className="pr-3">
                    <div className="text-xs font-bold text-white">
                      {isArabic ? item.labelAr : item.labelEn}
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">
                      {isArabic ? item.descAr : item.descEn}
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition ${
                    isChecked ? 'bg-blue-600 text-white' : 'border border-zinc-600'
                  }`}>
                    {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-zinc-500 leading-relaxed px-1">
            {isArabic
              ? 'تلميح: يتم حفظ خياراتك المفضلة تلقائياً لتتذكرها المرة القادمة.'
              : 'Persistence Note: Your selection preferences are saved automatically.'}
          </p>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-950 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-300 font-semibold text-xs transition cursor-pointer"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            disabled={!hasAtLeastOne}
            onClick={handleExecuteExport}
            className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs transition shadow-lg shadow-emerald-900/40 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            <span>{isArabic ? 'تصدير JSON' : 'Export JSON'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
