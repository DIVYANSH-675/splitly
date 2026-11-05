import { test } from 'node:test';
import { strict as a } from 'node:assert';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ExcelJS from 'exceljs';
import { createLocalSession } from '../mobile/src/lib/local-session.mjs';
import { canAccessCloud, isAdultBirthDate, createParentLock } from '../mobile/src/lib/access-policy.mjs';
import * as gateway from '../mobile/src/lib/local-gateway.mjs';
import { demoReport } from '../mobile/src/lib/demo-report.mjs';
import { decodeDemoFile, encodeDemoFile } from '../mobile/src/lib/demo-assets.mjs';
import { Outbox } from '../mobile/src/lib/outbox.mjs';

const bill = trip => ({ title: 'Lunch', amount: '120', currency: 'INR', rate: 1, category: 'Food & drinks', date: '2026-11-05', note: '', mode: 'equal', shares: trip.members.map(m => ({ memberId: m.id, value: '0' })), payers: [{ memberId: trip.me, amount: '120' }] });

test('local child ledger persists bills, dates, transfers and categories without online identities', async () => {
  let saved;
  const local = createLocalSession('child', null, async value => { saved = structuredClone(value); });
  const trip = await local.request('/trips', 'POST', { name: 'Family day', currency: 'INR', guests: ['Family'] });
  const added = await local.request(`/trips/${trip.id}/expenses`, 'POST', bill(trip));
  const e = added.expenses[0];
  await local.request(`/trips/${trip.id}/expenses/${e.id}`, 'PATCH', { ...bill(trip), date: '2026-11-04' });
  await local.request(`/trips/${trip.id}/categories`, 'POST', { name: 'School supplies' });
  await local.request(`/trips/${trip.id}/transfers`, 'POST', { from: trip.members[1].id, to: trip.me, amount: '20', date: '2026-11-05', note: '' });
  const reopened = createLocalSession('child', saved).snapshot().trips[0];
  a.equal(reopened.total, 12000);
  a.equal(reopened.expenses[0].date, '2026-11-04');
  a.equal(reopened.transfers[0].amount, 2000);
  a.equal(reopened.balances.reduce((n, b) => n + b.balance, 0), 0);
  a.equal(reopened.balances.find(b => b.id === trip.me).balance, 4000);
  a.ok(reopened.categories.includes('School supplies'));
  a.equal(reopened.code, '');
  a.equal(saved.user.email, '');
  a.equal(saved.user.googleEmail, undefined);
  await a.rejects(() => local.request('/google/login', 'POST', { code: 'x' }), /adult online account/);
  await a.rejects(() => local.request('/join', 'POST', { code: 'real-group' }), /not available/);
  await a.rejects(() => local.request(`/trips/${trip.id}/attachments`, 'POST', {}), /adult online account/);
  await a.rejects(() => local.request('/trips', 'POST', { name: 'Lookup', currency: 'INR', guests: ['@realuser'] }), /Use names/);
});

test('local storage failure does not acknowledge or retain an unsaved change; concurrent writes preserve both bills', async () => {
  let fail = false, saved;
  const local = createLocalSession('child', null, async value => { if (fail) throw new Error('Storage full'); saved = value; });
  const trip = await local.request('/trips', 'POST', { name: 'At home', currency: 'INR', guests: [] });
  fail = true;
  await a.rejects(() => local.request(`/trips/${trip.id}/expenses`, 'POST', bill(trip)), /Storage full/);
  a.equal(local.snapshot().trips[0].expenses.length, 0);
  fail = false;
  await Promise.all([local.request(`/trips/${trip.id}/expenses`, 'POST', bill(trip)), local.request(`/trips/${trip.id}/expenses`, 'POST', { ...bill(trip), title: 'Dinner' })]);
  a.equal(saved.trips[0].expenses.length, 2);
  a.equal(saved.trips[0].total, 24000);
  const snapshot = local.snapshot(); snapshot.trips[0].name = 'Changed externally';
  a.equal(local.snapshot().trips[0].name, 'At home');
});

test('demo sample state is disposable and independent of persistent child data', async () => {
  const demo = createLocalSession('demo'), trip = demo.snapshot().trips[0];
  a.equal(trip.total, 1080000);
  a.equal(trip.balances.reduce((n, b) => n + b.balance, 0), 0);
  await demo.request(`/trips/${trip.id}/expenses`, 'POST', bill(trip));
  a.equal(demo.snapshot().trips[0].total, 1092000);
  a.equal(createLocalSession('demo').snapshot().trips[0].total, 1080000);
  a.equal(createLocalSession('child').snapshot().trips.length, 0);
  await a.rejects(() => demo.request('/google/link', 'POST', {}), /adult online account/);
});

test('restored local snapshots cannot load remote avatar images or cloud identity fields', () => {
  const saved = createLocalSession('demo').snapshot();
  saved.user.photo = 'https://outside.test/track'; saved.user.googleEmail = 'private@example.test';
  saved.trips[0].members[0].photo = 'https://outside.test/person';
  const safe = createLocalSession('demo', saved).snapshot();
  a.equal(safe.user.photo, ''); a.equal(safe.user.googleEmail, undefined);
  a.equal(safe.trips[0].members[0].photo, '');
});

