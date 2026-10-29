/**
 * App Lock Screen
 * Full-screen biometric and 4-digit PIN authentication overlay
 * With instant dot feedback (<100ms), WebCrypto PBKDF2 verification & transparent migration,
 * in-memory grace period integration, and rate limiting after 5 failed attempts.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Shield, Fingerprint, Delete } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  verifyPin,
  hashPinPBKDF2,
  loadSecuritySettings,
  saveSecuritySettings,
  authenticateWithBiometrics,
  recordSuccessfulUnlock,
  isAppLockActive,
} from '../utils/security';

interface AppLockScreenProps {
  isLocked: boolean;
  onUnlocked: () => void;
}

export const AppLockScreen: React.FC<AppLockScreenProps> = ({ isLocked, onUnlocked }) => {
  const { settings } = useApp();
  const isArabic = settings.language === 'ar';

  const [pin, setPin] = useState('');
  const [errorShake, setErrorShake] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const isVerifyingRef = useRef(false);

  const security = loadSecuritySettings();

  // Cooldown countdown timer when locked out after 5 failures
  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const timer = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setErrorMessage('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutRemaining]);

  // Keep hidden input focused for hardware / soft keyboard input
  useEffect(() => {
    if (isLocked) {
      inputRef.current?.focus();
    }
  }, [isLocked]);

  const handleBiometricAuth = useCallback(async () => {
    if (!security.isBiometricEnabled || lockoutRemaining > 0) return;
    const ok = await authenticateWithBiometrics();
    if (ok) {
      recordSuccessfulUnlock();
      setPin('');
      setErrorMessage('');
      setFailedAttempts(0);
      onUnlocked();
    }
  }, [security.isBiometricEnabled, lockoutRemaining, onUnlocked]);

  // Try biometric authentication on lock screen mount
  useEffect(() => {
    if (isLocked && security.isLockEnabled && security.isBiometricEnabled && lockoutRemaining === 0) {
      handleBiometricAuth();
    }
  }, [isLocked, security.isLockEnabled, security.isBiometricEnabled, lockoutRemaining, handleBiometricAuth]);

  // Verify PIN once exactly 4 digits are entered
  useEffect(() => {
    if (pin.length === 4 && !isVerifyingRef.current && lockoutRemaining === 0) {
      isVerifyingRef.current = true;
      const verify = async () => {
        try {
          const ok = await verifyPin(pin, security.pinHash);
          if (ok) {
            // Transparently migrate plain-text or older SHA-256 to PBKDF2
            if (security.pinHash && !security.pinHash.startsWith('pbkdf2:')) {
              try {
                const newPbkdf2 = await hashPinPBKDF2(pin);
                saveSecuritySettings({ ...security, pinHash: newPbkdf2 });
              } catch (migrationErr) {
                console.warn('Transparent PBKDF2 migration skipped:', migrationErr);
              }
            }
            recordSuccessfulUnlock();
            setPin('');
            setErrorMessage('');
            setFailedAttempts(0);
            onUnlocked();
          } else {
            const nextFailed = failedAttempts + 1;
            setFailedAttempts(nextFailed);
            setErrorShake(true);

            if (nextFailed >= 5) {
              const cooldown = Math.min(60, (nextFailed - 4) * 5);
              setLockoutRemaining(cooldown);
              setErrorMessage(
                isArabic
                  ? `محاولات غير صحيحة متكررة. انتظر ${cooldown} ثانية.`
                  : `Too many failed attempts. Try again in ${cooldown}s.`
              );
            } else {
              setErrorMessage(
                isArabic
                  ? `رمز PIN غير صحيح (${nextFailed}/5). حاول مجدداً.`
                  : `Incorrect PIN (${nextFailed}/5). Please try again.`
              );
            }

            // Rapid 100ms reset without artificial delays
            setTimeout(() => {
              setPin('');
              setErrorShake(false);
              isVerifyingRef.current = false;
            }, 100);
            return;
          }
        } catch (err) {
          console.error('PIN verification error:', err);
        } finally {
          isVerifyingRef.current = false;
        }
      };
      verify();
    }
  }, [pin, security, isArabic, onUnlocked, failedAttempts, lockoutRemaining]);

  // Hardware keyboard support
  useEffect(() => {
    if (!isLocked) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (lockoutRemaining > 0) return;
      if (/^[0-9]$/.test(e.key) && pin.length < 4) {
        setPin((prev) => prev + e.key);
      } else if (e.key === 'Backspace') {
        setPin((prev) => prev.slice(0, -1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLocked, pin.length, lockoutRemaining]);

  if (!isLocked || !isAppLockActive()) return null;

  const handleKeyPress = (digit: string) => {
    if (lockoutRemaining > 0) return;
    if (pin.length < 4) {
      setPin((prev) => prev + digit);
    }
  };

  const handleDelete = () => {
    if (lockoutRemaining > 0) return;
    setPin((prev) => prev.slice(0, -1));
  };

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-between p-4 sm:p-6 landscape:py-3 bg-black text-white selection:bg-blue-600 overflow-y-auto overscroll-contain select-none"
      style={{ overscrollBehavior: 'contain' }}
    >
      {/* Hidden input for software/hardware keyboard accessibility */}
      <input
        ref={inputRef}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
        pattern="[0-9]*"
        maxLength={4}
        value={pin}
        onChange={(e) => {
          if (lockoutRemaining > 0) return;
          const clean = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
          setPin(clean);
        }}
        className="opacity-0 absolute -z-10 w-0 h-0 pointer-events-none"
        aria-label={isArabic ? 'رمز المرور' : 'Passcode'}
      />

      {/* Top Header */}
      <div className="pt-4 sm:pt-10 landscape:pt-2 flex flex-col items-center text-center">
        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-2xl flex items-center justify-center text-blue-400 mb-2 sm:mb-4 animate-in fade-in zoom-in duration-200">
          <Shield className="w-6 h-6 sm:w-8 sm:h-8" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-white">
          {isArabic ? 'التطبيق مقفل' : 'Personal Finance'}
        </h2>
        <p className="text-xs text-zinc-400 mt-1">
          {lockoutRemaining > 0
            ? isArabic
              ? `تم تعليق الإدخال مؤقتاً (${lockoutRemaining} ثانية)`
              : `Temporarily locked (${lockoutRemaining}s)`
            : isArabic
            ? 'أدخل رمز PIN أو استخدم البصمة لفتح التطبيق'
            : 'Enter 4-digit PIN or use Biometrics'}
        </p>
      </div>

      {/* PIN Dots Indicator with rapid <=100ms transition */}
      <div className="flex flex-col items-center">
        <div className={`flex items-center gap-4 my-4 ${errorShake ? 'animate-shake' : ''}`}>
          {[0, 1, 2, 3].map((idx) => {
            const isFilled = pin.length > idx;
            return (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all duration-75 ${
                  isFilled
                    ? 'bg-blue-500 scale-110 shadow-lg shadow-blue-500/50'
                    : 'bg-zinc-800 border border-zinc-700'
                }`}
              />
            );
          })}
        </div>

        {errorMessage ? (
          <p className="text-xs text-red-400 font-semibold h-4 mt-2 transition-opacity duration-75">
            {errorMessage}
          </p>
        ) : (
          <div className="h-4 mt-2" />
        )}
      </div>

      {/* On-Screen Keypad */}
      <div className="w-full max-w-xs pb-6">
        <div className="grid grid-cols-3 gap-3.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              type="button"
              disabled={lockoutRemaining > 0}
              onClick={(e) => {
                e.stopPropagation();
                handleKeyPress(num);
              }}
              className="h-16 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800/80 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-xl font-semibold text-white transition-transform duration-75 flex items-center justify-center cursor-pointer shadow-md"
            >
              {num}
            </button>
          ))}

          {/* Biometric Trigger or Blank */}
          {security.isBiometricEnabled ? (
            <button
              type="button"
              disabled={lockoutRemaining > 0}
              onClick={(e) => {
                e.stopPropagation();
                handleBiometricAuth();
              }}
              className="h-16 rounded-2xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-blue-400 transition-transform duration-75 flex items-center justify-center cursor-pointer"
              title={isArabic ? 'استخدام البصمة' : 'Use Biometrics'}
            >
              <Fingerprint className="w-7 h-7" />
            </button>
          ) : (
            <div />
          )}

          {/* Zero Button */}
          <button
            type="button"
            disabled={lockoutRemaining > 0}
            onClick={(e) => {
              e.stopPropagation();
              handleKeyPress('0');
            }}
            className="h-16 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800/80 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-xl font-semibold text-white transition-transform duration-75 flex items-center justify-center cursor-pointer shadow-md"
          >
            0
          </button>

          {/* Backspace Button */}
          <button
            type="button"
            disabled={lockoutRemaining > 0}
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            className="h-16 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800/80 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-zinc-400 hover:text-white transition-transform duration-75 flex items-center justify-center cursor-pointer shadow-md"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
