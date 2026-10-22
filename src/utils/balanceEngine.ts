import { Account, Transaction, HistoricalBalanceResult, TransferBalancesResult } from '../types';

/**
 * Comparator to sort transactions in strict chronological order
 */
export function compareTransactionsChronological(a: Transaction, b: Transaction): number {
  if (a.date !== b.date) {
    return a.date.localeCompare(b.date);
  }
  const timeA = a.time || '00:00';
  const timeB = b.time || '00:00';
  if (timeA !== timeB) {
    return timeA.localeCompare(timeB);
  }
  return a.createdAt - b.createdAt;
}

/**
 * Filter transactions that involve a specific account
 */
export function getAccountTransactions(accountId: string, transactions: Transaction[]): Transaction[] {
  return transactions.filter(
    (tx) => tx.accountId === accountId || (tx.type === 'transfer' && tx.toAccountId === accountId)
  );
}

/**
 * Computes net delta for an account from a single transaction
 */
export function getTransactionDeltaForAccount(tx: Transaction, accountId: string): number {
  if (tx.type === 'income') {
    return tx.accountId === accountId ? tx.amount : 0;
  }
  if (tx.type === 'expense') {
    return tx.accountId === accountId ? -tx.amount : 0;
  }
  if (tx.type === 'transfer') {
    if (tx.accountId === accountId) {
      return -tx.amount; // Money sent out
    }
    if (tx.toAccountId === accountId) {
      return tx.amount; // Money received
    }
  }
  return 0;
}

/**
 * Calculates historical balances (before, delta, after) for a specific transaction in an account
 */
export function getHistoricalBalance(
  txId: string,
  account: Account,
  allTransactions: Transaction[]
): HistoricalBalanceResult {
  const accountTxs = getAccountTransactions(account.id, allTransactions).sort(
    compareTransactionsChronological
  );

  let running = 0; // Baseline initial balance

  let balanceBefore = 0;
  let transactionDelta = 0;
  let balanceAfter = 0;

  for (const tx of accountTxs) {
    const delta = getTransactionDeltaForAccount(tx, account.id);
    if (tx.id === txId) {
      balanceBefore = running;
      transactionDelta = delta;
      balanceAfter = running + delta;
      break;
    }
    running += delta;
  }

  return {
    balanceBefore,
    transactionAmount: transactionDelta,
    balanceAfter,
  };
}

/**
 * Calculates historical balances (before & after) for BOTH accounts involved in a transfer transaction
 */
export function getTransferHistoricalBalances(
  tx: Transaction,
  accounts: Account[],
  allTransactions: Transaction[]
): TransferBalancesResult | null {
  if (tx.type !== 'transfer' || !tx.toAccountId) return null;
  const fromAcc = accounts.find((a) => a.id === tx.accountId);
  const toAcc = accounts.find((a) => a.id === tx.toAccountId);
  if (!fromAcc || !toAcc) return null;

  let fromBefore = tx.fromBalanceBefore;
  let fromAfter = tx.fromBalanceAfter;
  let toBefore = tx.toBalanceBefore;
  let toAfter = tx.toBalanceAfter;

  if (fromBefore === undefined || fromAfter === undefined) {
    const fromHist = getHistoricalBalance(tx.id, fromAcc, allTransactions);
    fromBefore = fromHist.balanceBefore;
    fromAfter = fromHist.balanceAfter;
  }

  if (toBefore === undefined || toAfter === undefined) {
    const toHist = getHistoricalBalance(tx.id, toAcc, allTransactions);
    toBefore = toHist.balanceBefore;
    toAfter = toHist.balanceAfter;
  }

  return {
    fromAccountName: fromAcc.name,
    fromAccountIcon: fromAcc.icon,
    fromBalanceBefore: fromBefore,
    fromBalanceAfter: fromAfter,
    toAccountName: toAcc.name,
    toAccountIcon: toAcc.icon,
    toBalanceBefore: toBefore,
    toBalanceAfter: toAfter,
    amount: tx.amount,
  };
}

/**
 * Recalculates the exact total balance for an account by summing all its chronological transactions
 */
export function recalculateAccountBalance(
  account: Account,
  allTransactions: Transaction[]
): number {
  const accountTxs = getAccountTransactions(account.id, allTransactions);
  let balance = 0;
  for (const tx of accountTxs) {
    balance += getTransactionDeltaForAccount(tx, account.id);
  }
  return balance;
}

/**
 * Recalculates balances for all accounts based on current transactions
 */
export function syncAllAccountBalances(
  accounts: Account[],
  transactions: Transaction[]
): Account[] {
  return accounts.map((acc) => ({
    ...acc,
    balance: recalculateAccountBalance(acc, transactions),
  }));
}
