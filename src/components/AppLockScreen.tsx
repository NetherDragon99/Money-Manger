/**
 * App Lock Screen
 * Full-screen biometric and 4-digit PIN authentication overlay
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Fingerprint, Delete } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  hashPin,
  loadSecuritySettings,
  authenticateWithBiometrics,
  setSessionUnlocked,
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

  const security = loadSecuritySettings();

  const handleBiometricAuth = useCallback(async () => {
    if (!security.isBiometricEnabled) return;
    const ok = await authenticateWithBiometrics();
    if (ok) {
      setSessionUnlocked(true);
      onUnlocked();
    }
  }, [security.isBiometricEnabled, onUnlocked]);

  // Try biometric authentication on lock screen mount
  useEffect(() => {
    if (isLocked && security.isLockEnabled && security.isBiometricEnabled) {
      handleBiometricAuth();
    }
  }, [isLocked, security.isLockEnabled, security.isBiometricEnabled, handleBiometricAuth]);

  // Check PIN when 4 digits entered
  useEffect(() => {
    if (pin.length === 4) {
      const verify = async () => {
        const hash = await hashPin(pin);
        if (hash === security.pinHash) {
          setSessionUnlocked(true);
          setPin('');
          setErrorMessage('');
          onUnlocked();
        } else {
          setErrorShake(true);
          setErrorMessage(
            isArabic ? 'رمز PIN غير صحيح. حاول مجدداً.' : 'Incorrect PIN. Please try again.'
          );
          setTimeout(() => {
            setPin('');
            setErrorShake(false);
          }, 450);
        }
      };
      verify();
    }
  }, [pin, security.pinHash, isArabic, onUnlocked]);

  // Physical keyboard support
  useEffect(() => {
    if (!isLocked) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key) && pin.length < 4) {
        setPin((prev) => prev + e.key);
      } else if (e.key === 'Backspace') {
        setPin((prev) => prev.slice(0, -1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLocked, pin.length]);

  if (!isLocked || !security.isLockEnabled) return null;

  const handleKeyPress = (digit: string) => {
    if (pin.length < 4) {
      setPin((prev) => prev + digit);
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  if (!isLocked) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-between p-6 bg-black text-white selection:bg-blue-600"
      style={{ overscrollBehavior: 'contain' }}
    >
      {/* Top Header */}
      <div className="pt-10 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-2xl flex items-center justify-center text-blue-400 mb-4 animate-in fade-in zoom-in duration-300">
          <Shield className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-white">
          {isArabic ? 'التطبيق مقفل' : 'Personal Finance'}
        </h2>
        <p className="text-xs text-zinc-400 mt-1">
          {isArabic ? 'أدخل رمز PIN أو استخدم البصمة لفتح التطبيق' : 'Enter 4-digit PIN or use Biometrics'}
        </p>
      </div>

      {/* PIN Dots Indicator */}
      <div className="flex flex-col items-center">
        <div className={`flex items-center gap-4 my-4 ${errorShake ? 'animate-shake' : ''}`}>
          {[0, 1, 2, 3].map((idx) => {
            const isFilled = pin.length > idx;
            return (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  isFilled
                    ? 'bg-blue-500 scale-110 shadow-lg shadow-blue-500/50'
                    : 'bg-zinc-800 border border-zinc-700'
                }`}
              />
            );
          })}
        </div>

        {errorMessage ? (
          <p className="text-xs text-red-400 font-semibold h-4 mt-2">{errorMessage}</p>
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
              onClick={() => handleKeyPress(num)}
              className="h-16 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800/80 active:scale-95 text-xl font-semibold text-white transition flex items-center justify-center cursor-pointer shadow-md"
            >
              {num}
            </button>
          ))}

          {/* Biometric Trigger or Blank */}
          {security.isBiometricEnabled ? (
            <button
              type="button"
              onClick={handleBiometricAuth}
              className="h-16 rounded-2xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 active:scale-95 text-blue-400 transition flex items-center justify-center cursor-pointer"
              title="Use Biometrics"
            >
              <Fingerprint className="w-7 h-7" />
            </button>
          ) : (
            <div />
          )}

          {/* Zero Button */}
          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            className="h-16 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800/80 active:scale-95 text-xl font-semibold text-white transition flex items-center justify-center cursor-pointer shadow-md"
          >
            0
          </button>

          {/* Backspace Button */}
          <button
            type="button"
            onClick={handleDelete}
            className="h-16 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800/80 active:scale-95 text-zinc-400 hover:text-white transition flex items-center justify-center cursor-pointer shadow-md"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
