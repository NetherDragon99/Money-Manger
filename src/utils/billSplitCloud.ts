import { get, off, onValue, ref, remove, set } from 'firebase/database';
import {
  BillGuestPermission,
  BillItem,
  BillPerson,
  BillSession,
} from '../types';
import {
  generateBillId,
  getEffectivePersonPermission,
  mergeCloudClaimsIntoItem,
} from './billSplitEngine';
import { deleteBillSession } from './billSplitStore';
import { auth, ensureFirebaseAuth, rtdb } from './firebase';

const initializedCloudBills = new Set<string>();

export const LIVE_BILL_DELETE_GRACE_MS = 24 * 60 * 60 * 1000;
const PENDING_CLOUD_DELETE_KEY = 'mm_bill_cloud_pending_delete';

let serverClockOffsetMs = 0;
let serverOffsetInitialized = false;

function ensureServerClockOffset(): void {
  if (serverOffsetInitialized || typeof window === 'undefined') return;
  serverOffsetInitialized = true;
  try {
    onValue(ref(rtdb, '.info/serverTimeOffset'), (snap) => {
      const val = Number(snap.val());
      if (Number.isFinite(val)) {
        serverClockOffsetMs = val;
      }
    });
  } catch {}
}

function getServerNowMs(): Promise<number> {
  ensureServerClockOffset();
  return new Promise((resolve) => {
    let settled = false;
    const infoRef = ref(rtdb, '.info/serverTimeOffset');
    const finish = () => {
      if (settled) return;
      settled = true;
      try {
        off(infoRef, 'value', handler);
      } catch {}
      resolve(Date.now() + serverClockOffsetMs);
    };
    const handler = (snap: any) => {
      const val = Number(snap.val());
      if (Number.isFinite(val)) {
        serverClockOffsetMs = val;
      }
      finish();
    };
    try {
      onValue(infoRef, handler, () => finish());
    } catch {
      finish();
    }
    setTimeout(finish, 400);
  });
}

function isPermissionDenied(err: any): boolean {
  const s = String(err?.code || err?.message || err || '').toLowerCase();
  return s.includes('permission');
}

/**
 * Writes a keyed map under `path`. Uses one atomic write when allowed, otherwise falls back to
 * per-child writes so publishing keeps working under stricter per-child security rules.
 */
async function writeKeyedMap(path: string, map: Record<string, any> | null): Promise<void> {
  const r = ref(rtdb, path);
  const next = map && Object.keys(map).length > 0 ? map : null;
  try {
    await set(r, next);
    return;
  } catch (err) {
    if (!isPermissionDenied(err)) throw err;
  }
  const snap = await get(r);
  const existingKeys = snap.exists() ? Object.keys(snap.val() || {}) : [];
  const nextKeys = new Set(Object.keys(next || {}));
  await Promise.all([
    ...Object.entries(next || {}).map(([k, v]) => set(ref(rtdb, `${path}/${k}`), v)),
    ...existingKeys.filter((k) => !nextKeys.has(k)).map((k) => remove(ref(rtdb, `${path}/${k}`))),
  ]);
}

function stripUndefined<T>(val: T): T {
  if (Array.isArray(val)) {
    return val.map((v) => stripUndefined(v)) as unknown as T;
  }
  if (val && typeof val === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val as Record<string, any>)) {
      if (v !== undefined) {
        out[k] = stripUndefined(v);
      }
    }
    return out as T;
  }
  return val;
}

export function getLiveBillShareUrl(billId: string): string {
  if (typeof window === 'undefined') return `?bill=${encodeURIComponent(billId)}`;
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set('bill', billId);
  return url.toString();
}

