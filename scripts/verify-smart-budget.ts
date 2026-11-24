/**
 * Core regression verification suite for solv Smart Budget Engine,
 * Future-Impact Analyzer, 3-Mode What-If Simulator, Unified Filter Engine,
 * and Beta/Stable Release Notes Channel Isolation.
 *
 * Run via: npx tsx scripts/verify-smart-budget.ts
 */
import assert from 'node:assert/strict';
import {
  evaluateSmartBudget,
  getTransactionBudgetPool,
  SmartBudgetConfig,
} from '../src/utils/smartBudgetEngine';
import {
  analyzeTransactionImpact,
  simulateWhatIfScenario,
} from '../src/utils/budgetImpactAnalyzer';
import {
  resolveDateRange,
  isTransactionInRange,
  DEFAULT_ADVANCED_FILTER,
  applyAdvancedTransactionFilter,
  countActiveAdvancedFilters,
} from '../src/utils/dateCycle';
import {
  APP_RELEASE_NOTES,
  getReleaseNotesForChannel,
} from '../src/utils/appFeatures';
import { resolveMessageLanguage } from '../src/utils/constants';
import type { Account, Category, Transaction } from '../src/types';

let passed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ FAILED: ${name}`);
    throw err;
  }
}

function approxEqual(actual: number, expected: number, tolerance = 0.02, msg = '') {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${msg ? msg + ' — ' : ''}expected ~${expected}, got ${actual}`
  );
}

// Shared fixtures
const pubAcc = (id = 'acc_pub', balance = 10000): Account => ({
  id,
  name: 'Main Wallet',
  icon: '💳',
  balance,
  isPrivate: false,
  customMonthStartDay: 'default',
  color: '#10b981',
  currency: 'EGP',
  accountRole: 'spending',
  notes: '',
});

const privAcc = (id = 'acc_priv', balance = 5000): Account => ({
  id,
  name: 'Private Vault',
  icon: '🔒',
  balance,
  isPrivate: true,
  customMonthStartDay: 'default',
  color: '#f59e0b',
  currency: 'EGP',
  accountRole: 'spending',
  notes: '',
});

const savAcc = (id = 'acc_sav', balance = 20000): Account => ({
  id,
  name: 'Savings Account',
  icon: '🏦',
  balance,
  isPrivate: false,
  customMonthStartDay: 'default',
  color: '#34d399',
  currency: 'EGP',
  accountRole: 'savings',
  notes: '',
});

const CATEGORIES: Category[] = [
  { id: 'cat_food', name: 'Food', icon: '🍔', type: 'expense', budgetLimit: 3000 },
  { id: 'cat_rent', name: 'Rent', icon: '🏠', type: 'expense', budgetLimit: 3000 },
  { id: 'cat_fun', name: 'Coffee', icon: '☕', type: 'expense', budgetLimit: 1000 },
  { id: 'cat_gear', name: 'Electronics', icon: '💻', type: 'expense', budgetLimit: 0 },
  { id: 'cat_sal', name: 'Salary', icon: '💰', type: 'income', budgetLimit: 0 },
];

const mkTx = (partial: Partial<Transaction> & { id: string; type: Transaction['type']; amount: number; date: string; accountId: string }): Transaction => ({
  createdAt: Date.now(),
  description: '',
  ...partial,
});

console.log('\n[solv] Running Smart Budget, Impact, Filter & Channel Verification Suite...\n');

