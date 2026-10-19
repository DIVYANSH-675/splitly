import { test } from 'node:test';
import { strict as a } from 'node:assert';
import { minor, allocate, expenseFromInput, balances, settlements } from '../server/finance.mjs';
const group = () => ({
  currency: 'INR',
  members: ['a', 'b', 'c'].map((id) => ({ id, name: id })),
  expenses: [],
  transfers: [],
});
const input = (overrides = {}) => ({
  amount: '100.00',
  currency: 'INR',
  mode: 'equal',
  shares: ['a', 'b', 'c'].map((memberId) => ({ memberId })),
  payers: [{ memberId: 'a' }],
  ...overrides,
});
test('decimal money is stored in exact minor units; JPY/VND accept whole amounts', () => {
  a.equal(minor('0.01', 'INR'), 1);
  a.equal(minor('100.01', 'USD'), 10001);
  a.equal(minor('5000', 'JPY'), 5000);
  a.equal(minor('125000', 'VND'), 125000);
});
test('invalid money and unsupported/prototype currency names are rejected', () => {
  for (const n of ['0', '-1', 'NaN', 'Infinity', '1e5', '1.001', '1,000', '', null])
    a.throws(() => minor(n, 'INR'));
  a.throws(() => minor('1.2', 'JPY'));
  a.throws(() => minor('1', 'toString'));
});
test('rounding remainders preserve every cent', () => {
  a.deepEqual(allocate(10000, [1, 1, 1]), [3334, 3333, 3333]);
  a.deepEqual(allocate(1, [1, 1, 1]), [1, 0, 0]);
  a.deepEqual(allocate(10, [1, 2, 0]), [3, 7, 0]);
});
test('allocations conserve totals across varied amounts, participants and weights', () => {
  for (let total = 1; total < 1000; total += 7)
    for (let n = 1; n <= 31; n++) {
      const parts = allocate(
        total,
        Array.from({ length: n }, (_, i) => (i + 1) ** 2),
      );
      a.equal(
        parts.reduce((x, y) => x + y),
        total,
      );
      a.ok(parts.every(Number.isSafeInteger));
      a.ok(parts.every((x) => x >= 0));
    }
});
test('equal expense and resulting balances sum to zero', () => {
  const g = group();
  const e = expenseFromInput(input(), g);
  a.deepEqual(
    e.shares.map((s) => s.amount),
    [3334, 3333, 3333],
  );
  g.expenses.push(e);
  a.deepEqual(
    balances(g).map((x) => x.balance),
    [6666, -3333, -3333],
  );
});
test('exact shares and multiple payers must match the total', () => {
  const g = group();
  const e = expenseFromInput(
    input({
      mode: 'exact',
      shares: [
        { memberId: 'b', value: '40' },
        { memberId: 'c', value: '60' },
      ],
      payers: [
        { memberId: 'a', amount: '75' },
        { memberId: 'b', amount: '25' },
      ],
    }),
    g,
  );
  g.expenses.push(e);
  a.deepEqual(
    balances(g).map((b) => b.balance),
    [7500, -1500, -6000],
  );
  a.throws(() =>
    expenseFromInput(input({ mode: 'exact', shares: [{ memberId: 'b', value: '90' }] }), g),
  );
  a.throws(() =>
    expenseFromInput(
      input({
        payers: [
          { memberId: 'a', amount: '20' },
          { memberId: 'b', amount: '50' },
        ],
      }),
      g,
    ),
  );
});
test('percentage and weighted shares; invalid percentages rejected', () => {
  const g = group();
  a.deepEqual(
    expenseFromInput(
      input({
        mode: 'percent',
        shares: [
          { memberId: 'a', value: '25' },
          { memberId: 'b', value: '75' },
        ],
      }),
      g,
    ).shares.map((s) => s.amount),
    [2500, 7500],
  );
  a.deepEqual(
    expenseFromInput(
      input({
        mode: 'shares',
        shares: [
          { memberId: 'a', value: 1 },
          { memberId: 'b', value: 3 },
        ],
      }),
      g,
    ).shares.map((s) => s.amount),
    [2500, 7500],
  );
  a.throws(() =>
    expenseFromInput(input({ mode: 'percent', shares: [{ memberId: 'a', value: 99 }] }), g),
  );
});
test('foreign currency uses a fixed conversion rate and rounded base allocations', () => {
  const e = expenseFromInput(input({ amount: '10.01', currency: 'USD', rate: 83.5 }), group());
  a.equal(e.amount, 83584);
  a.equal(
    e.shares.reduce((n, s) => n + s.amount, 0),
    e.amount,
  );
  a.equal(
    e.payers.reduce((n, p) => n + p.amount, 0),
    e.amount,
  );
  a.throws(() => expenseFromInput(input({ currency: 'USD', rate: 0 }), group()));
});
test('duplicate and non-group participants rejected', () => {
  a.throws(() =>
    expenseFromInput(input({ shares: [{ memberId: 'a' }, { memberId: 'a' }] }), group()),
  );
  a.throws(() => expenseFromInput(input({ payers: [{ memberId: 'outsider' }] }), group()));
  a.throws(() => expenseFromInput(input({ shares: [] }), group()));
});
test('suggested transfers extinguish every debt without changing spending', () => {
  const g = group();
  g.expenses.push(expenseFromInput(input(), g));
  const before = balances(g).map((x) => x.spent);
  const transfers = settlements(g);
  a.equal(
    transfers.reduce((n, t) => n + t.amount, 0),
    6666,
  );
  g.transfers.push(...transfers);
  a.deepEqual(
    balances(g).map((x) => x.balance),
    [0, 0, 0],
  );
  a.deepEqual(
    balances(g).map((x) => x.spent),
    before,
  );
  a.deepEqual(settlements(g), []);
});
