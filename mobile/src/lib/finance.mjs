export const currencies = {
  INR: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  VND: 0,
  JPY: 0,
  THB: 2,
  AUD: 2,
  CAD: 2,
  SGD: 2,
  AED: 2,
};
export function assert(ok, message, status = 400) {
  if (!ok) throw Object.assign(new Error(message), { status });
}
export function minor(value, currency) {
  assert(Object.hasOwn(currencies, currency), 'Unsupported currency');
  const decimals = currencies[currency];
  const s = String(value ?? '').trim();
  assert(
    new RegExp(decimals ? `^\\d{1,10}(?:\\.\\d{1,${decimals}})?$` : '^\\d{1,10}$').test(s),
    `Enter a valid ${currency} amount (${decimals} decimal places)`,
  );
  const n = Math.round(Number(s) * 10 ** decimals);
  assert(
    Number.isSafeInteger(n) && n > 0 && n <= 1e12,
    'Amount must be greater than zero and within the limit',
  );
  return n;
}
export function allocate(total, weights) {
  assert(Number.isSafeInteger(total) && total >= 0, 'Invalid allocation total');
  assert(
    weights.length > 0 && weights.every((w) => Number.isFinite(w) && w >= 0),
    'Invalid split values',
  );
  const sum = weights.reduce((a, b) => a + b, 0);
  assert(sum > 0 && Number.isFinite(sum), 'Choose at least one participant');
  const parts = weights.map((w, i) => ({ i, raw: total * (w / sum) }));
  const result = parts.map((p) => Math.floor(p.raw));
  let left = total - result.reduce((a, b) => a + b, 0);
  parts.sort((a, b) => b.raw - Math.floor(b.raw) - (a.raw - Math.floor(a.raw)) || a.i - b.i);
  for (let i = 0; i < left; i++) result[parts[i % parts.length].i]++;
  return result;
}
function participants(rows, trip) {
  assert(Array.isArray(rows) && rows.length > 0 && rows.length <= 100, 'Choose participants');
  assert(
    new Set(rows.map((r) => r.memberId)).size === rows.length,
    'Each member can appear only once',
  );
  assert(
    rows.every((r) => trip.members.some((m) => m.id === r.memberId)),
    'A selected member is not in this group',
  );
}
export function expenseFromInput(input, trip) {
  const currency = input.currency || trip.currency;
  const amount = minor(input.amount, currency);
  const rate = currency === trip.currency ? 1 : Number(input.rate);
  assert(
    Number.isFinite(rate) && rate >= 0.000001 && rate <= 1e6,
    'Enter an exchange rate to the group currency',
  );
  const total = Math.round(
    (amount / 10 ** currencies[currency]) * rate * 10 ** currencies[trip.currency],
  );
  assert(
    Number.isSafeInteger(total) && total > 0 && total <= 1e12,
    'Converted amount is outside the limit',
  );
  const shares = input.shares;
  const payers = input.payers;
  participants(shares, trip);
  participants(payers, trip);
  const mode = input.mode || 'equal';
  assert(['equal', 'exact', 'percent', 'shares'].includes(mode), 'Invalid split method');
  let weights;
  if (mode === 'equal') weights = shares.map(() => 1);
  else if (mode === 'exact') {
    weights = shares.map((s) => (Number(s.value) === 0 ? 0 : minor(s.value, currency)));
    assert(
      weights.reduce((a, b) => a + b, 0) === amount,
      'Exact shares must add up to the expense amount',
    );
  } else {
    weights = shares.map((s) => Number(s.value));
    assert(
      weights.every((w) => Number.isFinite(w) && w >= 0 && w <= 1e9),
      'Enter valid split values',
    );
    if (mode === 'percent')
      assert(
        Math.abs(weights.reduce((a, b) => a + b, 0) - 100) < 0.000001,
        'Percentages must add up to 100',
      );
  }
  const paid =
    payers.length === 1
      ? [amount]
      : payers.map((p) => (Number(p.amount) === 0 ? 0 : minor(p.amount, currency)));
  assert(paid.reduce((a, b) => a + b, 0) === amount, 'Payments must add up to the expense amount');
  const splitAmounts = allocate(total, weights);
  const paidAmounts = allocate(total, paid);
  return {
    currency,
    originalAmount: amount,
    rate,
    amount: total,
    mode,
    shares: shares.map((s, i) => ({
      memberId: s.memberId,
      value: s.value ?? '',
      amount: splitAmounts[i],
    })),
    payers: payers.map((p, i) => ({
      memberId: p.memberId,
      amount: paidAmounts[i],
      originalAmount: paid[i],
    })),
  };
}
export function balances(trip) {
  const rows = Object.fromEntries(
    trip.members.map((m) => [m.id, { ...m, paid: 0, spent: 0, balance: 0 }]),
  );
  for (const e of trip.expenses) {
    for (const p of e.payers) {
      rows[p.memberId].paid += p.amount;
      rows[p.memberId].balance += p.amount;
    }
    for (const s of e.shares) {
      rows[s.memberId].spent += s.amount;
      rows[s.memberId].balance -= s.amount;
    }
  }
  for (const t of trip.transfers) {
    rows[t.from].balance += t.amount;
    rows[t.to].balance -= t.amount;
  }
  return Object.values(rows);
}
export function settlements(trip) {
  const rows = balances(trip);
  const debtors = rows
    .filter((r) => r.balance < 0)
    .map((r) => ({ id: r.id, n: -r.balance }))
    .sort((a, b) => b.n - a.n);
  const creditors = rows
    .filter((r) => r.balance > 0)
    .map((r) => ({ id: r.id, n: r.balance }))
    .sort((a, b) => b.n - a.n);
  const out = [];
  let i = 0,
    j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].n, creditors[j].n);
    out.push({ from: debtors[i].id, to: creditors[j].id, amount });
    debtors[i].n -= amount;
    creditors[j].n -= amount;
    if (!debtors[i].n) i++;
    if (!creditors[j].n) j++;
  }
  return out;
}
