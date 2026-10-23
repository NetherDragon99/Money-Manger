/**
 * Automated Scheduled Backup Engine for PWA
 * Supports File System Access API (window.showDirectoryPicker) with IndexedDB handle persistence
 * and background execution loops on visibilitychange / intervals.
 */

import { AppData, Account, Category, Transaction, AppSettings, RecurringTransaction } from '../types';
import {
  getGoogleDriveAccessToken,
  setGoogleDriveAccessToken,
  saveFirebaseCloudBackup,
  getFirebaseCloudBackup,
  rtdb,
} from './firebase';
import { ref, update } from 'firebase/database';
import { cleanNumericId } from './userId';
import { ShareFolder, loadMyShareFolders, loadReceivedShareFolders } from './shareFolders';
import { queueOfflineCloudBackup } from './persistQueue';

export interface FullAppBackupPayload {
  version: string;
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
    version: '1.1.45',
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