// ============================================================================
// 1. from_today: Cash conservation, Day 2 rollover, live public income & private move
// ============================================================================
test('1. from_today cash conservation, Day 2 rollover, live public income & private reversal', () => {
  const day1 = new Date(2026, 10, 11, 12, 0, 0); // 2026-11-11 (20 days left in Nov: Nov 11..30)
  const day2 = new Date(2026, 10, 12, 12, 0, 0); // 2026-11-12 (19 days left)

  const baseConfig: SmartBudgetConfig = {
    startDay: 1,
    calculationMode: 'from_today',
    baseCurrency: 'EGP',
    savings: { type: 'fixed', value: 1000 },
    plannedFixedObligations: 2000,
    outingsBudget: 1000,
    oneOffBudget: 500,
    oneOffFundingSource: 'daily',
    fromTodayConfig: {
      fromDate: '2026-11-11',
      linkedAccountIds: ['acc_pub'],
      manualAdjustment: 0,
    },
  };

  // Start of Day 1: 10,000 in linked public account, 0 spent
  const accountsDay1 = [pubAcc('acc_pub', 10000), privAcc('acc_priv', 5000)];
  const eval1 = evaluateSmartBudget([], accountsDay1, baseConfig, day1);
  assert.equal(eval1.calculationMode, 'from_today');

  // Cash conservation: savings(1000) + fixed(2000) + outings(1000) + oneoff(500) + daily(5500) === 10000
  const sumPools1 =
    eval1.pools.savings.allocated +
    eval1.pools.fixed.allocated +
    eval1.pools.outings.allocated +
    eval1.pools.oneoff.allocated +
    eval1.pools.daily.allocated;
  approxEqual(sumPools1, 10000, 0.01, 'Day 1 pool conservation');
  approxEqual(eval1.pools.daily.allocated, 5500, 0.01, 'Day 1 daily pool');
  approxEqual(eval1.dailyStatus.todayAllowance, 5500 / 20, 0.05, 'Day 1 today allowance');

  // Spend 200 daily on Day 1 -> linked balance drops from 10,000 to 9,800
  const txDay1Spend = mkTx({
    id: 'tx_d1',
    type: 'expense',
    amount: 200,
    date: '2026-11-11',
    accountId: 'acc_pub',
    categoryId: 'cat_food',
    budgetPool: 'daily',
  });
  const accountsAfterSpend = [pubAcc('acc_pub', 9800), privAcc('acc_priv', 5000)];
  const evalDay1After = evaluateSmartBudget([txDay1Spend], accountsAfterSpend, baseConfig, day1);

  // Total cycle funded remains 10,000 (9,800 live + 200 tracked outflow) -> no double-subtraction!
  approxEqual(evalDay1After.pools.daily.allocated, 5500, 0.01, 'No double subtraction on Day 1');
  approxEqual(evalDay1After.dailyStatus.todayAllowance, 275, 0.05, 'Day 1 allowance steady after spend');
  approxEqual(evalDay1After.dailyStatus.todayRemaining, 75, 0.05, 'Day 1 remaining = 275 - 200');

  // Move to Day 2: remaining daily pool at start of Day 2 = 5500 - 200 = 5300 across 19 remaining days
  const evalDay2 = evaluateSmartBudget([txDay1Spend], accountsAfterSpend, baseConfig, day2);
  approxEqual(
    evalDay2.dailyStatus.dailyPoolRemainingAtStartOfTodayMinor / 100,
    5300,
    0.01,
    'Day 2 start-of-day daily pool'
  );
  approxEqual(evalDay2.dailyStatus.todayAllowance, 5300 / 19, 0.05, 'Day 2 daily allowance');

  // Add +1,900 extra public income on Day 2 -> linked balance rises from 9,800 to 11,700
  const txExtraInc = mkTx({
    id: 'tx_inc_pub',
    type: 'income',
    amount: 1900,
    date: '2026-11-12',
    accountId: 'acc_pub',
    categoryId: 'cat_sal',
    description: 'Freelance bonus',
  });
  const accountsWithIncome = [pubAcc('acc_pub', 11700), privAcc('acc_priv', 5000)];
  const evalWithIncome = evaluateSmartBudget(
    [txDay1Spend, txExtraInc],
    accountsWithIncome,
    baseConfig,
    day2
  );

  // Savings/Fixed/Outings/OneOff remain fixed; 100% of +1900 goes into Daily (+100/day across 19 days)
  assert.equal(evalWithIncome.pools.savings.allocated, 1000);
  assert.equal(evalWithIncome.pools.fixed.allocated, 2000);
  assert.equal(evalWithIncome.pools.outings.allocated, 1000);
  assert.equal(evalWithIncome.pools.oneoff.allocated, 500);
  approxEqual(evalWithIncome.pools.daily.allocated, 7400, 0.01, '100% extra income into daily');
  approxEqual(evalWithIncome.pools.total.dynamicPublicIncomeDelta, 1900, 0.01, 'Dynamic delta tracked');
  approxEqual(evalWithIncome.dailyStatus.todayAllowance, (5300 + 1900) / 19, 0.05, 'Today allowance +100');

  // Move that income transaction from Public -> Private account (linked pub reverts to 9,800, priv to 6,900)
  const txMovedToPriv = { ...txExtraInc, accountId: 'acc_priv' };
  const accountsMovedPriv = [pubAcc('acc_pub', 9800), privAcc('acc_priv', 6900)];
  const evalAfterPrivMove = evaluateSmartBudget(
    [txDay1Spend, txMovedToPriv],
    accountsMovedPriv,
    baseConfig,
    day2
  );
  approxEqual(evalAfterPrivMove.pools.daily.allocated, evalDay2.pools.daily.allocated, 0.01, 'Private move reverses daily');
  approxEqual(evalAfterPrivMove.dailyStatus.todayAllowance, evalDay2.dailyStatus.todayAllowance, 0.05, 'Private move reverses allowance');
  approxEqual(evalAfterPrivMove.pools.total.dynamicPublicIncomeDelta, 0, 0.01, 'Private move clears delta');
});

// ============================================================================
// 2. full_cycle: dynamic public income & private-account move reversal
// ============================================================================
test('2. full_cycle dynamic public income rebalancing & private move reversal', () => {
  const asOf = new Date(2026, 10, 11, 12, 0, 0); // 2026-11-11 (30-day cycle Nov 1..30)
  const config: SmartBudgetConfig = {
    startDay: 1,
    calculationMode: 'full_cycle',
    plannedIncome: 15000,
    savings: { type: 'fixed', value: 3000 },
    plannedFixedObligations: 4000,
    outingsBudget: 1500,
    oneOffBudget: 500,
    baseCurrency: 'EGP',
  };
  const accounts = [pubAcc('acc_pub', 15000), privAcc('acc_priv', 2000)];

  const baseEval = evaluateSmartBudget([], accounts, config, asOf);
  approxEqual(baseEval.pools.daily.allocated, 6000, 0.01, 'Base daily = 15000 - 9000');

  // Add extra public income (+3,000 non-salary bonus)
  const bonusPub = mkTx({
    id: 'tx_bonus',
    type: 'income',
    amount: 3000,
    date: '2026-11-10',
    accountId: 'acc_pub',
    description: 'Project bonus',
  });
  const boostedEval = evaluateSmartBudget([bonusPub], accounts, config, asOf);
  assert.equal(boostedEval.pools.savings.allocated, 3000);
  assert.equal(boostedEval.pools.fixed.allocated, 4000);
  assert.equal(boostedEval.pools.outings.allocated, 1500);
  assert.equal(boostedEval.pools.oneoff.allocated, 500);
  approxEqual(boostedEval.pools.daily.allocated, 9000, 0.01, 'Extra public income added strictly to Daily');
  approxEqual(boostedEval.pools.total.dynamicPublicIncomeDelta, 3000, 0.01, 'Dynamic delta = +3000');

  // Edit income to move to Private account -> reverts cleanly
  const bonusPriv = { ...bonusPub, accountId: 'acc_priv' };
  const revertedEval = evaluateSmartBudget([bonusPriv], accounts, config, asOf);
  approxEqual(revertedEval.pools.daily.allocated, 6000, 0.01, 'Reverted to 6000 after private move');
  approxEqual(revertedEval.pools.total.dynamicPublicIncomeDelta, 0, 0.01, 'Delta back to 0');
});

