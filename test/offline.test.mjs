import { test } from 'node:test';
import { strict as a } from 'node:assert';
import { Outbox } from '../mobile/src/lib/outbox.mjs';
const storage = () => {
  const data = new Map();
  return {
    getItem: async (k) => data.get(k) || null,
    setItem: async (k, v) => {
      data.set(k, v);
    },
  };
};
const bill = (id = 'bill_local_1234567890') => ({
  id,
  tripId: 'group',
  body: { title: 'Offline dinner', amount: '900' },
  createdAt: new Date().toISOString(),
});
test('offline queue survives restart, network failures and retry with the same ID', async () => {
  const disk = storage();
  let box = new Outbox(disk, 'userA');
  await box.put(bill());
  box = new Outbox(disk, 'userA');
  a.equal((await box.load()).length, 1);
  const seen = [];
  await box.flush(
    async (item) => {
      seen.push(item.id);
      throw new Error('offline');
    },
    () => a.fail('Must not report saved'),
  );
  a.equal((await box.load()).length, 1);
  await box.flush(
    async (item) => {
      seen.push(item.id);
      return { id: 'group' };
    },
    () => {},
  );
  a.deepEqual(seen, [bill().id, bill().id]);
  a.equal((await new Outbox(disk, 'userA').load()).length, 0);
});
test('validation failures remain visible; edited drafts can be retried; accounts stay isolated', async () => {
  const disk = storage(),
    box = new Outbox(disk, 'userA');
  await box.put(bill());
  await box.flush(
    async () => {
      throw Object.assign(new Error('Wrong split'), { status: 400 });
    },
    () => {},
  );
  a.equal((await box.load())[0].error, 'Wrong split');
  await box.flush(
    () => a.fail('Invalid draft should wait for correction'),
    () => {},
  );
  await box.put({ ...bill(), body: { title: 'Corrected', amount: '900' } });
  a.equal((await box.load())[0].error, '');
  a.deepEqual(await new Outbox(disk, 'userB').load(), []);
  await box.flush(
    async () => ({ id: 'group' }),
    () => {},
  );
  a.deepEqual(await box.load(), []);
});
test('concurrent syncs send once and do not lose another queued bill', async () => {
  const box = new Outbox(storage(), 'user');
  await box.put(bill());
  let release;
  const gate = new Promise((r) => {
    release = r;
  });
  let count = 0;
  const send = async () => {
    count++;
    await gate;
    return { id: 'group' };
  };
  const first = box.flush(send, () => {});
  await Promise.resolve();
  await Promise.resolve();
  const second = box.flush(send, () => {});
  await a.rejects(() => box.put(bill()), /syncing/);
  await box.put(bill('bill_second_123456789'));
  release();
  await Promise.all([first, second]);
  a.equal(count, 1);
  a.equal((await box.load())[0].id, 'bill_second_123456789');
});
test('storage failure never acknowledges a saved offline bill', async () => {
  const box = new Outbox(
    {
      getItem: async () => null,
      setItem: async () => {
        throw new Error('disk full');
      },
    },
    'user',
  );
  await a.rejects(() => box.put(bill()), /disk full/);
  a.deepEqual(await box.load(), []);
});