test('age boundary and parent PIN are checked locally; lockout survives a restart and credentials are never stored plainly', async () => {
  const day = new Date(2026, 10, 5);
  a.equal(isAdultBirthDate('2008-11-05', day), true);
  a.equal(isAdultBirthDate('2008-11-06', day), false);
  a.equal(isAdultBirthDate('2008-02-30', day), false);
  a.equal(isAdultBirthDate('2027-01-01', day), false);
  for (const band of ['9-12', '13-15', '16-17', '', 'under9']) a.equal(canAccessCloud(band), false);
  a.equal(canAccessCloud('18+'), true);
  let record = null, now = day.getTime();
  const options = {
    storage: { get: async () => record, set: async value => { record = value; } },
    digest: async value => createHash('sha256').update(value).digest('hex'), randomHex: async () => 'a'.repeat(64), now: () => now,
  };
  let lock = createParentLock(options);
  await a.rejects(() => lock.setup('2015-01-01', '123456', '123456'), /parent or guardian/);
  await a.rejects(() => lock.setup('1985-03-04', '123456', '654321'), /confirm/);
  await lock.setup('1985-03-04', '123456', '123456');
  a.ok(!record.includes('123456') && !record.includes('1985-03-04'));
  await a.rejects(() => lock.setup('1985-03-04', '111111', '111111'), /already exists/);
  for (let i = 0; i < 5; i++) await a.rejects(() => lock.unlock('111111'), /Incorrect/);
  lock = createParentLock(options);
  await a.rejects(() => lock.unlock('123456'), /Wait five minutes/);
  now += 300001;
  await lock.unlock('123456');
  a.equal(JSON.parse(record).attempts, 0);
});

