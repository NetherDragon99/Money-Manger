import {
  BillPaymentInfo,
  BillPerson,
  BillSession,
  BillSplitStorageBundle,
  SavedBillFriend,
  SavedBillGroup,
} from '../types';
import { generateBillId } from './billSplitEngine';
import { getItemFromIndexedDB, saveItemToIndexedDB } from './indexedDB';
import { debouncedPersist, flushOfflineQueue } from './persistQueue';
import { loadDeduplicatedContacts } from './shareFolders';

export const BILL_SPLIT_STORAGE_KEY = 'mm_bill_split_v1';
const IDB_STORE_KEY = 'bill_splits';
export const CLOUD_RETENTION_DAYS = 30;
const THIRTY_DAYS_MS = CLOUD_RETENTION_DAYS * 24 * 60 * 60 * 1000;

const EMPTY_BUNDLE: BillSplitStorageBundle = {
  sessions: [],
  activeDraftId: null,
  friends: [],
  groups: [],
  defaultPaymentInfo: {},
};

let pendingFlushCallback: (() => void) | null = null;

function notifyUpdated(): void {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('bill_splits_updated'));
    } catch {}
  }
}

export function loadBillSplitBundle(): BillSplitStorageBundle {
  if (typeof localStorage === 'undefined') {
    return { ...EMPTY_BUNDLE };
  }
  try {
    const raw = localStorage.getItem(BILL_SPLIT_STORAGE_KEY);
    if (!raw) return { ...EMPTY_BUNDLE };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...EMPTY_BUNDLE };
    return {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      activeDraftId: typeof parsed.activeDraftId === 'string' ? parsed.activeDraftId : null,
      friends: Array.isArray(parsed.friends) ? parsed.friends : [],
      groups: Array.isArray(parsed.groups) ? parsed.groups : [],
      defaultPaymentInfo:
        parsed.defaultPaymentInfo && typeof parsed.defaultPaymentInfo === 'object'
          ? parsed.defaultPaymentInfo
          : {},
    };
  } catch {
    return { ...EMPTY_BUNDLE };
  }
}

function writeBundleNow(bundle: BillSplitStorageBundle): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(BILL_SPLIT_STORAGE_KEY, JSON.stringify(bundle));
    } catch (err) {
      console.warn('[BillSplitStore] Failed saving to localStorage:', err);
    }
  }
  saveItemToIndexedDB(IDB_STORE_KEY, bundle).catch(() => {});
  notifyUpdated();
}

export function saveBillSplitBundle(bundle: BillSplitStorageBundle, immediate = false): void {
  const writer = () => {
    pendingFlushCallback = null;
    writeBundleNow(bundle);
  };
  if (immediate) {
    writer();
    return;
  }
  pendingFlushCallback = writer;
  debouncedPersist(BILL_SPLIT_STORAGE_KEY, writer);
}

export function flushBillSplitPersist(): void {
  if (pendingFlushCallback) {
    const cb = pendingFlushCallback;
    pendingFlushCallback = null;
    cb();
  }
  flushOfflineQueue().catch(() => {});
}

export async function hydrateBillSplitFromIndexedDB(): Promise<BillSplitStorageBundle | null> {
  const existing = loadBillSplitBundle();
  if (existing.sessions.length > 0 || existing.friends.length > 0 || existing.groups.length > 0) {
    return existing;
  }
  const idbData = await getItemFromIndexedDB<BillSplitStorageBundle>(IDB_STORE_KEY);
  if (idbData && typeof idbData === 'object') {
    const hydrated: BillSplitStorageBundle = {
      sessions: Array.isArray(idbData.sessions) ? idbData.sessions : [],
      activeDraftId: typeof idbData.activeDraftId === 'string' ? idbData.activeDraftId : null,
      friends: Array.isArray(idbData.friends) ? idbData.friends : [],
      groups: Array.isArray(idbData.groups) ? idbData.groups : [],
      defaultPaymentInfo: idbData.defaultPaymentInfo || {},
    };
    writeBundleNow(hydrated);
    return hydrated;
  }
  return null;
}

