import type { PendingBill, Trip } from './types';
export class Outbox<T = PendingBill, R = Trip> {
  constructor(
    storage: {
      getItem(k: string): Promise<string | null>;
      setItem(k: string, v: string): Promise<void>;
    },
    key: string,
  );
  items: T[];
  load(): Promise<T[]>;
  put(item: T): Promise<void>;
  remove(id: string): Promise<void>;
  flush(
    send: (item: T) => Promise<R>,
    onSaved: (trip: R) => void | Promise<void>,
  ): Promise<void>;
}
