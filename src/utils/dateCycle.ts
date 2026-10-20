import { WeekStartDay, PeriodFilterType, DateRange, Transaction } from '../types';
import { getLocalizedCurrencySymbol } from './currencies';

export function padZero(num: number): string {
  return num < 10 ? `0${num}` : `${num}`;
}

export function formatDateToYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = padZero(d.getMonth() + 1);
  const day = padZero(d.getDate());
  return `${y}-${m}-${day}`;
}

export function formatTimeToHHMM(d: Date): string {
  const h = padZero(d.getHours());
  const m = padZero(d.getMinutes());
  return `${h}:${m}`;
}

export function getDaysInMonth(year: number, monthZeroIndexed: number): number {
  return new Date(year, monthZeroIndexed + 1, 0).getDate();
}

/**
 * Calculates start and end Date for a monthly cycle with a custom start day.
 * E.g., startDay = 15. If reference date is Oct 20, cycle is Oct 15 - Nov 14.
 * If reference date is Oct 5, cycle is Sep 15 - Oct 14.
 */
export function getMonthCycleRange(
  refDate: Date,
  startDay: number,
  monthOffset = 0
): { startDate: string; endDate: string; label: string } {
  // Safe clamp start day between 1 and 31
  const targetDay = Math.min(Math.max(1, startDay), 31);

  // Apply offset in months
  const adjustedRef = new Date(refDate);
  if (monthOffset !== 0) {
    adjustedRef.setMonth(adjustedRef.getMonth() + monthOffset);
  }

  const year = adjustedRef.getFullYear();
  const month = adjustedRef.getMonth();
  const day = adjustedRef.getDate();

  let startYear = year;
  let startMonth = month;
  let endYear = year;
  let endMonth = month;

  if (targetDay === 1) {
    // Standard calendar month
    const maxDays = getDaysInMonth(year, month);
    return {
      startDate: `${year}-${padZero(month + 1)}-01`,
      endDate: `${year}-${padZero(month + 1)}-${padZero(maxDays)}`,
      label: adjustedRef.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    };
  }

  if (day >= targetDay) {
    // Current cycle starts in this month and ends in next month
    startYear = year;
    startMonth = month;
    const nextDate = new Date(year, month + 1, 1);
    endYear = nextDate.getFullYear();
    endMonth = nextDate.getMonth();
  } else {
    // Current cycle started in previous month and ends in this month
    const prevDate = new Date(year, month - 1, 1);
    startYear = prevDate.getFullYear();
    startMonth = prevDate.getMonth();
    endYear = year;
    endMonth = month;
  }

  const maxStartDays = getDaysInMonth(startYear, startMonth);
  const actualStartDay = Math.min(targetDay, maxStartDays);

  const maxEndDays = getDaysInMonth(endYear, endMonth);
  const actualEndDay = Math.min(targetDay - 1, maxEndDays);

  const startStr = `${startYear}-${padZero(startMonth + 1)}-${padZero(actualStartDay)}`;
  const endStr = `${endYear}-${padZero(endMonth + 1)}-${padZero(actualEndDay)}`;

  return {
    startDate: startStr,
    endDate: endStr,
    label: `${new Date(startYear, startMonth, 1).toLocaleDateString('en-US', { month: 'short' })} - ${new Date(endYear, endMonth, 1).toLocaleDateString('en-US', { month: 'short' })}`,
  };
}

/**
 * Calculates start and end Date for a week cycle respecting week start day
 */
export function getWeekRange(
  refDate: Date,
  weekStartDay: WeekStartDay,
  weekOffset = 0
): { startDate: string; endDate: string } {
  const d = new Date(refDate);
  d.setDate(d.getDate() + weekOffset * 7);

  const dayOfWeek = d.getDay(); // 0 is Sunday, 6 is Saturday
  let targetStartDayIndex = 0; // Sunday
  if (weekStartDay === 'saturday') targetStartDayIndex = 6;
  if (weekStartDay === 'monday') targetStartDayIndex = 1;

  // Difference to reach target start day
  let diff = dayOfWeek - targetStartDayIndex;
  if (diff < 0) diff += 7;

  const start = new Date(d);
  start.setDate(d.getDate() - diff);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    startDate: formatDateToYYYYMMDD(start),
    endDate: formatDateToYYYYMMDD(end),
  };
}

/**
 * Resolves DateRange from PeriodFilterType
 */
