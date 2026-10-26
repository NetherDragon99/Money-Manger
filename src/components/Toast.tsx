import React, { useEffect } from 'react';
import { useApp, ToastItem } from '../context/AppContext';
import { CheckCircle2, AlertCircle, Info, RotateCcw, X } from 'lucide-react';

interface ToastCardProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

const ToastCard: React.FC<ToastCardProps> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const duration = toast.duration ?? Math.min(8000, Math.max(3500, toast.message.length * 60));
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, toast.message, onDismiss]);

  return (
    <div
      className="pointer-events-auto flex items-start justify-between gap-2.5 px-4 py-3 rounded-2xl bg-zinc-900/98 border border-zinc-700/80 text-sm font-medium text-white shadow-2xl backdrop-blur-xl animate-in slide-in-from-top-4 fade-in duration-200 w-full min-w-0"
    >
      <div className="flex items-start gap-2.5 min-w-0 flex-1">
        {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
        {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />}
        {toast.type === 'info' && <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />}
        <span className="whitespace-normal break-words leading-relaxed max-w-full min-w-0 py-1 text-xs sm:text-sm">
          {toast.message}
        </span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
        {toast.action && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(toast.id);
              toast.action?.onClick();
            }}
            className="px-2.5 py-1 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shrink-0 transition active:scale-95 cursor-pointer shadow flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span>{toast.action.label}</span>
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(toast.id);
          }}
          className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
          aria-label="Dismiss notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useApp();

  if (toasts.length === 0) return null;

  // Deduplicate active toasts by message so identical or share-sync messages never stack or spam the screen
  const uniqueToasts = toasts.filter(
    (toast, index, self) => index === self.findIndex((t) => t.message.trim() === toast.message.trim())
  );

  if (uniqueToasts.length === 0) return null;

  // Render at most 3 non-overlapping unique toasts
  const visibleToasts = uniqueToasts.slice(-3);

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none px-4 w-full max-w-md sm:max-w-lg">
      {visibleToasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  );
};
