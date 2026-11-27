import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  Check,
  ChevronDown,
  ClipboardPaste,
  GripVertical,
  Minus,
  Plus,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { BillExtra, BillItem, BillPerson } from '../../types';
import {
  distributeLargestRemainder,
  ExactMismatchItem,
  formatMinorMoney,
  fromMinor,
  generateBillId,
  getItemLineTotalMinor,
  toMinor,
} from '../../utils/billSplitEngine';
import { translations } from '../../utils/translations';
import { BillPasteModal } from './BillPasteModal';

interface BillItemsEditorProps {
  items: BillItem[];
  people: BillPerson[];
  itemAllocations: Record<string, Record<string, number>>;
  unassignedItemIds: string[];
  exactMismatchItems?: ExactMismatchItem[];
  currency: string;
  language: 'ar' | 'en';
  onAddItem: (item: BillItem) => void;
  onUpdateItem: (itemId: string, patch: Partial<BillItem>) => void;
  onRemoveItem: (itemId: string) => void;
  onReorderItems: (fromIndex: number, toIndex: number) => void;
  onApplyParsedReceipt: (data: {
    items: BillItem[];
    extras: BillExtra[];
    statedTotalMinor?: number;
    title?: string;
  }) => void;
  onOpenOcrModal: () => void;
  t: (key: keyof typeof translations.en) => string;
}

interface DragRenderState {
  dragIndex: number;
  hoverIndex: number;
  deltaY: number;
  slotHeight: number;
}

