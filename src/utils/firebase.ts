/**
 * Real Firebase Configuration, Authentication & Realtime Database Sync
 * Production Project: money-manger9
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as fbSignOut,
  onAuthStateChanged,
  User,
  signInAnonymously,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import {
  getDatabase,
  ref,
  set,
  get,
  onValue,
  off,
  remove,
} from 'firebase/database';
import { AppData, Account, Transaction } from '../types';

export const firebaseConfig = {
  apiKey: "AIzaSyDvmcMbgJ6lroUwa9G4PXUggF-vw70C_t8",
  authDomain: "money-manger9.firebaseapp.com",
  databaseURL: "https://money-manger9-default-rtdb.firebaseio.com",
  projectId: "money-manger9",
  storageBucket: "money-manger9.firebasestorage.app",
  messagingSenderId: "52541572351",
  appId: "1:52541572351:web:43444272625a0022c678ca",
  measurementId: "G-KFNX3HMPH1",
};

// Initialize Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const rtdb = getDatabase(app);

// Explicitly set Firebase Auth persistence to browserLocalPersistence
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('[Firebase] Failed to set browserLocalPersistence:', err);
});

export const CACHED_AUTH_USER_KEY = 'mm_cached_authenticated_user';

export interface CachedAuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  phoneNumber?: string | null;
  numeric16Id?: string;
  cachedAt?: number;
}

/**
 * Retrieves the cached authenticated user session from localStorage
 * Used to keep the app working 100% offline without signing the user out.
 */
