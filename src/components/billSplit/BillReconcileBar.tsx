import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Edit3, Sparkles, X } from 'lucide-react';
import { BillExtra, BillSession } from '../../types';
import {
  formatMinorMoney,
  fromMinor,
  generateBillId,
  ReconcileReasonCode,
  ReconcileResult,
  ReconcileSuggestionAction,
  toMinor,
} from '../../utils/billSplitEngine';
import { translations } from '../../utils/translations';

interface BillReconcileBarProps {
  session: BillSession;
  reconcile: ReconcileResult;
  currency: string;
  language: 'ar' | 'en';
  unassignedCount: number;
  unitMismatchCount: number;
  exactMismatchCount?: number;
  onUpdateSession: (updater: (prev: BillSession) => BillSession) => void;
  t: (key: keyof typeof translations.en) => string;
}

export const BillReconcileBar: React.FC<BillReconcileBarProps> = ({
  session,
  reconcile,
  currency,
  language,
  unassignedCount,
  unitMismatchCount,
  exactMismatchCount = 0,
  onUpdateSession,
  t,
}) => {
  const isAr = language === 'ar';
  const [editingTotal, setEditingTotal] = useState(false);
  const [totalInput, setTotalInput] = useState('');

  const openEditor = () => {
    setTotalInput(
      session.statedTotalMinor !== undefined && session.statedTotalMinor > 0
        ? String(fromMinor(session.statedTotalMinor))
        : ''
    );
    setEditingTotal(true);
  };

  const commitTotal = (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleaned = totalInput.replace(/,/g, '').trim();
    if (!cleaned) {
      onUpdateSession((prev) => ({
        ...prev,
        statedTotalMinor: undefined,
        diffResolution: undefined,
      }));
      setEditingTotal(false);
      return;
    }
    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    onUpdateSession((prev) => ({
      ...prev,
      statedTotalMinor: toMinor(parsed),
      diffResolution: undefined,
    }));
    setEditingTotal(false);
  };

  const getReasonText = (code: ReconcileReasonCode, itemName?: string): string => {
    switch (code) {
      case 'rounding_cents':
        return t('billReasonRounding');
      case 'missing_service_12':
        return t('billReasonMissingService12');
      case 'missing_vat_14':
        return t('billReasonMissingVat14');
      case 'missing_service_and_vat':
        return t('billReasonMissingServiceVat');
      case 'missing_service_and_vat_compound':
        return t('billReasonMissingServiceVatCompound');
      case 'missing_percent_10':
        return t('billReasonMissingPct10');
      case 'missing_percent_15':
        return t('billReasonMissingPct15');
      case 'missing_item_unit':
        return `${t('billReasonMissingItemUnit')} ${itemName || ''}`;
      case 'duplicate_item_unit':
        return `${t('billReasonDuplicateItemUnit')} ${itemName || ''}`;
      case 'unlisted_discount':
        return t('billReasonUnlistedDiscount');
      default:
        return t('billReasonUnlistedItem');
    }
  };

  const applySuggestion = (act: ReconcileSuggestionAction) => {
    if (act.type === 'ignore_diff') {
      onUpdateSession((prev) => ({
        ...prev,
        diffResolution: { kind: 'ignored', amountMinor: act.amountMinor, resolvedAt: Date.now() },
      }));
      return;
    }

    if (act.type === 'adjust_item_qty') {
      onUpdateSession((prev) => ({
        ...prev,
        diffResolution: undefined,
        items: prev.items.map((it) =>
          it.id === act.itemId ? { ...it, qty: Math.max(1, it.qty + act.deltaQty) } : it
        ),
      }));
      return;
    }

    if (act.type === 'add_uncategorized_item') {
      onUpdateSession((prev) => ({
        ...prev,
        diffResolution: { kind: 'item', amountMinor: act.amountMinor, resolvedAt: Date.now() },
        items: [
          ...prev.items,
          {
            id: `item_${generateBillId().slice(0, 8)}`,
            name: isAr ? 'بند غير مصنّف' : 'Uncategorized Item',
            unitPriceMinor: Math.max(0, act.amountMinor),
            qty: 1,
            mode: 'everyone',
            claims: {},
          },
        ],
      }));
      return;
    }

    if (act.type === 'spread_extra' || act.type === 'mark_rounding') {
      const sign: 1 | -1 = act.amountMinor >= 0 ? 1 : -1;
      onUpdateSession((prev) => ({
        ...prev,
        diffResolution: {
          kind: act.type === 'mark_rounding' ? 'rounding' : 'spread',
          amountMinor: act.amountMinor,
          resolvedAt: Date.now(),
        },
        extras: [
          ...prev.extras,
          {
            id: `extra_${generateBillId().slice(0, 8)}`,
            kind: 'custom',
            label:
              act.type === 'mark_rounding'
                ? isAr
                  ? 'فرق تقريب الفاتورة'
                  : 'Receipt Rounding'
                : isAr
                ? 'فرق الفاتورة (موزّع)'
                : 'Bill Adjustment',
            valueType: 'fixed',
            value: Math.abs(act.amountMinor),
            base: 'subtotal',
            sign,
            distribution: 'equal',
            exemptPersonIds: [],
            customAmountsMinor: {},
            exemptMode: 'redistribute',
          },
        ],
      }));
      return;
    }

    if (act.type === 'add_extra_preset') {
      onUpdateSession((prev) => {
        const nextExtras: BillExtra[] = [...prev.extras];
        if (act.id === 'preset_service_12_vat_14_compound' || act.id === 'preset_service_12_vat_14') {
          nextExtras.push({
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
          });
          nextExtras.push({
            id: `extra_${generateBillId().slice(0, 8)}`,
            kind: 'tax',
            label: isAr ? 'ضريبة 14٪' : 'VAT 14%',
            valueType: 'percent',
            value: 14,
            base: act.compoundVatAfterService ? 'subtotal_plus_previous' : 'subtotal',
            sign: 1,
            distribution: 'proportional',
            exemptPersonIds: [],
            customAmountsMinor: {},
            exemptMode: 'redistribute',
          });
        } else if (act.percent !== undefined) {
          nextExtras.push({
            id: `extra_${generateBillId().slice(0, 8)}`,
            kind: act.kind,
            label:
              act.kind === 'service'
                ? isAr
                  ? `خدمة ${act.percent}٪`
                  : `Service ${act.percent}%`
                : isAr
                ? `ضريبة ${act.percent}٪`
                : `VAT ${act.percent}%`,
            valueType: 'percent',
            value: act.percent,
            base:
              act.kind === 'tax' && prev.extras.some((e) => e.kind === 'service')
                ? 'subtotal_plus_previous'
                : 'subtotal',
            sign: act.sign || 1,
            distribution: 'proportional',
            exemptPersonIds: [],
            customAmountsMinor: {},
            exemptMode: 'redistribute',
          });
        } else if (act.fixedMinor !== undefined) {
          nextExtras.push({
            id: `extra_${generateBillId().slice(0, 8)}`,
            kind: act.kind,
            label: act.sign === -1 ? (isAr ? 'خصم الفاتورة' : 'Bill Discount') : isAr ? 'بند إضافي' : 'Extra Charge',
            valueType: 'fixed',
            value: act.fixedMinor,
            base: 'subtotal',
            sign: act.sign || 1,
            distribution: 'proportional',
            exemptPersonIds: [],
            customAmountsMinor: {},
            exemptMode: 'redistribute',
          });
        }
        return { ...prev, diffResolution: undefined, extras: nextExtras };
      });
    }
  };

  const renderSuggestionLabel = (act: ReconcileSuggestionAction): string => {
    if (act.type === 'ignore_diff') return t('billFixIgnore');
    if (act.type === 'add_uncategorized_item') return t('billFixAddUncategorized');
    if (act.type === 'spread_extra' || act.type === 'mark_rounding') return t('billFixSpreadEqual');
    if (act.type === 'adjust_item_qty') {
      return `${t('billFixAdjustQty')} (${act.deltaQty > 0 ? '+1' : '-1'} ${act.itemName})`;
    }
    if (act.type === 'add_extra_preset') {
      if (act.id === 'preset_service_12_vat_14_compound' || act.id === 'preset_service_12_vat_14') {
        return t('billFixAddServiceVat');
      }
      if (act.percent === 12) return t('billFixAddService12');
      if (act.percent === 14) return t('billFixAddVat14');
      if (act.percent) return `+ ${act.percent}%`;
      if (act.sign === -1) return t('billFixAddDiscount');
    }
    return t('billAddCustomExtraBtn');
  };

  const isMatched = reconcile.status === 'matched';
  const isMismatch = reconcile.status === 'mismatch';
  const isIgnored = reconcile.status === 'ignored';

  return (
    <div
      className={`rounded-2xl border p-3.5 space-y-2.5 transition-colors ${
        isMismatch
          ? 'bg-[var(--status-danger)]/10 border-[var(--status-danger)]/40'
          : isMatched
          ? 'bg-[var(--status-success)]/10 border-[var(--status-success)]/35'
          : 'bg-[var(--bg-secondary)] border-[var(--border-subtle)]'
      }`}
    >
      {/* Top strip */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isMatched ? (
            <CheckCircle2 className="w-4 h-4 text-[var(--status-success)] shrink-0" />
          ) : isMismatch ? (
            <AlertTriangle className="w-4 h-4 text-[var(--status-danger)] shrink-0" />
          ) : (
            <Sparkles className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
            <span className="font-bold text-[var(--text-primary)] tabular-nums font-mono">
              {t('billComputedLabel')}: {formatMinorMoney(reconcile.computedTotalMinor, currency, language)}
            </span>
            {reconcile.statedTotalMinor !== undefined && (
              <span className="text-[var(--text-secondary)] tabular-nums font-mono">
                {t('billWrittenLabel')}: {formatMinorMoney(reconcile.statedTotalMinor, currency, language)}
              </span>
            )}
            {isMatched && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--status-success)]/20 text-[var(--status-success)]">
                {t('billMatchedBadge')}
              </span>
            )}
            {isIgnored && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--status-warning)]/20 text-[var(--status-warning)]">
                {t('billIgnoredBadge')}
              </span>
            )}
            {isMismatch && (
              <span className="font-bold text-[var(--status-danger)] tabular-nums font-mono">
                {t('billDiffLabel')}: {reconcile.diffMinor > 0 ? '+' : ''}
                {formatMinorMoney(reconcile.diffMinor, currency, language)}
              </span>
            )}
          </div>
        </div>

        {!editingTotal && (
          <button
            type="button"
            onClick={openEditor}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] hover:border-[var(--border-strong)] cursor-pointer shrink-0"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>
              {reconcile.statedTotalMinor !== undefined
                ? t('billWrittenLabel')
                : t('billStatedTotalSetBtn')}
            </span>
          </button>
        )}
      </div>

      {/* Inline Stated Total Editor */}
      {editingTotal && (
        <form onSubmit={commitTotal} className="flex items-center gap-2">
          <input
            type="text"
            inputMode="decimal"
            dir="ltr"
            autoFocus
            value={totalInput}
            onChange={(e) => setTotalInput(e.target.value)}
            placeholder={t('billStatedTotalPlaceholder')}
            className="flex-1 min-w-0 min-h-[44px] px-3 py-2 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--accent-primary)] text-[16px] sm:text-sm font-mono tabular-nums text-[var(--text-primary)]"
          />
          <button
            type="submit"
            className="min-h-[44px] px-4 rounded-xl bg-[var(--accent-primary)] text-white text-xs font-bold cursor-pointer shrink-0"
          >
            {t('billSaveBtn')}
          </button>
          <button
            type="button"
            onClick={() => {
              onUpdateSession((prev) => ({
                ...prev,
                statedTotalMinor: undefined,
                diffResolution: undefined,
              }));
              setEditingTotal(false);
            }}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-[var(--bg-tertiary)] text-[var(--text-secondary)] cursor-pointer shrink-0"
            title={t('billStatedTotalClearBtn')}
            aria-label={t('billStatedTotalClearBtn')}
          >
            <X className="w-4 h-4" />
          </button>
        </form>
      )}

      {/* Mismatch Diagnosis & 1-Tap Fixes */}
      {isMismatch && (
        <div className="space-y-2 pt-0.5">
          <p className="text-xs font-semibold text-[var(--text-primary)] leading-relaxed">
            {getReasonText(reconcile.reasonCode, reconcile.matchedItemName)}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {reconcile.suggestions.map((sug, i) => (
              <button
                key={`${sug.type}_${i}`}
                type="button"
                onClick={() => applySuggestion(sug)}
                className={`px-2.5 py-1.5 min-h-[34px] rounded-xl text-xs font-bold border transition cursor-pointer ${
                  sug.type === 'ignore_diff'
                    ? 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                    : 'bg-[var(--accent-soft)] border-[var(--accent-primary)]/35 text-[var(--accent-primary)]'
                }`}
              >
                {renderSuggestionLabel(sug)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Unassigned / Exact / Unit mismatch notices */}
      {(unassignedCount > 0 || unitMismatchCount > 0 || exactMismatchCount > 0) && (
        <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-[var(--status-warning)]">
          {unassignedCount > 0 && (
            <span>
              • {unassignedCount} {t('billUnassignedWarning')}
            </span>
          )}
          {exactMismatchCount > 0 && (
            <span>
              • {exactMismatchCount} {t('billExactMismatchWarning')}
            </span>
          )}
          {unitMismatchCount > 0 && <span>• {t('billUnitMismatchWarning')}</span>}
        </div>
      )}
    </div>
  );
};
