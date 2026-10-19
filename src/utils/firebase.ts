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
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as fbSignOut,
  onAuthStateChanged,
  User,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
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

// Google Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Sign In With Google (Popup with Redirect Fallback for mobile/PWA)
 */
export async function loginWithGoogle(): Promise<User> {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
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
 * Sign in with Email and Password
 */
export async function loginWithEmail(email: string, pass: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
  return cred.user;
}

/**
 * Register with Email and Password
 */
export async function registerWithEmail(email: string, pass: string): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  return cred.user;
}

/**
 * Send Password Reset Email
 */
export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

/**
 * Sign Out
 */
export async function logoutUser(): Promise<void> {
  await fbSignOut(auth);
}

/**
 * Phone Number Auth: Set up Recaptcha & Send OTP
 */
export function setupRecaptcha(containerId: string): RecaptchaVerifier {
  return new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
  });
}

export async function sendPhoneOtp(
  phoneNumber: string,
  verifier: RecaptchaVerifier
): Promise<ConfirmationResult> {
  return await signInWithPhoneNumber(auth, phoneNumber.trim(), verifier);
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
