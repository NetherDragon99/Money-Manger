import {
  BillDiffResolution,
  BillExtra,
  BillItem,
  BillPayerEntry,
  BillPerson,
  BillRounding,
  BillSession,
} from '../types';

export function toMinor(major: number): number {
  if (!Number.isFinite(major)) return 0;
  return Math.round(major * 100);
}

export function fromMinor(minor: number): number {
  if (!Number.isFinite(minor)) return 0;
  return minor / 100;
}

export function generateBillId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  const chars = 'abcdef0123456789';
  let id = '';
  for (let i = 0; i < 32; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

/**
 * Distributes an integer minor amount across `orderedIds` proportionally to `weights`
 * using the Largest Remainder (Hamilton) method so the sum strictly equals `totalMinor`.
 */
export function distributeLargestRemainder(
  totalMinor: number,
  weights: Record<string, number>,
  orderedIds: string[]
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const id of orderedIds) result[id] = 0;
  if (orderedIds.length === 0 || !Number.isFinite(totalMinor) || totalMinor === 0) {
    return result;
  }

  const intTotal = Math.round(totalMinor);
  if (intTotal === 0) return result;
  const sign = intTotal < 0 ? -1 : 1;
  const absTotal = Math.abs(intTotal);

  const positiveWeights = orderedIds.map((id) => Math.max(0, Number(weights[id]) || 0));
  let weightSum = positiveWeights.reduce((acc, w) => acc + w, 0);
  const effectiveWeights = weightSum > 0 ? positiveWeights : orderedIds.map(() => 1);
  if (weightSum <= 0) weightSum = orderedIds.length;

  const quotas = orderedIds.map((id, idx) => {
    const exact = (absTotal * effectiveWeights[idx]) / weightSum;
    const floored = Math.floor(exact);
    return {
      id,
      idx,
      floored,
      fraction: exact - floored,
    };
  });

  const flooredSum = quotas.reduce((acc, q) => acc + q.floored, 0);
  let remainder = absTotal - flooredSum;

  const sortedByFraction = [...quotas].sort((a, b) => {
    if (Math.abs(b.fraction - a.fraction) > 1e-9) {
      return b.fraction - a.fraction;
    }
    return a.idx - b.idx;
  });

  const allocations = [...quotas];
  for (let i = 0; i < remainder; i++) {
    const target = sortedByFraction[i % sortedByFraction.length];
    allocations[target.idx].floored += 1;
  }

  for (const entry of allocations) {
    const signed = entry.floored * sign;
    result[entry.id] = signed === 0 ? 0 : signed;
  }
  return result;
}

export interface PersonItemLine {
  itemId: string;
  name: string;
  qtyShare: number;
  lineTotalMinor: number;
  shareMinor: number;
}

export interface UnitMismatchItem {
  itemId: string;
  name: string;
  claimedUnits: number;
  expectedQty: number;
}

export interface ItemAllocationResult {
  approvedIds: string[];
  perPersonItemsMinor: Record<string, number>;
  perPersonBreakdown: Record<string, PersonItemLine[]>;
  itemAllocations: Record<string, Record<string, number>>;
  itemTotalsMinor: Record<string, number>;
  unassignedItemIds: string[];
  unitMismatchItems: UnitMismatchItem[];
  itemsSubtotalMinor: number;
  assignedSubtotalMinor: number;
  unassignedSubtotalMinor: number;
}

export function getApprovedPeople(session: BillSession): BillPerson[] {
  return session.people.filter((p) => p.approval === 'approved');
}

export function getOwnerPersonId(session: BillSession): string {
  const owner = session.people.find((p) => p.kind === 'owner') || session.people[0];
  return owner?.id || '';
}

export function getItemLineTotalMinor(item: Pick<BillItem, 'unitPriceMinor' | 'qty'>): number {
  const unit = Number.isFinite(item.unitPriceMinor) ? Math.round(item.unitPriceMinor) : 0;
  const qty = Number.isFinite(item.qty) && item.qty > 0 ? item.qty : 0;
  return Math.round(unit * qty);
}

