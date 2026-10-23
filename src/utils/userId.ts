import { auth, rtdb, getCachedAuthUser } from './firebase';
import { ref, set, get } from 'firebase/database';

/** Permanent guest-mode storage key for the 16-digit numeric ID */
export const PERMANENT_ID_STORAGE_KEY = 'app_permanent_16digit_id';
const LEGACY_ID_STORAGE_KEY = 'pwa_finance_user_numeric_id';

/**
 * Clears all cached numeric IDs and identity tokens on sign-out
 */
export function clearUserIdentityState(): void {
  try {
    localStorage.removeItem(PERMANENT_ID_STORAGE_KEY);
    localStorage.removeItem(LEGACY_ID_STORAGE_KEY);
  } catch {}
}

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
 * Automatically partitions digits into 4-character blocks separated by spaces
 * and computes the exact cursor position at the corresponding digit offset.
 */
export function format16DigitInput(
  rawInput: string,
  selectionStartOrPrevClean?: number | string,
  isBackspace?: boolean,
  prevCleanVal?: string,
  isDeleteForward?: boolean
): { formatted: string; clean: string; newCursorPos: number } {
  const selectionStart =
    typeof selectionStartOrPrevClean === 'number'
      ? selectionStartOrPrevClean
      : rawInput.length;
  const prevClean =
    typeof selectionStartOrPrevClean === 'string'
      ? selectionStartOrPrevClean
      : prevCleanVal || '';

  // 1. Record the count of raw digits before selectionStart
  let rawDigitsBefore = rawInput.slice(0, selectionStart).replace(/\D/g, '').length;
  let clean = cleanNumericId(rawInput).slice(0, 16);

  // 2. Natural backspacing / deletion over a space separator:
  // If a backspace removed a space rather than a digit, remove the preceding digit
  if (
    isBackspace &&
    prevClean &&
    clean.length === prevClean.length &&
    rawInput.length < format16DigitId(prevClean).length
  ) {
    if (rawDigitsBefore > 0) {
      clean = (clean.slice(0, rawDigitsBefore - 1) + clean.slice(rawDigitsBefore)).slice(0, 16);
      rawDigitsBefore = Math.max(0, rawDigitsBefore - 1);
    }
  }

  // If a forward delete removed a space rather than a digit, remove the following digit
  if (
    isDeleteForward &&
    prevClean &&
    clean.length === prevClean.length &&
    rawInput.length < format16DigitId(prevClean).length
  ) {
    if (rawDigitsBefore < clean.length) {
      clean = (clean.slice(0, rawDigitsBefore) + clean.slice(rawDigitsBefore + 1)).slice(0, 16);
    }
  }

  // 3. Format into 4-digit groups separated by spaces (XXXX XXXX XXXX XXXX)
  const formatted = format16DigitId(clean);

  // 4. Calculate new cursor position matching the raw digits count
  let newCursorPos = 0;
  if (rawDigitsBefore === 0) {
    newCursorPos = 0;
  } else {
    let digitsCount = 0;
    for (let i = 0; i < formatted.length; i++) {
      if (/\d/.test(formatted[i])) {
        digitsCount++;
        if (digitsCount === rawDigitsBefore) {
          newCursorPos = i + 1;
          // If the character immediately following is a space, advance past it
          if (newCursorPos < formatted.length && formatted[newCursorPos] === ' ') {
            newCursorPos++;
          }
          break;
        }
      }
    }
    if (digitsCount < rawDigitsBefore) {
      newCursorPos = formatted.length;
    }
  }

  return { formatted, clean, newCursorPos };
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
 * Returns the 16-digit numeric ID ONLY if user is authenticated with Firebase Auth.
 * Guest users (not signed in to Firebase Auth) DO NOT generate or receive a 16-digit ID.
 */
export function getOrCreateNumericId(existing?: string): string {
  const user = auth?.currentUser || getCachedAuthUser();
  if (!user || !user.uid) {
    // Guest user: strictly do not generate, return, or persist a 16-digit ID
    try {
      localStorage.removeItem(PERMANENT_ID_STORAGE_KEY);
      localStorage.removeItem(LEGACY_ID_STORAGE_KEY);
    } catch {}
    return '';
  }

  try {
    const saved = localStorage.getItem(PERMANENT_ID_STORAGE_KEY);
    if (isValid16DigitId(saved)) return cleanNumericId(saved!);
  } catch {}

  const candidates = [existing, derive16DigitIdFromUid(user.uid)];
  const reuse = candidates.find((c) => isValid16DigitId(c));
  const id = reuse ? cleanNumericId(reuse) : derive16DigitIdFromUid(user.uid);

  try {
    localStorage.setItem(PERMANENT_ID_STORAGE_KEY, id);
  } catch {}
  return id;
}

/**
 * Signed-in mode: fetch `users/{uid}/numeric16Id`; if missing, check cloud backup hint,
 * or derive deterministically from the UID hash and save it, so the user keeps the exact
 * same 16-digit ID across devices & resets.
 */
export async function resolvePermanent16DigitId(uid: string, fallbackIdHint?: string): Promise<string> {
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
      // Check under users/${uid}/profile/numeric16Id as well
      try {
        const profSnap = await get(ref(rtdb, `users/${uid}/profile/numeric16Id`));
        if (profSnap && profSnap.exists() && isValid16DigitId(String(profSnap.val()))) {
          finalId = cleanNumericId(String(profSnap.val()));
        }
      } catch {}

      if (!finalId && fallbackIdHint && isValid16DigitId(fallbackIdHint)) {
        finalId = cleanNumericId(fallbackIdHint);
      }

      if (!finalId) {
        // Never overwrite an existing local ID on sign-in unless users/{uid}/numeric16Id was already stored in RTDB
        finalId = existingLocal || derive16DigitIdFromUid(uid);
      }

      await Promise.race([
        Promise.all([
          set(ref(rtdb, `users/${uid}/numeric16Id`), finalId),
          set(ref(rtdb, `users/${uid}/profile/numeric16Id`), finalId),
        ]),
        new Promise<void>((resolve) => setTimeout(resolve, 10000)),
      ]);
    }
  } catch (err) {
    console.warn('[NumericId] Could not reach Firebase within timeout, preserving existing ID:', err);
    if (fallbackIdHint && isValid16DigitId(fallbackIdHint)) {
      finalId = cleanNumericId(fallbackIdHint);
    } else {
      finalId = existingLocal || derive16DigitIdFromUid(uid);
    }
  }
  try {
    localStorage.setItem(PERMANENT_ID_STORAGE_KEY, finalId);
  } catch {}
  return finalId;
}

