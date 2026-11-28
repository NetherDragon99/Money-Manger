import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ClipboardPaste,
  Eye,
  Loader2,
  Shield,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { BillPerson, BillSession, SavedBillFriend, SavedBillGroup } from '../../types';
import {
  formatMinorMoney,
  generateBillId,
  getEffectivePersonPermission,
} from '../../utils/billSplitEngine';
import {
  deleteSavedFriend,
  deleteSavedGroup,
  getMergedSavedFriends,
  loadBillSplitBundle,
  upsertSavedFriend,
  upsertSavedGroup,
} from '../../utils/billSplitStore';
import {
  cleanNumericId,
  format16DigitId,
  format16DigitInput,
  lookupUserByNumericId,
  searchUsersByNumericIdPrefix,
  SuggestedSolvUser,
} from '../../utils/userId';
import { loadDeduplicatedContacts } from '../../utils/shareFolders';
import { translations } from '../../utils/translations';
import { BillLivePanel } from './BillLivePanel';
import { BillPersonAvatar } from './BillPersonAvatar';

interface BillPeopleBarProps {
  people: BillPerson[];
  perPersonTotalsMinor: Record<string, number>;
  currency: string;
  language: 'ar' | 'en';
  myNumericId?: string;
  isAddSheetOpen: boolean;
  onAddSheetOpenChange: (open: boolean) => void;
  liveSession: BillSession;
  isCloudSyncing: boolean;
  onSetPublic: (enabled: boolean) => Promise<boolean>;
  onEnsurePublished: () => Promise<boolean>;
  onUpdateLiveConfig: (patch: Partial<NonNullable<BillSession['live']>>) => void;
  onRegenerateLink: () => Promise<void>;
  onReopenBill: () => void;
  onApprovePerson: (personId: string) => void;
  onLinkPendingToExisting: (pendingId: string, existingId: string) => void;
  onRejectPerson: (personId: string) => void;
  onAddPerson: (person: BillPerson) => void;
  onAddMultiplePeople: (persons: BillPerson[]) => void;
  onUpdatePerson: (personId: string, patch: Partial<BillPerson>) => void;
  onOpenPersonBreakdown: (person: BillPerson) => void;
  showConfirm: (opts: {
    title: string;
    message: string;
    confirmText?: string;
    isDanger?: boolean;
  }) => Promise<boolean>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  t: (key: keyof typeof translations.en) => string;
}

