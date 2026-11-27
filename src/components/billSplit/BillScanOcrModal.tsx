import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  ImagePlus,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { BillExtra, BillItem } from '../../types';
import { formatMinorMoney, toMinor } from '../../utils/billSplitEngine';
import {
  buildBillEntriesFromOcr,
  compressReceiptImage,
  OcrErrorCode,
  OcrExtractedExtra,
  OcrExtractedItem,
  OcrScanError,
  scanReceiptWithAi,
} from '../../utils/billSplitOcr';
import { translations } from '../../utils/translations';

interface BillScanOcrModalProps {
  isOpen: boolean;
  currency: string;
  language: 'ar' | 'en';
  onClose: () => void;
  onApply: (data: {
    items: BillItem[];
    extras: BillExtra[];
    statedTotalMinor?: number;
    title?: string;
  }) => void;
  t: (key: keyof typeof translations.en) => string;
}

export const BillScanOcrModal: React.FC<BillScanOcrModalProps> = ({
  isOpen,
  currency,
  language,
  onClose,
  onApply,
  t,
}) => {
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const lastCompressedRef = useRef<{ base64: string; mimeType: string; previewDataUrl: string } | null>(null);

  const [phase, setPhase] = useState<'pick' | 'scanning' | 'review' | 'error'>('pick');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<OcrErrorCode>('failed');
  const [title, setTitle] = useState('');
  const [items, setItems] = useState<OcrExtractedItem[]>([]);
  const [extras, setExtras] = useState<OcrExtractedExtra[]>([]);
  const [statedTotal, setStatedTotal] = useState<number | undefined>(undefined);
  const [includeTotal, setIncludeTotal] = useState(true);
  const [priceMode, setPriceMode] = useState<'unit' | 'line_total'>('unit');

  const resetModal = () => {
    lastCompressedRef.current = null;
    setPhase('pick');
    setPreviewUrl(null);
    setTitle('');
    setItems([]);
    setExtras([]);
    setStatedTotal(undefined);
    setIncludeTotal(true);
    setPriceMode('unit');
  };

  useEffect(() => {
    if (!isOpen) return;
    resetModal();
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const runAiScan = async (compressed: { base64: string; mimeType: string; previewDataUrl: string }) => {
    setPhase('scanning');
    setPreviewUrl(compressed.previewDataUrl);
    try {
      const res = await scanReceiptWithAi(compressed);
      setTitle(res.title || '');
      setItems(res.items);
      setExtras(res.extras);
      setStatedTotal(res.statedTotal);
      setIncludeTotal(Boolean(res.statedTotal && res.statedTotal > 0));
      setPhase('review');
    } catch (err) {
      if (err instanceof OcrScanError) {
        setErrorCode(err.code);
      } else {
        setErrorCode('failed');
      }
      setPhase('error');
    }
  };

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setPhase('scanning');
    try {
      const compressed = await compressReceiptImage(file);
      lastCompressedRef.current = compressed;
      await runAiScan(compressed);
    } catch (err) {
      lastCompressedRef.current = null;
      if (err instanceof OcrScanError) {
        setErrorCode(err.code);
      } else {
        setErrorCode('failed');
      }
      setPhase('error');
    }
  };

  const handleRetrySamePhoto = () => {
    if (lastCompressedRef.current && errorCode !== 'no_items') {
      runAiScan(lastCompressedRef.current);
    } else {
      resetModal();
    }
  };

  const handleApply = () => {
    const built = buildBillEntriesFromOcr(items, extras, priceMode);
    if (built.items.length === 0) return;
    onApply({
      items: built.items,
      extras: built.extras,
      statedTotalMinor: includeTotal && statedTotal && statedTotal > 0 ? toMinor(statedTotal) : undefined,
      title: title.trim() || undefined,
    });
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
            <Sparkles className="w-5 h-5 text-[var(--accent-primary)]" />
            <h3 className="text-lg font-bold text-[var(--text-primary)]">{t('billOcrModalTitle')}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] cursor-pointer active:scale-[0.97] transition"
            aria-label={t('billOcrCloseAria')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hidden native file pickers */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFilePicked}
          className="hidden"
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          onChange={handleFilePicked}
          className="hidden"
        />

        {phase === 'pick' && (
          <div className="space-y-3">
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {t('billOcrModalDesc')}
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="min-h-[96px] rounded-2xl bg-[var(--accent-soft)] border border-[var(--accent-primary)]/40 text-[var(--accent-primary)] flex flex-col items-center justify-center gap-2 p-4 font-bold text-sm cursor-pointer active:scale-[0.97] transition"
              >
                <Camera className="w-6 h-6" />
                <span>{t('billOcrTakePhotoBtn')}</span>
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="min-h-[96px] rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-primary)] flex flex-col items-center justify-center gap-2 p-4 font-bold text-sm cursor-pointer active:scale-[0.97] transition"
              >
                <ImagePlus className="w-6 h-6 text-[var(--accent-primary)]" />
                <span>{t('billOcrPickGalleryBtn')}</span>
              </button>
            </div>
          </div>
        )}

        {phase === 'scanning' && (
          <div className="space-y-4 py-4">
            {previewUrl && (
              <div className="rounded-2xl overflow-hidden border border-[var(--border-subtle)] max-h-48 bg-[var(--bg-primary)]">
                <img
                  src={previewUrl}
                  alt="Receipt preview"
                  className="w-full h-44 object-contain mx-auto opacity-85"
                />
              </div>
            )}
            <div className="space-y-2 text-center">
              <div className="h-1 w-full rounded-full bg-[var(--bg-tertiary)] overflow-hidden relative">
                <div
                  className="h-full w-1/2 rounded-full bg-[var(--accent-primary)] animate-pulse"
                  style={{ transform: 'translate3d(50%, 0, 0)' }}
                />
              </div>
              <p className="text-xs font-bold text-[var(--accent-primary)]">{t('billOcrScanningMsg')}</p>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="rounded-2xl bg-[var(--status-warning)]/10 border border-[var(--status-warning)]/35 p-4 space-y-3 text-center">
            <AlertTriangle className="w-8 h-8 mx-auto text-[var(--status-warning)]" />
            <p className="text-xs font-semibold text-[var(--text-primary)] leading-relaxed">
              {errorCode === 'offline'
                ? t('billOcrErrOffline')
                : errorCode === 'not_enabled'
                ? t('billOcrErrNotEnabled')
                : errorCode === 'rate_limit'
                ? t('billOcrErrRateLimit')
                : errorCode === 'no_items'
                ? t('billOcrErrNoItems')
                : t('billOcrErrFailed')}
            </p>
            <div className="flex gap-2">
              {lastCompressedRef.current && errorCode !== 'no_items' && (
                <button
                  type="button"
                  onClick={resetModal}
                  className="min-h-[44px] px-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.97] transition"
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  <span>{t('billOcrPickAnotherBtn')}</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleRetrySamePhoto}
                className="flex-1 min-h-[44px] rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.97] transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t('billOcrTryAgainBtn')}</span>
              </button>
            </div>
          </div>
        )}

        {phase === 'review' && (
          <div className="space-y-3">
            {/* Optional extracted store title */}
            {title && (
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[var(--bg-tertiary)] text-xs">
                <span className="text-[var(--text-secondary)]">{t('billOcrPlaceLabel')}</span>
                <strong dir="auto" className="text-[var(--text-primary)]">
                  {title}
                </strong>
              </div>
            )}

            {/* Price Interpretation Switch */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setPriceMode('unit')}
                className={`min-h-[34px] rounded-lg text-[11px] font-bold cursor-pointer ${
                  priceMode === 'unit'
                    ? 'bg-[var(--bg-secondary)] text-[var(--accent-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                {t('billPastePriceModeUnit')}
              </button>
              <button
                type="button"
                onClick={() => setPriceMode('line_total')}
                className={`min-h-[34px] rounded-lg text-[11px] font-bold cursor-pointer ${
                  priceMode === 'line_total'
                    ? 'bg-[var(--bg-secondary)] text-[var(--accent-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                {t('billPastePriceModeTotal')}
              </button>
            </div>

            {/* Editable Extracted Items */}
            <div className="space-y-2 max-h-56 overflow-y-auto overscroll-contain">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="grid grid-cols-12 gap-1.5 items-center p-2 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]"
                >
                  <input
                    type="text"
                    dir="auto"
                    value={it.name}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((x) => (x.id === it.id ? { ...x, name: e.target.value } : x))
                      )
                    }
                    className="col-span-6 min-w-0 min-h-[36px] px-2 rounded-lg bg-[var(--bg-secondary)] text-[16px] sm:text-xs font-bold text-[var(--text-primary)]"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    dir="ltr"
                    value={priceMode === 'unit' ? it.unitPrice : it.lineTotal}
                    onChange={(e) => {
                      const val = Number(e.target.value.replace(/,/g, ''));
                      if (!Number.isFinite(val)) return;
                      setItems((prev) =>
                        prev.map((x) =>
                          x.id === it.id
                            ? priceMode === 'unit'
                              ? { ...x, unitPrice: val }
                              : { ...x, lineTotal: val }
                            : x
                        )
                      );
                    }}
                    className="col-span-3 min-w-0 min-h-[36px] px-1.5 rounded-lg bg-[var(--bg-secondary)] text-[16px] sm:text-xs font-mono text-end text-[var(--text-primary)]"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    dir="ltr"
                    value={it.qty}
                    onChange={(e) => {
                      const q = Number(e.target.value.replace(/,/g, ''));
                      if (!Number.isFinite(q)) return;
                      setItems((prev) =>
                        prev.map((x) => (x.id === it.id ? { ...x, qty: q } : x))
                      );
                    }}
                    className="col-span-2 min-w-0 min-h-[36px] px-1 rounded-lg bg-[var(--bg-secondary)] text-[16px] sm:text-xs font-mono text-center text-[var(--text-primary)]"
                  />
                  <button
                    type="button"
                    onClick={() => setItems((prev) => prev.filter((x) => x.id !== it.id))}
                    className="col-span-1 min-h-[36px] flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--status-danger)] cursor-pointer"
                    aria-label={t('billDeleteBtn')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Extras toggles */}
            {extras.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {extras.map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() =>
                      setExtras((prev) =>
                        prev.map((x) => (x.id === ex.id ? { ...x, selected: !x.selected } : x))
                      )
                    }
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border inline-flex items-center gap-1 cursor-pointer ${
                      ex.selected
                        ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--accent-primary)]'
                        : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {ex.selected && <Check className="w-3 h-3" />}
                    <span>
                      {ex.label}: {ex.valueType === 'percent' ? `${ex.value}%` : `${ex.value}`}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Stated Total toggle */}
            {statedTotal !== undefined && statedTotal > 0 && (
              <button
                type="button"
                onClick={() => setIncludeTotal((v) => !v)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer ${
                  includeTotal
                    ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)]/40 text-[var(--text-primary)]'
                    : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                }`}
              >
                <span>{t('billWrittenLabel')}</span>
                <span className="font-mono tabular-nums text-[var(--accent-primary)]">
                  {formatMinorMoney(toMinor(statedTotal), currency, language)}
                </span>
              </button>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={resetModal}
                className="min-h-[46px] px-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-secondary)] cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={items.length === 0}
                onClick={handleApply}
                className="flex-1 min-h-[46px] rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-sm font-bold disabled:opacity-45 cursor-pointer"
              >
                {t('billPasteApplyBtn')} ({items.length})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
