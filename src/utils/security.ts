/**
 * Security & Biometric Authentication Utility
 * Implements WebAuthn Fingerprint/FaceID credentials and SHA-256 PIN security
 */

import { SecuritySettings } from '../types';

const SECURITY_STORAGE_KEY = 'money_manager_security_v1';
const SESSION_UNLOCKED_KEY = 'money_manager_unlocked_session';
const WEBAUTHN_CREDENTIAL_KEY = 'money_manager_webauthn_credential_id';
const APP_LOCK_LOCAL_ENABLED_KEY = 'mm_app_lock_enabled';
const APP_LOCK_GRACE_PERIOD_KEY = 'mm_app_lock_grace_period';

// In-memory grace period state (strictly NEVER written to localStorage)
let inMemoryBackgroundTimestamp: number | null = null;
let isUnlockedThisSession = false;

export const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  isLockEnabled: false,
  pinHash: '',
  isBiometricEnabled: false,
  requireLockOnResume: true,
};

/**
 * Checks whether App Lock is enabled locally on this device.
 * Defaults to true if a PIN exists and key is not set to 'false'.
 */
export function isAppLockEnabledLocally(): boolean {
  try {
    const val = localStorage.getItem(APP_LOCK_LOCAL_ENABLED_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

/**
 * Persists the local App Lock toggle strictly on this device.
 */
export function setAppLockEnabledLocally(enabled: boolean): void {
  try {
    localStorage.setItem(APP_LOCK_LOCAL_ENABLED_KEY, enabled ? 'true' : 'false');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app_security_updated'));
    }
  } catch (err) {
    console.error('Failed to set mm_app_lock_enabled:', err);
  }
}

/**
 * Retrieves the in-memory grace period threshold in minutes.
 * Options: 0 (Immediately), 1 (1 min), 5 (5 min, default), 15 (15 min).
 */
export function getAppLockGracePeriod(): number {
  try {
    const val = localStorage.getItem(APP_LOCK_GRACE_PERIOD_KEY);
    if (val === null) return 5;
    const num = parseInt(val, 10);
    return isNaN(num) ? 5 : num;
  } catch {
    return 5;
  }
}

/**
 * Persists the grace period setting locally.
 */
export function setAppLockGracePeriod(minutes: number): void {
  try {
    localStorage.setItem(APP_LOCK_GRACE_PERIOD_KEY, String(minutes));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app_security_updated'));
    }
  } catch (err) {
    console.error('Failed to set mm_app_lock_grace_period:', err);
  }
}

/**
 * Evaluates whether App Lock is currently active (configured, locally enabled, and PIN hash exists).
 */
export function isAppLockActive(): boolean {
  const sec = loadSecuritySettings();
  const local = isAppLockEnabledLocally();
  return Boolean(sec.isLockEnabled && local && sec.pinHash);
}

/**
 * Records that the current session was successfully unlocked.
 * Clears background timestamps and resets lockout tracking.
 */
export function recordSuccessfulUnlock(): void {
  isUnlockedThisSession = true;
  inMemoryBackgroundTimestamp = null;
  setSessionUnlocked(true);
}

/**
 * Records the in-memory timestamp when the app goes into the background (visibilitychange/pagehide).
 */
export function recordAppBackground(): void {
  if (isUnlockedThisSession) {
    inMemoryBackgroundTimestamp = Date.now();
  }
}

/**
 * Determines whether the app must lock upon returning to the foreground.
 * - Always locks if never unlocked in this session (cold start, reload, process restart).
 * - Always locks if the clock moved backwards.
 * - Locks if elapsed background time exceeds the configured grace period.
 * - Otherwise remains unlocked and clears the background timestamp.
 */
export function shouldAppLockOnForeground(): boolean {
  if (!isAppLockActive()) {
    return false;
  }
  if (!isUnlockedThisSession) {
    return true;
  }
  if (inMemoryBackgroundTimestamp === null) {
    return false;
  }

  const now = Date.now();
  // Lock if clock moved backwards
  if (now < inMemoryBackgroundTimestamp) {
    isUnlockedThisSession = false;
    inMemoryBackgroundTimestamp = null;
    return true;
  }

  const elapsedMs = now - inMemoryBackgroundTimestamp;
  const graceMinutes = getAppLockGracePeriod();
  const graceMs = graceMinutes * 60 * 1000;

  if (elapsedMs > graceMs) {
    isUnlockedThisSession = false;
    inMemoryBackgroundTimestamp = null;
    return true;
  }

  // Within grace period: stay unlocked!
  inMemoryBackgroundTimestamp = null;
  return false;
}

/**
 * Resets session unlock state (e.g., when manually locking the app).
 */
export function resetSessionLockState(): void {
  isUnlockedThisSession = false;
  inMemoryBackgroundTimestamp = null;
  setSessionUnlocked(false);
}

/**
 * Modern salted PBKDF2 hash using WebCrypto (100,000 iterations of SHA-256 with 16-byte random salt).
 */
export async function hashPinPBKDF2(pin: string, existingSaltHex?: string): Promise<string> {
  const encoder = new TextEncoder();
  const pinBuffer = encoder.encode(pin);
  const iterations = 100000;

  let saltBuffer: Uint8Array<ArrayBuffer>;
  if (existingSaltHex) {
    const saltBytes: number[] = [];
    for (let i = 0; i < existingSaltHex.length; i += 2) {
      saltBytes.push(parseInt(existingSaltHex.substr(i, 2), 16));
    }
    const buf = new ArrayBuffer(saltBytes.length);
    saltBuffer = new Uint8Array(buf);
    saltBuffer.set(saltBytes);
  } else {
    const buf = new ArrayBuffer(16);
    saltBuffer = new Uint8Array(buf);
    crypto.getRandomValues(saltBuffer);
  }

  const baseKey = await crypto.subtle.importKey(
    'raw',
    pinBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    256
  );

  const saltHex = Array.from(saltBuffer)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const hashHex = Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `pbkdf2:${iterations}:${saltHex}:${hashHex}`;
}

/**
 * Verifies a PIN against stored hash:
 * 1. Salted PBKDF2 ("pbkdf2:100000:<salt>:<hash>")
 * 2. Legacy SHA-256 ("salt_pwa_security_${pin}")
 * 3. Legacy Plaintext
 */
export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  if (!storedHash) return false;

  // 1. Salted PBKDF2
  if (storedHash.startsWith('pbkdf2:')) {
    const parts = storedHash.split(':');
    if (parts.length === 4) {
      const saltHex = parts[2];
      const expectedHash = parts[3];
      const computed = await hashPinPBKDF2(pin, saltHex);
      const computedHash = computed.split(':')[3];
      return computedHash === expectedHash;
    }
  }

  // 2. Legacy SHA-256 hash
  const legacyHash = await hashPin(pin);
  if (legacyHash === storedHash) {
    return true;
  }

  // 3. Plaintext legacy fallback
  if (pin === storedHash) {
    return true;
  }

  return false;
}

