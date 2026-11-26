import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  SlidersHorizontal,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  Account,
  BillRounding,
  BillSession,
  Category,
  ExpenseBudgetPool,
  Transaction,
} from '../../types';
import {
  BillComputation,
  formatMinorMoney,
  fromMinor,
  toMinor,
} from '../../utils/billSplitEngine';
import { computePersonTransferFee } from '../../utils/billSplitShare';
import { TransferFeeSettings } from '../../types';
import { translations } from '../../utils/translations';

interface BillSettleAndDoneSheetProps {
  session: BillSession;
  computation: BillComputation;
  accounts: Account[];
  categories: Category[];
  feeSettings?: Partial<TransferFeeSettings> | null;
  currency: string;
  language: 'ar' | 'en';
  existingLinkedTx?: Transaction | null;
  onUpdateSession: (updater: (prev: BillSession) => BillSession) => void;
  onOpenPersonShare: (personId: string) => void;
  onConfirmSaveExpense: (params: {
    accountId: string;
    categoryId: string;
    budgetPool: ExpenseBudgetPool;
    amountMajor: number;
    myShareMinor: number;
    date: string;
    time: string;
  }) => Promise<void>;
  isSaveSheetOpen: boolean;
  onCloseSaveSheet: () => void;
  t: (key: keyof typeof translations.en) => string;
}

