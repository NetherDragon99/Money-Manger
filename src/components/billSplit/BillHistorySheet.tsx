import React, { useEffect, useMemo, useState } from 'react';
import { Copy, History, Search, Trash2, X } from 'lucide-react';
import { BillSession } from '../../types';
import { computeBill, formatMinorMoney } from '../../utils/billSplitEngine';
import {
  deleteBillSession,
  duplicateBillSession,
  loadBillSplitBundle,
} from '../../utils/billSplitStore';
import { translations } from '../../utils/translations';

interface BillHistorySheetProps {
  isOpen: boolean;
  currentSessionId: string;
  language: 'ar' | 'en';
  onClose: () => void;
  onSelectSession: (session: BillSession) => void;
  onDeleteSession?: (session: BillSession) => Promise<void> | void;
  hasLinkedTransaction?: (session: BillSession) => boolean;
  showConfirm: (opts: { title: string; message: string; confirmText?: string; isDanger?: boolean }) => Promise<boolean>;
  t: (key: keyof typeof translations.en) => string;
}

export const BillHistorySheet: React.FC<BillHistorySheetProps> = ({
  isOpen,
  currentSessionId,
  language,
  onClose,
  onSelectSession,
  onDeleteSession,
  hasLinkedTransaction,
  showConfirm,
  t,
}) => {
  const isAr = language === 'ar';
  const [sessions, setSessions] = useState<BillSession[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const reload = () => {
    setSessions(loadBillSplitBundle().sessions || []);
  };

  useEffect(() => {
    if (isOpen) reload();
  }, [isOpen]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchInput.trim().toLowerCase()), 200);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!isOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [isOpen, onClose]);

  const filtered = useMemo(() => {
    if (!debouncedQuery) return sessions;
    return sessions.filter((s) => {
      if ((s.title || '').toLowerCase().includes(debouncedQuery)) return true;
      return s.people.some((p) => p.name.toLowerCase().includes(debouncedQuery));
    });
  }, [sessions, debouncedQuery]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-[12px] p-0 sm:p-4 overscroll-contain"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[88dvh] flex flex-col rounded-t-[22px] sm:rounded-[22px] bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-5 space-y-4 shadow-2xl overflow-y-auto overscroll-contain modal-container-anim"
        style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
      >
        <div className="w-10 h-1 rounded-full bg-[var(--border-strong)] mx-auto sm:hidden shrink-0" />
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[var(--accent-primary)]" />
            <h3 className="text-lg font-bold text-[var(--text-primary)]">{t('billHistoryTitle')}</h3>
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

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-[var(--text-tertiary)] absolute top-1/2 -translate-y-1/2 start-3.5" />
          <input
            type="text"
            dir="auto"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('billSearchHistoryPlaceholder')}
            className="w-full min-h-[44px] ps-10 pe-9 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[16px] sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              className="absolute top-1/2 -translate-y-1/2 end-2.5 p-1 text-[var(--text-secondary)] cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="p-6 text-center text-xs text-[var(--text-secondary)]">
            {t('billNoHistoryTitle')}
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[55dvh] overflow-y-auto overscroll-contain">
            {filtered.map((s) => {
              const comp = computeBill(s);
              const unpaidCount = s.people.filter(
                (p) =>
                  p.kind !== 'owner' &&
                  p.approval === 'approved' &&
                  !p.paidFlag &&
                  (comp.finalPersonTotalsMinor[p.id] || 0) > 0
              ).length;
              const isCurrent = s.id === currentSessionId;

              return (
                <div
                  key={s.id}
                  className={`rounded-2xl border p-3 flex items-center justify-between gap-2 ${
                    isCurrent
                      ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)]/45'
                      : 'bg-[var(--bg-tertiary)]/75 border-[var(--border-subtle)]'
                  }`}
                  style={{ contain: 'layout style' }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectSession(s);
                      onClose();
                    }}
                    className="flex items-center gap-2.5 min-w-0 flex-1 text-start cursor-pointer"
                  >
                    <span className="text-xl shrink-0">{s.icon || '🧾'}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span dir="auto" className="text-sm font-bold text-[var(--text-primary)] truncate">
                          {s.title.trim() || t('billDefaultTitle')}
                        </span>
                        {s.status !== 'settled' && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                            {t('billDraftBadge')}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-[var(--text-secondary)] flex flex-wrap items-center gap-2">
                        <span>{formatMinorMoney(comp.computedTotalMinor, s.currency, language)}</span>
                        <span>• {s.people.length}</span>
                        {unpaidCount > 0 && (
                          <span className="text-[var(--status-warning)] font-bold">
                            • {unpaidCount} {t('billUnpaidBadge')}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const copy = duplicateBillSession(s.id);
                        if (copy) {
                          onSelectSession(copy);
                          onClose();
                        }
                      }}
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl text-[var(--text-secondary)] hover:text-[var(--accent-primary)] cursor-pointer"
                      title={t('billDuplicateBtn')}
                      aria-label={t('billDuplicateBtn')}
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const linked = hasLinkedTransaction ? hasLinkedTransaction(s) : false;
                        const hasMembers = s.people.some((p) => p.kind !== 'owner');
                        const msg = linked
                          ? t('billDeleteWithTxConfirm')
                          : s.live?.enabled && hasMembers
                          ? t('billDeleteWithGuestsConfirm')
                          : t('billDeleteBillConfirm');
                        const ok = await showConfirm({
                          title: s.title.trim() || t('billDefaultTitle'),
                          message: msg,
                          confirmText: t('billDeleteBillBtn'),
                          isDanger: true,
                        });
                        if (ok) {
                          if (onDeleteSession) {
                            await onDeleteSession(s);
                          } else {
                            deleteBillSession(s.id);
                          }
                          reload();
                        }
                      }}
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl text-[var(--text-tertiary)] hover:text-[var(--status-danger)] cursor-pointer"
                      title={isAr ? 'حذف' : 'Delete'}
                      aria-label={t('billDeleteBtn')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
