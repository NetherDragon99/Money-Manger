import { rtdb } from './firebase';
import { ref, set, get } from 'firebase/database';

/** Permanent guest-mode storage key for the 16-digit numeric ID */
export const PERMANENT_ID_STORAGE_KEY = 'app_permanent_16digit_id';
const LEGACY_ID_STORAGE_KEY = 'pwa_finance_user_numeric_id';

/** Strip everything except digits */
export function cleanNumericId(id: string | undefined | null): string {
  return id ? String(id).replace(/\D/g, '') : '';
}

export function isValid16DigitId(id: string | undefined | null): boolean {
  return !!id && /^\d{16}$/.test(cleanNumericId(id));
}

/** Display a 16-digit ID in readable 4-digit chunks: `4829 1038 4756 1928` */
export function format16DigitId(id: string): string {
  const digits = cleanNumericId(id).slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

/**
 * Format raw user input into 4-digit partitioned chunks (e.g. `4829 1038 4756 1928`)
 * Automatically partitions digits into 4-character blocks as the user types
 * and handles natural backspacing across chunk spaces smoothly.
 */
export function format16DigitInput(
  rawInput: string,
  prevCleanVal?: string
): { formatted: string; clean: string } {
  const digits = cleanNumericId(rawInput).slice(0, 16);
  if (
    prevCleanVal &&
    digits.length === prevCleanVal.length &&
    rawInput.length < format16DigitId(prevCleanVal).length
  ) {
    const shortened = digits.slice(0, -1);
    return {
      formatted: format16DigitId(shortened),
      clean: shortened,
    };
  }
  return {
    formatted: format16DigitId(digits),
    clean: digits,
  };
}

/** Random 16-digit numeric ID (first digit never 0) */
export function generate16DigitNumericId(): string {
  let out = String(1 + Math.floor(Math.random() * 9));
  const bytes = new Uint8Array(15);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
    bytes.forEach((b) => (out += String(b % 10)));
  } else {
    for (let i = 0; i < 15; i++) out += String(Math.floor(Math.random() * 10));
  }
  return out;
}

/** cyrb53 — fast, well-distributed 53-bit string hash */
function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** Deterministically derive the same 16-digit numeric ID from a Firebase UID, forever */
export function derive16DigitIdFromUid(uid: string): string {
  const a = cyrb53(uid, 1);
  const b = cyrb53(uid, 2);
  return String(1 + (a % 9)) + String(b).padStart(15, '0').slice(-15);
}

/**
 * Guest mode: generate a 16-digit numeric ID once and persist it permanently in localStorage.
 */
export function getOrCreateNumericId(existing?: string): string {
  try {
    const saved = localStorage.getItem(PERMANENT_ID_STORAGE_KEY);
    if (isValid16DigitId(saved)) return cleanNumericId(saved!);
  } catch {}

  const candidates = [existing, (() => { try { return localStorage.getItem(LEGACY_ID_STORAGE_KEY); } catch { return null; } })()];
  const reuse = candidates.find((c) => isValid16DigitId(c));
  const id = reuse ? cleanNumericId(reuse) : generate16DigitNumericId();

  try {
    localStorage.setItem(PERMANENT_ID_STORAGE_KEY, id);
  } catch {}
  return id;
}

/**
 * Signed-in mode: fetch `users/{uid}/numeric16Id`; if missing, derive deterministically from the
 * UID hash and save it, so the user keeps the exact same 16-digit ID across devices & resets.
 */
export async function resolvePermanent16DigitId(uid: string): Promise<string> {
  let existingLocal: string | null = null;
  try {
    const saved = localStorage.getItem(PERMANENT_ID_STORAGE_KEY);
    if (isValid16DigitId(saved)) existingLocal = cleanNumericId(saved!);
  } catch {}

  let finalId = '';
  try {
    // 10-second timeout guard on Firebase RTDB
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('RTDB lookup timeout')), 10000)
    );
    const snap: any = await Promise.race([
      get(ref(rtdb, `users/${uid}/numeric16Id`)),
      timeoutPromise,
    ]);

    if (snap && snap.exists() && isValid16DigitId(String(snap.val()))) {
      finalId = cleanNumericId(String(snap.val()));
    } else {
      // Never overwrite an existing local ID on sign-in unless users/{uid}/numeric16Id was already stored in RTDB
      finalId = existingLocal || derive16DigitIdFromUid(uid);
      await Promise.race([
        set(ref(rtdb, `users/${uid}/numeric16Id`), finalId),
        new Promise<void>((resolve) => setTimeout(resolve, 10000)),
      ]);
    }
  } catch (err) {
    console.warn('[NumericId] Could not reach Firebase within timeout, preserving existing ID:', err);
    finalId = existingLocal || derive16DigitIdFromUid(uid);
  }
  try {
    localStorage.setItem(PERMANENT_ID_STORAGE_KEY, finalId);
  } catch {}
  return finalId;
}

/**
 * Publish the reverse lookup `/numericIds/{id}` -> { uid, displayName, email, updatedAt }
 */
export async function syncNumericIdToFirebase(
  numericId: string,
  uid: string,
  displayName?: string,
  email?: string
): Promise<void> {
  const cleanId = cleanNumericId(numericId);
  if (cleanId.length !== 16 || !uid) return;
  try {
    await set(ref(rtdb, `numericIds/${cleanId}`), {
      uid,
      displayName: displayName || '',
      email: email || '',
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.warn('[NumericId] Failed to sync to Firebase RTDB:', err);
  }
}

/** Look up a user profile by their 16-digit Numeric ID */
export async function lookupUserByNumericId(
  numericId: string
): Promise<{ uid?: string; displayName?: string; email?: string } | null> {
  const cleanId = cleanNumericId(numericId);
  if (cleanId.length !== 16) return null;
  try {
    const snapshot = await get(ref(rtdb, `numericIds/${cleanId}`));
    return snapshot.exists() ? snapshot.val() : null;
  } catch (err) {
    console.warn('[NumericId] Failed to look up numeric ID:', err);
    return null;
  }
}
