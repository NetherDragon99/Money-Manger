import React, { useState } from 'react';
import { ChevronDown, Percent, Plus, Trash2, Users } from 'lucide-react';
import { BillExtra, BillPerson, ExtraKind } from '../../types';
import {
  ComputedExtraBreakdown,
  formatMinorMoney,
  fromMinor,
  generateBillId,
  toMinor,
} from '../../utils/billSplitEngine';
import { translations } from '../../utils/translations';

interface BillExtrasSheetProps {
  extras: BillExtra[];
  breakdown: ComputedExtraBreakdown[];
  people: BillPerson[];
  currency: string;
  language: 'ar' | 'en';
  onAddExtra: (extra: BillExtra) => void;
  onUpdateExtra: (extraId: string, patch: Partial<BillExtra>) => void;
  onRemoveExtra: (extraId: string) => void;
  t: (key: keyof typeof translations.en) => string;
}

export const BillExtrasSheet: React.FC<BillExtrasSheetProps> = ({
  extras,
  breakdown,
  people,
  currency,
  language,
  onAddExtra,
  onUpdateExtra,
  onRemoveExtra,
  t,
}) => {
  const isAr = language === 'ar';
  const approvedPeople = people.filter((p) => p.approval === 'approved');
  const [expandedExtraId, setExpandedExtraId] = useState<string | null>(null);
  const [customDraftMap, setCustomDraftMap] = useState<Record<string, Record<string, string>>>({});

  const addPreset = (kind: ExtraKind) => {
    const hasService = extras.some((e) => e.kind === 'service');
    let extra: BillExtra;
    if (kind === 'service') {
      extra = {
        id: `extra_${generateBillId().slice(0, 8)}`,
        kind: 'service',
        label: isAr ? 'خدمة 12٪' : 'Service 12%',
        valueType: 'percent',
        value: 12,
        base: 'subtotal',
        sign: 1,
        distribution: 'proportional',
        exemptPersonIds: [],
        customAmountsMinor: {},
        exemptMode: 'redistribute',
      };
    } else if (kind === 'tax') {
      extra = {
        id: `extra_${generateBillId().slice(0, 8)}`,
        kind: 'tax',
        label: isAr ? 'ضريبة 14٪' : 'VAT 14%',
        valueType: 'percent',
        value: 14,
        base: hasService ? 'subtotal_plus_previous' : 'subtotal',
        sign: 1,
        distribution: 'proportional',
        exemptPersonIds: [],
        customAmountsMinor: {},
        exemptMode: 'redistribute',
      };
    } else if (kind === 'delivery') {
      extra = {
        id: `extra_${generateBillId().slice(0, 8)}`,
        kind: 'delivery',
        label: isAr ? 'توصيل' : 'Delivery',
        valueType: 'fixed',
        value: 3000,
        base: 'subtotal',
        sign: 1,
        distribution: 'equal',
        exemptPersonIds: [],
        customAmountsMinor: {},
        exemptMode: 'redistribute',
      };
    } else if (kind === 'tip') {
      extra = {
        id: `extra_${generateBillId().slice(0, 8)}`,
        kind: 'tip',
        label: isAr ? 'بخشيش' : 'Tip',
        valueType: 'fixed',
        value: 2000,
        base: 'subtotal',
        sign: 1,
        distribution: 'proportional',
        exemptPersonIds: [],
        customAmountsMinor: {},
        exemptMode: 'redistribute',
      };
    } else if (kind === 'discount') {
      extra = {
        id: `extra_${generateBillId().slice(0, 8)}`,
        kind: 'discount',
        label: isAr ? 'خصم' : 'Discount',
        valueType: 'fixed',
        value: 5000,
        base: 'subtotal',
        sign: -1,
        distribution: 'proportional',
        exemptPersonIds: [],
        customAmountsMinor: {},
        exemptMode: 'redistribute',
      };
    } else {
      extra = {
        id: `extra_${generateBillId().slice(0, 8)}`,
        kind: 'custom',
        label: isAr ? 'رسوم إضافية' : 'Extra Charge',
        valueType: 'fixed',
        value: 1000,
        base: 'subtotal',
        sign: 1,
        distribution: 'equal',
        exemptPersonIds: [],
        customAmountsMinor: {},
        exemptMode: 'redistribute',
      };
    }

    onAddExtra(extra);
    setExpandedExtraId(extra.id);
  };

  return (
    <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-3.5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
          <Percent className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          <span>{t('billExtrasTitle')}</span>
        </span>
      </div>

      {/* 1-Tap Preset Chips */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => addPreset('service')}
          className="px-2.5 py-1.5 min-h-[34px] rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] hover:border-[var(--accent-primary)]/50 cursor-pointer"
        >
          {t('billAddExtraPresetService')}
        </button>
        <button
          type="button"
          onClick={() => addPreset('tax')}
          className="px-2.5 py-1.5 min-h-[34px] rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] hover:border-[var(--accent-primary)]/50 cursor-pointer"
        >
          {t('billAddExtraPresetVat')}
        </button>
        <button
          type="button"
          onClick={() => addPreset('delivery')}
          className="px-2.5 py-1.5 min-h-[34px] rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] hover:border-[var(--accent-primary)]/50 cursor-pointer"
        >
          {t('billAddExtraPresetDelivery')}
        </button>
        <button
          type="button"
          onClick={() => addPreset('tip')}
          className="px-2.5 py-1.5 min-h-[34px] rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] hover:border-[var(--accent-primary)]/50 cursor-pointer"
        >
          {t('billAddExtraPresetTip')}
        </button>
        <button
          type="button"
          onClick={() => addPreset('discount')}
          className="px-2.5 py-1.5 min-h-[34px] rounded-xl bg-[var(--status-success)]/12 border border-[var(--status-success)]/30 text-xs font-bold text-[var(--status-success)] cursor-pointer"
        >
          {t('billAddExtraPresetDiscount')}
        </button>
        <button
          type="button"
          onClick={() => addPreset('custom')}
          className="px-2.5 py-1.5 min-h-[34px] rounded-xl bg-[var(--accent-soft)] border border-[var(--accent-primary)]/30 text-xs font-bold text-[var(--accent-primary)] inline-flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t('billAddCustomExtraBtn').replace(/^\+\s*/, '')}</span>
        </button>
      </div>

      {/* Active Extras List */}
      {extras.length > 0 && (
        <div className="space-y-2">
          {extras.map((extra) => {
            const bd = breakdown.find((b) => b.extraId === extra.id);
            const computedMinor = bd?.computedMinor || 0;
            const isExpanded = expandedExtraId === extra.id;

            return (
              <div
                key={extra.id}
                className="rounded-xl bg-[var(--bg-tertiary)]/75 border border-[var(--border-subtle)] overflow-hidden"
                style={{ contain: 'layout style' }}
              >
                <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => setExpandedExtraId(isExpanded ? null : extra.id)}
                    className="flex items-center gap-2 min-w-0 flex-1 text-start cursor-pointer"
                  >
                    <ChevronDown
                      className={`w-4 h-4 text-[var(--text-secondary)] transition-transform duration-150 shrink-0 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                    <div className="min-w-0">
                      <div dir="auto" className="text-xs font-bold text-[var(--text-primary)] truncate">
                        {extra.label}
                      </div>
                      <div className="text-[10px] text-[var(--text-secondary)] flex flex-wrap items-center gap-1.5">
                        <span>
                          {extra.valueType === 'percent'
                            ? `${extra.value}%`
                            : formatMinorMoney(extra.value, currency, language)}
                        </span>
                        <span>•</span>
                        <span>
                          {extra.distribution === 'equal'
                            ? t('billExtraDistEqual')
                            : t('billExtraDistProportional')}
                        </span>
                        {extra.exemptPersonIds.length > 0 && (
                          <span>• {isAr ? `معفى: ${extra.exemptPersonIds.length}` : `Exempt: ${extra.exemptPersonIds.length}`}</span>
                        )}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`text-xs font-mono tabular-nums font-extrabold ${
                        computedMinor < 0 ? 'text-[var(--status-success)]' : 'text-[var(--text-primary)]'
                      }`}
                    >
                      {computedMinor >= 0 ? '+' : ''}
                      {formatMinorMoney(computedMinor, currency, language)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveExtra(extra.id)}
                      className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--status-danger)] cursor-pointer"
                      aria-label={t('billDeleteBtn')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-3 pb-3 pt-2 border-t border-[var(--border-subtle)] space-y-3 bg-[var(--bg-secondary)]/60">
                    {/* Label & Value Type & Value */}
                    <div className="grid grid-cols-12 gap-2">
                      <input
                        type="text"
                        dir="auto"
                        value={extra.label}
                        onChange={(e) => onUpdateExtra(extra.id, { label: e.target.value })}
                        placeholder={t('billExtraLabelPlaceholder')}
                        className="col-span-5 min-w-0 min-h-[40px] px-2.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[16px] sm:text-xs font-semibold text-[var(--text-primary)]"
                      />
                      <div className="col-span-4 grid grid-cols-2 p-0.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateExtra(extra.id, {
                              valueType: 'percent',
                              value: extra.valueType === 'fixed' ? 12 : extra.value,
                            })
                          }
                          className={`rounded-lg text-[11px] font-bold cursor-pointer ${
                            extra.valueType === 'percent'
                              ? 'bg-[var(--bg-secondary)] text-[var(--accent-primary)]'
                              : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          %
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateExtra(extra.id, {
                              valueType: 'fixed',
                              value: extra.valueType === 'percent' ? 2000 : extra.value,
                            })
                          }
                          className={`rounded-lg text-[11px] font-bold cursor-pointer ${
                            extra.valueType === 'fixed'
                              ? 'bg-[var(--bg-secondary)] text-[var(--accent-primary)]'
                              : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          {currency}
                        </button>
                      </div>
                      <input
                        type="text"
                        inputMode="decimal"
                        dir="ltr"
                        value={
                          extra.valueType === 'percent'
                            ? String(extra.value)
                            : String(fromMinor(extra.value))
                        }
                        onChange={(e) => {
                          const n = Number(e.target.value.replace(/,/g, ''));
                          if (!Number.isFinite(n) || n < 0) return;
                          onUpdateExtra(extra.id, {
                            value: extra.valueType === 'percent' ? n : toMinor(n),
                          });
                        }}
                        className="col-span-3 min-w-0 min-h-[40px] px-2 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[16px] sm:text-xs font-mono tabular-nums text-center text-[var(--text-primary)]"
                      />
                    </div>

                    {/* Base Order + Sign + Distribution */}
                    <div className="flex flex-wrap gap-1.5">
                      {extra.valueType === 'percent' && (
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateExtra(extra.id, {
                              base:
                                extra.base === 'subtotal' ? 'subtotal_plus_previous' : 'subtotal',
                            })
                          }
                          className="px-2.5 py-1.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[11px] font-bold text-[var(--text-primary)] cursor-pointer"
                        >
                          {extra.base === 'subtotal'
                            ? t('billExtraBaseSubtotal')
                            : t('billExtraBasePlusPrev')}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          onUpdateExtra(extra.id, {
                            distribution:
                              extra.distribution === 'proportional' ? 'equal' : 'proportional',
                          })
                        }
                        className="px-2.5 py-1.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[11px] font-bold text-[var(--text-primary)] cursor-pointer"
                      >
                        {extra.distribution === 'proportional'
                          ? t('billExtraDistProportional')
                          : t('billExtraDistEqual')}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onUpdateExtra(extra.id, { sign: extra.sign === 1 ? -1 : 1 })
                        }
                        className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold cursor-pointer ${
                          extra.sign === -1
                            ? 'bg-[var(--status-success)]/15 border-[var(--status-success)]/40 text-[var(--status-success)]'
                            : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {extra.sign === -1 ? (isAr ? 'خصم (-)' : 'Discount (-)') : (isAr ? 'إضافة (+)' : 'Charge (+)')}
                      </button>
                    </div>

                    {/* Exempt People */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-[var(--text-secondary)] flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          <span>{t('billExtraExemptTitle')}</span>
                        </span>
                        {extra.exemptPersonIds.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateExtra(extra.id, {
                                exemptMode:
                                  extra.exemptMode === 'redistribute' ? 'absorb' : 'redistribute',
                              })
                            }
                            className="text-[11px] font-bold text-[var(--accent-primary)] cursor-pointer"
                          >
                            {extra.exemptMode === 'redistribute'
                              ? t('billExtraExemptRedistribute')
                              : t('billExtraExemptAbsorb')}
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {approvedPeople.map((p) => {
                          const isExempt = extra.exemptPersonIds.includes(p.id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                const next = isExempt
                                  ? extra.exemptPersonIds.filter((id) => id !== p.id)
                                  : [...extra.exemptPersonIds, p.id];
                                onUpdateExtra(extra.id, { exemptPersonIds: next });
                              }}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold border cursor-pointer ${
                                isExempt
                                  ? 'bg-[var(--status-warning)]/20 border-[var(--status-warning)]/50 text-[var(--status-warning)]'
                                  : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                              }`}
                            >
                              {p.avatar || '👤'} {p.name} {isExempt ? (isAr ? '· معفى' : '· Exempt') : ''}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Custom fixed amount per person */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-[var(--text-secondary)] block">
                        {t('billExtraCustomPersonTitle')}
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {approvedPeople
                          .filter((p) => !extra.exemptPersonIds.includes(p.id))
                          .map((p) => {
                            const hasCustom = Object.prototype.hasOwnProperty.call(
                              extra.customAmountsMinor || {},
                              p.id
                            );
                            const draftStr =
                              customDraftMap[extra.id]?.[p.id] ??
                              (hasCustom ? String(fromMinor(extra.customAmountsMinor[p.id])) : '');
                            return (
                              <div
                                key={p.id}
                                className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]"
                              >
                                <span dir="auto" className="text-[11px] font-semibold text-[var(--text-primary)] truncate flex-1">
                                  {p.name}
                                </span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  dir="ltr"
                                  placeholder="auto"
                                  value={draftStr}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setCustomDraftMap((m) => ({
                                      ...m,
                                      [extra.id]: { ...(m[extra.id] || {}), [p.id]: val },
                                    }));
                                    const nextCustom = { ...(extra.customAmountsMinor || {}) };
                                    if (!val.trim()) {
                                      delete nextCustom[p.id];
                                      onUpdateExtra(extra.id, { customAmountsMinor: nextCustom });
                                    } else {
                                      const num = Number(val.replace(/,/g, ''));
                                      if (Number.isFinite(num) && num >= 0) {
                                        nextCustom[p.id] = toMinor(num);
                                        onUpdateExtra(extra.id, { customAmountsMinor: nextCustom });
                                      }
                                    }
                                  }}
                                  className="w-14 min-h-[30px] px-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[14px] sm:text-[11px] font-mono tabular-nums text-center text-[var(--text-primary)]"
                                />
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
