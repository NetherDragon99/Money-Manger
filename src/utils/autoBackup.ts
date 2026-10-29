/**
 * Automated Scheduled Backup Engine for PWA
 * Supports File System Access API (window.showDirectoryPicker) with IndexedDB handle persistence
 * and background execution loops on visibilitychange / intervals.
 */

import { AppData, Account, Category, Transaction, AppSettings, RecurringTransaction, Tombstone, GranularDirtyQueueItem } from '../types';
import {
  getGoogleDriveAccessToken,
  setGoogleDriveAccessToken,
  saveFirebaseCloudBackup,
  getFirebaseCloudBackup,
  rtdb,
} from './firebase';
import { ref, update, get, set, onValue, off } from 'firebase/database';
import { cleanNumericId } from './userId';
import { ShareFolder, loadMyShareFolders, loadReceivedShareFolders } from './shareFolders';
import { queueOfflineCloudBackup } from './persistQueue';
import { INITIAL_CATEGORIES } from './constants';
import { migrateRecurringRule } from './recurring';
import { formatVersionLabel } from './versionChecker';

export interface FullAppBackupPayload {
  version: string;
  versionLabel?: string;
  backupDate: string;
  timestamp: number;
  updatedAt?: number;
  ownerUid?: string;
  accountName?: string;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  recurringTransactions?: RecurringTransaction[];
  settings: AppSettings;
  sharedSpaces?: {
    myFolders: ShareFolder[];
    receivedFolders: ShareFolder[];
  };
  userProfile?: {
    name: string;
    numericId: string;
    avatarEmoji: string;
    customAvatarUrl?: string;
    email?: string;
    uid?: string;
    driveAccessGranted?: boolean;
    drivePromptResolved?: boolean;
  };
}

export type BackupScheduleFrequency = 'off' | 'daily' | 'weekly' | 'monthly';

export interface AutoBackupConfig {
  enabled: boolean;
  frequency: BackupScheduleFrequency;
  dayOfWeek: number; // 0 (Sun) to 6 (Sat)
  dayOfMonth: number; // 1 to 28
  time: string; // HH:mm
  lastBackupDate?: string; // ISO date string
  folderName?: string;
}

const CONFIG_KEY = 'pwa_finance_autobackup_config';
const DB_NAME = 'pwa_finance_handles';
const STORE_NAME = 'directory_handles';

export const DEFAULT_AUTOBACKUP_CONFIG: AutoBackupConfig = {
  enabled: false,
  frequency: 'daily',
  dayOfWeek: 0,
  dayOfMonth: 1,
  time: '02:00',
};

// Open IndexedDB for directory handle persistence
function getHandleDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Store directory handle in IndexedDB
export async function saveDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  try {
    const db = await getHandleDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(handle, 'backup_folder');
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Could not store directory handle:', err);
  }
}

// Retrieve directory handle from IndexedDB
export async function getDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await getHandleDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get('backup_folder');
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export function loadAutoBackupConfig(): AutoBackupConfig {
  try {
    const saved = localStorage.getItem(CONFIG_KEY);
    if (saved) {
      return { ...DEFAULT_AUTOBACKUP_CONFIG, ...JSON.parse(saved) };
    }
  } catch {}
  return DEFAULT_AUTOBACKUP_CONFIG;
}

export function saveAutoBackupConfig(config: AutoBackupConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch (err) {
    console.warn('Failed to save auto-backup config:', err);
  }
}

/**
 * Checks if a scheduled backup is due based on frequency, days, and time
 */
export function isBackupDue(config: AutoBackupConfig): boolean {
  if (!config.enabled || config.frequency === 'off') return false;

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // If already backed up today, not due
  if (config.lastBackupDate && config.lastBackupDate.slice(0, 10) === todayStr) {
    return false;
  }

  // Check frequency rules
  if (config.frequency === 'weekly') {
    if (now.getDay() !== config.dayOfWeek) return false;
  } else if (config.frequency === 'monthly') {
    if (now.getDate() !== config.dayOfMonth) return false;
  }

  // Check target time (HH:mm)
  const [targetH, targetM] = config.time.split(':').map((n) => parseInt(n, 10) || 0);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const targetMinutes = targetH * 60 + targetM;

  return currentMinutes >= targetMinutes;
}

/**
 * Executes a silent backup to the target directory handle,
 * or saves a persistent snapshot in localStorage/IndexedDB.
 */
export async function executeAutoBackup(data: AppData): Promise<{ success: boolean; folderBackedUp: boolean }> {
  const config = loadAutoBackupConfig();
  const timestamp = new Date().toISOString().slice(0, 10);
  const fileName = `auto_backup_${timestamp}.json`;

  const backupPayload = {
    version: '1.1.61',
    versionLabel: formatVersionLabel('1.1.61'),
    type: 'automated_backup',
    backupDate: new Date().toISOString(),
    ...data,
  };
  const jsonStr = JSON.stringify(backupPayload, null, 2);

  // Always save snapshot to IndexedDB as guaranteed fallback
  try {
    localStorage.setItem('pwa_finance_latest_backup_snapshot', jsonStr);
  } catch {}

  let folderBackedUp = false;

  // Attempt File System Access API silent write
  try {
    const handle = (await getDirectoryHandle()) as any;
    if (handle) {
      // Query or request permission if needed
      const perm = await handle.queryPermission?.({ mode: 'readwrite' });
      if (perm === 'granted') {
        const fileHandle = await handle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(jsonStr);
        await writable.close();
        folderBackedUp = true;
      }
    }
  } catch (err) {
    console.warn('Auto backup to directory failed, fallback saved:', err);
  }

  config.lastBackupDate = new Date().toISOString();
  saveAutoBackupConfig(config);

  return { success: true, folderBackedUp };
}

/* ====================================================================
 * Automatic Google Drive Backup with Firebase Server Fallback Engine
 * ==================================================================== */

