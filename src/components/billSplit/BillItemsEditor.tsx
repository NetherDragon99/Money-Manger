import React, { useRef, useState } from 'react';
import {
  Camera,
  ClipboardPaste,
  Minus,
  Plus,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { BillExtra, BillItem, BillPerson } from '../../types';
import {
  formatMinorMoney,
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
  currency: string;
  language: 'ar' | 'en';
  onAddItem: (item: BillItem) => void;
  onUpdateItem: (itemId: string, patch: Partial<BillItem>) => void;
  onRemoveItem: (itemId: string) => void;
  onApplyParsedReceipt: (data: { items: BillItem[]; extras: BillExtra[]; statedTotalMinor?: number }) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  t: (key: keyof typeof translations.en) => string;
}

export const BillItemsEditor: React.FC<BillItemsEditorProps> = ({
  items,
  people,
  itemAllocations,
  unassignedItemIds,
  currency,
  language,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onApplyParsedReceipt,
  showToast,
  t,
}) => {
  const isAr = language === 'ar';
  const approvedPeople = people.filter((p) => p.approval === 'approved');
  const unassignedSet = new Set(unassignedItemIds);

  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [sharedAllDefault, setSharedAllDefault] = useState(false);
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleTogglePersonOnItem = (item: BillItem, personId: string) => {
    if (item.mode === 'everyone') {
      // Switch to equal_among excluding this tapped person (smart intuitive exclusion!)
      const remaining = approvedPeople.map((p) => p.id).filter((id) => id !== personId);
      onUpdateItem(item.id, { mode: 'equal_among', equalAmong: remaining });
      return;
    }

    if (item.mode === 'equal_among') {
      const current = item.equalAmong || [];
      const exists = current.includes(personId);
      const next = exists ? current.filter((id) => id !== personId) : [...current, personId];
      onUpdateItem(item.id, { equalAmong: next });
      return;
    }

    // 'units' mode: tap adds +1 unit; hold/minus button reduces
    const currentUnits = Number(item.claims?.[personId]) || 0;
    const nextClaims = { ...(item.claims || {}) };
    if (currentUnits <= 0) nextClaims[personId] = 1;
    else nextClaims[personId] = currentUnits + 1;
    onUpdateItem(item.id, { claims: nextClaims });
  };

  const handleStepUnitClaim = (item: BillItem, personId: string, delta: number) => {
    const current = Number(item.claims?.[personId]) || 0;
    const nextVal = Math.max(0, Math.round((current + delta) * 100) / 100);
    const nextClaims = { ...(item.claims || {}) };
    if (nextVal <= 0) delete nextClaims[personId];
    else nextClaims[personId] = nextVal;
    onUpdateItem(item.id, { claims: nextClaims });
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

            <button
              type="button"
              onClick={() => showToast(t('billScanOcrComingDesc'), 'info')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-secondary)] cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{t('billScanOcrBtn')}</span>
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

      {/* Empty State */}
      {items.length === 0 ? (
        <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-6 text-center space-y-2">
          <Sparkles className="w-8 h-8 mx-auto text-[var(--accent-primary)] opacity-80" />
          <h4 className="text-sm font-bold text-[var(--text-primary)]">{t('billEmptyTitle')}</h4>
          <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto leading-relaxed">
            {t('billEmptyDesc')}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => {
            const lineTotalMinor = getItemLineTotalMinor(item);
            const isUnassigned = unassignedSet.has(item.id);
            const itemShares = itemAllocations[item.id] || {};
            const claimedUnitsSum = Object.values(item.claims || {}).reduce((a, b) => a + (Number(b) || 0), 0);

            return (
              <div
                key={item.id}
                className={`rounded-2xl bg-[var(--bg-secondary)] border p-3.5 space-y-3 transition-colors ${
                  isUnassigned
                    ? 'border-[var(--status-warning)]/60'
                    : 'border-[var(--border-subtle)]'
                }`}
                style={{ contain: 'layout style' }}
              >
                {/* Item Header Row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span dir="auto" className="text-sm font-bold text-[var(--text-primary)] break-words">
                        {item.name}
                      </span>
                      {item.qty !== 1 && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-mono tabular-nums font-bold bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                          ×{item.qty}
                        </span>
                      )}
                      {isUnassigned && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--status-warning)]/15 text-[var(--status-warning)]">
                          {isAr ? 'اختر من شارك' : 'Unassigned'}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-[var(--text-secondary)] mt-0.5">
                      {formatMinorMoney(item.unitPriceMinor, currency, language)} × {item.qty}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-mono tabular-nums font-extrabold text-[var(--text-primary)]">
                      {formatMinorMoney(lineTotalMinor, currency, language)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.id)}
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl text-[var(--text-tertiary)] hover:text-[var(--status-danger)] hover:bg-[var(--status-danger)]/10 cursor-pointer"
                      aria-label={t('billDeleteBtn')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Mode Switcher Pills + Qty Stepper */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center p-0.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
                    {(['everyone', 'equal_among', 'units'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          if (m === 'units') {
                            // Initialize claims cleanly when entering units mode
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
                          } else {
                            onUpdateItem(item.id, { mode: 'everyone' });
                          }
                        }}
                        className={`px-2.5 py-1 min-h-[30px] rounded-lg text-[11px] font-bold transition cursor-pointer ${
                          item.mode === m
                            ? 'bg-[var(--bg-secondary)] text-[var(--accent-primary)] shadow-sm'
                            : 'text-[var(--text-secondary)]'
                        }`}
                      >
                        {m === 'everyone'
                          ? t('billModeEveryone')
                          : m === 'equal_among'
                          ? t('billModeEqual')
                          : t('billModeUnits')}
                      </button>
                    ))}
                  </div>

                  {/* Quick item qty +/- */}
                  <div className="inline-flex items-center gap-1 bg-[var(--bg-tertiary)] rounded-xl px-1.5 py-0.5 border border-[var(--border-subtle)]">
                    <button
                      type="button"
                      onClick={() => onUpdateItem(item.id, { qty: Math.max(0.5, item.qty - 1) })}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-mono tabular-nums font-bold px-1 text-[var(--text-primary)]">
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
                </div>

                {/* People Assignment Chips */}
                <div className="flex flex-wrap gap-1.5">
                  {approvedPeople.map((person) => {
                    const share = itemShares[person.id] || 0;
                    const unitCount = Number(item.claims?.[person.id]) || 0;
                    const isSelected =
                      item.mode === 'everyone' ||
                      (item.mode === 'equal_among' && (item.equalAmong || []).includes(person.id)) ||
                      (item.mode === 'units' && unitCount > 0);

                    return (
                      <div
                        key={person.id}
                        className={`inline-flex items-center rounded-xl border transition ${
                          isSelected
                            ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)]/45 text-[var(--text-primary)]'
                            : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)] text-[var(--text-secondary)] opacity-80'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleTogglePersonOnItem(item, person.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[34px] text-xs font-bold cursor-pointer"
                        >
                          <span>{person.avatar || '👤'}</span>
                          <span dir="auto" className="truncate max-w-[85px]">
                            {person.name}
                          </span>
                          {item.mode === 'units' && unitCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full bg-[var(--accent-primary)] text-white text-[10px] font-mono tabular-nums">
                              {unitCount}
                            </span>
                          )}
                          {share > 0 && (
                            <span className="text-[10px] font-mono tabular-nums text-[var(--accent-primary)]">
                              {formatMinorMoney(share, currency, language)}
                            </span>
                          )}
                        </button>

                        {item.mode === 'units' && unitCount > 0 && (
                          <button
                            type="button"
                            onClick={() => handleStepUnitClaim(item, person.id, -1)}
                            className="pe-2 ps-1 py-1.5 text-[var(--text-secondary)] hover:text-[var(--status-danger)] cursor-pointer"
                            aria-label="Decrease person units"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {item.mode === 'units' && claimedUnitsSum > 0 && Math.abs(claimedUnitsSum - item.qty) > 0.001 && (
                  <p className="text-[11px] font-semibold text-[var(--status-warning)]">
                    {isAr
                      ? `الوحدات المحددة (${claimedUnitsSum}) لا تساوي الكمية (${item.qty}) — الحصص محسوبة نسبياً بين المحددين`
                      : `Claimed units (${claimedUnitsSum}) differ from item qty (${item.qty}) — split proportionally`}
                  </p>
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