export const BillPeopleBar: React.FC<BillPeopleBarProps> = ({
  people,
  perPersonTotalsMinor,
  currency,
  language,
  myNumericId,
  isAddSheetOpen,
  onAddSheetOpenChange,
  liveSession,
  isCloudSyncing,
  onSetPublic,
  onEnsurePublished,
  onUpdateLiveConfig,
  onRegenerateLink,
  onReopenBill,
  onApprovePerson,
  onLinkPendingToExisting,
  onRejectPerson,
  onAddPerson,
  onAddMultiplePeople,
  onUpdatePerson,
  onOpenPersonBreakdown,
  showConfirm,
  showToast,
  t,
}) => {
  const isAr = language === 'ar';
  const setIsAddSheetOpen = onAddSheetOpenChange;
  const cleanMyId = cleanNumericId(myNumericId || '');

  const [linkPickerFor, setLinkPickerFor] = useState<string | null>(null);
  const [guestName, setGuestName] = useState('');
  const [savedFriends, setSavedFriends] = useState<SavedBillFriend[]>([]);
  const [savedGroups, setSavedGroups] = useState<SavedBillGroup[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [showGroupInput, setShowGroupInput] = useState(false);

  // Live 16-digit ID search states
  const [typedId, setTypedId] = useState('');
  const [cloudSuggestions, setCloudSuggestions] = useState<SuggestedSolvUser[]>([]);
  const [searchingCloud, setSearchingCloud] = useState(false);
  const [exactNotFound, setExactNotFound] = useState(false);
  const idInputRef = useRef<HTMLInputElement | null>(null);
  const pendingCursorRef = useRef<number | null>(null);

  const pendingPeople = people.filter((p) => p.approval === 'pending');
  const linkCandidates = people.filter(
    (p) =>
      p.kind !== 'owner' &&
      p.approval === 'approved' &&
      (!p.boundUid || p.kind === 'solv_user')
  );

  const refreshSaved = () => {
    setSavedFriends(getMergedSavedFriends(myNumericId));
    setSavedGroups(loadBillSplitBundle().groups || []);
  };

  useEffect(() => {
    if (isAddSheetOpen) {
      refreshSaved();
    } else {
      setTypedId('');
      setCloudSuggestions([]);
      setExactNotFound(false);
    }
  }, [isAddSheetOpen]);

  useEffect(() => {
    if (!isAddSheetOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsAddSheetOpen(false);
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [isAddSheetOpen]);

  // Restore formatted 4-digit cursor cleanly
  useLayoutEffect(() => {
    if (pendingCursorRef.current !== null && idInputRef.current) {
      const pos = pendingCursorRef.current;
      idInputRef.current.setSelectionRange(pos, pos);
      pendingCursorRef.current = null;
    }
  }, [typedId]);

  const cleanTyped = cleanNumericId(typedId);
  const isSelfId = Boolean(cleanMyId && cleanTyped.length === 16 && cleanTyped === cleanMyId);

  // Instant local suggestions from Saved Friends + Share Contacts matching typed digits
  const localIdSuggestions = useMemo<SuggestedSolvUser[]>(() => {
    if (cleanTyped.length === 0 || isSelfId) return [];
    const map = new Map<string, SuggestedSolvUser>();

    for (const f of savedFriends) {
      const cid = cleanNumericId(f.numericId);
      if (cid.length === 16 && cid !== cleanMyId && cid.includes(cleanTyped)) {
        map.set(cid, {
          numericId: cid,
          uid: f.uid,
          name: f.name,
          photoURL: f.photoURL,
          avatar: f.avatar || '👤',
        });
      }
    }

    try {
      const contacts = loadDeduplicatedContacts(cleanMyId);
      for (const c of contacts) {
        const cid = cleanNumericId(c.numericId);
        if (cid.length === 16 && cid !== cleanMyId && cid.includes(cleanTyped) && !map.has(cid)) {
          map.set(cid, {
            numericId: cid,
            uid: c.uid,
            name: c.name || `solv ${cid.slice(-4)}`,
            photoURL: c.photoURL,
            avatar: c.avatar || '👤',
          });
        }
      }
    } catch {}

    return Array.from(map.values()).slice(0, 6);
  }, [cleanTyped, savedFriends, cleanMyId, isSelfId]);

  // Debounced live cloud search as user types 3+ digits (and exact lookup at 16 digits)
  useEffect(() => {
    if (cleanTyped.length < 3 || isSelfId) {
      setCloudSuggestions([]);
      setSearchingCloud(false);
      setExactNotFound(false);
      return;
    }

    let cancelled = false;
    setSearchingCloud(true);
    setExactNotFound(false);

    const timer = setTimeout(async () => {
      try {
        if (cleanTyped.length === 16) {
          const card = await lookupUserByNumericId(cleanTyped);
          if (cancelled) return;
          if (card) {
            setCloudSuggestions([
              {
                numericId: cleanTyped,
                uid: card.uid,
                name: card.name || card.displayName || `solv ${cleanTyped.slice(-4)}`,
                photoURL: card.photoURL || '',
                avatar: card.avatar || '👤',
              },
            ]);
            setExactNotFound(false);
          } else {
            setCloudSuggestions([]);
            setExactNotFound(true);
          }
        } else {
          const matches = await searchUsersByNumericIdPrefix(cleanTyped, cleanMyId, 6);
          if (cancelled) return;
          setCloudSuggestions(matches);
        }
      } catch {
        if (!cancelled) setCloudSuggestions([]);
      } finally {
        if (!cancelled) setSearchingCloud(false);
      }
    }, cleanTyped.length === 16 ? 60 : 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cleanTyped, cleanMyId, isSelfId]);

  const mergedIdSuggestions = useMemo<SuggestedSolvUser[]>(() => {
    const map = new Map<string, SuggestedSolvUser>();
    for (const c of cloudSuggestions) map.set(c.numericId, c);
    for (const l of localIdSuggestions) {
      if (!map.has(l.numericId)) {
        map.set(l.numericId, l);
      } else {
        const existing = map.get(l.numericId)!;
        map.set(l.numericId, {
          ...existing,
          photoURL: existing.photoURL || l.photoURL,
          uid: existing.uid || l.uid,
        });
      }
    }
    return Array.from(map.values()).slice(0, 6);
  }, [cloudSuggestions, localIdSuggestions]);

  const handleIdInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const selectionStart = e.target.selectionStart ?? rawVal.length;
    const nativeEvent = e.nativeEvent as InputEvent | undefined;
    const isBackspace =
      nativeEvent?.inputType === 'deleteContentBackward' ||
      rawVal.length < format16DigitId(typedId).length;
    const isDeleteForward = nativeEvent?.inputType === 'deleteContentForward';

    const { clean, newCursorPos } = format16DigitInput(
      rawVal,
      selectionStart,
      isBackspace,
      cleanTyped,
      isDeleteForward
    );
    pendingCursorRef.current = newCursorPos;
    setTypedId(clean);
  };

  const handlePasteId = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const clean = cleanNumericId(text).slice(0, 16);
      if (clean) {
        pendingCursorRef.current = format16DigitId(clean).length;
        setTypedId(clean);
      }
    } catch {}
  };

  const handleSelectSuggestedUser = (u: SuggestedSolvUser) => {
    if (people.some((p) => p.numericId === u.numericId)) {
      showToast(isAr ? 'هذا الشخص مضاف بالفعل' : 'Already added', 'info');
      return;
    }
    upsertSavedFriend({
      name: u.name,
      avatar: u.avatar || '👤',
      photoURL: u.photoURL,
      numericId: u.numericId,
      uid: u.uid,
      bumpUsage: true,
    });
    onAddPerson({
      id: `p_${generateBillId().slice(0, 8)}`,
      name: u.name,
      avatar: u.avatar || '👤',
      photoURL: u.photoURL,
      kind: 'solv_user',
      numericId: u.numericId,
      boundUid: u.uid,
      role: 'participant',
      approval: 'approved',
      paidFlag: false,
    });
    setTypedId('');
    setCloudSuggestions([]);
    refreshSaved();
    showToast(isAr ? `تمت إضافة ${u.name}` : `Added ${u.name}`, 'success');
  };

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
      photoURL: saved.photoURL,
      kind: 'guest',
      role: 'participant',
      approval: 'approved',
      paidFlag: false,
    });
    setGuestName('');
    refreshSaved();
  };

  const handlePickFriend = (friend: SavedBillFriend) => {
    const already = people.some(
      (p) =>
        (friend.numericId && p.numericId === friend.numericId) ||
        p.name.trim().toLowerCase() === friend.name.trim().toLowerCase()
    );
    if (already) return;
    upsertSavedFriend({ ...friend, bumpUsage: true });
    const personId = `p_${generateBillId().slice(0, 8)}`;
    onAddPerson({
      id: personId,
      name: friend.name,
      avatar: friend.avatar || '👤',
      photoURL: friend.photoURL,
      kind: friend.numericId ? 'solv_user' : 'guest',
      numericId: friend.numericId,
      boundUid: friend.uid,
      role: 'participant',
      approval: 'approved',
      paidFlag: false,
    });
    if (friend.numericId && (!friend.uid || !friend.photoURL)) {
      lookupUserByNumericId(friend.numericId)
        .then((card) => {
          if (card) {
            upsertSavedFriend({
              ...friend,
              uid: card.uid || friend.uid,
              photoURL: card.photoURL || friend.photoURL,
            });
            onUpdatePerson(personId, {
              boundUid: card.uid || friend.uid,
              photoURL: card.photoURL || friend.photoURL,
            });
          }
        })
        .catch(() => {});
    }
    refreshSaved();
  };

  const handleApplyGroup = (group: SavedBillGroup) => {
    const friendMap = new Map(savedFriends.map((f) => [f.id, f]));
    const toAdd: BillPerson[] = [];
    const lookupQueue: Array<{ personId: string; friend: SavedBillFriend }> = [];
    for (const fid of group.memberIds) {
      const f = friendMap.get(fid);
      if (!f) continue;
      const already = people.some(
        (p) =>
          (f.numericId && p.numericId === f.numericId) ||
          p.name.trim().toLowerCase() === f.name.trim().toLowerCase()
      );
      if (!already) {
        const pid = `p_${generateBillId().slice(0, 8)}`;
        toAdd.push({
          id: pid,
          name: f.name,
          avatar: f.avatar || '👤',
          photoURL: f.photoURL,
          kind: f.numericId ? 'solv_user' : 'guest',
          numericId: f.numericId,
          boundUid: f.uid,
          role: 'participant',
          approval: 'approved',
          paidFlag: false,
        });
        if (f.numericId && (!f.uid || !f.photoURL)) {
          lookupQueue.push({ personId: pid, friend: f });
        }
      }
    }
    if (toAdd.length > 0) {
      onAddMultiplePeople(toAdd);
      for (const item of lookupQueue) {
        lookupUserByNumericId(item.friend.numericId!)
          .then((card) => {
            if (card) {
              upsertSavedFriend({
                ...item.friend,
                uid: card.uid || item.friend.uid,
                photoURL: card.photoURL || item.friend.photoURL,
              });
              onUpdatePerson(item.personId, {
                boundUid: card.uid || item.friend.uid,
                photoURL: card.photoURL || item.friend.photoURL,
              });
            }
          })
          .catch(() => {});
      }
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
        photoURL: p.photoURL,
        numericId: p.numericId,
        uid: p.boundUid,
      });
      ids.push(f.id);
    }
    upsertSavedGroup({ name, icon: '👥', memberIds: ids });
    setNewGroupName('');
    setShowGroupInput(false);
    refreshSaved();
    showToast(isAr ? 'تم حفظ المجموعة!' : 'Group saved!', 'success');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          {t('billPeopleTitle')} ({people.length})
        </span>
        <button
          type="button"
          onClick={() => setIsAddSheetOpen(true)}
          className="relative inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-full text-xs font-bold bg-[var(--accent-soft)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/30 hover:opacity-90 active:scale-[0.97] transition cursor-pointer"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>{t('billAddPersonBtn')}</span>
          {pendingPeople.length > 0 && (
            <span className="absolute -top-1.5 -end-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--status-danger)] text-[var(--text-on-accent)] text-[10px] font-bold tabular-nums flex items-center justify-center">
              {pendingPeople.length}
            </span>
          )}
        </button>
      </div>

      {/* Horizontal People Cards (Name + Photo + Effective Permission + Share — ALL clickable, including Owner!) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {people.map((person) => {
          const shareMinor = perPersonTotalsMinor[person.id] || 0;
          const isOwner = person.kind === 'owner';
          const effectivePerm = getEffectivePersonPermission(liveSession, person);
          return (
            <button
              key={person.id}
              type="button"
              onClick={() => onOpenPersonBreakdown(person)}
              className={`shrink-0 flex items-center gap-2.5 ps-2.5 pe-3 py-2 min-h-[48px] rounded-2xl border text-start transition cursor-pointer select-none active:scale-[0.97] ${
                person.paidFlag
                  ? 'bg-[var(--bg-secondary)] border-[var(--status-success)]/45'
                  : 'bg-[var(--bg-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
              }`}
              style={{ contain: 'layout style' }}
            >
              <BillPersonAvatar
                name={person.name}
                avatar={person.avatar}
                photoURL={person.photoURL}
                size="sm"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span dir="auto" className="text-xs font-bold text-[var(--text-primary)] truncate max-w-[104px]">
                    {person.name}
                  </span>
                  {isOwner ? (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                      {t('billYouLabel')}
                    </span>
                  ) : effectivePerm === 'helper' ? (
                    <Shield className="w-3 h-3 text-[var(--accent-primary)] shrink-0" />
                  ) : effectivePerm === 'claim_own' ? (
                    <UserCheck className="w-3 h-3 text-[var(--accent-primary)] shrink-0" />
                  ) : (
                    <Eye className="w-3 h-3 text-[var(--text-tertiary)] shrink-0" />
                  )}
                  {person.approval === 'pending' && (
                    <span className="text-[9px] font-bold px-1 rounded bg-[var(--status-warning)]/20 text-[var(--status-warning)]">
                      !
                    </span>
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

      {/* Add Person / Live 16-Digit Search / Link & Permissions / Groups Sheet */}
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

            {/* Join requests from the public link (shown first) */}
            {pendingPeople.length > 0 && (
              <div className="space-y-2 rounded-2xl bg-[var(--status-warning)]/10 border border-[var(--status-warning)]/35 p-3">
                <span className="text-xs font-bold text-[var(--status-warning)] block">
                  {t('billJoinRequestsTitle')} ({pendingPeople.length})
                </span>
                {pendingPeople.map((p) => (
                  <div
                    key={p.id}
                    className="space-y-2 p-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <BillPersonAvatar
                          name={p.name}
                          avatar={p.avatar}
                          photoURL={p.photoURL}
                          size="sm"
                        />
                        <span dir="auto" className="text-sm font-bold text-[var(--text-primary)] truncate">
                          {p.name}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRejectPerson(p.id)}
                        className="px-2.5 py-1.5 min-h-[36px] rounded-xl bg-[var(--status-danger)]/15 text-[var(--status-danger)] text-xs font-bold cursor-pointer active:scale-[0.97] transition"
                      >
                        {t('billRejectBtn')}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onApprovePerson(p.id)}
                        className="min-h-[40px] px-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--text-on-accent)] text-xs font-bold cursor-pointer active:scale-[0.97] transition"
                      >
                        {t('billJoinAcceptNewBtn')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setLinkPickerFor((cur) => (cur === p.id ? null : p.id))}
                        className={`min-h-[40px] px-2 rounded-xl border text-xs font-bold cursor-pointer active:scale-[0.97] transition ${
                          linkPickerFor === p.id
                            ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--accent-primary)]'
                            : 'bg-[var(--bg-tertiary)] border-[var(--border-strong)] text-[var(--text-primary)]'
                        }`}
                      >
                        {t('billJoinLinkExistingBtn')}
                      </button>
                    </div>
                    {linkPickerFor === p.id && (
                      <div className="space-y-1.5">
                        <p className="text-[11px] text-[var(--text-secondary)]">{t('billJoinLinkPickHint')}</p>
                        {linkCandidates.length === 0 ? (
                          <p className="text-[11px] text-[var(--text-tertiary)]">{t('billJoinNoUnlinked')}</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {linkCandidates.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  onLinkPendingToExisting(p.id, c.id);
                                  setLinkPickerFor(null);
                                }}
                                className="inline-flex items-center gap-1.5 ps-2 pe-3 py-1.5 min-h-[38px] rounded-xl bg-[var(--accent-soft)] border border-[var(--accent-primary)]/40 text-xs font-bold text-[var(--text-primary)] cursor-pointer active:scale-[0.97] transition"
                              >
                                <BillPersonAvatar
                                  name={c.name}
                                  avatar={c.avatar}
                                  photoURL={c.photoURL}
                                  size="xs"
                                />
                                <span dir="auto">{c.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Quick Guest Name Form */}
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
                className="min-h-[44px] px-4 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--text-on-accent)] text-sm font-bold disabled:opacity-45 cursor-pointer shrink-0 active:scale-[0.97] transition"
              >
                {t('billAddGuestBtn')}
              </button>
            </form>

            {/* Live 16-Digit ID Search with Rich Suggestion Cards (Name + Photo) */}
            <div className="space-y-2 rounded-2xl bg-[var(--bg-tertiary)]/60 border border-[var(--border-subtle)] p-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[var(--text-secondary)]">
                  {t('billIdLiveSearchLabel')}
                </label>
                <span
                  className={`text-[11px] font-mono tabular-nums font-bold ${
                    cleanTyped.length === 16
                      ? 'text-[var(--accent-primary)]'
                      : 'text-[var(--text-tertiary)]'
                  }`}
                >
                  {cleanTyped.length}/16
                </span>
              </div>

              <div className="relative flex items-center">
                <input
                  ref={idInputRef}
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  maxLength={19}
                  value={format16DigitId(typedId)}
                  onChange={handleIdInputChange}
                  placeholder="4829 1038 4756 1928"
                  className="w-full min-h-[44px] ps-3.5 pe-16 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[16px] sm:text-sm font-mono tabular-nums tracking-wider text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                />
                <div className="absolute inset-inline-end-2 flex items-center">
                  {cleanTyped.length === 0 ? (
                    <button
                      type="button"
                      onClick={handlePasteId}
                      className="px-2 py-1 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <ClipboardPaste className="w-3 h-3" />
                      <span>{isAr ? 'لصق' : 'Paste'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setTypedId('');
                        setCloudSuggestions([]);
                        setExactNotFound(false);
                      }}
                      className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer"
                      aria-label="Clear"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {isSelfId && (
                <p className="text-xs font-bold text-[var(--status-warning)] px-1">
                  {t('billIdSelfHint')}
                </p>
              )}

              {searchingCloud && mergedIdSuggestions.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] px-1 py-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent-primary)]" />
                  <span>{t('billIdSearchingHint')}</span>
                </div>
              )}

              {!searchingCloud && exactNotFound && mergedIdSuggestions.length === 0 && (
                <p className="text-xs font-semibold text-[var(--status-danger)] px-1">
                  {t('billIdNoMatchHint')}
                </p>
              )}

              {/* Live Suggestion Profile Cards (Name + Real Photo / Avatar + Formatted ID) */}
              {mergedIdSuggestions.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block px-0.5">
                    {t('billIdSuggestionsLabel')}
                  </span>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto overscroll-contain">
                    {mergedIdSuggestions.map((sug) => {
                      const alreadyInBill = people.some((p) => p.numericId === sug.numericId);
                      return (
                        <button
                          key={sug.numericId}
                          type="button"
                          disabled={alreadyInBill}
                          onClick={() => handleSelectSuggestedUser(sug)}
                          className={`w-full flex items-center justify-between gap-2.5 p-2.5 rounded-2xl border text-start transition cursor-pointer active:scale-[0.98] ${
                            alreadyInBill
                              ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)]/40 opacity-75'
                              : 'bg-[var(--bg-secondary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <BillPersonAvatar
                              name={sug.name}
                              avatar={sug.avatar}
                              photoURL={sug.photoURL}
                              size="md"
                            />
                            <div className="min-w-0">
                              <div dir="auto" className="text-xs font-extrabold text-[var(--text-primary)] truncate">
                                {sug.name}
                              </div>
                              <div dir="ltr" className="text-[10px] font-mono text-[var(--text-secondary)]">
                                {format16DigitId(sug.numericId)}
                              </div>
                            </div>
                          </div>

                          {alreadyInBill ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--accent-soft)] text-[var(--accent-primary)] text-[11px] font-bold shrink-0">
                              <Check className="w-3 h-3" />
                              <span>{t('billIdAlreadyAddedBadge')}</span>
                            </span>
                          ) : (
                            <span className="px-3 py-1.5 rounded-xl bg-[var(--accent-primary)] text-[var(--text-on-accent)] text-xs font-bold shrink-0">
                              {t('billIdAddCardBtn')}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Link sharing, permissions & auto-accept */}
            <BillLivePanel
              session={liveSession}
              language={language}
              isSyncing={isCloudSyncing}
              onSetPublic={onSetPublic}
              onEnsurePublished={onEnsurePublished}
              onUpdateLiveConfig={onUpdateLiveConfig}
              onRegenerateLink={onRegenerateLink}
              onReopenBill={onReopenBill}
              showConfirm={showConfirm}
              showToast={showToast}
              t={t}
            />

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
                    className="min-h-[40px] px-3 rounded-xl bg-[var(--accent-primary)] text-[var(--text-on-accent)] text-xs font-bold disabled:opacity-45 cursor-pointer"
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

            {/* Saved Friends Cards (Photo + Name) */}
            <div className="space-y-2 pt-1">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] block">
                {t('billSavedFriendsTitle')}
              </span>
              {savedFriends.length === 0 ? (
                <p className="text-xs text-[var(--text-tertiary)] py-2">{t('billNoSavedFriends')}</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto overscroll-contain">
                  {savedFriends.map((f) => {
                    const isAdded = people.some(
                      (p) =>
                        (f.numericId && p.numericId === f.numericId) ||
                        p.name.trim().toLowerCase() === f.name.trim().toLowerCase()
                    );
                    return (
                      <div
                        key={f.id}
                        className={`flex items-center justify-between gap-1.5 p-2 rounded-2xl border ${
                          isAdded
                            ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)]/40 opacity-75'
                            : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)]'
                        }`}
                      >
                        <button
                          type="button"
                          disabled={isAdded}
                          onClick={() => handlePickFriend(f)}
                          className="flex items-center gap-2 min-w-0 flex-1 text-start cursor-pointer"
                        >
                          <BillPersonAvatar
                            name={f.name}
                            avatar={f.avatar}
                            photoURL={f.photoURL}
                            size="sm"
                          />
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