// ============================================================================
// 3. Isolated per-pool manual progress adjustments (zero Daily spillover)
// ============================================================================
test('3. Isolated manual progress (+/- and reset) on Savings/Fixed/Outings/One-Off has zero Daily spillover', () => {
  const asOf = new Date(2026, 10, 15, 12, 0, 0);
  const accounts = [pubAcc('acc_pub', 12000)];
  const baseConfig: SmartBudgetConfig = {
    startDay: 1,
    calculationMode: 'full_cycle',
    plannedIncome: 12000,
    savings: { type: 'fixed', value: 2000 },
    plannedFixedObligations: 3000,
    outingsBudget: 1000,
    oneOffBudget: 1000,
    baseCurrency: 'EGP',
  };

  const baseline = evaluateSmartBudget([], accounts, baseConfig, asOf);
  const cycleKey = baseline.cycle.cycleKey;

  // Apply positive manual progress (in minor units, even exceeding pool allocation!) and negative adjustments
  const adjustedConfig: SmartBudgetConfig = {
    ...baseConfig,
    overrides: {
      [cycleKey]: {
        manualProgressAdjustments: {
          savings: 1200 * 100,
          fixed: 3500 * 100, // exceeds 3000 allocation manually — must NOT spill into Daily!
          outings: 1400 * 100, // exceeds 1000 allocation manually — must NOT spill into Daily!
          oneoff: -200 * 100, // negative manual adjustment
        },
      },
    },
  };

  const adjusted = evaluateSmartBudget([], accounts, adjustedConfig, asOf);

  // Pool metrics reflect manual adjustments
  approxEqual(adjusted.pools.savings.manualAdjustment, 1200, 0.01, 'Savings manual +1200');
  approxEqual(adjusted.pools.savings.netSaved, 1200, 0.01, 'Savings netSaved includes manual');
  approxEqual(adjusted.pools.fixed.spent, 3500, 0.01, 'Fixed effective spent = 3500');
  approxEqual(adjusted.pools.outings.spent, 1400, 0.01, 'Outings effective spent = 1400');
  approxEqual(adjusted.pools.oneoff.manualAdjustment, -200, 0.01, 'One-Off manual -200');

  // CRITICAL INVARIANT: ZERO Daily spillover from manual adjustments!
  assert.equal(adjusted.dailyStatus.spilledFromFixed, 0, 'Zero fixed manual spillover');
  assert.equal(adjusted.dailyStatus.spilledFromOutings, 0, 'Zero outings manual spillover');
  assert.equal(adjusted.dailyStatus.spilledFromOneOff, 0, 'Zero oneoff manual spillover');
  approxEqual(adjusted.dailyStatus.todayRemaining, baseline.dailyStatus.todayRemaining, 0.01, 'todayRemaining unchanged');
  approxEqual(adjusted.dailyStatus.plannedDailyAllowance, baseline.dailyStatus.plannedDailyAllowance, 0.01, 'plannedDailyAllowance unchanged');

  // Resetting manual adjustments back to 0 restores exact baseline
  const resetConfig: SmartBudgetConfig = {
    ...baseConfig,
    overrides: {
      [cycleKey]: {
        manualProgressAdjustments: { savings: 0, fixed: 0, outings: 0, oneoff: 0 },
      },
    },
  };
  const resetEval = evaluateSmartBudget([], accounts, resetConfig, asOf);
  approxEqual(resetEval.pools.savings.netSaved, baseline.pools.savings.netSaved, 0.01);
  approxEqual(resetEval.pools.fixed.spent, baseline.pools.fixed.spent, 0.01);
  approxEqual(resetEval.pools.outings.spent, baseline.pools.outings.spent, 0.01);
  approxEqual(resetEval.pools.oneoff.spent, baseline.pools.oneoff.spent, 0.01);
});

// ============================================================================
// 4. Direct One-Off 5th pool across all 3 funding sources + emergency credit + projection
// ============================================================================
test('4. Direct One-Off 5th pool: daily / outings / savings funding sources, emergency credit & projection', () => {
  const asOf = new Date(2026, 10, 11, 12, 0, 0); // 20 remaining days
  const accounts = [pubAcc('acc_pub', 12000), savAcc('acc_sav', 10000)];
  const baseCfg: SmartBudgetConfig = {
    startDay: 1,
    calculationMode: 'full_cycle',
    plannedIncome: 12000,
    savings: { type: 'fixed', value: 2000 },
    plannedFixedObligations: 2000,
    outingsBudget: 1500,
    oneOffBudget: 500,
    baseCurrency: 'EGP',
  };

  // Spend 1,200 on One-Off (500 covered by One-Off pool, 700 uncovered excess)
  const oneOffTx = mkTx({
    id: 'tx_oneoff',
    type: 'expense',
    amount: 1200,
    date: '2026-11-11',
    accountId: 'acc_pub',
    categoryId: 'cat_gear',
    budgetPool: 'oneoff',
  });

  // (a) oneOffFundingSource = 'daily' -> 700 spills to Daily
  const evalDaily = evaluateSmartBudget([oneOffTx], accounts, { ...baseCfg, oneOffFundingSource: 'daily' }, asOf);
  approxEqual(evalDaily.pools.oneoff.uncoveredExcess, 700, 0.01, 'Uncovered excess = 700');
  approxEqual(evalDaily.dailyStatus.spilledFromOneOff, 700, 0.01, 'Spills 700 to Daily');

  // (b) oneOffFundingSource = 'outings' -> 700 absorbed by Outings (1500 budget -> 0 daily spillover!)
  const evalOutings = evaluateSmartBudget([oneOffTx], accounts, { ...baseCfg, oneOffFundingSource: 'outings' }, asOf);
  assert.equal(evalOutings.dailyStatus.spilledFromOneOff, 0, 'Absorbed by outings, 0 direct daily spill');
  assert.equal(evalOutings.dailyStatus.spilledFromOutings, 0, 'Outings had 1500 capacity -> 0 outings spill');

  // (c) oneOffFundingSource = 'savings' -> 700 absorbed by Savings cushion -> 0 daily spillover
  const evalSavings = evaluateSmartBudget([oneOffTx], accounts, { ...baseCfg, oneOffFundingSource: 'savings' }, asOf);
  assert.equal(evalSavings.dailyStatus.spilledFromOneOff, 0, 'Absorbed by savings');
  approxEqual(evalSavings.pools.savings.absorbedOneOff, 700, 0.01, 'Savings absorbed 700');

  // (d) Emergency credit transfer from Savings account covers One-Off excess before spilling
  const emergencyTx = mkTx({
    id: 'tx_emerg',
    type: 'transfer',
    amount: 700,
    date: '2026-11-11',
    accountId: 'acc_sav',
    toAccountId: 'acc_pub',
    savingsWithdrawalChoice: 'emergency_expense',
  });
  const evalWithEmergency = evaluateSmartBudget(
    [oneOffTx, emergencyTx],
    accounts,
    { ...baseCfg, oneOffFundingSource: 'daily' },
    asOf
  );
  approxEqual(evalWithEmergency.pools.oneoff.coveredByEmergencyCredit, 700, 0.01, 'Emergency credit covers 700');
  assert.equal(evalWithEmergency.pools.oneoff.uncoveredExcess, 0, 'Zero uncovered excess with emergency credit');
  assert.equal(evalWithEmergency.dailyStatus.spilledFromOneOff, 0, 'Zero daily spill with emergency credit');

  // (e) projectedDailyAllowanceAfterSpend works for 'oneoff'
  const baseClean = evaluateSmartBudget([], accounts, { ...baseCfg, oneOffFundingSource: 'daily' }, asOf);
  const projAfterBigOneOff = baseClean.projectedDailyAllowanceAfterSpend(1500, 'oneoff', asOf);
  assert.ok(
    projAfterBigOneOff < baseClean.dailyStatus.upcomingDailyAllowance,
    'Projected daily allowance decreases when One-Off exceeds its 500 budget under daily funding'
  );
});

