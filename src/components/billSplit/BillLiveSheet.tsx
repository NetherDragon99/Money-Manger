import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Eye,
  Link2,
  Radio,
  RefreshCw,
  Share2,
  Shield,
  UserCheck,
  X,
} from 'lucide-react';
import { BillGuestPermission, BillPerson, BillSession } from '../../types';
import { getLiveBillShareUrl } from '../../utils/billSplitCloud';
import { shareTextExternal } from '../../utils/billSplitShare';
import { translations } from '../../utils/translations';

interface BillLiveSheetProps {
  isOpen: boolean;
  session: BillSession;
  language: 'ar' | 'en';
  isSyncing: boolean;
  onClose: () => void;
  onToggleLive: (enabled: boolean) => void;
  onUpdateLiveConfig: (
    patch: Partial<NonNullable<BillSession['live']>>
  ) => void;
  onApprovePerson: (personId: string) => void;
  onRejectPerson: (personId: string) => void;
  onRegenerateLink: () => Promise<void>;
  showConfirm: (opts: {
    title: string;
    message: string;
    confirmText?: string;
    isDanger?: boolean;
  }) => Promise<boolean>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  t: (key: keyof typeof translations.en) => string;
}

export const BillLiveSheet: React.FC<BillLiveSheetProps> = ({
  isOpen,
  session,
  language,
  isSyncing,
  onClose,
  onToggleLive,
  onUpdateLiveConfig,
  onApprovePerson,
  onRejectPerson,
  onRegenerateLink,
  showConfirm,
  showToast,
  t,
}) => {
  const isAr = language === 'ar';
  const [copiedLink, setCopiedLink] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const liveEnabled = Boolean(session.live?.enabled);
  const linkActive = session.live?.linkActive ?? true;
  const autoAccept = Boolean(session.live?.autoAccept);
  const defaultPermission: BillGuestPermission = session.live?.defaultPermission || 'view_only';
  const pendingPeople: BillPerson[] = session.people.filter((p) => p.approval === 'pending');
  const shareUrl = getLiveBillShareUrl(session.id);

  useEffect(() => {
    if (!isOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1500);
      showToast(t('billLiveLinkCopiedToast'), 'success');
    } catch {
      showToast(isAr ? 'تعذر نسخ الرابط' : 'Copy failed', 'error');
    }
  };

  const handleShareUrl = async () => {
    const title = session.title.trim() || t('billDefaultTitle');
    const msg = `${session.icon} ${title}\n${shareUrl}`;
    const ok = await shareTextExternal(msg, title);
    if (!ok) await handleCopyUrl();
  };

  const handleRegenerate = async () => {
    const confirmed = await showConfirm({
      title: t('billLiveRegenerateBtn'),
      message: t('billLiveRegenerateConfirm'),
      confirmText: t('billLiveRegenerateBtn'),
      isDanger: true,
    });
    if (!confirmed) return;
    setRegenerating(true);
    try {
      await onRegenerateLink();
      showToast(t('billLiveRegeneratedToast'), 'success');
    } finally {
      setRegenerating(false);
    }
  };

  const permOptions: Array<{
    id: BillGuestPermission;
    icon: React.ReactNode;
    title: string;
    desc: string;
  }> = [
    {
      id: 'view_only',
      icon: <Eye className="w-4 h-4" />,
      title: t('billPermViewOnlyTitle'),
      desc: t('billPermViewOnlyDesc'),
    },
    {
      id: 'claim_own',
      icon: <UserCheck className="w-4 h-4" />,
      title: t('billPermClaimOwnTitle'),
      desc: t('billPermClaimOwnDesc'),
    },
    {
      id: 'helper',
      icon: <Shield className="w-4 h-4" />,
      title: t('billPermHelperTitle'),
      desc: t('billPermHelperDesc'),
    },
  ];

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
            <Radio
              className={`w-5 h-5 ${
                liveEnabled && linkActive ? 'text-[var(--status-success)]' : 'text-[var(--accent-primary)]'
              }`}
            />
            <h3 className="text-lg font-bold text-[var(--text-primary)]">{t('billLiveSheetTitle')}</h3>
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

        {/* Master Live Link Toggle */}
        <button
          type="button"
          onClick={() => onToggleLive(!liveEnabled)}
          className="w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-start cursor-pointer"
        >
          <div className="min-w-0">
            <div className="text-sm font-bold text-[var(--text-primary)]">{t('billLiveEnableToggle')}</div>
            <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
              {t('billLiveEnableDesc')}
            </div>
          </div>
          <div
            className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${
              liveEnabled ? 'bg-[var(--status-success)]' : 'bg-[var(--border-strong)]'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow transition-transform duration-150 ${
                liveEnabled ? (isAr ? '-translate-x-5' : 'translate-x-5') : 'translate-x-0'
              }`}
            />
          </div>
        </button>

        {/* Link Box when enabled */}
        {liveEnabled && (
          <div className="space-y-3 rounded-2xl bg-[var(--bg-tertiary)]/75 border border-[var(--border-subtle)] p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>{t('billLiveShareUrlLabel')}</span>
              </span>
              <span className="text-[11px] font-bold text-[var(--status-success)]">
                {isSyncing ? t('billLiveSyncingLabel') : linkActive ? t('billLiveActiveBadge') : t('billLivePausedBadge')}
              </span>
            </div>

            <div
              dir="ltr"
              className="px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-secondary)] truncate select-all"
            >
              {shareUrl}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCopyUrl}
                className="min-h-[42px] px-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-strong)] text-xs font-bold text-[var(--text-primary)] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-4 h-4 text-[var(--status-success)]" />
                    <span className="text-[var(--status-success)]">{t('billCopiedBtn')}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-[var(--accent-primary)]" />
                    <span>{t('billCopyLinkBtn')}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleShareUrl}
                className="min-h-[42px] px-3 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>{t('billShareLinkBtn')}</span>
              </button>
            </div>

            {/* Pause / Resume Link & Regenerate Link */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => onUpdateLiveConfig({ linkActive: !linkActive })}
                className={`px-3 py-1.5 min-h-[34px] rounded-xl text-[11px] font-bold border cursor-pointer ${
                  linkActive
                    ? 'bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                    : 'bg-[var(--status-warning)]/15 border-[var(--status-warning)]/40 text-[var(--status-warning)]'
                }`}
              >
                {linkActive ? t('billLivePauseBtn') : t('billLiveResumeBtn')}
              </button>

              <button
                type="button"
                disabled={regenerating}
                onClick={handleRegenerate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[11px] font-bold text-[var(--text-secondary)] hover:text-[var(--status-danger)] cursor-pointer disabled:opacity-45"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
                <span>{t('billLiveRegenerateBtn')}</span>
              </button>
            </div>
          </div>
        )}

        {/* Default Guest Permission Selector (Always configurable, defaults to view_only) */}
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            {t('billLivePermSectionTitle')}
          </div>
          <div className="space-y-1.5">
            {permOptions.map((opt) => {
              const active = defaultPermission === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdateLiveConfig({ defaultPermission: opt.id })}
                  className={`w-full flex items-start gap-2.5 p-3 rounded-xl border text-start cursor-pointer transition ${
                    active
                      ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)]'
                      : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)]'
                  }`}
                >
                  <span
                    className={`mt-0.5 shrink-0 ${
                      active ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {opt.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-[var(--text-primary)] flex items-center justify-between gap-2">
                      <span>{opt.title}</span>
                      {active && <Check className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />}
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Auto-Accept Toggle */}
        <button
          type="button"
          onClick={() => onUpdateLiveConfig({ autoAccept: !autoAccept })}
          className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-start cursor-pointer"
        >
          <span className="text-xs font-bold text-[var(--text-primary)]">{t('billLiveAutoAcceptLabel')}</span>
          <div
            className={`w-10 h-6 rounded-full p-0.5 transition-colors shrink-0 ${
              autoAccept ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border-strong)]'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow transition-transform duration-150 ${
                autoAccept ? (isAr ? '-translate-x-4' : 'translate-x-4') : 'translate-x-0'
              }`}
            />
          </div>
        </button>

        {/* Pending Guest Join Requests */}
        {pendingPeople.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-[var(--border-subtle)]">
            <span className="text-xs font-bold text-[var(--status-warning)] block">
              {t('billLivePendingTitle')} ({pendingPeople.length})
            </span>
            {pendingPeople.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]"
              >
                <span dir="auto" className="text-xs font-bold text-[var(--text-primary)] truncate">
                  {p.avatar || '🙋'} {p.name}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onApprovePerson(p.id)}
                    className="px-3 py-1.5 min-h-[34px] rounded-xl bg-[var(--status-success)] text-white text-xs font-bold cursor-pointer"
                  >
                    {t('billApproveBtn')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRejectPerson(p.id)}
                    className="px-2.5 py-1.5 min-h-[34px] rounded-xl bg-[var(--status-danger)]/15 text-[var(--status-danger)] text-xs font-bold cursor-pointer"
                  >
                    {t('billRejectBtn')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