const BACKUP_FILE_NAME = 'money_manager_backup.json';

/**
 * Searches for the backup file in Google Drive (appDataFolder first, then root)
 */
async function findGoogleDriveBackupFile(
  accessToken: string
): Promise<{ id: string; inAppData: boolean } | null> {
  // 1. Search in appDataFolder (private application space)
  try {
    const appDataUrl = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name%3D'${BACKUP_FILE_NAME}'+and+trashed%3Dfalse&fields=files(id%2Cname%2CmodifiedTime)`;
    const res = await fetch(appDataUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const body = await res.json();
      if (body.files && body.files.length > 0) {
        return { id: body.files[0].id, inAppData: true };
      }
    }
  } catch (err) {
    console.warn('[GoogleDrive] Search appDataFolder error:', err);
  }

  // 2. Search in standard Drive root space as fallback
  try {
    const driveUrl = `https://www.googleapis.com/drive/v3/files?q=name%3D'${BACKUP_FILE_NAME}'+and+trashed%3Dfalse&fields=files(id%2Cname%2CmodifiedTime)`;
    const res = await fetch(driveUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const body = await res.json();
      if (body.files && body.files.length > 0) {
        return { id: body.files[0].id, inAppData: false };
      }
    }
  } catch (err) {
    console.warn('[GoogleDrive] Search root drive error:', err);
  }

  return null;
}

/**
 * Uploads/Updates full backup payload to Google Drive
 */
