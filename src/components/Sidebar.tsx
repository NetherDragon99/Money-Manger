import React, { useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  X,
  User,
  Calendar,
  Globe,
  Moon,
  Sun,
  Download,
  Upload,
  Layers,
  Sparkles,
} from 'lucide-react';
import { exportAllDataAsJSON } from '../utils/storage';
import { PWAInstallButton } from './PWAInstallButton';
import { WeekStartDay } from '../types';

export const Sidebar: React.FC = () => {
  const {
    isSidebarOpen,
    setIsSidebarOpen,
    setIsUserProfileModalOpen,
    setIsFeaturesModalOpen,
    settings,
    updateSettings,
    accounts,
    categories,
    transactions,
    importFullData,
    showToast,
    t,
  } = useApp();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isSidebarOpen) return null;

  const handleExportAll = () => {
    exportAllDataAsJSON({
      accounts,
      categories,
      transactions,
      settings,
    });
    showToast(t('exportedSuccess'), 'success');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const ok = importFullData(parsed);
        if (ok) {
          setIsSidebarOpen(false);
        }
      } catch (err) {
        console.error(err);
        showToast(t('invalidFileError'), 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div
      onClick={() => setIsSidebarOpen(false)}
      className="fixed inset-0 z-50 flex bg-black/80 backdrop-blur-sm animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-80 max-w-[85vw] h-full flex flex-col bg-zinc-950 border-r border-zinc-800 shadow-2xl text-white overflow-hidden animate-in slide-in-from-left duration-300"
      >
        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImportFile}
          accept=".json"
          className="hidden"
        />

        {/* User Profile Header */}
        <div className="p-6 border-b border-zinc-800/80 bg-zinc-900/50 flex items-center justify-between">
          <div
            onClick={() => {
              setIsSidebarOpen(false);
              setIsUserProfileModalOpen(true);
            }}
            role="button"
            tabIndex={0}
            className="flex items-center gap-3.5 cursor-pointer group"
          >
            <div className="w-14 h-14 rounded-full bg-zinc-900 border-2 border-blue-500/80 overflow-hidden flex items-center justify-center text-3xl shadow-lg group-hover:scale-105 transition">
              {settings.userProfile?.customAvatarUrl ? (
                <img
                  src={settings.userProfile.customAvatarUrl}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{settings.userProfile?.avatarEmoji || '👤'}</span>
              )}
            </div>
            <div>
              <h3 className="font-bold text-white text-base group-hover:text-blue-400 transition">
                {settings.userProfile?.name || 'My Profile'}
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">{t('editProfile')}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Preferences & Cycle Settings */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-400" />
              <span>{t('preferences')}</span>
            </h4>

            <div className="space-y-3.5">
              {/* Week Start Day */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">{t('weekStartDay')}</label>
                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
                  {(['saturday', 'sunday', 'monday'] as WeekStartDay[]).map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => updateSettings({ weekStartDay: day })}
                      className={`py-1.5 text-xs font-semibold rounded-lg capitalize transition ${
                        settings.weekStartDay === day
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {t(day)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Default Month Start Day */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">{t('defaultMonthStartDay')}</label>
                <select
                  value={settings.defaultMonthStartDay}
                  onChange={(e) =>
                    updateSettings({ defaultMonthStartDay: parseInt(e.target.value, 10) })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      Day {d} of month
                    </option>
                  ))}
                </select>
              </div>

              {/* Language Toggle: English (Default) / العربية */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('language')}</span>
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => updateSettings({ language: 'en' })}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition ${
                      settings.language === 'en'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    English (LTR)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSettings({ language: 'ar' })}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition ${
                      settings.language === 'ar'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    العربية (RTL)
                  </button>
                </div>
              </div>

              {/* Theme Mode: Dark (Default OLED) / Light */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1 flex items-center gap-1.5">
                  {settings.themeMode === 'dark' ? (
                    <Moon className="w-3.5 h-3.5 text-indigo-400" />
                  ) : (
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span>{t('theme')}</span>
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => updateSettings({ themeMode: 'dark' })}
                    className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                      settings.themeMode === 'dark'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5" />
                    <span>{t('darkMode')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSettings({ themeMode: 'light' })}
                    className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                      settings.themeMode === 'light'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5" />
                    <span>{t('lightMode')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* PWA & Data Management */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <span>{t('pwaAndData')}</span>
            </h4>

            <div className="space-y-2.5">
              <PWAInstallButton />

              <button
                type="button"
                onClick={() => {
                  setIsSidebarOpen(false);
                  setIsFeaturesModalOpen(true);
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-xs font-bold text-blue-400 transition cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span>{settings.language === 'ar' ? 'مميزات وسجل تحديثات التطبيق' : 'App Features & Release Notes'}</span>
              </button>

              <button
                type="button"
                onClick={handleExportAll}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-200 transition"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>{t('exportAllData')}</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-200 transition"
              >
                <Upload className="w-4 h-4 text-purple-400" />
                <span>{t('importData')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Footer: Pinned at the very bottom in small, subtle muted text */}
        <div className="p-4 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500 font-mono">
          <span>{t('version')}</span>
          <button
            type="button"
            onClick={() => {
              setIsSidebarOpen(false);
              setIsFeaturesModalOpen(true);
            }}
            className="flex items-center gap-1 text-[11px] font-semibold text-blue-400 hover:underline transition cursor-pointer"
          >
            <Sparkles className="w-3 h-3" />
            <span>{settings.language === 'ar' ? 'ما الجديد؟' : "What's New"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