export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`salt_pwa_security_${pin}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function loadSecuritySettings(): SecuritySettings {
  try {
    const raw = localStorage.getItem(SECURITY_STORAGE_KEY);
    if (!raw) return DEFAULT_SECURITY_SETTINGS;
    return { ...DEFAULT_SECURITY_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SECURITY_SETTINGS;
  }
}

export function saveSecuritySettings(settings: SecuritySettings): void {
  try {
    localStorage.setItem(SECURITY_STORAGE_KEY, JSON.stringify(settings));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app_security_updated', { detail: settings }));
    }
  } catch (err) {
    console.error('Failed to save security settings:', err);
  }
}

// Base64 URL helpers for credential IDs
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const padded = base64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((base64.length + 3) % 4);
  const binary = window.atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Returns safe relying party ID for WebAuthn.
 * Under WebAuthn spec, setting rp.id to an invalid hostname or IP throws SecurityError.
 * Leaving rp.id undefined allows browser to automatically infer origin.
 */
function getSafeRelyingPartyId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const host = window.location.hostname;
  if (!host || host === 'localhost' || /^[0-9.]+$/.test(host)) {
    return undefined;
  }
  return host;
}

export async function isBiometricAvailable(): Promise<boolean> {
  if (
    typeof window !== 'undefined' &&
    window.PublicKeyCredential &&
    typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
  ) {
    try {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Creates and registers a platform biometric passkey (Fingerprint / Face ID / Touch ID)
 */
export async function registerBiometrics(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !window.PublicKeyCredential || !navigator.credentials) {
      return false;
    }

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const rpId = getSafeRelyingPartyId();

    const publicKeyConfig: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: 'Personal Finance PWA',
        ...(rpId ? { id: rpId } : {}),
      },
      user: {
        id: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
        name: 'owner@finance.app',
        displayName: 'App Owner',
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },   // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 30000,
    };

    const credential = (await navigator.credentials.create({
      publicKey: publicKeyConfig,
    })) as PublicKeyCredential | null;

    if (credential && credential.rawId) {
      const b64Id = bufferToBase64(credential.rawId);
      localStorage.setItem(WEBAUTHN_CREDENTIAL_KEY, b64Id);
      return true;
    }
    return false;
  } catch (err: any) {
    console.warn('[WebAuthn] Biometric registration cancelled or unsupported:', err);
    return false;
  }
}

/**
 * Verifies stored biometric credential
 */
export async function authenticateWithBiometrics(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !window.PublicKeyCredential || !navigator.credentials) {
      return false;
    }

    const storedId = localStorage.getItem(WEBAUTHN_CREDENTIAL_KEY);
    if (!storedId) {
      // No passkey registered yet, attempt on-demand registration
      console.log('[WebAuthn] No passkey ID stored, attempting registration...');
      const registered = await registerBiometrics();
      return registered;
    }

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const rpId = getSafeRelyingPartyId();

    const publicKeyOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      ...(rpId ? { rpId } : {}),
      userVerification: 'required',
      timeout: 30000,
      allowCredentials: [
        {
          type: 'public-key',
          id: base64ToBuffer(storedId),
          transports: ['internal'],
        },
      ],
    };

    const assertion = await navigator.credentials.get({
      publicKey: publicKeyOptions,
    });

    return !!assertion;
  } catch (err: any) {
    console.warn('[WebAuthn] Biometric authentication failed:', err);
    return false;
  }
}

export function setSessionUnlocked(unlocked: boolean): void {
  try {
    if (unlocked) {
      sessionStorage.setItem(SESSION_UNLOCKED_KEY, 'true');
    } else {
      sessionStorage.removeItem(SESSION_UNLOCKED_KEY);
    }
  } catch {
    // Ignore in private browsing
  }
}

export function isSessionUnlocked(): boolean {
  try {
    return sessionStorage.getItem(SESSION_UNLOCKED_KEY) === 'true';
  } catch {
    return false;
  }
}
