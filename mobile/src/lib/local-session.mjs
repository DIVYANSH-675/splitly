import { operationId, projectAction } from './offline-actions.mjs';
import { balances, currencies, settlements } from './finance.mjs';
import { isCalendarDate } from './expense-date.mjs';
import { encodeDemoFile, sampleFile } from './demo-assets.mjs';
import { demoReport } from './demo-report.mjs';

const copy = (value) => JSON.parse(JSON.stringify(value));
const check = (ok, message) => { if (!ok) throw new Error(message); };
export function createLocalSession(mode, saved = null, persist = async () => {}) {
  check(mode === 'demo' || mode === 'child', 'Invalid local mode');
  let state = saved ? copy(saved) : {
    user: { id: `local-${mode}`, name: mode === 'demo' ? 'Alex' : 'You', username: mode === 'demo' ? 'demoalex' : '', email: '', guest: true },
    trips: [],
  };
  check(state.user?.id === `local-${mode}` && Array.isArray(state.trips), 'Invalid local ledger');
  // Local snapshots cannot introduce remote avatar URLs or cloud identities.
  state.user = { id: `local-${mode}`, name: String(state.user.name || 'You').slice(0, 60), username: mode === 'demo' ? String(state.user.username || 'demoalex') : '', email: '', photo: '', guest: true };
  for (const trip of state.trips) {
    for (const person of trip.members) person.photo = '';
    for (const expense of trip.expenses) expense.attachments = [];
  }
  const listeners = new Set();
  const files = new Map(), invitations = new Map();
  const sampleCodes = { DEMOSAMPLE: 'D3A01234ABCD', DEMOCLAIM: 'D3A0C1A10001', DEMONEW: 'D3A0C1A10002' };
  const inviteCode = () => {
    let value;
    do { value = `D${Array.from({ length: 11 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()}`; }
    while (Object.values(sampleCodes).includes(value) || state.trips.some(t => t.code === value));
    return value;
  };
  const roster = { aarav: 'Aarav', priya: 'Priya', rohan: 'Rohan' };
  const demoPeople = trip => {
    for (const person of trip.members) if (person.username && person.id !== trip.me) {
      check(Object.hasOwn(roster, person.username), 'Use a sample username: @aarav, @priya or @rohan.');
      person.name = roster[person.username]; person.linked = true;
    }
  };
  let writes = Promise.resolve();
  const decorate = (trip) => {
    trip.localOnly = false;
    trip.total = trip.expenses.reduce((n, e) => n + e.amount, 0);
    trip.balances = balances(trip);
    trip.settlements = settlements(trip);
    return trip;
  };
  const action = (data, path, method, body) => {
    const at = new Date().toISOString(), parts = path.split('/').filter(Boolean);
    const id = parts[1];
    const old = data.trips.find(t => t.id === id);
    if (path === '/trips' && method === 'POST') {
      check(String(body.name || '').trim().length > 0 && body.name.length <= 80, 'Enter a group name up to 80 characters.');
      check(Object.hasOwn(currencies, body.currency), 'Choose a supported currency.');
      check(data.trips.length < 50, 'This device can keep up to 50 local groups.');
      check((body.guests || []).length <= 30, 'Add up to 30 people.');
      if (mode === 'child') check(!(body.guests || []).some(n => String(n).startsWith('@')), 'Use names here. Username lookup belongs to online groups.');
      body = { ...body, id: operationId(), me: operationId(), memberIds: (body.guests || []).map(() => operationId()) };
    } else {
      check(old, 'Local group not found.');
      if (!parts[2] || parts[2] === 'members') check(old.isOwner, 'Only the group creator can do this.');
      if (['expenses', 'transfers'].includes(parts[2]) && parts[3]) {
        const entry = old[parts[2]].find(e => e.id === parts[3]);
        check(entry, 'Entry not found.');
        check(old.isOwner || entry.createdBy === data.user.id, 'Only the author or group admin can edit this entry.');
      }
      if (parts[2] === 'expenses' && method !== 'DELETE') {
        check(String(body.title || '').trim().length > 0 && body.title.length <= 120, 'Enter a description up to 120 characters.');
        check(isCalendarDate(body.date), 'Choose a valid expense date.');
        if (mode === 'child') check(!(body.attachments || []).length, 'Receipt uploads are available in online groups.');
        else {
          check(Array.isArray(body.attachments || []) && (body.attachments || []).length <= 3, 'Add up to three attachments.');
          body.attachments = (body.attachments || []).map(file => {
            const stored = files.get(`${id}:${file.id}`); check(stored, 'Attach the file again in this demo.');
            return stored.meta;
          });
        }
      }
      if (parts[2] === 'transfers' && method !== 'DELETE') check(isCalendarDate(body.date), 'Choose a valid transfer date.');
      if (parts[2] === 'categories') check(String(body.name || '').trim().length > 0 && body.name.length <= 40, 'Enter a category up to 40 characters.');
      if (parts[2] === 'members' && method === 'POST') {
        if (mode === 'child') check(!body.username && !String(body.name || '').startsWith('@'), 'Use names here. Username lookup belongs to online groups.');
        check(String(body.name || '').trim().length > 0 && old.members.length < 30, 'Enter a name; local groups support up to 30 people.');
      }
    }
    const payload = { ...body, id: body.id || operationId() };
    data.trips = projectAction(data.trips, { path, method, body: payload, createdAt: at }, data.user);
    const trip = data.trips.find(t => t.id === (path === '/trips' ? payload.id : id));
    if (!trip) return { ok: true };
    trip.code = mode === 'demo' ? old?.code || inviteCode() : '';
    if (mode === 'demo') demoPeople(trip);
    trip.version = (old?.version || 0) + 1;
    trip.updatedAt = at;
    const label = parts[2] || 'group';
    const previous = old?.[label]?.find?.(e => e.id === parts[3]);
    const changes = previous ? Object.keys(body).filter(k => ['title', 'date', 'category', 'note'].includes(k) && previous[k] !== body[k]).map(k => ({ field: k, before: String(previous[k] || ''), after: String(body[k]) })) : [];
    trip.activity = [{ id: operationId(), user: data.user.name, userId: data.user.id, at, message: `${method === 'DELETE' ? 'Removed' : method === 'PATCH' ? 'Updated' : 'Added'} ${label}`, changes }, ...(trip.activity || [])];
    decorate(trip);
    return trip;
  };
  if (!saved && mode === 'demo') {
    const trip = action(state, '/trips', 'POST', { name: 'Weekend away', currency: 'INR', guests: ['Aarav', 'Priya', 'Rohan'] });
    const day = new Date().toISOString().slice(0, 10);
    for (const [title, amount, category, payer] of [['Riverside stay', '7200', 'Stay', 0], ['Dinner by the river', '2400', 'Food & drinks', 2], ['Taxi to the hills', '1200', 'Travel', 1]]) {
      action(state, `/trips/${trip.id}/expenses`, 'POST', { title, amount, category, currency: 'INR', rate: 1, date: day, note: '', mode: 'equal', shares: trip.members.map(m => ({ memberId: m.id, value: '0' })), payers: [{ memberId: trip.members[payer].id, amount }] });
    }
    const sample = state.trips[0]; sample.code = sampleCodes.DEMOSAMPLE;
    const receipt = { id: 'sample_receipt_0001', name: 'sample-ledger.pdf', mime: 'application/pdf', data: encodeDemoFile(demoReport(sample, 'pdf')) };
    files.set(`${sample.id}:${receipt.id}`, { meta: sampleFile(receipt), data: receipt.data });
    sample.expenses[0].attachments = [sampleFile(receipt)];
    for (const code of ['DEMOCLAIM', 'DEMONEW']) {
      const invited = copy(sample); invited.id = `sample-${code}`; invited.name = code === 'DEMOCLAIM' ? 'Sample invitation · claim a name' : 'Sample invitation · join as new';
      invited.code = sampleCodes[code]; invited.me = ''; invited.ownerId = 'sample-host'; invited.isOwner = false;
      invited.members[0].name = 'Jigyasu'; invited.members[0].linked = false;
      invited.members[1].linked = true;
      invited.expenses.forEach(e => { e.createdBy = 'sample-host'; e.attachments = []; });
      invited.activity.forEach(e => { e.user = 'Aarav'; e.userId = 'sample-host'; });
      invitations.set(invited.code, invited);
    }
  }
  return {
    mode,
    snapshot: () => copy(state),
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    request(path, method = 'GET', body = {}) {
      if (method === 'GET') {
        const attachment = /^\/trips\/([^/]+)\/attachments\/([^/]+)$/.exec(path);
        if (attachment && mode === 'demo') {
          const file = files.get(`${attachment[1]}:${attachment[2]}`);
          if (file && state.trips.some(t => t.id === attachment[1])) return Promise.resolve({ data: file.data });
          return Promise.reject(new Error('Sample attachment not found.'));
        }
        if (path === '/me') return Promise.resolve(copy(state.user));
        if (path === '/trips') return Promise.resolve(copy(state.trips));
        const trip = state.trips.find(t => path === `/trips/${t.id}`);
        if (trip) return Promise.resolve(copy(trip));
        return Promise.reject(new Error('This feature needs an adult online account. No local data was sent.'));
      }
      const job = writes.catch(() => {}).then(async () => {
        const next = copy(state);
        let result;
        if (path === '/me' && method === 'PATCH') {
          check(String(body.name || '').trim().length > 0 && String(body.name).length <= 60, 'Enter a name up to 60 characters.');
          if (mode === 'child') check(!body.photo, 'Profile photos are available in online accounts.');
          else check(!body.photo || body.photo.length <= 128_000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(body.photo), 'Choose a small JPEG profile photo.');
          if (mode === 'child') check(!body.username, 'Online usernames are not used in local mode.');
          else check(!body.username || /^[a-z0-9_]{3,24}$/.test(body.username), 'Use 3–24 lowercase letters, numbers or underscores.');
          if (mode === 'demo') check(!Object.hasOwn(roster, body.username), 'That sample username is already taken.');
          next.user = { ...next.user, name: body.name.trim(), photo: mode === 'demo' ? body.photo ?? next.user.photo : '', username: mode === 'demo' ? body.username || next.user.username : '' };
          for (const t of next.trips) { const m = t.members.find(m => m.id === t.me); if (m) { m.name = next.user.name; m.photo = next.user.photo; } decorate(t); }
          result = next.user;
        } else if (path === '/join/preview' || path === '/join') {
          check(mode === 'demo', 'Online joining is not available in local mode.');
          const input = String(body.code || '').toUpperCase();
          const code = sampleCodes[input] || input;
          const joined = next.trips.find(t => t.code === code);
          const trip = joined || copy(invitations.get(code) || null);
          check(trip, 'Use DEMOCLAIM or DEMONEW for a sample invitation. Real groups need Google sign-in.');
          if (path === '/join/preview') result = { name: trip.name, joined: Boolean(joined), guests: trip.members.filter(m => !m.linked).map(({ id, name }) => ({ id, name })) };
          else {
            if (!joined) {
              let person = body.memberId ? trip.members.find(m => m.id === body.memberId && !m.linked) : null;
              check(!body.memberId || person, 'Choose an unclaimed sample name.');
              if (!person) { person = { id: operationId() }; trip.members.push(person); }
              Object.assign(person, { name: next.user.name, linked: true, photo: next.user.photo, username: next.user.username });
              trip.me = person.id;
              trip.activity.unshift({ id: operationId(), user: next.user.name, userId: next.user.id, at: new Date().toISOString(), message: body.memberId ? 'Claimed a sample member' : 'Joined the sample group' });
              next.trips.unshift(decorate(trip));
            }
            result = trip;
          }
        } else if (mode === 'demo' && /^\/trips\/[^/]+\/attachments$/.test(path) && method === 'POST') {
          const tripId = path.split('/')[2];
          check(next.trips.some(t => t.id === tripId), 'Sample group not found.');
          const meta = sampleFile(body), key = `${tripId}:${meta.id}`;
          check(files.has(key) || files.size < 30, 'Reset the demo before adding more sample files.');
          check(!files.has(key) || files.get(key).data === body.data, 'File ID already used.');
          files.set(key, { meta, data: body.data }); result = meta;
        } else {
          check(/^\/trips(?:\/[^/]+(?:\/(?:expenses|transfers|categories|members)(?:\/[^/]+)?)?)?$/.test(path), 'This feature needs an adult online account. No local data was sent.');
          result = action(next, path, method, copy(body));
        }
        await persist(copy(next));
        state = next;
        for (const listener of listeners) listener();
        return copy(result);
      });
      writes = job;
      return job;
    },
  };
}