export function allocateItems(session: BillSession): ItemAllocationResult {
  const approvedPeople = getApprovedPeople(session);
  const approvedIds = approvedPeople.map((p) => p.id);
  const approvedSet = new Set(approvedIds);

  const perPersonItemsMinor: Record<string, number> = {};
  const perPersonBreakdown: Record<string, PersonItemLine[]> = {};
  for (const id of approvedIds) {
    perPersonItemsMinor[id] = 0;
    perPersonBreakdown[id] = [];
  }

  const itemAllocations: Record<string, Record<string, number>> = {};
  const itemTotalsMinor: Record<string, number> = {};
  const unassignedItemIds: string[] = [];
  const unitMismatchItems: UnitMismatchItem[] = [];

  let itemsSubtotalMinor = 0;
  let assignedSubtotalMinor = 0;

  for (const item of session.items) {
    const lineTotalMinor = getItemLineTotalMinor(item);
    itemTotalsMinor[item.id] = lineTotalMinor;
    itemsSubtotalMinor += lineTotalMinor;

    const weights: Record<string, number> = {};
    const participantIds: string[] = [];

    if (item.mode === 'everyone') {
      for (const pid of approvedIds) {
        weights[pid] = 1;
        participantIds.push(pid);
      }
    } else if (item.mode === 'equal_among') {
      const chosen = (item.equalAmong || []).filter((pid) => approvedSet.has(pid));
      for (const pid of chosen) {
        weights[pid] = 1;
        participantIds.push(pid);
      }
    } else {
      // 'units'
      let claimedSum = 0;
      for (const pid of approvedIds) {
        const units = Number(item.claims?.[pid]) || 0;
        if (units > 0) {
          weights[pid] = units;
          participantIds.push(pid);
          claimedSum += units;
        }
      }
      if (claimedSum > 0 && Math.abs(claimedSum - item.qty) > 0.001) {
        unitMismatchItems.push({
          itemId: item.id,
          name: item.name,
          claimedUnits: claimedSum,
          expectedQty: item.qty,
        });
      }
    }

    if (participantIds.length === 0) {
      unassignedItemIds.push(item.id);
      itemAllocations[item.id] = {};
      continue;
    }

    assignedSubtotalMinor += lineTotalMinor;
    const split = distributeLargestRemainder(lineTotalMinor, weights, participantIds);
    itemAllocations[item.id] = split;

    const totalWeight = participantIds.reduce((acc, pid) => acc + weights[pid], 0);
    for (const pid of participantIds) {
      const shareMinor = split[pid] || 0;
      perPersonItemsMinor[pid] = (perPersonItemsMinor[pid] || 0) + shareMinor;
      const qtyShare =
        totalWeight > 0 ? Math.round(((item.qty * weights[pid]) / totalWeight) * 100) / 100 : 0;
      perPersonBreakdown[pid].push({
        itemId: item.id,
        name: item.name,
        qtyShare,
        lineTotalMinor,
        shareMinor,
      });
    }
  }

  return {
    approvedIds,
    perPersonItemsMinor,
    perPersonBreakdown,
    itemAllocations,
    itemTotalsMinor,
    unassignedItemIds,
    unitMismatchItems,
    itemsSubtotalMinor,
    assignedSubtotalMinor,
    unassignedSubtotalMinor: itemsSubtotalMinor - assignedSubtotalMinor,
  };
}

export interface ComputedExtraBreakdown {
  extraId: string;
  label: string;
  kind: BillExtra['kind'];
  sign: 1 | -1;
  computedMinor: number; // signed
  absorbedByOwnerMinor: number; // signed portion covered by owner when exemptMode === 'absorb'
  perPersonMinor: Record<string, number>;
}

export interface ExtrasComputationResult {
  perPersonExtrasMinor: Record<string, number>;
  perExtraBreakdown: ComputedExtraBreakdown[];
  extrasTotalMinor: number;
}

