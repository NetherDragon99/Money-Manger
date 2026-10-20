import { rtdb } from './firebase';
import { ref, set, get } from 'firebase/database';

const NUMERIC_ID_STORAGE_KEY = 'pwa_finance_user_numeric_id';

/**
 * Generate or retrieve an 8-digit unique numeric ID for the local user profile
 */
export function getOrCreateNumericId(existing?: string): string {
  if (existing && /^\d{8,10}$/.test(existing.trim())) {
    return existing.trim();
  }

  try {
    const saved = localStorage.getItem(NUMERIC_ID_STORAGE_KEY);
    if (saved && /^\d{8,10}$/.test(saved.trim())) {
      return saved.trim();
    }
  } catch {}

  // Generate a clean 8-digit number (10000000 - 99999999)
  const generated = Math.floor(10000000 + Math.random() * 90000000).toString();
  try {
    localStorage.setItem(NUMERIC_ID_STORAGE_KEY, generated);
  } catch {}

  return generated;
}

/**
 * Publish / sync the 8-digit numeric ID to Firebase Realtime Database
 * Mapping: /numericIds/{numericId} -> { uid, displayName, email, updatedAt }
 */
export async function syncNumericIdToFirebase(
  numericId: string,
  uid: string,
  displayName?: string,
  email?: string
): Promise<void> {
  if (!numericId || !uid) return;
  try {
    const numericIdRef = ref(rtdb, `numericIds/${numericId}`);
    await set(numericIdRef, {
      uid,
      displayName: displayName || '',
      email: email || '',
      updatedAt: Date.now(),
    });

    const userProfileRef = ref(rtdb, `users/${uid}/profile/numericId`);
    await set(userProfileRef, numericId);
  } catch (err) {
    console.warn('[NumericId] Failed to sync to Firebase RTDB:', err);
  }
}

/**
 * Look up a user profile by their 8-10 digit Numeric ID in Firebase RTDB
 */
export async function lookupUserByNumericId(
  numericId: string
): Promise<{ uid: string; displayName?: string; email?: string } | null> {
  const cleanId = numericId.trim();
  if (!/^\d{8,10}$/.test(cleanId)) return null;

  try {
    const numericIdRef = ref(rtdb, `numericIds/${cleanId}`);
    const snapshot = await get(numericIdRef);
    if (snapshot.exists()) {
      return snapshot.val();
    }
    return null;
  } catch (err) {
    console.warn('[NumericId] Failed to look up numeric ID in Firebase RTDB:', err);
    return null;
  }
}
