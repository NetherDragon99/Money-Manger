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
import { auth, ensureFirebaseAuth, rtdb } from './firebase';

const initializedCloudBills = new Set<string>();

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

  const user = auth.currentUser || (await ensureFirebaseAuth());
  const ownerUid = session.ownerUid || user?.uid;
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
    set(ref(rtdb, `${basePath}/helpers`), Object.keys(helpersMap).length > 0 ? helpersMap : null),
    set(ref(rtdb, `${basePath}/people`), peopleMap),
    set(ref(rtdb, `${basePath}/items`), Object.keys(itemsMap).length > 0 ? itemsMap : null),
    set(ref(rtdb, `${basePath}/claims`), Object.keys(claimsMap).length > 0 ? claimsMap : null),
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
    onSession(reconstructSessionFromCloud(billId, snap.val()));
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

export async function guestClaimExistingPerson(
  billId: string,
  person: BillPerson,
  uid: string,
  autoAccept: boolean
): Promise<void> {
  const payload = stripUndefined({
    ...person,
    boundUid: uid,
    approval: autoAccept ? 'approved' : person.approval || 'approved',
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
  try {
    const billRef = ref(rtdb, `bill_splits/${billId}`);
    const snap = await get(billRef);
    if (snap.exists()) {
      await remove(billRef);
    }
  } catch (err) {
    console.warn('[BillSplitCloud] Could not delete cloud bill:', err);
  }
}
