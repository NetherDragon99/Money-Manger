import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Crown,
  Eye,
  Share2,
  Shield,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { BillGuestPermission, BillPerson, BillSession } from '../../types';
import {
  BillComputation,
  formatMinorMoney,
  getEffectivePersonPermission,
} from '../../utils/billSplitEngine';
import { format16DigitId } from '../../utils/userId';
import { translations } from '../../utils/translations';
import { BillPersonAvatar } from './BillPersonAvatar';

interface BillPersonBreakdownModalProps {
  person: BillPerson | null;
  session: BillSession;
  computation: BillComputation;
  currency: string;
  language: 'ar' | 'en';
  /** True only when opened by the bill Admin in editable owner mode */
  canManagePerson?: boolean;
  onClose: () => void;
  onSharePeople: (personIds: string[]) => void;
  onUpdatePerson?: (personId: string, patch: Partial<BillPerson>) => void;
  onRemovePerson?: (personId: string) => void;
  showConfirm?: (opts: {
    title: string;
    message: string;
    confirmText?: string;
    isDanger?: boolean;
  }) => Promise<boolean>;
  t: (key: keyof typeof translations.en) => string;
}

export const BillPersonBreakdownModal: React.FC<BillPersonBreakdownModalProps> = ({
  person,
  session,
  computation,
  currency,
  language,
  canManagePerson = false,
  onClose,
  onSharePeople,
  onUpdatePerson,
  onRemovePerson,
  showConfirm,
  t,
}) => {
  const approvedPeople = useMemo(
    () => session.people.filter((p) => p.approval === 'approved'),
    [session.people]
  );

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [renameDraft, setRenameDraft] = useState('');

  useEffect(() => {
    if (person) {
      setSelectedIds([person.id]);
      setRenameDraft(person.name);
    } else {
      setSelectedIds([]);
      setRenameDraft('');
    }
  }, [person?.id]);

  useEffect(() => {
    if (!person) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [person, onClose]);

  const activeSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const isMultiSelected = selectedIds.length > 1;

  const combinedStats = useMemo(() => {
    const itemRows: Array<{
      id: string;
      name: string;
      qty: number;
      shareMinor: number;
    }> = [];
    let subtotalMinor = 0;

    for (const item of session.items) {
      const alloc = computation.allocation.itemAllocations[item.id] || {};
      let sumForSelected = 0;
      for (const pid of selectedIds) {
        sumForSelected += alloc[pid] || 0;
      }
      if (sumForSelected > 0) {
        itemRows.push({
          id: item.id,
          name: item.name,
          qty: item.qty,
          shareMinor: sumForSelected,
        });
        subtotalMinor += sumForSelected;
      }
    }

    const extraRows: Array<{
      id: string;
      label: string;
      sign: 1 | -1;
      shareMinor: number;
      allExempt: boolean;
    }> = [];
    for (const ex of computation.extras.perExtraBreakdown) {
      let sumEx = 0;
      let allExempt = true;
      for (const pid of selectedIds) {
        sumEx += ex.perPersonMinor[pid] || 0;
        const rawExtra = session.extras.find((e) => e.id === ex.extraId);
        if (!rawExtra?.exemptPersonIds?.includes(pid)) {
          allExempt = false;
        }
      }
      if (sumEx !== 0 || allExempt) {
        extraRows.push({
          id: ex.extraId,
          label: ex.label,
          sign: ex.sign,
          shareMinor: sumEx,
          allExempt,
        });
      }
    }

    let roundingDeltaMinor = 0;
    let finalTotalMinor = 0;
    for (const pid of selectedIds) {
      roundingDeltaMinor += computation.rounding.perPersonRoundingDeltaMinor[pid] || 0;
      finalTotalMinor += computation.finalPersonTotalsMinor[pid] || 0;
    }

    return {
      itemRows,
      subtotalMinor,
      extraRows,
      roundingDeltaMinor,
      finalTotalMinor,
    };
  }, [session.items, session.extras, computation, selectedIds]);

  if (!person) return null;

  const isOwnerPerson = person.kind === 'owner';
  const effectivePerm = getEffectivePersonPermission(session, person);

  const toggleExtraPerson = (pid: string) => {
    if (pid === person.id && selectedIds.length === 1) return;
    setSelectedIds((prev) =>
      prev.includes(pid) ? prev.filter((id) => id !== pid) : [...prev, pid]
    );
  };

  const commitRename = () => {
    if (!onUpdatePerson) return;
    const cleaned = renameDraft.trim().slice(0, 50);
    if (cleaned && cleaned !== person.name) {
      onUpdatePerson(person.id, { name: cleaned });
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
        className="w-full sm:max-w-md max-h-[90dvh] flex flex-col rounded-t-[22px] sm:rounded-[22px] bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-5 space-y-4 shadow-2xl overflow-y-auto overscroll-contain modal-container-anim"
        style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
      >
        <div className="w-10 h-1 rounded-full bg-[var(--border-strong)] mx-auto sm:hidden shrink-0" />

        {/* Header: Avatar + Name + Nature / Permission Badges */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <BillPersonAvatar
              name={person.name}
              avatar={person.avatar}
              photoURL={person.photoURL}
              size="lg"
            />
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 dir="auto" className="text-base font-extrabold text-[var(--text-primary)] truncate">
                  {person.name}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    person.paidFlag
                      ? 'bg-[var(--status-success)]/15 text-[var(--status-success)]'
                      : 'bg-[var(--status-warning)]/15 text-[var(--status-warning)]'
                  }`}
                >
                  {person.paidFlag ? t('billPaidBadge') : t('billUnpaidBadge')}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-[var(--text-secondary)]">
                {isOwnerPerson ? (
                  <span className="inline-flex items-center gap-1 font-bold text-[var(--accent-primary)]">
                    <Crown className="w-3 h-3" />
                    <span>{t('billYouLabel')}</span>
                  </span>
                ) : effectivePerm === 'helper' ? (
                  <span className="inline-flex items-center gap-1 font-bold text-[var(--accent-primary)]">
                    <Shield className="w-3 h-3" />
                    <span>{t('billPermHelperTitle')}</span>
                  </span>
                ) : effectivePerm === 'claim_own' ? (
                  <span className="inline-flex items-center gap-1 font-bold text-[var(--accent-primary)]">
                    <UserCheck className="w-3 h-3" />
                    <span>{t('billPermClaimOwnTitle')}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-bold">
                    <Eye className="w-3 h-3" />
                    <span>{t('billPermViewOnlyTitle')}</span>
                  </span>
                )}
                <span>•</span>
                <span>
                  {person.kind === 'solv_user' ? t('billSolvBadge') : t('billGuestBadge')}
                </span>
              </div>
              {person.numericId && (
                <div dir="ltr" className="text-[10px] font-mono text-[var(--text-tertiary)]">
                  {format16DigitId(person.numericId)}
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] cursor-pointer shrink-0 active:scale-[0.97] transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Multi-Person Combine Chips */}
        {approvedPeople.length > 1 && (
          <div className="space-y-2 rounded-2xl bg-[var(--bg-tertiary)]/70 border border-[var(--border-subtle)] p-3">
            <div className="text-[11px] font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>{t('billPersonSheetCombineLabel')}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {approvedPeople.map((p) => {
                const picked = activeSet.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleExtraPerson(p.id)}
                    className={`inline-flex items-center gap-1.5 ps-1.5 pe-2.5 py-1 min-h-[34px] rounded-full text-xs font-bold border cursor-pointer active:scale-[0.97] transition ${
                      picked
                        ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--accent-primary)]'
                        : 'bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                    }`}
                  >
                    <BillPersonAvatar
                      name={p.name}
                      avatar={p.avatar}
                      photoURL={p.photoURL}
                      size="xs"
                    />
                    <span dir="auto" className="truncate max-w-[110px]">
                      {p.name}
                    </span>
                    {picked && <Check className="w-3 h-3 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Total Hero KPI */}
        <div className="rounded-2xl bg-[var(--accent-soft)] border border-[var(--accent-primary)]/35 p-3.5 flex items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-[var(--text-secondary)] block">
              {isMultiSelected
                ? `${t('billPersonSheetCombinedTitle')} (${selectedIds.length})`
                : person.name}
            </span>
            <div className="text-2xl font-mono tabular-nums font-black text-[var(--accent-primary)] mt-0.5">
              {formatMinorMoney(combinedStats.finalTotalMinor, currency, language)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const ids = [...selectedIds];
              onClose();
              onSharePeople(ids);
            }}
            className="min-h-[42px] px-3.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--text-on-accent)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer active:scale-[0.97] transition shrink-0"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{t('billPersonSheetShareBtn')}</span>
          </button>
        </div>

        {/* Ordered Items Breakdown */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            {t('billPersonSheetItemsTitle')} ({combinedStats.itemRows.length})
          </div>
          {combinedStats.itemRows.length === 0 ? (
            <p className="text-xs text-[var(--text-tertiary)] py-1.5">{t('billItemNoClaimsYet')}</p>
          ) : (
            <div className="space-y-1.5 max-h-44 overflow-y-auto overscroll-contain">
              {combinedStats.itemRows.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[var(--bg-tertiary)] text-xs"
                >
                  <span dir="auto" className="font-bold text-[var(--text-primary)] truncate">
                    {row.name} {row.qty !== 1 ? `×${row.qty}` : ''}
                  </span>
                  <span className="font-mono tabular-nums font-extrabold text-[var(--text-primary)] shrink-0">
                    {formatMinorMoney(row.shareMinor, currency, language)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Extras & Rounding Breakdown */}
        {(combinedStats.extraRows.length > 0 || combinedStats.roundingDeltaMinor !== 0) && (
          <div className="space-y-1.5 pt-1 border-t border-[var(--border-subtle)]">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              {t('billPersonSheetExtrasTitle')}
            </div>
            <div className="flex items-center justify-between px-3 py-1.5 text-xs text-[var(--text-secondary)]">
              <span>{t('billSummarySubtotal')}</span>
              <span className="font-mono tabular-nums font-bold">
                {formatMinorMoney(combinedStats.subtotalMinor, currency, language)}
              </span>
            </div>
            {combinedStats.extraRows.map((ex) => (
              <div
                key={ex.id}
                className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-[var(--bg-tertiary)]/75 text-xs"
              >
                <span dir="auto" className="font-semibold text-[var(--text-primary)] truncate">
                  {ex.label}
                </span>
                {ex.allExempt && ex.shareMinor === 0 ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                    {t('billExtraExemptTag')}
                  </span>
                ) : (
                  <span
                    className={`font-mono tabular-nums font-bold ${
                      ex.shareMinor < 0 ? 'text-[var(--status-success)]' : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {ex.shareMinor > 0 ? '+' : ''}
                    {formatMinorMoney(ex.shareMinor, currency, language)}
                  </span>
                )}
              </div>
            ))}
            {combinedStats.roundingDeltaMinor !== 0 && (
              <div className="flex items-center justify-between px-3 py-1.5 text-xs text-[var(--text-secondary)]">
                <span>{t('billSummaryRounding')}</span>
                <span className="font-mono tabular-nums font-bold">
                  {combinedStats.roundingDeltaMinor > 0 ? '+' : ''}
                  {formatMinorMoney(combinedStats.roundingDeltaMinor, currency, language)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Admin Person Controls (when owner taps a person inside BillSplitPage) */}
        {canManagePerson && !isMultiSelected && onUpdatePerson && (
          <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)] block">
                {t('billPersonRenameLabel')}
              </label>
              <input
                type="text"
                dir="auto"
                value={renameDraft}
                maxLength={50}
                onChange={(e) => setRenameDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitRename();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[16px] sm:text-sm text-[var(--text-primary)]"
              />
            </div>

            {!isOwnerPerson && (
              <>
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-[var(--text-secondary)] block">
                    {t('billPersonPermLabel')}
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        { id: undefined, label: t('billPermInheritDefault') },
                        { id: 'view_only' as BillGuestPermission, label: t('billPermViewOnlyTitle') },
                        { id: 'claim_own' as BillGuestPermission, label: t('billPermClaimOwnTitle') },
                        { id: 'helper' as BillGuestPermission, label: t('billPermHelperTitle') },
                      ] as const
                    ).map((opt) => {
                      const currentOverride =
                        person.roleOverride ?? (person.role === 'helper' ? 'helper' : undefined);
                      const selected = currentOverride === opt.id;
                      return (
                        <button
                          key={opt.id || 'default'}
                          type="button"
                          onClick={() =>
                            onUpdatePerson(person.id, {
                              roleOverride: opt.id,
                              role: opt.id === 'helper' ? 'helper' : 'participant',
                            })
                          }
                          className={`min-h-[38px] px-2.5 py-2 rounded-xl border text-xs font-bold cursor-pointer active:scale-[0.97] transition ${
                            selected
                              ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--accent-primary)]'
                              : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onUpdatePerson(person.id, { paidFlag: !person.paidFlag });
                  }}
                  className="w-full flex items-center justify-between p-3 min-h-[44px] rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-sm font-semibold text-[var(--text-primary)] cursor-pointer active:scale-[0.97] transition"
                >
                  <span>{person.paidFlag ? t('billPaidBadge') : t('billUnpaidBadge')}</span>
                  <Check
                    className={`w-4 h-4 ${
                      person.paidFlag ? 'text-[var(--status-success)]' : 'text-[var(--text-tertiary)]'
                    }`}
                  />
                </button>

                {onRemovePerson && showConfirm && (
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await showConfirm({
                        title: person.name,
                        message: t('billRemovePersonConfirm'),
                        isDanger: true,
                      });
                      if (ok) {
                        onRemovePerson(person.id);
                        onClose();
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 p-3 min-h-[44px] rounded-xl bg-[var(--status-danger)]/15 text-[var(--status-danger)] text-sm font-bold cursor-pointer active:scale-[0.97] transition"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{t('billDeleteBtn')}</span>
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
