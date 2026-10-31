/**
 * Smart Budget Alert Engine
 * Evaluates category limits, detects near-threshold (80%) and exceeded budgets,
 * and performs spending velocity analysis.
 */

import { Category, Transaction } from '../types';

export interface BudgetAlert {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  budgetLimit: number;
  totalSpent: number;
  percentage: number;
  status: 'warning' | 'danger' | 'projected_danger';
}

export function evaluateBudgetAlerts(
  categories: Category[],
  transactions: Transaction[],
  thresholdPercent = 80
): BudgetAlert[] {
  const expenseCategories = categories.filter((c) => c.type === 'expense' && c.budgetLimit > 0);
  if (expenseCategories.length === 0) return [];

  // Group current period expense totals by category (internal transfers are never expenses)
  const spentMap: Record<string, number> = {};
  for (const tx of transactions) {
    if (tx.type === 'transfer' || Boolean(tx.toAccountId)) continue;
    if (tx.type === 'expense' && tx.categoryId) {
      spentMap[tx.categoryId] = (spentMap[tx.categoryId] || 0) + tx.amount;
    }
  }

  const now = new Date();
  const currentDay = now.getDate();
  const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const progressThroughMonth = Math.max(0.1, currentDay / totalDaysInMonth);

  const alerts: BudgetAlert[] = [];

  for (const cat of expenseCategories) {
    const spent = spentMap[cat.id] || 0;
    const pct = Math.round((spent / cat.budgetLimit) * 100);

    if (pct >= 100) {
      alerts.push({
        categoryId: cat.id,
        categoryName: cat.name,
        categoryIcon: cat.icon,
        budgetLimit: cat.budgetLimit,
        totalSpent: spent,
        percentage: pct,
        status: 'danger',
      });
    } else if (pct >= thresholdPercent) {
      alerts.push({
        categoryId: cat.id,
        categoryName: cat.name,
        categoryIcon: cat.icon,
        budgetLimit: cat.budgetLimit,
        totalSpent: spent,
        percentage: pct,
        status: 'warning',
      });
    } else {
      // Check projected velocity: If pace is on track to exceed budget before month ends
      const projectedTotal = spent / progressThroughMonth;
      if (projectedTotal > cat.budgetLimit && pct >= 50 && currentDay >= 7) {
        alerts.push({
          categoryId: cat.id,
          categoryName: cat.name,
          categoryIcon: cat.icon,
          budgetLimit: cat.budgetLimit,
          totalSpent: spent,
          percentage: pct,
          status: 'projected_danger',
        });
      }
    }
  }

  // Sort by highest percentage spent descending
  return alerts.sort((a, b) => b.percentage - a.percentage);
}