export async function publishOrSyncBillToCloud(session: BillSession): Promise<boolean> {
  if (!session?.id || typeof navigator === 'undefined' || !navigator.onLine) return false;

  const user = await ensureFirebaseAuth();
  const ownerUid = user?.uid;
  if (!ownerUid) return false;

  const liveCfg = {
    enabled: Boolean(session.live?.enabled),
    defaultPermission: (session.live?.defaultPermission || 'view_only') as BillGuestPermission,
    autoAccept: Boolean(session.live?.autoAccept),
    linkActive: session.live?.linkActive ?? true,
  };

  const metaPayload = stripUndefined({
    id: session.id,
    title: session.title || '',
    icon: session.icon || '🧾',
    currency: session.currency || '£',
    status: session.status === 'draft' ? 'open' : session.status,
    ownerUid,
    ownerName: session.ownerName || 'Owner',
    statedTotalMinor: session.statedTotalMinor ?? null,
    diffResolution: session.diffResolution ?? null,
    rounding: session.rounding || { step: 0, remainderTo: 'owner' },
    payerMode: session.payerMode || 'owner_all',
    payers: session.payers || [],
    paymentInfo: {
      instaPay: session.paymentInfo?.instaPay || '',
      wallet: session.paymentInfo?.wallet || '',
      note: session.paymentInfo?.note || '',
    },
    extras: session.extras || [],
    live: liveCfg,
    expiresAt: session.cloudExpiresAt ?? null,
    deletedByOwner: session.deletedByOwner ? true : null,
    createdAt: session.createdAt,
    updatedAt: Date.now(),
  });

  const peopleMap: Record<string, BillPerson> = {};
  const helpersMap: Record<string, boolean> = {};
  for (const p of session.people || []) {
    peopleMap[p.id] = stripUndefined({
      ...p,
      claims: undefined,
    } as any);
    if (p.approval === 'approved' && p.boundUid) {
      const eff = getEffectivePersonPermission({ live: liveCfg }, p);
      if (eff === 'helper') {
        helpersMap[p.boundUid] = true;
      }
    }
  }

  const itemsMap: Record<string, any> = {};
  const claimsMap: Record<string, Record<string, number>> = {};
  (session.items || []).forEach((it, idx) => {
    itemsMap[it.id] = stripUndefined({
      id: it.id,
      name: it.name,
      unitPriceMinor: it.unitPriceMinor,
      qty: it.qty,
      mode: it.mode,
      equalAmong: it.equalAmong || [],
      exactAmountsMinor: it.exactAmountsMinor || {},
      note: it.note || null,
      order: idx,
    });
    if (it.mode === 'equal_among') {
      const eqClaims: Record<string, number> = {};
      for (const pid of it.equalAmong || []) {
        eqClaims[pid] = 1;
      }
      if (Object.keys(eqClaims).length > 0) {
        claimsMap[it.id] = eqClaims;
      }
    } else if (it.claims && Object.keys(it.claims).length > 0) {
      claimsMap[it.id] = stripUndefined(it.claims);
    }
  });

  const basePath = `bill_splits/${session.id}`;
  // Write meta first on first publish so RTDB rules see root.child('meta/ownerUid')
  if (!initializedCloudBills.has(session.id)) {
    await set(ref(rtdb, `${basePath}/meta`), metaPayload);
    initializedCloudBills.add(session.id);
  } else {
    await set(ref(rtdb, `${basePath}/meta`), metaPayload);
  }

  await Promise.all([
    writeKeyedMap(`${basePath}/helpers`, helpersMap),
    writeKeyedMap(`${basePath}/people`, peopleMap),
    writeKeyedMap(`${basePath}/items`, itemsMap),
    writeKeyedMap(`${basePath}/claims`, claimsMap),
  ]);

  return true;
}

