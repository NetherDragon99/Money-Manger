import React, { useState } from 'react';
import { navigateBack } from '../context/NavigationContext';
import { useApp } from '../context/AppContext';
import { X, Clock, Calendar, RotateCcw } from 'lucide-react';
import { formatDateToYYYYMMDD, formatTimeToHHMM } from '../utils/dateCycle';
import { MiniDateTimePicker } from './MiniDateTimePicker';

export const ResetPeriodModal: React.FC = () => {
  const { isResetPeriodModalOpen, setIsResetPeriodModalOpen, applyPeriodReset, t, settings } = useApp();
  const [mode, setMode] = useState<'now' | 'custom' | 'revert'>('now');
  const now = new Date();
  const [customDate, setCustomDate] = useState(formatDateToYYYYMMDD(now));
  const [customTime, setCustomTime] = useState(formatTimeToHHMM(now));
  const [isClosing, setIsClosing] = useState(false);

  if (!isResetPeriodModalOpen) return null;

  const handleAnimatedClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      setIsResetPeriodModalOpen(false);
    }, 180);
  };

  const handleApply = () => {
    if (mode === 'now') {
      applyPeriodReset('now');
    } else if (mode === 'revert') {
      applyPeriodReset('revert');
    } else {
      const fullIso = `${customDate}T${customTime || '00:00'}:00`;
      applyPeriodReset('custom', fullIso);
    }
    handleAnimatedClose();
  };

  return (
    <div
      onClick={handleAnimatedClose}
      onTouchMove={(e) => e.stopPropagation()}
      className={`fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-3 sm:p-4 overflow-y-auto overscroll-contain transition-all duration-200 ${
        isClosing ? 'modal-backdrop-closing' : 'modal-backdrop-anim'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm max-h-[92dvh] overflow-y-auto my-auto rounded-3xl bg-zinc-950/95 backdrop-blur-2xl border border-zinc-800/80 p-6 text-white space-y-5 transition-all duration-200 ${
          isClosing ? 'modal-container-closing' : 'modal-container-anim'
        }`}
      >
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-blue-400" />
            {t('resetCounterTitle')}
          </h3>
          <button
            type="button"
            onClick={handleAnimatedClose}
            className="p-1 rounded-full text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {settings.resetStartDate && (
          <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-900/60 text-xs text-blue-300">
            Currently counting from: <span className="font-mono font-bold">{settings.resetStartDate.slice(0, 16).replace('T', ' ')}</span>
          </div>
        )}

        {/* Options */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setMode('now')}
            className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border text-left transition ${
              mode === 'now'
                ? 'bg-blue-600/20 border-blue-500 text-white'
                : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800/80'
            }`}
          >
            <Clock className="w-5 h-5 text-blue-400 shrink-0" />
            <div className="text-sm font-medium">{t('startFromNow')}</div>
          </button>

          <button
            type="button"
            onClick={() => setMode('custom')}
            className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border text-left transition ${
              mode === 'custom'
                ? 'bg-blue-600/20 border-blue-500 text-white'
                : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800/80'
            }`}
          >
            <Calendar className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="text-sm font-medium">{t('startFromCustomDate')}</div>
          </button>

          {mode === 'custom' && (
            <div className="pt-1">
              <MiniDateTimePicker
                date={customDate}
                time={customTime}
                hasTime={true}
                onDateChange={setCustomDate}
                onTimeChange={setCustomTime}
                onToggleHasTime={() => {}}
                lang={settings.language}
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => setMode('revert')}
            className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border text-left transition ${
              mode === 'revert'
                ? 'bg-blue-600/20 border-blue-500 text-white'
                : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800/80'
            }`}
          >
            <RotateCcw className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="text-sm font-medium">{t('revertToDefault')}</div>
          </button>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => setIsResetPeriodModalOpen(false)}
            className="flex-1 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-medium text-sm transition"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition shadow-lg shadow-blue-900/30"
          >
            {t('apply')}
          </button>
        </div>
      </div>
    </div>
  );
};
