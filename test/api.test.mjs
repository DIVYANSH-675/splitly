import { test } from 'node:test';
import { strict as a } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/index.mjs';

test('shared group lifecycle: access, bills, settlements, removed features, legacy persistence', async (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'splitly-test-'));
  const database = join(folder, 'test.sqlite');
  let app = createApp({ database });
  const start = async () => {
    await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
    return `http://127.0.0.1:${app.server.address().port}/api`;
  };
  let base = await start();
  t.after(async () => {
    await new Promise((r) => app.server.close(r));
    app.db.close();
    rmSync(folder, { recursive: true, force: true });
  });
  const request = async (path, method = 'GET', body, token, expected = 200) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json();
    a.equal(response.status, expected, JSON.stringify(data));
    return data;
  };
  const register = (name) =>
    request('/register', 'POST', {
      name,
      email: `${name}@example.com`,
      password: 'a-test-password',
    });
  const alice = await register('alice'),
    bob = await register('bob'),
    eve = await register('eve');
  await request(
    '/login',
    'POST',
    { email: 'alice@example.com', password: 'bad-password' },
    null,
    401,
  );
  await request('/trips', 'GET', undefined, null, 401);
  let trip = await request(
    '/trips',
    'POST',
    {
      name: 'Flatmates',
      currency: 'INR',
    },
    alice.token,
    201,
  );
  const path = `/trips/${trip.id}`;
  await request(path, 'GET', undefined, eve.token, 403);
  a.deepEqual(await request('/trips', 'GET', undefined, eve.token), []);
  trip = await request('/join', 'POST', { code: trip.code.toLowerCase() }, bob.token);
  a.equal(trip.members.length, 2);
  a.equal(trip.isOwner, false);
  a.equal((await request('/join', 'POST', { code: trip.code }, bob.token)).members.length, 2);
  const aid = trip.members.find((m) => m.name === 'alice').id,
    bid = trip.members.find((m) => m.name === 'bob').id;
  a.ok(trip.members.every((m) => !('userId' in m)));
  await request(`${path}/members`, 'POST', { name: 'uninvited' }, bob.token, 403);
  const entry = {
    title: 'Dinner',
    amount: '1000.01',
    currency: 'INR',
    category: 'Food & drinks',
    date: '2026-10-24',
    mode: 'equal',
    shares: [{ memberId: aid }, { memberId: bid }],
    payers: [{ memberId: aid }],
  };
  trip = await request(`${path}/expenses`, 'POST', entry, bob.token);
  a.equal(trip.total, 100001);
  a.equal(
    trip.balances.reduce((n, b) => n + b.balance, 0),
    0,
  );
  const expenseId = trip.expenses[0].id;
  trip = await request(
    `${path}/expenses/${expenseId}`,
    'PATCH',
    { ...entry, amount: '1200' },
    bob.token,
  );
  a.equal(trip.total, 120000);
  a.equal(trip.expenses.length, 1);
  const suggestion = trip.settlements[0];
  a.equal(suggestion.from, bid);
  a.equal(suggestion.to, aid);
  a.equal(suggestion.amount, 60000);
  trip = await request(
    `${path}/transfers`,
    'POST',
    { ...suggestion, amount: '600', date: '2026-10-24' },
    alice.token,
  );
  a.deepEqual(trip.settlements, []);
  a.equal(trip.balances.find((b) => b.id === bid).balance, 0);
  await request(
    `${path}/transfers`,
    'POST',
    { from: bid, to: bid, amount: '1', date: '2026-10-24' },
    bob.token,
    400,
  );
  await request(`${path}/expenses`, 'POST', { ...entry, date: '2026-99-99' }, alice.token, 400);
  await request(
    `${path}/expenses`,
    'POST',
    { ...entry, mode: 'percent', shares: [{ memberId: aid, value: 50 }] },
    alice.token,
    400,
  );
  await request(`${path}/plans`, 'POST', { title: 'Removed' }, alice.token, 404);
  await request(`${path}/posts`, 'POST', { text: 'Removed' }, alice.token, 404);
  await request('/places?q=Rishikesh', 'GET', undefined, alice.token, 404);
  await request(
    `${path}/expenses`,
    'POST',
    { ...entry, receipt: 'data:image/png;base64,aGVsbG8=' },
    alice.token,
    400,
  );
  trip = await request(`${path}/members`, 'POST', { name: 'Charlie' }, alice.token);
  const guest = trip.members.at(-1);
  a.equal(guest.linked, false);
  trip = await request(`${path}/members/${guest.id}`, 'PATCH', { name: 'Chaz' }, alice.token);
  trip = await request(`${path}/members/${guest.id}`, 'DELETE', undefined, alice.token);
  trip = await request(`${path}/members`, 'POST', { name: 'Eve guest' }, alice.token);
  const claimingGuest = trip.members.at(-1);
  trip = await request(
    `${path}/expenses`,
    'POST',
    { ...entry, title: 'Guest share', amount: '100', shares: [{ memberId: claimingGuest.id }] },
    alice.token,
  );
  const guestExpenseId = trip.expenses.at(-1).id;
  const preview = await request('/join/preview', 'POST', { code: trip.code }, eve.token);
  a.ok(preview.guests.some((m) => m.id === claimingGuest.id));
  trip = await request('/join', 'POST', { code: trip.code, memberId: claimingGuest.id }, eve.token);
  a.equal(trip.me, claimingGuest.id);
  a.equal(trip.balances.find((b) => b.id === trip.me).balance, -10000);
  const mallory = await register('mallory');
  await request(
    '/join',
    'POST',
    { code: trip.code, memberId: claimingGuest.id },
    mallory.token,
    409,
  );
  await request(`${path}/expenses/${guestExpenseId}`, 'DELETE', undefined, eve.token, 403);
  trip = await request(`${path}/expenses/${guestExpenseId}`, 'DELETE', undefined, alice.token);
  await request(`${path}/members/${bid}`, 'DELETE', undefined, alice.token, 400);
  await request(path, 'DELETE', undefined, bob.token, 403);
  // Older installs may contain removed feature data. Keep it on disk without exposing it.
  const legacy = JSON.parse(app.db.prepare('SELECT data FROM trips WHERE id=?').get(trip.id).data);
  legacy.plans = [{ title: 'Legacy itinerary' }];
  legacy.posts = [{ text: 'Legacy feed' }];
  legacy.expenses[0].receipt = 'data:image/png;base64,aGVsbG8=';
  app.db.prepare('UPDATE trips SET data=? WHERE id=?').run(JSON.stringify(legacy), trip.id);
  // Restart the actual SQLite-backed server. Financial records and sessions must survive.
  await new Promise((r) => app.server.close(r));
  app.db.close();
  app = createApp({ database });
  base = await start();
  trip = await request(path, 'GET', undefined, alice.token);
  a.equal(trip.total, 120000);
  a.ok(!('receipt' in trip.expenses[0]));
  a.ok(!('plans' in trip));
  a.ok(!('posts' in trip));
  trip = await request(
    `${path}/expenses/${expenseId}`,
    'PATCH',
    { ...entry, amount: '1200' },
    alice.token,
  );
  a.equal(trip.total, 120000);
  const preserved = JSON.parse(
    app.db.prepare('SELECT data FROM trips WHERE id=?').get(trip.id).data,
  );
  a.equal(preserved.plans[0].title, 'Legacy itinerary');
  a.equal(preserved.expenses[0].receipt, 'data:image/png;base64,aGVsbG8=');
  trip = await request(`${path}/expenses/${expenseId}`, 'DELETE', undefined, alice.token);
  a.equal(trip.total, 0);
  trip = await request(
    `${path}/transfers/${trip.transfers[0].id}`,
    'DELETE',
    undefined,
    alice.token,
  );
  a.deepEqual(trip.settlements, []);
  await request('/logout', 'POST', {}, bob.token);
  await request(path, 'GET', undefined, bob.token, 401);
  await request(path, 'DELETE', undefined, alice.token);
  await request(path, 'GET', undefined, alice.token, 404);
});

