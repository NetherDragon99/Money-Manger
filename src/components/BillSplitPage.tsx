import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  History,
  PlusCircle,
  Radio,
  Share2,
  Trash2,
  WifiOff,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { navigateBack } from '../context/NavigationContext';
import { BillExtra, BillItem, BillPerson, BillSession, ExpenseBudgetPool } from '../types';
import { computeBill, formatMinorMoney, generateBillId } from '../utils/billSplitEngine';
import {
  cleanupExpiredCloudBillsClientSide,
  createNewBillSession,
  deleteBillSession,
  flushBillSplitPersist,
  getActiveBillDraft,
  getBillSessionById,
  hydrateBillSplitFromIndexedDB,
  loadBillSplitBundle,
  saveBillSession,
  saveDefaultPaymentInfo,
} from '../utils/billSplitStore';
import {
  getLiveBillShareUrl,
  publishOrSyncBillToCloud,
  revokeOrDeleteLiveBill,
  subscribeToLiveBillAsOwner,
} from '../utils/billSplitCloud';
import { BillPeopleBar } from './billSplit/BillPeopleBar';
import { BillReconcileBar } from './billSplit/BillReconcileBar';
import { BillItemsEditor } from './billSplit/BillItemsEditor';
import { BillExtrasSheet } from './billSplit/BillExtrasSheet';
import { BillSettleAndDoneSheet } from './billSplit/BillSettleAndDoneSheet';
import { BillShareSheet } from './billSplit/BillShareSheet';
import { BillHistorySheet } from './billSplit/BillHistorySheet';
import { BillScanOcrModal } from './billSplit/BillScanOcrModal';
import { BillLiveSheet } from './billSplit/BillLiveSheet';