export async function uploadToGoogleDrive(
  accessToken: string,
  payload: FullAppBackupPayload,
  uid?: string
): Promise<boolean> {
  if (!accessToken) return false;
  const jsonStr = JSON.stringify(payload, null, 2);

  try {
    const existing = await findGoogleDriveBackupFile(accessToken);

    if (existing) {
      // Update existing backup file content
      const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media`;
      const res = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: jsonStr,
      });
      if (res.ok) {
        return true;
      }
      if (res.status === 401 || res.status === 403 || res.status === 507) {
        console.warn('[GoogleDrive] Access revoked or quota exceeded (status ' + res.status + ')');
        setGoogleDriveAccessToken(null);
        if (uid) {
          try {
            localStorage.setItem(`mm_drive_perm_prompted_${uid}`, 'true');
          } catch {}
        }
        return false;
      }
      console.warn('[GoogleDrive] Update failed with status:', res.status);
    }

    // Create new backup file via multipart upload
    const boundary = 'money_manager_drive_boundary_99';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    // Attempt 1: Create in appDataFolder
    const metadata = {
      name: BACKUP_FILE_NAME,
      parents: ['appDataFolder'],
      mimeType: 'application/json',
    };

    const multipartBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      jsonStr +
      closeDelimiter;

    const createRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      }
    );

    if (createRes.ok) {
      return true;
    }

    if (createRes.status === 401 || createRes.status === 403 || createRes.status === 507) {
      console.warn('[GoogleDrive] AppDataFolder create failed with status:', createRes.status);
      setGoogleDriveAccessToken(null);
      if (uid) {
        try {
          localStorage.setItem(`mm_drive_perm_prompted_${uid}`, 'true');
        } catch {}
      }
      return false;
    }

    // Attempt 2: If appDataFolder is restricted, create in root drive
    const rootMetadata = {
      name: BACKUP_FILE_NAME,
      mimeType: 'application/json',
    };
    const rootMultipartBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(rootMetadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      jsonStr +
      closeDelimiter;

    const rootCreateRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: rootMultipartBody,
      }
    );

    if (rootCreateRes.ok) {
      return true;
    }

    if (rootCreateRes.status === 401 || rootCreateRes.status === 403 || rootCreateRes.status === 507) {
      console.warn('[GoogleDrive] Root drive create failed with status:', rootCreateRes.status);
      setGoogleDriveAccessToken(null);
      if (uid) {
        try {
          localStorage.setItem(`mm_drive_perm_prompted_${uid}`, 'true');
        } catch {}
      }
      return false;
    }

    return false;
  } catch (err) {
    console.warn('[GoogleDrive] Upload error:', err);
    if (uid) {
      try {
        localStorage.setItem(`mm_drive_perm_prompted_${uid}`, 'true');
      } catch {}
    }
    return false;
  }
}

/**
 * Downloads and parses backup payload from Google Drive
 */
export async function fetchFromGoogleDrive(accessToken: string): Promise<any | null> {
  if (!accessToken) return null;
  try {
    const existing = await findGoogleDriveBackupFile(accessToken);
    if (!existing) return null;

    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${existing.id}?alt=media`;
    const res = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (err) {
    console.warn('[GoogleDrive] Fetch error:', err);
  }
  return null;
}

/**
 * Persists the user's Google Drive permission resolution status (driveAccessGranted, drivePromptResolved: true)
 * inside localStorage, users/${uid}/profile, and shared_accounts/profile_${clean16Id} in Firebase RTDB.
 */
export async function persistDriveResolutionStatus(
  uid: string,
  granted: boolean,
  clean16Id?: string
): Promise<void> {
  if (!uid) return;
  try {
    localStorage.setItem(`mm_drive_perm_prompted_${uid}`, 'true');
    localStorage.setItem(`mm_drive_access_granted_${uid}`, String(granted));
  } catch {}

  const updates: any = {
    driveAccessGranted: Boolean(granted),
    drivePromptResolved: true,
    updatedAt: Date.now(),
  };

  try {
    await update(ref(rtdb, `users/${uid}/profile`), updates);
  } catch (err) {
    console.warn('[AutoBackup] Failed to persist drive status in users/profile:', err);
  }

  const candidateId = clean16Id || (typeof localStorage !== 'undefined' ? localStorage.getItem('app_permanent_16digit_id') : '');
  const cleanId = cleanNumericId(candidateId || '');
  if (cleanId.length === 16) {
    try {
      await update(ref(rtdb, `shared_accounts/profile_${cleanId}`), updates);
    } catch (err) {
      console.warn('[AutoBackup] Failed to persist drive status in shared_accounts/profile:', err);
    }
  }
}

/**
 * Dual-Layer Cloud Backup Engine:
 * 1. Automatically uploads to Google Drive.
 * 2. If Google Drive fails (missing token, expired token, API error), seamlessly
 *    falls back to Firebase RTDB server at users/${uid}/cloud_backup.
 */
export async function executeDualCloudBackup(
  uid: string,
  payload: FullAppBackupPayload
): Promise<{ provider: 'google_drive' | 'firebase'; success: boolean }> {
  if (!uid) return { provider: 'firebase', success: false };

  const accessToken = getGoogleDriveAccessToken();
  let driveSuccess = false;

  if (accessToken) {
    try {
      driveSuccess = await uploadToGoogleDrive(accessToken, payload, uid);
    } catch (e) {
      console.warn('[DualCloudBackup] Google Drive upload attempt failed:', e);
    }
  }

  if (driveSuccess) {
    try {
      localStorage.setItem('pwa_last_cloud_backup_time', new Date().toISOString());
      localStorage.setItem('pwa_last_cloud_backup_provider', 'google_drive');
      localStorage.setItem(`mm_drive_perm_prompted_${uid}`, 'true');
      localStorage.setItem(`mm_drive_access_granted_${uid}`, 'true');
    } catch {}

    persistDriveResolutionStatus(uid, true).catch(() => {});

    // Async server mirror fallback write so Firebase RTDB server is also continuously safeguarded
    saveFirebaseCloudBackup(uid, payload).catch((e) =>
      console.warn('[DualCloudBackup] Background server mirror note:', e)
    );

    return { provider: 'google_drive', success: true };
  }

  // Google Drive upload failed, quota lacked, or access token unavailable:
  // Permanently set prompt flag so user is never prompted again, and seamlessly switch to Firebase RTDB server
  try {
    localStorage.setItem(`mm_drive_perm_prompted_${uid}`, 'true');
  } catch {}

  try {
    await saveFirebaseCloudBackup(uid, payload);
    try {
      localStorage.setItem('pwa_last_cloud_backup_time', new Date().toISOString());
      localStorage.setItem('pwa_last_cloud_backup_provider', 'firebase');
    } catch {}
    return { provider: 'firebase', success: true };
  } catch (err) {
    console.error('[DualCloudBackup] Firebase server fallback failed:', err);
    return { provider: 'firebase', success: false };
  }
}

/**
 * Dual-Layer Cloud Restore Engine:
 * Checks Google Drive first, then seamlessly falls back to Firebase RTDB users/${uid}/cloud_backup.
 */
export async function fetchDualCloudBackup(
  uid: string
): Promise<{ data: any; provider: 'google_drive' | 'firebase' } | null> {
  if (!uid) return null;

  // 1. Check Google Drive first
  const accessToken = getGoogleDriveAccessToken();
  if (accessToken) {
    try {
      const driveData = await fetchFromGoogleDrive(accessToken);
      if (driveData && typeof driveData === 'object' && (driveData.accounts || driveData.settings)) {
        return { data: driveData, provider: 'google_drive' };
      }
    } catch (e) {
      console.warn('[DualCloudBackup] Google Drive fetch failed, checking Firebase fallback:', e);
      try {
        localStorage.setItem(`mm_drive_perm_prompted_${uid}`, 'true');
      } catch {}
    }
  }

  // 2. Seamless Fallback: Check Firebase RTDB server cloud_backup
  try {
    const serverData = await getFirebaseCloudBackup(uid);
    if (serverData && typeof serverData === 'object' && (serverData.accounts || serverData.settings)) {
      return { data: serverData, provider: 'firebase' };
    }
  } catch (e) {
    console.warn('[DualCloudBackup] Firebase server backup fetch error:', e);
  }

  return null;
}

/**
 * Debounced Auto-Backup Dispatcher
 */
let debouncedBackupTimeout: any = null;
let isCloudBackupBlocked = true;

export function setCloudBackupBlocked(blocked: boolean): void {
  isCloudBackupBlocked = blocked;
}

export function isCloudBackupBlockedStatus(): boolean {
  return isCloudBackupBlocked;
}

export function scheduleDualCloudBackup(
  uid: string,
  getPayload: () => FullAppBackupPayload,
  debounceMs = 2500
): void {
  if (!uid) return;
  if (isCloudBackupBlocked) {
    console.log('[DualCloudBackup] Auto backup scheduled write blocked: waiting for cloud inspection/hydration');
    return;
  }

  // If offline, queue payload immediately so it flushes as soon as connection is restored
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    try {
      const payload = getPayload();
      queueOfflineCloudBackup(uid, payload);
    } catch (e) {
      console.warn('[DualCloudBackup] Failed to queue offline backup:', e);
    }
    return;
  }

  if (debouncedBackupTimeout) {
    clearTimeout(debouncedBackupTimeout);
  }

  debouncedBackupTimeout = setTimeout(async () => {
    if (isCloudBackupBlocked) {
      console.log('[DualCloudBackup] Auto backup timeout write blocked: waiting for cloud inspection/hydration');
      return;
    }
    try {
      const payload = getPayload();
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        queueOfflineCloudBackup(uid, payload);
        return;
      }
      await executeDualCloudBackup(uid, payload);
    } catch (err) {
      console.warn('[DualCloudBackup] Debounced backup execution error:', err);
    }
  }, debounceMs);
}

// ============================================================================
// STAGE 4: SERVER TIME OFFSET & SYNCNOW()
// ============================================================================

let serverTimeOffset = 0;
let serverTimeOffsetListenerInitialized = false;

