import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { X, Upload, Trash2, Camera, Sparkles, Check, ZoomIn } from 'lucide-react';

const CURATED_DEFAULT_AVATARS = [
  { emoji: '🦊', label: 'Fox', bg: 'from-amber-600 to-orange-700' },
  { emoji: '🦁', label: 'Lion', bg: 'from-amber-500 to-yellow-600' },
  { emoji: '🐯', label: 'Tiger', bg: 'from-orange-600 to-red-600' },
  { emoji: '🐼', label: 'Panda', bg: 'from-zinc-700 to-zinc-900' },
  { emoji: '🦄', label: 'Unicorn', bg: 'from-pink-500 to-purple-600' },
  { emoji: '🐺', label: 'Wolf', bg: 'from-slate-600 to-zinc-800' },
  { emoji: '🦉', label: 'Owl', bg: 'from-indigo-600 to-slate-800' },
  { emoji: '🦅', label: 'Eagle', bg: 'from-amber-700 to-yellow-900' },
  { emoji: '🐬', label: 'Dolphin', bg: 'from-cyan-500 to-blue-600' },
  { emoji: '🐲', label: 'Dragon', bg: 'from-emerald-600 to-teal-800' },
  { emoji: '🚀', label: 'Rocket', bg: 'from-blue-600 to-indigo-800' },
  { emoji: '💎', label: 'Diamond', bg: 'from-cyan-400 to-blue-600' },
  { emoji: '👑', label: 'Crown', bg: 'from-yellow-400 to-amber-600' },
  { emoji: '⚡', label: 'Bolt', bg: 'from-yellow-500 to-orange-600' },
  { emoji: '🌟', label: 'Star', bg: 'from-amber-400 to-yellow-600' },
  { emoji: '💼', label: 'Briefcase', bg: 'from-blue-700 to-slate-900' },
  { emoji: '🎯', label: 'Target', bg: 'from-red-600 to-rose-800' },
  { emoji: '🔮', label: 'Crystal', bg: 'from-purple-600 to-pink-600' },
  { emoji: '🛡️', label: 'Shield', bg: 'from-blue-500 to-cyan-700' },
  { emoji: '🎧', label: 'DJ', bg: 'from-violet-600 to-purple-900' },
  { emoji: '🏎️', label: 'Racer', bg: 'from-red-600 to-orange-600' },
  { emoji: '🎨', label: 'Artist', bg: 'from-rose-500 to-indigo-600' },
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

  const [name, setName] = useState(settings.userProfile?.name || 'My Profile');
  const [avatarEmoji, setAvatarEmoji] = useState(settings.userProfile?.avatarEmoji || '👤');
  const [customAvatarUrl, setCustomAvatarUrl] = useState<string | undefined>(
    settings.userProfile?.customAvatarUrl
  );

  // Photo editing state
  const [photoToEdit, setPhotoToEdit] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleApplyCroppedPhoto = () => {
    if (!photoToEdit) return;

    // Use HTML5 canvas to compress and crop to 256x256 circular image
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

        // Calculate aspect fill with zoom
        const minDim = Math.min(img.width, img.height);
        const sourceSize = minDim / zoomLevel;
        const sourceX = (img.width - sourceSize) / 2;
        const sourceY = (img.height - sourceSize) / 2;

        ctx.drawImage(img, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
        const compressedData = canvas.toDataURL('image/jpeg', 0.85);
        setCustomAvatarUrl(compressedData);
        setPhotoToEdit(null);
        showToast(
          settings.language === 'ar' ? 'تم تحديث الصورة الشخصية' : 'Profile photo updated',
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
      settings.language === 'ar' ? 'تمت إزالة الصورة واستعادة الصورة الرمزية' : 'Photo removed, avatar restored',
      'info'
    );
  };

  const handleSelectCuratedAvatar = (emoji: string) => {
    setAvatarEmoji(emoji);
    setCustomAvatarUrl(undefined);
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

  return (
    <div
      onClick={() => setIsUserProfileModalOpen(false)}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[90vh] flex flex-col rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden text-white animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <h3 className="text-base font-bold">{t('editProfile')}</h3>
          </div>
          <button
            type="button"
            onClick={() => setIsUserProfileModalOpen(false)}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-850 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*"
          className="hidden"
        />

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Active Profile Picture Display */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full bg-zinc-900 border-2 border-blue-500 shadow-xl overflow-hidden flex items-center justify-center text-5xl">
                {customAvatarUrl ? (
                  <img
                    src={customAvatarUrl}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{avatarEmoji}</span>
                )}
              </div>

              {/* Quick Change Overlay */}
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
            <div className="flex items-center gap-2 mt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-blue-400 hover:text-white hover:bg-zinc-850 transition cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{settings.language === 'ar' ? 'رفع صورة من الجهاز' : 'Upload Photo'}</span>
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

          {/* Photo Crop/Zoom Editor (Active when photo is selected) */}
          {photoToEdit && (
            <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">
                  {settings.language === 'ar' ? 'معاينة وضبط الصورة' : 'Preview & Adjust Photo'}
                </span>
                <span className="text-[10px] text-zinc-400">
                  {Math.round(zoomLevel * 100)}% {settings.language === 'ar' ? 'تكبير' : 'Zoom'}
                </span>
              </div>

              {/* Circular Preview Container */}
              <div className="flex justify-center">
                <div className="w-28 h-28 rounded-full border-2 border-dashed border-blue-400 overflow-hidden bg-black flex items-center justify-center relative">
                  <img
                    src={photoToEdit}
                    alt="Crop preview"
                    style={{ transform: `scale(${zoomLevel})` }}
                    className="w-full h-full object-cover transition-transform duration-100"
                  />
                </div>
              </div>

              {/* Zoom Slider */}
              <div className="flex items-center gap-3 px-2">
                <ZoomIn className="w-4 h-4 text-zinc-400 shrink-0" />
                <input
                  type="range"
                  min="1"
                  max="2.5"
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
                  {settings.language === 'ar' ? 'تطبيق الصورة' : 'Apply Photo'}
                </button>
              </div>
            </div>
          )}

          {/* Curated Default In-App Avatars */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                {settings.language === 'ar' ? 'صور رمزية جاهزة مميزة' : 'Curated In-App Avatars'}
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
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-950 flex gap-2">
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