export function computeExtras(
  session: BillSession,
  allocation: ItemAllocationResult
): ExtrasComputationResult {
  const { approvedIds, perPersonItemsMinor, itemsSubtotalMinor, assignedSubtotalMinor } = allocation;
  const ownerId = getOwnerPersonId(session);
  const perPersonExtrasMinor: Record<string, number> = {};
  const runningPersonBaseMinor: Record<string, number> = {};

  for (const pid of approvedIds) {
    perPersonExtrasMinor[pid] = 0;
    runningPersonBaseMinor[pid] = perPersonItemsMinor[pid] || 0;
  }

  // Base tracking: track both total items base (for bill-level %) and assigned base
  let runningBillBaseMinor = itemsSubtotalMinor;
  let extrasTotalMinor = 0;
  const perExtraBreakdown: ComputedExtraBreakdown[] = [];

  for (const extra of session.extras) {
    const baseMinor =
      extra.base === 'subtotal_plus_previous' ? runningBillBaseMinor : itemsSubtotalMinor;

    const rawMagnitude =
      extra.valueType === 'percent'
        ? Math.round((Math.max(0, baseMinor) * Math.max(0, extra.value)) / 100)
        : Math.max(0, Math.round(extra.value));

    const signedTargetTotal = extra.sign * rawMagnitude;
    const exemptSet = new Set(extra.exemptPersonIds || []);
    const customMap = extra.customAmountsMinor || {};

    const perPersonShare: Record<string, number> = {};
    for (const pid of approvedIds) perPersonShare[pid] = 0;

    let actualExtraTotal = 0;
    let absorbedByOwnerMinor = 0;

    if (approvedIds.length > 0 && signedTargetTotal !== 0) {
      if (extra.exemptMode === 'absorb' && ownerId && exemptSet.size > 0) {
        // Compute natural un-exempted distribution first, then transfer exempt shares to owner
        let naturalFixedSum = 0;
        const naturalRemainderIds: string[] = [];
        for (const pid of approvedIds) {
          if (Object.prototype.hasOwnProperty.call(customMap, pid) && !exemptSet.has(pid)) {
            const val = extra.sign * Math.max(0, Math.round(customMap[pid] || 0));
            perPersonShare[pid] = val;
            naturalFixedSum += val;
          } else {
            naturalRemainderIds.push(pid);
          }
        }
        const remainingNatural = signedTargetTotal - naturalFixedSum;
        if (naturalRemainderIds.length > 0) {
          const weights: Record<string, number> = {};
          for (const pid of naturalRemainderIds) {
            weights[pid] =
              extra.distribution === 'equal' ? 1 : Math.max(0, runningPersonBaseMinor[pid] || 0);
          }
          const dist = distributeLargestRemainder(remainingNatural, weights, naturalRemainderIds);
          for (const pid of naturalRemainderIds) {
            perPersonShare[pid] = dist[pid] || 0;
          }
          actualExtraTotal = signedTargetTotal;
        } else {
          actualExtraTotal = naturalFixedSum;
        }

        for (const exId of exemptSet) {
          if (Object.prototype.hasOwnProperty.call(perPersonShare, exId) && exId !== ownerId) {
            const shifted = perPersonShare[exId] || 0;
            perPersonShare[exId] = 0;
            perPersonShare[ownerId] = (perPersonShare[ownerId] || 0) + shifted;
            absorbedByOwnerMinor += shifted;
          }
        }
      } else {
        // 'redistribute' (default): exempt people pay 0, custom people pay their fixed amount, remaining splits among rest
        let fixedSum = 0;
        const remainderEligibleIds: string[] = [];

        for (const pid of approvedIds) {
          if (exemptSet.has(pid)) {
            perPersonShare[pid] = 0;
            continue;
          }
          if (Object.prototype.hasOwnProperty.call(customMap, pid)) {
            const customSigned = extra.sign * Math.max(0, Math.round(customMap[pid] || 0));
            perPersonShare[pid] = customSigned;
            fixedSum += customSigned;
          } else {
            remainderEligibleIds.push(pid);
          }
        }

        if (remainderEligibleIds.length > 0) {
          const remaining = signedTargetTotal - fixedSum;
          const weights: Record<string, number> = {};
          for (const pid of remainderEligibleIds) {
            weights[pid] =
              extra.distribution === 'equal' ? 1 : Math.max(0, runningPersonBaseMinor[pid] || 0);
          }
          const dist = distributeLargestRemainder(remaining, weights, remainderEligibleIds);
          for (const pid of remainderEligibleIds) {
            perPersonShare[pid] = dist[pid] || 0;
          }
          actualExtraTotal = signedTargetTotal;
        } else {
          // Either everyone was exempt (0) or everyone non-exempt had explicit custom fixed amounts
          actualExtraTotal = fixedSum;
        }
      }
    } else if (assignedSubtotalMinor === 0 && itemsSubtotalMinor > 0 && approvedIds.length === 0) {
      actualExtraTotal = 0;
    }

    // If no people exist at all in edge-case calculation tests, preserve computed minor on total
    const finalExtraComputed = approvedIds.length === 0 ? signedTargetTotal : actualExtraTotal;

    for (const pid of approvedIds) {
      const s = perPersonShare[pid] || 0;
      perPersonExtrasMinor[pid] = (perPersonExtrasMinor[pid] || 0) + s;
      runningPersonBaseMinor[pid] = (runningPersonBaseMinor[pid] || 0) + s;
    }

    runningBillBaseMinor += finalExtraComputed;
    extrasTotalMinor += finalExtraComputed;

    perExtraBreakdown.push({
      extraId: extra.id,
      label: extra.label,
      kind: extra.kind,
      sign: extra.sign,
      computedMinor: finalExtraComputed,
      absorbedByOwnerMinor,
      perPersonMinor: perPersonShare,
    });
  }

  return {
    perPersonExtrasMinor,
    perExtraBreakdown,
    extrasTotalMinor,
  };
}