export function initServerTimeOffsetListener(): void {
  if (serverTimeOffsetListenerInitialized) return;
  if (typeof window === 'undefined') return;
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('mm_server_time_offset');
      if (stored) {
        serverTimeOffset = Number(stored) || 0;
      }
    }
    if (!rtdb) return;
    serverTimeOffsetListenerInitialized = true;
    const offsetRef = ref(rtdb, '.info/serverTimeOffset');
    onValue(offsetRef, (snap) => {
      const val = Number(snap.val());
      if (!isNaN(val)) {
        serverTimeOffset = val;
        try {
          localStorage.setItem('mm_server_time_offset', String(val));
        } catch {}
      }
    });
  } catch (e) {
    console.warn('[AutoBackup] Server time offset listener failed:', e);
  }
}

/**
 * Single source of truth for timestamps across the app.
 * Compensates for device clock skew using RTDB .info/serverTimeOffset.
 */
export function syncNow(): number {
  if (!serverTimeOffsetListenerInitialized) {
    initServerTimeOffsetListener();
  }
  let cachedOffset = 0;
  try {
    if (typeof localStorage !== 'undefined') {
      cachedOffset = Number(localStorage.getItem('mm_server_time_offset')) || 0;
    }
  } catch {}
  return Date.now() + (cachedOffset || serverTimeOffset || 0);
}

// ============================================================================
// STAGE 2: USER DATA DETECTION
// ============================================================================

/**
 * Defines whether a state (local or cloud snapshot) contains real user data.
 * Criteria: transactions > 0 || recurring > 0 || budgets > 0 ||
 * any account or category modified from default seed data.
 */
export function hasUserData(state: {
  transactions?: any[];
  recurringTransactions?: any[];
  budgets?: any[];
  accounts?: any[];
  categories?: any[];
} | null | undefined): boolean {
  if (!state) return false;
  const txs = (state.transactions || []).filter((t: any) => !t?.isUneditable);
  if (txs.length > 0) return true;
  if ((state.recurringTransactions || []).length > 0) return true;
  if ((state.budgets || []).length > 0) return true;

  const accs = state.accounts || [];
  if (accs.length > 1) return true;
  if (accs.length === 1) {
    const a = accs[0];
    if (a.id !== 'default_cash' || Number(a.balance) !== 0 || a.name !== 'Cash Wallet') {
      return true;
    }
  }

  const cats = state.categories || [];
  if (cats.length > 0 && cats.length !== INITIAL_CATEGORIES.length) return true;
  if (cats.length > 0) {
    const isCatModified = cats.some((c: any, idx: number) => {
      const init = INITIAL_CATEGORIES[idx];
      if (!init) return true;
      return c.id !== init.id || c.name !== init.name || (Number(c.budgetLimit) > 0);
    });
    if (isCatModified) return true;
  }

  return false;
}

// ============================================================================
// LOCAL TOMBSTONES STORAGE
// ============================================================================

const LOCAL_TOMBSTONES_KEY = 'mm_local_tombstones';

export function loadLocalTombstones(): Record<string, Tombstone> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LOCAL_TOMBSTONES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLocalTombstone(tomb: Tombstone): void {
  if (typeof localStorage === 'undefined' || !tomb?.id) return;
  try {
    const current = loadLocalTombstones();
    current[tomb.id] = tomb;
    localStorage.setItem(LOCAL_TOMBSTONES_KEY, JSON.stringify(current));
  } catch {}
}

export function removeLocalTombstone(id: string): void {
  if (typeof localStorage === 'undefined' || !id) return;
  try {
    const current = loadLocalTombstones();
    if (current[id]) {
      delete current[id];
      localStorage.setItem(LOCAL_TOMBSTONES_KEY, JSON.stringify(current));
    }
  } catch {}
}

// ============================================================================
// STAGE 1: CLOUD ACCOUNT INSPECTION
// ============================================================================

/**
 * Fetches the account's cloud data with one-time get() calls WITHOUT mutating local state.
 * Reads v4 flat nodes first:
 * - shared_accounts/g_manifest_${uid}
 * - shared_accounts/g_${uid}_transactions | _recurring | _accounts | _categories | _budgets | _tombstones
 * Falls back to legacy users/${uid}/cloud_backup and shared_accounts/backup_${uid} if v4 does not exist yet.
 */