export function createNewBillSession(params: {
  ownerName: string;
  ownerAvatar?: string;
  ownerPhotoURL?: string;
  ownerUid?: string;
  ownerNumericId?: string;
  currency: string;
  title?: string;
  icon?: string;
  defaultPaymentInfo?: BillPaymentInfo;
}): BillSession {
  const now = Date.now();
  const ownerPerson: BillPerson = {
    id: 'person_owner',
    name: params.ownerName?.trim() || 'Me',
    avatar: params.ownerAvatar || '👤',
    photoURL: params.ownerPhotoURL,
    kind: 'owner',
    numericId: params.ownerNumericId,
    boundUid: params.ownerUid,
    role: 'participant',
    approval: 'approved',
    paidFlag: true,
  };

  return {
    id: `bill_${generateBillId()}`,
    title: params.title || '',
    icon: params.icon || '🧾',
    currency: params.currency || '£',
    createdAt: now,
    updatedAt: now,
    status: 'draft',
    ownerUid: params.ownerUid,
    ownerName: ownerPerson.name,
    people: [ownerPerson],
    items: [],
    extras: [],
    rounding: { step: 0, remainderTo: 'owner' },
    payers: [],
    payerMode: 'owner_all',
    paymentInfo: params.defaultPaymentInfo ? { ...params.defaultPaymentInfo } : {},
    live: { enabled: false, defaultPermission: 'view_only', autoAccept: false, linkActive: true },
  };
}

export function getBillSessionById(id: string): BillSession | null {
  const bundle = loadBillSplitBundle();
  return bundle.sessions.find((s) => s.id === id) || null;
}

export function getActiveBillDraft(): BillSession | null {
  const bundle = loadBillSplitBundle();
  if (!bundle.activeDraftId) return null;
  const draft = bundle.sessions.find((s) => s.id === bundle.activeDraftId);
  if (!draft || draft.status === 'settled') return null;
  return draft;
}

export function saveBillSession(
  session: BillSession,
  options?: { asActiveDraft?: boolean; immediate?: boolean }
): BillSession {
  const bundle = loadBillSplitBundle();
  const updated: BillSession = {
    ...session,
    updatedAt: Date.now(),
  };
  const idx = bundle.sessions.findIndex((s) => s.id === updated.id);
  const nextSessions = [...bundle.sessions];
  if (idx >= 0) {
    nextSessions[idx] = updated;
  } else {
    nextSessions.unshift(updated);
  }
  // Keep newest updated first
  nextSessions.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));

  let nextDraftId = bundle.activeDraftId;
  if (options?.asActiveDraft === true) {
    nextDraftId = updated.status === 'settled' ? null : updated.id;
  } else if (options?.asActiveDraft === false && nextDraftId === updated.id) {
    nextDraftId = null;
  }

  saveBillSplitBundle(
    {
      ...bundle,
      sessions: nextSessions.slice(0, 120),
      activeDraftId: nextDraftId,
    },
    Boolean(options?.immediate)
  );
  return updated;
}

export function deleteBillSession(id: string): void {
  const bundle = loadBillSplitBundle();
  const nextSessions = bundle.sessions.filter((s) => s.id !== id);
  const nextDraftId = bundle.activeDraftId === id ? null : bundle.activeDraftId;
  saveBillSplitBundle({ ...bundle, sessions: nextSessions, activeDraftId: nextDraftId }, true);
}

export function duplicateBillSession(id: string): BillSession | null {
  const source = getBillSessionById(id);
  if (!source) return null;
  const now = Date.now();
  const copy: BillSession = {
    ...JSON.parse(JSON.stringify(source)),
    id: `bill_${generateBillId()}`,
    createdAt: now,
    updatedAt: now,
    settledAt: undefined,
    cloudCleanedAt: undefined,
    linkedTransactionId: undefined,
    status: 'draft',
    live: { enabled: false, defaultPermission: 'view_only', autoAccept: false, linkActive: true },
  };
  copy.people = copy.people.map((p) => ({
    ...p,
    paidFlag: p.kind === 'owner',
    paidAmountMinor: undefined,
  }));
  return saveBillSession(copy, { asActiveDraft: true, immediate: true });
}

export function getUnpaidSummaryFromSessions(
  computeShareFn: (s: BillSession) => Record<string, number>
): { billsCount: number; unpaidPeopleCount: number; unpaidAmountMinor: number } {
  const bundle = loadBillSplitBundle();
  let billsCount = 0;
  let unpaidPeopleCount = 0;
  let unpaidAmountMinor = 0;

  for (const s of bundle.sessions) {
    if (s.status !== 'settled' && s.status !== 'locked') continue;
    const totals = computeShareFn(s);
    const unpaidPeople = s.people.filter(
      (p) => p.kind !== 'owner' && p.approval === 'approved' && !p.paidFlag && (totals[p.id] || 0) > 0
    );
    if (unpaidPeople.length > 0) {
      billsCount++;
      unpaidPeopleCount += unpaidPeople.length;
      unpaidAmountMinor += unpaidPeople.reduce((acc, p) => acc + (totals[p.id] || 0), 0);
    }
  }
  return { billsCount, unpaidPeopleCount, unpaidAmountMinor };
}