export interface RoundingResult {
  perPersonRoundedMinor: Record<string, number>;
  perPersonRoundingDeltaMinor: Record<string, number>;
  roundingRemainderMinor: number;
}

export function applyRounding(
  rawTotalsMinor: Record<string, number>,
  rounding: BillRounding,
  ownerId: string,
  primaryPayerId: string,
  orderedIds: string[]
): RoundingResult {
  const perPersonRoundedMinor: Record<string, number> = {};
  const perPersonRoundingDeltaMinor: Record<string, number> = {};
  for (const pid of orderedIds) {
    const raw = Math.round(rawTotalsMinor[pid] || 0);
    perPersonRoundedMinor[pid] = raw;
    perPersonRoundingDeltaMinor[pid] = 0;
  }

  const step = rounding?.step || 0;
  if (!step || orderedIds.length === 0) {
    return { perPersonRoundedMinor, perPersonRoundingDeltaMinor, roundingRemainderMinor: 0 };
  }

  let rawSum = 0;
  let roundedSum = 0;
  for (const pid of orderedIds) {
    const raw = Math.round(rawTotalsMinor[pid] || 0);
    rawSum += raw;
    const rounded = raw > 0 ? Math.round(raw / step) * step : raw;
    perPersonRoundedMinor[pid] = rounded;
    roundedSum += rounded;
  }

  const remainder = rawSum - roundedSum;
  if (remainder !== 0) {
    if (rounding.remainderTo === 'spread') {
      const weights: Record<string, number> = {};
      for (const pid of orderedIds) weights[pid] = 1;
      const spreadDelta = distributeLargestRemainder(remainder, weights, orderedIds);
      for (const pid of orderedIds) {
        perPersonRoundedMinor[pid] += spreadDelta[pid] || 0;
      }
    } else {
      let targetId = ownerId;
      if (rounding.remainderTo === 'payer' && orderedIds.includes(primaryPayerId)) {
        targetId = primaryPayerId;
      } else if (rounding.remainderTo === 'largest') {
        targetId = [...orderedIds].sort((a, b) => (rawTotalsMinor[b] || 0) - (rawTotalsMinor[a] || 0))[0];
      }
      if (!orderedIds.includes(targetId)) {
        targetId = orderedIds[0];
      }
      perPersonRoundedMinor[targetId] += remainder;
    }
  }

  for (const pid of orderedIds) {
    perPersonRoundingDeltaMinor[pid] = perPersonRoundedMinor[pid] - Math.round(rawTotalsMinor[pid] || 0);
  }

  return {
    perPersonRoundedMinor,
    perPersonRoundingDeltaMinor,
    roundingRemainderMinor: remainder,
  };
}

