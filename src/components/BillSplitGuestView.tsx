import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Clock,
  Copy,
  CreditCard,
  Eye,
  Lock,
  Plus,
  Radio,
  Shield,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { BillItem, BillPerson, BillSession } from '../types';
import {
  computeBill,
  formatMinorMoney,
  generateBillId,
  getEffectivePersonPermission,
  getItemLineTotalMinor,
  toMinor,
} from '../utils/billSplitEngine';
import {
  guestRenameSelf,
  guestRequestJoin,
  guestToggleItemClaim,
  helperDeleteItem,
  helperUpsertItem,
  subscribeToLiveBillAsGuest,
} from '../utils/billSplitCloud';
import { auth, ensureFirebaseAuth } from '../utils/firebase';

interface BillSplitGuestViewProps {
  billId: string;
  onExit: () => void;
}

export const BillSplitGuestView: React.FC<BillSplitGuestViewProps> = ({ billId, onExit }) => {
  const { settings, showToast, t } = useApp();
  const language = settings.language === 'ar' ? 'ar' : 'en';
  const isAr = language === 'ar';

  const [session, setSession] = useState<BillSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [myUid, setMyUid] = useState<string>(auth.currentUser?.uid || '');

  // Mandatory join / pending rename states
  const [joinName, setJoinName] = useState('');
  const [joining, setJoining] = useState(false);
  const [pendingNameDraft, setPendingNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [copiedPayField, setCopiedPayField] = useState<string | null>(null);

  // Helper add item inputs
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemQty, setNewItemQty] = useState('1');
  const [addingItem, setAddingItem] = useState(false);

  useEffect(() => {
    ensureFirebaseAuth()
      .then((u) => {
        if (u?.uid) setMyUid(u.uid);
      })
      .catch(() => {});

    const unsub = subscribeToLiveBillAsGuest(
      billId,
      (remote) => {
        setSession(remote);
        setLoading(false);
        setLoadError(false);
        if (auth.currentUser?.uid) setMyUid(auth.currentUser.uid);
      },
      () => {
        setLoading(false);
        setLoadError(true);
      }
    );
    return () => unsub();
  }, [billId]);

  const computation = useMemo(() => (session ? computeBill(session) : null), [session]);

  const boundPerson: BillPerson | null = useMemo(() => {
    if (!session || !myUid) return null;
    return (
      session.people.find((p) => p.boundUid === myUid) ||
      (session.ownerUid && session.ownerUid === myUid
        ? session.people.find((p) => p.kind === 'owner') || null
        : null)
    );
  }, [session, myUid]);

  useEffect(() => {
    if (boundPerson?.approval === 'pending') {
      setPendingNameDraft(boundPerson.name);
    }
  }, [boundPerson?.id, boundPerson?.approval, boundPerson?.name]);

  const effectivePermission = useMemo(() => {
    if (!session) return 'view_only';
    if (!boundPerson || boundPerson.approval !== 'approved') return 'view_only';
    return getEffectivePersonPermission(session, boundPerson);
  }, [session, boundPerson]);

  const isLinkActive = Boolean(session?.live?.linkActive);
  const isDeletedGrace = Boolean(session?.deletedByOwner);
  const isSettled = session?.status === 'settled';
  const isBillOpen =
    !isDeletedGrace && (session?.status === 'open' || session?.status === 'draft');

  const canClaimOwn =
    Boolean(boundPerson) &&
    boundPerson?.approval === 'approved' &&
    isLinkActive &&
    isBillOpen &&
    (effectivePermission === 'claim_own' || effectivePermission === 'helper');

  const canEditItems =
    Boolean(boundPerson) &&
    boundPerson?.approval === 'approved' &&
    isLinkActive &&
    isBillOpen &&
    effectivePermission === 'helper';

  // External visitors must enter their name before viewing the bill (unless the bill is in its 24h post-delete view window)
  const mustEnterNameFirst = Boolean(session && isLinkActive && !boundPerson && !isDeletedGrace);

  const handleRequestJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = joinName.trim().slice(0, 50);
    if (!cleaned) {
      showToast(t('billGuestNameRequired'), 'error');
      return;
    }
    setJoining(true);
    try {
      const user = await ensureFirebaseAuth();
      if (!user?.uid) throw new Error('Auth unavailable');
      setMyUid(user.uid);
      await guestRequestJoin(billId, cleaned, user.uid, Boolean(session?.live?.autoAccept));
      setJoinName('');
      showToast(
        session?.live?.autoAccept ? t('billLiveJoinedToast') : t('billLivePendingToast'),
        'success'
      );
    } catch {
      showToast(t('billLiveActionDenied'), 'error');
    } finally {
      setJoining(false);
    }
  };

  const handleSavePendingName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boundPerson || boundPerson.approval !== 'pending') return;
    const cleaned = pendingNameDraft.trim().slice(0, 50);
    if (!cleaned || cleaned === boundPerson.name) return;
    setSavingName(true);
    try {
      const user = await ensureFirebaseAuth();
      if (!user?.uid) throw new Error('Auth unavailable');
      await guestRenameSelf(billId, boundPerson, user.uid, cleaned);
      showToast(t('updatedSuccess'), 'success');
    } catch {
      showToast(t('billLiveActionDenied'), 'error');
    } finally {
      setSavingName(false);
    }
  };

  const handleToggleClaim = async (item: BillItem) => {
    if (!boundPerson || !canClaimOwn || item.mode === 'everyone') return;
    const currentlyClaimed =
      item.mode === 'equal_among'
        ? (item.equalAmong || []).includes(boundPerson.id) ||
          (Number(item.claims?.[boundPerson.id]) || 0) > 0
        : (Number(item.claims?.[boundPerson.id]) || 0) > 0;
    const nextUnits = currentlyClaimed ? 0 : 1;
    try {
      await guestToggleItemClaim(billId, item.id, boundPerson.id, nextUnits);
    } catch {
      showToast(t('billLiveActionDenied'), 'error');
    }
  };

  const handleHelperAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditItems || !session) return;
    const name = newItemName.trim();
    const price = Number(newItemPrice.replace(/,/g, '').trim());
    const qty = Number(newItemQty.replace(/,/g, '').trim()) || 1;
    if (!name || !Number.isFinite(price) || price <= 0) return;
    setAddingItem(true);
    try {
      const item: BillItem = {
        id: `item_${generateBillId().slice(0, 8)}`,
        name,
        unitPriceMinor: toMinor(price),
        qty: qty > 0 ? qty : 1,
        mode: 'equal_among',
        claims: {},
        equalAmong: [],
      };
      await helperUpsertItem(billId, item, session.items.length);
      setNewItemName('');
      setNewItemPrice('');
      setNewItemQty('1');
    } catch {
      showToast(t('billLiveActionDenied'), 'error');
    } finally {
      setAddingItem(false);
    }
  };

  const copyPaymentField = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedPayField(key);
      setTimeout(() => setCopiedPayField(null), 1500);
    } catch {}
  };

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="w-full h-[100dvh] flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden"
    >
      {/* Header */}
      <header
        className="shrink-0 z-[100] bg-[var(--bg-elevated)] backdrop-blur-[12px] border-b border-[var(--border-subtle)] px-4 pb-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onExit}
              className="min-w-[44px] min-h-[44px] w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] cursor-pointer shrink-0 active:scale-[0.97] transition"
              aria-label="solv"
            >
              <ArrowLeft className="w-5 h-5 rtl:scale-x-[-1]" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-lg">{session?.icon || '🧾'}</span>
                <h1 dir="auto" className="text-base font-extrabold truncate">
                  {session?.title?.trim() || t('billDefaultTitle')}
                </h1>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                <span className="font-bold text-[var(--accent-primary)]">solv</span>
                <span>•</span>
                {session && isLinkActive ? (
                  <span className="inline-flex items-center gap-1 text-[var(--status-success)] font-bold">
                    <Radio className="w-3 h-3" />
                    <span>{t('billLiveActiveBadge')}</span>
                  </span>
                ) : (
                  <span>{t('billLiveOffBadge')}</span>
                )}
              </div>
            </div>
          </div>

          {/* Permission indicator pill */}
          {session && isLinkActive && !mustEnterNameFirst && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[11px] font-bold text-[var(--text-secondary)] shrink-0">
              {canEditItems ? (
                <>
                  <Shield className="w-3 h-3 text-[var(--accent-primary)]" />
                  <span>{t('billPermHelperTitle')}</span>
                </>
              ) : canClaimOwn ? (
                <>
                  <UserCheck className="w-3 h-3 text-[var(--accent-primary)]" />
                  <span>{t('billPermClaimOwnTitle')}</span>
                </>
              ) : (
                <>
                  <Eye className="w-3 h-3" />
                  <span>{t('billPermViewOnlyTitle')}</span>
                </>
              )}
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4">
        <div className="max-w-2xl mx-auto space-y-4 pb-10">
          {loading ? (
            <div className="space-y-3">
              <div className="h-24 rounded-2xl bg-[var(--bg-secondary)] animate-pulse" />
              <div className="h-44 rounded-2xl bg-[var(--bg-secondary)] animate-pulse" />
            </div>
          ) : loadError || !session || !isLinkActive ? (
            <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-6 text-center space-y-3">
              <Lock className="w-10 h-10 mx-auto text-[var(--status-warning)]" />
              <h2 className="text-base font-bold">{t('billLiveUnavailableTitle')}</h2>
              <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto leading-relaxed">
                {t('billLiveUnavailableDesc')}
              </p>
              <button
                type="button"
                onClick={onExit}
                className="min-h-[44px] px-5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--text-on-accent)] text-sm font-bold cursor-pointer active:scale-[0.97] transition"
              >
                {t('billGuestOpenAppBtn')}
              </button>
            </div>
          ) : mustEnterNameFirst ? (
            <form
              onSubmit={handleRequestJoin}
              className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-6 space-y-4 shadow-sm"
            >
              <div className="space-y-1 text-center">
                <div className="text-3xl leading-none">{session.icon || '🧾'}</div>
                <h2 className="text-base font-extrabold text-[var(--text-primary)] pt-1">
                  {t('billGuestNameGateTitle')}
                </h2>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {t('billGuestNameGateDesc')}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)] block">
                  {t('billGuestNameLabel')}
                </label>
                <input
                  type="text"
                  dir="auto"
                  autoFocus
                  required
                  maxLength={50}
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  placeholder={t('billAddGuestPlaceholder')}
                  className="w-full min-h-[46px] px-3.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[16px] sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                />
              </div>

              <button
                type="submit"
                disabled={joining || !joinName.trim()}
                className="w-full min-h-[46px] px-4 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--text-on-accent)] text-sm font-bold disabled:opacity-45 cursor-pointer active:scale-[0.97] transition"
              >
                {t('billGuestJoinBtn')}
              </button>
            </form>
          ) : (
            <>
              {/* Deleted by owner (24-hour grace view-only notice) */}
              {isDeletedGrace && (
                <div className="rounded-2xl bg-[var(--status-danger)]/12 border border-[var(--status-danger)]/40 p-3.5 flex items-center gap-2.5 text-xs font-bold text-[var(--status-danger)]">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{t('billGuestDeletedBanner')}</span>
                </div>
              )}

              {/* Settled read-only notice */}
              {!isDeletedGrace && isSettled && (
                <div className="rounded-2xl bg-[var(--accent-soft)] border border-[var(--accent-primary)]/35 p-3.5 flex items-center gap-2.5 text-xs font-bold text-[var(--accent-primary)]">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>{t('billGuestSettledBanner')}</span>
                </div>
              )}

              {/* Pending Approval Banner + Editable Name */}
              {boundPerson?.approval === 'pending' && !isDeletedGrace && (
                <div className="rounded-2xl bg-[var(--status-warning)]/12 border border-[var(--status-warning)]/40 p-3.5 space-y-2.5">
                  <div className="flex items-start gap-2.5 text-xs font-bold text-[var(--status-warning)]">
                    <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <div>{t('billLivePendingToast')}</div>
                      <div className="font-medium text-[var(--text-secondary)]">
                        {t('billGuestPendingReadOnly')}
                      </div>
                    </div>
                  </div>
                  <form onSubmit={handleSavePendingName} className="flex items-center gap-2">
                    <input
                      type="text"
                      dir="auto"
                      maxLength={50}
                      value={pendingNameDraft}
                      onChange={(e) => setPendingNameDraft(e.target.value)}
                      aria-label={t('billGuestNameLabel')}
                      className="flex-1 min-w-0 min-h-[40px] px-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[16px] sm:text-xs font-bold text-[var(--text-primary)]"
                    />
                    <button
                      type="submit"
                      disabled={
                        savingName ||
                        !pendingNameDraft.trim() ||
                        pendingNameDraft.trim() === boundPerson.name
                      }
                      className="min-h-[40px] px-3 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--text-on-accent)] text-xs font-bold disabled:opacity-45 cursor-pointer shrink-0 active:scale-[0.97] transition"
                    >
                      {t('billGuestSaveNameBtn')}
                    </button>
                  </form>
                  <p className="text-[11px] text-[var(--text-secondary)]">{t('billGuestRenameHint')}</p>
                </div>
              )}

              {/* My Personal Share KPI Card */}
              {computation && (
                <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-[var(--text-secondary)] block">
                      {boundPerson && boundPerson.approval === 'approved'
                        ? `${boundPerson.avatar || '👤'} ${boundPerson.name}`
                        : t('billTotalLabel')}
                    </span>
                    <div className="text-2xl font-mono tabular-nums font-black text-[var(--accent-primary)] mt-0.5">
                      {formatMinorMoney(
                        boundPerson && boundPerson.approval === 'approved'
                          ? computation.finalPersonTotalsMinor[boundPerson.id] || 0
                          : computation.computedTotalMinor,
                        session.currency,
                        language
                      )}
                    </div>
                  </div>
                  <div className="text-end">
                    <span className="text-[11px] text-[var(--text-secondary)] block">
                      {t('billTotalLabel')}
                    </span>
                    <span className="text-sm font-mono tabular-nums font-bold text-[var(--text-primary)]">
                      {formatMinorMoney(computation.computedTotalMinor, session.currency, language)}
                    </span>
                  </div>
                </div>
              )}

              {/* Helper Add Item Form */}
              {canEditItems && (
                <form
                  onSubmit={handleHelperAddItem}
                  className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-3 grid grid-cols-12 gap-2"
                >
                  <input
                    type="text"
                    dir="auto"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder={t('billItemNamePlaceholder')}
                    className="col-span-5 min-w-0 min-h-[42px] px-2.5 rounded-xl bg-[var(--bg-tertiary)] text-[16px] sm:text-xs"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    dir="ltr"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    placeholder={t('billItemPricePlaceholder')}
                    className="col-span-3 min-w-0 min-h-[42px] px-2 rounded-xl bg-[var(--bg-tertiary)] text-[16px] sm:text-xs font-mono"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    dir="ltr"
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(e.target.value)}
                    placeholder={t('billItemQtyPlaceholder')}
                    className="col-span-2 min-w-0 min-h-[42px] px-1.5 rounded-xl bg-[var(--bg-tertiary)] text-[16px] sm:text-xs font-mono text-center"
                  />
                  <button
                    type="submit"
                    disabled={addingItem || !newItemName.trim() || !(Number(newItemPrice) > 0)}
                    className="col-span-2 min-h-[42px] rounded-xl bg-[var(--accent-primary)] text-[var(--text-on-accent)] flex items-center justify-center disabled:opacity-45 cursor-pointer active:scale-[0.97] transition"
                    aria-label={t('billAddItemBtn')}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </form>
              )}

              {/* Live Items List */}
              {computation && (
                <div className="space-y-2">
                  {session.items.map((item) => {
                    const lineTotal = getItemLineTotalMinor(item);
                    const isApproved = boundPerson?.approval === 'approved';
                    const myUnits =
                      boundPerson && isApproved ? Number(item.claims?.[boundPerson.id]) || 0 : 0;
                    const myShare =
                      boundPerson && isApproved
                        ? computation.allocation.itemAllocations[item.id]?.[boundPerson.id] || 0
                        : 0;
                    const claimed = myUnits > 0 || myShare > 0;

                    return (
                      <div
                        key={item.id}
                        className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] px-3.5 py-2.5 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div dir="auto" className="text-sm font-bold truncate">
                            {item.name} {item.qty !== 1 ? `×${item.qty}` : ''}
                          </div>
                          <div className="text-[11px] font-mono tabular-nums text-[var(--text-secondary)]">
                            {formatMinorMoney(lineTotal, session.currency, language)}
                            {myShare > 0 && (
                              <span className="text-[var(--accent-primary)] ms-2 font-bold">
                                ({t('billYouLabel')}: {formatMinorMoney(myShare, session.currency, language)})
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.mode === 'everyone' ? (
                            <span className="px-2.5 py-1 rounded-full bg-[var(--accent-soft)] text-[var(--accent-primary)] text-[11px] font-bold">
                              {t('billModeEveryone')}
                            </span>
                          ) : (
                            canClaimOwn && (
                              <button
                                type="button"
                                onClick={() => handleToggleClaim(item)}
                                className={`min-h-[36px] px-3 rounded-xl border text-xs font-bold cursor-pointer active:scale-[0.97] transition ${
                                  claimed
                                    ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)] text-[var(--text-on-accent)]'
                                    : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                                }`}
                              >
                                {claimed ? t('billGuestMineDoneBtn') : t('billGuestMineBtn')}
                              </button>
                            )
                          )}
                          {canEditItems && (
                            <button
                              type="button"
                              onClick={() => helperDeleteItem(billId, item.id).catch(() => {})}
                              className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--status-danger)] cursor-pointer"
                              aria-label={t('billDeleteBtn')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* People Shares Summary */}
              {computation && (
                <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    {t('billSharesSummaryTitle')}
                  </h3>
                  {session.people
                    .filter((p) => p.approval === 'approved')
                    .map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[var(--bg-tertiary)]/75 text-xs"
                      >
                        <span dir="auto" className="font-bold truncate">
                          {p.avatar || '👤'} {p.name}
                          {p.paidFlag ? ' ✅' : ''}
                        </span>
                        <span className="font-mono tabular-nums font-extrabold">
                          {formatMinorMoney(
                            computation.finalPersonTotalsMinor[p.id] || 0,
                            session.currency,
                            language
                          )}
                        </span>
                      </div>
                    ))}
                </div>
              )}

              {/* Payment Info with 1-tap copy */}
              {(session.paymentInfo?.instaPay || session.paymentInfo?.wallet) && (
                <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 space-y-2">
                  <div className="text-xs font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>{t('billPaymentInfoTitle')}</span>
                  </div>
                  {session.paymentInfo?.instaPay && (
                    <button
                      type="button"
                      onClick={() => copyPaymentField(session.paymentInfo!.instaPay!, 'ipa')}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[var(--bg-tertiary)] text-xs font-mono cursor-pointer active:scale-[0.97] transition"
                    >
                      <span dir="ltr">InstaPay: {session.paymentInfo.instaPay}</span>
                      {copiedPayField === 'ipa' ? (
                        <Check className="w-4 h-4 text-[var(--status-success)]" />
                      ) : (
                        <Copy className="w-4 h-4 text-[var(--accent-primary)]" />
                      )}
                    </button>
                  )}
                  {session.paymentInfo?.wallet && (
                    <button
                      type="button"
                      onClick={() => copyPaymentField(session.paymentInfo!.wallet!, 'wallet')}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[var(--bg-tertiary)] text-xs font-mono cursor-pointer active:scale-[0.97] transition"
                    >
                      <span dir="ltr">Wallet: {session.paymentInfo.wallet}</span>
                      {copiedPayField === 'wallet' ? (
                        <Check className="w-4 h-4 text-[var(--status-success)]" />
                      ) : (
                        <Copy className="w-4 h-4 text-[var(--accent-primary)]" />
                      )}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};