export function reconstructSessionFromCloud(billId: string, val: any): BillSession | null {
  if (!val || !val.meta) return null;
  const meta = val.meta;
  const peopleObj = val.people && typeof val.people === 'object' ? val.people : {};
  const itemsObj = val.items && typeof val.items === 'object' ? val.items : {};
  const claimsObj = val.claims && typeof val.claims === 'object' ? val.claims : {};

  const people: BillPerson[] = Object.values(peopleObj).map((p: any) => ({
    id: String(p.id),
    name: String(p.name || 'Guest'),
    avatar: p.avatar || '👤',
    color: p.color,
    kind: p.kind || 'guest',
    numericId: p.numericId,
    boundUid: p.boundUid,
    role: p.role || 'participant',
    roleOverride: p.roleOverride,
    approval: p.approval || 'approved',
    paidFlag: Boolean(p.paidFlag),
    paidAmountMinor: p.paidAmountMinor,
  }));

  // Keep owner first
  people.sort((a, b) => (a.kind === 'owner' ? -1 : b.kind === 'owner' ? 1 : 0));

  const items: BillItem[] = Object.values(itemsObj)
    .sort((a: any, b: any) => (Number(a.order) || 0) - (Number(b.order) || 0))
    .map((it: any) => {
      const baseItem: BillItem = {
        id: String(it.id),
        name: String(it.name || ''),
        unitPriceMinor: Number(it.unitPriceMinor) || 0,
        qty: Number(it.qty) > 0 ? Number(it.qty) : 1,
        mode: it.mode || 'equal_among',
        claims: {},
        equalAmong: Array.isArray(it.equalAmong) ? it.equalAmong : [],
        exactAmountsMinor:
          it.exactAmountsMinor && typeof it.exactAmountsMinor === 'object' ? it.exactAmountsMinor : {},
        note: it.note || undefined,
      };
      return mergeCloudClaimsIntoItem(
        baseItem,
        claimsObj[baseItem.id] && typeof claimsObj[baseItem.id] === 'object'
          ? claimsObj[baseItem.id]
          : undefined
      );
    });

  const extras = Array.isArray(meta.extras)
    ? meta.extras.map((ex: any) => ({
        ...ex,
        exemptPersonIds: Array.isArray(ex.exemptPersonIds) ? ex.exemptPersonIds : [],
        customAmountsMinor:
          ex.customAmountsMinor && typeof ex.customAmountsMinor === 'object'
            ? ex.customAmountsMinor
            : {},
      }))
    : [];

  return {
    id: billId,
    title: meta.title || '',
    icon: meta.icon || '🧾',
    currency: meta.currency || '£',
    createdAt: Number(meta.createdAt) || Date.now(),
    updatedAt: Number(meta.updatedAt) || Date.now(),
    status: meta.status || 'open',
    ownerUid: meta.ownerUid,
    ownerName: meta.ownerName || 'Owner',
    people,
    items,
    extras,
    statedTotalMinor:
      meta.statedTotalMinor !== null && meta.statedTotalMinor !== undefined
        ? Number(meta.statedTotalMinor)
        : undefined,
    diffResolution: meta.diffResolution || undefined,
    rounding: meta.rounding || { step: 0, remainderTo: 'owner' },
    payers: Array.isArray(meta.payers) ? meta.payers : [],
    payerMode: meta.payerMode || 'owner_all',
    paymentInfo: meta.paymentInfo || {},
    live: {
      enabled: Boolean(meta.live?.enabled),
      defaultPermission: meta.live?.defaultPermission || 'view_only',
      autoAccept: Boolean(meta.live?.autoAccept),
      linkActive: meta.live?.linkActive ?? true,
    },
    cloudExpiresAt: meta.expiresAt ? Number(meta.expiresAt) : undefined,
    deletedByOwner: Boolean(meta.deletedByOwner),
  };
}

export function subscribeToLiveBillAsOwner(
  billId: string,
  onRemotePatch: (patch: {
    people?: BillPerson[];
    items?: BillItem[];
    claims?: Record<string, Record<string, number>>;
  }) => void
): () => void {
  const peopleRef = ref(rtdb, `bill_splits/${billId}/people`);
  const itemsRef = ref(rtdb, `bill_splits/${billId}/items`);
  const claimsRef = ref(rtdb, `bill_splits/${billId}/claims`);

  const onPeopleSnap = (snap: any) => {
    if (!snap.exists()) return;
    const val = snap.val();
    const list: BillPerson[] = Object.values(val || {}).map((p: any) => ({
      id: String(p.id),
      name: String(p.name || 'Guest'),
      avatar: p.avatar || '👤',
      color: p.color,
      kind: p.kind || 'guest',
      numericId: p.numericId,
      boundUid: p.boundUid,
      role: p.role || 'participant',
      roleOverride: p.roleOverride,
      approval: p.approval || 'approved',
      paidFlag: Boolean(p.paidFlag),
      paidAmountMinor: p.paidAmountMinor,
    }));
    list.sort((a, b) => (a.kind === 'owner' ? -1 : b.kind === 'owner' ? 1 : 0));
    onRemotePatch({ people: list });
  };

  const onClaimsSnap = (snap: any) => {
    const val = snap.exists() ? snap.val() : {};
    onRemotePatch({ claims: val || {} });
  };

  const onItemsSnap = (snap: any) => {
    if (!snap.exists()) {
      onRemotePatch({ items: [] });
      return;
    }
    const val = snap.val() || {};
    const list: BillItem[] = Object.values(val)
      .sort((a: any, b: any) => (Number(a.order) || 0) - (Number(b.order) || 0))
      .map((it: any) => ({
        id: String(it.id),
        name: String(it.name || ''),
        unitPriceMinor: Number(it.unitPriceMinor) || 0,
        qty: Number(it.qty) > 0 ? Number(it.qty) : 1,
        mode: it.mode || 'equal_among',
        claims: {},
        equalAmong: Array.isArray(it.equalAmong) ? it.equalAmong : [],
        exactAmountsMinor:
          it.exactAmountsMinor && typeof it.exactAmountsMinor === 'object' ? it.exactAmountsMinor : {},
        note: it.note || undefined,
      }));
    onRemotePatch({ items: list });
  };

  onValue(peopleRef, onPeopleSnap);
  onValue(claimsRef, onClaimsSnap);
  onValue(itemsRef, onItemsSnap);

  return () => {
    off(peopleRef, 'value', onPeopleSnap);
    off(claimsRef, 'value', onClaimsSnap);
    off(itemsRef, 'value', onItemsSnap);
  };
}