export type ReconcileReasonCode =
  | 'matched'
  | 'unset'
  | 'ignored'
  | 'rounding_cents'
  | 'missing_service_12'
  | 'missing_vat_14'
  | 'missing_service_and_vat'
  | 'missing_service_and_vat_compound'
  | 'missing_percent_10'
  | 'missing_percent_15'
  | 'missing_item_unit'
  | 'duplicate_item_unit'
  | 'unlisted_item'
  | 'unlisted_discount';

export type ReconcileSuggestionAction =
  | {
      type: 'add_extra_preset';
      id: string;
      kind: BillExtra['kind'];
      percent?: number;
      fixedMinor?: number;
      compoundVatAfterService?: boolean;
      sign?: 1 | -1;
    }
  | { type: 'add_uncategorized_item'; amountMinor: number }
  | { type: 'spread_extra'; amountMinor: number }
  | { type: 'mark_rounding'; amountMinor: number }
  | { type: 'adjust_item_qty'; itemId: string; itemName: string; deltaQty: number }
  | { type: 'ignore_diff'; amountMinor: number };

export interface ReconcileResult {
  status: 'matched' | 'unset' | 'ignored' | 'mismatch';
  statedTotalMinor?: number;
  computedTotalMinor: number;
  diffMinor: number; // stated - computed
  reasonCode: ReconcileReasonCode;
  matchedItemName?: string;
  suggestions: ReconcileSuggestionAction[];
  canFinalize: boolean;
  blockingReasons: Array<'no_items' | 'unassigned_items' | 'total_mismatch'>;
}

