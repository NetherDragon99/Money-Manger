import React from 'react';
import { Loader2, CheckCircle2, AlertCircle, Sparkles, X } from 'lucide-react';

export interface ProgressStep {
  label: string;
  detail?: string;
}

export interface ActionProgressModalProps {
  isOpen: boolean;
  title: string;
  steps: ProgressStep[];
  currentStepIndex: number;
  percentage: number;
  status: 'running' | 'success' | 'error';
  errorMessage?: string;
  onClose?: () => void;
  isArabic?: boolean;
}

export const ActionProgressModal: React.FC<ActionProgressModalProps> = ({
  isOpen,
  title,
  steps,
  currentStepIndex,
  percentage,
  status,
  errorMessage,
  onClose,
  isArabic = true,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 overscroll-contain select-none"
      dir={isArabic ? 'rtl' : 'ltr'}
      onTouchMove={(e) => e.stopPropagation()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl text-white space-y-5 animate-in zoom-in-95 duration-200 relative overflow-hidden"
      >
        {/* Ambient Top Glow */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-24 bg-blue-500/15 rounded-full blur-2xl pointer-events-none" />

        {/* Header Icon + Title */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
              {status === 'running' && <Loader2 className="w-6 h-6 animate-spin text-blue-400" />}
              {status === 'success' && <CheckCircle2 className="w-6 h-6 text-emerald-400 animate-in zoom-in-75" />}
              {status === 'error' && <AlertCircle className="w-6 h-6 text-red-400 animate-in zoom-in-75" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">{title}</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                {status === 'running' && (isArabic ? 'جارٍ المعالجة اللحظية...' : 'Processing in real-time...')}
                {status === 'success' && (isArabic ? 'اكتملت العملية بنجاح!' : 'Operation completed successfully!')}
                {status === 'error' && (isArabic ? 'حدث خطأ أثناء التنفيذ' : 'Failed to complete operation')}
              </p>
            </div>
          </div>

          {(status === 'error' || status === 'success') && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Percentage Display & Progress Bar */}
        <div className="space-y-2 relative z-10">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-zinc-400 font-sans">
              {isArabic ? 'نسبة الإنجاز:' : 'Completion Progress:'}
            </span>
            <span className="font-bold text-blue-400 text-sm">
              {Math.min(100, Math.max(0, Math.round(percentage)))}%
            </span>
          </div>

          {/* Progress Track */}
          <div className="w-full h-2.5 rounded-full bg-zinc-900 border border-zinc-800 overflow-hidden p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-300 ease-out ${
                status === 'error'
                  ? 'bg-red-500'
                  : status === 'success'
                  ? 'bg-emerald-500'
                  : 'bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400'
              }`}
              style={{ width: `${Math.min(100, Math.max(5, percentage))}%` }}
            />
          </div>
        </div>

        {/* Step-by-Step Stage Indicators */}
        <div className="space-y-2.5 pt-1 relative z-10">
          {steps.map((step, idx) => {
            const isCompleted = currentStepIndex > idx || status === 'success';
            const isCurrent = currentStepIndex === idx && status === 'running';
            const isPending = currentStepIndex < idx && status !== 'success';

            return (
              <div
                key={idx}
                className={`flex items-start gap-3 p-2.5 rounded-2xl border transition ${
                  isCurrent
                    ? 'bg-blue-950/30 border-blue-500/50 text-white'
                    : isCompleted
                    ? 'bg-zinc-900/60 border-zinc-800/60 text-zinc-300'
                    : 'bg-zinc-950/40 border-zinc-900 text-zinc-600'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : isCurrent ? (
                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-zinc-700 flex items-center justify-center text-[9px] font-mono text-zinc-500">
                      {idx + 1}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className={`text-xs font-semibold ${isCurrent ? 'text-blue-300' : ''}`}>
                    {step.label}
                  </div>
                  {step.detail && (
                    <div className="text-[11px] text-zinc-400 mt-0.5">{step.detail}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Error Message Box if Failed */}
        {status === 'error' && errorMessage && (
          <div className="p-3 rounded-2xl bg-red-950/40 border border-red-500/40 text-xs text-red-300 relative z-10 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* Action Button for Dismissal on Error */}
        {status === 'error' && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white transition active:scale-95 cursor-pointer"
          >
            {isArabic ? 'إغلاق' : 'Close'}
          </button>
        )}
      </div>
    </div>
  );
};
