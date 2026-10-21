import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, Check, X, RotateCcw } from 'lucide-react';
import { formatDateToYYYYMMDD, formatTimeToHHMM, padZero } from '../utils/dateCycle';

export interface MiniDateTimePickerProps {
  isOpen?: boolean;
  onClose?: () => void;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  hasTime: boolean;
  onDateChange: (newDate: string) => void;
  onTimeChange: (newTime: string) => void;
  onToggleHasTime: (enabled: boolean) => void;
  initialTab?: 'date' | 'time';
  lang?: 'en' | 'ar';
  title?: string;
}

export const MiniDateTimePicker: React.FC<MiniDateTimePickerProps> = ({
  isOpen = true,
  onClose,
  date,
  time,
  hasTime,
  onDateChange,
  onTimeChange,
  onToggleHasTime,
  initialTab = 'date',
  lang = 'en',
  title,
}) => {
  const [activeTab, setActiveTab] = useState<'date' | 'time'>(initialTab);
  const [clockMode, setClockMode] = useState<'hours' | 'minutes'>('hours');
  const [isClosing, setIsClosing] = useState(false);
  const clockRef = useRef<HTMLDivElement | null>(null);
  const isDraggingClockRef = useRef(false);

  // Sync initial tab if opened specifically for time or date
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Animated close handler
  const handleAnimatedClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose?.();
    }, 180);
  }, [onClose]);

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

  // Calendar matrix
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

  // 12-hour AM/PM Calculations
  const [hStr, mStr] = (time || '12:00').split(':');
  const rawH = parseInt(hStr, 10) || 0;
  const rawM = parseInt(mStr, 10) || 0;
  const isPM = rawH >= 12;
  const hour12 = rawH % 12 === 0 ? 12 : rawH % 12;
  const minute = rawM;

  const updateTime24h = useCallback((newHour12: number, newMin: number, newIsPM: boolean) => {
    let h24 = newHour12 % 12;
    if (newIsPM) h24 += 12;
    onToggleHasTime(true);
    onTimeChange(`${padZero(h24)}:${padZero(newMin)}`);
  }, [onTimeChange, onToggleHasTime]);

  const handleToggleMeridian = (targetIsPM: boolean) => {
    updateTime24h(hour12, minute, targetIsPM);
  };

  const handleSetNowTime = () => {
    const now = new Date();
    onToggleHasTime(true);
    onTimeChange(formatTimeToHHMM(now));
  };

  // Clock Hand Angles:
  // Hour hand angle: 30 deg per hour + 0.5 deg per minute for realistic analogue movement
  const hourHandAngle = ((hour12 % 12) + minute / 60) * 30;
  // Minute hand angle: 6 deg per minute
  const minuteHandAngle = minute * 6;

  const clockCenterX = 120;
  const clockCenterY = 120;
  const dialRadius = 88;

  // Active hand for pointer interactions
  const activeAngle = clockMode === 'hours' ? (hour12 % 12) * 30 : minute * 6;
  const activeHandLength = clockMode === 'hours' ? 58 : 78;
  const activeRad = ((activeAngle - 90) * Math.PI) / 180;
  const activeEndX = clockCenterX + activeHandLength * Math.cos(activeRad);
  const activeEndY = clockCenterY + activeHandLength * Math.sin(activeRad);

  // Inactive hand preview
  const otherAngle = clockMode === 'hours' ? minuteHandAngle : hourHandAngle;
  const otherHandLength = clockMode === 'hours' ? 78 : 58;
  const otherRad = ((otherAngle - 90) * Math.PI) / 180;
  const otherEndX = clockCenterX + otherHandLength * Math.cos(otherRad);
  const otherEndY = clockCenterY + otherHandLength * Math.sin(otherRad);

  // Pointer interactions on clock dial
  const handleClockInteraction = (clientX: number, clientY: number) => {
    if (!clockRef.current) return;
    const rect = clockRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const x = clientX - rect.left - centerX;
    const y = clientY - rect.top - centerY;

    let deg = (Math.atan2(y, x) * 180) / Math.PI + 90;
    if (deg < 0) deg += 360;

    if (clockMode === 'hours') {
      let selectedH = Math.round(deg / 30) % 12;
      if (selectedH === 0) selectedH = 12;
      updateTime24h(selectedH, minute, isPM);
    } else {
      const selectedM = Math.round(deg / 6) % 60;
      updateTime24h(hour12, selectedM, isPM);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingClockRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    handleClockInteraction(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingClockRef.current) return;
    handleClockInteraction(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingClockRef.current) return;
    isDraggingClockRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    // Auto-advance to minutes mode when hour is picked
    if (clockMode === 'hours') {
      setTimeout(() => {
        setClockMode('minutes');
      }, 200);
    }
  };

  // Direct click on dial number
  const handleSelectHourNumber = (h: number, e: React.MouseEvent) => {
    e.stopPropagation();
    updateTime24h(h, minute, isPM);
    setTimeout(() => {
      setClockMode('minutes');
    }, 200);
  };

  const handleSelectMinuteNumber = (m: number, e: React.MouseEvent) => {
    e.stopPropagation();
    updateTime24h(hour12, m, isPM);
  };

  if (!isOpen) return null;

  const content = (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`w-full max-w-[340px] sm:max-w-sm max-h-[92dvh] overflow-y-auto my-auto rounded-3xl bg-zinc-950/90 backdrop-blur-2xl border border-zinc-800/80 shadow-2xl p-4 sm:p-5 text-white relative transition-all duration-200 ${
        isClosing ? 'modal-container-closing' : 'modal-container-anim'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            {activeTab === 'date' ? <CalendarIcon className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">
              {title || (lang === 'ar' ? 'تحديد التاريخ والوقت' : 'Select Date & Time')}
            </h4>
            <div className="text-[11px] text-zinc-400 font-mono">
              {date} {hasTime ? `• ${padZero(hour12)}:${padZero(minute)} ${isPM ? 'PM' : 'AM'}` : ''}
            </div>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={handleAnimatedClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Segmented Bar: Calendar & Date vs Analogue Clock */}
      <div className="flex p-1 rounded-2xl bg-zinc-900 border border-zinc-800 mb-3">
        <button
          type="button"
          onClick={() => setActiveTab('date')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'date'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <CalendarIcon className="w-3.5 h-3.5" />
          <span>{lang === 'ar' ? 'التقويم' : 'Calendar'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('time');
            if (!hasTime) onToggleHasTime(true);
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'time'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{lang === 'ar' ? 'الساعة والعقارب' : 'Analogue Clock'}</span>
        </button>
      </div>

      {/* TAB 1: CALENDAR VIEW */}
      {activeTab === 'date' && (
        <div className="space-y-3 animate-in fade-in">
          {/* Quick Presets */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleSetToday}
              className="flex-1 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-[11px] font-semibold text-blue-400 transition cursor-pointer"
            >
              {lang === 'ar' ? 'اليوم' : 'Today'}
            </button>
            <button
              type="button"
              onClick={handleSetYesterday}
              className="flex-1 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-[11px] font-semibold text-zinc-300 transition cursor-pointer"
            >
              {lang === 'ar' ? 'أمس' : 'Yesterday'}
            </button>
          </div>

          {/* Month / Year Navigator */}
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="w-8 h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center text-zinc-300 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-white font-mono">
              {lang === 'ar' ? monthNamesAr[viewMonth] : monthNamesEn[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="w-8 h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center text-zinc-300 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Days of Week */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {(lang === 'ar' ? daysOfWeekAr : daysOfWeekEn).map((d, i) => (
              <span key={i} className="text-[10px] font-bold text-zinc-500 uppercase">
                {d}
              </span>
            ))}
          </div>

          {/* Day Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((d, idx) => {
              if (d === null) {
                return <div key={`empty_${idx}`} className="h-8 w-8" />;
              }
              const isSelected = isCurrentViewMonthSelected && d === selectedDay;
              return (
                <button
                  key={`day_${d}`}
                  type="button"
                  onClick={() => handleSelectDay(d)}
                  className={`h-8 w-8 mx-auto flex items-center justify-center rounded-xl text-xs font-mono font-medium transition cursor-pointer active:scale-90 ${
                    isSelected
                      ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-900/50 scale-105'
                      : 'hover:bg-zinc-850 text-zinc-200'
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: INTERACTIVE ANALOGUE CLOCK DESIGN */}
      {activeTab === 'time' && (
        <div className="space-y-3 animate-in fade-in">
          {/* Top Digital Readout with Mode Switcher & AM/PM Toggle */}
          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-zinc-900 border border-zinc-800">
            {/* Hour & Minute Segment Buttons */}
            <div className="flex items-center gap-1 font-mono text-2xl font-black">
              <button
                type="button"
                onClick={() => setClockMode('hours')}
                className={`px-3 py-1 rounded-xl transition cursor-pointer ${
                  clockMode === 'hours'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 ring-1 ring-blue-400'
                    : 'text-zinc-400 hover:text-white bg-zinc-950/60'
                }`}
                title={lang === 'ar' ? 'تعديل الساعات' : 'Select Hours'}
              >
                {padZero(hour12)}
              </button>
              <span className="text-zinc-600 animate-pulse font-light">:</span>
              <button
                type="button"
                onClick={() => setClockMode('minutes')}
                className={`px-3 py-1 rounded-xl transition cursor-pointer ${
                  clockMode === 'minutes'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 ring-1 ring-blue-400'
                    : 'text-zinc-400 hover:text-white bg-zinc-950/60'
                }`}
                title={lang === 'ar' ? 'تعديل الدقائق' : 'Select Minutes'}
              >
                {padZero(minute)}
              </button>
            </div>

            {/* AM / PM Segmented Selector */}
            <div className="flex p-0.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-bold font-mono">
              <button
                type="button"
                onClick={() => handleToggleMeridian(false)}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  !isPM
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                AM
              </button>
              <button
                type="button"
                onClick={() => handleToggleMeridian(true)}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  isPM
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                PM
              </button>
            </div>
          </div>

          {/* Sub-bar: Instructions & Mode Indicator */}
          <div className="flex items-center justify-between px-2 text-[11px] text-zinc-400">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-ping" />
              <span className="font-semibold text-zinc-200">
                {clockMode === 'hours'
                  ? lang === 'ar'
                    ? 'المس أو اسحب عقرب الساعة (1 - 12)'
                    : 'Tap or drag hour hand (1 - 12)'
                  : lang === 'ar'
                  ? 'المس أو اسحب عقرب الدقائق (0 - 59)'
                  : 'Tap or drag minute hand (0 - 59)'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleSetNowTime}
              className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition cursor-pointer font-medium"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{lang === 'ar' ? 'الآن' : 'Now'}</span>
            </button>
          </div>

          {/* Interactive Analogue Clock Face */}
          <div className="flex justify-center py-1">
            <div
              ref={clockRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="w-[240px] h-[240px] rounded-full bg-gradient-to-b from-zinc-900 to-zinc-950 border-2 border-zinc-800 shadow-[inset_0_2px_12px_rgba(0,0,0,0.8)] relative select-none touch-none cursor-pointer"
            >
              {/* SVG Clock Dial Hands, Ticks, and Center Pin */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 240 240">
                {/* 60 Minute Tick Marks */}
                {Array.from({ length: 60 }, (_, i) => {
                  const tickAngle = i * 6;
                  const tickRad = ((tickAngle - 90) * Math.PI) / 180;
                  const isMajor = i % 5 === 0;
                  const innerR = isMajor ? 104 : 108;
                  const outerR = 112;
                  const x1 = clockCenterX + innerR * Math.cos(tickRad);
                  const y1 = clockCenterY + innerR * Math.sin(tickRad);
                  const x2 = clockCenterX + outerR * Math.cos(tickRad);
                  const y2 = clockCenterY + outerR * Math.sin(tickRad);
                  return (
                    <line
                      key={`tick_${i}`}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={isMajor ? '#52525b' : '#27272a'}
                      strokeWidth={isMajor ? '2' : '1'}
                      strokeLinecap="round"
                    />
                  );
                })}

                {/* Inactive Hand (subtle dimmed preview) */}
                <line
                  x1={clockCenterX}
                  y1={clockCenterY}
                  x2={otherEndX}
                  y2={otherEndY}
                  stroke="#71717a"
                  strokeWidth={clockMode === 'hours' ? '2' : '3'}
                  strokeLinecap="round"
                  opacity="0.45"
                />

                {/* Active Clock Hand Line */}
                <line
                  x1={clockCenterX}
                  y1={clockCenterY}
                  x2={activeEndX}
                  y2={activeEndY}
                  stroke="#3b82f6"
                  strokeWidth={clockMode === 'hours' ? '3.5' : '2.5'}
                  strokeLinecap="round"
                />

                {/* Active Hand Outer Glow Bubble */}
                <circle cx={activeEndX} cy={activeEndY} r="18" fill="#3b82f6" opacity="0.25" />
                <circle cx={activeEndX} cy={activeEndY} r="14" fill="#2563eb" />

                {/* Center Pin & Ring */}
                <circle cx={clockCenterX} cy={clockCenterY} r="7" fill="#1e3a8a" />
                <circle cx={clockCenterX} cy={clockCenterY} r="4" fill="#60a5fa" />
              </svg>

              {/* Interactive Dial Numbers (Directly Clickable / Tappable Buttons) */}
              {clockMode === 'hours'
                ? Array.from({ length: 12 }, (_, i) => {
                    const hVal = i === 0 ? 12 : i;
                    const angle = (hVal % 12) * 30;
                    const angleRad = ((angle - 90) * Math.PI) / 180;
                    const numX = clockCenterX + dialRadius * Math.cos(angleRad);
                    const numY = clockCenterY + dialRadius * Math.sin(angleRad);
                    const isSelected = hVal === hour12;

                    return (
                      <button
                        key={`h_${hVal}`}
                        type="button"
                        onClick={(e) => handleSelectHourNumber(hVal, e)}
                        style={{
                          left: `${numX}px`,
                          top: `${numY}px`,
                          transform: 'translate(-50%, -50%)',
                        }}
                        className={`absolute w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-all duration-150 cursor-pointer ${
                          isSelected
                            ? 'text-white font-black z-10 scale-110 drop-shadow'
                            : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
                        }`}
                      >
                        {hVal}
                      </button>
                    );
                  })
                : Array.from({ length: 12 }, (_, i) => {
                    const mVal = i * 5;
                    const angle = mVal * 6;
                    const angleRad = ((angle - 90) * Math.PI) / 180;
                    const numX = clockCenterX + dialRadius * Math.cos(angleRad);
                    const numY = clockCenterY + dialRadius * Math.sin(angleRad);
                    const isSelected = Math.abs(mVal - minute) < 2.5;

                    return (
                      <button
                        key={`m_${mVal}`}
                        type="button"
                        onClick={(e) => handleSelectMinuteNumber(mVal, e)}
                        style={{
                          left: `${numX}px`,
                          top: `${numY}px`,
                          transform: 'translate(-50%, -50%)',
                        }}
                        className={`absolute w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-mono font-bold transition-all duration-150 cursor-pointer ${
                          isSelected
                            ? 'text-white font-black z-10 scale-110 drop-shadow'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                        }`}
                      >
                        {padZero(mVal)}
                      </button>
                    );
                  })}
            </div>
          </div>
        </div>
      )}

      {/* Done & Apply Button */}
      {onClose && (
        <div className="pt-3 mt-3 border-t border-zinc-800/80">
          <button
            type="button"
            onClick={handleAnimatedClose}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-900/40 flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-98"
          >
            <Check className="w-4 h-4" />
            <span>{lang === 'ar' ? 'تأكيد وحفظ' : 'Done & Apply'}</span>
          </button>
        </div>
      )}
    </div>
  );

  // Semitransparent floating backdrop with close animation
  if (onClose) {
    return (
      <div
        onClick={handleAnimatedClose}
        className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/60 backdrop-blur-md transition-opacity duration-200 ${
          isClosing ? 'modal-backdrop-closing' : 'modal-backdrop-anim'
        }`}
      >
        {content}
      </div>
    );
  }

  return content;
};
