import { WeekStartDay, PeriodFilterType, DateRange, Transaction, AdvancedFilter, Account, Category } from '../types';
import { getLocalizedCurrencySymbol } from './currencies';
import { matchesTransactionSearch } from './searchUtils';

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
  const targetDay = Math.min(Math.max(1, Math.floor(startDay || 1)), 31);

  // Apply offset in months safely without 29-31 day overflow
  let adjustedRef = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 0, 0, 0, 0);
  if (monthOffset !== 0) {
    const shiftedFirst = new Date(refDate.getFullYear(), refDate.getMonth() + monthOffset, 1, 0, 0, 0, 0);
    const maxShiftedDays = getDaysInMonth(shiftedFirst.getFullYear(), shiftedFirst.getMonth());
    adjustedRef = new Date(
      shiftedFirst.getFullYear(),
      shiftedFirst.getMonth(),
      Math.min(refDate.getDate(), maxShiftedDays),
      0,
      0,
      0,
      0
    );
  }

  const year = adjustedRef.getFullYear();
  const month = adjustedRef.getMonth();
  const day = adjustedRef.getDate();

  if (targetDay === 1) {
    // Standard calendar month
    const maxDays = getDaysInMonth(year, month);
    return {
      startDate: `${year}-${padZero(month + 1)}-01`,
      endDate: `${year}-${padZero(month + 1)}-${padZero(maxDays)}`,
      label: adjustedRef.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    };
  }

  const maxThisMonthDays = getDaysInMonth(year, month);
  const thisMonthStartDay = Math.min(targetDay, maxThisMonthDays);

  let startYear = year;
  let startMonth = month;
  let nextYear = year;
  let nextMonth = month;

  if (day >= thisMonthStartDay) {
    // Current cycle starts in this month and next cycle starts in next month
    startYear = year;
    startMonth = month;
    const nextDate = new Date(year, month + 1, 1, 0, 0, 0, 0);
    nextYear = nextDate.getFullYear();
    nextMonth = nextDate.getMonth();
  } else {
    // Current cycle started in previous month and next cycle starts in this month
    const prevDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
    startYear = prevDate.getFullYear();
    startMonth = prevDate.getMonth();
    nextYear = year;
    nextMonth = month;
  }

  const maxStartDays = getDaysInMonth(startYear, startMonth);
  const actualStartDay = Math.min(targetDay, maxStartDays);

  const maxNextDays = getDaysInMonth(nextYear, nextMonth);
  const actualNextStartDay = Math.min(targetDay, maxNextDays);
  const cycleEnd = new Date(nextYear, nextMonth, actualNextStartDay - 1, 0, 0, 0, 0);

  const startStr = `${startYear}-${padZero(startMonth + 1)}-${padZero(actualStartDay)}`;
  const endStr = `${cycleEnd.getFullYear()}-${padZero(cycleEnd.getMonth() + 1)}-${padZero(cycleEnd.getDate())}`;

  return {
    startDate: startStr,
    endDate: endStr,
    label: `${new Date(startYear, startMonth, 1).toLocaleDateString('en-US', { month: 'short' })} - ${new Date(cycleEnd.getFullYear(), cycleEnd.getMonth(), 1).toLocaleDateString('en-US', { month: 'short' })}`,
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
    case 'today': {
      const d = new Date(now);
      d.setDate(d.getDate() + offset);
      const dateStr = formatDateToYYYYMMDD(d);
      return {
        startDate: dateStr,
        endDate: dateStr,
      };
    }
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
    case '3_months': {
      const startCycle = getMonthCycleRange(now, 1, offset * 3 - 2);
      const endCycle = getMonthCycleRange(now, 1, offset * 3);
      return {
        startDate: startCycle.startDate,
        endDate: endCycle.endDate,
      };
    }
    case 'this_year': {
      const targetYear = now.getFullYear() + offset;
      return {
        startDate: `${targetYear}-01-01`,
        endDate: `${targetYear}-12-31`,
      };
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

import { formatNumberWithCommas } from './formatters';
export {
  formatNumberWithCommas,
  formatDisplayNumber,
  parseFormattedNumber,
  cleanNumericString,
  handleNumericInputChange,
  isManualAdjustment,
} from './formatters';

export const DEFAULT_ADVANCED_FILTER: AdvancedFilter = {
  accountIds: [],
  categoryIds: [],
  minAmount: undefined,
  maxAmount: undefined,
  type: 'all',
  searchQuery: undefined,
  budgetPools: [],
  sortBy: 'date_desc',
  recurringFilter: 'all',
  hasNotesOnly: false,
  hasTaxOrFeeOnly: false,
  accountVisibility: 'all',
};

export function countActiveAdvancedFilters(
  filter: AdvancedFilter,
  options?: { hideAccounts?: boolean }
): number {
  const hideAccounts = Boolean(options?.hideAccounts);
  return (
    (hideAccounts ? 0 : filter.accountIds.length) +
    filter.categoryIds.length +
    (filter.budgetPools?.length || 0) +
    (filter.minAmount !== undefined || filter.maxAmount !== undefined ? 1 : 0) +
    (filter.type !== 'all' ? 1 : 0) +
    (filter.searchQuery && filter.searchQuery.trim() !== '' ? 1 : 0) +
    (filter.recurringFilter && filter.recurringFilter !== 'all' ? 1 : 0) +
    (filter.hasNotesOnly ? 1 : 0) +
    (filter.hasTaxOrFeeOnly ? 1 : 0) +
    (!hideAccounts && filter.accountVisibility && filter.accountVisibility !== 'all' ? 1 : 0) +
    (filter.sortBy && filter.sortBy !== 'date_desc' ? 1 : 0)
  );
}

export interface FilterExecutionContext {
  accounts?: Account[];
  accountsById?: Map<string, Account>;
  categories?: Category[];
  currencySymbol?: string;
  searchQuery?: string;
  resolveBudgetPool?: (tx: Transaction) => string | null;
}

export function getEffectiveTransactionAmount(tx: Transaction): number {
  const tax = typeof tx.taxAmount === 'number' && !isNaN(tx.taxAmount) ? Math.max(0, tx.taxAmount) : 0;
  return (tx.amount || 0) + (tx.type === 'expense' || tx.type === 'income' ? tax : 0);
}

/**
 * Applies all advanced transaction filters + sorting consistently for both HomeView and AccountDetailsView.
 */
export function applyAdvancedTransactionFilter(
  transactions: Transaction[],
  filter: AdvancedFilter,
  ctx: FilterExecutionContext = {}
): Transaction[] {
  const accMap =
    ctx.accountsById ||
    new Map((ctx.accounts || []).map((a) => [a.id, a]));
  const combinedQuery = (ctx.searchQuery || filter.searchQuery || '').trim();
  const hasPoolFilter = Boolean(filter.budgetPools && filter.budgetPools.length > 0);
  const poolSet = hasPoolFilter ? new Set(filter.budgetPools) : null;
  const accountSet = filter.accountIds.length > 0 ? new Set(filter.accountIds) : null;
  const categorySet = filter.categoryIds.length > 0 ? new Set(filter.categoryIds) : null;

  const filtered = transactions.filter((tx) => {
    // 1. Type filter
    if (filter.type !== 'all' && tx.type !== filter.type) return false;

    // 2. Account filter
    if (accountSet) {
      const matchesAcc =
        accountSet.has(tx.accountId) || (tx.toAccountId && accountSet.has(tx.toAccountId));
      if (!matchesAcc) return false;
    }

    // 3. Account visibility filter (all / public / private)
    if (filter.accountVisibility && filter.accountVisibility !== 'all') {
      const acc = accMap.get(tx.accountId);
      const toAcc = tx.toAccountId ? accMap.get(tx.toAccountId) : undefined;
      if (filter.accountVisibility === 'public') {
        if (acc?.isPrivate && (!toAcc || toAcc.isPrivate)) return false;
      } else if (filter.accountVisibility === 'private') {
        if (!acc?.isPrivate && !toAcc?.isPrivate) return false;
      }
    }

    // 4. Category filter
    if (categorySet) {
      if (!tx.categoryId || !categorySet.has(tx.categoryId)) return false;
    }

    // 5. Budget pool filter
    if (poolSet && ctx.resolveBudgetPool) {
      const pool = ctx.resolveBudgetPool(tx);
      if (!pool || !poolSet.has(pool as any)) return false;
    }

    // 6. Recurring vs Non-Recurring filter
    if (filter.recurringFilter === 'recurring') {
      if (!tx.isFromRecurring && !tx.recurringRuleId) return false;
    } else if (filter.recurringFilter === 'non_recurring') {
      if (tx.isFromRecurring || tx.recurringRuleId) return false;
    }

    // 7. Notes / Description toggle
    if (filter.hasNotesOnly) {
      const hasNote = Boolean((tx.description && tx.description.trim()) || (tx.note && tx.note.trim()));
      if (!hasNote) return false;
    }

    // 8. Tax / Transfer Fee toggle
    if (filter.hasTaxOrFeeOnly) {
      const hasTaxFee = Boolean(
        (tx.taxAmount && tx.taxAmount > 0) ||
        (tx.transferFee && tx.transferFee > 0) ||
        tx.feeOfTransferId
      );
      if (!hasTaxFee) return false;
    }

    // 9. Amount Min / Max (uses effective displayed amount including tax so slider bounds & filter match 1:1)
    const amt = getEffectiveTransactionAmount(tx);
    if (filter.minAmount !== undefined && amt < filter.minAmount) return false;
    if (filter.maxAmount !== undefined && amt > filter.maxAmount) return false;

    // 10. Search Query
    if (combinedQuery) {
      if (
        !matchesTransactionSearch(tx, combinedQuery, {
          accounts: ctx.accounts,
          categories: ctx.categories,
          currencySymbol: ctx.currencySymbol,
        })
      ) {
        return false;
      }
    }

    return true;
  });

  const sortBy = filter.sortBy || 'date_desc';
  if (sortBy === 'date_asc') {
    return [...filtered].sort(
      (a, b) =>
        (a.date || '').localeCompare(b.date || '') ||
        (a.time || '00:00').localeCompare(b.time || '00:00') ||
        (a.createdAt || 0) - (b.createdAt || 0)
    );
  }
  if (sortBy === 'amount_desc') {
    return [...filtered].sort(
      (a, b) =>
        getEffectiveTransactionAmount(b) - getEffectiveTransactionAmount(a) ||
        (b.date || '').localeCompare(a.date || '')
    );
  }
  if (sortBy === 'amount_asc') {
    return [...filtered].sort(
      (a, b) =>
        getEffectiveTransactionAmount(a) - getEffectiveTransactionAmount(b) ||
        (b.date || '').localeCompare(a.date || '')
    );
  }
  // Default: date_desc (guarantee strict descending chronological sort)
  return [...filtered].sort(
    (a, b) =>
      (b.date || '').localeCompare(a.date || '') ||
      (b.time || '00:00').localeCompare(a.time || '00:00') ||
      (b.createdAt || 0) - (a.createdAt || 0)
  );
}

/**
 * Formats a currency amount ensuring strict minus sign for negative numbers
 * Formats with standard thousands grouping commas (e.g. 10,000 and 1,000,000).
 */
export function formatCurrency(amount: number, symbol = '£', lang?: 'en' | 'ar'): string {
  const isNeg = amount < 0;
  const absVal = Math.abs(isNaN(amount) ? 0 : amount);
  const formattedAbs = formatNumberWithCommas(absVal, 2);
  const localizedSymbol = getLocalizedCurrencySymbol(symbol, lang || 'en');
  // Strictly display -£ X if negative
  if (isNeg) {
    return `-${localizedSymbol} ${formattedAbs}`;
  }
  return `${localizedSymbol} ${formattedAbs}`;
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