export function reconcile(
  session: BillSession,
  allocation: ItemAllocationResult,
  computedTotalMinor: number
): ReconcileResult {
  const hasItems = session.items.length > 0;
  const hasUnassigned = allocation.unassignedItemIds.length > 0;
  const blockingReasons: ReconcileResult['blockingReasons'] = [];
  if (!hasItems) blockingReasons.push('no_items');
  if (hasUnassigned) blockingReasons.push('unassigned_items');

  if (session.statedTotalMinor === undefined || session.statedTotalMinor === null || Number.isNaN(session.statedTotalMinor)) {
    return {
      status: 'unset',
      computedTotalMinor,
      diffMinor: 0,
      reasonCode: 'unset',
      suggestions: [],
      canFinalize: blockingReasons.length === 0,
      blockingReasons,
    };
  }

  const stated = Math.round(session.statedTotalMinor);
  const diffMinor = stated - computedTotalMinor;

  if (diffMinor === 0) {
    return {
      status: 'matched',
      statedTotalMinor: stated,
      computedTotalMinor,
      diffMinor: 0,
      reasonCode: 'matched',
      suggestions: [],
      canFinalize: blockingReasons.length === 0,
      blockingReasons,
    };
  }

  if (
    session.diffResolution?.kind === 'ignored' &&
    Math.round(session.diffResolution.amountMinor) === diffMinor
  ) {
    return {
      status: 'ignored',
      statedTotalMinor: stated,
      computedTotalMinor,
      diffMinor,
      reasonCode: 'ignored',
      suggestions: [],
      canFinalize: blockingReasons.length === 0,
      blockingReasons,
    };
  }

  blockingReasons.push('total_mismatch');

  const absDiff = Math.abs(diffMinor);
  const base = Math.max(0, allocation.itemsSubtotalMinor);
  const tol = Math.max(150, Math.round(base * 0.015)); // max 1.50 or 1.5%
  const hasService = session.extras.some((e) => e.kind === 'service');
  const hasTax = session.extras.some((e) => e.kind === 'tax');

  let reasonCode: ReconcileReasonCode = diffMinor > 0 ? 'unlisted_item' : 'unlisted_discount';
  let matchedItemName: string | undefined;
  const suggestions: ReconcileSuggestionAction[] = [];

  // 1. Exact item unit match first (e.g. forgot 1 unit or added 1 extra unit)
  const matchingItem = session.items.find(
    (it) => it.unitPriceMinor > 0 && Math.abs(it.unitPriceMinor - absDiff) <= 5
  );

  // 2. Percentage heuristics when diff > 0 (stated > computed)
  const pct12 = Math.round(base * 0.12);
  const pct14 = Math.round(base * 0.14);
  const pct10 = Math.round(base * 0.10);
  const pct15 = Math.round(base * 0.15);
  const pct26 = pct12 + pct14;
  const pctCompound = pct12 + Math.round((base + pct12) * 0.14); // 27.68%

  if (absDiff <= 100 && !matchingItem) {
    reasonCode = 'rounding_cents';
    suggestions.push({ type: 'mark_rounding', amountMinor: diffMinor });
    suggestions.push({ type: 'spread_extra', amountMinor: diffMinor });
  } else if (diffMinor > 0 && base > 0 && !hasService && !hasTax && Math.abs(diffMinor - pctCompound) <= tol) {
    reasonCode = 'missing_service_and_vat_compound';
    suggestions.push({
      type: 'add_extra_preset',
      id: 'preset_service_12_vat_14_compound',
      kind: 'service',
      percent: 12,
      compoundVatAfterService: true,
    });
  } else if (diffMinor > 0 && base > 0 && !hasService && !hasTax && Math.abs(diffMinor - pct26) <= tol) {
    reasonCode = 'missing_service_and_vat';
    suggestions.push({
      type: 'add_extra_preset',
      id: 'preset_service_12_vat_14',
      kind: 'service',
      percent: 12,
      compoundVatAfterService: false,
    });
  } else if (diffMinor > 0 && base > 0 && !hasTax && Math.abs(diffMinor - pct14) <= tol) {
    reasonCode = 'missing_vat_14';
    suggestions.push({ type: 'add_extra_preset', id: 'preset_vat_14', kind: 'tax', percent: 14 });
  } else if (diffMinor > 0 && base > 0 && !hasService && Math.abs(diffMinor - pct12) <= tol) {
    reasonCode = 'missing_service_12';
    suggestions.push({ type: 'add_extra_preset', id: 'preset_service_12', kind: 'service', percent: 12 });
  } else if (diffMinor > 0 && base > 0 && Math.abs(diffMinor - pct10) <= tol) {
    reasonCode = 'missing_percent_10';
    suggestions.push({ type: 'add_extra_preset', id: 'preset_pct_10', kind: 'service', percent: 10 });
  } else if (diffMinor > 0 && base > 0 && Math.abs(diffMinor - pct15) <= tol) {
    reasonCode = 'missing_percent_15';
    suggestions.push({ type: 'add_extra_preset', id: 'preset_pct_15', kind: 'tax', percent: 15 });
  } else if (matchingItem) {
    matchedItemName = matchingItem.name;
    if (diffMinor > 0) {
      reasonCode = 'missing_item_unit';
      suggestions.push({
        type: 'adjust_item_qty',
        itemId: matchingItem.id,
        itemName: matchingItem.name,
        deltaQty: 1,
      });
    } else if (matchingItem.qty > 1) {
      reasonCode = 'duplicate_item_unit';
      suggestions.push({
        type: 'adjust_item_qty',
        itemId: matchingItem.id,
        itemName: matchingItem.name,
        deltaQty: -1,
      });
    } else {
      reasonCode = 'unlisted_discount';
    }
  }

  if (diffMinor > 0) {
    suggestions.push({ type: 'add_uncategorized_item', amountMinor: diffMinor });
    suggestions.push({ type: 'spread_extra', amountMinor: diffMinor });
  } else {
    suggestions.push({
      type: 'add_extra_preset',
      id: 'preset_discount_diff',
      kind: 'discount',
      fixedMinor: absDiff,
      sign: -1,
    });
  }
  suggestions.push({ type: 'ignore_diff', amountMinor: diffMinor });

  return {
    status: 'mismatch',
    statedTotalMinor: stated,
    computedTotalMinor,
    diffMinor,
    reasonCode,
    matchedItemName,
    suggestions,
    canFinalize: false,
    blockingReasons,
  };
}

export interface SettlementTransfer {
  fromPersonId: string;
  toPersonId: string;
  amountMinor: number;
}