export async function fetchCloudAccountSnapshot(uid: string): Promise<{
  snapshot: any;
  source: 'v4' | 'legacy' | 'none';
  provider: 'firebase' | 'google_drive';
} | null> {
  if (!uid || !rtdb) return null;

  try {
    const manifestRef = ref(rtdb, `shared_accounts/g_manifest_${uid}`);
    const txRef = ref(rtdb, `shared_accounts/g_${uid}_transactions`);
    const recRef = ref(rtdb, `shared_accounts/g_${uid}_recurring`);
    const accRef = ref(rtdb, `shared_accounts/g_${uid}_accounts`);
    const catRef = ref(rtdb, `shared_accounts/g_${uid}_categories`);
    const budRef = ref(rtdb, `shared_accounts/g_${uid}_budgets`);
    const tombRef = ref(rtdb, `shared_accounts/g_${uid}_tombstones`);

    const [manSnap, txSnap, recSnap, accSnap, catSnap, budSnap, tombSnap] = await Promise.all([
      get(manifestRef).catch(() => null),
      get(txRef).catch(() => null),
      get(recRef).catch(() => null),
      get(accRef).catch(() => null),
      get(catRef).catch(() => null),
      get(budRef).catch(() => null),
      get(tombRef).catch(() => null),
    ]);

    const hasV4Manifest = manSnap && manSnap.exists() && manSnap.val();
    const hasV4Data = [txSnap, recSnap, accSnap, catSnap, budSnap, tombSnap].some(
      (s) => s && s.exists() && s.val() && s.val().items
    );

    if (hasV4Manifest || hasV4Data) {
      const manVal = (manSnap && manSnap.exists() && manSnap.val()) || {};
      const txVal = (txSnap && txSnap.exists() && txSnap.val()) || {};
      const recVal = (recSnap && recSnap.exists() && recSnap.val()) || {};
      const accVal = (accSnap && accSnap.exists() && accSnap.val()) || {};
      const catVal = (catSnap && catSnap.exists() && catSnap.val()) || {};
      const budVal = (budSnap && budSnap.exists() && budSnap.val()) || {};
      const tombVal = (tombSnap && tombSnap.exists() && tombSnap.val()) || {};

      const txs = Object.values(txVal.items || {});
      const recurring = Object.values(recVal.items || {}).map((r: any) => migrateRecurringRule(r));
      const accounts = Object.values(accVal.items || {});
      const categories = Object.values(catVal.items || {});
      const budgets = Object.values(budVal.items || {});
      const tombstones: Record<string, any> = tombVal.items || {};

      // Seed local tombstones from cloud
      Object.values(tombstones).forEach((t: any) => {
        if (t && t.id) saveLocalTombstone(t);
      });

      return {
        snapshot: {
          transactions: txs,
          recurringTransactions: recurring,
          accounts: accounts,
          categories: categories,
          budgets: budgets,
          tombstones: tombstones,
          settings: manVal.settings || {},
          userProfile: manVal.profile || manVal.settings?.userProfile || {},
          updatedAt: Number(manVal.updatedAt || txVal.updatedAt || 0),
          ownerUid: uid,
        },
        source: 'v4',
        provider: 'firebase',
      };
    }
  } catch (err) {
    console.warn('[AutoBackup] Error reading v4 flat nodes:', err);
  }

  // Fallback to legacy server nodes (Google Drive and Firebase users/${uid}/cloud_backup)
  try {
    const legacy = await fetchDualCloudBackup(uid);
    if (legacy && legacy.data) {
      return {
        snapshot: legacy.data,
        source: 'legacy',
        provider: legacy.provider,
      };
    }
  } catch (err) {
    console.warn('[AutoBackup] Error reading legacy cloud backup:', err);
  }

  return {
    snapshot: null,
    source: 'none',
    provider: 'firebase',
  };
}

// ============================================================================
// STAGE 3: CLEAN V4 MIGRATION & LEGACY SERVER PURGE
// ============================================================================

export async function purgeObsoleteLegacyServerNodes(uid: string): Promise<void> {
  if (!uid || !rtdb) return;
  try {
    await Promise.allSettled([
      set(ref(rtdb, `users/${uid}/cloud_backup`), null),
      set(ref(rtdb, `users/${uid}/auto_backup`), null),
      set(ref(rtdb, `shared_accounts/backup_${uid}`), null),
    ]);
    console.log('[AutoBackup] Obsolete legacy server nodes successfully purged');
  } catch (err) {
    console.warn('[AutoBackup] Error during legacy server nodes purge:', err);
  }
}

export async function writeV4ResolvedState(
  uid: string,
  state: {
    transactions: Transaction[];
    recurringTransactions?: RecurringTransaction[];
    accounts: Account[];
    categories: Category[];
    budgets?: any[];
    settings: AppSettings;
    userProfile?: any;
    tombstones?: Record<string, Tombstone>;
  }
): Promise<boolean> {
  if (!uid || !rtdb) return false;
  const now = syncNow();

  try {
    // 1. Write Manifest Node: shared_accounts/g_manifest_${uid}
    const manifestRef = ref(rtdb, `shared_accounts/g_manifest_${uid}`);
    const effProfile = state.userProfile || state.settings?.userProfile || {};
    const manifestPayload = {
      ownerUid: uid,
      accountName: 'manifest',
      updatedAt: now,
      settings: { ...state.settings, updatedAt: now },
      profile: { ...effProfile, updatedAt: now },
    };
    await set(manifestRef, JSON.parse(JSON.stringify(manifestPayload)));

    // 2. Write Six Flat Collection Nodes
    const collections: Array<{
      name: 'transactions' | 'recurring' | 'accounts' | 'categories' | 'budgets' | 'tombstones';
      items: any[];
    }> = [
      { name: 'transactions', items: state.transactions || [] },
      { name: 'recurring', items: (state.recurringTransactions || []).map((r) => migrateRecurringRule(r)) },
      { name: 'accounts', items: state.accounts || [] },
      { name: 'categories', items: state.categories || [] },
      { name: 'budgets', items: state.budgets || [] },
      {
        name: 'tombstones',
        items: Object.values(state.tombstones || loadLocalTombstones() || {}),
      },
    ];

    for (const col of collections) {
      const itemsMap: Record<string, any> = {};
      col.items.forEach((item) => {
        if (item && item.id) {
          itemsMap[item.id] = {
            ...item,
            updatedAt: item.updatedAt || item.deletedAt || now,
          };
        }
      });

      const colRef = ref(rtdb, `shared_accounts/g_${uid}_${col.name}`);
      const colPayload = {
        ownerUid: uid,
        accountName: col.name,
        updatedAt: now,
        items: itemsMap,
      };
      await set(colRef, JSON.parse(JSON.stringify(colPayload)));
    }

    // 3. Verify via read-back count check
    const verifyTxRef = ref(rtdb, `shared_accounts/g_${uid}_transactions`);
    const verifySnap = await get(verifyTxRef);
    const writtenTxsCount = Object.keys(verifySnap.val()?.items || {}).length;
    const expectedTxsCount = (state.transactions || []).length;

    if (verifySnap.exists() && writtenTxsCount === expectedTxsCount) {
      console.log(`[AutoBackup] V4 write confirmed (${writtenTxsCount} transactions). Purging legacy server nodes...`);
      // 4. ONLY ONCE confirmed: delete all obsolete legacy server nodes
      await purgeObsoleteLegacyServerNodes(uid);
      return true;
    } else {
      console.warn(`[AutoBackup] V4 count check mismatch: expected ${expectedTxsCount}, got ${writtenTxsCount}`);
      return false;
    }
  } catch (err) {
    console.error('[AutoBackup] Failed to write v4 resolved state:', err);
    return false;
  }
}