// ============================================================================
// 5. Transaction type & budgetPool edit precedence
// ============================================================================
test('5. Editing budgetPool (daily -> outings -> oneoff) & type (expense -> income) updates pools accurately', () => {
  const asOf = new Date(2026, 10, 15, 12, 0, 0);
  const accounts = [pubAcc('acc_pub', 10000)];
  const cfg: SmartBudgetConfig = {
    startDay: 1,
    calculationMode: 'full_cycle',
    plannedIncome: 10000,
    savings: { type: 'fixed', value: 1000 },
    plannedFixedObligations: 2000,
    outingsBudget: 1500,
    oneOffBudget: 1000,
    baseCurrency: 'EGP',
  };

  const txDaily = mkTx({ id: 'tx_e1', type: 'expense', amount: 400, date: '2026-11-14', accountId: 'acc_pub', budgetPool: 'daily' });
  const txOutings = { ...txDaily, budgetPool: 'outings' as const };
  const txOneOff = { ...txDaily, budgetPool: 'oneoff' as const };
  const txIncome = { ...txDaily, type: 'income' as const, budgetPool: undefined };

  assert.equal(getTransactionBudgetPool(txDaily), 'daily');
  assert.equal(getTransactionBudgetPool(txOutings), 'outings');
  assert.equal(getTransactionBudgetPool(txOneOff), 'oneoff');

  const eDaily = evaluateSmartBudget([txDaily], accounts, cfg, asOf);
  const eOutings = evaluateSmartBudget([txOutings], accounts, cfg, asOf);
  const eOneOff = evaluateSmartBudget([txOneOff], accounts, cfg, asOf);
  const eIncome = evaluateSmartBudget([txIncome], accounts, cfg, asOf);

  assert.equal(eDaily.pools.daily.trackedSpent, 400);
  assert.equal(eDaily.pools.outings.trackedSpent, 0);

  assert.equal(eOutings.pools.daily.trackedSpent, 0);
  assert.equal(eOutings.pools.outings.trackedSpent, 400);

  assert.equal(eOneOff.pools.outings.trackedSpent, 0);
  assert.equal(eOneOff.pools.oneoff.trackedSpent, 400);

  assert.equal(eIncome.pools.oneoff.trackedSpent, 0);
  assert.equal(eIncome.pools.daily.trackedSpent, 0);
  assert.equal(eIncome.pools.total.dynamicPublicIncomeDelta, 400);
});