test('name-only start creates a persistent identity and a group without travel fields', async (t) => {
  const { server, db } = createApp({ database: ':memory:' });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(async () => {
    await new Promise((r) => server.close(r));
    db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const start = await fetch(`${base}/guest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Sam' }),
  });
  a.equal(start.status, 200);
  const { token, user } = await start.json();
  a.equal(user.name, 'Sam');
  a.equal(user.guest, true);
  a.equal(user.email, '');
  a.ok(token);
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const create = await fetch(`${base}/trips`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'House bills', guests: ['Kai'] }),
  });
  a.equal(create.status, 201);
  const group = await create.json();
  a.equal(group.currency, 'INR');
  a.equal(group.members.length, 2);
  a.equal(group.isOwner, true);
  for (const field of ['plans', 'posts', 'destination', 'startDate', 'endDate', 'budget'])
    a.ok(!(field in group));
  const stored = await (await fetch(`${base}/trips`, { headers })).json();
  a.equal(stored[0].id, group.id);
  const me = await (await fetch(`${base}/me`, { headers })).json();
  a.equal(me.id, user.id);
});

test('direct transfers stay outside expenses and trip categories survive bill edits', async (t) => {
  const { server, db } = createApp({ database: ':memory:' });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(async () => {
    await new Promise((r) => server.close(r));
    db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  let token;
  const request = async (path, method = 'GET', body, expected = 200) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json();
    a.equal(response.status, expected, JSON.stringify(data));
    return data;
  };
  ({ token } = await request('/guest', 'POST', { name: 'Sam' }));
  let trip = await request('/trips', 'POST', { name: 'Trip ledger', guests: ['Kai'] }, 201);
  const path = `/trips/${trip.id}`;
  const [sam, kai] = trip.members;
  trip = await request(`${path}/transfers`, 'POST', {
    from: sam.id,
    to: kai.id,
    amount: '100',
    date: '2026-10-20',
    note: 'Trip advance',
  });
  a.equal(trip.total, 0);
  a.deepEqual(trip.expenses, []);
  a.equal(trip.transfers[0].note, 'Trip advance');
  a.deepEqual(
    trip.balances.map(({ paid, spent, balance }) => ({ paid, spent, balance })),
    [
      { paid: 0, spent: 0, balance: 10000 },
      { paid: 0, spent: 0, balance: -10000 },
    ],
  );
  const bill = {
    title: 'Trip cost',
    amount: '300',
    currency: 'INR',
    date: '2026-10-20',
    mode: 'equal',
    shares: [{ memberId: sam.id }, { memberId: kai.id }],
    payers: [{ memberId: sam.id }],
    category: 'Food & drinks',
  };
  trip = await request(`${path}/expenses`, 'POST', bill);
  const billId = trip.expenses[0].id;
  for (const category of [
    'Food & drinks',
    'Transport',
    'Stay',
    'Activities',
    'Groceries',
    'Fuel',
    'Shopping',
    'Tickets',
    'Rentals',
    'Fees & tips',
    'Health',
    'Bills',
    'Other',
  ]) {
    trip = await request(`${path}/expenses/${billId}`, 'PATCH', { ...bill, category });
    a.equal(trip.expenses[0].category, category);
    a.equal(trip.total, 30000);
    a.equal(trip.expenses.length, 1);
    a.deepEqual(
      trip.balances.map((b) => b.balance),
      [25000, -25000],
    );
  }
  trip = await request(`${path}/transfers`, 'POST', {
    from: kai.id,
    to: sam.id,
    amount: '50',
    date: '2026-10-20',
  });
  a.equal(trip.total, 30000);
  a.deepEqual(
    trip.balances.map((b) => b.spent),
    [15000, 15000],
  );
  a.deepEqual(
    trip.balances.map((b) => b.paid),
    [30000, 0],
  );
  a.deepEqual(
    trip.balances.map((b) => b.balance),
    [20000, -20000],
  );
  const firstTransferId = trip.transfers[0].id;
  trip = await request(`${path}/transfers/${firstTransferId}`, 'DELETE');
  a.equal(trip.total, 30000);
  a.deepEqual(
    trip.balances.map((b) => b.balance),
    [10000, -10000],
  );
  const reloaded = await request(path);
  a.equal(reloaded.transfers.length, 1);
  a.equal(reloaded.total, 30000);
});
