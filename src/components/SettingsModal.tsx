import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  Sliders,
  Calendar,
  Coins,
  Globe,
  Moon,
  Sun,
  Shield,
  KeyRound,
  Clock,
  Lock,
  Search,
  Check,
  ChevronRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { WeekStartDay } from '../types';
import { WORLD_CURRENCIES, CurrencyOption } from '../utils/currencies';
import {
  loadSecuritySettings,
  saveSecuritySettings,
  isBiometricAvailable,
  isAppLockEnabledLocally,
  setAppLockEnabledLocally,
  getAppLockGracePeriod,
  setAppLockGracePeriod,
} from '../utils/security';
import { PasscodeVerificationModal } from './PasscodeVerificationModal';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    settings,
    updateSettings,
    setIsPinModalOpen,
    setIsTransferFeesModalOpen,
    lockApp,
    showToast,
    t,
  } = useApp();

  const isArabic = settings.language === 'ar';

  const currencyMenuRef = useRef<HTMLDivElement | null>(null);
  const [currencySearch, setCurrencySearch] = useState('');
  const [currencyDropdownOpen, setCurrencyDropdownOpen] = useState(false);

  // Security & App Lock State
  const [securitySettings, setSecuritySettings] = useState(() => loadSecuritySettings());
  const [localLockEnabled, setLocalLockEnabled] = useState(() => isAppLockEnabledLocally());
  const [gracePeriod, setGracePeriod] = useState(() => getAppLockGracePeriod());
  const [isBioSupported, setIsBioSupported] = useState<boolean>(true);
  const [passcodeModal, setPasscodeModal] = useState<{
    isOpen: boolean;
    mode: 'disable_lock' | 'change_grace';
    targetGrace?: number;
  }>({ isOpen: false, mode: 'disable_lock' });

  useEffect(() => {
    isBiometricAvailable().then(setIsBioSupported).catch(() => setIsBioSupported(false));
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSecuritySettings(loadSecuritySettings());
      setLocalLockEnabled(isAppLockEnabledLocally());
      setGracePeriod(getAppLockGracePeriod());
    }
  }, [isOpen]);

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
      WORLD_CURRENCIES[2]
    );
  }, [settings.currencySymbol]);

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

  const isAppLockOn = Boolean(
    securitySettings.isLockEnabled && localLockEnabled && securitySettings.pinHash
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md transition-opacity duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[92vh] flex flex-col bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden text-zinc-100 min-w-0"
        onClick={(e) => e.stopPropagation()}
        dir={isArabic ? 'rtl' : 'ltr'}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800/80 flex items-center justify-between shrink-0 bg-zinc-900/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-blue-950/40">
              <Sliders className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-white truncate">
                {t('settingsModalTitle')}
              </h3>
              <p className="text-xs text-zinc-400 truncate mt-0.5">
                {t('settingsModalDesc')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 min-w-0">
          {/* Section 1: Primary Currency */}
          <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>{isArabic ? 'العملة الأساسية' : 'Primary Currency'}</span>
            </label>
            <div ref={currencyMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setCurrencyDropdownOpen(!currencyDropdownOpen)}
                className="w-full min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-semibold text-white hover:border-zinc-700 transition cursor-pointer"
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
                      className="w-full pl-8 pr-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 outline-none focus:border-blue-500"
                    />
                  </div>
                  {filteredCurrencies.map((c) => {
                    const isCurSelected = c.symbol === settings.currencySymbol;
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => handleSelectCurrency(c)}
                        className={`w-full min-h-[40px] flex items-center justify-between px-2.5 py-2 rounded-xl text-left text-xs transition cursor-pointer ${
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

          {/* Section 2: Cycle & Date Preferences */}
          <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span>{isArabic ? 'إعدادات دورة الحسابات' : 'Cycle & Calendar Preferences'}</span>
            </h4>

            {/* Week Start Day */}
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">{t('weekStartDay')}</label>
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-zinc-950 border border-zinc-800">
                {(['saturday', 'sunday', 'monday'] as WeekStartDay[]).map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => updateSettings({ weekStartDay: day })}
                    className={`min-h-[40px] py-1.5 text-xs font-semibold rounded-lg capitalize transition cursor-pointer ${
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
              <label className="block text-xs text-zinc-400 mb-1.5">{t('defaultMonthStartDay')}</label>
              <select
                value={settings.defaultMonthStartDay}
                onChange={(e) =>
                  updateSettings({ defaultMonthStartDay: parseInt(e.target.value, 10) })
                }
                className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white outline-none cursor-pointer focus:border-blue-500"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {isArabic ? `اليوم ${d} من الشهر` : `Day ${d} of month`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 3: Appearance & Language */}
          <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isArabic ? 'اللغة والمظهر' : 'Language & Appearance'}</span>
            </h4>

            {/* Language Toggle */}
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">{t('language')}</label>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-zinc-950 border border-zinc-800">
                <button
                  type="button"
                  onClick={() => updateSettings({ language: 'en' })}
                  className={`min-h-[40px] py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
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
                  className={`min-h-[40px] py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                    settings.language === 'ar'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  العربية (RTL)
                </button>
              </div>
            </div>

            {/* Theme Mode Toggle */}
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">{t('theme')}</label>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-zinc-950 border border-zinc-800">
                <button
                  type="button"
                  onClick={() => updateSettings({ themeMode: 'dark' })}
                  className={`min-h-[40px] flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                    settings.themeMode === 'dark'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{t('darkMode')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => updateSettings({ themeMode: 'light' })}
                  className={`min-h-[40px] flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                    settings.themeMode === 'light'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t('lightMode')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 4: Transfer Fees & Taxes Shortcut */}
          <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Coins className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-white truncate">
                  {t('openTransferFeesModal')}
                </h4>
                <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                  {t('transferFeesModalDesc')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                setIsTransferFeesModalOpen(true);
              }}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-amber-300 text-xs font-bold border border-amber-500/30 transition cursor-pointer flex items-center gap-1 shrink-0 active:scale-95"
            >
              <span>{isArabic ? 'فتح' : 'Open'}</span>
              <ChevronRight className={`w-3.5 h-3.5 ${isArabic ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Section 5: App Security & Biometric Lock */}
          <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-blue-400" />
                <span>{t('securityLock')}</span>
              </h4>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAppLockOn}
                  onChange={(e) => {
                    if (e.target.checked) {
                      if (!securitySettings.pinHash) {
                        setIsPinModalOpen(true);
                      } else {
                        setAppLockEnabledLocally(true);
                        setLocalLockEnabled(true);
                        const updated = { ...securitySettings, isLockEnabled: true };
                        saveSecuritySettings(updated);
                        setSecuritySettings(updated);
                        showToast(t('appLockEnabledSuccess'), 'success');
                      }
                    } else {
                      setPasscodeModal({
                        isOpen: true,
                        mode: 'disable_lock',
                      });
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
              </label>
            </div>

            {isAppLockOn && (
              <div className="space-y-3 pt-1 text-xs">
                <button
                  type="button"
                  onClick={() => setIsPinModalOpen(true)}
                  className="w-full min-h-[44px] py-2.5 px-3.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-300 flex items-center justify-between transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-amber-400" />
                    <span>{isArabic ? 'تغيير رمز PIN' : 'Change 4-Digit PIN'}</span>
                  </span>
                  <span className="text-[11px] text-blue-400 font-bold">{isArabic ? 'تعديل' : 'Edit'}</span>
                </button>

                {/* Grace Period Selection */}
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-400" />
                      <span>{t('gracePeriod')}</span>
                    </span>
                    <span className="text-[11px] text-zinc-400 font-mono">
                      {gracePeriod === 0
                        ? t('graceImmediately')
                        : gracePeriod === 1
                        ? t('grace1Min')
                        : gracePeriod === 5
                        ? t('grace5Min')
                        : t('grace15Min')}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                    {[
                      { value: 0, label: t('graceImmediately') },
                      { value: 1, label: '1m' },
                      { value: 5, label: '5m' },
                      { value: 15, label: '15m' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          if (gracePeriod === opt.value) return;
                          setPasscodeModal({
                            isOpen: true,
                            mode: 'change_grace',
                            targetGrace: opt.value,
                          });
                        }}
                        className={`min-h-[38px] py-1 px-1 rounded-lg text-[11px] font-semibold transition cursor-pointer border text-center ${
                          gracePeriod === opt.value
                            ? 'bg-blue-600/30 border-blue-500 text-blue-300 shadow-sm'
                            : 'bg-zinc-900 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    {t('gracePeriodDesc')}
                  </p>
                </div>

                {/* Biometric Hardware Status */}
                <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs">
                  <span className="text-zinc-400 flex items-center gap-1.5">
                    <span>{isArabic ? 'البصمة / Face ID:' : 'Biometrics:'}</span>
                  </span>
                  {!isBioSupported ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-medium border border-zinc-700">
                      {isArabic ? 'العتاد غير مدعوم على هذا الجهاز' : 'Hardware not supported'}
                    </span>
                  ) : securitySettings.isBiometricEnabled ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                      {isArabic ? 'مفعل بنجاح' : 'Enabled & Active'}
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-medium border border-zinc-700">
                      {isArabic ? 'معطل' : 'Disabled'}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    lockApp();
                  }}
                  className="w-full min-h-[44px] py-2.5 px-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-400 font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  <span>{isArabic ? 'قفل التطبيق الآن' : 'Lock Application Now'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-bold text-xs transition cursor-pointer shadow-lg shadow-blue-950/30 flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>{isArabic ? 'حفظ وإغلاق' : 'Done'}</span>
          </button>
        </div>
      </div>

      {/* Passcode Verification Modal for Disabling Lock or Changing Grace Period */}
      <PasscodeVerificationModal
        isOpen={passcodeModal.isOpen}
        title={
          passcodeModal.mode === 'disable_lock'
            ? t('confirmPinToDisable')
            : t('confirmPinToChangeGrace')
        }
        description={
          passcodeModal.mode === 'disable_lock'
            ? t('confirmPinToDisable')
            : t('confirmPinToChangeGrace')
        }
        onSuccess={() => {
          if (passcodeModal.mode === 'disable_lock') {
            setAppLockEnabledLocally(false);
            setLocalLockEnabled(false);
            const updated = { ...securitySettings, isLockEnabled: false };
            saveSecuritySettings(updated);
            setSecuritySettings(updated);
            setPasscodeModal({ isOpen: false, mode: 'disable_lock' });
            showToast(t('appLockDisabled'), 'info');
          } else if (passcodeModal.mode === 'change_grace' && passcodeModal.targetGrace !== undefined) {
            const newGrace = passcodeModal.targetGrace;
            setAppLockGracePeriod(newGrace);
            setGracePeriod(newGrace);
            setPasscodeModal({ isOpen: false, mode: 'disable_lock' });
            showToast(t('gracePeriodUpdated'), 'success');
          }
        }}
        onCancel={() => {
          setPasscodeModal({ isOpen: false, mode: 'disable_lock' });
        }}
      />
    </div>
  );
};
