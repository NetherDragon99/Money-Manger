import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, Smile } from 'lucide-react';

export const UserProfileModal: React.FC = () => {
  const {
    isUserProfileModalOpen,
    setIsUserProfileModalOpen,
    settings,
    updateSettings,
    openEmojiPicker,
    t,
  } = useApp();

  const [name, setName] = useState(settings.userProfile?.name || 'My Profile');
  const [avatarEmoji, setAvatarEmoji] = useState(settings.userProfile?.avatarEmoji || '👤');

  if (!isUserProfileModalOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      userProfile: {
        name: name.trim() || 'My Profile',
        avatarEmoji: avatarEmoji || '👤',
      },
    });
    setIsUserProfileModalOpen(false);
  };

  const handlePickEmoji = () => {
    openEmojiPicker((emoji) => {
      setAvatarEmoji(emoji);
    });
  };

  return (
    <div
      onClick={() => setIsUserProfileModalOpen(false)}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl text-white space-y-6"
      >
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <h3 className="text-lg font-bold">{t('editProfile')}</h3>
          <button
            type="button"
            onClick={() => setIsUserProfileModalOpen(false)}
            className="p-1 rounded-full text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Circular Avatar Picker */}
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={handlePickEmoji}
            className="relative w-24 h-24 rounded-full bg-zinc-900 border-2 border-blue-500/80 flex items-center justify-center text-5xl hover:scale-105 active:scale-95 transition shadow-xl group"
          >
            <span>{avatarEmoji}</span>
            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
              <Smile className="w-6 h-6 text-white" />
            </div>
          </button>
          <span className="text-xs text-zinc-400">{t('avatarEmoji')}</span>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
              {t('userName')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-blue-500 text-white text-sm outline-none transition"
              placeholder="e.g. Alex"
              required
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsUserProfileModalOpen(false)}
              className="flex-1 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-medium text-sm transition"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition shadow-lg shadow-blue-900/30"
            >
              {t('apply')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