// ============================================================================
// STAGE 4: LIVE GRANULAR PER-ITEM DELTA SYNCS & TOMBSTONES
// ============================================================================

export const GRANULAR_DIRTY_QUEUE_KEY = 'mm_granular_v4_dirty_queue';

export function loadGranularDirtyQueue(): Record<string, GranularDirtyQueueItem> {
  try {
    const raw = localStorage.getItem(GRANULAR_DIRTY_QUEUE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

export function saveGranularDirtyQueue(queue: Record<string, GranularDirtyQueueItem>): void {
  try {
    localStorage.setItem(GRANULAR_DIRTY_QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.warn('[AutoBackup] Error saving granular dirty queue:', err);
  }
}

export function enqueueGranularDirtyItem(
  item: GranularDirtyQueueItem,
  uid?: string,
  isSyncUnlocked?: boolean
): void {
  const boundUid = localStorage.getItem('mm_bound_account_uid');
  if (!uid || boundUid !== uid || !isSyncUnlocked) {
    return;
  }
  const key = `${item.collection}:${item.id}`;
  const queue = loadGranularDirtyQueue();
  queue[key] = {
    ...item,
    updatedAt: item.updatedAt || syncNow(),
  };
  saveGranularDirtyQueue(queue);
}

export function removeGranularDirtyItem(collection: string, id: string): void {
  const key = `${collection}:${id}`;
  const queue = loadGranularDirtyQueue();
  if (queue[key]) {
    delete queue[key];
    saveGranularDirtyQueue(queue);
  }
}

export function hasGranularDirtyItems(): boolean {
  const queue = loadGranularDirtyQueue();
  return Object.keys(queue).length > 0;
}

export function clearGranularDirtyQueue(): void {
  try {
    localStorage.removeItem(GRANULAR_DIRTY_QUEUE_KEY);
  } catch {}
}

export async function writeGranularDelta(
  uid: string,
  collection: 'transactions' | 'recurring' | 'accounts' | 'categories' | 'budgets',
  item: any,
  isSyncUnlocked?: boolean
): Promise<void> {
  if (!uid || !item || !item.id) return;
  const boundUid = localStorage.getItem('mm_bound_account_uid');
  if (boundUid !== uid || !isSyncUnlocked) {
    return;
  }

  const payloadItem = collection === 'recurring' ? migrateRecurringRule(item) : item;
  const now = payloadItem.updatedAt || syncNow();
  const stamped = { ...payloadItem, updatedAt: now };

  if (!navigator.onLine || !rtdb) {
    enqueueGranularDirtyItem(
      { collection, id: payloadItem.id, action: 'upsert', data: stamped, updatedAt: now },
      uid,
      isSyncUnlocked
    );
    return;
  }

  const colRef = ref(rtdb, `shared_accounts/g_${uid}_${collection}`);
  const payload = {
    ownerUid: uid,
    accountName: collection,
    updatedAt: now,
    [`items/${payloadItem.id}`]: stamped,
  };
  try {
    await update(colRef, JSON.parse(JSON.stringify(payload)));
    removeGranularDirtyItem(collection, item.id);
  } catch (err) {
    console.warn(`[AutoBackup] writeGranularDelta offline or rejected for ${collection}/${item.id}:`, err);
    enqueueGranularDirtyItem(
      { collection, id: item.id, action: 'upsert', data: stamped, updatedAt: now },
      uid,
      isSyncUnlocked
    );
  }
}

export async function writeGranularManifest(
  uid: string,
  settings: AppSettings,
  profile?: any,
  isSyncUnlocked?: boolean
): Promise<void> {
  if (!uid) return;
  const boundUid = localStorage.getItem('mm_bound_account_uid');
  if (boundUid !== uid || !isSyncUnlocked) {
    return;
  }

  const now = syncNow();
  const effProfile = profile || settings.userProfile || {};
  const stampedSettings = { ...settings, updatedAt: now };
  const stampedProfile = { ...effProfile, updatedAt: now };

  if (!navigator.onLine || !rtdb) {
    enqueueGranularDirtyItem(
      { collection: 'settings', id: 'settings', action: 'upsert', data: stampedSettings, updatedAt: now },
      uid,
      isSyncUnlocked
    );
    enqueueGranularDirtyItem(
      { collection: 'profile', id: 'profile', action: 'upsert', data: stampedProfile, updatedAt: now },
      uid,
      isSyncUnlocked
    );
    return;
  }

  const manifestRef = ref(rtdb, `shared_accounts/g_manifest_${uid}`);
  const payload = {
    ownerUid: uid,
    accountName: 'manifest',
    updatedAt: now,
    settings: stampedSettings,
    profile: stampedProfile,
  };
  try {
    await update(manifestRef, JSON.parse(JSON.stringify(payload)));
    removeGranularDirtyItem('settings', 'settings');
    removeGranularDirtyItem('profile', 'profile');
  } catch (err) {
    console.warn('[AutoBackup] writeGranularManifest failed, enqueuing offline:', err);
    enqueueGranularDirtyItem(
      { collection: 'settings', id: 'settings', action: 'upsert', data: stampedSettings, updatedAt: now },
      uid,
      isSyncUnlocked
    );
    enqueueGranularDirtyItem(
      { collection: 'profile', id: 'profile', action: 'upsert', data: stampedProfile, updatedAt: now },
      uid,
      isSyncUnlocked
    );
  }
}

export async function writeGranularDeletion(
  uid: string,
  collection: 'transactions' | 'recurring' | 'accounts' | 'categories' | 'budgets',
  itemId: string,
  isSyncUnlocked?: boolean
): Promise<void> {
  if (!uid || !itemId) return;
  const boundUid = localStorage.getItem('mm_bound_account_uid');
  if (boundUid !== uid || !isSyncUnlocked) {
    return;
  }

  const now = syncNow();
  saveLocalTombstone({ id: itemId, collection, deletedAt: now });

  if (!navigator.onLine || !rtdb) {
    enqueueGranularDirtyItem(
      { collection, id: itemId, action: 'delete', updatedAt: now },
      uid,
      isSyncUnlocked
    );
    return;
  }

  try {
    // 1. FIRST write the tombstone to shared_accounts/g_${uid}_tombstones
    const tombRef = ref(rtdb, `shared_accounts/g_${uid}_tombstones`);
    const tombPayload = {
      ownerUid: uid,
      accountName: 'tombstones',
      updatedAt: now,
      [`items/${itemId}`]: { id: itemId, collection, deletedAt: now },
    };
    await update(tombRef, JSON.parse(JSON.stringify(tombPayload)));

    // 2. ONLY AFTER tombstone write succeeds: remove items/${itemId} from collection
    const colRef = ref(rtdb, `shared_accounts/g_${uid}_${collection}`);
    const colPayload = {
      ownerUid: uid,
      accountName: collection,
      updatedAt: now,
      [`items/${itemId}`]: null,
    };
    await update(colRef, JSON.parse(JSON.stringify(colPayload)));
    removeGranularDirtyItem(collection, itemId);
  } catch (err) {
    console.warn(`[AutoBackup] writeGranularDeletion failed, enqueuing offline delete for ${collection}/${itemId}:`, err);
    enqueueGranularDirtyItem(
      { collection, id: itemId, action: 'delete', updatedAt: now },
      uid,
      isSyncUnlocked
    );
  }
}

export async function flushGranularDirtyQueue(uid: string): Promise<number> {
  if (!uid || !rtdb || !navigator.onLine) return 0;
  const boundUid = localStorage.getItem('mm_bound_account_uid');
  if (boundUid !== uid) return 0;

  const queue = loadGranularDirtyQueue();
  const items = Object.values(queue);
  if (items.length === 0) return 0;

  let flushedCount = 0;

  for (const item of items) {
    if (!item || !item.collection || !item.id) continue;

    try {
      if (item.collection === 'settings') {
        const snap = await get(ref(rtdb, `shared_accounts/g_manifest_${uid}/settings`));
        const remoteUpdated = Number(snap.val()?.updatedAt || 0);
        if (item.updatedAt > remoteUpdated) {
          const payload = {
            ownerUid: uid,
            accountName: 'manifest',
            updatedAt: item.updatedAt,
            settings: item.data,
          };
          await update(ref(rtdb, `shared_accounts/g_manifest_${uid}`), JSON.parse(JSON.stringify(payload)));
        }
        removeGranularDirtyItem(item.collection, item.id);
        flushedCount++;
        continue;
      }

      if (item.collection === 'profile') {
        const snap = await get(ref(rtdb, `shared_accounts/g_manifest_${uid}/profile`));
        const remoteUpdated = Number(snap.val()?.updatedAt || 0);
        if (item.updatedAt > remoteUpdated) {
          const payload = {
            ownerUid: uid,
            accountName: 'manifest',
            updatedAt: item.updatedAt,
            profile: item.data,
          };
          await update(ref(rtdb, `shared_accounts/g_manifest_${uid}`), JSON.parse(JSON.stringify(payload)));
        }
        removeGranularDirtyItem(item.collection, item.id);
        flushedCount++;
        continue;
      }

      // Collections: transactions, recurring, accounts, categories, budgets
      const validCol = item.collection as 'transactions' | 'recurring' | 'accounts' | 'categories' | 'budgets';

      // Check if server tombstone exists
      const tombSnap = await get(ref(rtdb, `shared_accounts/g_${uid}_tombstones/items/${item.id}`));
      const tombVal = tombSnap.val();
      const serverDeletedAt = Number(tombVal?.deletedAt || 0);

      if (serverDeletedAt > item.updatedAt) {
        // Deleted on server after this edit, do not resurrect
        saveLocalTombstone({ id: item.id, collection: validCol, deletedAt: serverDeletedAt });
        removeGranularDirtyItem(item.collection, item.id);
        flushedCount++;
        continue;
      }

      const itemSnap = await get(ref(rtdb, `shared_accounts/g_${uid}_${validCol}/items/${item.id}`));
      const serverVal = itemSnap.val();
      const serverUpdatedAt = Number(serverVal?.updatedAt || serverVal?.createdAt || 0);

      if (item.action === 'upsert') {
        if (item.updatedAt > serverUpdatedAt) {
          const colRef = ref(rtdb, `shared_accounts/g_${uid}_${validCol}`);
          const payload = {
            ownerUid: uid,
            accountName: validCol,
            updatedAt: item.updatedAt,
            [`items/${item.id}`]: { ...item.data, updatedAt: item.updatedAt },
          };
          await update(colRef, JSON.parse(JSON.stringify(payload)));
        }
        removeGranularDirtyItem(item.collection, item.id);
        flushedCount++;
      } else if (item.action === 'delete') {
        if (item.updatedAt >= serverUpdatedAt) {
          // 1. Write tombstone first
          const tombRef = ref(rtdb, `shared_accounts/g_${uid}_tombstones`);
          const tombPayload = {
            ownerUid: uid,
            accountName: 'tombstones',
            updatedAt: item.updatedAt,
            [`items/${item.id}`]: { id: item.id, collection: validCol, deletedAt: item.updatedAt },
          };
          await update(tombRef, JSON.parse(JSON.stringify(tombPayload)));

          // 2. Remove item from collection
          const colRef = ref(rtdb, `shared_accounts/g_${uid}_${validCol}`);
          const colPayload = {
            ownerUid: uid,
            accountName: validCol,
            updatedAt: item.updatedAt,
            [`items/${item.id}`]: null,
          };
          await update(colRef, JSON.parse(JSON.stringify(colPayload)));
        }
        removeGranularDirtyItem(item.collection, item.id);
        flushedCount++;
      }
    } catch (err) {
      console.warn(`[AutoBackup] Flush interrupted at item ${item.collection}/${item.id}:`, err);
      // Connection may have dropped mid-flush! Stop here so remaining items stay in the dirty queue!
      break;
    }
  }

  return flushedCount;
}

export async function pullLatestRemoteState(uid: string): Promise<{
  manifest?: any;
  transactions?: Record<string, Transaction>;
  recurring?: Record<string, RecurringTransaction>;
  accounts?: Record<string, Account>;
  categories?: Record<string, Category>;
  budgets?: Record<string, any>;
  tombstones?: Record<string, Tombstone>;
} | null> {
  if (!uid || !rtdb || !navigator.onLine) return null;
  try {
    const [manSnap, txSnap, recSnap, accSnap, catSnap, budSnap, tombSnap] = await Promise.all([
      get(ref(rtdb, `shared_accounts/g_manifest_${uid}`)),
      get(ref(rtdb, `shared_accounts/g_${uid}_transactions`)),
      get(ref(rtdb, `shared_accounts/g_${uid}_recurring`)),
      get(ref(rtdb, `shared_accounts/g_${uid}_accounts`)),
      get(ref(rtdb, `shared_accounts/g_${uid}_categories`)),
      get(ref(rtdb, `shared_accounts/g_${uid}_budgets`)),
      get(ref(rtdb, `shared_accounts/g_${uid}_tombstones`)),
    ]);

    return {
      manifest: manSnap.exists() ? manSnap.val() : null,
      transactions: txSnap.exists() ? (txSnap.val()?.items || {}) : {},
      recurring: recSnap.exists()
        ? Object.fromEntries(
            Object.entries(recSnap.val()?.items || {}).map(([k, v]) => [k, migrateRecurringRule(v as any)])
          )
        : {},
      accounts: accSnap.exists() ? (accSnap.val()?.items || {}) : {},
      categories: catSnap.exists() ? (catSnap.val()?.items || {}) : {},
      budgets: budSnap.exists() ? (budSnap.val()?.items || {}) : {},
      tombstones: tombSnap.exists() ? (tombSnap.val()?.items || {}) : {},
    };
  } catch (err) {
    console.warn('[AutoBackup] Error in pullLatestRemoteState:', err);
    return null;
  }
}

export function attachV4LiveListeners(
  uid: string,
  callbacks: {
    onTransactions?: (items: Transaction[], rawItems: Record<string, any>) => void;
    onRecurring?: (items: RecurringTransaction[], rawItems: Record<string, any>) => void;
    onAccounts?: (items: Account[], rawItems: Record<string, any>) => void;
    onCategories?: (items: Category[], rawItems: Record<string, any>) => void;
    onBudgets?: (items: any[], rawItems: Record<string, any>) => void;
    onTombstones?: (items: Tombstone[], rawItems: Record<string, any>) => void;
    onManifest?: (settings: any, profile: any) => void;
  }
): () => void {
  if (!uid || !rtdb) return () => {};

  const manRef = ref(rtdb, `shared_accounts/g_manifest_${uid}`);
  const txRef = ref(rtdb, `shared_accounts/g_${uid}_transactions`);
  const recRef = ref(rtdb, `shared_accounts/g_${uid}_recurring`);
  const accRef = ref(rtdb, `shared_accounts/g_${uid}_accounts`);
  const catRef = ref(rtdb, `shared_accounts/g_${uid}_categories`);
  const budRef = ref(rtdb, `shared_accounts/g_${uid}_budgets`);
  const tombRef = ref(rtdb, `shared_accounts/g_${uid}_tombstones`);

  const unsubs: (() => void)[] = [];

  const attachListener = (r: any, cb: (val: any) => void) => {
    let lastHash = '';
    const listener = onValue(
      r,
      (snap) => {
        if (!snap.exists()) return;
        const val = snap.val();
        if (!val) return;
        const hash = JSON.stringify(val);
        if (hash === lastHash) return;
        lastHash = hash;
        cb(val);
      },
      (err) => console.warn('[AutoBackup] V4 listener note:', err)
    );
    unsubs.push(() => {
      off(r, 'value', listener as any);
    });
  };

  if (callbacks.onManifest) {
    attachListener(manRef, (val) => callbacks.onManifest!(val.settings, val.profile));
  }
  if (callbacks.onTransactions) {
    attachListener(txRef, (val) => {
      const itemsMap = val.items || {};
      callbacks.onTransactions!(Object.values(itemsMap), itemsMap);
    });
  }
  if (callbacks.onRecurring) {
    attachListener(recRef, (val) => {
      const itemsMap = val.items || {};
      const migrated = Object.values(itemsMap).map((r: any) => migrateRecurringRule(r));
      callbacks.onRecurring!(migrated, itemsMap);
    });
  }
  if (callbacks.onAccounts) {
    attachListener(accRef, (val) => {
      const itemsMap = val.items || {};
      callbacks.onAccounts!(Object.values(itemsMap), itemsMap);
    });
  }
  if (callbacks.onCategories) {
    attachListener(catRef, (val) => {
      const itemsMap = val.items || {};
      callbacks.onCategories!(Object.values(itemsMap), itemsMap);
    });
  }
  if (callbacks.onBudgets) {
    attachListener(budRef, (val) => {
      const itemsMap = val.items || {};
      callbacks.onBudgets!(Object.values(itemsMap), itemsMap);
    });
  }
  if (callbacks.onTombstones) {
    attachListener(tombRef, (val) => {
      const itemsMap = val.items || {};
      callbacks.onTombstones!(Object.values(itemsMap), itemsMap);
    });
  }

  return () => {
    unsubs.forEach((unsub) => {
      try {
        unsub();
      } catch {}
    });
  };
}
