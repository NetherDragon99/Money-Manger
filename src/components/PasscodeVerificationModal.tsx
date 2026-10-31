/**
 * Passcode Verification Modal
 * Rapid confirmation modal requiring the current 4-digit passcode
 * before turning off App Lock or changing security grace periods.
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, Lock, Delete } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { loadSecuritySettings, verifyPin } from '../utils/security';

interface PasscodeVerificationModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const PasscodeVerificationModal: React.FC<PasscodeVerificationModalProps> = ({
  isOpen,
  title,
  description,
  onSuccess,
  onCancel,
}) => {
  const { settings } = useApp();
  const isArabic = settings.language === 'ar';

  const [pin, setPin] = useState('');
  const [errorShake, setErrorShake] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isVerifyingRef = useRef(false);

  const security = loadSecuritySettings();

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setErrorShake(false);
      setErrorMessage('');
      isVerifyingRef.current = false;
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (pin.length === 4 && !isVerifyingRef.current && isOpen) {
      isVerifyingRef.current = true;
      const verify = async () => {
        try {
          const ok = await verifyPin(pin, security.pinHash);
          if (ok) {
            setPin('');
            setErrorMessage('');
            onSuccess();
          } else {
            setErrorShake(true);
            setErrorMessage(isArabic ? 'رمز PIN غير صحيح' : 'Incorrect PIN');
            setTimeout(() => {
              setPin('');
              setErrorShake(false);
              isVerifyingRef.current = false;
            }, 100);
          }
        } catch (err) {
          console.error('Verification error:', err);
          isVerifyingRef.current = false;
        }
      };
      verify();
    }
  }, [pin, isOpen, security.pinHash, isArabic, onSuccess]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (/^[0-9]$/.test(e.key) && pin.length < 4) {
        setPin((prev) => prev + e.key);
      } else if (e.key === 'Backspace') {
        setPin((prev) => prev.slice(0, -1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, pin.length, onCancel]);

  if (!isOpen) return null;

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) {
      setPin((prev) => prev + num);
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  return (
    <div
      onClick={onCancel}
      onTouchMove={(e) => e.stopPropagation()}
      className="fixed inset-0 z-[9990] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 overscroll-contain select-none"
      style={{ overscrollBehavior: 'contain' }}
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
        }}
        className="w-full max-w-sm rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl p-5 text-white animate-in zoom-in-95 duration-150 flex flex-col items-center"
      >
        {/* Header */}
        <div className="w-full flex items-center justify-between pb-2 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Lock className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-sm font-bold text-white">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {description && (
          <p className="text-xs text-zinc-400 text-center mt-3 px-2 leading-relaxed">
            {description}
          </p>
        )}

        {/* Dots with instant <=100ms transition */}
        <div
          className="flex items-center gap-4 my-5"
          role="status"
          aria-live="polite"
          aria-label={isArabic ? `تم إدخال ${pin.length} من 4 أرقام` : `${pin.length} of 4 digits entered`}
        >
          {[0, 1, 2, 3].map((idx) => {
            const filled = idx < pin.length;
            return (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all duration-75 ${
                  errorShake
                    ? 'bg-red-500 scale-110'
                    : filled
                    ? 'bg-blue-500 scale-110 shadow-lg shadow-blue-500/50'
                    : 'bg-zinc-800 border border-zinc-700'
                }`}
              />
            );
          })}
        </div>

        {errorMessage ? (
          <p className="text-xs text-red-400 font-semibold h-4 mb-2">{errorMessage}</p>
        ) : (
          <div className="h-4 mb-2" />
        )}

        {/* Keypad */}
        <div className="w-full max-w-[260px] pb-2">
          <div className="grid grid-cols-3 gap-2.5">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <button
                key={num}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  handleKeyPress(num);
                }}
                className="h-12 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 active:scale-95 text-lg font-semibold text-white transition-transform duration-75 flex items-center justify-center cursor-pointer shadow-sm"
              >
                {num}
              </button>
            ))}

            <div />

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                handleKeyPress('0');
              }}
              className="h-12 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 active:scale-95 text-lg font-semibold text-white transition-transform duration-75 flex items-center justify-center cursor-pointer shadow-sm"
            >
              0
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              className="h-12 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 active:scale-95 text-zinc-400 hover:text-white transition-transform duration-75 flex items-center justify-center cursor-pointer shadow-sm"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Cancel Button */}
        <button
          type="button"
          onClick={onCancel}
          className="w-full mt-2 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-900 transition cursor-pointer"
        >
          {isArabic ? 'إلغاء' : 'Cancel'}
        </button>
      </div>
    </div>
  );
};
