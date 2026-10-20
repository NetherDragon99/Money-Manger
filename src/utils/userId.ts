import { rtdb } from './firebase';
import { ref, set, get } from 'firebase/database';

const NUMERIC_ID_STORAGE_KEY = 'pwa_finance_user_numeric_id';

/**
 * Generate a clean 16-digit numeric string formatted as 4 groups of 4 digits
 */
export function generate16DigitNumericId(): string {
  const p1 = Math.floor(1000 + Math.random() * 9000).toString();
  const p2 = Math.floor(1000 + Math.random() * 9000).toString();
  const p3 = Math.floor(1000 + Math.random() * 9000).toString();
  const p4 = Math.floor(1000 + Math.random() * 9000).toString();
  return `${p1}${p2}${p3}${p4}`;
}

/**
 * Format a 16-digit numeric string with spaces for easy reading: `1234 5678 9012 3456`
 */
export function format16DigitId(id: string): string {
  if (!id) return '';
  const digits = id.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

/**
 * Clean any formatted string back to raw digits
 */
export function cleanNumericId(id: string): string {
  return id ? id.replace(/\D/g, '').trim() : '';
}

/**
 * Generate or retrieve a strictly 16-digit unique numeric ID for the local user profile
 */
export function getOrCreateNumericId(existing?: string): string {
  const cleanExisting = existing ? cleanNumericId(existing) : '';
  if (cleanExisting.length === 16) {
    return cleanExisting;
  }

  try {
    const saved = localStorage.getItem(NUMERIC_ID_STORAGE_KEY);
    const cleanSaved = saved ? cleanNumericId(saved) : '';
    if (cleanSaved.length === 16) {
      return cleanSaved;
    }
  } catch {}

  // Generate a brand new 16-digit number
  const generated = generate16DigitNumericId();
  try {
    localStorage.setItem(NUMERIC_ID_STORAGE_KEY, generated);
  } catch {}

  return generated;
}

/**
 * Publish / sync the 16-digit numeric ID to Firebase Realtime Database
 * Mapping: /numericIds/{numericId} -> { uid, displayName, email, updatedAt }
 */
export async function syncNumericIdToFirebase(
  numericId: string,
  uid: string,
  displayName?: string,
  email?: string
): Promise<void> {
  const cleanId = cleanNumericId(numericId);
  if (!cleanId || cleanId.length !== 16 || !uid) return;
  try {
    const numericIdRef = ref(rtdb, `numericIds/${cleanId}`);
    await set(numericIdRef, {
      uid,
      displayName: displayName || '',
      email: email || '',
      updatedAt: Date.now(),
    });

    const userProfileRef = ref(rtdb, `users/${uid}/profile/numericId`);
    await set(userProfileRef, cleanId);
  } catch (err) {
    console.warn('[NumericId] Failed to sync to Firebase RTDB:', err);
  }
}

/**
 * Look up a user profile by their 16-digit Numeric ID in Firebase RTDB
 */
export async function lookupUserByNumericId(
  numericId: string
): Promise<{ uid?: string; displayName?: string; email?: string } | null> {
  const cleanId = cleanNumericId(numericId);
  if (cleanId.length !== 16) return null;

  try {
    const numericIdRef = ref(rtdb, `numericIds/${cleanId}`);
    const snapshot = await get(numericIdRef);
    if (snapshot.exists()) {
      return snapshot.val();
    }
    // Return empty record if valid 16-digit ID exists as active target
    return { uid: undefined };
  } catch (err) {
    console.warn('[NumericId] Failed to look up numeric ID in Firebase RTDB:', err);
    return null;
  }
}
