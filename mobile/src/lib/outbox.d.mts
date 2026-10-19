import type { PendingBill, Trip } from './types';
export class Outbox {
  constructor(
    storage: {
      getItem(k: string): Promise<string | null>;
      setItem(k: string, v: string): Promise<void>;
    },
    key: string,
  );
  items: PendingBill[];
  load(): Promise<PendingBill[]>;
  put(item: PendingBill): Promise<void>;
  remove(id: string): Promise<void>;
  flush(
    send: (item: PendingBill) => Promise<Trip>,
    onSaved: (trip: Trip) => void | Promise<void>,
  ): Promise<void>;
}
