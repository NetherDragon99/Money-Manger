import React, { useMemo, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X, Check } from 'lucide-react';
import { DateRange } from '../types';
import { formatDateToYYYYMMDD } from '../utils/dateCycle';

interface DateRangeCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRange: DateRange;
  onApply: (range: DateRange) => void;
  language?: 'en' | 'ar';
}

const WEEKDAYS_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const WEEKDAYS_AR = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];

export const DateRangeCalendarModal: React.FC<DateRangeCalendarModalProps> = ({
  isOpen,
  onClose,
  initialRange,
  onApply,
  language = 'ar',
}) => {
  const isArabic = language === 'ar';

  const [draftStart, setDraftStart] = useState<string>(initialRange.startDate);
  const [draftEnd, setDraftEnd] = useState<string>(initialRange.endDate);
  const [viewMonth, setViewMonth] = useState<{ year: number; month: number }>(() => {
    const base = initialRange.startDate ? new Date(`${initialRange.startDate}T00:00:00`) : new Date();
    return {
      year: isNaN(base.getTime()) ? new Date().getFullYear() : base.getFullYear(),
      month: isNaN(base.getTime()) ? new Date().getMonth() : base.getMonth(),
    };
  });
  // Tracks whether next tap starts a new range vs completes an active start->end selection
  const [awaitingEnd, setAwaitingEnd] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    const todayStr = formatDateToYYYYMMDD(new Date());
    const start = initialRange.startDate && initialRange.startDate > '1980-01-01' ? initialRange.startDate : todayStr;
    const end = initialRange.endDate && initialRange.endDate < '2090-01-01' ? initialRange.endDate : start;
    setDraftStart(start);
    setDraftEnd(end < start ? start : end);
    setAwaitingEnd(false);
    const d = new Date(`${start}T00:00:00`);
    if (!isNaN(d.getTime())) {
      setViewMonth({ year: d.getFullYear(), month: d.getMonth() });
    }
  }, [isOpen, initialRange.startDate, initialRange.endDate]);

  const calendarDays = useMemo(() => {
    const firstOfMonth = new Date(viewMonth.year, viewMonth.month, 1);
    const startWeekday = firstOfMonth.getDay();
    const daysInMonth = new Date(viewMonth.year, viewMonth.month + 1, 0).getDate();

    const cells: Array<{ dateStr: string; day: number; inMonth: boolean }> = [];

    // Leading days from previous month
    const prevMonthLastDay = new Date(viewMonth.year, viewMonth.month, 0).getDate();
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = new Date(viewMonth.year, viewMonth.month - 1, prevMonthLastDay - i);
      cells.push({ dateStr: formatDateToYYYYMMDD(d), day: d.getDate(), inMonth: false });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(viewMonth.year, viewMonth.month, day);
      cells.push({ dateStr: formatDateToYYYYMMDD(d), day, inMonth: true });
    }

    // Trailing filler cells to complete 6 rows cleanly
    while (cells.length % 7 !== 0 || cells.length < 35) {
      const offset = cells.length - (startWeekday + daysInMonth) + 1;
      const d = new Date(viewMonth.year, viewMonth.month + 1, offset);
      cells.push({ dateStr: formatDateToYYYYMMDD(d), day: d.getDate(), inMonth: false });
    }

    return cells;
  }, [viewMonth.year, viewMonth.month]);

  if (!isOpen) return null;

  const monthTitle = new Date(viewMonth.year, viewMonth.month, 1).toLocaleDateString(
    isArabic ? 'ar-EG' : 'en-US',
    { month: 'long', year: 'numeric' }
  );

  const handleDayClick = (dateStr: string) => {
    if (!awaitingEnd) {
      setDraftStart(dateStr);
      setDraftEnd(dateStr);
      setAwaitingEnd(true);
    } else {
      if (dateStr < draftStart) {
        setDraftEnd(draftStart);
        setDraftStart(dateStr);
      } else {
        setDraftEnd(dateStr);
      }
      setAwaitingEnd(false);
    }
  };

  const applyQuickPreset = (daysBack: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - daysBack + 1);
    const sStr = formatDateToYYYYMMDD(start);
    const eStr = formatDateToYYYYMMDD(end);
    setDraftStart(sStr);
    setDraftEnd(eStr);
    setAwaitingEnd(false);
    setViewMonth({ year: end.getFullYear(), month: end.getMonth() });
  };

  const stepMonth = (delta: number) => {
    setViewMonth((prev) => {
      const next = new Date(prev.year, prev.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const weekdays = isArabic ? WEEKDAYS_AR : WEEKDAYS_EN;
  const normalizedStart = draftStart <= draftEnd ? draftStart : draftEnd;
  const normalizedEnd = draftStart <= draftEnd ? draftEnd : draftStart;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-4 bg-black/80 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        dir={isArabic ? 'rtl' : 'ltr'}
        className="w-full max-w-sm rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden flex flex-col text-white"
      >
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">
              {isArabic ? 'تحديد مدة مخصصة' : 'Select Custom Duration'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3.5">
          {/* Selected Range Summary */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-2xl bg-zinc-900/90 border border-zinc-800">
              <span className="block text-[10px] text-zinc-400">
                {isArabic ? 'من تاريخ' : 'From'}
              </span>
              <span className="font-mono font-bold text-emerald-300">{normalizedStart}</span>
            </div>
            <div className="p-2.5 rounded-2xl bg-zinc-900/90 border border-zinc-800">
              <span className="block text-[10px] text-zinc-400">
                {isArabic ? 'إلى تاريخ' : 'To'}
              </span>
              <span className="font-mono font-bold text-emerald-300">{normalizedEnd}</span>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { label: isArabic ? 'آخر 7 أيام' : 'Last 7d', days: 7 },
              { label: isArabic ? 'آخر 30 يوم' : 'Last 30d', days: 30 },
              { label: isArabic ? 'آخر 90 يوم' : 'Last 90d', days: 90 },
            ].map((p) => (
              <button
                key={p.days}
                type="button"
                onClick={() => applyQuickPreset(p.days)}
                className="px-2.5 py-1 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-semibold text-zinc-300 transition cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Month Navigation */}
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => stepMonth(-1)}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition cursor-pointer"
              aria-label="Previous month"
            >
              {isArabic ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
            <span className="text-xs font-bold text-white">{monthTitle}</span>
            <button
              type="button"
              onClick={() => stepMonth(1)}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition cursor-pointer"
              aria-label="Next month"
            >
              {isArabic ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-zinc-500">
            {weekdays.map((wd) => (
              <div key={wd} className="py-1">
                {wd}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-y-1 text-xs">
            {calendarDays.map((cell) => {
              const isStart = cell.dateStr === normalizedStart;
              const isEnd = cell.dateStr === normalizedEnd;
              const isInRange = cell.dateStr > normalizedStart && cell.dateStr < normalizedEnd;

              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  onClick={() => handleDayClick(cell.dateStr)}
                  className={`h-9 flex items-center justify-center font-mono text-[11px] transition cursor-pointer ${
                    isStart || isEnd
                      ? 'bg-emerald-500 text-black font-extrabold rounded-xl shadow-md shadow-emerald-950/50'
                      : isInRange
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : cell.inMonth
                      ? 'text-zinc-200 hover:bg-zinc-900 rounded-xl'
                      : 'text-zinc-600 hover:bg-zinc-900/50 rounded-xl'
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          <p className="text-[10px] text-center text-zinc-500">
            {awaitingEnd
              ? isArabic
                ? 'اضغط على تاريخ النهاية الآن'
                : 'Now tap the end date'
              : isArabic
              ? 'اضغط على تاريخ البداية ثم تاريخ النهاية'
              : 'Tap start date, then tap end date'}
          </p>
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 border-t border-zinc-800/80 bg-zinc-900/60 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[42px] rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-zinc-300 transition cursor-pointer"
          >
            {isArabic ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => {
              onApply({ startDate: normalizedStart, endDate: normalizedEnd });
              onClose();
            }}
            className="flex-1 min-h-[42px] rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{isArabic ? 'تطبيق المدة' : 'Apply Range'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
