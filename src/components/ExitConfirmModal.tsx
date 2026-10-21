import React from 'react';
import { useApp } from '../context/AppContext';
import { LogOut } from 'lucide-react';

interface ExitConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmExit: () => void;
}

export const ExitConfirmModal: React.FC<ExitConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirmExit,
}) => {
  const { settings } = useApp();
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
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm max-h-[92dvh] overflow-y-auto my-auto rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl p-6 text-white space-y-4 relative pointer-events-auto animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
            <LogOut className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              {isArabic ? 'الخروج من التطبيق' : 'Exit Application'}
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              {isArabic ? 'هل تريد الخروج من التطبيق حقاً؟' : 'Do you want to exit the app?'}
            </p>
          </div>
        </div>

        <p className="text-xs text-zinc-300 leading-relaxed">
          {isArabic
            ? 'كافة بياناتك ومعاملاتك محفوظة بأمان محلياً في ذاكرة جهازك الدائمة.'
            : 'All your accounts and transactions are safely stored on your local device.'}
        </p>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 transition cursor-pointer active:scale-95 pointer-events-auto"
          >
            {isArabic ? 'إلغاء والمتابعة' : 'Cancel / Stay'}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onConfirmExit();
            }}
            className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-lg shadow-rose-900/40 transition cursor-pointer active:scale-95 pointer-events-auto"
          >
            {isArabic ? 'خروج' : 'Exit App'}
          </button>
        </div>
      </div>
    </div>
  );
};
