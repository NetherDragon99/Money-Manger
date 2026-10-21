/**
 * Firebase Authentication & Cloud Sync Modal
 * Supports Google One-Tap, Email/Password, Phone OTP, and Forgot Password
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Lock,
  Phone,
  Cloud,
  CheckCircle2,
  LogOut,
  AlertCircle,
  KeyRound,
  Shield,
  Send,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { useApp } from '../context/AppContext';
import {
  auth,
  loginWithGoogle,
  loginWithEmail,
  registerWithEmail,
  resetPassword,
  logoutUser,
  setupRecaptcha,
  sendPhoneOtp,
} from '../utils/firebase';

interface FirebaseAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FirebaseAuthModal: React.FC<FirebaseAuthModalProps> = ({ isOpen, onClose }) => {
  const { settings, showToast } = useApp();
  const isArabic = settings.language === 'ar';

  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [tab, setTab] = useState<'login' | 'register' | 'phone' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
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
      setError('');
      onClose();
    }, 180);
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      await loginWithGoogle();
      showToast(isArabic ? 'تم تسجيل الدخول بنجاح!' : 'Signed in with Google successfully!', 'success');
      handleAnimatedClose();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Google sign in failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsLoading(true);
    setError('');
    try {
      if (tab === 'login') {
        await loginWithEmail(email, password);
        showToast(isArabic ? 'مرحباً بك مجدداً!' : 'Welcome back! Signed in.', 'success');
      } else {
        await registerWithEmail(email, password);
        showToast(isArabic ? 'تم إنشاء الحساب بنجاح!' : 'Account created successfully!', 'success');
      }
      handleAnimatedClose();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsLoading(true);
    setError('');
    try {
      await resetPassword(email);
      showToast(
        isArabic ? 'تم إرسال رابط استعادة كلمة المرور إلى بريدك!' : 'Password reset link sent to your email!',
        'success'
      );
      setTab('login');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Could not send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) return;
    setIsLoading(true);
    setError('');
    try {
      const verifier = setupRecaptcha('recaptcha-container');
      const confirmation = await sendPhoneOtp(phoneNumber, verifier);
      setConfirmationResult(confirmation);
      showToast(
        isArabic ? 'تم إرسال رمز التحقق إلى هاتفك!' : 'Verification code sent to your phone!',
        'info'
      );
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to send phone code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult || !verificationCode) return;
    setIsLoading(true);
    setError('');
    try {
      await confirmationResult.confirm(verificationCode);
      showToast(isArabic ? 'تم تسجيل الدخول بالهاتف بنجاح!' : 'Phone login verified successfully!', 'success');
      handleAnimatedClose();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Invalid verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      showToast(isArabic ? 'تم تسجيل الخروج' : 'Signed out successfully', 'info');
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={handleAnimatedClose}
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/60 backdrop-blur-md transition-all duration-200 ${
        isClosing ? 'modal-backdrop-closing' : 'modal-backdrop-anim'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm max-h-[92dvh] overflow-y-auto my-auto rounded-3xl bg-zinc-950/95 backdrop-blur-2xl border border-zinc-800/80 shadow-2xl p-5 text-white transition-all duration-200 ${
          isClosing ? 'modal-container-closing' : 'modal-container-anim'
        }`}
      >
        <div id="recaptcha-container" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {isArabic ? 'حساب المزامنة السحابية' : 'Cloud Sync & Account'}
              </h3>
              <p className="text-[10px] text-zinc-400">{isArabic ? 'نسخ احتياطي فوري مشفر' : 'Encrypted Realtime Backup'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAnimatedClose}
            className="p-1 rounded-full text-zinc-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Logged in state */}
        {currentUser ? (
          <div className="py-4 space-y-4">
            <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600/20 text-blue-400 font-bold flex items-center justify-center text-sm border border-blue-500/30 shrink-0">
                {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-white truncate">
                  {currentUser.displayName || (isArabic ? 'مستخدم مسجل' : 'Authenticated User')}
                </div>
                <div className="text-[10px] text-zinc-400 truncate">
                  {currentUser.email || currentUser.phoneNumber || 'Signed in'}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium mt-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{isArabic ? 'المزامنة السحابية الفورية نشطة' : 'Realtime Cloud Sync Active'}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-red-400 hover:text-red-300 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>{isArabic ? 'تسجيل الخروج' : 'Sign Out'}</span>
            </button>
          </div>
        ) : (
          /* Authentication Forms */
          <div className="py-3.5 space-y-3.5">
            {/* Segmented Auth Selector */}
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setError('');
                }}
                className={`py-1 rounded-lg transition ${
                  tab === 'login' ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {isArabic ? 'دخول' : 'Login'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setError('');
                }}
                className={`py-1 rounded-lg transition ${
                  tab === 'register' ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {isArabic ? 'تسجيل' : 'Register'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('phone');
                  setError('');
                }}
                className={`py-1 rounded-lg transition ${
                  tab === 'phone' ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {isArabic ? 'الهاتف' : 'Phone'}
              </button>
            </div>

            {/* Google One-Tap Login Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full py-2.5 px-3 rounded-2xl bg-white hover:bg-zinc-100 text-black text-xs font-bold flex items-center justify-center gap-2.5 transition cursor-pointer shadow-md active:scale-98"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{isArabic ? 'تسجيل الدخول عبر Google' : 'Sign In with Google'}</span>
            </button>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-zinc-800"></div>
              <span className="flex-shrink mx-2 text-[10px] text-zinc-500 uppercase">
                {isArabic ? 'أو عبر' : 'or'}
              </span>
              <div className="flex-grow border-t border-zinc-800"></div>
            </div>

            {error && (
              <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="truncate">{error}</span>
              </div>
            )}

            {/* Email / Password Form */}
            {(tab === 'login' || tab === 'register') && (
              <form onSubmit={handleEmailAuth} className="space-y-2.5">
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={isArabic ? 'البريد الإلكتروني' : 'Email Address'}
                    required
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 outline-none focus:border-blue-500"
                  />
                </div>

                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isArabic ? 'كلمة المرور' : 'Password'}
                    required
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 outline-none focus:border-blue-500"
                  />
                </div>

                {tab === 'login' && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => setTab('forgot')}
                      className="text-[10px] text-blue-400 hover:underline cursor-pointer"
                    >
                      {isArabic ? 'نسيت كلمة المرور؟' : 'Forgot Password?'}
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-bold text-white transition cursor-pointer shadow-lg shadow-blue-600/30"
                >
                  {isLoading
                    ? isArabic
                      ? 'جارٍ التحميل...'
                      : 'Processing...'
                    : tab === 'login'
                    ? isArabic
                      ? 'تسجيل الدخول'
                      : 'Sign In'
                    : isArabic
                    ? 'إنشاء الحساب'
                    : 'Create Account'}
                </button>
              </form>
            )}

            {/* Forgot Password */}
            {tab === 'forgot' && (
              <form onSubmit={handleForgotPassword} className="space-y-2.5">
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={isArabic ? 'أدخل بريدك الإلكتروني' : 'Enter registered email'}
                    required
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 outline-none focus:border-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition cursor-pointer shadow-lg shadow-blue-600/30"
                >
                  {isArabic ? 'إرسال رابط الاستعادة' : 'Send Reset Link'}
                </button>
                <button
                  type="button"
                  onClick={() => setTab('login')}
                  className="w-full py-1 text-[11px] text-zinc-400 hover:text-white"
                >
                  {isArabic ? 'العودة لتسجيل الدخول' : 'Back to Login'}
                </button>
              </form>
            )}

            {/* Phone Number Login */}
            {tab === 'phone' && (
              <div className="space-y-2.5">
                {!confirmationResult ? (
                  <form onSubmit={handleSendPhoneOtp} className="space-y-2.5">
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+1 234 567 8900"
                        required
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 outline-none focus:border-blue-500"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition cursor-pointer shadow-lg shadow-blue-600/30"
                    >
                      {isArabic ? 'إرسال رمز التحقق (SMS)' : 'Send Verification SMS'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyPhoneOtp} className="space-y-2.5">
                    <div className="relative">
                      <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input
                        type="text"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        placeholder="6-digit code"
                        required
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 outline-none focus:border-blue-500 text-center tracking-widest font-mono"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition cursor-pointer shadow-lg shadow-emerald-600/30"
                    >
                      {isArabic ? 'تأكيد الرمز والدخول' : 'Confirm & Log In'}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
