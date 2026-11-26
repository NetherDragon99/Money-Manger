import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  History,
  PlusCircle,
  Share2,
  WifiOff,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { navigateBack } from '../context/NavigationContext';
import { BillExtra, BillItem, BillPerson, BillSession, ExpenseBudgetPool } from '../types';
import { computeBill, formatMinorMoney } from '../utils/billSplitEngine';
import {
  cleanupExpiredCloudBillsClientSide,
  createNewBillSession,
  flushBillSplitPersist,
  getActiveBillDraft,
  getBillSessionById,
  hydrateBillSplitFromIndexedDB,
  loadBillSplitBundle,
  saveBillSession,
  saveDefaultPaymentInfo,
} from '../utils/billSplitStore';
import { BillPeopleBar } from './billSplit/BillPeopleBar';
import { BillReconcileBar } from './billSplit/BillReconcileBar';
import { BillItemsEditor } from './billSplit/BillItemsEditor';
import { BillExtrasSheet } from './billSplit/BillExtrasSheet';
import { BillSettleAndDoneSheet } from './billSplit/BillSettleAndDoneSheet';
import { BillShareSheet } from './billSplit/BillShareSheet';
import { BillHistorySheet } from './billSplit/BillHistorySheet';

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
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const hasInteractedRef = useRef(false);

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

    cleanupExpiredCloudBillsClientSide().catch(() => {});

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
      session.status === 'settled';
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

  const handleStartNewSession = () => {
    flushBillSplitPersist();
    hasInteractedRef.current = false;
    setSession(makeFreshSession());
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
        return {
          ...it,
          claims: nextClaims,
          equalAmong: (it.equalAmong || []).filter((id) => id !== personId),
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

  const handleApplyParsedReceipt = (data: {
    items: BillItem[];
    extras: BillExtra[];
    statedTotalMinor?: number;
  }) => {
    updateSession((prev) => ({
      ...prev,
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
      } else if (reasons.includes('total_mismatch')) {
        showToast(t('billBlockedMismatch'), 'error');
      }
      return;
    }

    // If already linked to an existing transaction, check if paid amount changed and prompt cleanly
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
                <span className="text-[var(--accent-primary)] font-semibold">
                  {t('billLivePhase2Badge')}
                </span>
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
              onClick={handleStartNewSession}
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
          {/* People & Groups Bar */}
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

          {/* Permanent Bill Total Reconciliation Strip */}
          <BillReconcileBar
            session={session}
            reconcile={computation.reconcile}
            currency={session.currency}
            language={language}
            unassignedCount={computation.allocation.unassignedItemIds.length}
            unitMismatchCount={computation.allocation.unitMismatchItems.length}
            onUpdateSession={updateSession}
            t={t}
          />

          {/* Fast Items Editor + Paste Receipt */}
          <BillItemsEditor
            items={session.items}
            people={session.people}
            itemAllocations={computation.allocation.itemAllocations}
            unassignedItemIds={computation.allocation.unassignedItemIds}
            currency={session.currency}
            language={language}
            onAddItem={handleAddItem}
            onUpdateItem={handleUpdateItem}
            onRemoveItem={handleRemoveItem}
            onApplyParsedReceipt={handleApplyParsedReceipt}
            showToast={showToast}
            t={t}
          />

          {/* Taxes, Service, Delivery, Discounts & Exemptions */}
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

          {/* Rounding, Who Paid, Individual Breakdown & Settlement */}
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

      {/* Share Sheet (Whole / Selected / Separate / Reminders + Dark/Light Image) */}
      <BillShareSheet
        isOpen={isShareOpen}
        initialFocusPersonId={shareFocusPersonId}
        session={session}
        computation={computation}
        feeSettings={settings.transferFeeSettings}
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
    </div>
  );
};