/**
 * Publish the reverse lookup `/numericIds/{id}` -> { uid, displayName, email, updatedAt }
 * and also persist `users/${uid}/profile/numeric16Id`
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
    // Persist under users/${uid}/profile/numeric16Id as well
    await set(ref(rtdb, `users/${uid}/profile/numeric16Id`), cleanId).catch(() => {});
    await set(ref(rtdb, `users/${uid}/numeric16Id`), cleanId).catch(() => {});
  } catch (err) {
    console.warn('[NumericId] Failed to sync to Firebase RTDB:', err);
  }
}

/** Look up a user profile by their 16-digit Numeric ID */
export async function lookupUserByNumericId(
  numericId: string
): Promise<{ uid?: string; displayName?: string; email?: string; photoURL?: string; avatar?: string; name?: string; numericId?: string } | null> {
  const cleanId = cleanNumericId(numericId);
  if (cleanId.length !== 16) return null;

  // 1. Check shared_accounts/profile_${cleanId}
  try {
    const profSnap = await get(ref(rtdb, `shared_accounts/profile_${cleanId}`));
    if (profSnap.exists()) {
      const p = profSnap.val();
      return {
        uid: p.uid || p.ownerUid,
        displayName: p.name || p.accountName || `User ${cleanId.slice(0, 4)}`,
        name: p.name || p.accountName || `User ${cleanId.slice(0, 4)}`,
        photoURL: p.photoURL || '',
        avatar: p.avatar || '👤',
        numericId: cleanId,
      };
    }
  } catch (err) {
    console.warn('[NumericId] Failed to query shared_accounts profile:', err);
  }

  // 2. Fallback to numericIds/${cleanId}
  try {
    const snapshot = await get(ref(rtdb, `numericIds/${cleanId}`));
    if (snapshot.exists()) {
      const data = snapshot.val();
      return {
        uid: data.uid,
        displayName: data.displayName || data.name || data.email?.split('@')[0],
        name: data.displayName || data.name || data.email?.split('@')[0],
        email: data.email,
        photoURL: data.photoURL || '',
        avatar: data.avatar || '👤',
        numericId: cleanId,
      };
    }
  } catch (err) {
    console.warn('[NumericId] Failed to look up numeric ID in numericIds:', err);
  }

  return null;
}