/**
 * Merges Bill Split saved friends with contacts known from Shared Accounts without modifying shareFolders.
 */
export function getMergedSavedFriends(excludeNumericId?: string): SavedBillFriend[] {
  const bundle = loadBillSplitBundle();
  const map = new Map<string, SavedBillFriend>();

  for (const f of bundle.friends) {
    const key = f.numericId ? `id_${f.numericId}` : `name_${f.name.trim().toLowerCase()}`;
    map.set(key, f);
  }

  try {
    const shareContacts = loadDeduplicatedContacts(excludeNumericId);
    for (const c of shareContacts) {
      const key = c.numericId ? `id_${c.numericId}` : `name_${c.name.trim().toLowerCase()}`;
      if (!map.has(key)) {
        map.set(key, {
          id: `friend_${c.numericId}`,
          name: c.name,
          avatar: c.avatar || '👤',
          numericId: c.numericId,
          usageCount: 0,
          updatedAt: c.updatedAt || Date.now(),
        });
      }
    }
  } catch {}

  return Array.from(map.values()).sort(
    (a, b) => (b.usageCount || 0) - (a.usageCount || 0) || (b.updatedAt || 0) - (a.updatedAt || 0)
  );
}

export function upsertSavedFriend(
  friend: Omit<SavedBillFriend, 'id' | 'usageCount' | 'updatedAt'> & { id?: string; bumpUsage?: boolean }
): SavedBillFriend {
  const bundle = loadBillSplitBundle();
  const cleanName = friend.name.trim();
  const now = Date.now();
  const existingIdx = bundle.friends.findIndex(
    (f) =>
      (friend.id && f.id === friend.id) ||
      (friend.numericId && f.numericId === friend.numericId) ||
      f.name.trim().toLowerCase() === cleanName.toLowerCase()
  );

  let saved: SavedBillFriend;
  const nextFriends = [...bundle.friends];
  if (existingIdx >= 0) {
    const prev = nextFriends[existingIdx];
    saved = {
      ...prev,
      name: cleanName || prev.name,
      avatar: friend.avatar || prev.avatar,
      photoURL: friend.photoURL || prev.photoURL,
      numericId: friend.numericId || prev.numericId,
      uid: friend.uid || prev.uid,
      instaPay: friend.instaPay ?? prev.instaPay,
      wallet: friend.wallet ?? prev.wallet,
      usageCount: friend.bumpUsage ? (prev.usageCount || 0) + 1 : prev.usageCount || 0,
      updatedAt: now,
    };
    nextFriends[existingIdx] = saved;
  } else {
    saved = {
      id: friend.id || `friend_${generateBillId().slice(0, 10)}`,
      name: cleanName,
      avatar: friend.avatar || '👤',
      photoURL: friend.photoURL,
      numericId: friend.numericId,
      uid: friend.uid,
      instaPay: friend.instaPay,
      wallet: friend.wallet,
      usageCount: friend.bumpUsage ? 1 : 0,
      updatedAt: now,
    };
    nextFriends.unshift(saved);
  }

  saveBillSplitBundle({ ...bundle, friends: nextFriends }, true);
  return saved;
}

export function deleteSavedFriend(friendId: string): void {
  const bundle = loadBillSplitBundle();
  const nextFriends = bundle.friends.filter((f) => f.id !== friendId);
  const nextGroups = bundle.groups.map((g) => ({
    ...g,
    memberIds: g.memberIds.filter((id) => id !== friendId),
  }));
  saveBillSplitBundle({ ...bundle, friends: nextFriends, groups: nextGroups }, true);
}

export function upsertSavedGroup(group: Omit<SavedBillGroup, 'id' | 'updatedAt'> & { id?: string }): SavedBillGroup {
  const bundle = loadBillSplitBundle();
  const now = Date.now();
  const existingIdx = group.id ? bundle.groups.findIndex((g) => g.id === group.id) : -1;
  const nextGroup: SavedBillGroup = {
    id: group.id || `grp_${generateBillId().slice(0, 10)}`,
    name: group.name.trim(),
    icon: group.icon || '👥',
    memberIds: Array.from(new Set(group.memberIds)),
    updatedAt: now,
  };
  const nextGroups = [...bundle.groups];
  if (existingIdx >= 0) nextGroups[existingIdx] = nextGroup;
  else nextGroups.unshift(nextGroup);
  saveBillSplitBundle({ ...bundle, groups: nextGroups }, true);
  return nextGroup;
}

