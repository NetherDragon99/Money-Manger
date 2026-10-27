/**
 * Recurring Transactions Engine
 * Handles recurring rules, DST-safe next scheduled dates/times,
 * deterministic catch-up up to 366 occurrences, and advanced multi-day/time scheduling.
 */

import { RecurringTransaction, RecurringFrequency, Transaction, AdvancedScheduleConfig } from '../types';
import { formatDateToYYYYMMDD, formatTimeToHHMM } from './dateCycle';

const RECURRING_STORAGE_KEY = 'money_manager_recurring_v1';

export function loadRecurringTransactions(): RecurringTransaction[] {
  try {
    const raw = localStorage.getItem(RECURRING_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveRecurringTransactions(items: RecurringTransaction[]): void {
  try {
    localStorage.setItem(RECURRING_STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('Failed to save recurring transactions:', err);
  }
}

/**
 * Backward-compatible helper to advance a date string by a frequency.
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

/**
 * Calculates the exact next scheduled occurrence date and time strictly AFTER `afterDate`.
 * Computes DST-safe local times and handles short months (clamping 31/30 to the last day of the month).
 */
export function getNextScheduledOccurrence(
  rule: RecurringTransaction,
  afterDate: Date
): Date {
  const adv = rule.advancedSchedule;

  // 1. Advanced Schedule: Multiple Times Daily
  if (adv?.isAdvanced && adv.scheduleType === 'multiple_times_daily' && adv.timesOfDay && adv.timesOfDay.length > 0) {
    const sortedTimes = [...adv.timesOfDay].sort();
    const currentY = afterDate.getFullYear();
    const currentM = afterDate.getMonth();
    const currentD = afterDate.getDate();

    // Check if there is another time today after afterDate
    for (const tStr of sortedTimes) {
      const [hh, mm] = tStr.split(':').map(Number);
      const cand = new Date(currentY, currentM, currentD, hh, mm, 0, 0);
      if (cand.getTime() > afterDate.getTime()) {
        return cand;
      }
    }

    // Otherwise next day at earliest time
    const [firstH, firstM] = sortedTimes[0].split(':').map(Number);
    return new Date(currentY, currentM, currentD + 1, firstH, firstM, 0, 0);
  }

  // 2. Advanced Schedule: Weekly Days (0 = Sun, 6 = Sat)
  if (adv?.isAdvanced && adv.scheduleType === 'weekly_days' && adv.daysOfWeek && adv.daysOfWeek.length > 0) {
    const selectedDays = new Set(adv.daysOfWeek);
    const unifiedTime = adv.unifiedTime || rule.startTime || '09:00';

    for (let offset = 0; offset <= 14; offset++) {
      const cand = new Date(afterDate.getFullYear(), afterDate.getMonth(), afterDate.getDate() + offset);
      const dayOfWeek = cand.getDay();
      if (selectedDays.has(dayOfWeek)) {
        const timeStr = adv.customDayTimes?.[dayOfWeek] || unifiedTime;
        const [hh, mm] = timeStr.split(':').map(Number);
        cand.setHours(hh, mm, 0, 0);
        if (cand.getTime() > afterDate.getTime()) {
          return cand;
        }
      }
    }
  }

  // 3. Advanced Schedule: Monthly Days (1..31)
  if (adv?.isAdvanced && adv.scheduleType === 'monthly_days' && adv.daysOfMonth && adv.daysOfMonth.length > 0) {
    const targetDays = [...adv.daysOfMonth].sort((a, b) => a - b);
    const timeStr = adv.timeOfMonth || rule.startTime || '09:00';
    const [hh, mm] = timeStr.split(':').map(Number);

    for (let mOffset = 0; mOffset <= 4; mOffset++) {
      const baseMonth = new Date(afterDate.getFullYear(), afterDate.getMonth() + mOffset, 1);
      const Y = baseMonth.getFullYear();
      const M = baseMonth.getMonth();
      const maxDays = new Date(Y, M + 1, 0).getDate(); // days in this month

      for (const tDay of targetDays) {
        // Clamp to last day of short month (e.g. 31 becomes 28/29 in Feb, 30 in Apr)
        const actualDay = Math.min(tDay, maxDays);
        const cand = new Date(Y, M, actualDay, hh, mm, 0, 0);
        if (cand.getTime() > afterDate.getTime()) {
          return cand;
        }
      }
    }
  }

  // 4. Standard 1-Tap Presets (Daily, Weekly, Bi-Weekly, Monthly, Yearly)
  const ruleTime = rule.startTime || '09:00';
  const [defH, defM] = ruleTime.split(':').map(Number);
  const next = new Date(afterDate);

  switch (rule.frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      next.setHours(defH, defM, 0, 0);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      next.setHours(defH, defM, 0, 0);
      break;
    case 'biweekly':
      next.setDate(next.getDate() + 14);
      next.setHours(defH, defM, 0, 0);
      break;
    case 'monthly': {
      const origDay = afterDate.getDate();
      const nextMonth = next.getMonth() + 1;
      next.setDate(1);
      next.setMonth(nextMonth);
      const maxDaysInNext = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(origDay, maxDaysInNext));
      next.setHours(defH, defM, 0, 0);
      break;
    }
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      next.setHours(defH, defM, 0, 0);
      break;
  }

  return next;
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
  const newTransactions: Transaction[] = [];

  const updatedRecurring = recurringList.map((rec) => {
    // If autoProcess is false, do not execute
    if (!rec.autoProcess) {
      return rec;
    }

    // Determine the baseline starting timestamp to check
    let lastRunTime: number;
    if (rec.lastRun && rec.lastRun > 0) {
      lastRunTime = rec.lastRun;
    } else {
      // Rule has never run: first scheduled occurrence starts at startDate + startTime
      const [y, m, d] = (rec.startDate || formatDateToYYYYMMDD(new Date())).split('-').map(Number);
      const [hh, mm] = (rec.startTime || '09:00').split(':').map(Number);
      const startDt = new Date(y, m - 1, d, hh, mm, 0, 0);
      // Minus 1 millisecond so that startDt itself is considered due if startDt <= nowMs
      lastRunTime = startDt.getTime() - 1;
    }

    let cand = getNextScheduledOccurrence(rec, new Date(lastRunTime));
    let candTime = cand.getTime();
    const occurrences: Array<{ date: string; time: string; timestampMs: number }> = [];
    let loopCount = 0;
    const MAX_CATCHUP = 366; // Capped at 366 occurrences per rule per run

    while (candTime <= nowMs && loopCount < MAX_CATCHUP) {
      occurrences.push({
        date: formatDateToYYYYMMDD(cand),
        time: formatTimeToHHMM(cand),
        timestampMs: candTime,
      });
      loopCount++;
      cand = getNextScheduledOccurrence(rec, cand);
      candTime = cand.getTime();
    }

    if (occurrences.length === 0) {
      // Nothing due right now; update nextRun/nextDueDate if needed
      return {
        ...rec,
        nextRun: candTime,
        nextDueDate: formatDateToYYYYMMDD(cand),
      };
    }

    // Generate transactions for missed occurrences
    for (const occ of occurrences) {
      const detId = `rec_${rec.id}_${occ.timestampMs}`;

      // Skip if already generated locally or tombstoned by user
      if (existingTxIdSet.has(detId) || tombstoneIds.has(detId)) {
        continue;
      }

      // 100% full clone: preserves original description, category, accounts, and types
      newTransactions.push({
        id: detId,
        type: rec.type,
        amount: rec.amount,
        date: occ.date,
        time: occ.time,
        accountId: rec.accountId,
        toAccountId: rec.toAccountId,
        categoryId: rec.categoryId,
        categoryName: rec.categoryName,
        categoryIcon: rec.categoryIcon,
        description: rec.description, // PRESERVES ORIGINAL DESCRIPTION, never overwritten with generic text!
        createdAt: occ.timestampMs,
        isFromRecurring: true,
        recurringRuleId: rec.id,
      });
      existingTxIdSet.add(detId);
    }

    const lastOcc = occurrences[occurrences.length - 1];

    return {
      ...rec,
      lastRun: lastOcc.timestampMs,
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
