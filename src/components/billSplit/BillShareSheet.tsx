import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Image as ImageIcon,
  MessageSquare,
  Moon,
  Share2,
  Sun,
  X,
} from 'lucide-react';
import { BillSession, ReceiptImageTheme, TransferFeeSettings } from '../../types';
import { BillComputation, formatMinorMoney } from '../../utils/billSplitEngine';
import {
  buildBillShareText,
  buildPerPersonShareMessages,
  copyReceiptImageToClipboard,
  exportBillReceiptPngBlob,
  renderBillReceiptCanvas,
  shareOrDownloadReceiptImage,
  shareTextExternal,
} from '../../utils/billSplitShare';
import { translations } from '../../utils/translations';

interface BillShareSheetProps {
  isOpen: boolean;
  initialFocusPersonId?: string | null;
  session: BillSession;
  computation: BillComputation;
  feeSettings?: Partial<TransferFeeSettings> | null;
  liveUrl?: string;
  language: 'ar' | 'en';
  appTheme: 'dark' | 'light';
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  t: (key: keyof typeof translations.en) => string;
}

type ShareTab = 'whole' | 'selected' | 'separate' | 'reminders';

export const BillShareSheet: React.FC<BillShareSheetProps> = ({
  isOpen,
  initialFocusPersonId,
  session,
  computation,
  feeSettings,
  liveUrl,
  language,
  appTheme,
  onClose,
  showToast,
  t,
}) => {
  const isAr = language === 'ar';
  const approvedPeople = session.people.filter((p) => p.approval === 'approved');
  const [tab, setTab] = useState<ShareTab>('whole');
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [imageTheme, setImageTheme] = useState<ReceiptImageTheme>(appTheme);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyImage, setBusyImage] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setImageTheme(appTheme);
    if (initialFocusPersonId) {
      setTab('selected');
      setSelectedPersonIds([initialFocusPersonId]);
    } else {
      setTab('whole');
      setSelectedPersonIds(approvedPeople.filter((p) => p.kind !== 'owner').map((p) => p.id));
    }
  }, [isOpen, initialFocusPersonId]);

  useEffect(() => {
    if (!isOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [isOpen, onClose]);

  const activeText = useMemo(() => {
    if (tab === 'whole') {
      return buildBillShareText(session, computation, {
        scope: 'whole_bill',
        lang: language,
        feeSettings,
        liveUrl,
      });
    }
    if (tab === 'selected') {
      return buildBillShareText(session, computation, {
        scope: 'selected_people',
        selectedPersonIds,
        lang: language,
        feeSettings,
        liveUrl,
      });
    }
    return '';
  }, [tab, session, computation, selectedPersonIds, language, feeSettings, liveUrl]);

  const separatePayloads = useMemo(() => {
    return buildPerPersonShareMessages(session, computation, {
      lang: language,
      unpaidOnly: tab === 'reminders',
      isReminder: tab === 'reminders',
      feeSettings,
      liveUrl,
    });
  }, [tab, session, computation, language, feeSettings, liveUrl]);

  // Live Canvas preview for Whole / Selected tabs
  useEffect(() => {
    if (!isOpen || (tab !== 'whole' && tab !== 'selected')) return;
    let cancelled = false;
    renderBillReceiptCanvas(session, computation, {
      scope: tab === 'whole' ? 'whole_bill' : 'selected_people',
      selectedPersonIds,
      lang: language,
      theme: imageTheme,
      feeSettings,
    })
      .then((canvas) => {
        if (!cancelled) setPreviewDataUrl(canvas.toDataURL('image/png'));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOpen, tab, session, computation, selectedPersonIds, language, imageTheme, feeSettings]);

  if (!isOpen) return null;

  const copyWithFeedback = async (text: string, id = 'main') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1500);
    } catch {
      showToast(isAr ? 'تعذر النسخ التلقائي' : 'Copy failed', 'error');
    }
  };

  const handleImageAction = async (
    mode: 'share' | 'download' | 'copy',
    customScope?: 'whole_bill' | 'selected_people',
    customPersonIds?: string[],
    feedbackId?: string
  ) => {
    setBusyImage(true);
    try {
      const scope = customScope || (tab === 'whole' ? 'whole_bill' : 'selected_people');
      const ids = customPersonIds || selectedPersonIds;
      const blob = await exportBillReceiptPngBlob(session, computation, {
        scope,
        selectedPersonIds: ids,
        lang: language,
        theme: imageTheme,
        feeSettings,
      });
      const safeTitle = (session.title || 'bill').replace(/[^a-z0-9\u0600-\u06FF]+/gi, '_');
      const fileName = `solv_${safeTitle}.png`;
      if (mode === 'copy') {
        const ok = await copyReceiptImageToClipboard(blob);
        if (ok) {
          const cid = feedbackId || 'img_main';
          setCopiedId(cid);
          setTimeout(() => setCopiedId((prev) => (prev === cid ? null : prev)), 1500);
          showToast(t('billImageCopiedToast'), 'success');
        } else {
          showToast(t('billImageCopyUnsupportedToast'), 'info');
        }
      } else if (mode === 'download') {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast(isAr ? 'تم تنزيل صورة الفاتورة' : 'Receipt image downloaded', 'success');
      } else {
        await shareOrDownloadReceiptImage(
          blob,
          fileName,
          session.title || t('billSplitTitle'),
          activeText || undefined
        );
      }
    } catch {
      showToast(isAr ? 'تعذر إنشاء الصورة' : 'Could not render image', 'error');
    } finally {
      setBusyImage(false);
    }
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
          <h3 className="text-lg font-bold text-[var(--text-primary)]">{t('billShareSheetTitle')}</h3>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scope Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
          {(
            [
              { id: 'whole', label: t('billShareScopeWhole') },
              { id: 'selected', label: t('billShareScopeSelected') },
              { id: 'separate', label: t('billShareScopeSeparate') },
              { id: 'reminders', label: t('billShareScopeReminders') },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`min-h-[36px] px-2 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                tab === item.id
                  ? 'bg-[var(--bg-secondary)] text-[var(--accent-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Image Theme Switcher (Dark / Light) */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[var(--bg-tertiary)]/75 border border-[var(--border-subtle)]">
          <span className="text-xs font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>{imageTheme === 'dark' ? t('billShareThemeDark') : t('billShareThemeLight')}</span>
          </span>
          <div className="inline-flex items-center gap-1 p-0.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => setImageTheme('dark')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer ${
                imageTheme === 'dark'
                  ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              <Moon className="w-3 h-3" />
              <span>{t('billShareThemeDark')}</span>
            </button>
            <button
              type="button"
              onClick={() => setImageTheme('light')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer ${
                imageTheme === 'light'
                  ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              <Sun className="w-3 h-3" />
              <span>{t('billShareThemeLight')}</span>
            </button>
          </div>
        </div>

        {/* People multi-picker when on 'selected' tab */}
        {tab === 'selected' && (
          <div className="flex flex-wrap gap-1.5">
            {approvedPeople.map((p) => {
              const picked = selectedPersonIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    setSelectedPersonIds((prev) =>
                      prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                    )
                  }
                  className={`px-3 py-1.5 min-h-[36px] rounded-full text-xs font-bold border cursor-pointer ${
                    picked
                      ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--accent-primary)]'
                      : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                  }`}
                >
                  {p.avatar || '👤'} {p.name}
                </button>
              );
            })}
          </div>
        )}

        {(tab === 'whole' || tab === 'selected') ? (
          <div className="space-y-3">
            {/* Live Image Preview */}
            {previewDataUrl && (
              <div className="rounded-2xl overflow-hidden border border-[var(--border-subtle)] max-h-64 overflow-y-auto overscroll-contain bg-[var(--bg-primary)]">
                <img
                  src={previewDataUrl}
                  alt={t('billShareSheetTitle')}
                  className="w-full h-auto block"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}

            {/* Text Preview */}
            <pre
              dir="auto"
              className="p-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[11px] font-mono text-[var(--text-primary)] whitespace-pre-wrap break-words max-h-36 overflow-y-auto overscroll-contain"
            >
              {activeText}
            </pre>

            {/* Share / Copy Image / Download / Copy Text Actions */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busyImage || (tab === 'selected' && selectedPersonIds.length === 0)}
                onClick={() => handleImageAction('share')}
                className="min-h-[44px] px-3 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-45 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>{t('billShareImageBtn')}</span>
              </button>

              <button
                type="button"
                disabled={busyImage || (tab === 'selected' && selectedPersonIds.length === 0)}
                onClick={() => handleImageAction('copy', undefined, undefined, 'img_main')}
                className="min-h-[44px] px-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-strong)] text-[var(--text-primary)] text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-45 cursor-pointer"
              >
                {copiedId === 'img_main' ? (
                  <>
                    <Check className="w-4 h-4 text-[var(--status-success)]" />
                    <span className="text-[var(--status-success)]">{t('billCopiedBtn')}</span>
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-4 h-4 text-[var(--accent-primary)]" />
                    <span>{t('billCopyImageBtn')}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={busyImage || (tab === 'selected' && selectedPersonIds.length === 0)}
                onClick={() => handleImageAction('download')}
                className="min-h-[44px] px-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-45 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{t('billDownloadImageBtn')}</span>
              </button>

              <button
                type="button"
                onClick={() => copyWithFeedback(activeText, 'main')}
                className="min-h-[44px] px-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copiedId === 'main' ? (
                  <>
                    <Check className="w-4 h-4 text-[var(--status-success)]" />
                    <span className="text-[var(--status-success)]">{t('billCopiedBtn')}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>{t('billCopyTextBtn')}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={async () => {
                  const ok = await shareTextExternal(activeText, session.title || t('billSplitTitle'));
                  if (!ok) await copyWithFeedback(activeText, 'main');
                }}
                className="col-span-2 min-h-[42px] px-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                <span>{t('billShareTextBtn')}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Separate Per Person OR Unpaid Reminders */
          <div className="space-y-2.5">
            <p className="text-xs text-[var(--text-secondary)]">{t('billSeparatePersonHint')}</p>
            {separatePayloads.length === 0 ? (
              <div className="p-5 rounded-2xl bg-[var(--status-success)]/10 border border-[var(--status-success)]/30 text-center text-xs font-bold text-[var(--status-success)]">
                {t('billNoUnpaidReminders')}
              </div>
            ) : (
              separatePayloads.map((item) => (
                <div
                  key={item.personId}
                  className="rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span dir="auto" className="text-sm font-bold text-[var(--text-primary)] truncate">
                      {item.personName}
                    </span>
                    <span className="text-sm font-mono tabular-nums font-extrabold text-[var(--accent-primary)]">
                      {formatMinorMoney(item.amountMinor, session.currency, language)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyWithFeedback(item.text, item.personId)}
                      className="flex-1 min-h-[38px] rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {copiedId === item.personId ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[var(--status-success)]" />
                          <span className="text-[var(--status-success)]">{t('billCopiedBtn')}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>{t('billCopyTextBtn')}</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={busyImage}
                      onClick={() =>
                        handleImageAction('copy', 'selected_people', [item.personId], `img_${item.personId}`)
                      }
                      className="min-h-[38px] px-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] flex items-center justify-center gap-1 cursor-pointer shrink-0"
                      title={t('billCopyImageBtn')}
                      aria-label={t('billCopyImageBtn')}
                    >
                      {copiedId === `img_${item.personId}` ? (
                        <Check className="w-3.5 h-3.5 text-[var(--status-success)]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={busyImage}
                      onClick={() =>
                        handleImageAction('share', 'selected_people', [item.personId])
                      }
                      className="flex-1 min-h-[38px] rounded-xl bg-[var(--accent-soft)] border border-[var(--accent-primary)]/35 text-xs font-bold text-[var(--accent-primary)] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>{t('billShareImageBtn')}</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