export function deleteSavedGroup(groupId: string): void {
  const bundle = loadBillSplitBundle();
  saveBillSplitBundle(
    { ...bundle, groups: bundle.groups.filter((g) => g.id !== groupId) },
    true
  );
}

export function saveDefaultPaymentInfo(info: BillPaymentInfo): void {
  const bundle = loadBillSplitBundle();
  saveBillSplitBundle({ ...bundle, defaultPaymentInfo: { ...info } }, true);
}

export function importBillSplitBundle(
  incoming: Partial<BillSplitStorageBundle> | null | undefined,
  mode: 'merge' | 'replace' = 'merge'
): number {
  if (!incoming || typeof incoming !== 'object') return 0;
  const current = loadBillSplitBundle();
  const incSessions = Array.isArray(incoming.sessions) ? incoming.sessions : [];
  const incFriends = Array.isArray(incoming.friends) ? incoming.friends : [];
  const incGroups = Array.isArray(incoming.groups) ? incoming.groups : [];

  if (mode === 'replace') {
    const replaced: BillSplitStorageBundle = {
      sessions: incSessions,
      activeDraftId: typeof incoming.activeDraftId === 'string' ? incoming.activeDraftId : null,
      friends: incFriends,
      groups: incGroups,
      defaultPaymentInfo: incoming.defaultPaymentInfo || current.defaultPaymentInfo || {},
    };
    saveBillSplitBundle(replaced, true);
    return incSessions.length;
  }

  const sessMap = new Map<string, BillSession>();
  for (const s of current.sessions) sessMap.set(s.id, s);
  for (const s of incSessions) {
    if (!s || !s.id) continue;
    const prev = sessMap.get(s.id);
    if (!prev || (s.updatedAt || 0) >= (prev.updatedAt || 0)) {
      sessMap.set(s.id, s);
    }
  }

  const friendMap = new Map<string, SavedBillFriend>();
  for (const f of current.friends) friendMap.set(f.id, f);
  for (const f of incFriends) {
    if (!f || !f.id) continue;
    const prev = friendMap.get(f.id);
    if (!prev || (f.updatedAt || 0) >= (prev.updatedAt || 0)) {
      friendMap.set(f.id, f);
    }
  }

  const groupMap = new Map<string, SavedBillGroup>();
  for (const g of current.groups) groupMap.set(g.id, g);
  for (const g of incGroups) {
    if (!g || !g.id) continue;
    const prev = groupMap.get(g.id);
    if (!prev || (g.updatedAt || 0) >= (prev.updatedAt || 0)) {
      groupMap.set(g.id, g);
    }
  }

  saveBillSplitBundle(
    {
      sessions: Array.from(sessMap.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
      activeDraftId: current.activeDraftId || incoming.activeDraftId || null,
      friends: Array.from(friendMap.values()),
      groups: Array.from(groupMap.values()),
      defaultPaymentInfo: {
        ...(incoming.defaultPaymentInfo || {}),
        ...(current.defaultPaymentInfo || {}),
      },
    },
    true
  );

  return incSessions.length;
}

/**
 * Client-side 30-day cloud cleanup: removes live RTDB mirrors for bills settled > 30 days ago
 * when the owner is online and opens Bill Split / History, while preserving local history intact.
 */
export async function cleanupExpiredCloudBillsClientSide(
  onRemoveCloudNode?: (billId: string) => Promise<void>
): Promise<string[]> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return [];
  const bundle = loadBillSplitBundle();
  const cutoff = Date.now() - THIRTY_DAYS_MS;
  const cleanedIds: string[] = [];

  for (const s of bundle.sessions) {
    const settledTs = s.settledAt || (s.status === 'settled' ? s.updatedAt : undefined);
    if (
      s.status === 'settled' &&
      settledTs &&
      settledTs < cutoff &&
      s.live?.enabled &&
      !s.cloudCleanedAt
    ) {
      try {
        if (onRemoveCloudNode) {
          await onRemoveCloudNode(s.id);
        }
        cleanedIds.push(s.id);
      } catch (err) {
        console.warn(`[BillSplitStore] Deferred cloud cleanup for ${s.id}:`, err);
      }
    }
  }

  if (cleanedIds.length > 0) {
    const now = Date.now();
    const cleanedSet = new Set(cleanedIds);
    saveBillSplitBundle(
      {
        ...bundle,
        sessions: bundle.sessions.map((s) =>
          cleanedSet.has(s.id)
            ? {
                ...s,
                cloudCleanedAt: now,
                live: s.live ? { ...s.live, linkActive: false, enabled: false } : undefined,
              }
            : s
        ),
      },
      true
    );
  }

  return cleanedIds;
}