export function getCachedAuthUser(): CachedAuthUser | null {
  try {
    const raw = localStorage.getItem(CACHED_AUTH_USER_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

/**
 * Persists the authenticated user session to localStorage
 */
export function setCachedAuthUser(user: CachedAuthUser | null): void {
  try {
    if (user) {
      localStorage.setItem(
        CACHED_AUTH_USER_KEY,
        JSON.stringify({
          ...user,
          cachedAt: Date.now(),
        })
      );
    } else {
      localStorage.removeItem(CACHED_AUTH_USER_KEY);
    }
  } catch (err) {
    console.warn('[Firebase] Failed to save cached auth user:', err);
  }
}

// Google Provider with Google Drive Scopes for Dual-Layer Cloud Backup
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
googleProvider.addScope('https://www.googleapis.com/auth/drive.appdata');
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');

export const GOOGLE_DRIVE_TOKEN_KEY = 'google_drive_access_token';

/**
 * Access Token Storage for Google Drive API operations
 */
export function getGoogleDriveAccessToken(): string | null {
  try {
    return localStorage.getItem(GOOGLE_DRIVE_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setGoogleDriveAccessToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(GOOGLE_DRIVE_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(GOOGLE_DRIVE_TOKEN_KEY);
    }
  } catch (err) {
    console.warn('[Firebase] Failed to persist Google Drive token:', err);
  }
}

/**
 * Ensure the client has an active Firebase Auth session (signs in anonymously if not signed in)
 * This allows public share links to read real-time RTDB data without requiring Google sign-in.
 */
export async function ensureFirebaseAuth(): Promise<User | null> {
  if (auth.currentUser) return auth.currentUser;
  try {
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch (err) {
    console.warn('[Firebase] Anonymous sign-in attempt (falling back to public RTDB rules):', err);
    return null;
  }
}

/**
 * Sign In With Google (Popup with Redirect Fallback for mobile/PWA)
 * Captures and securely persists OAuth Access Token for Google Drive sync.
 */
export async function loginWithGoogle(): Promise<User> {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    const oauthCred = GoogleAuthProvider.credentialFromResult(cred);
    if (oauthCred?.accessToken) {
      setGoogleDriveAccessToken(oauthCred.accessToken);
    }
    if (cred.user) {
      try {
        localStorage.setItem('mm_drive_perm_prompted_' + cred.user.uid, 'true');
      } catch {}
      setCachedAuthUser({
        uid: cred.user.uid,
        email: cred.user.email,
        displayName: cred.user.displayName,
        photoURL: cred.user.photoURL,
        phoneNumber: cred.user.phoneNumber,
      });
    }
    return cred.user;
  } catch (err: any) {
    if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/popup-closed-by-user') {
      await signInWithRedirect(auth, googleProvider);
      throw new Error('Redirecting to Google Sign-In...');
    }
    throw err;
  }
}

/**
 * Handle Google OAuth Redirect on app startup to retrieve Drive access token
 */
export async function checkAndHandleGoogleRedirect(): Promise<User | null> {
  try {
    const cred = await getRedirectResult(auth);
    if (cred) {
      const oauthCred = GoogleAuthProvider.credentialFromResult(cred);
      if (oauthCred?.accessToken) {
        setGoogleDriveAccessToken(oauthCred.accessToken);
      }
      if (cred.user) {
        try {
          localStorage.setItem('mm_drive_perm_prompted_' + cred.user.uid, 'true');
        } catch {}
        setCachedAuthUser({
          uid: cred.user.uid,
          email: cred.user.email,
          displayName: cred.user.displayName,
          photoURL: cred.user.photoURL,
          phoneNumber: cred.user.phoneNumber,
        });
      }
      return cred.user;
    }
  } catch (err) {
    console.warn('[Firebase] Google redirect result check error:', err);
  }
  return null;
}

/**
 * Request Google Drive storage scope for an already signed-in user.
 * Explicitly grants Drive storage access or marks prompt completed to seamlessly fallback to Firebase RTDB server.
 */
export async function requestGoogleDriveStorageAccess(
  targetUid?: string
): Promise<{ success: boolean; token: string | null }> {
  const uid = targetUid || auth.currentUser?.uid || getCachedAuthUser()?.uid;
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    const oauthCred = GoogleAuthProvider.credentialFromResult(cred);
    const token = oauthCred?.accessToken || null;
    if (token) {
      setGoogleDriveAccessToken(token);
    }
    if (uid || cred.user?.uid) {
      try {
        localStorage.setItem('mm_drive_perm_prompted_' + (uid || cred.user?.uid), 'true');
      } catch {}
    }
    return { success: Boolean(token), token };
  } catch (err: any) {
    console.warn('[Firebase] Drive storage access permission prompt error or dismissed:', err);
    if (uid) {
      try {
        localStorage.setItem('mm_drive_perm_prompted_' + uid, 'true');
      } catch {}
    }
    return { success: false, token: null };
  }
}

/**
 * Sign Out
 */
export async function logoutUser(): Promise<void> {
  setGoogleDriveAccessToken(null);
  setCachedAuthUser(null);
  try {
    localStorage.removeItem('app_permanent_16digit_id');
    localStorage.removeItem('pwa_finance_user_numeric_id');
    localStorage.removeItem('mm_bound_account_uid');
    localStorage.removeItem(CACHED_AUTH_USER_KEY);
    localStorage.removeItem(GOOGLE_DRIVE_TOKEN_KEY);
    localStorage.removeItem('google_drive_access_token');
  } catch {}
  await fbSignOut(auth);
}

/**
 * Firebase RTDB Server Cloud Backup Fallback
 * Dedicated cloud backup endpoint at users/${uid}/cloud_backup and shared_accounts/backup_${uid}
 */
export async function saveFirebaseCloudBackup(uid: string, backupData: any): Promise<void> {
  if (!uid) return;
  const now = Date.now();
  const backupPayload = {
    ...backupData,
    ownerUid: uid,
    accountName: backupData.settings?.userProfile?.name || 'Cloud Backup',
    updatedAt: now,
    serverUpdatedAt: now,
  };

  // 1. Primary write at users/${uid}/cloud_backup
  try {
    const backupRef = ref(rtdb, `users/${uid}/cloud_backup`);
    await set(backupRef, backupPayload);
  } catch (err) {
    console.warn('[Firebase] users/${uid}/cloud_backup save note:', err);
  }

  // 2. Dual endpoint write at shared_accounts/backup_${uid} with required rule fields
  try {
    const sharedRef = ref(rtdb, `shared_accounts/backup_${uid}`);
    await set(sharedRef, backupPayload);
  } catch (err) {
    console.warn('[Firebase] shared_accounts/backup_${uid} save note:', err);
  }
}

export async function getFirebaseCloudBackup(uid: string): Promise<any | null> {
  if (!uid) return null;
  try {
    const backupRef = ref(rtdb, `users/${uid}/cloud_backup`);
    const snapshot = await get(backupRef);
    if (snapshot.exists() && snapshot.val()) {
      return snapshot.val();
    }
  } catch (err) {
    console.warn('[Firebase] Failed to fetch server cloud_backup:', err);
  }

  try {
    const sharedRef = ref(rtdb, `shared_accounts/backup_${uid}`);
    const snapshot = await get(sharedRef);
    if (snapshot.exists() && snapshot.val()) {
      return snapshot.val();
    }
  } catch (err) {
    console.warn('[Firebase] Failed to fetch shared_accounts/backup_${uid}:', err);
  }

  return null;
}

/**
 * Listen in real time to remote cloud backup changes for two-way silent synchronization
 */
export function subscribeToCloudBackup(
  uid: string,
  callback: (data: any) => void
): () => void {
  if (!uid) return () => {};

  const userRef = ref(rtdb, `users/${uid}/cloud_backup`);
  const sharedRef = ref(rtdb, `shared_accounts/backup_${uid}`);

  let lastSeenTimestamp = 0;

  const handleSnap = (snapshot: any) => {
    if (snapshot.exists() && snapshot.val()) {
      const val = snapshot.val();
      const ts = Number(val.updatedAt || val.timestamp || val.serverUpdatedAt || 0);
      if (ts > lastSeenTimestamp) {
        lastSeenTimestamp = ts;
        callback(val);
      }
    }
  };

  onValue(userRef, handleSnap, (err) => {
    console.warn('[Firebase] users/${uid}/cloud_backup onValue note:', err);
  });
  onValue(sharedRef, handleSnap, (err) => {
    console.warn('[Firebase] shared_accounts/backup_${uid} onValue note:', err);
  });

  return () => {
    off(userRef, 'value', handleSnap);
    off(sharedRef, 'value', handleSnap);
  };
}

/**
 * Client-Side Security Sanitization
 */
function sanitizeAppData(data: AppData): AppData {
  return {
    ...data,
    accounts: (data.accounts || []).map((acc) => ({
      ...acc,
      name: String(acc.name || '').slice(0, 100),
      notes: String(acc.notes || '').slice(0, 500),
      balance: Number(acc.balance) || 0,
    })),
    categories: (data.categories || []).map((cat) => ({
      ...cat,
      name: String(cat.name || '').slice(0, 100),
      budgetLimit: Number(cat.budgetLimit) || 0,
    })),
    transactions: (data.transactions || []).map((tx) => ({
      ...tx,
      description: String(tx.description || '').slice(0, 500),
      amount: Math.abs(Number(tx.amount) || 0),
    })),
  };
}

let syncTimeout: any = null;

/**
 * Debounced Delta Sync to Firebase Realtime Database
 */
export function syncUserDataToFirebase(uid: string, data: AppData, debounceMs = 1200): void {
  if (!uid || typeof navigator === 'undefined' || !navigator.onLine) return;

  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }

  syncTimeout = setTimeout(async () => {
    try {
      const sanitized = sanitizeAppData(data);
      const userRef = ref(rtdb, `users/${uid}/data`);
      await set(userRef, {
        ...sanitized,
        updatedAt: Date.now(),
      });
      localStorage.setItem('firebase_last_synced_at', String(Date.now()));
    } catch (err) {
      console.warn('[Firebase RTDB] Sync error:', err);
    }
  }, debounceMs);
}

/**
 * Listen to remote user data changes
 */
export function listenToUserData(
  uid: string,
  onData: (data: AppData) => void
): () => void {
  const userRef = ref(rtdb, `users/${uid}/data`);
  const callback = (snapshot: any) => {
    if (snapshot.exists()) {
      const val = snapshot.val();
      onData(val as AppData);
    }
  };
  onValue(userRef, callback);
  return () => off(userRef, 'value', callback);
}

/**
 * Shared Accounts Management
 */
export interface SharedAccountData {
  sharedId: string;
  ownerUid: string;
  ownerEmail?: string;
  accountName: string;
  account: Account;
  transactions: Transaction[];
  updatedAt: number;
}

export async function publishSharedAccount(
  ownerUid: string,
  ownerEmail: string,
  account: Account,
  transactions: Transaction[]
): Promise<string> {
  const sharedId = `share_${account.id}`;
  const sharedRef = ref(rtdb, `shared_accounts/${sharedId}`);

  const relevantTxs = transactions.filter(
    (tx) => tx.accountId === account.id || tx.toAccountId === account.id
  );

  const payload: SharedAccountData = {
    sharedId,
    ownerUid,
    ownerEmail,
    accountName: String(account.name || 'Shared Account').slice(0, 100),
    account,
    transactions: relevantTxs,
    updatedAt: Date.now(),
  };

  await set(sharedRef, payload);
  return sharedId;
}

export async function stopSharingAccount(sharedId: string): Promise<void> {
  const sharedRef = ref(rtdb, `shared_accounts/${sharedId}`);
  await remove(sharedRef);
}

export function listenToSharedAccount(
  sharedId: string,
  onData: (data: SharedAccountData | null) => void
): () => void {
  const sharedRef = ref(rtdb, `shared_accounts/${sharedId}`);
  const callback = (snapshot: any) => {
    if (snapshot.exists()) {
      onData(snapshot.val() as SharedAccountData);
    } else {
      onData(null);
    }
  };
  onValue(sharedRef, callback);
  return () => off(sharedRef, 'value', callback);
}
