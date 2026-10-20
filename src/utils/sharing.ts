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
 * Encodes a data snapshot for Guest External Web Link Sharing
 */
export function encodeShareSnapshot(bundle: any): string {
  try {
    const json = JSON.stringify(bundle);
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
    return JSON.parse(json);
  } catch (err) {
    console.warn('Failed to decode share snapshot:', err);
    return null;
  }
}
