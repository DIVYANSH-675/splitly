import { currencies } from './finance.mjs';
const amount = (n, c) => `${c} ${(n / 10 ** currencies[c]).toFixed(currencies[c])}`;
export function auditSnapshot(trip) {
  const result = {};
  const put = (key, label, value) => {
    result[key] = { label, value: String(value ?? '') };
  };
  const name = (id) => trip.members.find((m) => m.id === id)?.name || 'Former member';
  put('name', 'Group name', trip.name);
  put('currency', 'Currency', trip.currency);
  put('categories', 'Group categories', (trip.categories || []).join(', '));
  for (const m of trip.members)
    put(`member:${m.id}`, 'Member', `${m.name}${m.userId ? ' (joined)' : ' (guest)'}`);
  for (const e of trip.expenses) {
    const fields = {
      Title: e.title,
      Amount: amount(e.amount, trip.currency),
      Category: e.category,
      Date: e.date,
      'Original amount': amount(e.originalAmount, e.currency),
      'Exchange rate': e.rate,
      'Split method': e.mode,
      Note: e.note,
      Attachments: (e.attachments || []).map(file => file.name).join(', '),
      'Paid by': e.payers
        .map((p) => `${name(p.memberId)}: ${amount(p.amount, trip.currency)}`)
        .join(', '),
      Shares: e.shares
        .map((s) => `${name(s.memberId)}: ${amount(s.amount, trip.currency)}`)
        .join(', '),
    };
    for (const [field, value] of Object.entries(fields))
      put(`bill:${e.id}:${field}`, `Bill “${e.title}” · ${field}`, value);
  }
  for (const t of trip.transfers) {
    for (const [field, value] of Object.entries({
      From: name(t.from),
      To: name(t.to),
      Amount: amount(t.amount, trip.currency),
      Date: t.date,
      Note: t.note,
    }))
      put(`transfer:${t.id}:${field}`, `Transfer · ${field}`, value);
  }
  return result;
}
export function auditChanges(before, after) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => before[key]?.value !== after[key]?.value)
    .map((key) => ({
      field: (after[key] || before[key]).label,
      before: before[key]?.value || '',
      after: after[key]?.value || '',
    }));
}
