/**
 * Gemini Private API Key Storage & Security Utilities
 *
 * Security & Isolation Rules:
 * - Stored ONLY at the private RTDB path: `users/${uid}/secrets/gemini`.
 * - Local copy stored in localStorage under `mm_gemini_api_key`.
 * - Allowed in RTDB only when `auth.uid === $uid`.
 * - NEVER placed under `shared_accounts`.
 * - EXCLUDED from every backup, export, Google Drive backup, cloud snapshot,
 *   share payload, link mirror, log, toast, and error message.
 * - Only a masked string (e.g. `••••••••1234`) is exposed to UI views.
 * - "Clear key" explicitly deletes BOTH local and cloud copies.
 * - Sign-out removes the local copy while strictly keeping the cloud copy.
 */

import { ref, get, set, remove } from 'firebase/database';
import { rtdb } from './firebase';

export const GEMINI_API_KEY_STORAGE_KEY = 'mm_gemini_api_key';

/**
 * Retrieves the local Gemini API key from localStorage.
 */
export function getLocalGeminiApiKey(): string | null {
  try {
    const key = localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY);
    return key && key.trim() ? key.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Returns a masked representation of the API key showing only the last 4 characters.
 * E.g., '••••••••ab12'. Never leaks the full key in UI or logs.
 */
export function maskGeminiApiKey(key: string | null | undefined): string {
  if (!key) return '';
  const trimmed = key.trim();
  if (trimmed.length === 0) return '';
  if (trimmed.length <= 4) return '••••';
  const last4 = trimmed.slice(-4);
  return `••••••••••••${last4}`;
}

/**
 * Saves the Gemini API key to local storage and syncs to private cloud path users/${uid}/secrets/gemini.
 */
export async function saveGeminiApiKey(key: string, uid?: string | null): Promise<void> {
  const cleanKey = (key || '').trim();
  if (!cleanKey) {
    await clearGeminiApiKey(uid);
    return;
  }

  // 1. Save local copy
  try {
    localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, cleanKey);
  } catch (err) {
    console.warn('[GeminiKey] LocalStorage write error:', err);
  }

  // 2. Sync to private user secrets path in Firebase RTDB
  if (uid && rtdb && navigator.onLine) {
    try {
      const secretRef = ref(rtdb, `users/${uid}/secrets/gemini`);
      await set(secretRef, {
        key: cleanKey,
        updatedAt: Date.now(),
      });
    } catch (err) {
      console.warn('[GeminiKey] Private cloud secret write failed:', err);
    }
  }
}

/**
 * Fetches the user's private Gemini API key from `users/${uid}/secrets/gemini`
 * and synchronizes it to local storage.
 */
export async function fetchGeminiApiKeyFromCloud(uid: string): Promise<string | null> {
  if (!uid || !rtdb || !navigator.onLine) {
    return getLocalGeminiApiKey();
  }

  try {
    const secretRef = ref(rtdb, `users/${uid}/secrets/gemini`);
    const snap = await get(secretRef);
    if (snap.exists()) {
      const val = snap.val();
      const cloudKey = typeof val === 'string' ? val : val?.key;
      if (cloudKey && typeof cloudKey === 'string' && cloudKey.trim()) {
        const clean = cloudKey.trim();
        try {
          localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, clean);
        } catch {}
        return clean;
      }
    }
  } catch (err) {
    console.warn('[GeminiKey] Private cloud secret read failed:', err);
  }

  return getLocalGeminiApiKey();
}

/**
 * Deletes BOTH the local copy and the cloud copy of the key ("Clear key").
 */
export async function clearGeminiApiKey(uid?: string | null): Promise<void> {
  // 1. Delete local copy
  try {
    localStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
  } catch {}

  // 2. Delete cloud copy at private path
  if (uid && rtdb && navigator.onLine) {
    try {
      const secretRef = ref(rtdb, `users/${uid}/secrets/gemini`);
      await remove(secretRef);
    } catch (err) {
      console.warn('[GeminiKey] Private cloud secret delete failed:', err);
    }
  }
}

/**
 * Removes ONLY the local copy on sign-out while keeping the cloud copy safe.
 */
export function removeLocalGeminiApiKeyOnSignOut(): void {
  try {
    localStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
  } catch {}
}
