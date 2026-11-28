import React, { useState } from 'react';
import { ChevronDown, Minus, Percent, Plus, Trash2 } from 'lucide-react';
import { BillItem, BillPerson, BillSession } from '../../types';
import {
  BillComputation,
  formatMinorMoney,
  getItemLineTotalMinor,
} from '../../utils/billSplitEngine';
import { translations } from '../../utils/translations';
import { BillPersonAvatar } from './BillPersonAvatar';

interface BillReadOnlyItemsAndExtrasProps {
  session: BillSession;
  computation: BillComputation;
  currency: string;
  language: 'ar' | 'en';
  boundPerson?: BillPerson | null;
  canClaimOwn?: boolean;
  canEditItems?: boolean;
  onSetClaimUnits?: (item: BillItem, units: number) => void;
  onDeleteItem?: (itemId: string) => void;
  onOpenPerson?: (person: BillPerson) => void;
  t: (key: keyof typeof translations.en) => string;
}

export const BillReadOnlyItemsAndExtras: React.FC<BillReadOnlyItemsAndExtrasProps> = ({
  session,
  computation,
  currency,
  language,
  boundPerson,
  canClaimOwn = false,
  canEditItems = false,
  onSetClaimUnits,
  onDeleteItem,
  onOpenPerson,
  t,
}) => {
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [expandedExtraId, setExpandedExtraId] = useState<string | null>(null);

  const approvedPeople = session.people.filter((p) => p.approval === 'approved');
  const peopleById = new Map(approvedPeople.map((p) => [p.id, p]));
  const isApprovedBound = boundPerson && boundPerson.approval === 'approved';

  const modeLabel = (mode: BillItem['mode']) => {
    if (mode === 'everyone') return t('billModeEveryone');
    if (mode === 'units') return t('billModeUnits');
    if (mode === 'exact') return t('billModeExact');
    return t('billModeEqual');
  };

  return (
    <div className="space-y-4">
      {/* Items List (every item expands on tap for everyone, including View Only!) */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            {t('billItemsSubtotalLabel')} ({session.items.length})
          </span>
          {session.items.length > 0 && (
            <span className="text-[10px] text-[var(--text-tertiary)]">
              {t('billItemTapDetailsHint')}
            </span>
          )}
        </div>

        {session.items.map((item) => {
          const lineTotal = getItemLineTotalMinor(item);
          const alloc = computation.allocation.itemAllocations[item.id] || {};
          const isExpanded = expandedItemId === item.id;

          const myUnits =
            isApprovedBound && boundPerson ? Number(item.claims?.[boundPerson.id]) || 0 : 0;
          const myShare =
            isApprovedBound && boundPerson ? alloc[boundPerson.id] || 0 : 0;
          const claimed =
            item.mode === 'equal_among'
              ? Boolean(
                  isApprovedBound &&
                    boundPerson &&
                    ((item.equalAmong || []).includes(boundPerson.id) || myUnits > 0)
                )
              : myUnits > 0 || myShare > 0;

          const participants = approvedPeople
            .map((p) => ({
              person: p,
              shareMinor: alloc[p.id] || 0,
              units: Number(item.claims?.[p.id]) || 0,
            }))
            .filter((row) => row.shareMinor > 0);

          return (
            <div
              key={item.id}
              className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] overflow-hidden"
              style={{ contain: 'layout style' }}
            >
              <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setExpandedItemId((cur) => (cur === item.id ? null : item.id))}
                  className="min-w-0 flex-1 flex items-center justify-between gap-2 text-start cursor-pointer py-0.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span dir="auto" className="text-sm font-bold text-[var(--text-primary)] truncate">
                        {item.name}
                      </span>
                      {item.qty !== 1 && (
                        <span className="text-xs font-mono font-bold text-[var(--text-secondary)] shrink-0">
                          ×{item.qty}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-[var(--text-secondary)] flex items-center gap-1.5 flex-wrap">
                      <span>{formatMinorMoney(lineTotal, currency, language)}</span>
                      <span>•</span>
                      <span className="font-sans text-[10px]">{modeLabel(item.mode)}</span>
                      {myShare > 0 && (
                        <span className="text-[var(--accent-primary)] font-bold">
                          ({t('billYouLabel')}: {formatMinorMoney(myShare, currency, language)})
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-[var(--text-tertiary)] shrink-0 transition-transform duration-150 ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Interactive Claim / Helper Delete Controls (STRICTLY hidden when View Only!) */}
                {(canClaimOwn || canEditItems) && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {canClaimOwn &&
                      onSetClaimUnits &&
                      item.mode !== 'everyone' &&
                      item.mode !== 'exact' && (
                        item.mode === 'units' ? (
                          <div className="inline-flex items-center gap-1 p-0.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
                            <button
                              type="button"
                              disabled={myUnits <= 0}
                              onClick={() => onSetClaimUnits(item, Math.max(0, myUnits - 1))}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-primary)] disabled:opacity-40 cursor-pointer active:scale-[0.95]"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="min-w-[20px] text-center text-xs font-mono font-bold tabular-nums text-[var(--accent-primary)]">
                              {myUnits}
                            </span>
                            <button
                              type="button"
                              onClick={() => onSetClaimUnits(item, myUnits + 1)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center bg-[var(--accent-soft)] text-[var(--accent-primary)] cursor-pointer active:scale-[0.95]"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onSetClaimUnits(item, claimed ? 0 : 1)}
                            className={`min-h-[36px] px-3 rounded-xl border text-xs font-bold cursor-pointer active:scale-[0.97] transition ${
                              claimed
                                ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)] text-[var(--text-on-accent)]'
                                : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                            }`}
                          >
                            {claimed ? t('billGuestMineDoneBtn') : t('billGuestMineBtn')}
                          </button>
                        )
                      )}

                    {canEditItems && onDeleteItem && (
                      <button
                        type="button"
                        onClick={() => onDeleteItem(item.id)}
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--status-danger)] cursor-pointer"
                        aria-label={t('billDeleteBtn')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Expanded Per-Person Item Details */}
              {isExpanded && (
                <div className="px-3.5 pb-3 pt-2 border-t border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/40 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                    <span>
                      {formatMinorMoney(item.unitPriceMinor, currency, language)} × {item.qty}
                    </span>
                    <span className="font-bold text-[var(--accent-primary)]">
                      {modeLabel(item.mode)}
                    </span>
                  </div>

                  {participants.length === 0 ? (
                    <p className="text-xs text-[var(--text-tertiary)]">{t('billItemNoClaimsYet')}</p>
                  ) : (
                    <div className="space-y-1.5">
                      {participants.map(({ person, shareMinor, units }) => (
                        <button
                          key={person.id}
                          type="button"
                          onClick={() => onOpenPerson?.(person)}
                          className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-xs cursor-pointer hover:border-[var(--border-strong)] transition"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <BillPersonAvatar
                              name={person.name}
                              avatar={person.avatar}
                              photoURL={person.photoURL}
                              size="xs"
                            />
                            <span dir="auto" className="font-bold text-[var(--text-primary)] truncate">
                              {person.name}
                            </span>
                            {item.mode === 'units' && units > 0 && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent-primary)] font-bold">
                                ×{units}
                              </span>
                            )}
                          </div>
                          <span className="font-mono tabular-nums font-extrabold text-[var(--text-primary)] shrink-0">
                            {formatMinorMoney(shareMinor, currency, language)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Independent Taxes, Service, Delivery & Discounts Section */}
      {session.extras.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>{t('billExtrasGuestSectionTitle')} ({session.extras.length})</span>
            </span>
          </div>

          {computation.extras.perExtraBreakdown.map((bd) => {
            const rawExtra = session.extras.find((e) => e.id === bd.extraId);
            if (!rawExtra) return null;
            const isExpanded = expandedExtraId === bd.extraId;
            const myExMinor =
              isApprovedBound && boundPerson ? bd.perPersonMinor[boundPerson.id] || 0 : 0;
            const ruleBadge =
              rawExtra.valueType === 'percent'
                ? `${rawExtra.sign === -1 ? '-' : '+'}${rawExtra.value}%`
                : `${rawExtra.sign === -1 ? '-' : '+'}${formatMinorMoney(rawExtra.value, currency, language)}`;

            return (
              <div
                key={bd.extraId}
                className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedExtraId((cur) => (cur === bd.extraId ? null : bd.extraId))
                  }
                  className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-start cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span dir="auto" className="text-sm font-bold text-[var(--text-primary)] truncate">
                        {bd.label}
                      </span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)] shrink-0">
                        {ruleBadge}
                      </span>
                    </div>
                    {isApprovedBound && boundPerson && myExMinor !== 0 && (
                      <div className="text-[11px] font-mono tabular-nums text-[var(--accent-primary)] font-bold">
                        {t('billYouLabel')}: {myExMinor > 0 ? '+' : ''}
                        {formatMinorMoney(myExMinor, currency, language)}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-sm font-mono tabular-nums font-extrabold ${
                        bd.computedMinor < 0
                          ? 'text-[var(--status-success)]'
                          : 'text-[var(--text-primary)]'
                      }`}
                    >
                      {bd.computedMinor > 0 ? '+' : ''}
                      {formatMinorMoney(bd.computedMinor, currency, language)}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform duration-150 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-3.5 pb-3 pt-2 border-t border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/40 space-y-1.5">
                    {approvedPeople.map((p) => {
                      const pAmt = bd.perPersonMinor[p.id] || 0;
                      const isExempt = rawExtra.exemptPersonIds?.includes(p.id);
                      if (pAmt === 0 && !isExempt) return null;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => onOpenPerson?.(p)}
                          className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-xs cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <BillPersonAvatar
                              name={p.name}
                              avatar={p.avatar}
                              photoURL={p.photoURL}
                              size="xs"
                            />
                            <span dir="auto" className="font-bold text-[var(--text-primary)] truncate">
                              {p.name}
                            </span>
                          </div>
                          {isExempt && pAmt === 0 ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                              {t('billExtraExemptTag')}
                            </span>
                          ) : (
                            <span
                              className={`font-mono tabular-nums font-extrabold ${
                                pAmt < 0
                                  ? 'text-[var(--status-success)]'
                                  : 'text-[var(--text-primary)]'
                              }`}
                            >
                              {pAmt > 0 ? '+' : ''}
                              {formatMinorMoney(pAmt, currency, language)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Step-by-Step Bill Totals Breakdown (Subtotal -> Extras -> Final Total) */}
      {session.items.length > 0 && (
        <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-3.5 space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-[var(--text-secondary)]">
            <span>{t('billSummarySubtotal')}</span>
            <span className="font-mono tabular-nums font-bold text-[var(--text-primary)]">
              {formatMinorMoney(computation.allocation.itemsSubtotalMinor, currency, language)}
            </span>
          </div>
          {computation.extras.extrasTotalMinor !== 0 && (
            <div className="flex items-center justify-between text-[var(--text-secondary)]">
              <span>{t('billSummaryExtras')}</span>
              <span
                className={`font-mono tabular-nums font-bold ${
                  computation.extras.extrasTotalMinor < 0
                    ? 'text-[var(--status-success)]'
                    : 'text-[var(--text-primary)]'
                }`}
              >
                {computation.extras.extrasTotalMinor > 0 ? '+' : ''}
                {formatMinorMoney(computation.extras.extrasTotalMinor, currency, language)}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1.5 border-t border-[var(--border-subtle)] text-sm font-extrabold text-[var(--text-primary)]">
            <span>{t('billTotalLabel')}</span>
            <span className="font-mono tabular-nums text-[var(--accent-primary)]">
              {formatMinorMoney(computation.computedTotalMinor, currency, language)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
