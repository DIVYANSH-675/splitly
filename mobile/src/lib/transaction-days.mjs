// Group by the recorded calendar day, never by UTC conversion or upload time.
export function transactionDays(expenses, transfers) {
  const days = new Map();
  const rows = [
    ...expenses.map((entry) => ({ kind: 'bill', entry })),
    ...transfers.map((entry) => ({ kind: 'transfer', entry })),
  ];
  for (const row of rows) {
    const value = String(row.entry.date || '');
    const parsed = Date.parse(`${value}T12:00:00Z`);
    const day =
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(parsed) &&
      new Date(parsed).toISOString().slice(0, 10) === value
        ? value
        : '';
    if (!days.has(day)) days.set(day, []);
    days.get(day).push(row);
  }
  return [...days]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, entries]) => ({
      date,
      entries: entries.sort((a, b) =>
        String(b.entry.createdAt || '').localeCompare(String(a.entry.createdAt || '')),
      ),
    }));
}
