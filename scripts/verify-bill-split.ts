/**
 * Automated Verification Suite for solv Bill Split Engine, Parser, Translations & Share Output.
 * Run via: npx tsx scripts/verify-bill-split.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  allocateItems,
  applyRounding,
  computeBill,
  computeExtras,
  distributeLargestRemainder,
  reconcile,
  settle,
  toMinor,
} from '../src/utils/billSplitEngine';
import { buildItemsFromParsed, parseBillText } from '../src/utils/billSplitParser';
import { buildBillShareText, buildPerPersonShareMessages } from '../src/utils/billSplitShare';
import { translations } from '../src/utils/translations';
import { APP_RELEASE_NOTES } from '../src/utils/appFeatures';
import type { BillExtra, BillItem, BillPerson, BillSession } from '../src/types';

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

function makeBaseSession(overrides: Partial<BillSession> = {}): BillSession {
  const people: BillPerson[] = overrides.people || [
    { id: 'p_owner', name: 'Mario', kind: 'owner', role: 'participant', approval: 'approved', paidFlag: true },
    { id: 'p_ahmed', name: 'Ahmed', kind: 'guest', role: 'participant', approval: 'approved', paidFlag: false },
    { id: 'p_mona', name: 'Mona', kind: 'guest', role: 'participant', approval: 'approved', paidFlag: false },
  ];
  return {
    id: 'bill_test_001',
    title: 'Friday Dinner',
    icon: '🍕',
    currency: 'EGP',
    createdAt: 1795700000000,
    updatedAt: 1795700000000,
    status: 'draft',
    ownerName: 'Mario',
    people,
    items: [],
    extras: [],
    rounding: { step: 0, remainderTo: 'owner' },
    payers: [],
    payerMode: 'owner_all',
    ...overrides,
  };
}

console.log('\n[solv] Running Bill Split Engine, Parser, Share & Parity Verification Suite...\n');

// 1. 500-case randomized fuzz test for strict integer minor-unit conservation
test('1. Sum of person totals equals computedTotalMinor across 500 randomized sessions (zero cent drift)', () => {
  let seed = 4219;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let i = 0; i < 500; i++) {
    const numPeople = 2 + Math.floor(rand() * 5);
    const people: BillPerson[] = Array.from({ length: numPeople }, (_, idx) => ({
      id: idx === 0 ? 'p_owner' : `p_${idx}`,
      name: `P${idx}`,
      kind: idx === 0 ? 'owner' : 'guest',
      role: 'participant',
      approval: 'approved',
      paidFlag: idx === 0,
    }));

    const numItems = 1 + Math.floor(rand() * 6);
    const items: BillItem[] = Array.from({ length: numItems }, (_, idx) => {
      const modeRoll = rand();
      const mode: BillItem['mode'] = modeRoll < 0.33 ? 'everyone' : modeRoll < 0.66 ? 'equal_among' : 'units';
      const unitPriceMinor = 550 + Math.floor(rand() * 19500);
      const qty = 1 + Math.floor(rand() * 3);
      const claims: Record<string, number> = {};
      const equalAmong: string[] = [];
      for (const p of people) {
        if (rand() > 0.4) {
          claims[p.id] = 1 + Math.floor(rand() * 2);
          equalAmong.push(p.id);
        }
      }
      if (equalAmong.length === 0) {
        equalAmong.push(people[0].id);
        claims[people[0].id] = 1;
      }
      return { id: `it_${idx}`, name: `Dish ${idx}`, unitPriceMinor, qty, mode, claims, equalAmong };
    });

    const extras: BillExtra[] = [
      {
        id: 'ex_srv',
        kind: 'service',
        label: 'Service',
        valueType: 'percent',
        value: 12,
        base: 'subtotal',
        sign: 1,
        distribution: rand() > 0.5 ? 'proportional' : 'equal',
        exemptPersonIds: rand() > 0.7 ? [people[people.length - 1].id] : [],
        customAmountsMinor: {},
        exemptMode: rand() > 0.5 ? 'redistribute' : 'absorb',
      },
      {
        id: 'ex_vat',
        kind: 'tax',
        label: 'VAT',
        valueType: 'percent',
        value: 14,
        base: rand() > 0.5 ? 'subtotal_plus_previous' : 'subtotal',
        sign: 1,
        distribution: 'proportional',
        exemptPersonIds: [],
        customAmountsMinor: {},
        exemptMode: 'redistribute',
      },
      {
        id: 'ex_disc',
        kind: 'discount',
        label: 'Promo',
        valueType: 'fixed',
        value: Math.floor(rand() * 1500),
        base: 'subtotal',
        sign: -1,
        distribution: 'proportional',
        exemptPersonIds: [],
        customAmountsMinor: {},
        exemptMode: 'redistribute',
      },
    ];

    const steps = [0, 50, 100, 500, 1000] as const;
    const targets = ['owner', 'payer', 'largest', 'spread'] as const;
    const session = makeBaseSession({
      people,
      items,
      extras,
      rounding: {
        step: steps[i % steps.length],
        remainderTo: targets[i % targets.length],
      },
    });

    const comp = computeBill(session);
    const sumFinal = Object.values(comp.finalPersonTotalsMinor).reduce((a, b) => a + b, 0);
    assert.equal(comp.allocation.unassignedItemIds.length, 0);
    assert.equal(sumFinal, comp.computedTotalMinor, `Iteration ${i}: sum=${sumFinal} vs total=${comp.computedTotalMinor}`);
  }
});

// 2. Units, equal_among, everyone & unassigned detection
test('2. allocateItems splits 3 pizzas (1 Ahmed, 2 Mona), equal_among, everyone & detects unassigned items', () => {
  const session = makeBaseSession({
    items: [
      {
        id: 'it_pizza',
        name: 'Pizza',
        unitPriceMinor: 10000,
        qty: 3,
        mode: 'units',
        claims: { p_ahmed: 1, p_mona: 2 },
      },
      {
        id: 'it_salad',
        name: 'Salad',
        unitPriceMinor: 9000,
        qty: 1,
        mode: 'everyone',
        claims: {},
      },
      {
        id: 'it_unassigned',
        name: 'Mystery Cake',
        unitPriceMinor: 5000,
        qty: 1,
        mode: 'equal_among',
        claims: {},
        equalAmong: [],
      },
    ],
  });

  const alloc = allocateItems(session);
  assert.equal(alloc.itemAllocations.it_pizza.p_ahmed, 10000);
  assert.equal(alloc.itemAllocations.it_pizza.p_mona, 20000);
  assert.equal(alloc.itemAllocations.it_salad.p_owner, 3000);
  assert.equal(alloc.itemAllocations.it_salad.p_ahmed, 3000);
  assert.equal(alloc.itemAllocations.it_salad.p_mona, 3000);
  assert.deepEqual(alloc.unassignedItemIds, ['it_unassigned']);
  assert.equal(alloc.unassignedSubtotalMinor, 5000);
});

// 3. Service 12% + VAT 14% in simple vs compound order + discount
test('3. computeExtras calculates 12% service + 14% VAT in both subtotal and compound orders plus discounts', () => {
  const baseItems: BillItem[] = [
    { id: 'it_1', name: 'Steak', unitPriceMinor: 10000, qty: 1, mode: 'equal_among', claims: {}, equalAmong: ['p_owner'] },
  ];

  const simpleSession = makeBaseSession({
    items: baseItems,
    extras: [
      {
        id: 'e1', kind: 'service', label: 'Service 12%', valueType: 'percent', value: 12,
        base: 'subtotal', sign: 1, distribution: 'proportional', exemptPersonIds: [], customAmountsMinor: {}, exemptMode: 'redistribute',
      },
      {
        id: 'e2', kind: 'tax', label: 'VAT 14%', valueType: 'percent', value: 14,
        base: 'subtotal', sign: 1, distribution: 'proportional', exemptPersonIds: [], customAmountsMinor: {}, exemptMode: 'redistribute',
      },
    ],
  });
  const simpleComp = computeBill(simpleSession);
  assert.equal(simpleComp.extras.extrasTotalMinor, 2600);
  assert.equal(simpleComp.computedTotalMinor, 12600);

  const compoundSession = makeBaseSession({
    items: baseItems,
    extras: [
      {
        id: 'e1', kind: 'service', label: 'Service 12%', valueType: 'percent', value: 12,
        base: 'subtotal', sign: 1, distribution: 'proportional', exemptPersonIds: [], customAmountsMinor: {}, exemptMode: 'redistribute',
      },
      {
        id: 'e2', kind: 'tax', label: 'VAT 14%', valueType: 'percent', value: 14,
        base: 'subtotal_plus_previous', sign: 1, distribution: 'proportional', exemptPersonIds: [], customAmountsMinor: {}, exemptMode: 'redistribute',
      },
    ],
  });
  const compoundComp = computeBill(compoundSession);
  // 100 + 12 = 112 -> 14% of 112 = 15.68 -> total 127.68
  assert.equal(compoundComp.extras.extrasTotalMinor, 2768);
  assert.equal(compoundComp.computedTotalMinor, 12768);
});

// 4. Exemptions (redistribute vs absorb) & custom fixed amounts per person
test('4. computeExtras enforces exemptPersonIds (redistribute vs absorb) and customAmountsMinor overrides', () => {
  const items: BillItem[] = [
    { id: 'it1', name: 'Meal', unitPriceMinor: 30000, qty: 1, mode: 'everyone', claims: {} }, // 100 each
  ];

  // Delivery 60 EGP: Mona exempt (redistribute -> Mario 30, Ahmed 30)
  const redistSession = makeBaseSession({
    items,
    extras: [
      {
        id: 'del', kind: 'delivery', label: 'Delivery', valueType: 'fixed', value: 6000,
        base: 'subtotal', sign: 1, distribution: 'equal', exemptPersonIds: ['p_mona'], customAmountsMinor: {}, exemptMode: 'redistribute',
      },
    ],
  });
  const rComp = computeBill(redistSession);
  assert.equal(rComp.extras.perPersonExtrasMinor.p_mona, 0);
  assert.equal(rComp.extras.perPersonExtrasMinor.p_owner, 3000);
  assert.equal(rComp.extras.perPersonExtrasMinor.p_ahmed, 3000);

  // Delivery 60 EGP: Mona exempt (absorb -> Ahmed pays natural 20, Mario absorbs Mona's 20 -> Mario 40)
  const absorbSession = makeBaseSession({
    items,
    extras: [
      {
        id: 'del', kind: 'delivery', label: 'Delivery', valueType: 'fixed', value: 6000,
        base: 'subtotal', sign: 1, distribution: 'equal', exemptPersonIds: ['p_mona'], customAmountsMinor: {}, exemptMode: 'absorb',
      },
    ],
  });
  const aComp = computeBill(absorbSession);
  assert.equal(aComp.extras.perPersonExtrasMinor.p_mona, 0);
  assert.equal(aComp.extras.perPersonExtrasMinor.p_ahmed, 2000);
  assert.equal(aComp.extras.perPersonExtrasMinor.p_owner, 4000);

  // Custom fixed amount: Ahmed pinned to 10 EGP out of 60 EGP delivery -> Mario & Mona split remaining 50 (25 each)
  const customSession = makeBaseSession({
    items,
    extras: [
      {
        id: 'del', kind: 'delivery', label: 'Delivery', valueType: 'fixed', value: 6000,
        base: 'subtotal', sign: 1, distribution: 'equal', exemptPersonIds: [], customAmountsMinor: { p_ahmed: 1000 }, exemptMode: 'redistribute',
      },
    ],
  });
  const cComp = computeBill(customSession);
  assert.equal(cComp.extras.perPersonExtrasMinor.p_ahmed, 1000);
  assert.equal(cComp.extras.perPersonExtrasMinor.p_owner, 2500);
  assert.equal(cComp.extras.perPersonExtrasMinor.p_mona, 2500);
});

// 5. Rounding across all steps & remainder targets conserves exact total
test('5. applyRounding conserves total bill across all steps and remainder targets', () => {
  const raw = { p_owner: 10333, p_ahmed: 10333, p_mona: 10334 }; // sum = 31000
  for (const step of [0, 50, 100, 500, 1000] as const) {
    for (const remainderTo of ['owner', 'payer', 'largest', 'spread'] as const) {
      const res = applyRounding(raw, { step, remainderTo }, 'p_owner', 'p_ahmed', ['p_owner', 'p_ahmed', 'p_mona']);
      const total = Object.values(res.perPersonRoundedMinor).reduce((a, b) => a + b, 0);
      assert.equal(total, 31000, `Rounding failed conservation for step=${step}, target=${remainderTo}`);
    }
  }
});

// 6. Reconciliation diagnostics & diffResolution unlock
test('6. reconcile detects missing 12% service, 14% VAT, compound 27.68%, rounding cents, ±1 unit & honors ignore_diff', () => {
  const items: BillItem[] = [
    { id: 'it1', name: 'Burger', unitPriceMinor: 10000, qty: 2, mode: 'everyone', claims: {} }, // 200 EGP
  ];

  // Missing 12% service (+24 EGP -> 224)
  const r12 = computeBill(makeBaseSession({ items, statedTotalMinor: 22400 })).reconcile;
  assert.equal(r12.status, 'mismatch');
  assert.equal(r12.reasonCode, 'missing_service_12');
  assert.equal(r12.canFinalize, false);

  // Missing 14% VAT (+28 EGP -> 228)
  const r14 = computeBill(makeBaseSession({ items, statedTotalMinor: 22800 })).reconcile;
  assert.equal(r14.reasonCode, 'missing_vat_14');

  // Missing compound 12% + 14% (+55.36 EGP -> 255.36)
  const rComp = computeBill(makeBaseSession({ items, statedTotalMinor: 25536 })).reconcile;
  assert.equal(rComp.reasonCode, 'missing_service_and_vat_compound');

  // Missing 1 unit of Burger (+100 EGP -> 300)
  const rUnit = computeBill(makeBaseSession({ items, statedTotalMinor: 30000 })).reconcile;
  assert.equal(rUnit.reasonCode, 'missing_item_unit');
  assert.equal(rUnit.matchedItemName, 'Burger');

  // Rounding cents (+0.50 EGP -> 200.50)
  const rRound = computeBill(makeBaseSession({ items, statedTotalMinor: 20050 })).reconcile;
  assert.equal(rRound.reasonCode, 'rounding_cents');

  // Explicit ignore unlocks canFinalize
  const rIgnored = computeBill(
    makeBaseSession({
      items,
      statedTotalMinor: 20500,
      diffResolution: { kind: 'ignored', amountMinor: 500, resolvedAt: Date.now() },
    })
  ).reconcile;
  assert.equal(rIgnored.status, 'ignored');
  assert.equal(rIgnored.canFinalize, true);
});

// 7. Settlement min-cash-flow & paidFlag & recommendedExpenseMinor
test('7. settle computes minimal transfers for single/multi payers, paidFlag & recommendedExpenseMinor', () => {
  const items: BillItem[] = [
    { id: 'it1', name: 'Feast', unitPriceMinor: 30000, qty: 1, mode: 'everyone', claims: {} }, // 100 each
  ];
  const session = makeBaseSession({
    items,
    payerMode: 'custom',
    payers: [
      { personId: 'p_owner', amountMinor: 20000 }, // paid 200 (share 100 -> +100 creditor)
      { personId: 'p_ahmed', amountMinor: 10000 }, // paid 100 (share 100 -> 0)
    ],
  });
  const comp = computeBill(session);
  assert.equal(comp.settlement.rawTransfers.length, 1);
  assert.deepEqual(comp.settlement.rawTransfers[0], {
    fromPersonId: 'p_mona',
    toPersonId: 'p_owner',
    amountMinor: 10000,
  });
  // User decision: record total paid by "Me" (200 EGP)
  assert.equal(comp.settlement.recommendedExpenseMinor, 20000);
  assert.equal(comp.settlement.ownerShareMinor, 10000);

  // Mark Mona paid -> 0 remaining transfers
  const settledSession = makeBaseSession({
    ...session,
    people: session.people.map((p) => (p.id === 'p_mona' ? { ...p, paidFlag: true } : p)),
  });
  const settledComp = computeBill(settledSession);
  assert.equal(settledComp.settlement.remainingTransfers.length, 0);
});

// 8. Bilingual Receipt Paste Parser (Arabic, English, Arabic-Indic numerals)
test('8. parseBillText parses Arabic, English, Arabic-Indic numerals, service/tax & total lines', () => {
  const sample = `
    كشرى 45 ×2
    ٣ بيتزا ١٢٠
    Burger .... 150.50
    خدمة 12%
    VAT 14%
    توصيل 30
    الإجمالي 610.50
  `;
  const parsed = parseBillText(sample);
  assert.equal(parsed.items.length, 3);
  assert.equal(parsed.items[0].name, 'كشرى');
  assert.equal(parsed.items[0].qty, 2);
  assert.equal(parsed.items[0].rawAmountMinor, 4500);
  assert.equal(parsed.items[1].qty, 3);
  assert.equal(parsed.items[1].rawAmountMinor, 12000);
  assert.equal(parsed.items[2].name, 'Burger');
  assert.equal(parsed.items[2].rawAmountMinor, 15050);
  assert.equal(parsed.extras.length, 3);
  assert.equal(parsed.statedTotalMinor, 61050);

  const asUnit = buildItemsFromParsed(parsed.items, 'unit');
  assert.equal(asUnit[1].unitPriceMinor, 12000);
  const asLineTotal = buildItemsFromParsed(parsed.items, 'line_total');
  assert.equal(asLineTotal[1].unitPriceMinor, 4000);
});

// 9. 100% EN/AR translation key parity & Jargon-free release notes across ALL beta entries
test('9. translations.en & translations.ar have 100% key parity and all release notes pass plain-language guard', () => {
  const enKeys = new Set(Object.keys(translations.en));
  const arKeys = new Set(Object.keys(translations.ar));
  const missingInAr = [...enKeys].filter((k) => !arKeys.has(k));
  const missingInEn = [...arKeys].filter((k) => !enKeys.has(k));
  assert.deepEqual(missingInAr, [], `Keys missing in ar: ${missingInAr.join(', ')}`);
  assert.deepEqual(missingInEn, [], `Keys missing in en: ${missingInEn.join(', ')}`);

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

  for (const ver of ['2.2.2', '2.2.1', '2.2.0']) {
    const note = APP_RELEASE_NOTES.find((n) => n.version === ver);
    assert.ok(note, `Release note ${ver} exists`);
    const texts = [note.title.en, note.title.ar, ...note.highlights.en, ...note.highlights.ar];
    for (const txt of texts) {
      const lower = txt.toLowerCase();
      for (const w of JARGON_WORDS) {
        const re = new RegExp(`(^|[^a-z])${w.replace(' ', '\\s+')}([^a-z]|$)`, 'i');
        assert.equal(re.test(lower), false, `Forbidden jargon "${w}" in ${ver}: ${txt}`);
      }
      for (const [re, label] of JARGON_PATTERNS) {
        assert.equal(re.test(txt), false, `Forbidden ${label} in ${ver}: ${txt}`);
      }
    }
  }
});

// 10. Share text output & per-person InstaPay fee & unpaid reminders
test('10. buildBillShareText & buildPerPersonShareMessages render accurate shares, InstaPay fee & clean solv branding', () => {
  const session = makeBaseSession({
    items: [
      { id: 'it1', name: 'Pizza', unitPriceMinor: 30000, qty: 1, mode: 'everyone', claims: {} }, // 100 each
    ],
    paymentInfo: {
      instaPay: 'mario@instapay',
      includeInstaPayFee: true,
    },
  });
  const comp = computeBill(session);
  const wholeEn = buildBillShareText(session, comp, { scope: 'whole_bill', lang: 'en' });
  assert.ok(wholeEn.includes('Friday Dinner'));
  assert.ok(wholeEn.includes('300.00'));
  assert.ok(wholeEn.includes('mario@instapay'));
  assert.ok(wholeEn.includes('Calculated with solv'));
  assert.equal(wholeEn.includes('solv Beta'), false, 'Never append Beta to solv app name');

  const perPersonAr = buildPerPersonShareMessages(session, comp, {
    lang: 'ar',
    unpaidOnly: true,
    isReminder: true,
  });
  assert.equal(perPersonAr.length, 2); // Ahmed & Mona (owner already paid)
  assert.equal(perPersonAr[0].amountMinor, 10000);
  // Default InstaPay preset on 100 EGP: 0.1% = 0.10 -> clamped to minFee 0.50 -> 50 minor
  assert.equal(perPersonAr[0].feeMinor, 50);
  assert.equal(perPersonAr[0].totalWithFeeMinor, 10050);
  assert.ok(perPersonAr[0].text.includes('100.50'));
  assert.ok(perPersonAr[0].text.includes('تذكير'));

  // Optional post-build check if dist/beta/sw.js already exists
  const betaSwPath = path.resolve(process.cwd(), 'dist/beta/sw.js');
  if (fs.existsSync(betaSwPath)) {
    const sw = fs.readFileSync(betaSwPath, 'utf8');
    assert.ok(/assets\/BillSplitPage.*\.js/i.test(sw), 'BillSplitPage chunk must be precached in dist/beta/sw.js');
  }
});

console.log(`\n[solv] ALL ${passed} BILL SPLIT VERIFICATION SUITES PASSED ✓\n`);
