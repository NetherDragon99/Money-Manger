/**
 * Security & Biometric Authentication Utility
 * Implements WebAuthn Fingerprint/FaceID credentials and SHA-256 PIN security
 */

import { SecuritySettings } from '../types';

const SECURITY_STORAGE_KEY = 'money_manager_security_v1';
const SESSION_UNLOCKED_KEY = 'money_manager_unlocked_session';
const WEBAUTHN_CREDENTIAL_KEY = 'money_manager_webauthn_credential_id';

export const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  isLockEnabled: false,
  pinHash: '',
  isBiometricEnabled: false,
  requireLockOnResume: true,
};

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