// ============================================================================
// 6. analyzeTransactionImpact: Expense (safe + spike), Income (pub vs priv), Transfer
// ============================================================================
test('6. analyzeTransactionImpact covers Expense, daily spike, public/private Income & Transfer', () => {
  const asOf = new Date(2026, 10, 15, 12, 0, 0);
  const accounts = [pubAcc('acc_pub', 10000), privAcc('acc_priv', 5000), savAcc('acc_sav', 5000)];
  const cfg: SmartBudgetConfig = {
    startDay: 1,
    calculationMode: 'full_cycle',
    plannedIncome: 10000,
    savings: { type: 'fixed', value: 2000 },
    plannedFixedObligations: 2000,
    outingsBudget: 1000,
    oneOffBudget: 500,
    baseCurrency: 'EGP',
  };

  // Normal small expense
  const smallExp = analyzeTransactionImpact(
    { type: 'expense', amount: 50, date: '2026-11-15', accountId: 'acc_pub', budgetPool: 'daily' },
    null,
    [],
    accounts,
    cfg,
    'en',
    asOf
  );
  assert.ok(smallExp, 'Small expense impact report returned');
  assert.ok(smallExp.detailedMessages.length >= 1, 'Has detailed message');
  assert.ok(smallExp.recommendation.length > 0, 'Has actionable recommendation');
  assert.ok(smallExp.metrics.todayRemainingAfter < smallExp.metrics.todayRemainingBefore);

  // Huge daily-spike expense (e.g. 2500 >> daily allowance) with prior spend history
  const priorDailyTx = mkTx({
    id: 'tx_prior_d',
    type: 'expense',
    amount: 150,
    date: '2026-11-10',
    accountId: 'acc_pub',
    budgetPool: 'daily',
  });
  const spikeExp = analyzeTransactionImpact(
    { type: 'expense', amount: 2500, date: '2026-11-15', accountId: 'acc_pub', budgetPool: 'daily' },
    null,
    [priorDailyTx],
    accounts,
    cfg,
    'en',
    asOf
  );
  assert.ok(spikeExp);
  assert.ok(spikeExp.detailedMessages.length >= 2, 'Spike has multi-message breakdown');
  assert.ok(['warning', 'danger'].includes(spikeExp.severity), `Spike severity expected warning/danger, got ${spikeExp.severity}`);
  assert.ok(spikeExp.metrics.dailyDelta < 0, 'Spike reduces upcoming daily allowance');

  // Public Income -> positive severity & dailyDelta > 0
  const pubInc = analyzeTransactionImpact(
    { type: 'income', amount: 1600, date: '2026-11-15', accountId: 'acc_pub' },
    null,
    [],
    accounts,
    cfg,
    'en',
    asOf
  );
  assert.ok(pubInc);
  assert.equal(pubInc.severity, 'positive');
  assert.ok(pubInc.metrics.dailyDelta > 0, 'Public income increases daily allowance');

  // Private Income -> neutral / isolated (isPrivateInvolved = true, dailyDelta == 0)
  const privInc = analyzeTransactionImpact(
    { type: 'income', amount: 1600, date: '2026-11-15', accountId: 'acc_priv' },
    null,
    [],
    accounts,
    cfg,
    'en',
    asOf
  );
  assert.ok(privInc);
  assert.equal(privInc.metrics.isPrivateInvolved, true);
  approxEqual(privInc.metrics.dailyDelta, 0, 0.01, 'Private income does not change public daily allowance');

  // Transfer Public -> Savings
  const trSav = analyzeTransactionImpact(
    { type: 'transfer', amount: 1000, date: '2026-11-15', accountId: 'acc_pub', toAccountId: 'acc_sav', isSavingsAllocation: true },
    null,
    [],
    accounts,
    cfg,
    'en',
    asOf
  );
  assert.ok(trSav);
  assert.ok(trSav.metrics.savingsProgressAfter > trSav.metrics.savingsProgressBefore, 'Savings progress increases');
});

// ============================================================================
// 7. simulateWhatIfScenario: 3 modes + 3-way pool comparison
// ============================================================================
test('7. simulateWhatIfScenario covers single_expense, multi_day_expense, extra_income & 3-way poolComparison', () => {
  const asOf = new Date(2026, 10, 15, 12, 0, 0);
  const accounts = [pubAcc('acc_pub', 10000)];
  const cfg: SmartBudgetConfig = {
    startDay: 1,
    calculationMode: 'full_cycle',
    plannedIncome: 10000,
    savings: { type: 'fixed', value: 2000 },
    plannedFixedObligations: 2000,
    outingsBudget: 1000,
    oneOffBudget: 500,
    baseCurrency: 'EGP',
  };
  const evalNow = evaluateSmartBudget([], accounts, cfg, asOf);

  // Mode 1: single_expense
  const rSingle = simulateWhatIfScenario(
    { mode: 'single_expense', amount: 600, pool: 'daily' },
    evalNow,
    [],
    accounts,
    cfg,
    'en',
    asOf
  );
  assert.equal(rSingle.mode, 'single_expense');
  assert.equal(rSingle.totalAmount, 600);
  assert.equal(rSingle.poolComparison.length, 3, '3-way poolComparison returned');
  const poolsCompared = rSingle.poolComparison.map((p) => p.pool).sort();
  assert.deepEqual(poolsCompared, ['daily', 'oneoff', 'outings']);

  // Mode 2: multi_day_expense (200/day for 4 days = 800)
  const rMulti = simulateWhatIfScenario(
    { mode: 'multi_day_expense', amount: 200, daysCount: 4, pool: 'daily' },
    evalNow,
    [],
    accounts,
    cfg,
    'en',
    asOf
  );
  assert.equal(rMulti.mode, 'multi_day_expense');
  assert.equal(rMulti.daysCount, 4);
  assert.equal(rMulti.totalAmount, 800);
  assert.ok(rMulti.dailyDelta < 0);

  // Mode 3: extra_income (+1,600)
  const rExtra = simulateWhatIfScenario(
    { mode: 'extra_income', amount: 1600, pool: 'daily' },
    evalNow,
    [],
    accounts,
    cfg,
    'en',
    asOf
  );
  assert.equal(rExtra.mode, 'extra_income');
  assert.equal(rExtra.severity, 'positive');
  assert.ok(rExtra.dailyDelta > 0);
});