export const BillSettleAndDoneSheet: React.FC<BillSettleAndDoneSheetProps> = ({
  session,
  computation,
  accounts,
  categories,
  feeSettings,
  currency,
  language,
  existingLinkedTx,
  onUpdateSession,
  onOpenPersonShare,
  onConfirmSaveExpense,
  isSaveSheetOpen,
  onCloseSaveSheet,
  t,
}) => {
  const isAr = language === 'ar';
  const approvedPeople = session.people.filter((p) => p.approval === 'approved');
  const peopleById = new Map(approvedPeople.map((p) => [p.id, p]));
  const [showPaymentConfig, setShowPaymentConfig] = useState(false);

  // Save Expense Sheet States (Zero native <select>!)
  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const defaultCat =
    expenseCategories.find((c) =>
      c.name.toLowerCase().includes('dining') || c.name.includes('مطاعم')
    ) || expenseCategories[0];

  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    existingLinkedTx?.accountId || accounts[0]?.id || ''
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    existingLinkedTx?.categoryId || defaultCat?.id || ''
  );
  const [selectedPool, setSelectedPool] = useState<ExpenseBudgetPool>(
    existingLinkedTx?.budgetPool || 'outings'
  );
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [savingPhase, setSavingPhase] = useState<'idle' | 'animating' | 'done'>('idle');

  useEffect(() => {
    if (isSaveSheetOpen) {
      setSavingPhase('idle');
      setAccountDropdownOpen(false);
      setCategoryDropdownOpen(false);
      if (existingLinkedTx) {
        setSelectedAccountId(existingLinkedTx.accountId);
        if (existingLinkedTx.categoryId) setSelectedCategoryId(existingLinkedTx.categoryId);
        if (existingLinkedTx.budgetPool) setSelectedPool(existingLinkedTx.budgetPool);
      } else {
        if (!accounts.some((a) => a.id === selectedAccountId)) {
          setSelectedAccountId(accounts[0]?.id || '');
        }
        if (!expenseCategories.some((c) => c.id === selectedCategoryId)) {
          setSelectedCategoryId(defaultCat?.id || '');
        }
      }
    }
  }, [isSaveSheetOpen]);

  useEffect(() => {
    if (!isSaveSheetOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (accountDropdownOpen) setAccountDropdownOpen(false);
        else if (categoryDropdownOpen) setCategoryDropdownOpen(false);
        else onCloseSaveSheet();
      }
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [isSaveSheetOpen, accountDropdownOpen, categoryDropdownOpen, onCloseSaveSheet]);

  const roundingSteps: Array<{ step: BillRounding['step']; label: string }> = [
    { step: 0, label: t('billRoundingNone') },
    { step: 100, label: `1 ${currency}` },
    { step: 500, label: `5 ${currency}` },
    { step: 1000, label: `10 ${currency}` },
  ];

  const handleSaveHeroTrigger = async () => {
    if (savingPhase !== 'idle' || !selectedAccountId) return;
    setSavingPhase('animating');

    const now = new Date();
    const dateStr =
      existingLinkedTx?.date ||
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const timeStr =
      existingLinkedTx?.time ||
      `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    await new Promise((r) => setTimeout(r, 420));
    setSavingPhase('done');
    await new Promise((r) => setTimeout(r, 380));

    try {
      await onConfirmSaveExpense({
        accountId: selectedAccountId,
        categoryId: selectedCategoryId || defaultCat?.id || '',
        budgetPool: selectedPool,
        amountMajor: fromMinor(computation.settlement.recommendedExpenseMinor),
        myShareMinor: computation.settlement.ownerShareMinor,
        date: dateStr,
        time: timeStr,
      });
    } catch {
      setSavingPhase('idle');
    }
  };

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) || accounts[0];
  const selectedCategory =
    expenseCategories.find((c) => c.id === selectedCategoryId) || defaultCat;

  return (
    <div className="space-y-3">
      {/* Rounding & Payer Card */}
      <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-3.5 space-y-3.5">
        {/* Rounding Controls */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>{t('billRoundingTitle')}</span>
            </span>
            {session.rounding.step > 0 && (
              <div className="inline-flex items-center gap-1">
                <span className="text-[10px] text-[var(--text-secondary)]">
                  {t('billRoundingToLabel')}:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const order: BillRounding['remainderTo'][] = ['owner', 'payer', 'largest', 'spread'];
                    const next =
                      order[(order.indexOf(session.rounding.remainderTo) + 1) % order.length];
                    onUpdateSession((prev) => ({
                      ...prev,
                      rounding: { ...prev.rounding, remainderTo: next },
                    }));
                  }}
                  className="px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent-primary)] text-[11px] font-bold cursor-pointer"
                >
                  {session.rounding.remainderTo === 'owner'
                    ? t('billRoundingToOwner')
                    : session.rounding.remainderTo === 'payer'
                    ? t('billRoundingToPayer')
                    : session.rounding.remainderTo === 'largest'
                    ? t('billRoundingToLargest')
                    : t('billRoundingToSpread')}
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {roundingSteps.map((rs) => (
              <button
                key={rs.step}
                type="button"
                onClick={() =>
                  onUpdateSession((prev) => ({
                    ...prev,
                    rounding: { ...prev.rounding, step: rs.step },
                  }))
                }
                className={`min-h-[36px] rounded-xl text-xs font-bold border transition cursor-pointer ${
                  session.rounding.step === rs.step
                    ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--accent-primary)]'
                    : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                }`}
              >
                {rs.label}
              </button>
            ))}
          </div>
        </div>

        {/* Who Paid Merchant */}
        <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>{t('billWhoPaidTitle')}</span>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() =>
                onUpdateSession((prev) => ({ ...prev, payerMode: 'owner_all', payers: [] }))
              }
              className={`min-h-[38px] rounded-lg text-xs font-bold cursor-pointer transition ${
                session.payerMode === 'owner_all'
                  ? 'bg-[var(--bg-secondary)] text-[var(--accent-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              {t('billIPaidAll')}
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdateSession((prev) => ({
                  ...prev,
                  payerMode: 'custom',
                  payers:
                    prev.payers.length > 0
                      ? prev.payers
                      : approvedPeople.map((p) => ({
                          personId: p.id,
                          amountMinor: p.kind === 'owner' ? computation.computedTotalMinor : 0,
                        })),
                }))
              }
              className={`min-h-[38px] rounded-lg text-xs font-bold cursor-pointer transition ${
                session.payerMode === 'custom'
                  ? 'bg-[var(--bg-secondary)] text-[var(--accent-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              {t('billCustomPayers')}
            </button>
          </div>

          {session.payerMode === 'custom' && (
            <div className="space-y-1.5 pt-1">
              {approvedPeople.map((p) => {
                const entry = session.payers.find((e) => e.personId === p.id);
                const amtMinor = entry?.amountMinor || 0;
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]"
                  >
                    <span dir="auto" className="text-xs font-bold text-[var(--text-primary)] truncate">
                      {p.avatar || '👤'} {p.name}
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      dir="ltr"
                      value={amtMinor > 0 ? String(fromMinor(amtMinor)) : ''}
                      placeholder="0.00"
                      onChange={(e) => {
                        const val = Number(e.target.value.replace(/,/g, ''));
                        const minor = Number.isFinite(val) && val >= 0 ? toMinor(val) : 0;
                        onUpdateSession((prev) => {
                          const exists = prev.payers.some((x) => x.personId === p.id);
                          const nextPayers = exists
                            ? prev.payers.map((x) =>
                                x.personId === p.id ? { ...x, amountMinor: minor } : x
                              )
                            : [...prev.payers, { personId: p.id, amountMinor: minor }];
                          return { ...prev, payers: nextPayers };
                        });
                      }}
                      className="w-24 min-h-[36px] px-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[16px] sm:text-xs font-mono tabular-nums text-end text-[var(--text-primary)]"
                    />
                  </div>
                );
              })}
              {computation.settlement.payerMismatchMinor !== 0 && (
                <p className="text-[11px] font-semibold text-[var(--status-warning)]">
                  {isAr
                    ? `مجموع المدفوع للتاجر يختلف عن إجمالي الفاتورة بمقدار ${formatMinorMoney(Math.abs(computation.settlement.payerMismatchMinor), currency, language)}`
                    : `Paid sum differs from bill total by ${formatMinorMoney(Math.abs(computation.settlement.payerMismatchMinor), currency, language)}`}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Optional InstaPay / Wallet Payment Details */}
        <div className="pt-2 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={() => setShowPaymentConfig((v) => !v)}
            className="w-full flex items-center justify-between text-xs font-bold text-[var(--text-secondary)] cursor-pointer py-1"
          >
            <span className="flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>{t('billPaymentInfoTitle')}</span>
            </span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-150 ${
                showPaymentConfig ? 'rotate-180' : ''
              }`}
            />
          </button>

          {showPaymentConfig && (
            <div className="mt-2.5 space-y-2.5">
              <input
                type="text"
                dir="ltr"
                value={session.paymentInfo?.instaPay || ''}
                onChange={(e) =>
                  onUpdateSession((prev) => ({
                    ...prev,
                    paymentInfo: { ...(prev.paymentInfo || {}), instaPay: e.target.value },
                  }))
                }
                placeholder={t('billInstaPayPlaceholder')}
                className="w-full min-h-[42px] px-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[16px] sm:text-xs font-mono text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
              />
              <input
                type="text"
                inputMode="tel"
                dir="ltr"
                value={session.paymentInfo?.wallet || ''}
                onChange={(e) =>
                  onUpdateSession((prev) => ({
                    ...prev,
                    paymentInfo: { ...(prev.paymentInfo || {}), wallet: e.target.value },
                  }))
                }
                placeholder={t('billWalletPlaceholder')}
                className="w-full min-h-[42px] px-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[16px] sm:text-xs font-mono text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
              />
              {/* Custom styled toggle for InstaPay fee */}
              <button
                type="button"
                onClick={() =>
                  onUpdateSession((prev) => ({
                    ...prev,
                    paymentInfo: {
                      ...(prev.paymentInfo || {}),
                      includeInstaPayFee: !prev.paymentInfo?.includeInstaPayFee,
                    },
                  }))
                }
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] cursor-pointer"
              >
                <span>{t('billIncludeInstaPayFee')}</span>
                <div
                  className={`w-10 h-6 rounded-full p-0.5 transition-colors shrink-0 ${
                    session.paymentInfo?.includeInstaPayFee
                      ? 'bg-[var(--accent-primary)]'
                      : 'bg-[var(--border-strong)]'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow transition-transform duration-150 ${
                      session.paymentInfo?.includeInstaPayFee
                        ? isAr
                          ? '-translate-x-4'
                          : 'translate-x-4'
                        : 'translate-x-0'
                    }`}
                  />
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Final Individual Shares + Paid Checkmarks */}
      <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>{t('billSharesSummaryTitle')}</span>
          </span>
          <span className="text-xs font-mono tabular-nums font-bold text-[var(--accent-primary)]">
            {formatMinorMoney(computation.computedTotalMinor, currency, language)}
          </span>
        </div>

        <div className="space-y-2">
          {approvedPeople.map((person) => {
            const totalMinor = computation.finalPersonTotalsMinor[person.id] || 0;
            const itemsMinor = computation.allocation.perPersonItemsMinor[person.id] || 0;
            const extrasMinor = computation.extras.perPersonExtrasMinor[person.id] || 0;
            const feeInfo = computePersonTransferFee(totalMinor, session.paymentInfo, feeSettings);
            const isOwner = person.kind === 'owner';

            return (
              <div
                key={person.id}
                className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border transition ${
                  person.paidFlag
                    ? 'bg-[var(--status-success)]/10 border-[var(--status-success)]/35'
                    : 'bg-[var(--bg-tertiary)]/65 border-[var(--border-subtle)]'
                }`}
                style={{ contain: 'layout style' }}
              >
                <button
                  type="button"
                  onClick={() => onOpenPersonShare(person.id)}
                  className="flex items-center gap-2.5 min-w-0 flex-1 text-start cursor-pointer"
                >
                  <span className="text-lg shrink-0">{person.avatar || '👤'}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span dir="auto" className="text-xs font-bold text-[var(--text-primary)] truncate">
                        {person.name}
                      </span>
                      {isOwner && (
                        <span className="text-[10px] font-bold text-[var(--accent-primary)]">
                          ({t('billYouLabel')})
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-mono tabular-nums text-[var(--text-secondary)]">
                      {t('billItemsSubtotalLabel')}: {formatMinorMoney(itemsMinor, currency, language)}
                      {extrasMinor !== 0
                        ? ` · ${t('billExtrasSubtotalLabel')}: ${extrasMinor > 0 ? '+' : ''}${formatMinorMoney(extrasMinor, currency, language)}`
                        : ''}
                      {feeInfo.feeMinor > 0
                        ? ` · InstaPay +${formatMinorMoney(feeInfo.feeMinor, currency, language)}`
                        : ''}
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-mono tabular-nums font-extrabold text-[var(--text-primary)]">
                    {formatMinorMoney(totalMinor, currency, language)}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSession((prev) => ({
                        ...prev,
                        people: prev.people.map((x) =>
                          x.id === person.id ? { ...x, paidFlag: !x.paidFlag } : x
                        ),
                      }))
                    }
                    className={`min-w-[36px] min-h-[36px] px-2.5 rounded-xl border text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition ${
                      person.paidFlag
                        ? 'bg-[var(--status-success)] text-white border-[var(--status-success)]'
                        : 'bg-[var(--bg-secondary)] border-[var(--border-strong)] text-[var(--text-secondary)]'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{person.paidFlag ? t('billPaidBadge') : t('billUnpaidBadge')}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Min-Cash-Flow Transfers Summary */}
        {computation.settlement.rawTransfers.length > 0 && (
          <div className="pt-2.5 border-t border-[var(--border-subtle)] space-y-1.5">
            <span className="text-[11px] font-bold text-[var(--text-secondary)] block">
              {t('billTransfersTitle')}
            </span>
            {computation.settlement.remainingTransfers.length === 0 ? (
              <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--status-success)]">
                <CheckCircle2 className="w-4 h-4" />
                <span>{t('billAllSettledMsg')}</span>
              </div>
            ) : (
              computation.settlement.remainingTransfers.map((tr, i) => {
                const fromP = peopleById.get(tr.fromPersonId);
                const toP = peopleById.get(tr.toPersonId);
                if (!fromP || !toP) return null;
                return (
                  <div
                    key={`${tr.fromPersonId}_${tr.toPersonId}_${i}`}
                    className="flex items-center justify-between gap-2 text-xs px-2.5 py-1.5 rounded-xl bg-[var(--bg-tertiary)]/60"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span dir="auto" className="font-bold text-[var(--text-primary)] truncate">
                        {fromP.name}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-[var(--accent-primary)] rtl:scale-x-[-1] shrink-0" />
                      <span dir="auto" className="font-bold text-[var(--accent-primary)] truncate">
                        {toP.name}
                      </span>
                    </div>
                    <span className="font-mono tabular-nums font-extrabold text-[var(--text-primary)] shrink-0">
                      {formatMinorMoney(tr.amountMinor, currency, language)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Save Expense to Account Modal Sheet (Done Flow) */}
      {isSaveSheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={onCloseSaveSheet}
          className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-[12px] p-0 sm:p-4 overscroll-contain"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md max-h-[90dvh] flex flex-col rounded-t-[22px] sm:rounded-[22px] bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-5 space-y-4 shadow-2xl overflow-y-auto overscroll-contain modal-container-anim"
            style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
          >
            <div className="w-10 h-1 rounded-full bg-[var(--border-strong)] mx-auto sm:hidden shrink-0" />
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">{t('billSaveSheetTitle')}</h3>
              <button
                type="button"
                onClick={onCloseSaveSheet}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{t('billSaveSheetDesc')}</p>

            {/* Summary KPI Pill */}
            <div className="rounded-2xl bg-[var(--accent-soft)] border border-[var(--accent-primary)]/35 p-3.5 flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-bold text-[var(--text-secondary)]">
                  {t('billAmountToRecordLabel')}
                </div>
                <div className="text-2xl font-mono tabular-nums font-black text-[var(--accent-primary)]">
                  {formatMinorMoney(computation.settlement.recommendedExpenseMinor, currency, language)}
                </div>
              </div>
              <div className="text-end">
                <div className="text-[11px] font-bold text-[var(--text-secondary)]">
                  {t('billYourPersonalShareLabel')}
                </div>
                <div className="text-sm font-mono tabular-nums font-bold text-[var(--text-primary)]">
                  {formatMinorMoney(computation.settlement.ownerShareMinor, currency, language)}
                </div>
              </div>
            </div>

            {/* Custom Account Selector (Zero native select) */}
            <div className="space-y-1.5 relative">
              <label className="text-xs font-bold text-[var(--text-secondary)] block">
                {t('billSelectAccountLabel')}
              </label>
              <button
                type="button"
                onClick={() => {
                  setCategoryDropdownOpen(false);
                  setAccountDropdownOpen((v) => !v);
                }}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] flex items-center justify-between text-sm font-bold text-[var(--text-primary)] cursor-pointer"
              >
                <span className="flex items-center gap-2 truncate">
                  <span>{selectedAccount?.icon || '🏦'}</span>
                  <span dir="auto">{selectedAccount?.name || ''}</span>
                </span>
                <ChevronDown className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
              </button>
              {accountDropdownOpen && (
                <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-strong)] shadow-xl max-h-44 overflow-y-auto overscroll-contain p-1.5 space-y-1">
                  {accounts.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => {
                        setSelectedAccountId(acc.id);
                        setAccountDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold cursor-pointer ${
                        acc.id === selectedAccountId
                          ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                          : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>{acc.icon || '🏦'}</span>
                        <span dir="auto">{acc.name}</span>
                      </span>
                      {acc.id === selectedAccountId && <Check className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Custom Category Selector (Zero native select) */}
            <div className="space-y-1.5 relative">
              <label className="text-xs font-bold text-[var(--text-secondary)] block">
                {t('billSelectCategoryLabel')}
              </label>
              <button
                type="button"
                onClick={() => {
                  setAccountDropdownOpen(false);
                  setCategoryDropdownOpen((v) => !v);
                }}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] flex items-center justify-between text-sm font-bold text-[var(--text-primary)] cursor-pointer"
              >
                <span className="flex items-center gap-2 truncate">
                  <span>{selectedCategory?.icon || '🍔'}</span>
                  <span dir="auto">{selectedCategory?.name || ''}</span>
                </span>
                <ChevronDown className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
              </button>
              {categoryDropdownOpen && (
                <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-strong)] shadow-xl max-h-44 overflow-y-auto overscroll-contain p-1.5 space-y-1">
                  {expenseCategories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategoryId(cat.id);
                        setCategoryDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold cursor-pointer ${
                        cat.id === selectedCategoryId
                          ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                          : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>{cat.icon}</span>
                        <span dir="auto">{cat.name}</span>
                      </span>
                      {cat.id === selectedCategoryId && <Check className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Budget Pool Pills */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)] block">
                {t('billSelectPoolLabel')}
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['outings', 'daily', 'oneoff', 'fixed'] as ExpenseBudgetPool[]).map((pool) => (
                  <button
                    key={pool}
                    type="button"
                    onClick={() => setSelectedPool(pool)}
                    className={`min-h-[38px] rounded-xl text-[11px] font-bold border cursor-pointer transition ${
                      selectedPool === pool
                        ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--accent-primary)]'
                        : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {pool === 'outings'
                      ? isAr
                        ? 'خروجات'
                        : 'Outings'
                      : pool === 'daily'
                      ? isAr
                        ? 'يومي'
                        : 'Daily'
                      : pool === 'oneoff'
                      ? isAr
                        ? 'مرة واحدة'
                        : 'One-Off'
                      : isAr
                      ? 'ثابت'
                      : 'Fixed'}
                  </button>
                ))}
              </div>
            </div>

            {/* Choreographed Hero CTA Button with inline-SVG receipt-split + checkmark */}
            <button
              type="button"
              disabled={savingPhase !== 'idle' || !selectedAccountId}
              aria-busy={savingPhase !== 'idle'}
              onClick={handleSaveHeroTrigger}
              className={`relative overflow-hidden w-full min-h-[52px] rounded-full font-extrabold text-sm text-white flex items-center justify-center gap-2.5 shadow-lg transition cursor-pointer ${
                savingPhase === 'done'
                  ? 'bg-[var(--status-success)]'
                  : 'bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)]'
              }`}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                className="shrink-0"
                aria-hidden="true"
              >
                {savingPhase === 'done' ? (
                  <path
                    d="M5 13l4 4L19 7"
                    stroke="currentColor"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      strokeDasharray: 28,
                      strokeDashoffset: 0,
                      transition: 'stroke-dashoffset 220ms ease-out',
                    }}
                  />
                ) : (
                  <>
                    <path
                      d="M5 4h14v7H5z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                      style={{
                        transform:
                          savingPhase === 'animating'
                            ? 'translate3d(0, -3px, 0)'
                            : 'translate3d(0, 0, 0)',
                        transition: 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)',
                      }}
                    />
                    <path
                      d="M5 13h14v7l-2.5-1.5L14 20l-2-1.5L10 20l-2.5-1.5L5 20v-7z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                      style={{
                        transform:
                          savingPhase === 'animating'
                            ? 'translate3d(0, 3px, 0)'
                            : 'translate3d(0, 0, 0)',
                        transition: 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)',
                      }}
                    />
                  </>
                )}
              </svg>
              <span>
                {savingPhase === 'done'
                  ? t('billMatchedBadge')
                  : existingLinkedTx
                  ? t('billUpdateHeroBtn')
                  : t('billSaveConfirmBtn')}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
