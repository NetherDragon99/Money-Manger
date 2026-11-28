import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Wallet, X } from 'lucide-react';
import {
  Account,
  BillPerson,
  BillSession,
  Category,
  ExpenseBudgetPool,
} from '../../types';
import {
  BillComputation,
  formatMinorMoney,
  fromMinor,
  generateBillId,
  toMinor,
} from '../../utils/billSplitEngine';
import { saveBillSession } from '../../utils/billSplitStore';
import { translations } from '../../utils/translations';
import { BillPersonAvatar } from './BillPersonAvatar';

interface BillGuestSaveExpenseSheetProps {
  isOpen: boolean;
  session: BillSession;
  computation: BillComputation;
  boundPerson: BillPerson | null;
  accounts: Account[];
  categories: Category[];
  currency: string;
  language: 'ar' | 'en';
  onClose: () => void;
  onSaveTransaction: (params: {
    accountId: string;
    categoryId?: string;
    categoryName?: string;
    categoryIcon?: string;
    budgetPool: ExpenseBudgetPool;
    amountMajor: number;
    myShareMinor: number;
    snapshotSession: BillSession;
  }) => void;
  t: (key: keyof typeof translations.en) => string;
}

type SaveMode = 'mine' | 'people' | 'custom';

export const BillGuestSaveExpenseSheet: React.FC<BillGuestSaveExpenseSheetProps> = ({
  isOpen,
  session,
  computation,
  boundPerson,
  accounts,
  categories,
  currency,
  language,
  onClose,
  onSaveTransaction,
  t,
}) => {
  const approvedPeople = useMemo(
    () => session.people.filter((p) => p.approval === 'approved'),
    [session.people]
  );
  const canUseMine = Boolean(boundPerson && boundPerson.approval === 'approved');

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'expense'),
    [categories]
  );
  const defaultCat =
    expenseCategories.find(
      (c) => c.name.toLowerCase().includes('dining') || c.name.includes('مطاعم')
    ) || expenseCategories[0];

  const [mode, setMode] = useState<SaveMode>(canUseMine ? 'mine' : 'people');
  const [selectedPeopleIds, setSelectedPeopleIds] = useState<string[]>([]);
  const [extraAmountStr, setExtraAmountStr] = useState('');
  const [customTotalStr, setCustomTotalStr] = useState('');
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id || '');
  const [categoryId, setCategoryId] = useState<string>(defaultCat?.id || '');
  const [pool, setPool] = useState<ExpenseBudgetPool>('outings');
  const [accOpen, setAccOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const hasMine = Boolean(boundPerson && boundPerson.approval === 'approved');
    setMode(hasMine ? 'mine' : 'people');
    setSelectedPeopleIds(hasMine && boundPerson ? [boundPerson.id] : []);
    setExtraAmountStr('');
    const baseMine =
      hasMine && boundPerson ? computation.finalPersonTotalsMinor[boundPerson.id] || 0 : 0;
    setCustomTotalStr(baseMine > 0 ? String(fromMinor(baseMine)) : '');
    if (!accounts.some((a) => a.id === accountId)) {
      setAccountId(accounts[0]?.id || '');
    }
    if (!expenseCategories.some((c) => c.id === categoryId)) {
      setCategoryId(defaultCat?.id || '');
    }
    setAccOpen(false);
    setCatOpen(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (accOpen) setAccOpen(false);
        else if (catOpen) setCatOpen(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [isOpen, accOpen, catOpen, onClose]);

  if (!isOpen) return null;

  const myShareMinor =
    canUseMine && boundPerson ? computation.finalPersonTotalsMinor[boundPerson.id] || 0 : 0;

  const selectedPeopleTotalMinor = selectedPeopleIds.reduce(
    (sum, pid) => sum + (computation.finalPersonTotalsMinor[pid] || 0),
    0
  );

  const extraMinor = toMinor(Number(extraAmountStr.replace(/,/g, '').trim()) || 0);
  const customMinor = toMinor(Number(customTotalStr.replace(/,/g, '').trim()) || 0);

  const finalRecordMinor =
    mode === 'mine'
      ? myShareMinor + Math.max(0, extraMinor)
      : mode === 'people'
      ? selectedPeopleTotalMinor
      : customMinor;

  const selectedAccount = accounts.find((a) => a.id === accountId) || accounts[0];
  const selectedCategory =
    expenseCategories.find((c) => c.id === categoryId) || defaultCat;

  const handleConfirm = () => {
    if (!selectedAccount || finalRecordMinor <= 0) return;

    const snapshotId = `bill_snap_${generateBillId()}`;
    const frozenSnapshot: BillSession = JSON.parse(
      JSON.stringify({
        ...session,
        id: snapshotId,
        status: 'settled',
        settledAt: Date.now(),
        updatedAt: Date.now(),
        isFrozenSnapshot: true,
        sourceLiveBillId: session.id,
        live: undefined,
      })
    );

    saveBillSession(frozenSnapshot, { asActiveDraft: false, immediate: true });

    onSaveTransaction({
      accountId: selectedAccount.id,
      categoryId: selectedCategory?.id,
      categoryName: selectedCategory?.name,
      categoryIcon: selectedCategory?.icon,
      budgetPool: pool,
      amountMajor: fromMinor(finalRecordMinor),
      myShareMinor: myShareMinor > 0 ? myShareMinor : finalRecordMinor,
      snapshotSession: frozenSnapshot,
    });
    onClose();
  };

  const pools: Array<{ id: ExpenseBudgetPool; labelKey: keyof typeof translations.en }> = [
    { id: 'outings', labelKey: 'poolOutings' },
    { id: 'daily', labelKey: 'poolDaily' },
    { id: 'fixed', labelKey: 'poolFixed' },
    { id: 'oneoff', labelKey: 'poolOneOff' },
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
        className="w-full sm:max-w-md max-h-[90dvh] flex flex-col rounded-t-[22px] sm:rounded-[22px] bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-5 space-y-4 shadow-2xl overflow-y-auto overscroll-contain modal-container-anim"
        style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
      >
        <div className="w-10 h-1 rounded-full bg-[var(--border-strong)] mx-auto sm:hidden shrink-0" />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-[var(--accent-primary)]" />
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              {t('billGuestSaveTxTitle')}
            </h3>
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

        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          {t('billGuestSaveTxDesc')}
        </p>

        {/* 3 Amount Mode Tabs */}
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
          {(
            [
              ...(canUseMine ? [{ id: 'mine' as SaveMode, label: t('billGuestSaveModeMine') }] : []),
              { id: 'people' as SaveMode, label: t('billGuestSaveModePeople') },
              { id: 'custom' as SaveMode, label: t('billGuestSaveModeCustom') },
            ]
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`min-h-[36px] px-2 rounded-lg text-[11px] font-bold cursor-pointer transition ${
                mode === m.id
                  ? 'bg-[var(--bg-secondary)] text-[var(--accent-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Mode Body */}
        {mode === 'mine' && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-[var(--text-secondary)] block">
              {t('billGuestSaveExtraInputLabel')}
            </label>
            <input
              type="text"
              inputMode="decimal"
              dir="ltr"
              value={extraAmountStr}
              onChange={(e) => setExtraAmountStr(e.target.value)}
              placeholder="0.00"
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[16px] sm:text-sm font-mono text-[var(--text-primary)]"
            />
          </div>
        )}

        {mode === 'people' && (
          <div className="flex flex-wrap gap-1.5">
            {approvedPeople.map((p) => {
              const picked = selectedPeopleIds.includes(p.id);
              const amt = computation.finalPersonTotalsMinor[p.id] || 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    setSelectedPeopleIds((prev) =>
                      prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                    )
                  }
                  className={`inline-flex items-center gap-1.5 ps-1.5 pe-2.5 py-1.5 min-h-[38px] rounded-full text-xs font-bold border cursor-pointer active:scale-[0.97] transition ${
                    picked
                      ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--accent-primary)]'
                      : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                  }`}
                >
                  <BillPersonAvatar
                    name={p.name}
                    avatar={p.avatar}
                    photoURL={p.photoURL}
                    size="xs"
                  />
                  <span dir="auto">{p.name}</span>
                  <span className="font-mono tabular-nums text-[11px] opacity-80">
                    ({formatMinorMoney(amt, currency, language)})
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {mode === 'custom' && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-[var(--text-secondary)] block">
              {t('billGuestSaveCustomTotalLabel')}
            </label>
            <input
              type="text"
              inputMode="decimal"
              dir="ltr"
              value={customTotalStr}
              onChange={(e) => setCustomTotalStr(e.target.value)}
              placeholder="0.00"
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[16px] sm:text-sm font-mono text-[var(--text-primary)]"
            />
          </div>
        )}

        {/* Custom Account Selector */}
        <div className="space-y-1.5 relative">
          <span className="text-xs font-bold text-[var(--text-secondary)] block">
            {t('account')}
          </span>
          <button
            type="button"
            onClick={() => {
              setAccOpen((v) => !v);
              setCatOpen(false);
            }}
            className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] flex items-center justify-between text-sm font-bold text-[var(--text-primary)] cursor-pointer"
          >
            <span dir="auto" className="truncate">
              {selectedAccount ? `${selectedAccount.icon || '💳'} ${selectedAccount.name}` : '—'}
            </span>
            <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
          </button>
          {accOpen && (
            <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-strong)] shadow-xl p-1.5 max-h-44 overflow-y-auto overscroll-contain space-y-1">
              {accounts.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => {
                    setAccountId(acc.id);
                    setAccOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                    acc.id === selectedAccount?.id
                      ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                      : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                  }`}
                >
                  <span dir="auto" className="truncate">
                    {acc.icon || '💳'} {acc.name}
                  </span>
                  {acc.id === selectedAccount?.id && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Custom Category Selector */}
        <div className="space-y-1.5 relative">
          <span className="text-xs font-bold text-[var(--text-secondary)] block">
            {t('billSelectCategoryLabel')}
          </span>
          <button
            type="button"
            onClick={() => {
              setCatOpen((v) => !v);
              setAccOpen(false);
            }}
            className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] flex items-center justify-between text-sm font-bold text-[var(--text-primary)] cursor-pointer"
          >
            <span dir="auto" className="truncate">
              {selectedCategory ? `${selectedCategory.icon || '🍽️'} ${selectedCategory.name}` : '—'}
            </span>
            <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
          </button>
          {catOpen && (
            <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-strong)] shadow-xl p-1.5 max-h-44 overflow-y-auto overscroll-contain space-y-1">
              {expenseCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setCategoryId(cat.id);
                    setCatOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                    cat.id === selectedCategory?.id
                      ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                      : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                  }`}
                >
                  <span dir="auto" className="truncate">
                    {cat.icon || '🍽️'} {cat.name}
                  </span>
                  {cat.id === selectedCategory?.id && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Smart Budget Pool Pills */}
        <div className="grid grid-cols-2 gap-1.5">
          {pools.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPool(p.id)}
              className={`min-h-[36px] px-2.5 rounded-xl border text-xs font-bold cursor-pointer transition ${
                pool === p.id
                  ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--accent-primary)]'
                  : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
              }`}
            >
              {t(p.labelKey)}
            </button>
          ))}
        </div>

        {/* Confirm Save CTA */}
        <button
          type="button"
          disabled={!selectedAccount || finalRecordMinor <= 0}
          onClick={handleConfirm}
          className="w-full min-h-[48px] px-4 rounded-2xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--text-on-accent)] text-sm font-extrabold flex items-center justify-center gap-2 disabled:opacity-45 cursor-pointer active:scale-[0.97] transition"
        >
          <Check className="w-4 h-4 stroke-[2.5]" />
          <span>{t('billGuestSaveTxBtn')}</span>
          <span className="font-mono tabular-nums">
            ({formatMinorMoney(Math.max(0, finalRecordMinor), currency, language)})
          </span>
        </button>
      </div>
    </div>
  );
};