export function resolveDateRange(
  filterType: PeriodFilterType,
  weekStartDay: WeekStartDay,
  monthStartDay: number,
  offset = 0,
  customRange?: DateRange,
  resetStartDate?: string
): DateRange {
  const now = new Date();

  if (resetStartDate && (filterType === 'app_month' || filterType === 'this_month')) {
    // If user clicked reset period, count from that date/time
    return {
      startDate: resetStartDate.slice(0, 10),
      endDate: '2099-12-31',
      startTime: resetStartDate.length > 10 ? resetStartDate.slice(11, 16) : undefined,
    };
  }

  switch (filterType) {
    case 'all_time':
      return {
        startDate: '1970-01-01',
        endDate: '2099-12-31',
      };
    case 'this_week': {
      const { startDate, endDate } = getWeekRange(now, weekStartDay, offset);
      return { startDate, endDate };
    }
    case 'last_week': {
      const { startDate, endDate } = getWeekRange(now, weekStartDay, -1 + offset);
      return { startDate, endDate };
    }
    case 'app_month': {
      const { startDate, endDate } = getMonthCycleRange(now, monthStartDay, offset);
      return { startDate, endDate };
    }
    case 'last_month': {
      const { startDate, endDate } = getMonthCycleRange(now, 1, -1 + offset);
      return { startDate, endDate };
    }
    case 'this_month':
    case 'calendar_month': {
      const { startDate, endDate } = getMonthCycleRange(now, 1, offset);
      return { startDate, endDate };
    }
    case 'custom':
      if (customRange && customRange.startDate && customRange.endDate) {
        return customRange;
      }
      return {
        startDate: formatDateToYYYYMMDD(now),
        endDate: formatDateToYYYYMMDD(now),
      };
    default:
      return {
        startDate: '1970-01-01',
        endDate: '2099-12-31',
      };
  }
}

/**
 * Determines whether a transaction is within a given date range
 */
export function isTransactionInRange(tx: Transaction, range: DateRange): boolean {
  if (tx.date < range.startDate || tx.date > range.endDate) {
    return false;
  }
  // Boundary time checks if specified
  if (range.startTime && tx.date === range.startDate && tx.time) {
    if (tx.time < range.startTime) return false;
  }
  if (range.endTime && tx.date === range.endDate && tx.time) {
    if (tx.time > range.endTime) return false;
  }
  return true;
}

/**
 * Formats a currency amount ensuring strict minus sign for negative numbers
 */
export function formatCurrency(amount: number, symbol = '£', lang?: 'en' | 'ar'): string {
  const isNeg = amount < 0;
  const absVal = Math.abs(amount).toFixed(2);
  const localizedSymbol = getLocalizedCurrencySymbol(symbol, lang || 'en');
  // Strictly display -£ X if negative
  if (isNeg) {
    return `-${localizedSymbol} ${absVal}`;
  }
  return `${localizedSymbol} ${absVal}`;
}

/**
 * Formats full date and time for display
 */
export function formatFullDateTime(dateStr: string, timeStr?: string, lang = 'en'): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dateFormatted = dateObj.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      weekday: 'short',
    });

    if (!timeStr) {
      return dateFormatted;
    }

    const [hh, mm] = timeStr.split(':').map(Number);
    const dummyDate = new Date();
    dummyDate.setHours(hh, mm, 0);
    const timeFormatted = dummyDate.toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    return `${dateFormatted} • ${timeFormatted}`;
  } catch {
    return timeStr ? `${dateStr} ${timeStr}` : dateStr;
  }
}

/**
 * Converts 24h time to 12h AM/PM format
 */
export function formatTime12h(timeStr?: string, lang = 'en'): string {
  if (!timeStr) return '';
  try {
    const [hh, mm] = timeStr.split(':').map(Number);
    const dummyDate = new Date();
    dummyDate.setHours(hh, mm, 0);
    return dummyDate.toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return timeStr;
  }
}

/**
 * Day header string (e.g., "Today", "Yesterday", or "13 October, Tuesday")
 */
export function getDayHeaderTitle(dateStr: string, lang = 'en'): string {
  const todayStr = formatDateToYYYYMMDD(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDateToYYYYMMDD(yesterday);

  if (dateStr === todayStr) {
    return lang === 'ar' ? 'اليوم' : 'Today';
  }
  if (dateStr === yesterdayStr) {
    return lang === 'ar' ? 'أمس' : 'Yesterday';
  }

  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  });
}

/**
 * Month header string (e.g., "October 2026")
 */
export function getMonthHeaderTitle(monthKey: string, lang = 'en'): string {
  // monthKey is "YYYY-MM"
  const [y, m] = monthKey.split('-').map(Number);
  const dateObj = new Date(y, m - 1, 1);
  return dateObj.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
    month: 'long',
    year: 'numeric',
  });
}
