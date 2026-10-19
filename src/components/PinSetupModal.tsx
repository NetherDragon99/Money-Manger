/**
 * Pin Setup & Security Settings Modal
 * Allows setting or changing 4-digit PIN and enabling biometric authentication
 */

import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Fingerprint, Lock, Check } from 'lucide-react';
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
  const [isClosing, setIsClosing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    isBiometricAvailable().then((avail) => setBioAvailable(avail));
  }, []);

  const handleAnimatedClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      setPin('');
      setConfirmPin('');
      setStep('enter');
      setError('');
      onClose();
    }, 180);
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
      setError(isArabic ? 'الرمزان غير متطابقين' : 'PINs do not match');
      setConfirmPin('');
      return;
    }

    // Hash PIN
    const hashed = await hashPin(pin);

    // If user selected biometric, try registering
    let biometricOk = false;
    if (enableBio && bioAvailable) {
      biometricOk = await registerBiometrics();
    }

    const currentSec = loadSecuritySettings();
    saveSecuritySettings({
      ...currentSec,
      isLockEnabled: true,
      pinHash: hashed,
      isBiometricEnabled: biometricOk || enableBio,
      requireLockOnResume: true,
    });

    setSessionUnlocked(true);
    showToast(
      isArabic
        ? 'تم تفعيل قفل التطبيق ورمز PIN بنجاح!'
        : 'App Lock & PIN activated successfully!',
      'success'
    );
    handleAnimatedClose();
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={handleAnimatedClose}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-all duration-200 ${
        isClosing ? 'modal-backdrop-closing' : 'modal-backdrop-anim'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm rounded-3xl bg-zinc-950/95 backdrop-blur-2xl border border-zinc-800/80 shadow-2xl p-5 text-white overflow-hidden transition-all duration-200 ${
          isClosing ? 'modal-container-closing' : 'modal-container-anim'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">
              {isArabic ? 'إعداد رمز PIN وقفل التطبيق' : 'Set Up App Lock & PIN'}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleAnimatedClose}
            className="p-1 rounded-full text-zinc-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="py-4 space-y-4">
          <p className="text-xs text-zinc-400">
            {step === 'enter'
              ? isArabic
                ? 'أدخل رمز PIN جديداً مكوناً من 4 أرقام لحماية بياناتك المالية:'
                : 'Enter a 4-digit PIN to secure your personal financial data:'
              : isArabic
              ? 'أعد إدخال رمز PIN للتأكيد:'
              : 'Re-enter your 4-digit PIN to confirm:'}
          </p>

          {/* PIN Input */}
          <div className="flex justify-center">
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={step === 'enter' ? pin : confirmPin}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
                if (step === 'enter') setPin(val);
                else setConfirmPin(val);
                setError('');
              }}
              placeholder="••••"
              className="w-36 text-center tracking-[1em] text-2xl font-mono py-2.5 rounded-2xl bg-zinc-900 border border-zinc-700 text-white outline-none focus:border-blue-500 shadow-inner"
              autoFocus
            />
          </div>

          {error && <p className="text-xs text-center text-red-400 font-semibold">{error}</p>}

          {/* Biometric Toggle */}
          {bioAvailable && step === 'enter' && (
            <label className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800 cursor-pointer">
              <div className="flex items-center gap-2.5">
                <Fingerprint className="w-5 h-5 text-blue-400" />
                <div>
                  <div className="text-xs font-bold text-white">
                    {isArabic ? 'تفعيل البصمة / Face ID' : 'Enable Biometrics / Face ID'}
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    {isArabic
                      ? 'فتح التطبيق بلمسة واحدة دون كتابة الرمز'
                      : 'Unlock instantly using fingerprint or face'}
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={enableBio}
                onChange={(e) => setEnableBio(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 bg-zinc-800 border-zinc-700"
              />
            </label>
          )}

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              type="button"
              onClick={handleAnimatedClose}
              className="py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-400 hover:text-white transition cursor-pointer"
            >
              {isArabic ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleSavePin}
              disabled={(step === 'enter' ? pin.length : confirmPin.length) !== 4}
              className="py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-xs font-bold text-white transition cursor-pointer shadow-lg shadow-blue-600/30"
            >
              {step === 'enter'
                ? isArabic
                  ? 'التالي'
                  : 'Next'
                : isArabic
                ? 'تأكيد وحفظ'
                : 'Confirm & Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
