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
  Pencil,
  Plus,
  Radio,
  Share2,
  Shield,
  UserCheck,
  Wallet,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { BillItem, BillPerson, BillSession } from '../types';
import {
  computeBill,
  formatMinorMoney,
  generateBillId,
  getEffectivePersonPermission,
  toMinor,
} from '../utils/billSplitEngine';
import {
  getLiveBillShareUrl,
  guestRenameSelf,
  guestRequestJoin,
  guestToggleItemClaim,
  helperDeleteItem,
  helperUpsertItem,
  solvUserBindSelf,
  subscribeToLiveBillAsGuest,
} from '../utils/billSplitCloud';
import { auth, ensureFirebaseAuth, getCachedAuthUser } from '../utils/firebase';
import { BillPersonAvatar } from './billSplit/BillPersonAvatar';
import { BillPersonBreakdownModal } from './billSplit/BillPersonBreakdownModal';
import { BillReadOnlyItemsAndExtras } from './billSplit/BillReadOnlyItemsAndExtras';
import { BillShareSheet } from './billSplit/BillShareSheet';
import { BillGuestSaveExpenseSheet } from './billSplit/BillGuestSaveExpenseSheet';

interface BillSplitGuestViewProps {
  billId: string;
  onExit: () => void;
}

export const BillSplitGuestView: React.FC<BillSplitGuestViewProps> = ({ billId, onExit }) => {
  const {
    accounts,
    categories,
    transactions,
    authUser,
    settings,
    addTransaction,
    openBillSplit,
    showToast,
    t,
  } = useApp();

  const language = settings.language === 'ar' ? 'ar' : 'en';
  const isAr = language === 'ar';
  const appTheme: 'dark' | 'light' =
    typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light'
      ? 'light'
      : 'dark';

  const [session, setSession] = useState<BillSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [myUid, setMyUid] = useState<string>(auth.currentUser?.uid || '');

  // Join / Rename states
  const [joinName, setJoinName] = useState('');
  const [joining, setJoining] = useState(false);
  const [isEditingMyName, setIsEditingMyName] = useState(false);
  const [myNameDraft, setMyNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [copiedPayField, setCopiedPayField] = useState<string | null>(null);

  // Helper add item inputs
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemQty, setNewItemQty] = useState('1');
  const [addingItem, setAddingItem] = useState(false);

  // Person Breakdown / Multi-Person Total / Share / Save Transaction sheets
  const [inspectingPersonId, setInspectingPersonId] = useState<string | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareSelectedPersonIds, setShareSelectedPersonIds] = useState<string[] | null>(null);
  const [isSaveTxOpen, setIsSaveTxOpen] = useState(false);

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

  const myNumericId = settings.userProfile?.numericId;

  // Detect if the bill owner opened their own `?bill=` link: NEVER grant owner/helper bypass here!
  const isOwnerPreviewing = Boolean(
    session &&
      myUid &&
      (session.ownerUid === myUid ||
        session.people.some((p) => p.kind === 'owner' && p.boundUid === myUid))
  );

  // Guest identity strictly matches NON-OWNER members only so `?bill=...` is 100% a guest view
  const boundPerson: BillPerson | null = useMemo(() => {
    if (!session || !myUid || isOwnerPreviewing) return null;
    return (
      session.people.find((p) => p.kind !== 'owner' && p.boundUid === myUid) ||
      (myNumericId
        ? session.people.find((p) => p.kind === 'solv_user' && p.numericId === myNumericId) || null
        : null)
    );
  }, [session, myUid, myNumericId, isOwnerPreviewing]);

  useEffect(() => {
    if (boundPerson) {
      setMyNameDraft(boundPerson.name);
    }
  }, [boundPerson?.id, boundPerson?.name]);

  // If a pre-added 16-digit solv user opens the link before their UID was bound on the row, bind it cleanly
  useEffect(() => {
    if (!session || !myUid || !boundPerson) return;
    if (
      boundPerson.kind === 'solv_user' &&
      !boundPerson.boundUid &&
      myNumericId === boundPerson.numericId
    ) {
      solvUserBindSelf(billId, boundPerson, myUid).catch(() => {});
    }
  }, [billId, session, myUid, myNumericId, boundPerson]);

  // Strict guest permission resolution (owner preview sees exact default guest permission!)
  const effectivePermission = useMemo(() => {
    if (!session) return 'view_only';
    if (isOwnerPreviewing) return session.live?.defaultPermission || 'view_only';
    if (!boundPerson || boundPerson.approval !== 'approved') return 'view_only';
    return getEffectivePersonPermission(session, boundPerson);
  }, [session, boundPerson, isOwnerPreviewing]);

  const isLinkActive = Boolean(session?.live?.linkActive);
  const isDeletedGrace = Boolean(session?.deletedByOwner);
  const isSettled = session?.status === 'settled';
  const isBillOpen =
    !isDeletedGrace && (session?.status === 'open' || session?.status === 'draft');

  // Interactive claiming/adding ONLY for an approved non-owner guest whose effective permission allows it
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

  // External visitors (not owner preview) must enter their name first before viewing the bill
  const mustEnterNameFirst = Boolean(
    session && isLinkActive && !boundPerson && !isOwnerPreviewing && !isDeletedGrace
  );

  // Show "Save to My Transactions" when the visitor uses solv on this device (signed in, installed PWA, or existing local data)
  const hasSolvAppOnDevice = useMemo(() => {
    if (authUser || getCachedAuthUser() || transactions.length > 0) return true;
    try {
      if (
        typeof window !== 'undefined' &&
        (window.matchMedia?.('(display-mode: standalone)')?.matches ||
          localStorage.getItem('pwa_finance_accounts') !== null ||
          localStorage.getItem('pwa_finance_transactions') !== null)
      ) {
        return true;
      }
    } catch {}
    return false;
  }, [authUser, transactions.length]);

  const inspectingPerson = useMemo(
    () => (session && inspectingPersonId ? session.people.find((p) => p.id === inspectingPersonId) || null : null),
    [session, inspectingPersonId]
  );

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

  const handleSaveMyName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boundPerson) return;
    const cleaned = myNameDraft.trim().slice(0, 50);
    if (!cleaned) return;
    if (cleaned === boundPerson.name) {
      setIsEditingMyName(false);
      return;
    }
    setSavingName(true);
    try {
      const user = await ensureFirebaseAuth();
      if (!user?.uid) throw new Error('Auth unavailable');
      await guestRenameSelf(billId, boundPerson, user.uid, cleaned);
      setIsEditingMyName(false);
      showToast(t('updatedSuccess'), 'success');
    } catch {
      showToast(t('billLiveActionDenied'), 'error');
    } finally {
      setSavingName(false);
    }
  };

  const handleSetClaimUnits = async (item: BillItem, nextUnits: number) => {
    if (!boundPerson || !canClaimOwn || item.mode === 'everyone' || item.mode === 'exact') return;
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

  const liveShareUrl = session && isLinkActive ? getLiveBillShareUrl(session.id) : undefined;

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

          {/* Effective Guest Permission indicator pill */}
          {session && isLinkActive && !mustEnterNameFirst && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[11px] font-bold text-[var(--text-secondary)] shrink-0">
              {effectivePermission === 'helper' && isBillOpen ? (
                <>
                  <Shield className="w-3 h-3 text-[var(--accent-primary)]" />
                  <span>{t('billPermHelperTitle')}</span>
                </>
              ) : effectivePermission === 'claim_own' && isBillOpen ? (
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
              {/* Owner Preview Banner (when the bill owner opened their own ?bill=... link) */}
              {isOwnerPreviewing && (
                <div className="rounded-2xl bg-[var(--accent-soft)] border border-[var(--accent-primary)]/40 p-3.5 flex items-center justify-between gap-2.5 flex-wrap">
                  <span className="text-xs font-bold text-[var(--text-primary)]">
                    {t('billOwnerPreviewBanner')}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const targetId = session.id;
                      onExit();
                      openBillSplit(targetId);
                    }}
                    className="min-h-[36px] px-3 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--text-on-accent)] text-xs font-bold cursor-pointer active:scale-[0.97] transition shrink-0"
                  >
                    {t('billOwnerBackToEditBtn')}
                  </button>
                </div>
              )}

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

              {/* Pending Approval Banner */}
              {boundPerson?.approval === 'pending' && !isDeletedGrace && (
                <div className="rounded-2xl bg-[var(--status-warning)]/12 border border-[var(--status-warning)]/40 p-3.5 flex items-start gap-2.5 text-xs font-bold text-[var(--status-warning)]">
                  <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div>{t('billLivePendingToast')}</div>
                    <div className="font-medium text-[var(--text-secondary)]">
                      {t('billGuestPendingReadOnly')}
                    </div>
                  </div>
                </div>
              )}

              {/* Guest's Own Name + Personal Share KPI Card (with anytime pencil rename!) */}
              {computation && (
                <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 space-y-2.5">
                  {boundPerson && isEditingMyName && !isDeletedGrace ? (
                    <form onSubmit={handleSaveMyName} className="flex items-center gap-2">
                      <input
                        type="text"
                        dir="auto"
                        autoFocus
                        maxLength={50}
                        value={myNameDraft}
                        onChange={(e) => setMyNameDraft(e.target.value)}
                        aria-label={t('billGuestNameLabel')}
                        className="flex-1 min-w-0 min-h-[40px] px-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[16px] sm:text-xs font-bold text-[var(--text-primary)]"
                      />
                      <button
                        type="submit"
                        disabled={savingName || !myNameDraft.trim()}
                        className="min-h-[40px] px-3 rounded-xl bg-[var(--accent-primary)] text-[var(--text-on-accent)] text-xs font-bold disabled:opacity-45 cursor-pointer shrink-0 active:scale-[0.97] transition"
                      >
                        {t('billGuestSaveNameBtn')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMyNameDraft(boundPerson.name);
                          setIsEditingMyName(false);
                        }}
                        className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--bg-tertiary)] text-[var(--text-secondary)] cursor-pointer shrink-0"
                        aria-label="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </form>
                  ) : null}

                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      {boundPerson ? (
                        <div className="flex items-center gap-1.5">
                          <BillPersonAvatar
                            name={boundPerson.name}
                            avatar={boundPerson.avatar}
                            photoURL={boundPerson.photoURL}
                            size="xs"
                          />
                          <span dir="auto" className="text-xs font-extrabold text-[var(--text-primary)] truncate">
                            {boundPerson.name}
                          </span>
                          {!isDeletedGrace && (
                            <button
                              type="button"
                              onClick={() => {
                                setMyNameDraft(boundPerson.name);
                                setIsEditingMyName(true);
                              }}
                              aria-label={t('billGuestEditMyNameAria')}
                              title={t('billGuestEditMyNameAria')}
                              className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-tertiary)] cursor-pointer transition"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-[var(--text-secondary)] block">
                          {t('billTotalLabel')}
                        </span>
                      )}

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

                    <div className="text-end shrink-0">
                      <span className="text-[11px] text-[var(--text-secondary)] block">
                        {t('billTotalLabel')}
                      </span>
                      <span className="text-sm font-mono tabular-nums font-bold text-[var(--text-primary)]">
                        {formatMinorMoney(computation.computedTotalMinor, session.currency, language)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Helper Add Item Form (STRICTLY hidden unless effectivePermission === 'helper' and bill is open!) */}
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

              {/* Expandable Items + Independent Expandable Taxes/Fees/Discounts + Summary */}
              {computation && (
                <BillReadOnlyItemsAndExtras
                  session={session}
                  computation={computation}
                  currency={session.currency}
                  language={language}
                  boundPerson={boundPerson}
                  canClaimOwn={canClaimOwn}
                  canEditItems={canEditItems}
                  onSetClaimUnits={handleSetClaimUnits}
                  onDeleteItem={(itemId) => helperDeleteItem(billId, itemId).catch(() => {})}
                  onOpenPerson={(p) => setInspectingPersonId(p.id)}
                  t={t}
                />
              )}

              {/* Interactive People Shares Cards (tap any person to open breakdown + multi-person combine total!) */}
              {computation && (
                <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    {t('billSharesSummaryTitle')}
                  </h3>
                  {session.people
                    .filter((p) => p.approval === 'approved')
                    .map((p) => {
                      const eff = getEffectivePersonPermission(session, p);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setInspectingPersonId(p.id)}
                          className="w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-2xl bg-[var(--bg-tertiary)]/75 hover:bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-xs cursor-pointer active:scale-[0.98] transition"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <BillPersonAvatar
                              name={p.name}
                              avatar={p.avatar}
                              photoURL={p.photoURL}
                              size="sm"
                            />
                            <div className="min-w-0 text-start">
                              <div className="flex items-center gap-1.5">
                                <span dir="auto" className="font-bold text-[var(--text-primary)] truncate">
                                  {p.name}
                                </span>
                                {p.kind !== 'owner' && eff === 'helper' && (
                                  <Shield className="w-3 h-3 text-[var(--accent-primary)] shrink-0" />
                                )}
                                {p.kind !== 'owner' && eff === 'claim_own' && (
                                  <UserCheck className="w-3 h-3 text-[var(--accent-primary)] shrink-0" />
                                )}
                                {p.kind !== 'owner' && eff === 'view_only' && (
                                  <Eye className="w-3 h-3 text-[var(--text-tertiary)] shrink-0" />
                                )}
                                {p.paidFlag && (
                                  <Check className="w-3.5 h-3.5 text-[var(--status-success)] shrink-0 stroke-[2.5]" />
                                )}
                              </div>
                            </div>
                          </div>
                          <span className="font-mono tabular-nums font-extrabold text-[var(--text-primary)] shrink-0">
                            {formatMinorMoney(
                              computation.finalPersonTotalsMinor[p.id] || 0,
                              session.currency,
                              language
                            )}
                          </span>
                        </button>
                      );
                    })}
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

      {/* Bottom Sticky Dock: Full Share Options + Save to My Transactions (with Frozen Offline Copy) */}
      {session && computation && isLinkActive && !mustEnterNameFirst && session.items.length > 0 && (
        <footer
          className="shrink-0 z-[100] bg-[var(--bg-elevated)] backdrop-blur-[12px] border-t border-[var(--border-subtle)] px-4 pt-3"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
          <div className="max-w-2xl mx-auto flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setShareSelectedPersonIds(null);
                setIsShareOpen(true);
              }}
              className={`${
                hasSolvAppOnDevice && !isOwnerPreviewing ? 'shrink-0 px-4' : 'flex-1 px-5'
              } min-h-[48px] rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border-strong)] text-sm font-bold text-[var(--text-primary)] flex items-center justify-center gap-2 cursor-pointer active:scale-[0.97] transition`}
            >
              <Share2 className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>{t('billShareBtn')}</span>
            </button>

            {hasSolvAppOnDevice && !isOwnerPreviewing && (
              <button
                type="button"
                onClick={() => setIsSaveTxOpen(true)}
                className="flex-1 min-h-[48px] px-4 rounded-2xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--text-on-accent)] text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg cursor-pointer active:scale-[0.97] transition"
              >
                <Wallet className="w-4 h-4" />
                <span>{t('billGuestSaveTxBtn')}</span>
              </button>
            )}
          </div>
        </footer>
      )}

      {/* Person Breakdown + Multi-Person Total Calculator Sheet */}
      {session && computation && (
        <BillPersonBreakdownModal
          person={inspectingPerson}
          session={session}
          computation={computation}
          currency={session.currency}
          language={language}
          canManagePerson={false}
          onClose={() => setInspectingPersonId(null)}
          onSharePeople={(ids) => {
            setShareSelectedPersonIds(ids);
            setIsShareOpen(true);
          }}
          t={t}
        />
      )}

      {/* Full Share Sheet (same options as Admin: Whole / Selected / Separate / Reminders + Dark/Light Image) */}
      {session && computation && (
        <BillShareSheet
          isOpen={isShareOpen}
          initialSelectedPersonIds={shareSelectedPersonIds}
          session={session}
          computation={computation}
          feeSettings={settings.transferFeeSettings}
          liveUrl={liveShareUrl}
          language={language}
          appTheme={appTheme}
          onClose={() => setIsShareOpen(false)}
          showToast={showToast}
          t={t}
        />
      )}

      {/* Save to My Transactions + Permanent Frozen Offline Copy */}
      {session && computation && (
        <BillGuestSaveExpenseSheet
          isOpen={isSaveTxOpen}
          session={session}
          computation={computation}
          boundPerson={boundPerson}
          accounts={accounts}
          categories={categories}
          currency={session.currency}
          language={language}
          onClose={() => setIsSaveTxOpen(false)}
          onSaveTransaction={({
            accountId,
            categoryId,
            categoryName,
            categoryIcon,
            budgetPool,
            amountMajor,
            myShareMinor,
            snapshotSession,
          }) => {
            const now = new Date();
            const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
              now.getDate()
            ).padStart(2, '0')}`;
            const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
              now.getMinutes()
            ).padStart(2, '0')}`;
            const cleanTitle = snapshotSession.title.trim() || t('billDefaultTitle');
            const txId = addTransaction({
              type: 'expense',
              amount: Math.max(0, amountMajor),
              date: dateStr,
              time: timeStr,
              accountId,
              categoryId,
              categoryName,
              categoryIcon,
              budgetPool,
              description: `${isAr ? 'تقسيم:' : 'Bill Split:'} ${cleanTitle}`,
              billSplit: {
                id: snapshotSession.id,
                title: cleanTitle,
                myShareMinor,
                paidTotalMinor: Math.round(amountMajor * 100),
              },
            });
            // Link the frozen snapshot back to the newly created transaction for two-way deletion
            import('../utils/billSplitStore')
              .then(({ saveBillSession }) => {
                saveBillSession(
                  { ...snapshotSession, linkedTransactionId: txId },
                  { asActiveDraft: false, immediate: true }
                );
              })
              .catch(() => {});
            showToast(t('billGuestSavedSnapshotToast'), 'success');
          }}
          t={t}
        />
      )}
    </div>
  );
};
