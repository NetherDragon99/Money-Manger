import React, { useState, useEffect } from 'react';
import { X, Fingerprint, Lock, Check, Delete, ArrowLeft, Shield } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  hashPin,
  loadSecuritySettings,
  saveSecuritySettings,
  isBiometricAvailable,
  registerBiometrics,
  setSessionUnlocked,
} from '../utils/security';

interface PinSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PinSetupModal: React.FC<PinSetupModalProps> = ({ isOpen, onClose }) => {
  const { settings, showToast } = useApp();
  const isArabic = settings.language === 'ar';

  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [enableBio, setEnableBio] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    isBiometricAvailable().then((avail) => setBioAvailable(avail));
  }, []);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setConfirmPin('');
      setStep('enter');
      setError('');
      setEnableBio(false);
      setIsSaving(false);
    }
  }, [isOpen]);

  const handleKeyPress = (num: string) => {
    setError('');
    if (step === 'enter') {
      if (pin.length < 4) {
        const next = pin + num;
        setPin(next);
        if (next.length === 4) {
          setTimeout(() => {
            setStep('confirm');
          }, 180);
        }
      }
    } else {
      if (confirmPin.length < 4) {
        setConfirmPin((prev) => prev + num);
      }
    }
  };

  const handleBackspace = () => {
    setError('');
    if (step === 'enter') {
      setPin((prev) => prev.slice(0, -1));
    } else {
      setConfirmPin((prev) => prev.slice(0, -1));
    }
  };

  const handleClear = () => {
    setError('');
    if (step === 'enter') {
      setPin('');
    } else {
      setConfirmPin('');
    }
  };

  const handleSavePin = async () => {
    if (pin.length !== 4) {
      setError(isArabic ? 'يجب أن يتكون رمز PIN من 4 أرقام' : 'PIN must be exactly 4 digits');
      return;
    }

    if (step === 'enter') {
      setStep('confirm');
      setError('');
      return;
    }

    if (pin !== confirmPin) {
      setError(isArabic ? 'الرمزان غير متطابقين، حاول مجدداً' : 'PINs do not match, please try again');
      setConfirmPin('');
      return;
    }

    setIsSaving(true);
    try {
      // 1. Hash PIN
      const hashed = await hashPin(pin);

      // 2. Try registering WebAuthn platform passkey if selected
      let biometricRegistered = false;
      if (enableBio && bioAvailable) {
        try {
          biometricRegistered = await registerBiometrics();
        } catch {
          biometricRegistered = false;
        }
      }

      // 3. Save security settings immediately
      const currentSec = loadSecuritySettings();
      const updated = {
        ...currentSec,
        isLockEnabled: true,
        pinHash: hashed,
        isBiometricEnabled: biometricRegistered || enableBio,
        requireLockOnResume: true,
      };

      saveSecuritySettings(updated);
      setSessionUnlocked(true);

      // 4. Instant UI Feedback
      showToast(
        isArabic
          ? biometricRegistered
            ? 'تم تفعيل قفل التطبيق والبصمة بنجاح!'
            : 'تم تفعيل رمز PIN وقفل التطبيق بنجاح!'
          : biometricRegistered
          ? 'App Lock, PIN & Biometric Passkey activated!'
          : 'App Lock & PIN activated successfully!',
        'success'
      );

      // 5. Close modal immediately without freezing
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save PIN');
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const currentDigits = step === 'enter' ? pin : confirmPin;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      style={{ overscrollBehavior: 'contain' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl bg-zinc-950/95 dark:bg-zinc-950/95 border border-zinc-800 shadow-2xl p-5 text-white overflow-hidden animate-in zoom-in-95 duration-200 select-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {isArabic ? 'إعداد رمز PIN وقفل التطبيق' : 'Set Up App Lock & PIN'}
              </h3>
              <p className="text-[11px] text-zinc-400">
                {step === 'enter'
                  ? isArabic
                    ? 'الخطوة 1 من 2: أدخل الرمز'
                    : 'Step 1 of 2: Enter PIN'
                  : isArabic
                  ? 'الخطوة 2 من 2: تأكيد الرمز'
                  : 'Step 2 of 2: Confirm PIN'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PIN Dots Indicator */}
        <div className="py-4 flex flex-col items-center space-y-3">
          <p className="text-xs text-center text-zinc-300">
            {step === 'enter'
              ? isArabic
                ? 'أنشئ رمز PIN مكوناً من 4 أرقام لحماية حسابك:'
                : 'Create a 4-digit PIN to secure your financial records:'
              : isArabic
              ? 'أعد إدخال نفس الرمز للتأكيد والحفظ:'
              : 'Re-enter your 4 digits to confirm and save:'}
          </p>

          <div className="flex items-center justify-center gap-4 py-2">
            {[0, 1, 2, 3].map((idx) => {
              const filled = idx < currentDigits.length;
              return (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full transition-all duration-200 ${
                    filled
                      ? 'bg-blue-500 scale-110 shadow-[0_0_10px_rgba(59,130,246,0.6)]'
                      : 'bg-zinc-800 border border-zinc-700'
                  }`}
                />
              );
            })}
          </div>

          {error && <p className="text-xs text-center text-red-400 font-semibold">{error}</p>}

          {/* Biometric Passkey Toggle */}
          {bioAvailable && step === 'enter' && (
            <label className="w-full flex items-center justify-between p-2.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 cursor-pointer hover:border-zinc-700 transition">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
                  <Fingerprint className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">
                    {isArabic ? 'تفعيل البصمة / Face ID' : 'Enable Biometrics / Face ID'}
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    {isArabic
                      ? 'فتح التطبيق بلمسة واحدة عبر WebAuthn'
                      : 'Unlock instantly via device passkey'}
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={enableBio}
                onChange={(e) => setEnableBio(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 bg-zinc-800 border-zinc-700 cursor-pointer"
              />
            </label>
          )}
        </div>

        {/* Clean Symmetrical Modern Numeric Keypad Grid */}
        <div className="grid grid-cols-3 gap-2 px-1 pb-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleKeyPress(digit)}
              className="h-12 rounded-2xl bg-zinc-900 hover:bg-zinc-800 active:scale-95 border border-zinc-800 text-lg font-bold font-mono text-white flex items-center justify-center transition cursor-pointer shadow-sm"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="h-12 rounded-2xl bg-zinc-900/60 hover:bg-zinc-800 active:scale-95 border border-zinc-800/70 text-xs font-semibold text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            {isArabic ? 'مسح' : 'Clear'}
          </button>
          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            className="h-12 rounded-2xl bg-zinc-900 hover:bg-zinc-800 active:scale-95 border border-zinc-800 text-lg font-bold font-mono text-white flex items-center justify-center transition cursor-pointer shadow-sm"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            aria-label="Backspace"
            className="h-12 rounded-2xl bg-zinc-900/60 hover:bg-zinc-800 active:scale-95 border border-zinc-800/70 text-zinc-300 hover:text-red-400 flex items-center justify-center transition cursor-pointer"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Actions Row */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800/80">
          {step === 'confirm' ? (
            <button
              type="button"
              onClick={() => {
                setStep('enter');
                setConfirmPin('');
                setError('');
              }}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 transition cursor-pointer active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
              <span>{isArabic ? 'رجوع' : 'Back'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-400 hover:text-white transition cursor-pointer active:scale-95"
            >
              {isArabic ? 'إلغاء' : 'Cancel'}
            </button>
          )}

          <button
            type="button"
            onClick={handleSavePin}
            disabled={isSaving || (step === 'enter' ? pin.length !== 4 : confirmPin.length !== 4)}
            className="py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-xs font-bold text-white transition cursor-pointer shadow-lg shadow-blue-600/30 flex items-center justify-center gap-1.5 active:scale-95"
          >
            {isSaving ? (
              <span>{isArabic ? 'جارٍ الحفظ...' : 'Saving...'}</span>
            ) : step === 'enter' ? (
              <span>{isArabic ? 'التالي' : 'Next'}</span>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>{isArabic ? 'تأكيد وحفظ' : 'Confirm & Save'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
