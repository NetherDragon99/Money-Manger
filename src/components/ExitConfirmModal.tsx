import React from 'react';
import { useApp } from '../context/AppContext';
import { LogOut, Home } from 'lucide-react';

interface ExitConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmExit: () => void;
  exitHint?: string | null;
}

export const ExitConfirmModal: React.FC<ExitConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirmExit,
  exitHint,
}) => {
  const { settings, t } = useApp();
  const isArabic = settings.language === 'ar';

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onTouchMove={(e) => e.stopPropagation()}
      className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/75 backdrop-blur-md pointer-events-auto select-none animate-in fade-in duration-150 overscroll-contain"
      style={{ overscrollBehavior: 'contain' }}
    >
      <div
        dir={isArabic ? 'rtl' : 'ltr'}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm max-h-[92dvh] overflow-y-auto my-auto rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl p-6 text-white space-y-4 relative pointer-events-auto animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
            <LogOut className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              {t('exitAppTitle')}
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              {t('exitAppSubtitle')}
            </p>
          </div>
        </div>

        <p className="text-xs text-zinc-300 leading-relaxed">
          {t('exitAppSafeguard')}
        </p>

        {exitHint ? (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center animate-in fade-in space-y-2">
            <div className="flex items-center justify-center gap-2 text-amber-400 text-xs font-semibold">
              <Home className="w-4 h-4 shrink-0" />
              <span>{exitHint}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-300 font-semibold border border-zinc-800 transition active:scale-95"
            >
              {t('exitAppStay')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 transition cursor-pointer active:scale-95 pointer-events-auto"
            >
              {t('exitAppStay')}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onConfirmExit();
              }}
              className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-lg shadow-rose-900/40 transition cursor-pointer active:scale-95 pointer-events-auto"
            >
              {t('exitAppConfirm')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
