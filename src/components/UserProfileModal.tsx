import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  X,
  Upload,
  Trash2,
  Camera,
  Check,
  ZoomIn,
  Move,
  Mail,
  Lock,
  Phone,
  Cloud,
  CheckCircle2,
  LogOut,
  AlertCircle,
  KeyRound,
  Shield,
  ArrowRight,
  RefreshCw,
  Copy,
  Sparkles,
} from 'lucide-react';
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
import { format16DigitId } from '../utils/userId';
import { User, ConfirmationResult } from 'firebase/auth';

const CURATED_DEFAULT_AVATARS = [
  // Animals
  { emoji: '🦊', label: 'Fox' },
  { emoji: '🦁', label: 'Lion' },
  { emoji: '🐯', label: 'Tiger' },
  { emoji: '🐆', label: 'Leopard' },
  { emoji: '🐼', label: 'Panda' },
  { emoji: '🦄', label: 'Unicorn' },
  { emoji: '🐺', label: 'Wolf' },
  { emoji: '🦉', label: 'Owl' },
  { emoji: '🦅', label: 'Eagle' },
  { emoji: '🐬', label: 'Dolphin' },
  { emoji: '🐲', label: 'Dragon' },
  { emoji: '🦈', label: 'Shark' },
  { emoji: '🦍', label: 'Gorilla' },
  { emoji: '🐘', label: 'Elephant' },
  { emoji: '🦚', label: 'Peacock' },
  { emoji: '🦋', label: 'Butterfly' },
  // People & Characters
  { emoji: '🧑‍🚀', label: 'Astronaut' },
  { emoji: '🥷', label: 'Ninja' },
  { emoji: '🕵️', label: 'Detective' },
  { emoji: '👨‍💻', label: 'Coder/Hacker' },
  { emoji: '🤖', label: 'Cyber Bot' },
  { emoji: '👾', label: 'Alien' },
  { emoji: '🧙', label: 'Wizard' },
  { emoji: '🦸', label: 'Superhero' },
  { emoji: '👑', label: 'Crown' },
  { emoji: '🎧', label: 'DJ' },
  { emoji: '🏎️', label: 'Racer' },
  { emoji: '💎', label: 'Diamond' },
  { emoji: '🚀', label: 'Rocket' },
  { emoji: '⚡', label: 'Bolt' },
];

