/**
 * Recurring Transactions Engine
 * Handles recurring rules, calculation of next due dates, and auto-processing into transaction ledger.
 */

import { RecurringTransaction, RecurringFrequency, Transaction } from '../types';

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
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface ProcessRecurringResult {
  updatedRecurring: RecurringTransaction[];
  newTransactions: Omit<Transaction, 'id' | 'createdAt'>[];
}

export function checkAndProcessRecurring(
  recurringList: RecurringTransaction[],
  todayStr: string
): ProcessRecurringResult {
  const newTransactions: Omit<Transaction, 'id' | 'createdAt'>[] = [];
  const updatedRecurring = recurringList.map((rec) => {
    // If not autoProcess or nextDueDate is in the future, return unmodified
    if (!rec.autoProcess || rec.nextDueDate > todayStr) {
      return rec;
    }

    let currentDue = rec.nextDueDate;
    let nextDue = currentDue;

    // Process all overdue instances up to today (max 10 to avoid infinite loops)
    let iterations = 0;
    while (nextDue <= todayStr && iterations < 10) {
      newTransactions.push({
        type: rec.type,
        amount: rec.amount,
        date: nextDue,
        time: '09:00',
        accountId: rec.accountId,
        toAccountId: rec.toAccountId,
        categoryId: rec.categoryId,
        categoryName: rec.categoryName,
        categoryIcon: rec.categoryIcon,
        description: `${rec.description} (Auto Recurring)`,
      });

      nextDue = calculateNextDueDate(nextDue, rec.frequency);
      iterations++;
    }

    return {
      ...rec,
      lastProcessedDate: todayStr,
      nextDueDate: nextDue,
    };
  });

  return {
    updatedRecurring,
    newTransactions,
  };
}