export function subscribeToLiveBillAsGuest(
  billId: string,
  onSession: (session: BillSession | null) => void,
  onError?: (err: Error) => void
): () => void {
  let cancelled = false;
  const billRef = ref(rtdb, `bill_splits/${billId}`);

  const callback = (snap: any) => {
    if (cancelled) return;
    if (!snap.exists()) {
      onSession(null);
      return;
    }
    const rebuilt = reconstructSessionFromCloud(billId, snap.val());
    ensureServerClockOffset();
    if (rebuilt?.cloudExpiresAt && Date.now() + serverClockOffsetMs > rebuilt.cloudExpiresAt) {
      onSession(null);
      return;
    }
    onSession(rebuilt);
  };

  ensureFirebaseAuth()
    .then(() => {
      if (cancelled) return;
      onValue(billRef, callback, (err) => {
        if (!cancelled && onError) onError(err as Error);
      });
    })
    .catch((err) => {
      if (!cancelled && onError) onError(err as Error);
    });

  return () => {
    cancelled = true;
    off(billRef, 'value', callback);
  };
}

/** A guest who is still waiting for approval may correct the name they typed. */
export async function guestRenameSelf(
  billId: string,
  person: BillPerson,
  uid: string,
  name: string
): Promise<void> {
  const payload = stripUndefined({
    ...person,
    name: name.trim().slice(0, 50),
    boundUid: uid,
    approval: 'pending',
  });
  await set(ref(rtdb, `bill_splits/${billId}/people/${person.id}`), payload);
}

export async function guestRequestJoin(
  billId: string,
  name: string,
  uid: string,
  autoAccept: boolean
): Promise<BillPerson> {
  const newPerson: BillPerson = {
    id: `p_${generateBillId().slice(0, 8)}`,
    name: name.trim().slice(0, 50),
    avatar: '🙋',
    kind: 'guest',
    boundUid: uid,
    role: 'participant',
    approval: autoAccept ? 'approved' : 'pending',
    paidFlag: false,
  };
  await set(ref(rtdb, `bill_splits/${billId}/people/${newPerson.id}`), stripUndefined(newPerson));
  return newPerson;
}

export async function guestToggleItemClaim(
  billId: string,
  itemId: string,
  personId: string,
  units: number
): Promise<void> {
  const claimRef = ref(rtdb, `bill_splits/${billId}/claims/${itemId}/${personId}`);
  if (units > 0) {
    await set(claimRef, units);
  } else {
    await remove(claimRef);
  }
}

export async function helperUpsertItem(
  billId: string,
  item: BillItem,
  order: number
): Promise<void> {
  const payload = stripUndefined({
    id: item.id,
    name: item.name,
    unitPriceMinor: item.unitPriceMinor,
    qty: item.qty,
    mode: item.mode,
    equalAmong: item.equalAmong || [],
    exactAmountsMinor: item.exactAmountsMinor || {},
    note: item.note || null,
    order,
  });
  await set(ref(rtdb, `bill_splits/${billId}/items/${item.id}`), payload);
}

