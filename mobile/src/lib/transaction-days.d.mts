import type { Expense, Transfer } from './types';
export type DatedTransaction =
  { kind: 'bill'; entry: Expense } | { kind: 'transfer'; entry: Transfer };
export function transactionDays(
  expenses: Expense[],
  transfers: Transfer[],
): { date: string; entries: DatedTransaction[] }[];
