import React, { useEffect, useState } from 'react';
import {
  Check,
  Plus,
  Search,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { BillPerson, SavedBillFriend, SavedBillGroup } from '../../types';
import { formatMinorMoney, generateBillId } from '../../utils/billSplitEngine';
import {
  deleteSavedFriend,
  deleteSavedGroup,
  getMergedSavedFriends,
  loadBillSplitBundle,
  upsertSavedFriend,
  upsertSavedGroup,
} from '../../utils/billSplitStore';
import { lookupUserByNumericId, cleanNumericId } from '../../utils/userId';
import { translations } from '../../utils/translations';

interface BillPeopleBarProps {
  people: BillPerson[];
  perPersonTotalsMinor: Record<string, number>;
  currency: string;
  language: 'ar' | 'en';
  myNumericId?: string;
  onAddPerson: (person: BillPerson) => void;
  onAddMultiplePeople: (persons: BillPerson[]) => void;
  onUpdatePerson: (personId: string, patch: Partial<BillPerson>) => void;
  onRemovePerson: (personId: string) => void;
  showConfirm: (opts: { title: string; message: string; confirmText?: string; isDanger?: boolean }) => Promise<boolean>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  t: (key: keyof typeof translations.en) => string;
}

export const BillPeopleBar: React.FC<BillPeopleBarProps> = ({
  people,
  perPersonTotalsMinor,
  currency,
  language,
  myNumericId,
  onAddPerson,
  onAddMultiplePeople,
  onUpdatePerson,
  onRemovePerson,
  showConfirm,
  showToast,
  t,
}) => {
  const isAr = language === 'ar';
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [activePersonMenuId, setActivePersonMenuId] = useState<string | null>(null);

  const [guestName, setGuestName] = useState('');
  const [idLookupInput, setIdLookupInput] = useState('');
  const [lookingUpId, setLookingUpId] = useState(false);
  const [savedFriends, setSavedFriends] = useState<SavedBillFriend[]>([]);
  const [savedGroups, setSavedGroups] = useState<SavedBillGroup[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [showGroupInput, setShowGroupInput] = useState(false);

  const refreshSaved = () => {
    setSavedFriends(getMergedSavedFriends(myNumericId));
    setSavedGroups(loadBillSplitBundle().groups || []);
  };

  useEffect(() => {
    if (isAddSheetOpen) refreshSaved();
  }, [isAddSheetOpen]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activePersonMenuId) setActivePersonMenuId(null);
        else if (isAddSheetOpen) setIsAddSheetOpen(false);
      }
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [activePersonMenuId, isAddSheetOpen]);

  const handleAddGuestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = guestName.trim();
    if (!trimmed) return;
    if (people.some((p) => p.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      showToast(isAr ? 'هذا الاسم موجود بالفعل في الفاتورة' : 'Person already in bill', 'info');
      return;
    }
    const saved = upsertSavedFriend({ name: trimmed, avatar: '👤', bumpUsage: true });
    onAddPerson({
      id: `p_${generateBillId().slice(0, 8)}`,
      name: trimmed,
      avatar: saved.avatar,
      kind: 'guest',
      role: 'participant',
      approval: 'approved',
      paidFlag: false,
    });
    setGuestName('');
    refreshSaved();
  };

  const handleLookup16Id = async () => {
    const clean = cleanNumericId(idLookupInput);
    if (clean.length !== 16) {
      showToast(isAr ? 'أدخل 16 رقماً صحيحاً' : 'Enter a valid 16-digit ID', 'error');
      return;
    }
    if (people.some((p) => p.numericId === clean)) {
      showToast(isAr ? 'هذا الشخص مضاف بالفعل' : 'Already added', 'info');
      return;
    }
    setLookingUpId(true);
    try {
      const card = await lookupUserByNumericId(clean);
      const resolvedName = card?.name || `solv ${clean.slice(-4)}`;
      const resolvedAvatar = card?.avatar || '💚';
      upsertSavedFriend({
        name: resolvedName,
        avatar: resolvedAvatar,
        numericId: clean,
        bumpUsage: true,
      });
      onAddPerson({
        id: `p_${generateBillId().slice(0, 8)}`,
        name: resolvedName,
        avatar: resolvedAvatar,
        kind: 'solv_user',
        numericId: clean,
        role: 'participant',
        approval: 'approved',
        paidFlag: false,
      });
      setIdLookupInput('');
      refreshSaved();
      showToast(isAr ? `تمت إضافة ${resolvedName}` : `Added ${resolvedName}`, 'success');
    } catch {
      showToast(isAr ? 'تعذر البحث الآن — أضفه بالاسم مؤقتاً' : 'Lookup unavailable offline — add by name', 'info');
    } finally {
      setLookingUpId(false);
    }
  };

  const handlePickFriend = (friend: SavedBillFriend) => {
    const already = people.some(
      (p) =>
        (friend.numericId && p.numericId === friend.numericId) ||
        p.name.trim().toLowerCase() === friend.name.trim().toLowerCase()
    );
    if (already) return;
    upsertSavedFriend({ ...friend, bumpUsage: true });
    onAddPerson({
      id: `p_${generateBillId().slice(0, 8)}`,
      name: friend.name,
      avatar: friend.avatar || '👤',
      kind: friend.numericId ? 'solv_user' : 'guest',
      numericId: friend.numericId,
      role: 'participant',
      approval: 'approved',
      paidFlag: false,
    });
    refreshSaved();
  };

  const handleApplyGroup = (group: SavedBillGroup) => {
    const friendMap = new Map(savedFriends.map((f) => [f.id, f]));
    const toAdd: BillPerson[] = [];
    for (const fid of group.memberIds) {
      const f = friendMap.get(fid);
      if (!f) continue;
      const already = people.some(
        (p) =>
          (f.numericId && p.numericId === f.numericId) ||
          p.name.trim().toLowerCase() === f.name.trim().toLowerCase()
      );
      if (!already) {
        toAdd.push({
          id: `p_${generateBillId().slice(0, 8)}`,
          name: f.name,
          avatar: f.avatar || '👤',
          kind: f.numericId ? 'solv_user' : 'guest',
          numericId: f.numericId,
          role: 'participant',
          approval: 'approved',
          paidFlag: false,
        });
      }
    }
    if (toAdd.length > 0) {
      onAddMultiplePeople(toAdd);
      showToast(
        isAr ? `تمت إضافة ${toAdd.length} من ${group.name}` : `Added ${toAdd.length} from ${group.name}`,
        'success'
      );
    }
    setIsAddSheetOpen(false);
  };

  const handleSaveCurrentAsGroup = () => {
    const name = newGroupName.trim();
    if (!name) return;
    const nonOwners = people.filter((p) => p.kind !== 'owner');
    if (nonOwners.length === 0) return;
    const ids: string[] = [];
    for (const p of nonOwners) {
      const f = upsertSavedFriend({
        name: p.name,
        avatar: p.avatar || '👤',
        numericId: p.numericId,
      });
      ids.push(f.id);
    }
    upsertSavedGroup({ name, icon: '👥', memberIds: ids });
    setNewGroupName('');
    setShowGroupInput(false);
    refreshSaved();
    showToast(isAr ? 'تم حفظ المجموعة!' : 'Group saved!', 'success');
  };

  const activeMenuPerson = people.find((p) => p.id === activePersonMenuId) || null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          {t('billPeopleTitle')} ({people.length})
        </span>
        <button
          type="button"
          onClick={() => setIsAddSheetOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-full text-xs font-bold bg-[var(--accent-soft)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/30 hover:opacity-90 active:scale-[0.97] transition cursor-pointer"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>{t('billAddPersonBtn')}</span>
        </button>
      </div>

      {/* Horizontal People Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {people.map((person) => {
          const shareMinor = perPersonTotalsMinor[person.id] || 0;
          const isOwner = person.kind === 'owner';
          return (
            <button
              key={person.id}
              type="button"
              onClick={() => {
                if (!isOwner) setActivePersonMenuId(person.id);
              }}
              className={`shrink-0 flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-2xl border text-start transition cursor-pointer select-none ${
                person.paidFlag
                  ? 'bg-[var(--bg-secondary)] border-[var(--status-success)]/45'
                  : 'bg-[var(--bg-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
              }`}
              style={{ contain: 'layout style' }}
            >
              <span className="text-base leading-none shrink-0">{person.avatar || '👤'}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span dir="auto" className="text-xs font-bold text-[var(--text-primary)] truncate max-w-[96px]">
                    {person.name}
                  </span>
                  {isOwner && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                      {t('billYouLabel')}
                    </span>
                  )}
                  {person.role === 'helper' && !isOwner && (
                    <Shield className="w-3 h-3 text-[var(--accent-primary)] shrink-0" />
                  )}
                  {person.paidFlag && !isOwner && (
                    <Check className="w-3.5 h-3.5 text-[var(--status-success)] shrink-0 stroke-[2.5]" />
                  )}
                </div>
                <div className="text-[11px] font-mono tabular-nums font-bold text-[var(--text-secondary)]">
                  {formatMinorMoney(shareMinor, currency, language)}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Person Quick Role/Remove Sheet */}
      {activeMenuPerson && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setActivePersonMenuId(null)}
          className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-[12px] p-0 sm:p-4 overscroll-contain"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-sm rounded-t-[22px] sm:rounded-[22px] bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-5 space-y-4 shadow-2xl modal-container-anim"
            style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
          >
            <div className="w-10 h-1 rounded-full bg-[var(--border-strong)] mx-auto sm:hidden" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{activeMenuPerson.avatar || '👤'}</span>
                <div>
                  <h4 dir="auto" className="text-base font-bold text-[var(--text-primary)]">
                    {activeMenuPerson.name}
                  </h4>
                  <span className="text-xs text-[var(--text-secondary)]">
                    {activeMenuPerson.kind === 'solv_user' ? t('billSolvBadge') : t('billGuestBadge')}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActivePersonMenuId(null)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  onUpdatePerson(activeMenuPerson.id, {
                    role: activeMenuPerson.role === 'helper' ? 'participant' : 'helper',
                  });
                  setActivePersonMenuId(null);
                }}
                className="w-full flex items-center justify-between p-3.5 min-h-[44px] rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-sm font-semibold text-[var(--text-primary)] cursor-pointer"
              >
                <span>
                  {activeMenuPerson.role === 'helper'
                    ? t('billPersonRoleHelper')
                    : t('billPersonRoleParticipant')}
                </span>
                <span className="text-xs font-bold text-[var(--accent-primary)]">
                  {activeMenuPerson.role === 'helper' ? '✓' : '+'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onUpdatePerson(activeMenuPerson.id, { paidFlag: !activeMenuPerson.paidFlag });
                  setActivePersonMenuId(null);
                }}
                className="w-full flex items-center justify-between p-3.5 min-h-[44px] rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-sm font-semibold text-[var(--text-primary)] cursor-pointer"
              >
                <span>{activeMenuPerson.paidFlag ? t('billPaidBadge') : t('billUnpaidBadge')}</span>
                <Check
                  className={`w-4 h-4 ${
                    activeMenuPerson.paidFlag ? 'text-[var(--status-success)]' : 'text-[var(--text-tertiary)]'
                  }`}
                />
              </button>

              <button
                type="button"
                onClick={async () => {
                  const ok = await showConfirm({
                    title: activeMenuPerson.name,
                    message: t('billRemovePersonConfirm'),
                    isDanger: true,
                  });
                  if (ok) {
                    onRemovePerson(activeMenuPerson.id);
                    setActivePersonMenuId(null);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 p-3.5 min-h-[44px] rounded-xl bg-[var(--status-danger)]/15 text-[var(--status-danger)] text-sm font-bold cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{t('billDeleteBtn')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Person / Friends / Groups Sheet */}
      {isAddSheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setIsAddSheetOpen(false)}
          className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-[12px] p-0 sm:p-4 overscroll-contain"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md max-h-[88dvh] flex flex-col rounded-t-[22px] sm:rounded-[22px] bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-5 space-y-4 shadow-2xl overflow-y-auto overscroll-contain modal-container-anim"
            style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
          >
            <div className="w-10 h-1 rounded-full bg-[var(--border-strong)] mx-auto sm:hidden shrink-0" />
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">{t('billAddPersonBtn')}</h3>
              <button
                type="button"
                onClick={() => setIsAddSheetOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Guest Form */}
            <form onSubmit={handleAddGuestSubmit} className="flex items-center gap-2">
              <input
                type="text"
                dir="auto"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder={t('billAddGuestPlaceholder')}
                className="flex-1 min-w-0 min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[16px] sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
              />
              <button
                type="submit"
                disabled={!guestName.trim()}
                className="min-h-[44px] px-4 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-sm font-bold disabled:opacity-45 cursor-pointer shrink-0"
              >
                {t('billAddGuestBtn')}
              </button>
            </form>

            {/* 16-digit solv ID Lookup */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                value={idLookupInput}
                onChange={(e) => setIdLookupInput(e.target.value)}
                placeholder={t('bill16DigitPlaceholder')}
                className="flex-1 min-w-0 min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[16px] sm:text-sm font-mono tabular-nums text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
              />
              <button
                type="button"
                disabled={lookingUpId || cleanNumericId(idLookupInput).length !== 16}
                onClick={handleLookup16Id}
                className="min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-strong)] text-xs font-bold text-[var(--text-primary)] disabled:opacity-45 cursor-pointer shrink-0 flex items-center gap-1.5"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{t('billAddBy16IdBtn')}</span>
              </button>
            </div>

            {/* Saved Groups */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  <span>{t('billGroupsTitle')}</span>
                </span>
                {people.filter((p) => p.kind !== 'owner').length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowGroupInput((v) => !v)}
                    className="text-xs font-bold text-[var(--accent-primary)] cursor-pointer"
                  >
                    + {t('billCreateGroupBtn')}
                  </button>
                )}
              </div>

              {showGroupInput && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--bg-tertiary)]">
                  <input
                    type="text"
                    dir="auto"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder={t('billGroupNamePlaceholder')}
                    className="flex-1 min-w-0 min-h-[40px] px-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[16px] sm:text-sm text-[var(--text-primary)]"
                  />
                  <button
                    type="button"
                    onClick={handleSaveCurrentAsGroup}
                    disabled={!newGroupName.trim()}
                    className="min-h-[40px] px-3 rounded-xl bg-[var(--accent-primary)] text-white text-xs font-bold disabled:opacity-45 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              )}

              {savedGroups.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {savedGroups.map((g) => (
                    <div
                      key={g.id}
                      className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] ps-3 pe-1.5 py-1"
                    >
                      <button
                        type="button"
                        onClick={() => handleApplyGroup(g)}
                        className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer py-1"
                      >
                        <span>{g.icon}</span>
                        <span dir="auto">{g.name}</span>
                        <span className="text-[10px] text-[var(--text-secondary)]">({g.memberIds.length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          deleteSavedGroup(g.id);
                          refreshSaved();
                        }}
                        className="p-1 text-[var(--text-tertiary)] hover:text-[var(--status-danger)] cursor-pointer"
                        aria-label="Delete group"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Saved Friends List */}
            <div className="space-y-2 pt-1">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] block">
                {t('billSavedFriendsTitle')}
              </span>
              {savedFriends.length === 0 ? (
                <p className="text-xs text-[var(--text-tertiary)] py-2">{t('billNoSavedFriends')}</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto overscroll-contain">
                  {savedFriends.map((f) => {
                    const isAdded = people.some(
                      (p) =>
                        (f.numericId && p.numericId === f.numericId) ||
                        p.name.trim().toLowerCase() === f.name.trim().toLowerCase()
                    );
                    return (
                      <div
                        key={f.id}
                        className={`flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-xl border ${
                          isAdded
                            ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)]/40 opacity-70'
                            : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)]'
                        }`}
                      >
                        <button
                          type="button"
                          disabled={isAdded}
                          onClick={() => handlePickFriend(f)}
                          className="flex items-center gap-2 min-w-0 flex-1 text-start cursor-pointer"
                        >
                          <span className="text-base shrink-0">{f.avatar || '👤'}</span>
                          <span dir="auto" className="text-xs font-bold text-[var(--text-primary)] truncate">
                            {f.name}
                          </span>
                        </button>
                        {!isAdded ? (
                          <button
                            type="button"
                            onClick={() => {
                              deleteSavedFriend(f.id);
                              refreshSaved();
                            }}
                            className="p-1 text-[var(--text-tertiary)] hover:text-[var(--status-danger)] cursor-pointer shrink-0"
                            aria-label="Remove saved friend"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <Check className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
