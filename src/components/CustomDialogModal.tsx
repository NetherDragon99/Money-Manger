import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, HelpCircle, Check, X } from 'lucide-react';

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  confirmLabel?: string;
  cancelText?: string;
  cancelLabel?: string;
  isDanger?: boolean;
}

export interface PromptDialogOptions {
  title?: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  confirmLabel?: string;
  cancelText?: string;
  cancelLabel?: string;
  inputType?: string;
}

interface CustomDialogModalProps {
  dialogState: {
    type: 'confirm' | 'prompt';
    options: ConfirmDialogOptions | PromptDialogOptions;
    resolve: (value: any) => void;
  } | null;
  onClose: () => void;
  isArabic?: boolean;
}

export const CustomDialogModal: React.FC<CustomDialogModalProps> = ({
  dialogState,
  onClose,
  isArabic = false,
}) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (dialogState && dialogState.type === 'prompt') {
      const opts = dialogState.options as PromptDialogOptions;
      setInputValue(opts.defaultValue || '');
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [dialogState]);

  if (!dialogState) return null;

  const { type, options, resolve } = dialogState;
  const isPrompt = type === 'prompt';
  const promptOpts = isPrompt ? (options as PromptDialogOptions) : null;
  const isDanger = (options as ConfirmDialogOptions).isDanger ?? false;

  const handleConfirm = () => {
    if (isPrompt) {
      resolve(inputValue);
    } else {
      resolve(true);
    }
    onClose();
  };

  const handleCancel = () => {
    if (isPrompt) {
      resolve(null);
    } else {
      resolve(false);
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  const defaultTitle = isPrompt
    ? isArabic
      ? 'إدخال مطلوب'
      : 'Input Required'
    : isDanger
    ? isArabic
      ? 'تأكيد الحذف'
      : 'Confirm Action'
    : isArabic
    ? 'تأكيد'
    : 'Confirmation';

  const defaultConfirmText = isPrompt
    ? isArabic
      ? 'موافق'
      : 'Submit'
    : isDanger
    ? isArabic
      ? 'حذف'
      : 'Delete'
    : isArabic
    ? 'نعم، تأكيد'
    : 'Confirm';

  const defaultCancelText = isArabic ? 'إلغاء' : 'Cancel';

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 overscroll-contain"
      onTouchMove={(e) => e.stopPropagation()}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-zinc-950/95 dark:bg-zinc-950/95 border border-zinc-800/90 shadow-2xl p-5 text-white overflow-hidden animate-in zoom-in-95 duration-200 space-y-4"
        dir={isArabic ? 'rtl' : 'ltr'}
      >
        {/* Header with Icon */}
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
              isDanger
                ? 'bg-red-500/20 border border-red-500/40 text-red-400'
                : 'bg-blue-500/20 border border-blue-500/40 text-blue-400'
            }`}
          >
            {isDanger ? (
              <AlertTriangle className="w-5 h-5" />
            ) : isPrompt ? (
              <HelpCircle className="w-5 h-5" />
            ) : (
              <HelpCircle className="w-5 h-5" />
            )}
          </div>

          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="text-base font-bold text-white tracking-tight leading-snug">
              {options.title || defaultTitle}
            </h3>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed break-words whitespace-pre-wrap">
              {options.message}
            </p>
          </div>
        </div>

        {/* Optional Prompt Input Field */}
        {isPrompt && (
          <div className="pt-1">
            <input
              ref={inputRef}
              type={promptOpts?.inputType || 'text'}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={promptOpts?.placeholder || ''}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700/80 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-semibold transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <X className="w-3.5 h-3.5 text-zinc-500" />
            <span>{options.cancelText || options.cancelLabel || defaultCancelText}</span>
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shadow-lg ${
              isDanger
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-950/50'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-950/50'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>{options.confirmText || options.confirmLabel || defaultConfirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