export interface SettlementResult {
  effectivePayers: BillPayerEntry[];
  payersTotalMinor: number;
  payerMismatchMinor: number;
  rawTransfers: SettlementTransfer[];
  remainingTransfers: SettlementTransfer[];
  netBalancesMinor: Record<string, number>; // paid - share (positive = creditor)
  ownerPaidToMerchantMinor: number;
  ownerShareMinor: number;
  ownerOwedByOthersMinor: number;
  ownerOwesOthersMinor: number;
  recommendedExpenseMinor: number;
}

function greedyMinCashFlow(
  balances: Record<string, number>,
  orderedIds: string[]
): SettlementTransfer[] {
  const creditors: Array<{ id: string; amount: number }> = [];
  const debtors: Array<{ id: string; amount: number }> = [];

  for (const id of orderedIds) {
    const b = Math.round(balances[id] || 0);
    if (b > 0) creditors.push({ id, amount: b });
    else if (b < 0) debtors.push({ id, amount: Math.abs(b) });
  }

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const transfers: SettlementTransfer[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const cred = creditors[ci];
    const debt = debtors[di];
    const amt = Math.min(cred.amount, debt.amount);
    if (amt > 0) {
      transfers.push({
        fromPersonId: debt.id,
        toPersonId: cred.id,
        amountMinor: amt,
      });
    }
    cred.amount -= amt;
    debt.amount -= amt;
    if (cred.amount === 0) ci++;
    if (debt.amount === 0) di++;
  }
  return transfers;
}

export function settle(
  session: BillSession,
  finalPersonTotalsMinor: Record<string, number>,
  computedTotalMinor: number
): SettlementResult {
  const approvedPeople = getApprovedPeople(session);
  const approvedIds = approvedPeople.map((p) => p.id);
  const ownerId = getOwnerPersonId(session);

  let effectivePayers: BillPayerEntry[];
  if (session.payerMode === 'owner_all' || session.payers.length === 0) {
    effectivePayers = ownerId ? [{ personId: ownerId, amountMinor: computedTotalMinor }] : [];
  } else {
    effectivePayers = session.payers
      .filter((p) => approvedIds.includes(p.personId) && p.amountMinor > 0)
      .map((p) => ({ personId: p.personId, amountMinor: Math.round(p.amountMinor) }));
  }

  const paidToMerchantMap: Record<string, number> = {};
  let payersTotalMinor = 0;
  for (const p of effectivePayers) {
    paidToMerchantMap[p.personId] = (paidToMerchantMap[p.personId] || 0) + p.amountMinor;
    payersTotalMinor += p.amountMinor;
  }

  const netBalancesMinor: Record<string, number> = {};
  for (const pid of approvedIds) {
    netBalancesMinor[pid] = (paidToMerchantMap[pid] || 0) - Math.round(finalPersonTotalsMinor[pid] || 0);
  }

  const rawTransfers = greedyMinCashFlow(netBalancesMinor, approvedIds);

  // Remaining transfers take paidFlag / paidAmountMinor settlements into account
  const settledBalances = { ...netBalancesMinor };
  for (const person of approvedPeople) {
    const bal = settledBalances[person.id] || 0;
    if (bal < 0) {
      const owed = Math.abs(bal);
      const settledBack = person.paidFlag
        ? owed
        : Math.min(owed, Math.max(0, Math.round(person.paidAmountMinor || 0)));
      if (settledBack > 0 && rawTransfers.length > 0) {
        // Reduce debtor deficit and matching creditor surplus proportionally
        const myRawOut = rawTransfers.filter((t) => t.fromPersonId === person.id);
        const rawOutSum = myRawOut.reduce((a, t) => a + t.amountMinor, 0);
        if (rawOutSum > 0) {
          const weights: Record<string, number> = {};
          const credIds: string[] = [];
          for (const t of myRawOut) {
            weights[t.toPersonId] = (weights[t.toPersonId] || 0) + t.amountMinor;
            if (!credIds.includes(t.toPersonId)) credIds.push(t.toPersonId);
          }
          const credReduction = distributeLargestRemainder(
            Math.min(settledBack, rawOutSum),
            weights,
            credIds
          );
          settledBalances[person.id] += Math.min(settledBack, rawOutSum);
          for (const cid of credIds) {
            settledBalances[cid] = Math.max(0, (settledBalances[cid] || 0) - (credReduction[cid] || 0));
          }
        }
      }
    }
  }

  const remainingTransfers = greedyMinCashFlow(settledBalances, approvedIds);

  const ownerPaidToMerchantMinor = ownerId ? paidToMerchantMap[ownerId] || 0 : 0;
  const ownerShareMinor = ownerId ? Math.round(finalPersonTotalsMinor[ownerId] || 0) : 0;
  const ownerNet = netBalancesMinor[ownerId] || 0;
  const ownerOwedByOthersMinor = ownerNet > 0 ? ownerNet : 0;
  const ownerOwesOthersMinor = ownerNet < 0 ? Math.abs(ownerNet) : 0;

  // User decision: record total paid by "Me" (ownerPaidToMerchantMinor if owner paid merchant, else ownerShareMinor)
  const recommendedExpenseMinor =
    ownerPaidToMerchantMinor > 0 ? ownerPaidToMerchantMinor : ownerShareMinor;

  return {
    effectivePayers,
    payersTotalMinor,
    payerMismatchMinor: payersTotalMinor - computedTotalMinor,
    rawTransfers,
    remainingTransfers,
    netBalancesMinor,
    ownerPaidToMerchantMinor,
    ownerShareMinor,
    ownerOwedByOthersMinor,
    ownerOwesOthersMinor,
    recommendedExpenseMinor,
  };
}