test('all API/download entry points fail closed in local mode and preserve the real Google session', async t => {
  const requireMobile = createRequire(new URL('../mobile/package.json', import.meta.url));
  const ts = requireMobile('typescript');
  const source = await readFile(new URL('../mobile/src/lib/api.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const storage = new Map([['memogo.token', 'real-private-token']]);
  const as = { getItem: async key => storage.get(key) || null, setItem: async (key, value) => { storage.set(key, value); }, removeItem: async key => { storage.delete(key); } };
  let calls = 0, auth;
  const exports = {};
  const modules = { 'react-native': { Platform: { OS: 'web' } }, 'expo-constants': {}, '@react-native-async-storage/async-storage': as, 'expo-secure-store': {}, './local-gateway.mjs': gateway, './demo-report.mjs': { demoReport }, './demo-assets.mjs': { decodeDemoFile } };
  vm.runInNewContext(code, { exports, require: name => { if (!(name in modules)) throw new Error(name); return modules[name]; }, process: { env: {} }, window: { location: { hostname: 'test.local' } }, AbortController, setTimeout, clearTimeout, fetch: async (url, options) => { calls++; auth = options.headers.Authorization; return Response.json({ name: 'Real parent' }); } });
  await exports.initApi();
  const child = createLocalSession('child'); gateway.setLocalSession(child);
  t.after(() => gateway.setLocalSession(null));
  a.equal((await exports.api('/me')).id, 'local-child');
  const delayed = new Outbox(as, 'test-delayed-cloud-write');
  await delayed.put({ id: 'cloud-request', path: '/trips', method: 'POST', body: { name: 'Private adult group', currency: 'INR', guests: ['Adult friend'] } });
  await delayed.flush(item => exports.api(item.path, item.method, { ...item.body, clientRequestId: item.id }), () => a.fail('Cloud write must not be acknowledged locally'));
  a.equal(child.snapshot().trips.length, 0);
  a.equal((await delayed.load()).length, 1);
  await a.rejects(() => exports.api('/google/login', 'POST', { code: 'one-use' }));
  await a.rejects(() => exports.exportBytes('id', 'pdf'));
  await a.rejects(() => exports.attachmentBytes('id', 'attachment'));
  await a.rejects(() => exports.setApiUrl('https://other.test'));
  a.equal(calls, 0);
  const demo = createLocalSession('demo'); gateway.setLocalSession(demo);
  const pdf = await exports.exportBytes(demo.snapshot().trips[0].id, 'pdf');
  a.equal(Buffer.from(pdf).subarray(0, 8).toString(), '%PDF-1.4');
  const sample = demo.snapshot().trips[0];
  a.equal(Buffer.from(await exports.attachmentBytes(sample.id, sample.expenses[0].attachments[0].id)).subarray(0, 8).toString(), '%PDF-1.4');
  a.equal(calls, 0);
  a.equal(storage.get('memogo.token'), 'real-private-token');
  gateway.setLocalSession(null);
  await exports.api('/me');
  a.equal(calls, 1); a.equal(auth, 'Bearer real-private-token');
  let acknowledged = 0;
  await delayed.flush(item => exports.api(item.path, item.method, { ...item.body, clientRequestId: item.id }), () => { acknowledged++; });
  a.equal(acknowledged, 1); a.equal((await delayed.load()).length, 0); a.equal(calls, 2);
});

test('demo supports isolated file uploads, profile photos, username invitations and member claiming with original balances', async () => {
  const demo = createLocalSession('demo'), trip = demo.snapshot().trips[0];
  const bytes = demoReport(trip, 'pdf');
  a.deepEqual(decodeDemoFile(encodeDemoFile(bytes)), bytes);
  const large = new Uint8Array(2_000_000); large[0] = 255; large[large.length - 1] = 7;
  a.deepEqual(decodeDemoFile(encodeDemoFile(large)), large);
  a.throws(() => decodeDemoFile('AAAA==='), /Invalid/);
  const file = await demo.request(`/trips/${trip.id}/attachments`, 'POST', { id: 'demo_attachment_0002', name: 'receipt.pdf', mime: 'application/pdf', data: encodeDemoFile(bytes) });
  const edited = await demo.request(`/trips/${trip.id}/expenses/${trip.expenses[0].id}`, 'PATCH', { ...bill(trip), attachments: [file] });
  a.equal(edited.expenses.find(e => e.id === trip.expenses[0].id).attachments[0].name, 'receipt.pdf');
  a.equal((await demo.request(`/trips/${trip.id}/attachments/${file.id}`)).data, encodeDemoFile(bytes));
  await a.rejects(() => demo.request(`/trips/${trip.id}/attachments`, 'POST', { id: 'demo_attachment_0003', name: 'bad.png', mime: 'image/png', data: encodeDemoFile(bytes) }), /matching file content/);
  await a.rejects(() => demo.request('/me', 'PATCH', { name: 'Alex', photo: 'https://outside.test/image.jpg' }), /JPEG/);
  const photo = 'data:image/jpeg;base64,/9j/2Q==';
  await demo.request('/me', 'PATCH', { name: 'Jigyasu Patel', username: 'jigy4821', photo });
  a.equal(demo.snapshot().user.photo, photo);
  const preview = await demo.request('/join/preview', 'POST', { code: 'DEMOCLAIM' });
  const guest = preview.guests.find(m => m.name === 'Jigyasu');
  a.ok(guest); a.equal(preview.joined, false);
  const claimed = await demo.request('/join', 'POST', { code: 'DEMOCLAIM', memberId: guest.id });
  a.equal(claimed.me, guest.id); a.equal(claimed.members.find(m => m.id === guest.id).name, 'Jigyasu Patel');
  a.equal(claimed.balances.find(m => m.id === guest.id).balance, 450000);
  a.equal(claimed.expenses[0].createdBy, 'sample-host');
  await a.rejects(() => demo.request(`/trips/${claimed.id}/expenses/${claimed.expenses[0].id}`, 'PATCH', bill(claimed)), /author or group admin/);
  const mine = await demo.request(`/trips/${claimed.id}/expenses`, 'POST', bill(claimed));
  await demo.request(`/trips/${claimed.id}/expenses/${mine.expenses.at(-1).id}`, 'PATCH', { ...bill(claimed), title: 'Own bill edited' });
  const joined = await demo.request('/join', 'POST', { code: 'DEMONEW' });
  a.equal(joined.members.length, 5); a.equal(joined.balances.find(m => m.id === joined.me).balance, 0);
  await a.rejects(() => demo.request('/join', 'POST', { code: 'REALCODE' }), /sample invitation/);
  const lookup = await demo.request('/trips', 'POST', { name: 'Lookup', currency: 'INR', guests: ['@priya'] });
  a.equal(lookup.members[1].name, 'Priya'); a.equal(lookup.members[1].linked, true);
  await a.rejects(() => demo.request('/trips', 'POST', { name: 'Real lookup', currency: 'INR', guests: ['@realuser'] }), /sample username/);
  a.equal(createLocalSession('demo').snapshot().user.photo, '');
  await a.rejects(() => createLocalSession('demo').request(`/trips/${trip.id}/attachments/${file.id}`), /not found/);
});

test('sample PDF and XLSX reconcile current edits, numeric shares and literal spreadsheet labels', async () => {
  const demo = createLocalSession('demo'), trip = demo.snapshot().trips[0];
  await demo.request(`/trips/${trip.id}/expenses`, 'POST', { ...bill(trip), title: '=SUM(1,2) & café' });
  const updated = demo.snapshot().trips[0];
  const pdf = Buffer.from(demoReport(updated, 'pdf', true)).toString('ascii');
  a.match(pdf, /10920\.00/); a.match(pdf, /Sample spending by category/); a.doesNotMatch(pdf, /Added expenses/);
  const book = await new ExcelJS.Workbook().xlsx.load(demoReport(updated, 'xlsx'));
  const sheet = book.getWorksheet('Expenses');
  a.equal(sheet.getCell('B5').value, '=SUM(1,2) & café');
  a.equal(sheet.getCell('D6').value, 10920);
  a.equal(sheet.getCell('F6').value, 2730);
  a.equal(book.getWorksheet('Balances').getCell('B2').value, 7320);
});
