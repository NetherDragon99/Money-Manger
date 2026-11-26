import React, { useEffect, useMemo, useState } from 'react';
import { Check, ClipboardPaste, X } from 'lucide-react';
import { BillExtra, BillItem } from '../../types';
import { formatMinorMoney } from '../../utils/billSplitEngine';
import { buildItemsFromParsed, parseBillText } from '../../utils/billSplitParser';
import { translations } from '../../utils/translations';

interface BillPasteModalProps {
  isOpen: boolean;
  currency: string;
  language: 'ar' | 'en';
  onClose: () => void;
  onApply: (data: { items: BillItem[]; extras: BillExtra[]; statedTotalMinor?: number }) => void;
  t: (key: keyof typeof translations.en) => string;
}

export const BillPasteModal: React.FC<BillPasteModalProps> = ({
  isOpen,
  currency,
  language,
  onClose,
  onApply,
  t,
}) => {
  const [rawText, setRawText] = useState('');
  const [priceMode, setPriceMode] = useState<'unit' | 'line_total'>('unit');

  useEffect(() => {
    if (!isOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [isOpen, onClose]);

  const parsed = useMemo(() => parseBillText(rawText), [rawText]);
  const previewItems = useMemo(
    () => buildItemsFromParsed(parsed.items, priceMode),
    [parsed.items, priceMode]
  );

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (previewItems.length === 0 && parsed.extras.length === 0 && parsed.statedTotalMinor === undefined) {
      return;
    }
    onApply({
      items: previewItems,
      extras: parsed.extras,
      statedTotalMinor: parsed.statedTotalMinor,
    });
    setRawText('');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-[12px] p-0 sm:p-4 overscroll-contain"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[90dvh] flex flex-col rounded-t-[22px] sm:rounded-[22px] bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-5 space-y-4 shadow-2xl overflow-y-auto overscroll-contain modal-container-anim"
        style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
      >
        <div className="w-10 h-1 rounded-full bg-[var(--border-strong)] mx-auto sm:hidden shrink-0" />
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ClipboardPaste className="w-5 h-5 text-[var(--accent-primary)]" />
            <h3 className="text-lg font-bold text-[var(--text-primary)]">{t('billPasteModalTitle')}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{t('billPasteModalDesc')}</p>

        <textarea
          dir="auto"
          rows={5}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder={t('billPastePlaceholder')}
          className="w-full px-3.5 py-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[16px] sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] font-mono"
        />

        {/* Price mode pill toggle */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={() => setPriceMode('unit')}
            className={`min-h-[38px] rounded-lg text-xs font-bold transition cursor-pointer ${
              priceMode === 'unit'
                ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            {t('billPastePriceModeUnit')}
          </button>
          <button
            type="button"
            onClick={() => setPriceMode('line_total')}
            className={`min-h-[38px] rounded-lg text-xs font-bold transition cursor-pointer ${
              priceMode === 'line_total'
                ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            {t('billPastePriceModeTotal')}
          </button>
        </div>

        {/* Parsed Preview */}
        {(previewItems.length > 0 || parsed.extras.length > 0 || parsed.statedTotalMinor !== undefined) && (
          <div className="rounded-2xl bg-[var(--bg-tertiary)]/70 border border-[var(--border-subtle)] p-3.5 space-y-2 max-h-52 overflow-y-auto overscroll-contain">
            <span className="text-xs font-bold text-[var(--accent-primary)] block">
              {t('billPastePreviewTitle')} ({previewItems.length})
            </span>
            {previewItems.map((it) => (
              <div key={it.id} className="flex items-center justify-between gap-2 text-xs">
                <span dir="auto" className="font-semibold text-[var(--text-primary)] truncate">
                  {it.name} ×{it.qty}
                </span>
                <span className="font-mono tabular-nums text-[var(--text-secondary)] shrink-0">
                  {formatMinorMoney(Math.round(it.unitPriceMinor * it.qty), currency, language)}
                </span>
              </div>
            ))}
            {parsed.extras.map((ex) => (
              <div key={ex.id} className="flex items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
                <span>+ {ex.label}</span>
                <span className="font-mono tabular-nums">
                  {ex.valueType === 'percent' ? `${ex.value}%` : formatMinorMoney(ex.value, currency, language)}
                </span>
              </div>
            ))}
            {parsed.statedTotalMinor !== undefined && (
              <div className="pt-1.5 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs font-bold text-[var(--accent-primary)]">
                <span>{t('billWrittenLabel')}</span>
                <span className="font-mono tabular-nums">
                  {formatMinorMoney(parsed.statedTotalMinor, currency, language)}
                </span>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={handleConfirm}
          disabled={previewItems.length === 0 && parsed.extras.length === 0 && parsed.statedTotalMinor === undefined}
          className="w-full min-h-[48px] rounded-full bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-45 cursor-pointer"
        >
          <Check className="w-4 h-4" />
          <span>{t('billPasteApplyBtn')}</span>
        </button>
      </div>
    </div>
  );
};