export async function helperDeleteItem(billId: string, itemId: string): Promise<void> {
  await remove(ref(rtdb, `bill_splits/${billId}/items/${itemId}`));
}

export async function revokeOrDeleteLiveBill(billId: string): Promise<void> {
  initializedCloudBills.delete(billId);
  const billRef = ref(rtdb, `bill_splits/${billId}`);
  try {
    const snap = await get(billRef);
    if (!snap.exists()) return;
    try {
      await remove(billRef);
      return;
    } catch (err) {
      if (!isPermissionDenied(err)) throw err;
    }
    // Per-child fallback under stricter security rules (meta is removed last).
    const val = snap.val() || {};
    const tasks: Promise<void>[] = [];
    for (const [pid] of Object.entries(val.people || {})) {
      tasks.push(remove(ref(rtdb, `bill_splits/${billId}/people/${pid}`)));
    }
    for (const [iid, perPerson] of Object.entries(val.claims || {})) {
      for (const pid of Object.keys((perPerson as any) || {})) {
        tasks.push(remove(ref(rtdb, `bill_splits/${billId}/claims/${iid}/${pid}`)));
      }
    }
    await Promise.all(tasks);
    await Promise.all([
      remove(ref(rtdb, `bill_splits/${billId}/items`)),
      remove(ref(rtdb, `bill_splits/${billId}/helpers`)),
    ]);
    await remove(ref(rtdb, `bill_splits/${billId}/meta`));
  } catch (err) {
    console.warn('[BillSplitCloud] Could not delete cloud bill:', err);
    throw err;
  }
}

interface PendingCloudDelete {
  id: string;
  dueAt: number;
}

function readPendingCloudDeletes(): PendingCloudDelete[] {
  try {
    const raw = localStorage.getItem(PENDING_CLOUD_DELETE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((e) => e && e.id) : [];
  } catch {
    return [];
  }
}

function writePendingCloudDeletes(list: PendingCloudDelete[]): void {
  try {
    localStorage.setItem(PENDING_CLOUD_DELETE_KEY, JSON.stringify(list));
  } catch {}
}

/** Removes cloud copies of deleted bills once their grace period is over (owner device only). */
export async function processPendingCloudBillDeletions(): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  const list = readPendingCloudDeletes();
  if (list.length === 0) return;
  const now = await getServerNowMs();
  const remaining: PendingCloudDelete[] = [];
  for (const entry of list) {
    if (entry.dueAt > now) {
      remaining.push(entry);
      continue;
    }
    try {
      await ensureFirebaseAuth();
      await revokeOrDeleteLiveBill(entry.id);
    } catch {
      remaining.push(entry);
    }
  }
  writePendingCloudDeletes(remaining);
}

/**
 * Deletes a bill from this device and handles its public link:
 * - nobody joined: the cloud copy is removed right away;
 * - guests joined: the link stays readable for 24 hours with a "deleted by owner" notice, then closes.
 */
export async function disposeBillSession(session: BillSession): Promise<void> {
  deleteBillSession(session.id);
  if (!session.live?.enabled) return;

  const hasGuests = (session.people || []).some((p) => p.kind !== 'owner');
  const serverNow = await getServerNowMs();
  const dueAt = serverNow + (hasGuests ? LIVE_BILL_DELETE_GRACE_MS : 0);
  const list = readPendingCloudDeletes().filter((e) => e.id !== session.id);
  list.push({ id: session.id, dueAt });
  writePendingCloudDeletes(list);

  if (hasGuests && typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      await ensureFirebaseAuth();
      const base = `bill_splits/${session.id}/meta`;
      await Promise.all([
        set(ref(rtdb, `${base}/expiresAt`), dueAt),
        set(ref(rtdb, `${base}/deletedByOwner`), true),
        set(ref(rtdb, `${base}/status`), 'locked'),
      ]);
    } catch (err) {
      console.warn('[BillSplitCloud] Could not mark bill as deleted:', err);
    }
  }
  await processPendingCloudBillDeletions().catch(() => {});
}
