/**
 * Sharing Utilities for Live Cloud Sync & External Guest Snapshot Sharing
 * Solves GitHub Pages 404 by keeping URLs on base path (${origin}${pathname}?param=...)
 */

import { Account, Transaction, Category } from '../types';

export interface CustomShareBundle {
  type: 'custom_share_bundle';
  version: string;
  title: string;
  createdAt: number;
  ownerName?: string;
  accounts: Account[];
  transactions: Transaction[];
  categories?: Category[];
}

/**
 * Builds universal share URL that always resolves on GitHub Pages, localhost, and custom domains
 */
export function buildShareUrl(params: { sharedAccountId?: string; sharedData?: string }): string {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.origin + window.location.pathname);
  if (params.sharedAccountId) {
    url.searchParams.set('sharedAccountId', params.sharedAccountId);
  }
  if (params.sharedData) {
    url.searchParams.set('sharedData', params.sharedData);
  }
  return url.toString();
}

/**
 * Strips personal budgeting metadata (`budgetPool`, savings-allocation flags, `accountRole`,
 * budget adjustments, custom month plans) from any shared snapshot bundle.
 */
export function stripPersonalBudgetMetadataFromBundle(bundle: any): any {
  if (!bundle || typeof bundle !== 'object') return bundle;
  const clone = JSON.parse(JSON.stringify(bundle));
  delete clone.smartBudget;
  delete clone.budgetAdjustments;
  delete clone.customMonthPlans;

  if (Array.isArray(clone.accounts)) {
    clone.accounts = clone.accounts.map((acc: any) => {
      if (!acc || typeof acc !== 'object') return acc;
      const cleanAcc = { ...acc, isPrivate: false, customMonthStartDay: 'default' };
      delete cleanAcc.accountRole;
      delete cleanAcc.savingsAllocation;
      delete cleanAcc.isSavingsAllocation;
      delete cleanAcc.budgetPool;
      delete cleanAcc.budgetAdjustments;
      delete cleanAcc.customMonthPlan;
      delete cleanAcc.customMonthPlans;
      return cleanAcc;
    });
  }

  if (Array.isArray(clone.categories)) {
    clone.categories = clone.categories.map((cat: any) => {
      if (!cat || typeof cat !== 'object') return cat;
      const cleanCat = { ...cat, budgetLimit: 0 };
      delete cleanCat.budgetPool;
      delete cleanCat.isFixedObligation;
      delete cleanCat.savingsAllocation;
      delete cleanCat.customMonthPlan;
      return cleanCat;
    });
  }

  if (Array.isArray(clone.transactions)) {
    clone.transactions = clone.transactions
      .filter((tx: any) => !tx?.isBudgetAdjustment)
      .map((tx: any) => {
        if (!tx || typeof tx !== 'object') return tx;
        const cleanTx = { ...tx };
        delete cleanTx.budgetPool;
        delete cleanTx.isSalary;
        delete cleanTx.accountRole;
        delete cleanTx.savingsAllocation;
        delete cleanTx.isSavingsAllocation;
        delete cleanTx.savingsWithdrawalChoice;
        delete cleanTx.linkedAdjustmentId;
        delete cleanTx.savingsTargetId;
        delete cleanTx.isSavingsTransfer;
        delete cleanTx.budgetAdjustment;
        delete cleanTx.isBudgetAdjustment;
        delete cleanTx.budgetAdjustments;
        delete cleanTx.customMonthPlan;
        delete cleanTx.customMonthPlans;
        delete cleanTx.cycleOverride;
        return cleanTx;
      });
  }

  return clone;
}

/**
 * Encodes a data snapshot for Guest External Web Link Sharing
 */
export function encodeShareSnapshot(bundle: any): string {
  try {
    const sanitized = stripPersonalBudgetMetadataFromBundle(bundle);
    const json = JSON.stringify(sanitized);
    // URL-safe base64 encoding
    const b64 = window.btoa(encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    }));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  } catch (err) {
    console.error('Failed to encode share snapshot:', err);
    return '';
  }
}

/**
 * Decodes a data snapshot from ?sharedData=...
 */
export function decodeShareSnapshot(b64Safe: string): any | null {
  try {
    if (!b64Safe) return null;
    let b64 = b64Safe.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) {
      b64 += '=';
    }
    const binary = window.atob(b64);
    const json = decodeURIComponent(
      Array.from(binary)
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    return stripPersonalBudgetMetadataFromBundle(JSON.parse(json));
  } catch (err) {
    console.warn('Failed to decode share snapshot:', err);
    return null;
  }
}