// ============================================================================
// 8. Unified Duration Resolver & Scoped Advanced Filter Engine
// ============================================================================
test('8. resolveDateRange & applyAdvancedTransactionFilter cover all durations, flags & sort orders', () => {
  const customRange = { startDate: '2026-10-05', endDate: '2026-10-20' };
  const keys = [
    'app_month',
    'this_week',
    'last_week',
    'this_month',
    'last_month',
    '3_months',
    'this_year',
    'all_time',
    'custom',
  ] as const;

  for (const key of keys) {
    const r = resolveDateRange(key, 'saturday', 1, 0, customRange);
    assert.ok(r.startDate <= r.endDate, `Valid range for ${key}: ${r.startDate} <= ${r.endDate}`);
  }
  const rCustom = resolveDateRange('custom', 'saturday', 1, 0, customRange);
  assert.deepEqual(rCustom, customRange);
  assert.equal(isTransactionInRange(mkTx({ id: 'a', type: 'expense', amount: 10, date: '2026-10-12', accountId: 'acc_pub' }), rCustom), true);
  assert.equal(isTransactionInRange(mkTx({ id: 'b', type: 'expense', amount: 10, date: '2026-10-25', accountId: 'acc_pub' }), rCustom), false);

  const accounts = [pubAcc('acc_pub', 1000), privAcc('acc_priv', 2000)];
  const accountsById = new Map(accounts.map((a) => [a.id, a]));
  const sampleTxs: Transaction[] = [
    mkTx({ id: 't1', type: 'expense', amount: 100, date: '2026-11-01', accountId: 'acc_pub', categoryId: 'cat_food', budgetPool: 'daily', description: 'Lunch note', createdAt: 100 }),
    mkTx({ id: 't2', type: 'expense', amount: 500, taxAmount: 50, date: '2026-11-05', accountId: 'acc_pub', categoryId: 'cat_gear', budgetPool: 'oneoff', isFromRecurring: false, createdAt: 200 }),
    mkTx({ id: 't3', type: 'expense', amount: 300, date: '2026-11-03', accountId: 'acc_priv', categoryId: 'cat_rent', budgetPool: 'fixed', isFromRecurring: true, createdAt: 300 }),
  ];

  const ctx = {
    accounts,
    accountsById,
    categories: CATEGORIES,
    currencySymbol: 'EGP',
    resolveBudgetPool: (tx: Transaction) => getTransactionBudgetPool(tx, ['cat_rent'], CATEGORIES),
  };

  // Pool filter: oneoff
  const oneOffOnly = applyAdvancedTransactionFilter(sampleTxs, { ...DEFAULT_ADVANCED_FILTER, budgetPools: ['oneoff'] }, ctx);
  assert.deepEqual(oneOffOnly.map((t) => t.id), ['t2']);

  // Recurring filter
  const recOnly = applyAdvancedTransactionFilter(sampleTxs, { ...DEFAULT_ADVANCED_FILTER, recurringFilter: 'recurring' }, ctx);
  assert.deepEqual(recOnly.map((t) => t.id), ['t3']);

  const nonRecOnly = applyAdvancedTransactionFilter(sampleTxs, { ...DEFAULT_ADVANCED_FILTER, recurringFilter: 'non_recurring' }, ctx);
  assert.deepEqual(nonRecOnly.map((t) => t.id).sort(), ['t1', 't2']);

  // Notes & Tax flags
  const notesOnly = applyAdvancedTransactionFilter(sampleTxs, { ...DEFAULT_ADVANCED_FILTER, hasNotesOnly: true }, ctx);
  assert.deepEqual(notesOnly.map((t) => t.id), ['t1']);

  const taxOnly = applyAdvancedTransactionFilter(sampleTxs, { ...DEFAULT_ADVANCED_FILTER, hasTaxOrFeeOnly: true }, ctx);
  assert.deepEqual(taxOnly.map((t) => t.id), ['t2']);

  // Account visibility
  const privOnly = applyAdvancedTransactionFilter(sampleTxs, { ...DEFAULT_ADVANCED_FILTER, accountVisibility: 'private' }, ctx);
  assert.deepEqual(privOnly.map((t) => t.id), ['t3']);

  // Amount range uses effective amount (t2 = 500 + 50 = 550)
  const rangeTxs = applyAdvancedTransactionFilter(sampleTxs, { ...DEFAULT_ADVANCED_FILTER, minAmount: 520, maxAmount: 600 }, ctx);
  assert.deepEqual(rangeTxs.map((t) => t.id), ['t2']);

  // All 4 sortBy orders
  assert.deepEqual(applyAdvancedTransactionFilter(sampleTxs, { ...DEFAULT_ADVANCED_FILTER, sortBy: 'date_desc' }, ctx).map((t) => t.id), ['t2', 't3', 't1']);
  assert.deepEqual(applyAdvancedTransactionFilter(sampleTxs, { ...DEFAULT_ADVANCED_FILTER, sortBy: 'date_asc' }, ctx).map((t) => t.id), ['t1', 't3', 't2']);
  assert.deepEqual(applyAdvancedTransactionFilter(sampleTxs, { ...DEFAULT_ADVANCED_FILTER, sortBy: 'amount_desc' }, ctx).map((t) => t.id), ['t2', 't3', 't1']);
  assert.deepEqual(applyAdvancedTransactionFilter(sampleTxs, { ...DEFAULT_ADVANCED_FILTER, sortBy: 'amount_asc' }, ctx).map((t) => t.id), ['t1', 't3', 't2']);

  // Filter counter helper
  const cnt = countActiveAdvancedFilters({
    ...DEFAULT_ADVANCED_FILTER,
    categoryIds: ['cat_food'],
    minAmount: 100,
    hasNotesOnly: true,
    sortBy: 'amount_desc',
  });
  assert.equal(cnt, 4);
});

