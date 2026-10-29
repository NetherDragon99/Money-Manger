import React, { useState, useEffect } from 'react';
import { navigateBack } from '../context/NavigationContext';
import { useApp } from '../context/AppContext';
import { Sparkles, CheckCircle2, ArrowRight, X } from 'lucide-react';
import { CURRENT_APP_VERSION } from '../utils/versionChecker';
import { ReleaseNote } from '../types';

const LAST_SEEN_KEY = 'last_seen_app_version';

export const WhatsNewModal: React.FC = () => {
  const { settings, isWhatsNewOpen, setIsWhatsNewOpen } = useApp();
  const [latestNote, setLatestNote] = useState<ReleaseNote | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const isArabic = settings.language === 'ar';

  useEffect(() => {
    try {
      const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
      // If user hasn't seen the modal for this version, open it automatically
      if (lastSeen !== CURRENT_APP_VERSION) {
        // Slight delay to allow smooth page mount
        const timer = setTimeout(() => {
          setIsWhatsNewOpen(true);
        }, 500);
        return () => clearTimeout(timer);
      }
    } catch {
      // Ignore storage errors
    }
  }, [setIsWhatsNewOpen]);

  // Dynamically load release notes chunk only when modal is open
  useEffect(() => {
    if (isWhatsNewOpen && !latestNote) {
      import('../utils/appFeatures')
        .then((mod) => {
          const visible = mod.getReleaseNotesForChannel(mod.APP_RELEASE_NOTES || []);
          if (visible.length > 0) {
            setLatestNote(visible[0]);
          }
        })
        .catch((err) => console.warn('Failed to lazy load release notes:', err));
    }
  }, [isWhatsNewOpen, latestNote]);

  const handleDismiss = () => {
    try {
      localStorage.setItem(LAST_SEEN_KEY, CURRENT_APP_VERSION);
    } catch (e) {
      console.warn('Could not save seen version:', e);
    }
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      navigateBack();
    }, 180);
  };

  if (!isWhatsNewOpen || !latestNote) return null;

  return (
    <div
      onClick={handleDismiss}
      onTouchMove={(e) => e.stopPropagation()}
      className={`fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/75 backdrop-blur-md overscroll-contain transition-all duration-200 ${
        isClosing ? 'modal-backdrop-closing' : 'modal-backdrop-anim'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md max-h-[92dvh] overflow-y-auto my-auto flex flex-col rounded-3xl bg-zinc-950/95 backdrop-blur-2xl border border-blue-500/40 p-6 shadow-2xl text-white space-y-5 relative overscroll-contain transition-all duration-200 ${
          isClosing ? 'modal-container-closing' : 'modal-container-anim'
        }`}
      >
        {/* Subtle decorative glow */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header Badge & Close Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/30 border border-blue-500 flex items-center justify-center text-blue-400 shadow-lg shadow-blue-900/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">
                  {isArabic ? 'ما الجديد في هذا التحديث' : "What's New in This Update"}
                </h3>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white shadow-sm">
                  v{latestNote.version}
                </span>
              </div>
              <p className="text-xs text-blue-400/90 font-medium">
                {isArabic ? latestNote.title.ar : latestNote.title.en}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feature Highlights List */}
        <div className="max-h-64 overflow-y-auto overscroll-contain touch-pan-y space-y-2.5 pr-1 py-1">
          {(isArabic ? latestNote.highlights.ar : latestNote.highlights.en).map((item, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2.5 p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <span className="text-xs text-zinc-200 leading-relaxed">{item}</span>
            </div>
          ))}
        </div>

        {/* Action Button: Got it (Dismisses and saves version flag) */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleDismiss}
            className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-bold text-sm shadow-xl shadow-blue-900/40 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <span>{isArabic ? 'رائع، فهمت!' : 'Awesome, Got It!'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
