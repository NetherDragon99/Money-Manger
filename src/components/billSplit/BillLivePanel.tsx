import React, { useState } from 'react';
import {
  Check,
  Copy,
  Eye,
  Link2,
  Radio,
  RefreshCw,
  RotateCcw,
  Share2,
  Shield,
  UserCheck,
} from 'lucide-react';
import { BillGuestPermission, BillSession } from '../../types';
import { getLiveBillShareUrl } from '../../utils/billSplitCloud';
import { shareTextExternal } from '../../utils/billSplitShare';
import { translations } from '../../utils/translations';

interface BillLivePanelProps {
  session: BillSession;
  language: 'ar' | 'en';
  isSyncing: boolean;
  onSetPublic: (enabled: boolean) => Promise<boolean>;
  /** Publishes the bill to the cloud and opens the public link; resolves false if it failed. */
  onEnsurePublished: () => Promise<boolean>;
  onUpdateLiveConfig: (patch: Partial<NonNullable<BillSession['live']>>) => void;
  onRegenerateLink: () => Promise<void>;
  onReopenBill: () => void;
  showConfirm: (opts: {
    title: string;
    message: string;
    confirmText?: string;
    isDanger?: boolean;
  }) => Promise<boolean>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  t: (key: keyof typeof translations.en) => string;
}

/**
 * Link sharing, guest permissions and auto-accept — lives inside the Add Person sheet so
 * everything about who is in the bill sits in one place.
 */
