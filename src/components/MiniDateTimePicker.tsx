import React, { useState } from 'react';
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { formatDateToYYYYMMDD, formatTimeToHHMM, padZero } from '../utils/dateCycle';

interface MiniDateTimePickerProps {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  hasTime: boolean;
  onDateChange: (newDate: string) => void;
  onTimeChange: (newTime: string) => void;
  onToggleHasTime: (enabled: boolean) => void;
  lang?: 'en' | 'ar';
}

export const MiniDateTimePicker: React.FC<MiniDateTimePickerProps> = ({
  date,
  time,
  hasTime,
  onDateChange,
  onTimeChange,
  onToggleHasTime,
  lang = 'en',
}) => {
  const [activeTab, setActiveTab] = useState<'date' | 'time'>('date');

  // Parse current selected date
  const parsedDate = new Date(date + 'T12:00:00');
  const [viewYear, setViewYear] = useState(parsedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsedDate.getMonth()); // 0-indexed

  const monthNamesEn = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthNamesAr = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];

  const daysOfWeekEn = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const daysOfWeekAr = ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'];

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Build calendar matrix for viewMonth / viewYear
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarDays.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(d);
  }

  const selectedDay = parsedDate.getDate();
  const isCurrentViewMonthSelected =
    parsedDate.getFullYear() === viewYear && parsedDate.getMonth() === viewMonth;

  const handleSelectDay = (day: number) => {
    const formatted = `${viewYear}-${padZero(viewMonth + 1)}-${padZero(day)}`;
    onDateChange(formatted);
  };

  const handleSetToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    onDateChange(formatDateToYYYYMMDD(now));
  };

  const handleSetYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    setViewYear(yesterday.getFullYear());
    setViewMonth(yesterday.getMonth());
    onDateChange(formatDateToYYYYMMDD(yesterday));
  };

  const handleSetNowTime = () => {
    onToggleHasTime(true);
    onTimeChange(formatTimeToHHMM(new Date()));
  };

  const hoursList = Array.from({ length: 24 }, (_, i) => padZero(i));
  const minutePresets = ['00', '15', '30', '45'];

  const currentHour = time ? time.split(':')[0] || '12' : '12';
  const currentMinute = time ? time.split(':')[1] || '00' : '00';

  return (
    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-3 space-y-3 shadow-xl">
      {/* Tab Switcher */}
      <div className="flex p-0.5 rounded-xl bg-zinc-950 border border-zinc-800">
        <button
          type="button"
          onClick={() => setActiveTab('date')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === 'date'
              ? 'bg-blue-600 text-white shadow'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <CalendarIcon className="w-3.5 h-3.5" />
          <span>{lang === 'ar' ? 'التقويم' : 'Calendar'}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('time')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === 'time'
              ? 'bg-blue-600 text-white shadow'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{lang === 'ar' ? 'الساعة والوقت' : 'Clock & Time'}</span>
        </button>
      </div>

      {/* DATE PICKER VIEW */}
      {activeTab === 'date' && (
        <div className="space-y-2.5 animate-in fade-in">
          {/* Month/Year Header */}
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="Previous Month"
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-white">
              {lang === 'ar' ? monthNamesAr[viewMonth] : monthNamesEn[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="Next Month"
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Days of week */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-zinc-500">
            {(lang === 'ar' ? daysOfWeekAr : daysOfWeekEn).map((d, idx) => (
              <div key={idx} className="py-0.5">
                {d}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {calendarDays.map((d, idx) => {
              if (d === null) {
                return <div key={`empty-${idx}`} className="h-8" />;
              }
              const isSelected = isCurrentViewMonthSelected && d === selectedDay;
              return (
                <button
                  key={`day-${d}`}
                  type="button"
                  onClick={() => handleSelectDay(d)}
                  className={`h-8 rounded-xl text-xs font-mono font-medium transition cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-900/40 scale-105'
                      : 'text-zinc-200 hover:bg-zinc-800 active:scale-95'
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>

          {/* Quick Date Presets */}
          <div className="flex gap-2 pt-1 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={handleSetToday}
              className="flex-1 py-1 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-[11px] font-semibold text-zinc-300 transition cursor-pointer"
            >
              {lang === 'ar' ? 'اليوم' : 'Today'}
            </button>
            <button
              type="button"
              onClick={handleSetYesterday}
              className="flex-1 py-1 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-[11px] font-semibold text-zinc-300 transition cursor-pointer"
            >
              {lang === 'ar' ? 'أمس' : 'Yesterday'}
            </button>
          </div>
        </div>
      )}

      {/* TIME PICKER VIEW */}
      {activeTab === 'time' && (
        <div className="space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white">
              {lang === 'ar' ? 'تضمين الوقت' : 'Include Time'}
            </span>
            <button
              type="button"
              onClick={() => onToggleHasTime(!hasTime)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                hasTime
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {hasTime ? (lang === 'ar' ? 'مفعل ✓' : 'Enabled ✓') : (lang === 'ar' ? 'معطل' : 'Off')}
            </button>
          </div>

          {hasTime && (
            <div className="space-y-3 pt-1">
              {/* Quick Preset: Now */}
              <button
                type="button"
                onClick={handleSetNowTime}
                className="w-full py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-blue-400 transition cursor-pointer"
              >
                {lang === 'ar' ? 'الوقت الحالي الآن' : 'Set to Current Time'}
              </button>

              {/* Hour Grid (Scrollable) */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                  {lang === 'ar' ? 'الساعة (24h)' : 'Hour (24h)'}
                </label>
                <div className="grid grid-cols-6 gap-1 max-h-24 overflow-y-auto pr-1">
                  {hoursList.map((h) => {
                    const isHourSelected = h === currentHour;
                    return (
                      <button
                        key={h}
                        type="button"
                        onClick={() => onTimeChange(`${h}:${currentMinute}`)}
                        className={`h-7 rounded-lg text-xs font-mono transition cursor-pointer ${
                          isHourSelected
                            ? 'bg-blue-600 text-white font-bold'
                            : 'bg-zinc-950 text-zinc-300 hover:bg-zinc-800'
                        }`}
                      >
                        {h}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Minute Grid */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                  {lang === 'ar' ? 'الدقيقة' : 'Minute'}
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {minutePresets.map((m) => {
                    const isMinSelected = m === currentMinute;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => onTimeChange(`${currentHour}:${m}`)}
                        className={`py-1.5 rounded-lg text-xs font-mono transition cursor-pointer ${
                          isMinSelected
                            ? 'bg-blue-600 text-white font-bold'
                            : 'bg-zinc-950 text-zinc-300 hover:bg-zinc-800'
                        }`}
                      >
                        :{m}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