// ============================================================================
// 9. Channel Release Notes Isolation & Plain-Language Jargon Guard
// ============================================================================
test('9. Beta release notes (2.0.1, 2.0.3 & 2.0.4) stay hidden on Stable, visible on Beta, and pass jargon rules', () => {
  const stableNotes = getReleaseNotesForChannel(APP_RELEASE_NOTES, false);
  const betaNotes = getReleaseNotesForChannel(APP_RELEASE_NOTES, true);

  for (const ver of ['2.0.1', '2.0.3', '2.0.4']) {
    assert.equal(stableNotes.some((n) => n.version === ver), false, `Stable hides ${ver} beta note`);
    const note = betaNotes.find((n) => n.version === ver);
    assert.ok(note, `Beta includes ${ver} note`);
    assert.equal(note.isBeta, true, `${ver} marked isBeta: true`);

    const JARGON_WORDS = [
      'api', 'firebase', 'rtdb', 'tdz', 'hook', 'hooks', 'refactor', 'refactored', 'refactoring',
      'bundle', 'bundled', 'cache', 'cached', 'service worker', 'commit', 'commits',
    ];
    const JARGON_PATTERNS: Array<[RegExp, string]> = [
      [/\b[\w./-]+\.(tsx?|jsx?|mjs|cjs|json|css|html|md|yml|yaml)\b/i, 'file extension'],
      [/`[^`]*`/, 'inline code'],
      [/\b[a-z]+[A-Z][A-Za-z0-9]*\b/, 'camelCase'],
      [/\b[A-Za-z0-9]+_[A-Za-z0-9_]+\b/, 'snake_case'],
      [/\w+\(\)/, 'function call'],
      [/\$\{[^}]*\}/, 'template expr'],
      [/\b[\w-]+\/[\w-]+\//, 'path'],
    ];

    const textsToCheck = [
      note.title.en,
      note.title.ar,
      ...note.highlights.en,
      ...note.highlights.ar,
    ];
    for (const txt of textsToCheck) {
      const lower = txt.toLowerCase();
      for (const w of JARGON_WORDS) {
        const re = new RegExp(`(^|[^a-z])${w.replace(' ', '\\s+')}([^a-z]|$)`, 'i');
        assert.equal(re.test(lower), false, `Forbidden jargon word "${w}" found in: ${txt}`);
      }
      for (const [re, label] of JARGON_PATTERNS) {
        assert.equal(re.test(txt), false, `Forbidden ${label} found in: ${txt}`);
      }
    }
  }
});

// ============================================================================
// 10. One-Off/Outings Isolation from Spent Today, Live Obligation Math & Public/Private/All Accounts
// ============================================================================
test('10. One-Off/Outings keep Spent Today isolated, reserve unpaid obligations across linked accounts, and honor Public/Private/All', () => {
  // 2026-11-18 with startDay=1 -> cycle Nov 1..30 (13 remaining days: Nov 18..30)
  const asOf = new Date(2026, 10, 18, 12, 0, 0);
  const accs: Account[] = [
    pubAcc('acc_home', 1090),
    pubAcc('acc_telda', 48.65),
    pubAcc('acc_bm', 1521.01),
    pubAcc('acc_cash', 110),
    privAcc('acc_priv', 5000),
  ]; // 4 public accounts sum = 2,769.66 EGP

  const txs: Transaction[] = [
    mkTx({ id: 'tx_inc', type: 'income', amount: 1130, date: '2026-11-05', accountId: 'acc_home', description: 'Freelance' }),
    mkTx({ id: 'tx_sav', type: 'expense', amount: 1000, date: '2026-11-02', accountId: 'acc_bm', budgetPool: 'savings' }),
    mkTx({ id: 'tx_fix', type: 'expense', amount: 930.61, date: '2026-11-04', accountId: 'acc_bm', budgetPool: 'fixed' }),
    mkTx({ id: 'tx_out', type: 'expense', amount: 1050.5, date: '2026-11-10', accountId: 'acc_telda', budgetPool: 'outings' }),
    mkTx({ id: 'tx_oo_today', type: 'expense', amount: 1623.9, date: '2026-11-18', accountId: 'acc_bm', budgetPool: 'oneoff' }),
    mkTx({ id: 'tx_d_prev', type: 'expense', amount: 661, date: '2026-11-12', accountId: 'acc_home', budgetPool: 'daily' }),
    mkTx({ id: 'tx_d_today', type: 'expense', amount: 15, date: '2026-11-18', accountId: 'acc_cash', budgetPool: 'daily' }),
    mkTx({ id: 'tx_priv_exp', type: 'expense', amount: 400, date: '2026-11-18', accountId: 'acc_priv', budgetPool: 'daily' }),
  ];

  const publicIds = ['acc_home', 'acc_telda', 'acc_bm', 'acc_cash'];
  const pubCfg: SmartBudgetConfig = {
    startDay: 1,
    cycleStartMode: 'app_default',
    calculationMode: 'full_cycle',
    plannedIncome: 6100,
    savings: { type: 'fixed', value: 1000 },
    plannedFixedObligations: 2700,
    outingsBudget: 700,
    oneOffBudget: 0,
    oneOffFundingSource: 'daily',
    includedAccountIds: publicIds,
    includePrivateAccounts: false,
    baseCurrency: 'EGP',
  };

  const ePub = evaluateSmartBudget(txs, accs, pubCfg, asOf);
  assert.equal(ePub.pools.total.income, 7230, 'Cycle total includes +1130 public income');
  approxEqual(ePub.pools.daily.allocated, 2830, 0.01, 'Daily allocated = 7230 - 4400');
  approxEqual(ePub.pools.oneoff.spent, 1623.9, 0.01, 'One-Off tracks 1,623.90');
  approxEqual(ePub.pools.daily.spent, 676, 0.01, 'Daily spent = 661 + 15 only (no One-Off/Outings spillover)');
  approxEqual(ePub.dailyStatus.todaySpent, 15, 0.01, 'Spent Today strictly excludes today One-Off tx');
  approxEqual(ePub.pools.daily.remaining, 1000.27, 0.02, 'Net remaining = 2,769.66 live - 1,769.39 unpaid Bills');
  approxEqual(ePub.dailyStatus.todayAllowance, 78.1, 0.02, 'Allowed Today = (1,000.27 + 15.00) / 13');
  approxEqual(ePub.dailyStatus.todayRemaining, 63.1, 0.02, 'Remaining Today = 78.10 - 15.00');

  // Private Only shortcut (excludes public Bills/Outings txs, so 2700 Bills + 700 Outings remain unpaid -> 5000 - 3400 = 1600)
  const ePriv = evaluateSmartBudget(
    txs,
    accs,
    { ...pubCfg, includedAccountIds: ['acc_priv'], includePrivateAccounts: true },
    asOf
  );
  approxEqual(ePriv.dailyStatus.todaySpent, 400, 0.01, 'Private Only includes private today daily spend (400)');
  approxEqual(ePriv.pools.daily.remaining, 1600, 0.02, 'Private Only uses 5,000 private balance - 3,400 unpaid obligations');

  // All accounts shortcut
  const eAll = evaluateSmartBudget(
    txs,
    accs,
    { ...pubCfg, includedAccountIds: [...publicIds, 'acc_priv'], includePrivateAccounts: true },
    asOf
  );
  approxEqual(eAll.dailyStatus.todaySpent, 415, 0.01, 'All includes both public (15) + private (400) today daily spend');
  approxEqual(eAll.pools.daily.remaining, 7769.66 - 1769.39, 0.02, 'All combines 7,769.66 live cash - unpaid Bills');

  // Even without includedAccountIds, same-day Outings & One-Off excess spreads evenly and keeps Spent Today = 0
  const plainEval = evaluateSmartBudget(
    [
      mkTx({ id: 'p_out', type: 'expense', amount: 500, date: '2026-11-18', accountId: 'acc_home', budgetPool: 'outings' }),
      mkTx({ id: 'p_oo', type: 'expense', amount: 800, date: '2026-11-18', accountId: 'acc_home', budgetPool: 'oneoff' }),
    ],
    accs,
    {
      startDay: 1,
      calculationMode: 'full_cycle',
      plannedIncome: 10000,
      savings: { type: 'fixed', value: 1000 },
      plannedFixedObligations: 2000,
      outingsBudget: 200,
      oneOffBudget: 0,
      baseCurrency: 'EGP',
    },
    asOf
  );
  assert.equal(plainEval.dailyStatus.todaySpent, 0, 'Same-day Outings/One-Off excess keeps Spent Today = 0');
  assert.ok(plainEval.dailyStatus.todayRemaining > 0, 'Same-day Outings/One-Off excess leaves today positive across 13 days');
});

// ============================================================================
// 11. Advisor Message Language Resolution & Friendly Impact / What-If Output
// ============================================================================
test('11. Advisor message language resolves independently and produces friendly ar_eg & en impact/what-if copy', () => {
  assert.equal(resolveMessageLanguage({ language: 'en', messageLanguage: 'app' }), 'en');
  assert.equal(resolveMessageLanguage({ language: 'ar', messageLanguage: 'app' }), 'ar_eg');
  assert.equal(resolveMessageLanguage({ language: 'en', messageLanguage: 'ar_eg' }), 'ar_eg');
  assert.equal(resolveMessageLanguage({ language: 'ar', messageLanguage: 'en' }), 'en');
  assert.equal(resolveMessageLanguage({ language: 'en' }), 'en');
  assert.equal(resolveMessageLanguage({ language: 'ar' }), 'ar_eg');

  const asOf = new Date(2026, 10, 18, 12, 0, 0);
  const accs: Account[] = [pubAcc('acc_main', 3500)];
  const txs: Transaction[] = [
    mkTx({ id: 'tx_food', type: 'expense', amount: 120, date: '2026-11-18', accountId: 'acc_main', budgetPool: 'daily' }),
  ];
  const cfg: SmartBudgetConfig = {
    startDay: 1,
    calculationMode: 'full_cycle',
    plannedIncome: 6000,
    savings: { type: 'fixed', value: 1000 },
    plannedFixedObligations: 1500,
    outingsBudget: 600,
    oneOffBudget: 300,
    oneOffFundingSource: 'daily',
    baseCurrency: 'EGP',
  };

  const draft = {
    type: 'expense' as const,
    amount: 450,
    date: '2026-11-18',
    accountId: 'acc_main',
    budgetPool: 'daily' as const,
  };

  const arImpact = analyzeTransactionImpact(draft, null, txs, accs, cfg, 'ar_eg', asOf);
  const enImpact = analyzeTransactionImpact(draft, null, txs, accs, cfg, 'en', asOf);
  assert.ok(arImpact && enImpact, 'Both impact reports exist');

  assert.ok(/[\u0600-\u06FF]/.test(arImpact.headline), 'ar_eg impact headline uses Arabic text');
  assert.ok(/[\u0600-\u06FF]/.test(arImpact.metrics.simpleOutlookLabel), 'ar_eg simpleOutlookLabel uses Arabic');
  assert.ok(arImpact.detailedMessages.length >= 1 && arImpact.recommendation.length > 0, 'ar_eg bullets and tip present');

  assert.equal(/[\u0600-\u06FF]/.test(enImpact.headline), false, 'en impact headline contains no Arabic chars');
  assert.equal(/[\u0600-\u06FF]/.test(enImpact.metrics.simpleOutlookLabel), false, 'en simpleOutlookLabel contains no Arabic chars');
  assert.ok(enImpact.detailedMessages.length >= 1 && enImpact.recommendation.length > 0, 'en bullets and tip present');

  const baseEval = evaluateSmartBudget(txs, accs, cfg, asOf);
  const arSim = simulateWhatIfScenario(
    { mode: 'single_expense', amount: 500, pool: 'outings' },
    baseEval,
    txs,
    accs,
    cfg,
    'ar_eg',
    asOf
  );
  const enSim = simulateWhatIfScenario(
    { mode: 'single_expense', amount: 500, pool: 'outings' },
    baseEval,
    txs,
    accs,
    cfg,
    'en',
    asOf
  );

  assert.ok(/[\u0600-\u06FF]/.test(arSim.headline), 'ar_eg What-If headline uses Arabic');
  assert.ok(/[\u0600-\u06FF]/.test(arSim.recommendation), 'ar_eg What-If recommendation uses Arabic');
  assert.equal(/[\u0600-\u06FF]/.test(enSim.headline), false, 'en What-If headline contains no Arabic');
  assert.equal(/[\u0600-\u06FF]/.test(enSim.recommendation), false, 'en What-If recommendation contains no Arabic');
  assert.equal(arSim.poolComparison.length, 3, 'ar_eg What-If includes 3-way pool comparison');
  assert.equal(enSim.poolComparison.length, 3, 'en What-If includes 3-way pool comparison');
});

console.log(`\n[solv] ALL ${passed} VERIFICATION SUITES PASSED ✓\n`);
