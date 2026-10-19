export type Attachment = { id: string; name: string; mime: string; size: number; localUri?: string };
export type User = { backupEmail?: string; username?: string; photo?: string; id: string; name: string; email: string; guest: boolean };
export type Member = { username?: string; photo?: string; id: string; name: string; linked: boolean };
export type Expense = {
  id: string;
  createdBy: string;
  attachments?: Attachment[];
  createdAt?: string;
  title: string;
  date: string;
  category: string;
  note: string;
  currency: string;
  originalAmount: number;
  rate: number;
  amount: number;
  mode: string;
  shares: { memberId: string; amount: number; value: string }[];
  payers: { memberId: string; amount: number; originalAmount: number }[];
};
export type Transfer = {
  id: string;
  createdBy: string;
  from: string;
  to: string;
  amount: number;
  date: string;
  note: string;
};
export type Trip = {
  localOnly?: boolean;
  categories?: string[];
  version: number;
  id: string;
  name: string;
  code: string;
  ownerId: string;
  isOwner: boolean;
  me: string;
  currency: string;
  total: number;
  updatedAt: string;
  members: Member[];
  expenses: Expense[];
  transfers: Transfer[];
  activity: Activity[];
  balances: (Member & { paid: number; spent: number; balance: number })[];
  settlements: { from: string; to: string; amount: number }[];
};
export const currencies: Record<string, number> = {
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
export const money = (n: number, currency: string) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: currencies[currency],
    minimumFractionDigits: currencies[currency],
  }).format(n / 10 ** currencies[currency]);
export const inputMoney = (n: number, c: string) =>
  (n / 10 ** currencies[c]).toFixed(currencies[c]);
export const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const prettyDate = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
export type Activity = {
  id: string;
  user: string;
  userId?: string;
  message: string;
  at: string;
  changes?: { field: string; before: string; after: string }[];
};
export type BillInput = {
  attachments?: Attachment[];
  title: string;
  amount: string;
  currency: string;
  rate: number;
  date: string;
  category: string;
  note: string;
  mode: string;
  shares: { memberId: string; value: string }[];
  payers: { memberId: string; amount: string }[];
};
export type PendingBill = {
  id: string;
  tripId: string;
  body: BillInput;
  createdAt: string;
  error?: string;
};

export type PendingAction = {id:string; path:string; method:string; body:Record<string, unknown>; createdAt:string; error?:string};
