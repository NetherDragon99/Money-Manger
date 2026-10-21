import React from 'react';
import { useApp } from '../context/AppContext';
import { CheckCircle2, AlertCircle, Info, RotateCcw } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none px-4 w-full max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-zinc-900/98 border border-zinc-700/80 text-sm font-medium text-white shadow-2xl backdrop-blur-xl animate-in slide-in-from-top-4 fade-in duration-200 w-full"
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-blue-400 shrink-0" />}
            <span className="truncate text-xs sm:text-sm">{toast.message}</span>
          </div>

          {toast.action && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toast.action?.onClick();
              }}
              className="px-2.5 py-1 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shrink-0 transition active:scale-95 cursor-pointer shadow flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{toast.action.label}</span>
            </button>
          )}
        </div>
      ))}
    </div>
  );
};