export const BillSplitPage: React.FC = () => {
  const {
    activeBillSplitId,
    closeBillSplit,
    settings,
    accounts,
    categories,
    transactions,
    addTransaction,
    updateTransaction,
    openEmojiPicker,
    showConfirm,
    showToast,
    t,
  } = useApp();

  const language = settings.language === 'ar' ? 'ar' : 'en';
  const isAr = language === 'ar';
  const appTheme: 'dark' | 'light' =
    typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light'
      ? 'light'
      : 'dark';

  const makeFreshSession = useCallback((): BillSession => {
    const bundle = loadBillSplitBundle();
    return createNewBillSession({
      ownerName: settings.userProfile?.name || (isAr ? 'أنا' : 'Me'),
      ownerAvatar: settings.userProfile?.avatarEmoji || '👤',
      ownerUid: settings.userProfile?.uid,
      ownerNumericId: settings.userProfile?.numericId,
      currency: settings.currencySymbol || '£',
      defaultPaymentInfo: bundle.defaultPaymentInfo,
    });
  }, [
    settings.userProfile?.name,
    settings.userProfile?.avatarEmoji,
    settings.userProfile?.uid,
    settings.userProfile?.numericId,
    settings.currencySymbol,
    isAr,
  ]);

  const [session, setSession] = useState<BillSession>(() => {
    if (activeBillSplitId) {
      const existing = getBillSessionById(activeBillSplitId);
      if (existing) return existing;
    }
    const draft = getActiveBillDraft();
    if (draft) return draft;
    return makeFreshSession();
  });

  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareFocusPersonId, setShareFocusPersonId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSaveSheetOpen, setIsSaveSheetOpen] = useState(false);
  const [isOcrOpen, setIsOcrOpen] = useState(false);
  const [isLiveSheetOpen, setIsLiveSheetOpen] = useState(false);
  const [isNewBillConfirmOpen, setIsNewBillConfirmOpen] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const hasInteractedRef = useRef(false);
  const isApplyingRemoteRef = useRef(false);

  // Sync if activeBillSplitId changes while mounted
  useEffect(() => {
    if (!activeBillSplitId) return;
    const found = getBillSessionById(activeBillSplitId);
    if (found && found.id !== session.id) {
      setSession(found);
    }
  }, [activeBillSplitId]);

  // Hydrate from IndexedDB on mount + run client-side 30-day cloud cleanup check
  useEffect(() => {
    let mounted = true;
    hydrateBillSplitFromIndexedDB()
      .then((hydrated) => {
        if (!mounted || !hydrated) return;
        if (activeBillSplitId) {
          const found = hydrated.sessions.find((s) => s.id === activeBillSplitId);
          if (found) setSession(found);
        }
      })
      .catch(() => {});

    cleanupExpiredCloudBillsClientSide(revokeOrDeleteLiveBill).catch(() => {});

    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      mounted = false;
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      flushBillSplitPersist();
    };
  }, []);

  // Debounced auto-save draft whenever session changes
  useEffect(() => {
    if (!hasInteractedRef.current) return;
    const shouldPersist =
      session.items.length > 0 ||
      session.people.length > 1 ||
      session.title.trim() !== '' ||
      session.extras.length > 0 ||
      session.statedTotalMinor !== undefined ||
      session.status === 'settled' ||
      Boolean(session.live?.enabled);
    if (shouldPersist) {
      saveBillSession(session, {
        asActiveDraft: session.status !== 'settled',
        immediate: false,
      });
    }
    if (session.paymentInfo && (session.paymentInfo.instaPay || session.paymentInfo.wallet)) {
      saveDefaultPaymentInfo(session.paymentInfo);
    }
  }, [session]);

  // Owner Live RTDB Sync: publish edits (debounced 500ms) + listen to remote guest updates
  useEffect(() => {
    if (!session.live?.enabled || isOffline) return;

    if (isApplyingRemoteRef.current) {
      isApplyingRemoteRef.current = false;
      return;
    }

    const timer = setTimeout(() => {
      setIsCloudSyncing(true);
      publishOrSyncBillToCloud(session)
        .catch(() => {})
        .finally(() => setIsCloudSyncing(false));
    }, 450);

    return () => clearTimeout(timer);
  }, [session, isOffline]);

  useEffect(() => {
    if (!session.live?.enabled || isOffline) return;
    const billId = session.id;
    const unsub = subscribeToLiveBillAsOwner(billId, (patch) => {
      isApplyingRemoteRef.current = true;
      setSession((prev) => {
        if (prev.id !== billId) return prev;
        let nextPeople = prev.people;
        if (patch.people) {
          nextPeople = patch.people;
        }
        let nextItems = prev.items;
        if (patch.items) {
          const prevClaimsById = new Map(prev.items.map((it) => [it.id, it.claims || {}]));
          nextItems = patch.items.map((it) => ({
            ...it,
            claims: prevClaimsById.get(it.id) || it.claims || {},
          }));
        }
        if (patch.claims) {
          nextItems = nextItems.map((it) => ({
            ...it,
            claims: patch.claims![it.id] ? { ...patch.claims![it.id] } : {},
          }));
        }
        return {
          ...prev,
          people: nextPeople,
          items: nextItems,
        };
      });
    });
    return () => unsub();
  }, [session.id, session.live?.enabled, isOffline]);

  // ESC closes New Bill Confirm Modal
  useEffect(() => {
    if (!isNewBillConfirmOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsNewBillConfirmOpen(false);
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [isNewBillConfirmOpen]);

  const updateSession = useCallback((updater: (prev: BillSession) => BillSession) => {
    hasInteractedRef.current = true;
    setSession((prev) => {
      const next = updater(prev);
      return { ...next, updatedAt: Date.now() };
    });
  }, []);

  const computation = useMemo(() => computeBill(session), [session]);

  const existingLinkedTx = useMemo(() => {
    if (!session.linkedTransactionId) return null;
    return transactions.find((tx) => tx.id === session.linkedTransactionId) || null;
  }, [session.linkedTransactionId, transactions]);

  const hasActiveUnsavedWork =
    session.status !== 'settled' &&
    (session.items.length > 0 ||
      session.people.length > 1 ||
      session.title.trim() !== '' ||
      session.extras.length > 0 ||
      session.statedTotalMinor !== undefined);

  const resetToBrandNewSession = () => {
    flushBillSplitPersist();
    hasInteractedRef.current = false;
    setSession(makeFreshSession());
  };

  const handleNewBillButtonClick = () => {
    if (hasActiveUnsavedWork) {
      setIsNewBillConfirmOpen(true);
      return;
    }
    resetToBrandNewSession();
  };

  const handleSaveDraftAndStartNew = () => {
    saveBillSession(session, { asActiveDraft: false, immediate: true });
    setIsNewBillConfirmOpen(false);
    resetToBrandNewSession();
    showToast(isAr ? 'تم حفظ المسودة في السجل' : 'Draft saved to history', 'success');
  };

  const handleDiscardAndStartNew = () => {
    const oldId = session.id;
    const wasLive = Boolean(session.live?.enabled);
    deleteBillSession(oldId);
    if (wasLive && !isOffline) {
      revokeOrDeleteLiveBill(oldId).catch(() => {});
    }
    setIsNewBillConfirmOpen(false);
    resetToBrandNewSession();
  };

  const handleAddPerson = (person: BillPerson) => {
    updateSession((prev) => ({
      ...prev,
      people: [...prev.people, person],
    }));
  };

  const handleAddMultiplePeople = (persons: BillPerson[]) => {
    updateSession((prev) => ({
      ...prev,
      people: [...prev.people, ...persons],
    }));
  };

  const handleUpdatePerson = (personId: string, patch: Partial<BillPerson>) => {
    updateSession((prev) => ({
      ...prev,
      people: prev.people.map((p) => (p.id === personId ? { ...p, ...patch } : p)),
    }));
  };

  const handleRemovePerson = (personId: string) => {
    updateSession((prev) => ({
      ...prev,
      people: prev.people.filter((p) => p.id !== personId),
      items: prev.items.map((it) => {
        const nextClaims = { ...(it.claims || {}) };
        delete nextClaims[personId];
        const nextExact = { ...(it.exactAmountsMinor || {}) };
        delete nextExact[personId];
        return {
          ...it,
          claims: nextClaims,
          equalAmong: (it.equalAmong || []).filter((id) => id !== personId),
          exactAmountsMinor: nextExact,
        };
      }),
      extras: prev.extras.map((ex) => {
        const nextCustom = { ...(ex.customAmountsMinor || {}) };
        delete nextCustom[personId];
        return {
          ...ex,
          exemptPersonIds: ex.exemptPersonIds.filter((id) => id !== personId),
          customAmountsMinor: nextCustom,
        };
      }),
      payers: prev.payers.filter((p) => p.personId !== personId),
    }));
  };

  const handleAddItem = (item: BillItem) => {
    updateSession((prev) => ({
      ...prev,
      items: [...prev.items, item],
    }));
  };

  const handleUpdateItem = (itemId: string, patch: Partial<BillItem>) => {
    updateSession((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
    }));
  };

  const handleRemoveItem = (itemId: string) => {
    updateSession((prev) => ({
      ...prev,
      items: prev.items.filter((it) => it.id !== itemId),
    }));
  };

  const handleReorderItems = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
      updateSession((prev) => {
        if (fromIndex >= prev.items.length || toIndex >= prev.items.length) return prev;
        const copy = [...prev.items];
        const [moved] = copy.splice(fromIndex, 1);
        copy.splice(toIndex, 0, moved);
        return { ...prev, items: copy };
      });
    },
    [updateSession]
  );

  const handleApplyParsedReceipt = (data: {
    items: BillItem[];
    extras: BillExtra[];
    statedTotalMinor?: number;
    title?: string;
  }) => {
    updateSession((prev) => ({
      ...prev,
      title: prev.title.trim() ? prev.title : data.title || prev.title,
      items: [...prev.items, ...data.items],
      extras: [...prev.extras, ...data.extras],
      statedTotalMinor: data.statedTotalMinor ?? prev.statedTotalMinor,
    }));
    showToast(
      isAr ? `تمت إضافة ${data.items.length} صنف` : `Added ${data.items.length} items`,
      'success'
    );
  };

  const handleAddExtra = (extra: BillExtra) => {
    updateSession((prev) => ({
      ...prev,
      extras: [...prev.extras, extra],
    }));
  };

  const handleUpdateExtra = (extraId: string, patch: Partial<BillExtra>) => {
    updateSession((prev) => ({
      ...prev,
      extras: prev.extras.map((ex) => (ex.id === extraId ? { ...ex, ...patch } : ex)),
    }));
  };

  const handleRemoveExtra = (extraId: string) => {
    updateSession((prev) => ({
      ...prev,
      extras: prev.extras.filter((ex) => ex.id !== extraId),
    }));
  };

  const handleDoneButtonClick = () => {
    if (!computation.reconcile.canFinalize) {
      const reasons = computation.reconcile.blockingReasons;
      if (reasons.includes('no_items')) {
        showToast(t('billBlockedNoItems'), 'error');
      } else if (reasons.includes('unassigned_items')) {
        showToast(t('billBlockedUnassigned'), 'error');
      } else if (reasons.includes('exact_mismatch')) {
        showToast(t('billBlockedExactMismatch'), 'error');
      } else if (reasons.includes('total_mismatch')) {
        showToast(t('billBlockedMismatch'), 'error');
      }
      return;
    }

    if (existingLinkedTx) {
      const oldMinor = Math.round(existingLinkedTx.amount * 100);
      const newMinor = computation.settlement.recommendedExpenseMinor;
      const settledSession: BillSession = {
        ...session,
        status: 'settled',
        settledAt: session.settledAt || Date.now(),
        updatedAt: Date.now(),
      };
      setSession(settledSession);
      saveBillSession(settledSession, { asActiveDraft: false, immediate: true });

      if (oldMinor !== newMinor) {
        const promptMsg = t('billSyncLinkedTxPrompt')
          .replace('{oldAmt}', formatMinorMoney(oldMinor, session.currency, language))
          .replace('{newAmt}', formatMinorMoney(newMinor, session.currency, language));
        showConfirm({
          title: t('billUpdateHeroBtn'),
          message: promptMsg,
          confirmText: t('updateTransaction'),
        }).then((confirmed) => {
          if (confirmed) {
            updateTransaction({
              ...existingLinkedTx,
              amount: newMinor / 100,
              description: `${isAr ? 'تقسيم:' : 'Bill Split:'} ${settledSession.title.trim() || t('billDefaultTitle')}`,
              billSplit: {
                id: settledSession.id,
                title: settledSession.title.trim() || t('billDefaultTitle'),
                myShareMinor: computation.settlement.ownerShareMinor,
                paidTotalMinor: newMinor,
              },
            });
          }
          showToast(t('billSavedAndLinkedToast'), 'success');
        });
      } else {
        showToast(t('billSavedAndLinkedToast'), 'success');
      }
      return;
    }

    setIsSaveSheetOpen(true);
  };

  const handleConfirmSaveExpense = async (params: {
    accountId: string;
    categoryId: string;
    budgetPool: ExpenseBudgetPool;
    amountMajor: number;
    myShareMinor: number;
    date: string;
    time: string;
  }) => {
    const cleanTitle = session.title.trim() || t('billDefaultTitle');
    const selectedCat = categories.find((c) => c.id === params.categoryId);
    const txId = addTransaction({
      type: 'expense',
      amount: Math.max(0, params.amountMajor),
      date: params.date,
      time: params.time,
      accountId: params.accountId,
      categoryId: params.categoryId || undefined,
      categoryName: selectedCat?.name,
      categoryIcon: selectedCat?.icon,
      budgetPool: params.budgetPool,
      description: `${isAr ? 'تقسيم:' : 'Bill Split:'} ${cleanTitle}`,
      billSplit: {
        id: session.id,
        title: cleanTitle,
        myShareMinor: params.myShareMinor,
        paidTotalMinor: Math.round(params.amountMajor * 100),
      },
    });

    const settledSession: BillSession = {
      ...session,
      title: cleanTitle,
      status: 'settled',
      settledAt: Date.now(),
      updatedAt: Date.now(),
      linkedTransactionId: txId,
    };
    setSession(settledSession);
    saveBillSession(settledSession, { asActiveDraft: false, immediate: true });
    setIsSaveSheetOpen(false);
    showToast(t('billSavedAndLinkedToast'), 'success');
  };

  const handleBack = () => {
    flushBillSplitPersist();
    if (window.history.length > 1) {
      navigateBack();
    } else {
      closeBillSplit();
    }
  };

  const handleToggleLive = async (enabled: boolean) => {
    updateSession((prev) => ({
      ...prev,
      live: {
        enabled,
        defaultPermission: prev.live?.defaultPermission || 'view_only',
        autoAccept: Boolean(prev.live?.autoAccept),
        linkActive: enabled ? true : Boolean(prev.live?.linkActive ?? true),
      },
    }));
  };

  const handleRegenerateLiveLink = async () => {
    const oldId = session.id;
    const nextId = `bill_${generateBillId()}`;
    await revokeOrDeleteLiveBill(oldId);
    deleteBillSession(oldId);
    const regenerated: BillSession = {
      ...session,
      id: nextId,
      updatedAt: Date.now(),
      live: {
        enabled: true,
        defaultPermission: session.live?.defaultPermission || 'view_only',
        autoAccept: Boolean(session.live?.autoAccept),
        linkActive: true,
      },
    };
    hasInteractedRef.current = true;
    setSession(regenerated);
    saveBillSession(regenerated, { asActiveDraft: regenerated.status !== 'settled', immediate: true });
  };

  const pendingCount = session.people.filter((p) => p.approval === 'pending').length;
  const liveActive = Boolean(session.live?.enabled && session.live?.linkActive);
  const liveShareUrl = liveActive ? getLiveBillShareUrl(session.id) : undefined;

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="w-full h-[100dvh] flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden"
    >
      {/* Offline Banner Pill (z-500) */}
      {isOffline && (
        <div className="fixed top-2 inset-x-0 z-[500] flex justify-center pointer-events-none px-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-strong)] shadow-lg text-[11px] font-bold text-[var(--text-secondary)]">
            <WifiOff className="w-3.5 h-3.5 text-[var(--status-warning)]" />
            <span>{t('billOfflineSaved')}</span>
          </div>
        </div>
      )}

      {/* Sticky Safe-Area Header */}
      <header
        className="shrink-0 z-[100] bg-[var(--bg-elevated)] backdrop-blur-[12px] border-b border-[var(--border-subtle)] px-3 sm:px-4 pb-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              type="button"
              onClick={handleBack}
              aria-label="Back"
              className="min-w-[44px] min-h-[44px] w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-5 h-5 rtl:scale-x-[-1]" />
            </button>

            <button
              type="button"
              onClick={() =>
                openEmojiPicker((emoji: string) =>
                  updateSession((prev) => ({ ...prev, icon: emoji }))
                )
              }
              aria-label="Change bill icon"
              className="w-10 h-10 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] flex items-center justify-center text-xl shrink-0 cursor-pointer"
            >
              {session.icon || '🧾'}
            </button>

            <div className="min-w-0 flex-1">
              <input
                type="text"
                dir="auto"
                value={session.title}
                onChange={(e) => updateSession((prev) => ({ ...prev, title: e.target.value }))}
                placeholder={t('billTitlePlaceholder')}
                className="w-full min-w-0 bg-transparent text-[16px] sm:text-base font-extrabold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none truncate"
              />
              <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)]">
                <span>{session.status === 'settled' ? t('billPaidBadge') : t('billDraftBadge')}</span>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => setIsLiveSheetOpen(true)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold cursor-pointer transition ${
                    liveActive
                      ? 'bg-[var(--status-success)]/15 text-[var(--status-success)]'
                      : 'bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                  }`}
                >
                  <Radio className={`w-2.5 h-2.5 ${liveActive ? 'animate-pulse' : ''}`} />
                  <span>{liveActive ? t('billLiveActiveBadge') : t('billLiveHeaderPill')}</span>
                  {pendingCount > 0 && (
                    <span className="px-1 rounded-full bg-[var(--status-warning)] text-white text-[9px]">
                      {pendingCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setIsHistoryOpen(true)}
              aria-label={t('billHistoryBtn')}
              title={t('billHistoryBtn')}
              className="min-w-[44px] min-h-[44px] w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <History className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={handleNewBillButtonClick}
              aria-label={t('billNewSession')}
              title={t('billNewSession')}
              className="min-w-[44px] min-h-[44px] w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[var(--bg-tertiary)] text-[var(--accent-primary)] cursor-pointer"
            >
              <PlusCircle className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Scrollable Content */}
      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 py-4">
        <div className="max-w-3xl mx-auto space-y-4 pb-8">
          <BillPeopleBar
            people={session.people}
            perPersonTotalsMinor={computation.finalPersonTotalsMinor}
            currency={session.currency}
            language={language}
            myNumericId={settings.userProfile?.numericId}
            onAddPerson={handleAddPerson}
            onAddMultiplePeople={handleAddMultiplePeople}
            onUpdatePerson={handleUpdatePerson}
            onRemovePerson={handleRemovePerson}
            showConfirm={showConfirm}
            showToast={showToast}
            t={t}
          />

          <BillReconcileBar
            session={session}
            reconcile={computation.reconcile}
            currency={session.currency}
            language={language}
            unassignedCount={computation.allocation.unassignedItemIds.length}
            unitMismatchCount={computation.allocation.unitMismatchItems.length}
            exactMismatchCount={computation.allocation.exactMismatchItems.length}
            onUpdateSession={updateSession}
            t={t}
          />

          <BillItemsEditor
            items={session.items}
            people={session.people}
            itemAllocations={computation.allocation.itemAllocations}
            unassignedItemIds={computation.allocation.unassignedItemIds}
            exactMismatchItems={computation.allocation.exactMismatchItems}
            currency={session.currency}
            language={language}
            onAddItem={handleAddItem}
            onUpdateItem={handleUpdateItem}
            onRemoveItem={handleRemoveItem}
            onReorderItems={handleReorderItems}
            onApplyParsedReceipt={handleApplyParsedReceipt}
            onOpenOcrModal={() => setIsOcrOpen(true)}
            t={t}
          />

          <BillExtrasSheet
            extras={session.extras}
            breakdown={computation.extras.perExtraBreakdown}
            people={session.people}
            currency={session.currency}
            language={language}
            onAddExtra={handleAddExtra}
            onUpdateExtra={handleUpdateExtra}
            onRemoveExtra={handleRemoveExtra}
            t={t}
          />

          <BillSettleAndDoneSheet
            session={session}
            computation={computation}
            accounts={accounts}
            categories={categories}
            feeSettings={settings.transferFeeSettings}
            currency={session.currency}
            language={language}
            existingLinkedTx={existingLinkedTx}
            onUpdateSession={updateSession}
            onOpenPersonShare={(pid) => {
              setShareFocusPersonId(pid);
              setIsShareOpen(true);
            }}
            onConfirmSaveExpense={handleConfirmSaveExpense}
            isSaveSheetOpen={isSaveSheetOpen}
            onCloseSaveSheet={() => setIsSaveSheetOpen(false)}
            t={t}
          />
        </div>
      </main>

      {/* Bottom Sticky Action Dock */}
      <footer
        className="shrink-0 z-[100] bg-[var(--bg-elevated)] backdrop-blur-[12px] border-t border-[var(--border-subtle)] px-4 pt-3"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-3xl mx-auto flex items-center gap-2.5">
          <button
            type="button"
            disabled={session.items.length === 0}
            onClick={() => {
              setShareFocusPersonId(null);
              setIsShareOpen(true);
            }}
            className="min-h-[48px] px-4 rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border-strong)] text-sm font-bold text-[var(--text-primary)] flex items-center justify-center gap-2 disabled:opacity-45 cursor-pointer shrink-0"
          >
            <Share2 className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>{t('billShareBtn')}</span>
          </button>

          <button
            type="button"
            onClick={handleDoneButtonClick}
            className={`flex-1 min-h-[48px] px-5 rounded-2xl text-sm font-extrabold text-white flex items-center justify-center gap-2 shadow-lg transition cursor-pointer ${
              computation.reconcile.canFinalize
                ? 'bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)]'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-subtle)] shadow-none'
            }`}
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>
              {existingLinkedTx ? t('billUpdateHeroBtn') : t('billDoneHeroBtn')}
            </span>
            <span className="font-mono tabular-nums opacity-90">
              ({formatMinorMoney(computation.settlement.recommendedExpenseMinor, session.currency, language)})
            </span>
          </button>
        </div>
      </footer>

      {/* New Bill Safe Confirmation Modal */}
      {isNewBillConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setIsNewBillConfirmOpen(false)}
          className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-[12px] p-0 sm:p-4 overscroll-contain"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-sm rounded-t-[22px] sm:rounded-[22px] bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-5 space-y-4 shadow-2xl modal-container-anim"
            style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
          >
            <div className="w-10 h-1 rounded-full bg-[var(--border-strong)] mx-auto sm:hidden" />
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">{t('billNewModalTitle')}</h3>
              <button
                type="button"
                onClick={() => setIsNewBillConfirmOpen(false)}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {t('billNewModalDesc')}
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleSaveDraftAndStartNew}
                className="w-full min-h-[46px] px-4 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-sm font-bold cursor-pointer"
              >
                {t('billNewSaveDraftBtn')}
              </button>
              <button
                type="button"
                onClick={handleDiscardAndStartNew}
                className="w-full min-h-[46px] px-4 rounded-xl bg-[var(--status-danger)]/15 text-[var(--status-danger)] border border-[var(--status-danger)]/35 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{t('billNewDiscardBtn')}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsNewBillConfirmOpen(false)}
                className="w-full min-h-[44px] px-4 rounded-xl bg-[var(--bg-tertiary)] text-[var(--text-secondary)] text-xs font-bold cursor-pointer"
              >
                {t('billNewCancelBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Sheet (Whole / Selected / Separate / Reminders + Copy/Download/Share Image) */}
      <BillShareSheet
        isOpen={isShareOpen}
        initialFocusPersonId={shareFocusPersonId}
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

      {/* History & Drafts Sheet */}
      <BillHistorySheet
        isOpen={isHistoryOpen}
        currentSessionId={session.id}
        language={language}
        onClose={() => setIsHistoryOpen(false)}
        onSelectSession={(selected) => {
          hasInteractedRef.current = false;
          setSession(selected);
        }}
        showConfirm={showConfirm}
        t={t}
      />

      {/* Camera Receipt AI Scanner */}
      <BillScanOcrModal
        isOpen={isOcrOpen}
        currency={session.currency}
        language={language}
        onClose={() => setIsOcrOpen(false)}
        onApply={handleApplyParsedReceipt}
        t={t}
      />

      {/* Live Collaboration & Permissions Sheet */}
      <BillLiveSheet
        isOpen={isLiveSheetOpen}
        session={session}
        language={language}
        isSyncing={isCloudSyncing}
        onClose={() => setIsLiveSheetOpen(false)}
        onToggleLive={handleToggleLive}
        onUpdateLiveConfig={(patch) =>
          updateSession((prev) => ({
            ...prev,
            live: {
              enabled: Boolean(prev.live?.enabled),
              defaultPermission: prev.live?.defaultPermission || 'view_only',
              autoAccept: Boolean(prev.live?.autoAccept),
              linkActive: prev.live?.linkActive ?? true,
              ...patch,
            },
          }))
        }
        onApprovePerson={(pid) => handleUpdatePerson(pid, { approval: 'approved' })}
        onRejectPerson={(pid) => handleRemovePerson(pid)}
        onRegenerateLink={handleRegenerateLiveLink}
        showConfirm={showConfirm}
        showToast={showToast}
        t={t}
      />
    </div>
  );
};
