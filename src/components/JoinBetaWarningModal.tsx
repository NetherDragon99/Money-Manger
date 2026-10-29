import React, { useState } from 'react';
import { AlertTriangle, ShieldCheck, Download, Check, X, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface JoinBetaWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (downloadBackup: boolean) => Promise<void>;
}

export const JoinBetaWarningModal: React.FC<JoinBetaWarningModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const { t, settings } = useApp();
  const isArabic = settings?.language === 'ar';
  const [downloadBackup, setDownloadBackup] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await onConfirm(downloadBackup);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      dir={isArabic ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#0e1422] border-2 border-amber-500/50 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-amber-500/10 text-white relative overflow-hidden select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Caution Ambient Glow */}
        <div className="absolute -top-20 -left-20 w-44 h-44 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-44 h-44 bg-red-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-2 text-zinc-400 hover:text-white rounded-xl bg-zinc-800/60 hover:bg-zinc-800 transition cursor-pointer"
          title={isArabic ? 'إلغاء' : 'Cancel'}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Caution Header */}
        <div className="flex items-start gap-4 mb-4">
          <div className="w-13 h-13 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/20">
            <AlertTriangle className="w-7 h-7 animate-pulse" />
          </div>
          <div className="min-w-0 pr-6 rtl:pr-0 rtl:pl-6">
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono text-[10px] uppercase font-bold tracking-wider mb-1">
              {t('betaModalSubtitle')}
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-white leading-tight">
              {t('betaModalTitle')}
            </h2>
          </div>
        </div>

        {/* Warning Content Card */}
        <div className="p-4 rounded-2xl bg-amber-950/25 border border-amber-500/30 text-zinc-300 text-xs sm:text-sm space-y-2.5 leading-relaxed mb-5">
          <p className="text-amber-200/90 font-medium">
            ⚠️ {t('betaModalWarning1')}
          </p>
          <p className="text-zinc-400">
            {t('betaModalWarning2')}
          </p>
        </div>

        {/* Pre-Beta Safety Backup Option */}
        <div
          onClick={() => setDownloadBackup(!downloadBackup)}
          className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer mb-6 ${
            downloadBackup
              ? 'bg-blue-950/30 border-blue-500/40 text-blue-200'
              : 'bg-zinc-900/60 border-zinc-800 text-zinc-400'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
              downloadBackup
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'border-zinc-600 bg-zinc-800'
            }`}
          >
            {downloadBackup && <Check className="w-3.5 h-3.5 stroke-[3]" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-semibold text-xs sm:text-sm text-white">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{t('betaBackupCheckbox')}</span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {isArabic
                ? 'يتم أيضاً حفظ لقطة أمان تلقائية دائمة في قاعدة بيانات المتصفح (IndexedDB).'
                : 'A permanent safety snapshot will also be saved locally to IndexedDB.'}
            </p>
          </div>
        </div>

        {/* Action Buttons: Primary Safe Button First */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="w-full sm:flex-1 py-3 px-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] text-white font-semibold text-sm transition cursor-pointer border border-zinc-700"
          >
            {t('stayOnStable')}
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing}
            className="w-full sm:flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 active:scale-[0.98] text-white font-semibold text-sm transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-amber-600/25"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{isArabic ? 'جاري التحقق...' : 'Switching...'}</span>
              </>
            ) : (
              <span>{t('confirmJoinBeta')}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
