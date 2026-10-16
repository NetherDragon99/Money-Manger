import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, Sparkles, CheckCircle2, History, Layers } from 'lucide-react';
import { APP_RELEASE_NOTES, APP_CORE_FEATURES } from '../utils/appFeatures';
import { CURRENT_APP_VERSION } from '../utils/versionChecker';

export const AppFeaturesModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const { settings } = useApp();
  const [activeTab, setActiveTab] = useState<'changelog' | 'features'>('changelog');
  const isArabic = settings.language === 'ar';

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[88vh] flex flex-col rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden text-white animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isArabic ? 'مميزات وسجل تحديثات التطبيق' : 'App Features & Updates'}
              </h3>
              <p className="text-[11px] text-zinc-400 font-mono">
                {isArabic ? `الإصدار الحالي: v${CURRENT_APP_VERSION}` : `Current Version: v${CURRENT_APP_VERSION}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle: Changelog (Newest at top) vs Features */}
        <div className="px-6 pt-3 pb-2">
          <div className="flex p-1 rounded-2xl bg-zinc-900 border border-zinc-800">
            <button
              type="button"
              onClick={() => setActiveTab('changelog')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                activeTab === 'changelog'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>{isArabic ? 'سجل التحديثات (الأحدث أولاً)' : 'Release Notes (Newest Top)'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('features')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                activeTab === 'features'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{isArabic ? 'دليل المميزات' : 'Feature Directory'}</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-4">
          {/* TAB 1: CHANGELOG (Newest updates at the top of the page) */}
          {activeTab === 'changelog' && (
            <div className="space-y-4 animate-in fade-in">
              {APP_RELEASE_NOTES.map((note, index) => {
                const isLatest = index === 0;
                return (
                  <div
                    key={note.version}
                    className={`p-4 rounded-2xl border transition ${
                      isLatest
                        ? 'bg-blue-950/20 border-blue-600/50 shadow-lg shadow-blue-950/40'
                        : 'bg-zinc-900/60 border-zinc-800/80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black px-2 py-0.5 rounded-full bg-blue-600/30 border border-blue-500/50 text-blue-300">
                          v{note.version}
                        </span>
                        {isLatest && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                            {isArabic ? 'أحدث إصدار' : 'Latest'}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-zinc-500 font-mono">
                        {note.releaseDate}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-white mb-2">
                      {isArabic ? note.title.ar : note.title.en}
                    </h4>

                    <ul className="space-y-1.5">
                      {(isArabic ? note.highlights.ar : note.highlights.en).map(
                        (h, hIdx) => (
                          <li
                            key={hIdx}
                            className="flex items-start gap-2 text-xs text-zinc-300 leading-relaxed"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                            <span>{h}</span>
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: FEATURES DIRECTORY */}
          {activeTab === 'features' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in">
              {APP_CORE_FEATURES.map((feat) => (
                <div
                  key={feat.id}
                  className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{feat.icon}</span>
                    <h5 className="text-xs font-bold text-white">
                      {isArabic ? feat.title.ar : feat.title.en}
                    </h5>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    {isArabic ? feat.description.ar : feat.description.en}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-950">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-white font-bold text-xs transition cursor-pointer"
          >
            {isArabic ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
