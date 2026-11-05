import { operationId, projectAction } from './offline-actions.mjs';
import { balances, currencies, settlements } from './finance.mjs';
import { isCalendarDate } from './expense-date.mjs';

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
      check(!(body.guests || []).some(n => String(n).startsWith('@')), 'Use names here. Username lookup belongs to online groups.');
      body = { ...body, id: operationId(), me: operationId(), memberIds: (body.guests || []).map(() => operationId()) };
    } else {
      check(old, 'Local group not found.');
      if (parts[2] === 'expenses' && method !== 'DELETE') {
        check(String(body.title || '').trim().length > 0 && body.title.length <= 120, 'Enter a description up to 120 characters.');
        check(isCalendarDate(body.date), 'Choose a valid expense date.');
        check(!(body.attachments || []).length, 'Receipt uploads are available in online groups.');
      }
      if (parts[2] === 'transfers' && method !== 'DELETE') check(isCalendarDate(body.date), 'Choose a valid transfer date.');
      if (parts[2] === 'categories') check(String(body.name || '').trim().length > 0 && body.name.length <= 40, 'Enter a category up to 40 characters.');
      if (parts[2] === 'members' && method === 'POST') {
        check(!body.username && !String(body.name || '').startsWith('@'), 'Use names here. Username lookup belongs to online groups.');
        check(String(body.name || '').trim().length > 0 && old.members.length < 30, 'Enter a name; local groups support up to 30 people.');
      }
    }
    const payload = { ...body, id: body.id || operationId() };
    data.trips = projectAction(data.trips, { path, method, body: payload, createdAt: at }, data.user);
    const trip = data.trips.find(t => t.id === (path === '/trips' ? payload.id : id));
    if (!trip) return { ok: true };
    trip.code = mode === 'demo' ? 'DEMOSAMPLE' : '';
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
  }
  return {
    mode,
    snapshot: () => copy(state),
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    request(path, method = 'GET', body = {}) {
      if (method === 'GET') {
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
          check(!body.photo, 'Profile photos are available in online accounts.');
          if (mode === 'child') check(!body.username, 'Online usernames are not used in local mode.');
          else check(!body.username || /^[a-z0-9_]{3,24}$/.test(body.username), 'Use 3–24 lowercase letters, numbers or underscores.');
          next.user = { ...next.user, name: body.name.trim(), username: mode === 'demo' ? body.username || next.user.username : '' };
          for (const t of next.trips) { const m = t.members.find(m => m.id === t.me); if (m) m.name = next.user.name; decorate(t); }
          result = next.user;
        } else if (path === '/join/preview' || path === '/join') {
          check(mode === 'demo', 'Online joining is not available in local mode.');
          const trip = next.trips.find(t => t.code === String(body.code || '').toUpperCase());
          check(trip, 'Use DEMOSAMPLE to open the sample group. Real groups need Google sign-in.');
          result = path === '/join/preview' ? { name: trip.name, joined: true, guests: [] } : trip;
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
