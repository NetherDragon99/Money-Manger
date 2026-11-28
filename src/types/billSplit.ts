export type BillStatus = 'draft' | 'open' | 'locked' | 'settled';
export type ExtraKind = 'service' | 'tax' | 'delivery' | 'tip' | 'discount' | 'custom';
export type ExtraDistribution = 'proportional' | 'equal';
export type ReceiptImageTheme = 'dark' | 'light';
export type BillGuestPermission = 'view_only' | 'claim_own' | 'helper';

export interface BillPerson {
  id: string;
  name: string;
  avatar?: string;
  color?: string;
  kind: 'owner' | 'solv_user' | 'guest';
  numericId?: string;
  boundUid?: string;
  role: 'participant' | 'helper';
  roleOverride?: BillGuestPermission;
  approval: 'approved' | 'pending';
  paidFlag: boolean;
  paidAmountMinor?: number;
}

export interface BillItem {
  id: string;
  name: string;
  unitPriceMinor: number;
  qty: number;
  mode: 'units' | 'equal_among' | 'everyone' | 'exact';
  claims: Record<string, number>;
  equalAmong?: string[];
  exactAmountsMinor?: Record<string, number>;
  note?: string;
}

export interface BillExtra {
  id: string;
  kind: ExtraKind;
  label: string;
  valueType: 'percent' | 'fixed';
  value: number; // percent (e.g. 14) or minor units (e.g. 3000 for 30.00)
  base: 'subtotal' | 'subtotal_plus_previous';
  sign: 1 | -1;
  distribution: ExtraDistribution;
  exemptPersonIds: string[];
  customAmountsMinor: Record<string, number>;
  exemptMode: 'redistribute' | 'absorb';
}

export interface BillRounding {
  step: 0 | 50 | 100 | 500 | 1000;
  remainderTo: 'owner' | 'payer' | 'largest' | 'spread';
}

export interface BillDiffResolution {
  kind: 'item' | 'spread' | 'rounding' | 'ignored';
  amountMinor: number;
  resolvedAt: number;
}

export interface BillPayerEntry {
  personId: string;
  amountMinor: number;
}

export interface BillPaymentInfo {
  instaPay?: string;
  wallet?: string;
  includeInstaPayFee?: boolean;
  note?: string;
}

export interface BillSession {
  id: string;
  title: string;
  icon: string;
  currency: string;
  createdAt: number;
  updatedAt: number;
  settledAt?: number;
  cloudCleanedAt?: number;
  status: BillStatus;
  ownerUid?: string;
  ownerName: string;
  people: BillPerson[];
  items: BillItem[];
  extras: BillExtra[];
  statedTotalMinor?: number;
  diffResolution?: BillDiffResolution;
  rounding: BillRounding;
  payers: BillPayerEntry[];
  payerMode: 'owner_all' | 'custom';
  paymentInfo?: BillPaymentInfo;
  live?: {
    enabled: boolean;
    defaultPermission: BillGuestPermission;
    autoAccept: boolean;
    linkActive: boolean;
  };
  linkedTransactionId?: string;
  /** Guest-side only: epoch ms after which the public link stops working (owner deleted the bill). */
  cloudExpiresAt?: number;
  /** Guest-side only: owner deleted this bill; link stays read-only until cloudExpiresAt. */
  deletedByOwner?: boolean;
}

export interface SavedBillFriend {
  id: string;
  name: string;
  avatar: string;
  numericId?: string;
  uid?: string;
  instaPay?: string;
  wallet?: string;
  usageCount: number;
  updatedAt: number;
}

export interface SavedBillGroup {
  id: string;
  name: string;
  icon: string;
  memberIds: string[];
  updatedAt: number;
}

export interface BillSplitStorageBundle {
  sessions: BillSession[];
  activeDraftId: string | null;
  friends: SavedBillFriend[];
  groups: SavedBillGroup[];
  defaultPaymentInfo: BillPaymentInfo;
}

export interface TransactionBillSplitRef {
  id: string;
  title: string;
  myShareMinor?: number;
  paidTotalMinor?: number;
}