export const BillItemsEditor: React.FC<BillItemsEditorProps> = ({
  items,
  people,
  itemAllocations,
  unassignedItemIds,
  exactMismatchItems = [],
  currency,
  language,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onReorderItems,
  onApplyParsedReceipt,
  onOpenOcrModal,
  t,
}) => {
  const isAr = language === 'ar';
  const approvedPeople = people.filter((p) => p.approval === 'approved');
  const unassignedSet = new Set(unassignedItemIds);
  const exactMismatchMap = new Map(exactMismatchItems.map((m) => [m.itemId, m]));

  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [sharedAllDefault, setSharedAllDefault] = useState(false);
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [draftExactInputs, setDraftExactInputs] = useState<Record<string, string>>({});
  const [draftUnitInputs, setDraftUnitInputs] = useState<Record<string, string>>({});
  const [draftPriceInputs, setDraftPriceInputs] = useState<Record<string, string>>({});
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  // 120fps Long-Press Drag-and-Drop refs & state
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [dragState, setDragState] = useState<DragRenderState | null>(null);
  const suppressClickUntilRef = useRef<number>(0);
  const dragSessionRef = useRef<{
    index: number;
    startX: number;
    startY: number;
    latestY: number;
    origCenterY: number;
    slotHeight: number;
    rects: Array<{ centerY: number }>;
    timer: ReturnType<typeof setTimeout> | null;
    rafId: number | null;
    isHandle: boolean;
    active: boolean;
    hoverIndex: number;
  } | null>(null);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const onReorderRef = useRef(onReorderItems);
  onReorderRef.current = onReorderItems;

  const cleanupDragListeners = useCallback(() => {
    if (dragSessionRef.current?.timer) {
      clearTimeout(dragSessionRef.current.timer);
    }
    if (dragSessionRef.current?.rafId !== null && dragSessionRef.current?.rafId !== undefined) {
      cancelAnimationFrame(dragSessionRef.current.rafId);
    }
    dragSessionRef.current = null;
    setDragState(null);
  }, []);

  useEffect(() => {
    const activateDrag = (sess: NonNullable<typeof dragSessionRef.current>) => {
      if (sess.active) return;
      const rects: Array<{ centerY: number }> = [];
      let slotHeight = 64;
      for (let i = 0; i < itemsRef.current.length; i++) {
        const el = rowRefs.current[i];
        if (el) {
          const r = el.getBoundingClientRect();
          rects.push({ centerY: r.top + r.height / 2 });
          if (i === sess.index) {
            slotHeight = r.height + 8; // matches space-y-2 (8px)
          }
        } else {
          rects.push({ centerY: 0 });
        }
      }
      sess.rects = rects;
      sess.origCenterY = rects[sess.index]?.centerY || sess.startY;
      sess.slotHeight = slotHeight;
      sess.active = true;
      sess.hoverIndex = sess.index;

      setExpandedItemId(null);
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try {
          navigator.vibrate(15);
        } catch {}
      }
      setDragState({
        dragIndex: sess.index,
        hoverIndex: sess.index,
        deltaY: sess.latestY - sess.startY,
        slotHeight,
      });
    };

    const handleWindowPointerMove = (e: PointerEvent) => {
      const sess = dragSessionRef.current;
      if (!sess) return;
      sess.latestY = e.clientY;
      const dx = Math.abs(e.clientX - sess.startX);
      const dy = Math.abs(e.clientY - sess.startY);

      if (!sess.active) {
        if (sess.isHandle) {
          if (dy > 4 || dx > 4) {
            if (sess.timer) clearTimeout(sess.timer);
            activateDrag(sess);
          }
        } else if (dy > 8 || dx > 8) {
          // User is scrolling vertically; cancel long-press cleanly
          cleanupDragListeners();
          return;
        }
      }

      if (sess.active) {
        if (e.cancelable) e.preventDefault();
        if (sess.rafId === null) {
          sess.rafId = requestAnimationFrame(() => {
            const cur = dragSessionRef.current;
            if (!cur || !cur.active) return;
            cur.rafId = null;
            const deltaY = cur.latestY - cur.startY;
            const draggedCenterY = cur.origCenterY + deltaY;
            let nextHover = cur.index;
            if (deltaY > 0) {
              for (let i = cur.index + 1; i < cur.rects.length; i++) {
                if (draggedCenterY > cur.rects[i].centerY) nextHover = i;
              }
            } else if (deltaY < 0) {
              for (let i = cur.index - 1; i >= 0; i--) {
                if (draggedCenterY < cur.rects[i].centerY) nextHover = i;
              }
            }
            cur.hoverIndex = nextHover;
            setDragState({
              dragIndex: cur.index,
              hoverIndex: nextHover,
              deltaY,
              slotHeight: cur.slotHeight,
            });
          });
        }
      }
    };

    const handleWindowPointerUp = () => {
      const sess = dragSessionRef.current;
      if (!sess) return;
      if (sess.active) {
        suppressClickUntilRef.current = Date.now() + 260;
        if (sess.hoverIndex !== sess.index) {
          onReorderRef.current(sess.index, sess.hoverIndex);
        }
      }
      cleanupDragListeners();
    };

    window.addEventListener('pointermove', handleWindowPointerMove, { passive: false });
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);
      cleanupDragListeners();
    };
  }, [cleanupDragListeners]);

  const handleRowPointerDown = (e: React.PointerEvent<HTMLDivElement>, index: number) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const target = e.target as HTMLElement;
    const isHandle = Boolean(target.closest('[data-drag-handle="true"]'));

    if (!isHandle) {
      if (
        target.closest('button, input, textarea, select, [data-accordion-body="true"]')
      ) {
        return;
      }
    }

    if (dragSessionRef.current) cleanupDragListeners();

    const sess: NonNullable<typeof dragSessionRef.current> = {
      index,
      startX: e.clientX,
      startY: e.clientY,
      latestY: e.clientY,
      origCenterY: 0,
      slotHeight: 64,
      rects: [],
      timer: null,
      rafId: null,
      isHandle,
      active: false,
      hoverIndex: index,
    };

    sess.timer = setTimeout(() => {
      const cur = dragSessionRef.current;
      if (!cur || cur.active) return;
      const rects: Array<{ centerY: number }> = [];
      let slotHeight = 64;
      for (let i = 0; i < itemsRef.current.length; i++) {
        const el = rowRefs.current[i];
        if (el) {
          const r = el.getBoundingClientRect();
          rects.push({ centerY: r.top + r.height / 2 });
          if (i === cur.index) slotHeight = r.height + 8;
        } else {
          rects.push({ centerY: 0 });
        }
      }
      cur.rects = rects;
      cur.origCenterY = rects[cur.index]?.centerY || cur.startY;
      cur.slotHeight = slotHeight;
      cur.active = true;
      cur.hoverIndex = cur.index;
      setExpandedItemId(null);
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try {
          navigator.vibrate(15);
        } catch {}
      }
      setDragState({
        dragIndex: cur.index,
        hoverIndex: cur.index,
        deltaY: cur.latestY - cur.startY,
        slotHeight,
      });
    }, isHandle ? 130 : 240);

    dragSessionRef.current = sess;
  };

  const submitNewItem = (forceEveryone = false) => {
    const cleanName = itemName.trim();
    const priceNum = Number(itemPrice.replace(/,/g, '').trim());
    const qtyNum = Number(itemQty.replace(/,/g, '').trim()) || 1;
    if (!cleanName || !Number.isFinite(priceNum) || priceNum <= 0) {
      nameInputRef.current?.focus();
      return;
    }

    onAddItem({
      id: `item_${generateBillId().slice(0, 8)}`,
      name: cleanName,
      unitPriceMinor: toMinor(priceNum),
      qty: qtyNum > 0 ? qtyNum : 1,
      mode: forceEveryone || sharedAllDefault ? 'everyone' : 'equal_among',
      claims: {},
      equalAmong: [],
    });

    setItemName('');
    setItemPrice('');
    setItemQty('1');
    setSharedAllDefault(false);
    nameInputRef.current?.focus();
  };

  const handleToggleEqualPerson = (item: BillItem, personId: string) => {
    if (item.mode === 'everyone') {
      const remaining = approvedPeople.map((p) => p.id).filter((id) => id !== personId);
      onUpdateItem(item.id, { mode: 'equal_among', equalAmong: remaining });
      return;
    }
    const current = item.equalAmong || [];
    const exists = current.includes(personId);
    const next = exists ? current.filter((id) => id !== personId) : [...current, personId];
    onUpdateItem(item.id, { equalAmong: next });
  };

  const handleToggleUnitPerson = (item: BillItem, personId: string) => {
    const current = Number(item.claims?.[personId]) || 0;
    const nextClaims = { ...(item.claims || {}) };
    if (current > 0) {
      delete nextClaims[personId];
    } else {
      nextClaims[personId] = 1;
    }
    onUpdateItem(item.id, { claims: nextClaims });
  };

  const handleSetUnitClaimDirect = (item: BillItem, personId: string, rawVal: string) => {
    const key = `${item.id}_${personId}`;
    setDraftUnitInputs((prev) => ({ ...prev, [key]: rawVal }));
    const cleaned = rawVal.replace(/,/g, '').trim();
    const nextClaims = { ...(item.claims || {}) };
    if (!cleaned) {
      delete nextClaims[personId];
      onUpdateItem(item.id, { claims: nextClaims });
      return;
    }
    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    if (parsed === 0) delete nextClaims[personId];
    else nextClaims[personId] = Math.round(parsed * 100) / 100;
    onUpdateItem(item.id, { claims: nextClaims });
  };

  const handleStepUnitClaim = (item: BillItem, personId: string, delta: number) => {
    const key = `${item.id}_${personId}`;
    setDraftUnitInputs((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
    const current = Number(item.claims?.[personId]) || 0;
    const nextVal = Math.max(0, Math.round((current + delta) * 100) / 100);
    const nextClaims = { ...(item.claims || {}) };
    if (nextVal <= 0) delete nextClaims[personId];
    else nextClaims[personId] = nextVal;
    onUpdateItem(item.id, { claims: nextClaims });
  };

  const handleSetExactAmountDirect = (item: BillItem, personId: string, rawVal: string) => {
    const key = `${item.id}_${personId}`;
    setDraftExactInputs((prev) => ({ ...prev, [key]: rawVal }));
    const cleaned = rawVal.replace(/,/g, '').trim();
    const nextExact = { ...(item.exactAmountsMinor || {}) };
    if (!cleaned) {
      delete nextExact[personId];
      onUpdateItem(item.id, { exactAmountsMinor: nextExact });
      return;
    }
    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    const minor = toMinor(parsed);
    if (minor <= 0) delete nextExact[personId];
    else nextExact[personId] = minor;
    onUpdateItem(item.id, { exactAmountsMinor: nextExact });
  };

  const handleToggleExactPerson = (item: BillItem, personId: string) => {
    const key = `${item.id}_${personId}`;
    setDraftExactInputs((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
    const currentMinor = Number(item.exactAmountsMinor?.[personId]) || 0;
    const nextExact = { ...(item.exactAmountsMinor || {}) };
    if (currentMinor > 0) {
      delete nextExact[personId];
    } else {
      const lineTotalMinor = getItemLineTotalMinor(item);
      const assignedSum = Object.values(nextExact).reduce((a, b) => a + (Number(b) || 0), 0);
      const remaining = Math.max(0, lineTotalMinor - assignedSum);
      nextExact[personId] = remaining > 0 ? remaining : lineTotalMinor;
    }
    onUpdateItem(item.id, { exactAmountsMinor: nextExact });
  };

  const handleFillRemainingExact = (item: BillItem, personId: string, remainingMinor: number) => {
    if (remainingMinor <= 0) return;
    const key = `${item.id}_${personId}`;
    setDraftExactInputs((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
    const currentMinor = Number(item.exactAmountsMinor?.[personId]) || 0;
    const nextExact = { ...(item.exactAmountsMinor || {}) };
    nextExact[personId] = currentMinor + remainingMinor;
    onUpdateItem(item.id, { exactAmountsMinor: nextExact });
  };

  const handleSplitRemainingEquallyExact = (item: BillItem, remainingMinor: number) => {
    if (remainingMinor <= 0 || approvedPeople.length === 0) return;
    const current = item.exactAmountsMinor || {};
    const zeroIds = approvedPeople.filter((p) => (current[p.id] || 0) <= 0).map((p) => p.id);
    const targetIds = zeroIds.length > 0 ? zeroIds : approvedPeople.map((p) => p.id);
    const weights: Record<string, number> = {};
    for (const id of targetIds) weights[id] = 1;
    const split = distributeLargestRemainder(remainingMinor, weights, targetIds);
    const nextExact = { ...current };
    for (const id of targetIds) {
      nextExact[id] = (nextExact[id] || 0) + (split[id] || 0);
    }
    setDraftExactInputs({});
    onUpdateItem(item.id, { exactAmountsMinor: nextExact });
  };

  const switchItemMode = (item: BillItem, m: BillItem['mode']) => {
    if (m === item.mode) return;
    if (m === 'units') {
      const initialClaims: Record<string, number> = { ...(item.claims || {}) };
      if (Object.keys(initialClaims).length === 0 && item.mode === 'equal_among' && item.equalAmong?.length) {
        for (const pid of item.equalAmong) initialClaims[pid] = 1;
      }
      onUpdateItem(item.id, { mode: 'units', claims: initialClaims });
    } else if (m === 'equal_among') {
      const seedEqual =
        item.equalAmong && item.equalAmong.length > 0
          ? item.equalAmong
          : Object.keys(item.claims || {}).filter((k) => (item.claims[k] || 0) > 0);
      onUpdateItem(item.id, { mode: 'equal_among', equalAmong: seedEqual });
    } else if (m === 'exact') {
      const existingExact = { ...(item.exactAmountsMinor || {}) };
      if (Object.keys(existingExact).length === 0) {
        const currentShares = itemAllocations[item.id] || {};
        for (const [pid, amt] of Object.entries(currentShares)) {
          if (amt > 0) existingExact[pid] = amt;
        }
      }
      onUpdateItem(item.id, { mode: 'exact', exactAmountsMinor: existingExact });
    } else {
      onUpdateItem(item.id, { mode: 'everyone' });
    }
  };

  return (
    <div className="space-y-3">
      {/* Fast Single-Row Item Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitNewItem(false);
        }}
        className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-3 space-y-2.5"
      >
        <div className="grid grid-cols-12 gap-2">
          <input
            ref={nameInputRef}
            type="text"
            dir="auto"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder={t('billItemNamePlaceholder')}
            className="col-span-5 min-w-0 min-h-[44px] px-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[16px] sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
          />
          <input
            type="text"
            inputMode="decimal"
            dir="ltr"
            value={itemPrice}
            onChange={(e) => setItemPrice(e.target.value)}
            placeholder={t('billItemPricePlaceholder')}
            className="col-span-4 min-w-0 min-h-[44px] px-2.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[16px] sm:text-sm font-mono tabular-nums text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
          />
          <input
            type="text"
            inputMode="decimal"
            dir="ltr"
            value={itemQty}
            onChange={(e) => setItemQty(e.target.value)}
            placeholder={t('billItemQtyPlaceholder')}
            className="col-span-3 min-w-0 min-h-[44px] px-2.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[16px] sm:text-sm font-mono tabular-nums text-center text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsPasteOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] cursor-pointer"
            >
              <ClipboardPaste className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>{t('billPasteReceiptBtn')}</span>
            </button>

            <button
              type="button"
              onClick={onOpenOcrModal}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] rounded-xl bg-[var(--accent-soft)] border border-[var(--accent-primary)]/35 text-xs font-bold text-[var(--accent-primary)] cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{t('billScanOcrBtn')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (itemName.trim() && Number(itemPrice) > 0) {
                  submitNewItem(true);
                } else {
                  setSharedAllDefault((v) => !v);
                }
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] rounded-xl border text-xs font-bold cursor-pointer transition ${
                sharedAllDefault
                  ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--accent-primary)]'
                  : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{t('billAddSharedAllBtn')}</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={!itemName.trim() || !(Number(itemPrice.replace(/,/g, '')) > 0)}
            className="min-h-[40px] px-4 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold flex items-center gap-1 disabled:opacity-45 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{t('billAddItemBtn')}</span>
          </button>
        </div>
      </form>

      {/* Empty State or Compact Draggable Items List */}
      {items.length === 0 ? (
        <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-6 text-center space-y-2">
          <Sparkles className="w-8 h-8 mx-auto text-[var(--accent-primary)] opacity-80" />
          <h4 className="text-sm font-bold text-[var(--text-primary)]">{t('billEmptyTitle')}</h4>
          <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto leading-relaxed">
            {t('billEmptyDesc')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.length > 1 && (
            <div className="flex items-center justify-between px-1 text-[11px] text-[var(--text-tertiary)]">
              <span>{t('billDragReorderHint')}</span>
              <span className="font-mono tabular-nums">{items.length}</span>
            </div>
          )}

          {items.map((item, idx) => {
            const lineTotalMinor = getItemLineTotalMinor(item);
            const isUnassigned = unassignedSet.has(item.id);
            const exactMismatch = exactMismatchMap.get(item.id);
            const itemShares = itemAllocations[item.id] || {};
            const isExpanded = expandedItemId === item.id;
            const claimedUnitsSum = Object.values(item.claims || {}).reduce(
              (a, b) => a + (Number(b) || 0),
              0
            );
            const exactAssignedSum = Object.values(item.exactAmountsMinor || {}).reduce(
              (a, b) => a + (Number(b) || 0),
              0
            );
            const exactRemainingMinor = lineTotalMinor - exactAssignedSum;

            // Participant preview for compact row
            const assignedPeople = approvedPeople.filter((p) => (itemShares[p.id] || 0) > 0);

            // 120fps GPU Drag Transform Calculation
            const isDragging = dragState?.dragIndex === idx;
            let siblingShiftY = 0;
            if (dragState && !isDragging) {
              const { dragIndex, hoverIndex, slotHeight } = dragState;
              if (dragIndex < hoverIndex && idx > dragIndex && idx <= hoverIndex) {
                siblingShiftY = -slotHeight;
              } else if (dragIndex > hoverIndex && idx >= hoverIndex && idx < dragIndex) {
                siblingShiftY = slotHeight;
              }
            }

            const rowTransform = isDragging
              ? `translate3d(0, ${dragState!.deltaY}px, 0) scale(1.02)`
              : siblingShiftY !== 0
              ? `translate3d(0, ${siblingShiftY}px, 0)`
              : 'translate3d(0, 0, 0)';

            return (
              <div
                key={item.id}
                ref={(el) => {
                  rowRefs.current[idx] = el;
                }}
                onPointerDown={(e) => handleRowPointerDown(e, idx)}
                style={{
                  transform: rowTransform,
                  transition: isDragging
                    ? 'none'
                    : 'transform 200ms cubic-bezier(0.22, 1, 0.36, 1), border-color 150ms ease',
                  zIndex: isDragging ? 50 : 1,
                  position: 'relative',
                  boxShadow: isDragging ? '0 16px 36px rgba(0,0,0,0.34)' : undefined,
                  contain: isDragging ? undefined : 'layout style',
                }}
                className={`rounded-2xl bg-[var(--bg-secondary)] border select-none ${
                  isDragging
                    ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-soft)] touch-none'
                    : isUnassigned || exactMismatch
                    ? 'border-[var(--status-warning)]/55'
                    : isExpanded
                    ? 'border-[var(--accent-primary)]/45'
                    : 'border-[var(--border-subtle)]'
                }`}
              >
                {/* Compact Single-Line Item Row */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (Date.now() < suppressClickUntilRef.current) return;
                    setExpandedItemId((prev) => (prev === item.id ? null : item.id));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setExpandedItemId((prev) => (prev === item.id ? null : item.id));
                    }
                  }}
                  className="min-h-[54px] px-2.5 sm:px-3 py-2 flex items-center justify-between gap-2 cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span
                      data-drag-handle="true"
                      className="p-1.5 -ms-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] cursor-grab active:cursor-grabbing touch-none shrink-0"
                      aria-label={t('billDragReorderHint')}
                    >
                      <GripVertical className="w-4 h-4" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span dir="auto" className="text-sm font-bold text-[var(--text-primary)] truncate">
                          {item.name}
                        </span>
                        {item.qty !== 1 && (
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono tabular-nums font-bold bg-[var(--bg-tertiary)] text-[var(--text-secondary)] shrink-0">
                            ×{item.qty}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-[var(--text-secondary)] truncate">
                        {formatMinorMoney(item.unitPriceMinor, currency, language)}
                        {item.qty !== 1 ? ` × ${item.qty}` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Right Summary: Participant Status + Line Total + Chevron */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isUnassigned ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--status-warning)]/15 text-[var(--status-warning)]">
                        <AlertCircle className="w-3 h-3" />
                        <span>{isAr ? 'اختر' : 'Assign'}</span>
                      </span>
                    ) : exactMismatch ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[var(--status-warning)]/15 text-[var(--status-warning)]">
                        {exactMismatch.diffMinor > 0 ? '+' : ''}
                        {formatMinorMoney(exactMismatch.diffMinor, currency, language)}
                      </span>
                    ) : item.mode === 'everyone' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                        {t('billModeEveryone')}
                      </span>
                    ) : (
                      <div className="flex items-center -space-x-1 rtl:space-x-reverse">
                        {assignedPeople.slice(0, 3).map((p) => (
                          <span
                            key={p.id}
                            className="w-5 h-5 rounded-full bg-[var(--bg-tertiary)] border border-[var(--bg-secondary)] flex items-center justify-center text-[11px]"
                            title={p.name}
                          >
                            {p.avatar || '👤'}
                          </span>
                        ))}
                        {assignedPeople.length > 3 && (
                          <span className="w-5 h-5 rounded-full bg-[var(--accent-soft)] border border-[var(--bg-secondary)] flex items-center justify-center text-[9px] font-bold text-[var(--accent-primary)]">
                            +{assignedPeople.length - 3}
                          </span>
                        )}
                      </div>
                    )}

                    <span className="text-sm font-mono tabular-nums font-extrabold text-[var(--text-primary)]">
                      {formatMinorMoney(lineTotalMinor, currency, language)}
                    </span>

                    <ChevronDown
                      className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform duration-150 ${
                        isExpanded ? 'rotate-180 text-[var(--accent-primary)]' : ''
                      }`}
                    />
                  </div>
                </div>

                {/* Expanded Accordion Settings Panel */}
                {isExpanded && (
                  <div
                    data-accordion-body="true"
                    className="border-t border-[var(--border-subtle)] px-3 pb-3.5 pt-3 space-y-3"
                  >
                    {/* Inline Item Field Editors */}
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <input
                        type="text"
                        dir="auto"
                        value={item.name}
                        onChange={(e) => onUpdateItem(item.id, { name: e.target.value })}
                        placeholder={t('billItemNamePlaceholder')}
                        className="col-span-5 min-w-0 min-h-[38px] px-2.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[16px] sm:text-xs font-bold text-[var(--text-primary)]"
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        dir="ltr"
                        value={
                          draftPriceInputs[item.id] ?? String(fromMinor(item.unitPriceMinor))
                        }
                        onChange={(e) => {
                          const v = e.target.value;
                          setDraftPriceInputs((prev) => ({ ...prev, [item.id]: v }));
                          const parsed = Number(v.replace(/,/g, '').trim());
                          if (Number.isFinite(parsed) && parsed >= 0) {
                            onUpdateItem(item.id, { unitPriceMinor: toMinor(parsed) });
                          }
                        }}
                        onBlur={() =>
                          setDraftPriceInputs((prev) => {
                            const copy = { ...prev };
                            delete copy[item.id];
                            return copy;
                          })
                        }
                        className="col-span-3 min-w-0 min-h-[38px] px-2 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[16px] sm:text-xs font-mono tabular-nums text-[var(--text-primary)]"
                      />
                      <div className="col-span-3 inline-flex items-center justify-between bg-[var(--bg-tertiary)] rounded-xl px-1 min-h-[38px] border border-[var(--border-subtle)]">
                        <button
                          type="button"
                          onClick={() => onUpdateItem(item.id, { qty: Math.max(0.5, item.qty - 1) })}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-mono tabular-nums font-bold text-[var(--text-primary)]">
                          {item.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateItem(item.id, { qty: item.qty + 1 })}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.id)}
                        className="col-span-1 min-h-[38px] flex items-center justify-center rounded-xl text-[var(--status-danger)] hover:bg-[var(--status-danger)]/15 cursor-pointer"
                        aria-label={t('billDeleteBtn')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* 4-Mode Segmented Control */}
                    <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
                      {(['everyone', 'equal_among', 'exact', 'units'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => switchItemMode(item, m)}
                          className={`min-h-[34px] px-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer truncate ${
                            item.mode === m
                              ? 'bg-[var(--bg-secondary)] text-[var(--accent-primary)] shadow-sm'
                              : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          {m === 'everyone'
                            ? t('billModeEveryone')
                            : m === 'equal_among'
                            ? t('billModeEqual')
                            : m === 'exact'
                            ? t('billModeExact')
                            : t('billModeUnits')}
                        </button>
                      ))}
                    </div>

                    {/* Mode-Specific People Controls */}
                    {(item.mode === 'everyone' || item.mode === 'equal_among') && (
                      <div className="flex flex-wrap gap-1.5">
                        {approvedPeople.map((person) => {
                          const share = itemShares[person.id] || 0;
                          const isSelected =
                            item.mode === 'everyone' ||
                            (item.equalAmong || []).includes(person.id);

                          return (
                            <button
                              key={person.id}
                              type="button"
                              onClick={() => handleToggleEqualPerson(item, person.id)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] rounded-xl border text-xs font-bold transition cursor-pointer ${
                                isSelected
                                  ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)]/45 text-[var(--text-primary)]'
                                  : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)] text-[var(--text-secondary)] opacity-80'
                              }`}
                            >
                              <span>{person.avatar || '👤'}</span>
                              <span dir="auto" className="truncate max-w-[90px]">
                                {person.name}
                              </span>
                              {share > 0 && (
                                <span className="text-[10px] font-mono tabular-nums text-[var(--accent-primary)]">
                                  {formatMinorMoney(share, currency, language)}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {item.mode === 'exact' && (
                      <div className="space-y-2">
                        {/* Exact Allocation Status & Quick Split Remaining */}
                        <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-[var(--bg-tertiary)]/75 border border-[var(--border-subtle)] text-[11px]">
                          <div className="flex items-center gap-2 font-mono tabular-nums">
                            <span className="text-[var(--text-secondary)]">
                              {t('billExactAssignedOf')}:{' '}
                              <strong className="text-[var(--text-primary)]">
                                {formatMinorMoney(exactAssignedSum, currency, language)}
                              </strong>{' '}
                              / {formatMinorMoney(lineTotalMinor, currency, language)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {exactRemainingMinor === 0 ? (
                              <span className="inline-flex items-center gap-1 text-[var(--status-success)] font-bold">
                                <Check className="w-3.5 h-3.5" />
                                <span>{t('billMatchedBadge')}</span>
                              </span>
                            ) : (
                              <>
                                <span className="font-mono tabular-nums font-bold text-[var(--status-warning)]">
                                  {t('billExactRemainingLabel')}:{' '}
                                  {formatMinorMoney(exactRemainingMinor, currency, language)}
                                </span>
                                {exactRemainingMinor > 0 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleSplitRemainingEquallyExact(item, exactRemainingMinor)
                                    }
                                    className="px-2 py-1 rounded-lg bg-[var(--accent-soft)] text-[var(--accent-primary)] font-bold cursor-pointer"
                                  >
                                    {t('billExactSplitRemainingBtn')}
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>

                        {/* Vertical Exact Input Rows */}
                        <div className="space-y-1.5">
                          {approvedPeople.map((person) => {
                            const minor = Number(item.exactAmountsMinor?.[person.id]) || 0;
                            const inputKey = `${item.id}_${person.id}`;
                            const displayVal =
                              draftExactInputs[inputKey] ??
                              (minor > 0 ? String(fromMinor(minor)) : '');
                            return (
                              <div
                                key={person.id}
                                className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border ${
                                  minor > 0
                                    ? 'bg-[var(--accent-soft)]/50 border-[var(--accent-primary)]/40'
                                    : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)]'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleToggleExactPerson(item, person.id)}
                                  className="flex items-center gap-2 min-w-0 flex-1 text-start cursor-pointer py-1"
                                >
                                  <span className="text-base shrink-0">{person.avatar || '👤'}</span>
                                  <span dir="auto" className="text-xs font-bold text-[var(--text-primary)] truncate">
                                    {person.name}
                                  </span>
                                </button>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  {exactRemainingMinor > 0 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleFillRemainingExact(item, person.id, exactRemainingMinor)
                                      }
                                      className="px-2 py-1 min-h-[32px] rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[10px] font-bold text-[var(--accent-primary)] cursor-pointer"
                                    >
                                      {t('billExactFillRestBtn')}
                                    </button>
                                  )}
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    dir="ltr"
                                    value={displayVal}
                                    placeholder="0.00"
                                    onChange={(e) =>
                                      handleSetExactAmountDirect(item, person.id, e.target.value)
                                    }
                                    onBlur={() =>
                                      setDraftExactInputs((prev) => {
                                        const copy = { ...prev };
                                        delete copy[inputKey];
                                        return copy;
                                      })
                                    }
                                    className="w-24 min-h-[36px] px-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-strong)] text-[16px] sm:text-xs font-mono tabular-nums text-end text-[var(--text-primary)]"
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {item.mode === 'units' && (
                      <div className="space-y-1.5">
                        {approvedPeople.map((person) => {
                          const unitCount = Number(item.claims?.[person.id]) || 0;
                          const share = itemShares[person.id] || 0;
                          const inputKey = `${item.id}_${person.id}`;
                          const displayVal =
                            draftUnitInputs[inputKey] ?? (unitCount > 0 ? String(unitCount) : '');

                          return (
                            <div
                              key={person.id}
                              className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border ${
                                unitCount > 0
                                  ? 'bg-[var(--accent-soft)]/50 border-[var(--accent-primary)]/40'
                                  : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)]'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => handleToggleUnitPerson(item, person.id)}
                                className="flex items-center gap-2 min-w-0 flex-1 text-start cursor-pointer py-1"
                              >
                                <span className="text-base shrink-0">{person.avatar || '👤'}</span>
                                <div className="min-w-0">
                                  <span dir="auto" className="text-xs font-bold text-[var(--text-primary)] truncate block">
                                    {person.name}
                                  </span>
                                  {share > 0 && (
                                    <span className="text-[10px] font-mono tabular-nums text-[var(--accent-primary)]">
                                      {formatMinorMoney(share, currency, language)}
                                    </span>
                                  )}
                                </div>
                              </button>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleStepUnitClaim(item, person.id, -0.5)}
                                  disabled={unitCount <= 0}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] disabled:opacity-40 cursor-pointer"
                                  aria-label="Decrease units"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  dir="ltr"
                                  value={displayVal}
                                  placeholder="0"
                                  onChange={(e) =>
                                    handleSetUnitClaimDirect(item, person.id, e.target.value)
                                  }
                                  onBlur={() =>
                                    setDraftUnitInputs((prev) => {
                                      const copy = { ...prev };
                                      delete copy[inputKey];
                                      return copy;
                                    })
                                  }
                                  className="w-14 min-h-[34px] px-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-strong)] text-[16px] sm:text-xs font-mono tabular-nums text-center text-[var(--text-primary)]"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleStepUnitClaim(item, person.id, 0.5)}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] cursor-pointer"
                                  aria-label="Increase units"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {claimedUnitsSum > 0 && Math.abs(claimedUnitsSum - item.qty) > 0.001 && (
                          <p className="text-[11px] font-semibold text-[var(--status-warning)] px-1">
                            {isAr
                              ? `الوحدات المحددة (${claimedUnitsSum}) لا تساوي الكمية (${item.qty}) — الحصص محسوبة نسبياً بين المحددين`
                              : `Claimed units (${claimedUnitsSum}) differ from item qty (${item.qty}) — split proportionally`}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <BillPasteModal
        isOpen={isPasteOpen}
        currency={currency}
        language={language}
        onClose={() => setIsPasteOpen(false)}
        onApply={onApplyParsedReceipt}
        t={t}
      />
    </div>
  );
};
