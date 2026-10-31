/**
 * Recurring Transactions Engine
 * Handles recurring rules, DST-safe next scheduled dates/times,
 * deterministic catch-up up to 366 occurrences, and advanced multi-day/time scheduling.
 */

import { RecurringTransaction, RecurringFrequency, Transaction, AdvancedScheduleConfig } from '../types';
import { formatDateToYYYYMMDD, formatTimeToHHMM, formatTime12h } from './dateCycle';

const RECURRING_STORAGE_KEY = 'money_manager_recurring_v1';

export const WEEKDAY_NAMES_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAY_NAMES_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

export function formatDayRanges(days: number[]): string {
  if (!days || days.length === 0) return '';
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let end = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      start = sorted[i];
      end = sorted[i];
    }
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`);
  return ranges.join(', ');
}

export function normalizeHHMM(t: string): string {
  if (!t || typeof t !== 'string') return '09:00';
  const parts = t.trim().split(':');
  const hh = String(Math.min(23, Math.max(0, parseInt(parts[0], 10) || 0))).padStart(2, '0');
  const mm = String(Math.min(59, Math.max(0, parseInt(parts[1], 10) || 0))).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function normalizeTimesList(times?: (string | null | undefined)[]): string[] {
  if (!times || !Array.isArray(times) || times.length === 0) return [];
  const set = new Set<string>();
  for (const tm of times) {
    if (tm && typeof tm === 'string' && tm.trim()) {
      set.add(normalizeHHMM(tm));
    }
  }
  return Array.from(set).sort();
}

/**
 * Safely migrates existing saved recurring rules to ensure explicit
 * useWeekdayFilter & useMonthDayFilter flags and normalized default/custom times
 * are populated without breaking legacy rules.
 */
export function migrateRecurringRule(rule: RecurringTransaction): RecurringTransaction {
  if (!rule || typeof rule !== 'object') return rule;

  const adv = rule.advancedSchedule;

  let useWeekdayFilter = false;
  let useMonthDayFilter = false;
  let daysOfWeek = adv?.daysOfWeek && adv.daysOfWeek.length > 0 ? [...adv.daysOfWeek] : [];
  let daysOfMonth = adv?.daysOfMonth && adv.daysOfMonth.length > 0 ? [...adv.daysOfMonth] : [];

  // Normalize default execution times
  const rawDefaults = (adv?.timesOfDay && adv.timesOfDay.length > 0)
    ? adv.timesOfDay
    : (adv?.defaultTimes && adv.defaultTimes.length > 0)
    ? adv.defaultTimes
    : [adv?.unifiedTime || adv?.timeOfMonth || rule.startTime || '09:00'];
  const timesOfDay = normalizeTimesList(rawDefaults);
  if (timesOfDay.length === 0) {
    timesOfDay.push('09:00');
  }

  // Normalize weekday overrides
  const weekdayTimes: Record<number, string[]> = {};
  if (adv?.weekdayTimes) {
    for (const [k, v] of Object.entries(adv.weekdayTimes)) {
      const dayNum = Number(k);
      const normList = normalizeTimesList(v);
      if (!isNaN(dayNum) && normList.length > 0) {
        weekdayTimes[dayNum] = normList;
      }
    }
  } else if (adv?.customDayTimes) {
    // Migrate legacy customDayTimes: Record<number, string>
    for (const [k, v] of Object.entries(adv.customDayTimes)) {
      const dayNum = Number(k);
      const normList = normalizeTimesList([v]);
      if (!isNaN(dayNum) && normList.length > 0) {
        weekdayTimes[dayNum] = normList;
      }
    }
  }

  // Normalize month day overrides
  const monthDayTimes: Record<number, string[]> = {};
  if (adv?.monthDayTimes) {
    for (const [k, v] of Object.entries(adv.monthDayTimes)) {
      const dayNum = Number(k);
      const normList = normalizeTimesList(v);
      if (!isNaN(dayNum) && normList.length > 0) {
        monthDayTimes[dayNum] = normList;
      }
    }
  }

  const hasOverrides = Object.keys(weekdayTimes).length > 0 || Object.keys(monthDayTimes).length > 0;
  const hasCustomTimes = Boolean(adv?.hasCustomTimes ?? hasOverrides);

  if (adv?.isAdvanced) {
    if (typeof adv.useWeekdayFilter === 'boolean' && typeof adv.useMonthDayFilter === 'boolean') {
      useWeekdayFilter = adv.useWeekdayFilter;
      useMonthDayFilter = adv.useMonthDayFilter;
    } else if (adv.scheduleType === 'weekly_days') {
      useWeekdayFilter = true;
      useMonthDayFilter = false;
      if (daysOfWeek.length === 0) {
        const [y, m, d] = (rule.startDate || '').split('-').map(Number);
        const startDay = !isNaN(y) ? new Date(y, m - 1, d).getDay() : 1;
        daysOfWeek = [startDay];
      }
    } else if (adv.scheduleType === 'monthly_days') {
      useWeekdayFilter = false;
      useMonthDayFilter = true;
      if (daysOfMonth.length === 0) {
        const [y, m, d] = (rule.startDate || '').split('-').map(Number);
        daysOfMonth = [!isNaN(d) && d > 0 ? d : 1];
      }
    } else if (adv.scheduleType === 'multiple_times_daily') {
      useWeekdayFilter = false;
      useMonthDayFilter = false;
    } else if (adv.scheduleType === 'advanced') {
      useWeekdayFilter = Boolean(adv.useWeekdayFilter);
      useMonthDayFilter = Boolean(adv.useMonthDayFilter);
    } else {
      console.warn('[Recurring Migration] Unrecognized rule scheduleType, defaulting to standard matching:', adv.scheduleType, rule);
      useWeekdayFilter = Boolean(daysOfWeek.length > 0);
      useMonthDayFilter = Boolean(daysOfMonth.length > 0);
    }
  }

  const rawInterval = adv?.intervalWeeks;
  const intervalWeeks = (typeof rawInterval === 'number' && rawInterval >= 1 && rawInterval <= 12)
    ? Math.round(rawInterval)
    : 1;

  const updatedAdv: AdvancedScheduleConfig = {
    ...adv,
    isAdvanced: Boolean(adv?.isAdvanced),
    scheduleType: 'advanced',
    useWeekdayFilter,
    daysOfWeek: useWeekdayFilter ? daysOfWeek : undefined,
    intervalWeeks,
    useMonthDayFilter,
    daysOfMonth: useMonthDayFilter ? daysOfMonth : undefined,
    timesOfDay,
    defaultTimes: timesOfDay,
    unifiedTime: timesOfDay[0] || '09:00',
    hasCustomTimes,
    weekdayTimes: hasCustomTimes && Object.keys(weekdayTimes).length > 0 ? weekdayTimes : undefined,
    monthDayTimes: hasCustomTimes && Object.keys(monthDayTimes).length > 0 ? monthDayTimes : undefined,
  };

  const unifiedWatermark = Math.max(rule.lastRun || 0, rule.lastProcessed || 0);

  return {
    ...rule,
    lastRun: unifiedWatermark > 0 ? unifiedWatermark : rule.lastRun,
    lastProcessed: unifiedWatermark > 0 ? unifiedWatermark : rule.lastProcessed,
    useWeekdayFilter,
    useMonthDayFilter,
    advancedSchedule: updatedAdv,
  };
}

/**
 * Builds a deterministic, DST-safe occurrence key from ruleId and local wall-clock date/time.
 */
export function buildOccurrenceKey(ruleId: string, dateStr: string, timeStr?: string): string {
  const normTime = normalizeHHMM(timeStr || '09:00');
  return `occ_${ruleId}_${dateStr}_${normTime}`;
}

/**
 * Builds a date-only fallback occurrence key for legacy items where time was omitted or varied.
 */
export function buildDateOnlyOccurrenceKey(ruleId: string, dateStr: string): string {
  return `occ_date_${ruleId}_${dateStr}`;
}

/**
 * Parses a YYYY-MM-DD date and HH:mm time in the device's local wall-clock timezone (never UTC midnight).
 */
export function parseLocalScheduledTimestampMs(dateStr: string, timeStr?: string): number {
  const [y, m, d] = (dateStr || formatDateToYYYYMMDD(new Date())).split('-').map(Number);
  const normTime = normalizeHHMM(timeStr || '09:00');
  const [hh, mm] = normTime.split(':').map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return Date.now();
  return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0).getTime();
}

/**
 * Derives all deterministic IDs and occurrenceKeys associated with a transaction
 * (including legacy random-ID items that have `recurringRuleId` + local `date`/`time`).
 */
export function deriveTransactionOccurrenceKeys(tx: Transaction | null | undefined): string[] {
  if (!tx) return [];
  const keys = new Set<string>();
  if (tx.id) keys.add(tx.id);
  if (tx.occurrenceKey) keys.add(tx.occurrenceKey);

  let ruleId = tx.recurringRuleId;
  if (!ruleId && tx.id && tx.id.startsWith('rec_')) {
    const match = tx.id.match(/^rec_(.+)_(\d{10,15})$/);
    if (match) {
      ruleId = match[1];
      const tsMs = Number(match[2]);
      if (!isNaN(tsMs) && tsMs > 0) {
        const dt = new Date(tsMs);
        const dStr = formatDateToYYYYMMDD(dt);
        const tStr = formatTimeToHHMM(dt);
        keys.add(buildOccurrenceKey(ruleId, dStr, tStr));
        keys.add(buildDateOnlyOccurrenceKey(ruleId, dStr));
      }
    }
  }

  if (ruleId && tx.date) {
    const normTime = normalizeHHMM(tx.time || '09:00');
    keys.add(buildOccurrenceKey(ruleId, tx.date, normTime));
    keys.add(buildDateOnlyOccurrenceKey(ruleId, tx.date));
    const localMs = parseLocalScheduledTimestampMs(tx.date, normTime);
    keys.add(`rec_${ruleId}_${localMs}`);
  }

  return Array.from(keys);
}

/**
 * Checks whether a transaction or any of its derived recurring occurrence keys is tombstoned.
 */
export function isTransactionTombstoned(
  tx: Transaction | null | undefined,
  tombstonesOrSet: Record<string, { deletedAt?: number }> | Set<string>,
  minDeletedAfterMs: number = 0
): boolean {
  if (!tx) return false;
  const candidateKeys = deriveTransactionOccurrenceKeys(tx);
  if (tx.feeOfTransferId) {
    candidateKeys.push(tx.feeOfTransferId);
  }

  if (tombstonesOrSet instanceof Set) {
    return candidateKeys.some((k) => tombstonesOrSet.has(k));
  }

  for (const key of candidateKeys) {
    const entry = tombstonesOrSet[key];
    if (entry) {
      if (minDeletedAfterMs <= 0 || Number(entry.deletedAt || 0) > minDeletedAfterMs) {
        return true;
      }
    }
  }
  return false;
}

export function loadRecurringTransactions(): RecurringTransaction[] {
  try {
    const raw = localStorage.getItem(RECURRING_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(migrateRecurringRule);
  } catch {
    return [];
  }
}

export function saveRecurringTransactions(items: RecurringTransaction[]): void {
  try {
    const migrated = items.map(migrateRecurringRule);
    localStorage.setItem(RECURRING_STORAGE_KEY, JSON.stringify(migrated));
  } catch (err) {
    console.error('Failed to save recurring transactions:', err);
  }
}

/**
 * Backward-compatible helper to advance a date string by a frequency.
 * Computes calendar date addition so Daylight Saving changes cannot shift times.
 */
export function calculateNextDueDate(currentDateStr: string, frequency: RecurringFrequency): string {
  const parts = currentDateStr.split('-').map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);

  switch (frequency) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'biweekly':
      date.setDate(date.getDate() + 14);
      break;
    case 'monthly': {
      const origDay = parts[2];
      const nextMonth = date.getMonth() + 1;
      date.setDate(1);
      date.setMonth(nextMonth);
      const maxDaysInNext = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      date.setDate(Math.min(origDay, maxDaysInNext));
      break;
    }
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface ScheduleSummaryParams {
  frequency: RecurringFrequency;
  startDate?: string;
  isAdvanced?: boolean;
  useWeekdayFilter?: boolean;
  daysOfWeek?: number[];
  intervalWeeks?: number;
  useMonthDayFilter?: boolean;
  daysOfMonth?: number[];
  timesOfDay?: string[];
  startTime?: string;
  hasCustomTimes?: boolean;
  weekdayTimes?: Record<number, string[]>;
  monthDayTimes?: Record<number, string[]>;
}

/**
 * Returns a live human-readable summary banner of the active schedule.
 * Example outputs:
 * - "Every Monday and Friday, only on days 1-7, at 09:00"
 * - "كل يوم إثنين وجمعة، فقط في الأيام 1-7، عند الساعة 09:00"
 * Strictly follows the current app language only.
 */
export function getScheduleSummaryText(
  input: ScheduleSummaryParams | RecurringTransaction,
  lang: 'en' | 'ar'
): string {
  const isAr = lang === 'ar';
  const adv = (input as RecurringTransaction).advancedSchedule;
  const isAdvanced = Boolean(
    (input as ScheduleSummaryParams).isAdvanced ?? adv?.isAdvanced
  );
  const frequency = input.frequency || 'monthly';
  const startDate = input.startDate || formatDateToYYYYMMDD(new Date());

  const useWeekdayFilter = Boolean(
    (input as ScheduleSummaryParams).useWeekdayFilter ??
    adv?.useWeekdayFilter ??
    (adv?.scheduleType === 'weekly_days')
  );
  const daysOfWeek = (input as ScheduleSummaryParams).daysOfWeek ?? adv?.daysOfWeek ?? [];

  const useMonthDayFilter = Boolean(
    (input as ScheduleSummaryParams).useMonthDayFilter ??
    adv?.useMonthDayFilter ??
    (adv?.scheduleType === 'monthly_days')
  );
  const daysOfMonth = (input as ScheduleSummaryParams).daysOfMonth ?? adv?.daysOfMonth ?? [];

  const rawTimes = (input as ScheduleSummaryParams).timesOfDay ?? adv?.timesOfDay ?? adv?.defaultTimes;
  const times: string[] = (rawTimes && rawTimes.length > 0)
    ? normalizeTimesList(rawTimes)
    : normalizeTimesList([(input as ScheduleSummaryParams).startTime || (input as RecurringTransaction).startTime || '09:00']);

  const formattedTimesStr = isAr
    ? ('عند الساعة ' + times.join(' و '))
    : ('at ' + (times.length > 1 ? times.slice(0, -1).join(', ') + ' and ' + times[times.length - 1] : times[0]));

  const [sy, sm, sd] = startDate.split('-').map(Number);
  const startDayIdx = !isNaN(sy) ? new Date(sy, sm - 1, sd).getDay() : 1;
  const startDayName = isAr ? WEEKDAY_NAMES_AR[startDayIdx] : WEEKDAY_NAMES_EN[startDayIdx];

  // Overrides summary if custom times enabled
  const hasCustomTimes = Boolean(
    (input as ScheduleSummaryParams).hasCustomTimes ?? adv?.hasCustomTimes
  );
  const weekdayTimes = (input as ScheduleSummaryParams).weekdayTimes ?? adv?.weekdayTimes;
  const monthDayTimes = (input as ScheduleSummaryParams).monthDayTimes ?? adv?.monthDayTimes;

  let overridesSummary = '';
  if (isAdvanced && hasCustomTimes) {
    const overrideParts: string[] = [];
    if (weekdayTimes) {
      for (const [dStr, tList] of Object.entries(weekdayTimes)) {
        const dNum = Number(dStr);
        if (!isNaN(dNum) && Array.isArray(tList) && tList.length > 0) {
          const dayName = isAr ? WEEKDAY_NAMES_AR[dNum] : WEEKDAY_NAMES_EN[dNum];
          overrideParts.push(`${dayName}: ${tList.join(', ')}`);
        }
      }
    }
    if (monthDayTimes) {
      for (const [dStr, tList] of Object.entries(monthDayTimes)) {
        const dNum = Number(dStr);
        if (!isNaN(dNum) && Array.isArray(tList) && tList.length > 0) {
          const dayLabel = isAr ? `يوم ${dNum}` : `Day ${dNum}`;
          overrideParts.push(`${dayLabel}: ${tList.join(', ')}`);
        }
      }
    }
    if (overrideParts.length > 0) {
      overridesSummary = isAr
        ? ` (تخصيص: ${overrideParts.join('؛ ')})`
        : ` (Overrides: ${overrideParts.join('; ')})`;
    }
  }

  if (!isAdvanced) {
    if (frequency === 'daily') {
      return isAr ? `يومياً ${formattedTimesStr}` : `Daily ${formattedTimesStr}`;
    }
    if (frequency === 'weekly') {
      return isAr
        ? `أسبوعياً كل يوم ${startDayName} ${formattedTimesStr}`
        : `Weekly on ${startDayName} ${formattedTimesStr}`;
    }
    if (frequency === 'biweekly') {
      return isAr
        ? `كل أسبوعين كل يوم ${startDayName} ${formattedTimesStr}`
        : `Every 2 weeks on ${startDayName} ${formattedTimesStr}`;
    }
    if (frequency === 'monthly') {
      const dayNum = !isNaN(sd) && sd > 0 ? sd : 1;
      return isAr
        ? `شهرياً في يوم ${dayNum} ${formattedTimesStr}`
        : `Monthly on day ${dayNum} ${formattedTimesStr}`;
    }
    if (frequency === 'yearly') {
      const monthIdx = !isNaN(sm) && sm >= 1 && sm <= 12 ? sm - 1 : 0;
      const mName = isAr ? MONTH_NAMES_AR[monthIdx] : MONTH_NAMES_EN[monthIdx];
      const dayNum = !isNaN(sd) && sd > 0 ? sd : 1;
      return isAr
        ? `سنوياً في ${dayNum} ${mName} ${formattedTimesStr}`
        : `Yearly on ${mName} ${dayNum} ${formattedTimesStr}`;
    }
  }

  // Advanced Schedule Summary (ignores simple frequency preset)
  const intervalWeeks = Math.max(1, Math.min(12,
    (input as ScheduleSummaryParams).intervalWeeks ?? adv?.intervalWeeks ?? 1
  ));

  let prefix = '';
  if (intervalWeeks === 2) {
    prefix = isAr ? 'كل أسبوعين' : 'Every 2 weeks';
  } else if (intervalWeeks > 2) {
    prefix = isAr ? `كل ${intervalWeeks} أسابيع` : `Every ${intervalWeeks} weeks`;
  }

  let weekdaysStr = '';
  if (useWeekdayFilter && daysOfWeek && daysOfWeek.length > 0) {
    const sortedDays = [...new Set(daysOfWeek)].sort((a, b) => a - b);
    if (sortedDays.length === 7) {
      weekdaysStr = isAr ? 'في جميع أيام الأسبوع' : 'on all weekdays';
    } else {
      const dayNames = sortedDays.map((d) => (isAr ? WEEKDAY_NAMES_AR[d] : WEEKDAY_NAMES_EN[d]));
      if (isAr) {
        weekdaysStr = prefix
          ? `في أيام ${dayNames.join(' و ')}`
          : `كل يوم ${dayNames.join(' و ')}`;
      } else {
        const joinedEn = dayNames.length > 1
          ? dayNames.slice(0, -1).join(', ') + ' and ' + dayNames[dayNames.length - 1]
          : dayNames[0];
        weekdaysStr = prefix ? `on ${joinedEn}` : `Every ${joinedEn}`;
      }
    }
  } else {
    if (prefix) {
      weekdaysStr = prefix;
    } else {
      weekdaysStr = isAr ? 'يومياً' : 'Every day';
    }
  }

  let monthDaysStr = '';
  if (useMonthDayFilter && daysOfMonth && daysOfMonth.length > 0) {
    const sortedDays = [...new Set(daysOfMonth)].sort((a, b) => a - b);
    if (sortedDays.length === 31) {
      monthDaysStr = isAr ? '، في جميع أيام الشهر' : ', on all days of the month';
    } else {
      const ranges = formatDayRanges(sortedDays);
      monthDaysStr = isAr ? `، فقط في الأيام ${ranges}` : `, only on days ${ranges}`;
    }
  }

  let baseStr = '';
  if (prefix && useWeekdayFilter) {
    baseStr = `${prefix} ${weekdaysStr}${monthDaysStr}, ${formattedTimesStr}${overridesSummary}`;
  } else {
    baseStr = `${weekdaysStr}${monthDaysStr}, ${formattedTimesStr}${overridesSummary}`;
  }

  if (isAr) {
    return baseStr.replace(/, /g, '، ');
  }
  return baseStr;
}

/**
 * Checks if a specific calendar date satisfies all active filters and frequency intervals of a rule.
 */
export function doesDateMatchRule(
  candDate: Date,
  rule: RecurringTransaction,
  startCalDate: Date,
  startSunday: Date
): boolean {
  const adv = rule.advancedSchedule;
  const isAdv = Boolean(adv?.isAdvanced);
  const freq = rule.frequency || 'monthly';
  const candYear = candDate.getFullYear();
  const candMonth = candDate.getMonth();
  const candDateNum = candDate.getDate();
  const candDayOfWeek = candDate.getDay();

  // Rule cannot execute before its startDate
  if (candDate.getTime() < startCalDate.getTime()) {
    return false;
  }

  if (!isAdv) {
    if (freq === 'daily') {
      return true;
    }
    if (freq === 'weekly') {
      const diffDays = Math.round((candDate.getTime() - startCalDate.getTime()) / 86400000);
      return diffDays >= 0 && diffDays % 7 === 0;
    }
    if (freq === 'biweekly') {
      const diffDays = Math.round((candDate.getTime() - startCalDate.getTime()) / 86400000);
      return diffDays >= 0 && diffDays % 14 === 0;
    }
    if (freq === 'monthly') {
      const maxDaysInM = new Date(candYear, candMonth + 1, 0).getDate();
      const targetDay = Math.min(startCalDate.getDate(), maxDaysInM);
      return candDateNum === targetDay;
    }
    if (freq === 'yearly') {
      if (candMonth !== startCalDate.getMonth()) return false;
      const maxDaysInM = new Date(candYear, candMonth + 1, 0).getDate();
      const targetDay = Math.min(startCalDate.getDate(), maxDaysInM);
      return candDateNum === targetDay;
    }
    return true;
  }

  // Advanced Schedule Evaluation (ignores simple frequency preset)
  // 1. Every N weeks check (anchored to start week)
  const intervalWeeks = Math.max(1, Math.min(12, adv?.intervalWeeks || 1));
  if (intervalWeeks > 1) {
    const candSunday = new Date(candYear, candMonth, candDateNum - candDayOfWeek, 0, 0, 0, 0);
    const diffWeeks = Math.round((candSunday.getTime() - startSunday.getTime()) / (7 * 86400000));
    if (diffWeeks < 0 || diffWeeks % intervalWeeks !== 0) {
      return false; // Not in the active Nth week
    }
  }

  // 2. Weekday filter
  const useWeekdayFilter = Boolean(
    rule.useWeekdayFilter ??
    adv?.useWeekdayFilter ??
    (adv?.scheduleType === 'weekly_days')
  );
  if (useWeekdayFilter) {
    const allowedWeekdays = adv?.daysOfWeek && adv.daysOfWeek.length > 0
      ? new Set(adv.daysOfWeek)
      : new Set<number>();
    if (!allowedWeekdays.has(candDayOfWeek)) {
      return false;
    }
  }

  // 3. Month days filter
  const useMonthDayFilter = Boolean(
    rule.useMonthDayFilter ??
    adv?.useMonthDayFilter ??
    (adv?.scheduleType === 'monthly_days')
  );
  if (useMonthDayFilter) {
    const allowedMonthDays = adv?.daysOfMonth && adv.daysOfMonth.length > 0
      ? new Set(adv.daysOfMonth)
      : new Set<number>();
    const maxDaysInM = new Date(candYear, candMonth + 1, 0).getDate();
    let matches = allowedMonthDays.has(candDateNum);

    // Short month fallback: days 29/30/31 fall back to last day of that month and last day matches
    if (!matches && candDateNum === maxDaysInM) {
      if (maxDaysInM === 28 && (allowedMonthDays.has(29) || allowedMonthDays.has(30) || allowedMonthDays.has(31))) {
        matches = true;
      } else if (maxDaysInM === 29 && (allowedMonthDays.has(30) || allowedMonthDays.has(31))) {
        matches = true;
      } else if (maxDaysInM === 30 && allowedMonthDays.has(31)) {
        matches = true;
      }
    }

    if (!matches) {
      return false;
    }
  }

  return true;
}

/**
 * Resolves the execution times for a given candidate date using strict precedence:
 * 1. Matching month-day override wins (highest precedence)
 * 2. Matching weekday override wins (second precedence)
 * 3. Default Time(s) fallback
 * On an overridden day, the rule runs ONLY at the override times and ignores the default times.
 * Always returns a normalized, sorted, unique list of "HH:MM" strings.
 */
export function getExecutionTimesForDate(
  rawRule: RecurringTransaction,
  candDate: Date
): string[] {
  const rule = migrateRecurringRule(rawRule);
  const adv = rule.advancedSchedule;
  const isAdv = Boolean(adv?.isAdvanced);

  // Default times fallback
  const rawDefaults = (isAdv && adv?.timesOfDay && adv.timesOfDay.length > 0)
    ? adv.timesOfDay
    : (adv?.defaultTimes && adv.defaultTimes.length > 0)
    ? adv.defaultTimes
    : (adv?.unifiedTime ? [adv.unifiedTime] : (rule.startTime ? [rule.startTime] : ['09:00']));

  const defaultTimes = normalizeTimesList(rawDefaults);
  const safeDefaults = defaultTimes.length > 0 ? defaultTimes : ['09:00'];

  if (!isAdv || adv?.hasCustomTimes === false) {
    return safeDefaults;
  }

  const candYear = candDate.getFullYear();
  const candMonth = candDate.getMonth();
  const candDateNum = candDate.getDate();
  const candDayOfWeek = candDate.getDay();

  // 1. Month-Day Override Check (Highest Precedence)
  if (adv?.monthDayTimes) {
    let rawMonthTimes = adv.monthDayTimes[candDateNum];
    if (!rawMonthTimes || rawMonthTimes.length === 0) {
      const maxDaysInM = new Date(candYear, candMonth + 1, 0).getDate();
      if (candDateNum === maxDaysInM) {
        if (maxDaysInM === 28) {
          rawMonthTimes = adv.monthDayTimes[31] || adv.monthDayTimes[30] || adv.monthDayTimes[29];
        } else if (maxDaysInM === 29) {
          rawMonthTimes = adv.monthDayTimes[31] || adv.monthDayTimes[30];
        } else if (maxDaysInM === 30) {
          rawMonthTimes = adv.monthDayTimes[31];
        }
      }
    }
    const normMonthTimes = normalizeTimesList(rawMonthTimes);
    if (normMonthTimes.length > 0) {
      return normMonthTimes;
    }
  }

  // 2. Weekday Override Check (Second Precedence)
  if (adv?.weekdayTimes) {
    const rawWkTimes = adv.weekdayTimes[candDayOfWeek];
    const normWkTimes = normalizeTimesList(rawWkTimes);
    if (normWkTimes.length > 0) {
      return normWkTimes;
    }
  }
  if (adv?.customDayTimes) {
    const legTime = adv.customDayTimes[candDayOfWeek];
    if (legTime) {
      const normLeg = normalizeTimesList([legTime]);
      if (normLeg.length > 0) {
        return normLeg;
      }
    }
  }

  // 3. Fallback to Default Time(s)
  return safeDefaults;
}

/**
 * Calculates the exact next scheduled occurrence date and time strictly AFTER `afterDate`.
 * Evaluates both Weekdays and Month days filters simultaneously, DST-safely,
 * with intra-day multiple times and per-day overrides support.
 */
export function getNextScheduledOccurrence(
  rawRule: RecurringTransaction,
  afterDate: Date
): Date {
  const rule = migrateRecurringRule(rawRule);

  const [sy, sm, sd] = (rule.startDate || formatDateToYYYYMMDD(new Date())).split('-').map(Number);
  const startCalDate = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
  const startSunday = new Date(sy, sm - 1, sd - startCalDate.getDay(), 0, 0, 0, 0);

  const curY = afterDate.getFullYear();
  const curM = afterDate.getMonth();
  const curD = afterDate.getDate();
  const baseDay = new Date(curY, curM, curD, 0, 0, 0, 0);

  // Scan up to 730 days ahead (2 full calendar years)
  for (let offset = 0; offset <= 730; offset++) {
    const candDay = new Date(baseDay.getFullYear(), baseDay.getMonth(), baseDay.getDate() + offset, 0, 0, 0, 0);

    if (!doesDateMatchRule(candDay, rule, startCalDate, startSunday)) {
      continue;
    }

    const cY = candDay.getFullYear();
    const cM = candDay.getMonth();
    const cD = candDay.getDate();

    // Get the exact execution times for this candidate date according to precedence:
    // month-day override > weekday override > default times
    const dayTimes = getExecutionTimesForDate(rule, candDay);

    for (const tStr of dayTimes) {
      const [hh, mm] = tStr.split(':').map(Number);
      const candTime = new Date(cY, cM, cD, hh, mm, 0, 0);
      if (candTime.getTime() > afterDate.getTime()) {
        return candTime;
      }
    }
  }

  // Fallback fallback: 30 days from afterDate
  return new Date(afterDate.getTime() + 30 * 86400000);
}

export interface OccurrencePreviewItem {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  timestampMs: number;
  dayName: string;
  formattedDate: string;
  formattedTime: string;
}

/**
 * Computes the next N future occurrences for a recurring rule.
 * Uses the exact same scheduling engine, local time, DST-safe,
 * respecting effectiveFrom, filters, overrides, and Every-N-weeks.
 */
export function getNextNOccurrences(
  rawRule: RecurringTransaction,
  count: number = 5,
  fromTimeMs: number = Date.now(),
  lang: 'en' | 'ar' = 'en'
): OccurrencePreviewItem[] {
  const rule = migrateRecurringRule(rawRule);
  const isAr = lang === 'ar';
  const results: OccurrencePreviewItem[] = [];

  // Validation: if rule has invalid schedule settings, return empty list
  const adv = rule.advancedSchedule;
  if (adv?.isAdvanced) {
    if (adv.useWeekdayFilter && (!adv.daysOfWeek || adv.daysOfWeek.length === 0)) {
      return [];
    }
    if (adv.useMonthDayFilter && (!adv.daysOfMonth || adv.daysOfMonth.length === 0)) {
      return [];
    }
    const times = adv.timesOfDay || adv.defaultTimes || [];
    if (times.length === 0 && !rule.startTime) {
      return [];
    }
  }

  const [sy, sm, sd] = (rule.startDate || formatDateToYYYYMMDD(new Date())).split('-').map(Number);
  const [sh, smin] = (rule.startTime || '09:00').split(':').map(Number);
  const startDt = new Date(sy, sm - 1, sd, sh, smin, 0, 0);

  // Baseline start timestamp
  const basePointer = Math.max(
    fromTimeMs,
    (rule.effectiveFrom ? rule.effectiveFrom - 1 : 0),
    startDt.getTime() - 1
  );

  let curDate = new Date(basePointer);
  let guard = 0;
  const MAX_ITER = 300;

  while (results.length < count && guard < MAX_ITER) {
    const next = getNextScheduledOccurrence(rule, curDate);
    const nextMs = next.getTime();
    if (nextMs <= curDate.getTime()) {
      break;
    }
    if (nextMs >= startDt.getTime() && (!rule.effectiveFrom || nextMs >= rule.effectiveFrom)) {
      const dStr = formatDateToYYYYMMDD(next);
      const tStr = formatTimeToHHMM(next);
      const dayIdx = next.getDay();
      const dayName = isAr ? WEEKDAY_NAMES_AR[dayIdx] : WEEKDAY_NAMES_EN[dayIdx];

      results.push({
        date: dStr,
        time: tStr,
        timestampMs: nextMs,
        dayName,
        formattedDate: dStr,
        formattedTime: formatTime12h(tStr, lang),
      });
    }
    curDate = next;
    guard++;
  }

  return results;
}

export interface ProcessRecurringResult {
  updatedRecurring: RecurringTransaction[];
  newTransactions: Transaction[];
  totalAdded: number;
}

/**
 * Evaluates all recurring rules against current time (nowMs).
 * Generates all missed scheduled occurrences in chronological order with deterministic IDs.
 * Skips items already present in existingTransactions or tombstones.
 * Capped at 366 occurrences per rule per run.
 */
export function checkAndProcessRecurring(
  recurringList: RecurringTransaction[],
  existingTransactions: Transaction[],
  tombstoneIds: Set<string> = new Set(),
  nowMs: number = Date.now()
): ProcessRecurringResult {
  const existingTxIdSet = new Set(existingTransactions.map((t) => t.id));
  const existingOccurrenceKeys = new Set<string>();
  for (const tx of existingTransactions) {
    for (const k of deriveTransactionOccurrenceKeys(tx)) {
      existingOccurrenceKeys.add(k);
    }
  }
  const newTransactions: Transaction[] = [];

  const updatedRecurring = recurringList.map((rec) => {
    // If autoProcess is false, do not execute
    if (!rec.autoProcess) {
      return rec;
    }

    const [y, m, d] = (rec.startDate || formatDateToYYYYMMDD(new Date())).split('-').map(Number);
    const [hh, mm] = normalizeHHMM(rec.startTime || '09:00').split(':').map(Number);
    const startDt = new Date(y, m - 1, d, hh, mm, 0, 0);

    // Determine the baseline watermark timestamp to check (local wall-clock time)
    const savedWatermark = Math.max(rec.lastRun || 0, rec.lastProcessed || 0);
    let lastRunTime = savedWatermark > 0 ? savedWatermark : startDt.getTime() - 1;

    // Anti-Duplicate Catch-up: The catch-up engine must NEVER generate occurrences earlier than effectiveFrom or savedWatermark
    if (rec.effectiveFrom && rec.effectiveFrom > 0) {
      lastRunTime = Math.max(lastRunTime, rec.effectiveFrom - 1);
    }

    let cand = getNextScheduledOccurrence(rec, new Date(lastRunTime));
    let candTime = cand.getTime();
    const occurrences: Array<{ date: string; time: string; timestampMs: number }> = [];
    let loopCount = 0;
    const MAX_CATCHUP = 366; // Capped at 366 occurrences per rule per run

    while (candTime <= nowMs && loopCount < MAX_CATCHUP) {
      if (
        (!rec.effectiveFrom || candTime >= rec.effectiveFrom) &&
        candTime > savedWatermark
      ) {
        occurrences.push({
          date: formatDateToYYYYMMDD(cand),
          time: formatTimeToHHMM(cand),
          timestampMs: candTime,
        });
      }
      loopCount++;
      cand = getNextScheduledOccurrence(rec, cand);
      candTime = cand.getTime();
    }

    if (occurrences.length === 0) {
      // Nothing due right now; update nextRun/nextDueDate if needed
      return {
        ...rec,
        lastRun: savedWatermark > 0 ? savedWatermark : rec.lastRun,
        lastProcessed: savedWatermark > 0 ? savedWatermark : rec.lastProcessed,
        nextRun: candTime,
        nextDueDate: formatDateToYYYYMMDD(cand),
      };
    }

    // Generate transactions for missed occurrences
    for (const occ of occurrences) {
      const detId = `rec_${rec.id}_${occ.timestampMs}`;
      const occKey = buildOccurrenceKey(rec.id, occ.date, occ.time);
      const dateOnlyKey = buildDateOnlyOccurrenceKey(rec.id, occ.date);

      // Skip if already generated locally or tombstoned by user (either by deterministic ID or occurrenceKey)
      if (
        existingTxIdSet.has(detId) ||
        existingOccurrenceKeys.has(detId) ||
        existingOccurrenceKeys.has(occKey) ||
        tombstoneIds.has(detId) ||
        tombstoneIds.has(occKey) ||
        tombstoneIds.has(dateOnlyKey)
      ) {
        continue;
      }

      // 100% full clone: preserves original description, category, accounts, and types
      const generatedTx: Transaction = {
        id: detId,
        occurrenceKey: occKey,
        type: rec.type,
        amount: rec.amount,
        taxAmount: rec.taxAmount,
        date: occ.date,
        time: occ.time,
        accountId: rec.accountId,
        toAccountId: rec.toAccountId,
        categoryId: rec.categoryId,
        categoryName: rec.categoryName,
        categoryIcon: rec.categoryIcon,
        description: rec.description, // PRESERVES ORIGINAL DESCRIPTION, never overwritten with generic text!
        budgetPool: rec.budgetPool,
        isSavingsAllocation: rec.isSavingsAllocation,
        savingsWithdrawalChoice: rec.savingsWithdrawalChoice,
        transferFee: rec.transferFee,
        transferFeeMode: rec.transferFeeMode,
        transferFeeInputType: rec.transferFeeInputType,
        transferFeeRawValue: rec.transferFeeRawValue,
        transferFeeBudgetPool: rec.transferFeeBudgetPool,
        linkedFeeTxId:
          rec.type === 'transfer' && rec.transferFee && rec.transferFee > 0
            ? `tx_fee_${detId}`
            : undefined,
        createdAt: occ.timestampMs,
        updatedAt: nowMs,
        isFromRecurring: true,
        recurringRuleId: rec.id,
      };
      newTransactions.push(generatedTx);
      existingTxIdSet.add(detId);
      existingOccurrenceKeys.add(detId);
      existingOccurrenceKeys.add(occKey);
    }

    const lastOcc = occurrences[occurrences.length - 1];
    const nextWatermark = Math.max(lastOcc.timestampMs, savedWatermark);

    return {
      ...rec,
      lastRun: nextWatermark,
      lastProcessed: nextWatermark,
      nextRun: candTime,
      nextDueDate: formatDateToYYYYMMDD(cand),
      lastProcessedDate: lastOcc.date,
      updatedAt: Date.now(), // Stamped so granular sync pushes this update
    };
  });

  // Sort newly generated transactions in chronological order
  newTransactions.sort((a, b) => a.createdAt - b.createdAt);

  return {
    updatedRecurring,
    newTransactions,
    totalAdded: newTransactions.length,
  };
}
