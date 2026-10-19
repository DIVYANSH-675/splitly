import { test } from 'node:test';
import { strict as a } from 'node:assert';
import ExcelJS from 'exceljs';
import { createApp } from '../server/index.mjs';
async function fixture(t) {
  const app = createApp({ database: ':memory:' });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  t.after(async () => {
    await new Promise((r) => app.server.close(r));
    app.db.close();
  });
  const base = `http://127.0.0.1:${app.server.address().port}/api`;
  const response = (path, method = 'GET', body, token) =>
    fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const request = async (path, method, body, token, status = 200) => {
    const r = await response(path, method, body, token);
    const data = await r.json();
    a.equal(r.status, status, JSON.stringify(data));
    return data;
  };
  const owner = await request('/guest', 'POST', { name: 'Admin' }),
    author = await request('/guest', 'POST', { name: 'Sam' }),
    peer = await request('/guest', 'POST', { name: 'Lee' });
  let trip = await request('/trips', 'POST', { name: 'Weekend trip' }, owner.token, 201);
  trip = await request('/join', 'POST', { code: trip.code }, author.token);
  trip = await request('/join', 'POST', { code: trip.code }, peer.token);
  const body = {
    title: 'Dinner',
    amount: '900',
    currency: 'INR',
    category: 'Food & drinks',
    date: '2026-10-20',
    mode: 'equal',
    shares: trip.members.map((m) => ({ memberId: m.id })),
    payers: [{ memberId: trip.members[1].id }],
  };
  return { ...app, request, response, owner, author, peer, trip, path: `/trips/${trip.id}`, body };
}
test('authors edit their entries, admin edits anyone, peers cannot; history keeps old/new values', async (t) => {
  const { request, owner, author, peer, path, body, db, trip: initial } = await fixture(t);
  let trip = await request(`${path}/expenses`, 'POST', body, author.token);
  const eid = trip.expenses[0].id;
  await request(`${path}/expenses/${eid}`, 'PATCH', { ...body, amount: '1200' }, peer.token, 403);
  await request(`${path}/expenses/${eid}`, 'DELETE', undefined, peer.token, 403);
  trip = await request(
    `${path}/expenses/${eid}`,
    'PATCH',
    { ...body, amount: '1200' },
    owner.token,
  );
  a.equal(trip.expenses[0].createdBy, author.user.id);
  let entry = trip.activity[0];
  a.equal(entry.user, 'Admin');
  a.match(entry.message, /updated expense/);
  a.ok(
    entry.changes.some(
      (c) => c.field.endsWith('Amount') && c.before === 'INR 900.00' && c.after === 'INR 1200.00',
    ),
  );
  trip = await request(
    `${path}/expenses/${eid}`,
    'PATCH',
    { ...body, category: 'Transport' },
    author.token,
  );
  a.equal(trip.activity[0].user, 'Sam');
  a.ok(
    trip.activity[0].changes.some((c) => c.field.endsWith('Category') && c.after === 'Transport'),
  );
  const transfer = {
    from: trip.members[2].id,
    to: trip.members[1].id,
    amount: '50',
    date: '2026-10-20',
    note: 'Advance',
  };
  trip = await request(`${path}/transfers`, 'POST', transfer, author.token);
  const tid = trip.transfers[0].id;
  await request(
    `${path}/transfers/${tid}`,
    'PATCH',
    { ...transfer, amount: '80' },
    peer.token,
    403,
  );
  trip = await request(
    `${path}/transfers/${tid}`,
    'PATCH',
    { ...transfer, amount: '80' },
    owner.token,
  );
  a.equal(trip.transfers[0].createdBy, author.user.id);
  a.equal(trip.total, 90000);
  a.ok(
    trip.activity[0].changes.some(
      (c) => c.field === 'Transfer · Amount' && c.before === 'INR 50.00' && c.after === 'INR 80.00',
    ),
  );
  trip = await request(
    `${path}/transfers/${tid}`,
    'PATCH',
    { ...transfer, note: 'Corrected' },
    author.token,
  );
  a.equal(trip.transfers[0].note, 'Corrected');
  const stored = JSON.parse(db.prepare('SELECT data FROM trips WHERE id=?').get(initial.id).data);
  stored.activity.push(
    ...Array.from({ length: 350 }, (_, i) => ({
      id: `legacy-${i}`,
      user: 'Admin',
      message: 'older update',
      at: '2026-10-01T00:00:00Z',
    })),
  );
  db.prepare('UPDATE trips SET data=? WHERE id=?').run(JSON.stringify(stored), initial.id);
  const oldLength = stored.activity.length;
  trip = await request(`${path}/expenses/${eid}`, 'DELETE', undefined, author.token);
  a.equal(trip.activity.length, oldLength + 1);
  a.ok(trip.activity[0].changes.some((c) => c.before === 'Dinner' && c.after === ''));
  a.ok(trip.activity.some((e) => e.id === 'legacy-349'));
});
test('offline request replay is idempotent, even after the saved bill is deleted', async (t) => {
  const { request, path, body, author } = await fixture(t);
  const payload = { ...body, clientRequestId: 'bill_device_1234567890' };
  let trip = await request(`${path}/expenses`, 'POST', payload, author.token);
  const version = trip.version,
    count = trip.activity.length,
    id = trip.expenses[0].id;
  trip = await request(`${path}/expenses`, 'POST', payload, author.token);
  a.equal(trip.version, version);
  a.equal(trip.activity.length, count);
  a.equal(trip.expenses.length, 1);
  await request(`${path}/expenses`, 'POST', { ...payload, amount: '901' }, author.token, 409);
  await request(`${path}/expenses/${id}`, 'DELETE', undefined, author.token);
  trip = await request(`${path}/expenses`, 'POST', payload, author.token);
  a.equal(trip.expenses.length, 0);
  a.equal(trip.total, 0);
});
test('PDF/XLSX exports require membership and reconcile expenses, transfers, shares and history', async (t) => {
  const { request, response, path, body, owner, author } = await fixture(t);
  const trip = await request(`${path}/expenses`, 'POST', body, author.token);
  await request(
    `${path}/transfers`,
    'POST',
    {
      from: trip.members[2].id,
      to: trip.members[1].id,
      amount: '100',
      date: '2026-10-20',
      note: 'Not an expense',
    },
    owner.token,
  );
  a.equal((await response(`${path}/export/xlsx`)).status, 401);
  const stranger = await request('/guest', 'POST', { name: 'Outsider' });
  a.equal((await response(`${path}/export/pdf`, 'GET', undefined, stranger.token)).status, 403);
  const xlsx = await response(`${path}/export/xlsx`, 'GET', undefined, author.token);
  a.equal(xlsx.status, 200);
  a.match(xlsx.headers.get('content-type'), /spreadsheetml/);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(Buffer.from(await xlsx.arrayBuffer()));
  a.deepEqual(
    book.worksheets.map((s) => s.name),
    ['Summary', 'Balances', 'Expenses', 'Shares', 'Payers', 'Transfers', 'Activity'],
  );
  a.equal(book.getWorksheet('Summary').getCell('C2').value, 900);
  a.equal(book.getWorksheet('Expenses').getCell('F2').value, 900);
  a.equal(book.getWorksheet('Transfers').getCell('D2').value, 100);
  a.equal(book.getWorksheet('Shares').getCell('D2').value, 300);
  a.ok(book.getWorksheet('Activity').rowCount > 4);
  a.equal(
    book
      .getWorksheet('Balances')
      .getColumn(4)
      .values.slice(2)
      .reduce((n, v) => n + v, 0),
    0,
  );
  const pdf = await response(`${path}/export/pdf`, 'GET', undefined, owner.token);
  a.equal(pdf.status, 200);
  a.equal(pdf.headers.get('content-type'), 'application/pdf');
  const bytes = Buffer.from(await pdf.arrayBuffer());
  a.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  a.ok(bytes.length > 5000);
});

test('a one-page report keeps its footer on that page without blank trailing pages',async()=>{
  const {exportTrip}=await import('../server/export.mjs');
  const bytes=await exportTrip({name:'Empty group',currency:'INR',members:[],expenses:[],transfers:[],activity:[],balances:[],total:0},'pdf');
  const pageObjects=bytes.toString('latin1').match(/\/Type \/Page\b/g)||[];
  a.equal(pageObjects.length,1);
});