export interface BillComputation {
  allocation: ItemAllocationResult;
  extras: ExtrasComputationResult;
  rawPersonTotalsMinor: Record<string, number>;
  rounding: RoundingResult;
  finalPersonTotalsMinor: Record<string, number>;
  computedTotalMinor: number;
  unroundedTotalMinor: number;
  reconcile: ReconcileResult;
  settlement: SettlementResult;
}

export function computeBill(session: BillSession): BillComputation {
  const allocation = allocateItems(session);
  const extras = computeExtras(session, allocation);
  const ownerId = getOwnerPersonId(session);

  const rawPersonTotalsMinor: Record<string, number> = {};
  let unroundedAssignedTotalMinor = 0;
  for (const pid of allocation.approvedIds) {
    const raw = (allocation.perPersonItemsMinor[pid] || 0) + (extras.perPersonExtrasMinor[pid] || 0);
    rawPersonTotalsMinor[pid] = raw;
    unroundedAssignedTotalMinor += raw;
  }

  const unroundedTotalMinor = allocation.itemsSubtotalMinor + extras.extrasTotalMinor;
  const primaryPayerId =
    session.payerMode === 'custom' && session.payers.length > 0
      ? [...session.payers].sort((a, b) => b.amountMinor - a.amountMinor)[0].personId
      : ownerId;

  const rounding = applyRounding(
    rawPersonTotalsMinor,
    session.rounding,
    ownerId,
    primaryPayerId,
    allocation.approvedIds
  );

  const finalPersonTotalsMinor = rounding.perPersonRoundedMinor;
  const finalAssignedSum = Object.values(finalPersonTotalsMinor).reduce((a, b) => a + b, 0);
  const computedTotalMinor =
    allocation.approvedIds.length > 0
      ? finalAssignedSum + allocation.unassignedSubtotalMinor
      : unroundedTotalMinor;

  const reconcileRes = reconcile(session, allocation, computedTotalMinor);
  const settlement = settle(session, finalPersonTotalsMinor, computedTotalMinor);

  return {
    allocation,
    extras,
    rawPersonTotalsMinor,
    rounding,
    finalPersonTotalsMinor,
    computedTotalMinor,
    unroundedTotalMinor,
    reconcile: reconcileRes,
    settlement,
  };
}

export function formatMinorMoney(
  minor: number,
  currencySymbol: string,
  lang: 'ar' | 'en' = 'en'
): string {
  const major = (Number.isFinite(minor) ? minor : 0) / 100;
  const absFormatted = Math.abs(major).toLocaleString(lang === 'ar' ? 'en-US' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const prefix = major < 0 ? '-' : '';
  return `${prefix}${currencySymbol} ${absFormatted}`;
}
