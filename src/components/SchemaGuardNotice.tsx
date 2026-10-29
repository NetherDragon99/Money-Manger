import React, { useEffect } from 'react';
import { ShieldAlert, ExternalLink, RefreshCw } from 'lucide-react';
import { getActiveLanguage } from '../utils/activeLanguage';
import { translations } from '../utils/translations';
import {
  CURRENT_SCHEMA_VERSION,
  getStoredSchemaVersion,
  getBetaAppUrl,
} from '../utils/schemaGuard';

export const SchemaGuardNotice: React.FC = () => {
  const lang = getActiveLanguage();
  const isAr = lang === 'ar';
  const t = isAr ? translations.ar : translations.en;
  const storedVersion = getStoredSchemaVersion() ?? 'Unknown';

  // Ensure any initial HTML boot loader is dismissed so the notice is visible immediately
  useEffect(() => {
    const bootLoader = document.getElementById('app-boot-loader');
    if (bootLoader) {
      bootLoader.style.transition = 'opacity 0.2s ease-out';
      bootLoader.style.opacity = '0';
      bootLoader.style.pointerEvents = 'none';
      setTimeout(() => bootLoader.remove(), 210);
    }
  }, []);

  const handleOpenBeta = () => {
    const betaUrl = getBetaAppUrl();
    window.location.href = betaUrl;
  };

  const mismatchLabel = t.schemaVersionMismatch
    .replace('{0}', String(storedVersion))
    .replace('{1}', String(CURRENT_SCHEMA_VERSION));

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#090d16] text-white flex flex-col items-center justify-center p-6 text-center select-none"
    >
      <div className="max-w-md w-full bg-[#111827] border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80 flex flex-col items-center relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -top-16 -left-16 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-36 h-36 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Warning Icon Pill */}
        <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mb-5 text-amber-400 shadow-lg shadow-amber-500/10">
          <ShieldAlert className="w-8 h-8" />
        </div>

        {/* Title */}
        <h1 className="text-xl sm:text-2xl font-bold text-white mb-2 tracking-tight">
          {t.newerSchemaTitle}
        </h1>

        {/* Version Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 font-mono text-xs mb-4">
          <span>{mismatchLabel}</span>
        </div>

        {/* Description */}
        <p className="text-zinc-400 text-sm leading-relaxed mb-6 text-justify sm:text-center">
          {t.newerSchemaDesc}
        </p>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-3">
          <button
            type="button"
            onClick={handleOpenBeta}
            className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
          >
            <span>{t.openBetaApp}</span>
            <ExternalLink className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full py-3 px-4 rounded-2xl bg-zinc-800/80 hover:bg-zinc-750 active:scale-[0.98] text-zinc-300 border border-zinc-700/60 font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{isAr ? 'إعادة تحميل' : 'Reload App'}</span>
          </button>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="mt-8 text-xs font-mono text-zinc-500 tracking-wider">
        Personal Finance Tracker • Channel Protection Guard
      </div>
    </div>
  );
};
