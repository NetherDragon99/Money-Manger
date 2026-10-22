/**
 * Firebase Authentication & Cloud Sync Modal
 * Strictly supports Google Sign-In only
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Cloud,
  CheckCircle2,
  LogOut,
  AlertCircle,
  Shield,
  Loader2,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { useApp } from '../context/AppContext';
import {
  auth,
  loginWithGoogle,
  logoutUser,
} from '../utils/firebase';

interface FirebaseAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FirebaseAuthModal: React.FC<FirebaseAuthModalProps> = ({ isOpen, onClose }) => {
  const { settings, showToast } = useApp();
  const isArabic = settings.language === 'ar';

  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return () => unsub();
  }, []);

  const handleAnimatedClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 180);
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError('');
    try {
      await loginWithGoogle();
      showToast(
        isArabic ? 'تم تسجيل الدخول بنجاح!' : 'Signed in with Google successfully!',
        'success'
      );
      handleAnimatedClose();
    } catch (err: any) {
      setError(err?.message || 'Google sign in failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await logoutUser();
      showToast(isArabic ? 'تم تسجيل الخروج بنجاح' : 'Signed out successfully', 'info');
      handleAnimatedClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to sign out');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
      onClick={handleAnimatedClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-200 ${
          isClosing ? 'animate-out zoom-out-95 fade-out' : 'animate-in zoom-in-95'
        }`}
        dir={isArabic ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-blue-500" />
            <h3 className="font-bold text-white text-base">
              {isArabic ? 'حساب السحابة' : 'Cloud Account'}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleAnimatedClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-900/60 flex items-center gap-2 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {currentUser ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800 flex items-center gap-3">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'User'}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
                    {currentUser.displayName?.[0] || currentUser.email?.[0] || 'U'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-white truncate">
                    {currentUser.displayName || 'Google User'}
                  </div>
                  <div className="text-xs text-zinc-400 truncate font-mono">
                    {currentUser.email}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold mt-0.5">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{isArabic ? 'متصل بالسحابة' : 'Connected to Cloud'}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-red-950/40 border border-zinc-700 hover:border-red-500/40 text-red-400 text-xs font-bold transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>{isArabic ? 'تسجيل الخروج' : 'Sign Out'}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  {isArabic ? 'تسجيل الدخول باستخدام Google' : 'Sign In with Google'}
                </h4>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  {isArabic
                    ? 'سجّل دخولك لحفظ بياناتك ومشاركتها مع جهات اتصالك ومزامنتها لحظياً وبأمان.'
                    : 'Sign in to back up your financial records and sync shared spaces in real-time.'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-white hover:bg-zinc-100 text-black text-xs font-bold transition shadow cursor-pointer active:scale-98 disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-600" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                )}
                <span>{isArabic ? 'تسجيل الدخول باستخدام جوجل' : 'Continue with Google'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