export const UserProfileModal: React.FC = () => {
  const {
    isUserProfileModalOpen,
    setIsUserProfileModalOpen,
    settings,
    updateSettings,
    t,
    showToast,
  } = useApp();

  const isArabic = settings.language === 'ar';

  const [name, setName] = useState(settings.userProfile?.name || 'My Profile');
  const [avatarEmoji, setAvatarEmoji] = useState(settings.userProfile?.avatarEmoji || '👤');
  const [customAvatarUrl, setCustomAvatarUrl] = useState<string | undefined>(
    settings.userProfile?.customAvatarUrl
  );

  // Authentication & Cloud Sync State
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [authMode, setAuthMode] = useState<'none' | 'email' | 'phone'>('none');
  const [emailAuthType, setEmailAuthType] = useState<'login' | 'register' | 'forgot'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [copiedNumericId, setCopiedNumericId] = useState(false);
  const handleCopyNumericId = async (id: string) => {
    const digits = id.replace(/\D/g, '');
    if (digits.length !== 16) {
      showToast(isArabic ? 'المعرّف الرقمي غير جاهز بعد' : '16-Digit ID is not ready yet', 'error');
      return;
    }
    try {
      await navigator.clipboard.writeText(digits);
      setCopiedNumericId(true);
      showToast(isArabic ? 'تم نسخ المعرّف المكوّن من 16 رقماً!' : '16-Digit ID copied to clipboard!', 'success');
      setTimeout(() => setCopiedNumericId(false), 2000);
    } catch {
      showToast(isArabic ? 'تعذّر النسخ إلى الحافظة' : 'Could not copy to clipboard', 'error');
    }
  };

  // Sync Firebase Auth user
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return () => unsub();
  }, []);

  // Photo editing & Cropper state
  const [photoToEdit, setPhotoToEdit] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const initialPanRef = useRef({ x: 0, y: 0 });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const touchDistanceRef = useRef<number | null>(null);
  const initialZoomRef = useRef<number>(1);
  const [isClosing, setIsClosing] = useState(false);

  // Sync profile state when modal opens
  useEffect(() => {
    if (isUserProfileModalOpen) {
      setName(settings.userProfile?.name || 'My Profile');
      setAvatarEmoji(settings.userProfile?.avatarEmoji || '👤');
      setCustomAvatarUrl(settings.userProfile?.customAvatarUrl);
      setPhotoToEdit(null);
      setZoomLevel(1);
      setPanOffset({ x: 0, y: 0 });
      setAuthError('');
      setIsClosing(false);
    }
  }, [isUserProfileModalOpen, settings.userProfile]);

  if (!isUserProfileModalOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast(
        settings.language === 'ar' ? 'يرجى اختيار ملف صورة صالح' : 'Please select a valid image file',
        'error'
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setPhotoToEdit(dataUrl);
      setZoomLevel(1);
      setPanOffset({ x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    startPosRef.current = { x: e.clientX, y: e.clientY };
    initialPanRef.current = { ...panOffset };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;
    setPanOffset({
      x: initialPanRef.current.x + dx,
      y: initialPanRef.current.y + dy,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  // Pinch-to-zoom support for mobile touch screens
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchDistanceRef.current = dist;
      initialZoomRef.current = zoomLevel;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchDistanceRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / touchDistanceRef.current;
      const nextZoom = Math.min(3, Math.max(1, initialZoomRef.current * ratio));
      setZoomLevel(parseFloat(nextZoom.toFixed(2)));
    }
  };

  const handleTouchEnd = () => {
    touchDistanceRef.current = null;
  };

  const handleApplyCroppedPhoto = () => {
    if (!photoToEdit) return;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 256;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#09090b';
        ctx.fillRect(0, 0, size, size);

        // Aspect fill with zoom and pan
        const minDim = Math.min(img.width, img.height);
        const sourceSize = minDim / zoomLevel;

        // Container frame is 128px (w-32)
        const frameSize = 128;
        const scaleFactor = sourceSize / frameSize;
        const offsetX = panOffset.x * scaleFactor;
        const offsetY = panOffset.y * scaleFactor;

        const centerX = (img.width - sourceSize) / 2 - offsetX;
        const centerY = (img.height - sourceSize) / 2 - offsetY;

        const sourceX = Math.max(0, Math.min(img.width - sourceSize, centerX));
        const sourceY = Math.max(0, Math.min(img.height - sourceSize, centerY));

        ctx.drawImage(img, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
        const compressedData = canvas.toDataURL('image/jpeg', 0.88);
        setCustomAvatarUrl(compressedData);
        setPhotoToEdit(null);
        showToast(
          settings.language === 'ar' ? 'تم حفظ الصورة الشخصية بنجاح' : 'Profile photo updated successfully',
          'success'
        );
      }
    };
    img.src = photoToEdit;
  };

  const handleRemoveCustomPhoto = () => {
    setCustomAvatarUrl(undefined);
    setPhotoToEdit(null);
    showToast(
      settings.language === 'ar' ? 'تمت إزالة الصورة واستعادة الرمز' : 'Photo removed, avatar restored',
      'info'
    );
  };

  const handleSelectCuratedAvatar = (emoji: string) => {
    setAvatarEmoji(emoji);
    setCustomAvatarUrl(undefined);
  };

  const handleGoogleSignIn = async () => {
    setIsAuthLoading(true);
    setAuthError('');
    try {
      const u = await loginWithGoogle();
      if (u) {
        const currentName = settings.userProfile?.name;
        const isDefaultOrBlank =
          !currentName ||
          currentName === 'My Profile' ||
          currentName === 'User' ||
          currentName.trim() === '';
        const suggestedName = u.displayName || (u.email ? u.email.split('@')[0] : 'User');
        if (isDefaultOrBlank && suggestedName) {
          setName(suggestedName);
          updateSettings({
            userProfile: {
              ...settings.userProfile,
              name: suggestedName,
            },
          });
        }
      }
      showToast(
        isArabic ? 'تم تسجيل الدخول بنجاح!' : 'Signed in with Google successfully!',
        'success'
      );
      setAuthMode('none');
    } catch (err: any) {
      setAuthError(err?.message || 'Google sign in failed');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail) return;
    setIsAuthLoading(true);
    setAuthError('');
    try {
      if (emailAuthType === 'login') {
        await loginWithEmail(authEmail, authPassword);
        showToast(isArabic ? 'تم تسجيل الدخول بنجاح!' : 'Signed in successfully!', 'success');
        setAuthMode('none');
      } else if (emailAuthType === 'register') {
        await registerWithEmail(authEmail, authPassword);
        showToast(isArabic ? 'تم إنشاء الحساب بنجاح!' : 'Account created successfully!', 'success');
        setAuthMode('none');
      } else if (emailAuthType === 'forgot') {
        await resetPassword(authEmail);
        showToast(
          isArabic
            ? 'تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني'
            : 'Password reset link sent to your email',
          'info'
        );
        setEmailAuthType('login');
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Authentication error');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSendPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authPhone.trim()) return;
    setIsAuthLoading(true);
    setAuthError('');
    try {
      const verifier = setupRecaptcha('profile-recaptcha-container');
      const confirmation = await sendPhoneOtp(authPhone, verifier);
      setConfirmationResult(confirmation);
      showToast(
        isArabic ? 'تم إرسال رمز التحقق (OTP) بنجاح!' : 'Verification code sent via SMS!',
        'info'
      );
    } catch (err: any) {
      setAuthError(err?.message || 'Failed to send verification code');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult || !otpCode.trim()) return;
    setIsAuthLoading(true);
    setAuthError('');
    try {
      await confirmationResult.confirm(otpCode.trim());
      showToast(isArabic ? 'تم تأكيد رقم الهاتف والدخول بنجاح!' : 'Phone verified and signed in!', 'success');
      setAuthMode('none');
      setConfirmationResult(null);
      setOtpCode('');
    } catch (err: any) {
      setAuthError(err?.message || 'Invalid verification code');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logoutUser();
      showToast(isArabic ? 'تم تسجيل الخروج بنجاح' : 'Signed out successfully', 'info');
    } catch (err: any) {
      showToast(err?.message || 'Error signing out', 'error');
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      userProfile: {
        name: name.trim() || 'My Profile',
        avatarEmoji: avatarEmoji || '👤',
        customAvatarUrl,
      },
    });
    showToast(
      settings.language === 'ar' ? 'تم حفظ الملف الشخصي بنجاح' : 'Profile saved successfully',
      'success'
    );
    setIsUserProfileModalOpen(false);
  };

  const handleAnimatedClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      setIsUserProfileModalOpen(false);
    }, 180);
  };

  return (
    <div
      onClick={handleAnimatedClose}
      className={`fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 transition-all duration-200 ${
        isClosing ? 'modal-backdrop-closing' : 'modal-backdrop-anim'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md max-h-[92vh] flex flex-col rounded-3xl bg-zinc-950/95 backdrop-blur-2xl border border-zinc-800/80 shadow-2xl overflow-hidden text-white transition-all duration-200 ${
          isClosing ? 'modal-container-closing' : 'modal-container-anim'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/40 shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white">{t('editProfile')}</h3>
          </div>
          <button
            type="button"
            onClick={handleAnimatedClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            className="hidden"
          />

          {/* Current Avatar / Photo Preview */}
          <div className="flex flex-col items-center justify-center space-y-3 pt-1">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full bg-zinc-900 border-4 border-blue-500/80 overflow-hidden flex items-center justify-center text-4xl shadow-xl transition">
                {customAvatarUrl ? (
                  <img
                    src={customAvatarUrl}
                    alt="Current Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{avatarEmoji || '👤'}</span>
                )}
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Change Photo"
                className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[10px] font-bold transition cursor-pointer"
              >
                <Camera className="w-5 h-5 mb-0.5" />
                <span>{settings.language === 'ar' ? 'تغيير' : 'Change'}</span>
              </button>
            </div>

            {/* Action Buttons for Avatar/Photo */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-blue-400 hover:text-white hover:bg-zinc-850 transition cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{settings.language === 'ar' ? 'رفع صورة وتعديلها' : 'Upload & Crop Photo'}</span>
              </button>

              {customAvatarUrl && (
                <button
                  type="button"
                  onClick={handleRemoveCustomPhoto}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-950/40 border border-red-800/60 text-xs font-semibold text-red-400 hover:text-red-300 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{settings.language === 'ar' ? 'حذف الصورة' : 'Remove Photo'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Interactive Photo Crop & Drag/Zoom Modal */}
          {photoToEdit && (
            <div className="p-4 rounded-2xl bg-zinc-900 border border-blue-500/40 space-y-3.5 shadow-xl animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Move className="w-3.5 h-3.5 text-blue-400" />
                  <span>{settings.language === 'ar' ? 'اسحب وقص الصورة' : 'Drag & Zoom to Crop'}</span>
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {Math.round(zoomLevel * 100)}%
                </span>
              </div>

              {/* Circular Crop Frame with Drag / Pan */}
              <div className="flex justify-center py-2">
                <div
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  className="w-32 h-32 rounded-full border-2 border-dashed border-blue-400 overflow-hidden bg-black flex items-center justify-center relative cursor-grab active:cursor-grabbing touch-none select-none shadow-2xl"
                >
                  <img
                    src={photoToEdit}
                    alt="Crop preview"
                    draggable={false}
                    style={{
                      transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`,
                    }}
                    className="w-full h-full object-cover transition-transform duration-75 pointer-events-none"
                  />
                  <div className="absolute inset-0 rounded-full border border-white/20 pointer-events-none" />
                </div>
              </div>

              {/* Zoom Slider */}
              <div className="flex items-center gap-3 px-2">
                <ZoomIn className="w-4 h-4 text-zinc-400 shrink-0" />
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.05"
                  value={zoomLevel}
                  onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>

              {/* Crop Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPhotoToEdit(null)}
                  className="flex-1 py-2 rounded-xl bg-zinc-950 text-xs font-semibold text-zinc-400 hover:text-white transition cursor-pointer"
                >
                  {settings.language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleApplyCroppedPhoto}
                  className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition shadow cursor-pointer"
                >
                  {settings.language === 'ar' ? 'حفظ وقص الصورة' : 'Crop & Save'}
                </button>
              </div>
            </div>
          )}

          {/* Curated Default In-App Avatars */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                {settings.language === 'ar' ? 'صور رمزية جاهزة (حيوانات وشخصيات)' : 'Cool Animals & People Presets'}
              </label>
              <span className="text-[10px] text-zinc-500">
                {CURATED_DEFAULT_AVATARS.length} {settings.language === 'ar' ? 'صورة' : 'options'}
              </span>
            </div>

            <div className="grid grid-cols-6 gap-2 p-2.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 max-h-48 overflow-y-auto">
              {CURATED_DEFAULT_AVATARS.map((av) => {
                const isSelected = !customAvatarUrl && avatarEmoji === av.emoji;
                return (
                  <button
                    key={av.emoji}
                    type="button"
                    onClick={() => handleSelectCuratedAvatar(av.emoji)}
                    className={`h-11 rounded-xl flex items-center justify-center text-2xl transition cursor-pointer relative active:scale-90 ${
                      isSelected
                        ? 'bg-blue-600/30 border-2 border-blue-500 shadow-md scale-105'
                        : 'bg-zinc-900 border border-zinc-800 hover:bg-zinc-800'
                    }`}
                  >
                    <span>{av.emoji}</span>
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-blue-500 flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* User Name Field */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
              {t('userName')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-blue-500 text-white text-sm outline-none transition"
              placeholder={settings.language === 'ar' ? 'اسمك هنا...' : 'e.g. Alex'}
              required
            />
          </div>

          {/* Cloud Sync & User Account Section */}
          <div className="pt-2 border-t border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Cloud className="w-3.5 h-3.5 text-blue-400" />
                <span>{isArabic ? 'حساب المزامنة السحابية' : 'Cloud Sync & Account'}</span>
              </span>
              {currentUser && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{isArabic ? 'متزامن لحظياً' : 'Live Synced'}</span>
                </span>
              )}
            </div>

            {currentUser ? (
              /* Signed In Premium Card */
              <div className="p-4 rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border border-blue-500/30 shadow-lg space-y-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold text-sm shrink-0 overflow-hidden shadow-inner">
                      {currentUser.photoURL ? (
                        <img src={currentUser.photoURL} alt="User" className="w-full h-full object-cover" />
                      ) : (
                        (currentUser.email?.[0] || currentUser.phoneNumber?.[0] || 'U').toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white truncate">
                        {currentUser.displayName || currentUser.email || currentUser.phoneNumber}
                      </div>
                      <div className="text-xs text-zinc-400 truncate mt-0.5 font-mono">
                        {currentUser.email || currentUser.phoneNumber || 'Authenticated User'}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-950 hover:bg-red-950/40 border border-zinc-800 hover:border-red-900/60 text-zinc-300 hover:text-red-400 text-xs font-semibold transition cursor-pointer shrink-0 active:scale-95"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{isArabic ? 'خروج' : 'Sign Out'}</span>
                  </button>
                </div>

                {/* Email Profile Photo Suggestion Banner */}
                {currentUser.photoURL && customAvatarUrl !== currentUser.photoURL && (
                  <div className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
                      <span className="text-zinc-200 text-[11px] truncate">
                        {isArabic
                          ? 'هل تود استخدام صورة حسابك كأفاتار للملف الشخصي؟'
                          : 'Use your account photo as profile avatar?'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomAvatarUrl(currentUser.photoURL!);
                        showToast(
                          isArabic
                            ? 'تم اعتماد صورة الحساب كأفاتار بنجاح!'
                            : 'Email photo applied as profile avatar!',
                          'success'
                        );
                      }}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-[11px] transition shrink-0 cursor-pointer shadow"
                    >
                      {isArabic ? 'استخدام' : 'Use Photo'}
                    </button>
                  </div>
                )}

                {/* 16-Digit User Numeric ID Row with 1-Tap Copy (Item 3 & 5) */}
                <div className="w-full p-3 rounded-2xl bg-zinc-950/90 border border-zinc-800/90 flex items-center justify-between gap-2 shadow-sm">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                        {isArabic ? 'المعرف الرقمي الثابت للمشاركة' : 'Fixed 16-Digit Numeric ID'}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-400 font-semibold border border-blue-500/30">
                        16 Digits
                      </span>
                    </div>
                    <span className="block text-sm sm:text-base font-black font-mono text-white tracking-widest mt-0.5 select-all truncate">
                      {format16DigitId(settings.userProfile?.numericId || '')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyNumericId(settings.userProfile?.numericId || '')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-bold transition active:scale-95 cursor-pointer shrink-0 ${
                      copiedNumericId
                        ? 'bg-emerald-600/30 border-emerald-500/50 text-emerald-300'
                        : 'bg-blue-600 hover:bg-blue-500 border-blue-500/40 text-white shadow-md'
                    }`}
                    title="Copy Numeric ID"
                  >
                    {copiedNumericId ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                        <span>{isArabic ? 'تم النسخ' : 'Copied!'}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{isArabic ? 'نسخ' : 'Copy'}</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1 text-[10px] text-zinc-400">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{isArabic ? 'النسخ السحابي المشفر نشط' : 'Encrypted Cloud Backup Active'}</span>
                  </span>
                  <span className="font-mono text-zinc-500">Live Sync</span>
                </div>
              </div>
            ) : (
              /* Signed Out State: Premium Action Card */
              <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3.5 shadow-md">
                {/* Fixed 16-Digit Numeric ID for Local / Offline User */}
                <div className="w-full p-2.5 rounded-xl bg-zinc-950/90 border border-zinc-800/80 flex items-center justify-between gap-2 shadow-inner">
                  <div className="min-w-0 flex-1">
                    <span className="block text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                      {isArabic ? 'معرفك الرقمي الثابت (16 رقماً)' : 'Fixed 16-Digit Numeric ID'}
                    </span>
                    <span className="block text-sm font-black font-mono text-white tracking-widest mt-0.5 select-all truncate">
                      {format16DigitId(settings.userProfile?.numericId || '')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyNumericId(settings.userProfile?.numericId || '')}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition active:scale-95 cursor-pointer shrink-0 ${
                      copiedNumericId
                        ? 'bg-emerald-600/30 border-emerald-500/50 text-emerald-300'
                        : 'bg-zinc-850 hover:bg-zinc-800 border-zinc-700 text-zinc-200'
                    }`}
                    title="Copy Numeric ID"
                  >
                    {copiedNumericId ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{isArabic ? 'تم النسخ' : 'Copied!'}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-blue-400" />
                        <span>{isArabic ? 'نسخ' : 'Copy'}</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed">
                  {isArabic
                    ? 'سجل دخولك لحفظ بياناتك ومزامنتها لحظياً وبأمان عبر جميع أجهزتك.'
                    : 'Sign in to back up your financial records and sync seamlessly across all your devices.'}
                </p>

                {authError && (
                  <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-900/60 flex items-center gap-2 text-red-400 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                {authMode === 'none' && (
                  <div className="space-y-2">
                    {/* Continue with Google */}
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={isAuthLoading}
                      className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl bg-white hover:bg-zinc-100 text-black text-xs font-bold transition shadow cursor-pointer active:scale-98 disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                      <span>{isArabic ? 'المتابعة باستخدام Google' : 'Continue with Google'}</span>
                    </button>

                    {/* Secondary Email & Phone Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => { setAuthMode('email'); setAuthError(''); }}
                        className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white transition cursor-pointer"
                      >
                        <Mail className="w-3.5 h-3.5 text-blue-400" />
                        <span>{isArabic ? 'بالبريد الإلكتروني' : 'Sign in with Email'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAuthMode('phone'); setAuthError(''); }}
                        className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white transition cursor-pointer"
                      >
                        <Phone className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{isArabic ? 'برقم الهاتف' : 'Sign in with Phone'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Email Form */}
                {authMode === 'email' && (
                  <form onSubmit={handleEmailAuthSubmit} className="space-y-3 pt-1">
                    <div className="flex p-0.5 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => setEmailAuthType('login')}
                        className={`flex-1 py-1.5 rounded-lg transition ${
                          emailAuthType === 'login' ? 'bg-zinc-800 text-white' : 'text-zinc-400'
                        }`}
                      >
                        {isArabic ? 'دخول' : 'Sign In'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEmailAuthType('register')}
                        className={`flex-1 py-1.5 rounded-lg transition ${
                          emailAuthType === 'register' ? 'bg-zinc-800 text-white' : 'text-zinc-400'
                        }`}
                      >
                        {isArabic ? 'تسجيل جديد' : 'Register'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEmailAuthType('forgot')}
                        className={`flex-1 py-1.5 rounded-lg transition ${
                          emailAuthType === 'forgot' ? 'bg-zinc-800 text-white' : 'text-zinc-400'
                        }`}
                      >
                        {isArabic ? 'استعادة' : 'Reset'}
                      </button>
                    </div>

                    <div className="space-y-2">
                      <input
                        type="email"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        placeholder={isArabic ? 'البريد الإلكتروني' : 'Email address'}
                        className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                        required
                      />
                      {emailAuthType !== 'forgot' && (
                        <input
                          type="password"
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          placeholder={isArabic ? 'كلمة المرور' : 'Password'}
                          className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                          required
                        />
                      )}
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setAuthMode('none')}
                        className="flex-1 py-2 rounded-xl bg-zinc-950 text-xs font-semibold text-zinc-400 hover:text-white transition cursor-pointer"
                      >
                        {isArabic ? 'إلغاء' : 'Cancel'}
                      </button>
                      <button
                        type="submit"
                        disabled={isAuthLoading}
                        className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition shadow cursor-pointer disabled:opacity-50"
                      >
                        {isAuthLoading ? '...' : emailAuthType === 'login' ? (isArabic ? 'تسجيل الدخول' : 'Sign In') : emailAuthType === 'register' ? (isArabic ? 'إنشاء حساب' : 'Create Account') : (isArabic ? 'إرسال الرابط' : 'Send Reset Link')}
                      </button>
                    </div>
                  </form>
                )}

                {/* Phone Form */}
                {authMode === 'phone' && (
                  <div className="space-y-3 pt-1">
                    <div id="profile-recaptcha-container"></div>
                    {!confirmationResult ? (
                      <form onSubmit={handleSendPhoneOtp} className="space-y-2.5">
                        <input
                          type="tel"
                          value={authPhone}
                          onChange={(e) => setAuthPhone(e.target.value)}
                          placeholder={isArabic ? 'رقم الهاتف مع رمز الدولة (+20...)' : 'Phone number (+1...)'}
                          className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                          required
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setAuthMode('none')}
                            className="flex-1 py-2 rounded-xl bg-zinc-950 text-xs font-semibold text-zinc-400 hover:text-white transition cursor-pointer"
                          >
                            {isArabic ? 'إلغاء' : 'Cancel'}
                          </button>
                          <button
                            type="submit"
                            disabled={isAuthLoading}
                            className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition shadow cursor-pointer disabled:opacity-50"
                          >
                            {isAuthLoading ? '...' : (isArabic ? 'إرسال رمز OTP' : 'Send OTP')}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <form onSubmit={handleVerifyPhoneOtp} className="space-y-2.5">
                        <input
                          type="text"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                          placeholder={isArabic ? 'رمز التحقق (6 أرقام)' : '6-digit SMS code'}
                          className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 text-center font-mono tracking-widest focus:outline-none focus:border-emerald-500"
                          required
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmationResult(null)}
                            className="flex-1 py-2 rounded-xl bg-zinc-950 text-xs font-semibold text-zinc-400 hover:text-white transition cursor-pointer"
                          >
                            {isArabic ? 'تغيير الرقم' : 'Change Phone'}
                          </button>
                          <button
                            type="submit"
                            disabled={isAuthLoading}
                            className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition shadow cursor-pointer disabled:opacity-50"
                          >
                            {isAuthLoading ? '...' : (isArabic ? 'تأكيد ودخول' : 'Verify & Sign In')}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-950 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsUserProfileModalOpen(false)}
            className="flex-1 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-300 font-semibold text-xs transition cursor-pointer"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-bold text-xs transition shadow-lg shadow-blue-900/40 cursor-pointer"
          >
            {t('apply')}
          </button>
        </div>
      </div>
    </div>
  );
};
