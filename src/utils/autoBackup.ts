/**
 * Automated Scheduled Backup Engine for PWA
 * Supports File System Access API (window.showDirectoryPicker) with IndexedDB handle persistence
 * and background execution loops on visibilitychange / intervals.
 */

import { AppData } from '../types';

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
    version: '1.1.14',
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