export const BillLivePanel: React.FC<BillLivePanelProps> = ({
  session,
  language,
  isSyncing,
  onSetPublic,
  onEnsurePublished,
  onUpdateLiveConfig,
  onRegenerateLink,
  onReopenBill,
  showConfirm,
  showToast,
  t,
}) => {
  const isAr = language === 'ar';
  const [copiedLink, setCopiedLink] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [busy, setBusy] = useState(false);

  const isPublic = Boolean(session.live?.enabled && (session.live?.linkActive ?? true));
  const isPublished = Boolean(session.live?.enabled);
  const autoAccept = Boolean(session.live?.autoAccept);
  const defaultPermission: BillGuestPermission = session.live?.defaultPermission || 'view_only';
  const shareUrl = getLiveBillShareUrl(session.id);
  const isSettled = session.status === 'settled';

  const ensureOpen = async (): Promise<boolean> => {
    if (isPublic) return true;
    setBusy(true);
    try {
      return await onEnsurePublished();
    } finally {
      setBusy(false);
    }
  };

  const handleTogglePublic = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onSetPublic(!isPublic);
    } finally {
      setBusy(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!(await ensureOpen())) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1500);
      showToast(t('billLiveLinkCopiedToast'), 'success');
    } catch {
      showToast(t('billLiveCopyFailedToast'), 'error');
    }
  };

  const handleShareUrl = async () => {
    if (!(await ensureOpen())) return;
    const title = session.title.trim() || t('billDefaultTitle');
    const msg = `${session.icon} ${title}\n${shareUrl}`;
    const ok = await shareTextExternal(msg, title);
    if (!ok) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        showToast(t('billLiveLinkCopiedToast'), 'success');
      } catch {
        showToast(t('billLiveCopyFailedToast'), 'error');
      }
    }
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
    } catch {
      showToast(t('billLivePublishFailedToast'), 'error');
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

  const knobShift = (on: boolean, size: 'lg' | 'md') =>
    on ? (isAr ? (size === 'lg' ? '-translate-x-5' : '-translate-x-4') : size === 'lg' ? 'translate-x-5' : 'translate-x-4') : 'translate-x-0';

  return (
    <section className="space-y-3 pt-1" aria-label={t('billLiveSectionTitle')}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
          <Radio
            className={`w-3.5 h-3.5 ${isPublic ? 'text-[var(--status-success)]' : 'text-[var(--accent-primary)]'}`}
          />
          <span>{t('billLiveSectionTitle')}</span>
        </span>
        <span
          className={`text-[11px] font-bold ${
            isPublic ? 'text-[var(--status-success)]' : 'text-[var(--text-tertiary)]'
          }`}
        >
          {isSyncing ? t('billLiveSyncingLabel') : isPublic ? t('billLiveActiveBadge') : t('billLiveOffBadge')}
        </span>
      </div>

      {/* Single Public link switch */}
      <button
        type="button"
        role="switch"
        aria-checked={isPublic}
        disabled={busy}
        onClick={handleTogglePublic}
        className="w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-start cursor-pointer active:scale-[0.97] transition disabled:opacity-60"
      >
        <div className="min-w-0">
          <div className="text-sm font-bold text-[var(--text-primary)]">{t('billLivePublicToggle')}</div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">{t('billLivePublicDesc')}</div>
        </div>
        <div
          className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${
            isPublic ? 'bg-[var(--status-success)]' : 'bg-[var(--border-strong)]'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-[var(--text-on-accent)] shadow transition-transform duration-150 ${knobShift(isPublic, 'lg')}`}
          />
        </div>
      </button>

      {/* Link box (copy / share also opens the link automatically) */}
      <div className="space-y-2.5 rounded-2xl bg-[var(--bg-tertiary)]/75 border border-[var(--border-subtle)] p-3.5">
        <span className="text-xs font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          <span>{t('billLiveShareUrlLabel')}</span>
        </span>
        <div
          dir="ltr"
          className="px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-secondary)] truncate select-all"
        >
          {shareUrl}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={handleCopyUrl}
            className="min-h-[44px] px-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-strong)] text-xs font-bold text-[var(--text-primary)] flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.97] transition disabled:opacity-60"
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
            disabled={busy}
            onClick={handleShareUrl}
            className="min-h-[44px] px-3 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--text-on-accent)] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.97] transition disabled:opacity-60"
          >
            <Share2 className="w-4 h-4" />
            <span>{t('billShareLinkBtn')}</span>
          </button>
        </div>
        {isPublished && (
          <div className="flex justify-end">
            <button
              type="button"
              disabled={regenerating}
              onClick={handleRegenerate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[11px] font-bold text-[var(--text-secondary)] hover:text-[var(--status-danger)] cursor-pointer active:scale-[0.97] transition disabled:opacity-45"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
              <span>{t('billLiveRegenerateBtn')}</span>
            </button>
          </div>
        )}
      </div>

      {/* Settled bills are read-only for guests until reopened */}
      {isSettled && (
        <div className="rounded-2xl bg-[var(--status-warning)]/10 border border-[var(--status-warning)]/35 p-3 space-y-2">
          <p className="text-[11px] font-semibold text-[var(--text-primary)] leading-relaxed">
            {t('billLiveSettledNote')}
          </p>
          <button
            type="button"
            onClick={onReopenBill}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[40px] rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-strong)] text-xs font-bold text-[var(--text-primary)] cursor-pointer active:scale-[0.97] transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t('billLiveReopenBtn')}</span>
          </button>
        </div>
      )}

      {/* Default Guest Permission Selector */}
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
                className={`w-full flex items-start gap-2.5 p-3 rounded-xl border text-start cursor-pointer transition active:scale-[0.97] ${
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

      {/* Auto-Accept */}
      <button
        type="button"
        role="switch"
        aria-checked={autoAccept}
        onClick={() => onUpdateLiveConfig({ autoAccept: !autoAccept })}
        className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-start cursor-pointer active:scale-[0.97] transition"
      >
        <span className="text-xs font-bold text-[var(--text-primary)]">{t('billLiveAutoAcceptLabel')}</span>
        <div
          className={`w-10 h-6 rounded-full p-0.5 transition-colors shrink-0 ${
            autoAccept ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border-strong)]'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-[var(--text-on-accent)] shadow transition-transform duration-150 ${knobShift(autoAccept, 'md')}`}
          />
        </div>
      </button>
    </section>
  );
};
