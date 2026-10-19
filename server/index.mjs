import http from 'node:http';
import { auditSnapshot, auditChanges } from './audit.mjs';
import { exportTrip } from './export.mjs';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, scrypt, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assert, currencies, minor, expenseFromInput, balances, settlements } from './finance.mjs';

const derive = promisify(scrypt);
const text = (value, label, max = 120) => {
  const s = String(value ?? '').trim();
  assert(s.length > 0 && s.length <= max, `${label} must contain 1–${max} characters`);
  return s;
};
const date = (value) => {
  assert(
    typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value,
    'Use a valid date (YYYY-MM-DD)',
  );
  return value;
};
const id = () => randomUUID();
const hash = (token) => createHash('sha256').update(token).digest('hex');
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])]),
        )
      : value;
const requestSignature = (body) =>
  hash(JSON.stringify(canonical({ ...body, clientRequestId: undefined })));
const categories = [
  'Food & drinks',
  'Transport',
  'Stay',
  'Shopping',
  'Activities',
  'Groceries',
  'Bills',
  'Fuel',
  'Tickets',
  'Rentals',
  'Fees & tips',
  'Health',
  'Other',
];

export function createApp({
  database = process.env.SPLITLY_DB || process.env.MEMOGO_DB || resolve('data/memogo.sqlite'),
} = {}) {
  if (database !== ':memory:') mkdirSync(dirname(database), { recursive: true });
  const db = new DatabaseSync(database);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,salt TEXT NOT NULL,password TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS trips(id TEXT PRIMARY KEY,code TEXT UNIQUE NOT NULL,data TEXT NOT NULL);
  `);
  const attempts = new Map();
  const throttle = (key, limit = 20) => {
    const now = Date.now();
    let a = attempts.get(key);
    if (!a || a.until < now) {
      a = { count: 0, until: now + 600_000 };
      attempts.set(key, a);
    }
    assert(++a.count <= limit, 'Too many attempts. Please try again in 10 minutes.', 429);
    if (attempts.size > 10000) for (const [k, v] of attempts) if (v.until < now) attempts.delete(k);
  };
  const save = (trip) => {
    trip.version = (trip.version || 0) + 1;
    trip.updatedAt = new Date().toISOString();
    db.prepare(
      'INSERT INTO trips VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',
    ).run(trip.id, trip.code, JSON.stringify(trip));
  };
  const publicUser = (user) => ({
    id: user.id,
    name: user.name,
    email: user.email.endsWith('@guest.splitly.local') ? '' : user.email,
    guest: user.email.endsWith('@guest.splitly.local'),
  });
  const decorate = (trip, user) => ({
    id: trip.id,
    name: trip.name,
    code: trip.code,
    currency: trip.currency,
    ownerId: trip.ownerId,
    version: trip.version || 0,
    updatedAt: trip.updatedAt,
    me: trip.members.find((m) => m.userId === user.id)?.id,
    isOwner: trip.ownerId === user.id,
    members: trip.members.map(({ userId, ...m }) => ({ ...m, linked: Boolean(userId) })),
    expenses: trip.expenses.map(({ receipt, ...expense }) => expense),
    transfers: trip.transfers,
    activity: trip.activity || [],
    balances: balances(trip).map(({ userId, ...m }) => m),
    settlements: settlements(trip),
    total: trip.expenses.reduce((a, e) => a + e.amount, 0),
  });
  const snapshots = new WeakMap();
  const event = (trip, user, message) => {
    const after = auditSnapshot(trip);
    const changes = auditChanges(snapshots.get(trip) || {}, after);
    trip.activity ||= [];
    trip.activity.unshift({
      id: id(),
      user: user.name,
      userId: user.id,
      message,
      changes,
      at: new Date().toISOString(),
    });
    snapshots.set(trip, after);
  };
  const server = http.createServer(async (req, res) => {
    const send = (status, data) => {
      res.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(JSON.stringify(data));
    };
    const origin = req.headers.origin;
    if (
      origin &&
      /^(https?:\/\/)(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(
        origin,
      )
    ) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }
    try {
      const url = new URL(req.url, 'http://localhost');
      const segments = url.pathname.split('/').filter(Boolean);
      assert(segments[0] === 'api', 'Not found', 404);
      if (url.pathname === '/api/health') return send(200, { ok: true, service: 'Splitly API' });
      let body = {};
      if (['POST', 'PATCH'].includes(req.method)) {
        assert(
          (req.headers['content-type'] || '').includes('application/json'),
          'JSON body required',
          415,
        );
        let raw = '',
          size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          assert(size <= 64_000, 'Request is too large', 413);
          raw += chunk;
        }
        try {
          body = JSON.parse(raw);
        } catch {
          assert(false, 'Invalid JSON');
        }
        assert(body && typeof body === 'object' && !Array.isArray(body), 'Invalid request body');
      }
      if (segments[1] === 'guest' && req.method === 'POST') {
        throttle(`auth:${req.socket.remoteAddress}`);
        const guestId = id(),
          salt = randomBytes(16).toString('hex');
        const user = {
          id: guestId,
          name: text(body.name, 'Name', 60),
          email: `guest-${guestId}@guest.splitly.local`,
          salt,
          password: Buffer.from(await derive(randomBytes(32).toString('hex'), salt, 64)).toString(
            'hex',
          ),
        };
        db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(
          user.id,
          user.email,
          user.name,
          user.salt,
          user.password,
        );
        const token = randomBytes(32).toString('hex');
        db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(
          hash(token),
          user.id,
          Date.now() + 3650 * 86400_000,
        );
        return send(200, { token, user: publicUser(user) });
      }
      if (['register', 'login'].includes(segments[1]) && req.method === 'POST') {
        throttle(`auth:${req.socket.remoteAddress}`);
        const email = text(body.email, 'Email', 254).toLowerCase();
        assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Enter a valid email');
        const password = String(body.password || '');
        assert(
          password.length >= 8 && password.length <= 128,
          'Password must contain 8–128 characters',
        );
        let user;
        if (segments[1] === 'register') {
          assert(
            !db.prepare('SELECT id FROM users WHERE email=?').get(email),
            'An account already exists for this email',
            409,
          );
          const salt = randomBytes(16).toString('hex');
          user = {
            id: id(),
            email,
            name: text(body.name, 'Name', 60),
            salt,
            password: Buffer.from(await derive(password, salt, 64)).toString('hex'),
          };
          try {
            db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(
              user.id,
              user.email,
              user.name,
              user.salt,
              user.password,
            );
          } catch (e) {
            if (String(e.message).includes('UNIQUE'))
              assert(false, 'An account already exists for this email', 409);
            throw e;
          }
        } else {
          user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
          const actual = Buffer.from(await derive(password, user?.salt || 'memogo-dummy-salt', 64));
          assert(
            user && timingSafeEqual(actual, Buffer.from(user.password, 'hex')),
            'Email or password is incorrect',
            401,
          );
        }
        db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
        const token = randomBytes(32).toString('hex');
        db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(
          hash(token),
          user.id,
          Date.now() + 30 * 86400_000,
        );
        return send(200, { token, user: publicUser(user) });
      }
      const token = (req.headers.authorization || '').replace(/^Bearer /, '');
      const user = db
        .prepare(
          'SELECT users.* FROM users JOIN sessions ON users.id=sessions.user_id WHERE sessions.token=? AND sessions.expires>?',
        )
        .get(hash(token), Date.now());
      assert(user, 'Please sign in again', 401);
      if (segments[1] === 'logout' && req.method === 'POST') {
        db.prepare('DELETE FROM sessions WHERE token=?').run(hash(token));
        return send(200, { ok: true });
      }
      if (segments[1] === 'me') {
        if (req.method === 'PATCH') {
          user.name = text(body.name, 'Name', 60);
          db.prepare('UPDATE users SET name=? WHERE id=?').run(user.name, user.id);
          for (const row of db.prepare('SELECT data FROM trips').all()) {
            const group = JSON.parse(row.data);
            const person = group.members.find((m) => m.userId === user.id);
            if (person && person.name !== user.name) {
              snapshots.set(group, auditSnapshot(group));
              person.name = user.name;
              event(group, user, 'updated their name');
              save(group);
            }
          }
        }
        return send(200, publicUser(user));
      }
      if (segments[1] === 'join' && req.method === 'POST') {
        throttle(`join:${user.id}`, 30);
        const row = db.prepare('SELECT data FROM trips WHERE code=?').get(
          String(body.code || '')
            .trim()
            .toUpperCase(),
        );
        assert(row, 'Group code not found', 404);
        const trip = JSON.parse(row.data);
        snapshots.set(trip, auditSnapshot(trip));
        if (segments[2] === 'preview')
          return send(200, {
            name: trip.name,
            guests: trip.members.filter((m) => !m.userId).map((m) => ({ id: m.id, name: m.name })),
          });
        if (!trip.members.some((m) => m.userId === user.id)) {
          if (body.memberId) {
            const guest = trip.members.find((m) => m.id === body.memberId);
            assert(
              guest && !guest.userId,
              'That guest was already claimed. Please check the group again.',
              409,
            );
            guest.userId = user.id;
          } else {
            assert(trip.members.length < 100, 'This group is full');
            trip.members.push({ id: id(), name: user.name, userId: user.id });
          }
          event(trip, user, 'joined the group');
          save(trip);
        }
        return send(200, decorate(trip, user));
      }
      assert(segments[1] === 'trips', 'Not found', 404);
      if (!segments[2]) {
        if (req.method === 'GET') {
          const trips = db
            .prepare('SELECT data FROM trips')
            .all()
            .map((r) => JSON.parse(r.data))
            .filter((t) => t.members.some((m) => m.userId === user.id))
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
          return send(
            200,
            trips.map((t) => decorate(t, user)),
          );
        }
        assert(req.method === 'POST', 'Method not allowed', 405);
        assert(Object.hasOwn(currencies, body.currency || 'INR'), 'Choose a supported currency');
        const trip = {
          id: id(),
          code: randomBytes(6).toString('hex').toUpperCase(),
          ownerId: user.id,
          name: text(body.name, 'Group name', 80),
          currency: body.currency || 'INR',
          members: [{ id: id(), name: user.name, userId: user.id }],
          expenses: [],
          transfers: [],
          activity: [],
          updatedAt: '',
        };
        if (body.guests !== undefined) {
          assert(
            Array.isArray(body.guests) && body.guests.length <= 30,
            'Add up to 30 guests at creation',
          );
          for (const name of body.guests)
            trip.members.push({ id: id(), name: text(name, 'Guest name', 60) });
        }
        event(trip, user, 'created the group');
        save(trip);
        return send(201, decorate(trip, user));
      }
      const row = db.prepare('SELECT data FROM trips WHERE id=?').get(segments[2]);
      assert(row, 'Group not found', 404);
      const trip = JSON.parse(row.data);
      snapshots.set(trip, auditSnapshot(trip));
      assert(
        trip.members.some((m) => m.userId === user.id),
        'You do not have access to this group',
        403,
      );
      const owner = () =>
        assert(trip.ownerId === user.id, 'Only the group creator can do this', 403);
      const member = (memberId) => {
        const m = trip.members.find((m) => m.id === memberId);
        assert(m, 'Member not found', 404);
        return m;
      };
      if (segments[3] === 'export' && req.method === 'GET') {
        const format = segments[4];
        assert(['pdf', 'xlsx'].includes(format), 'Choose PDF or XLSX');
        const output = await exportTrip(decorate(trip, user), format);
        res.writeHead(200, {
          'Content-Type':
            format === 'pdf'
              ? 'application/pdf'
              : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="splitly-${trip.id}.${format}"`,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        });
        return res.end(output);
      }
      if (!segments[3]) {
        if (req.method === 'GET') return send(200, decorate(trip, user));
        owner();
        if (req.method === 'DELETE') {
          db.prepare('DELETE FROM trips WHERE id=?').run(trip.id);
          return send(200, { ok: true });
        }
        assert(req.method === 'PATCH', 'Method not allowed', 405);
        if (body.name !== undefined) trip.name = text(body.name, 'Group name', 80);
        event(trip, user, 'updated group settings');
      } else if (segments[3] === 'members') {
        owner();
        if (req.method === 'POST') {
          assert(trip.members.length < 100, 'Group member limit reached');
          const email = String(body.email || '')
            .trim()
            .toLowerCase();
          const linked = email
            ? db.prepare('SELECT id,name FROM users WHERE email=?').get(email)
            : null;
          assert(
            !email || linked,
            'No account with this email. Add a guest by name or share the invite code.',
          );
          assert(
            !linked || !trip.members.some((m) => m.userId === linked.id),
            'This user is already a member',
          );
          trip.members.push({
            id: id(),
            name: text(body.name || linked?.name, 'Member name', 60),
            ...(linked ? { userId: linked.id } : {}),
          });
          event(trip, user, 'added a member');
        } else {
          const m = member(segments[4]);
          if (req.method === 'DELETE') {
            assert(m.userId !== trip.ownerId, 'The group creator cannot be removed');
            assert(
              !trip.expenses.some((e) =>
                [...e.shares, ...e.payers].some((p) => p.memberId === m.id),
              ) && !trip.transfers.some((t) => t.from === m.id || t.to === m.id),
              'A member with transactions cannot be removed; this preserves the group ledger',
            );
            trip.members = trip.members.filter((x) => x.id !== m.id);
            event(trip, user, 'removed a member');
          } else {
            assert(req.method === 'PATCH', 'Method not allowed', 405);
            m.name = text(body.name, 'Name', 60);
            event(trip, user, 'renamed a member');
          }
        }
      } else if (segments[3] === 'expenses') {
        if (req.method === 'DELETE') {
          const e = trip.expenses.find((e) => e.id === segments[4]);
          assert(e, 'Expense not found', 404);
          assert(
            e.createdBy === user.id || trip.ownerId === user.id,
            'Only its author or group creator can delete this expense',
            403,
          );
          trip.expenses = trip.expenses.filter((x) => x.id !== e.id);
          event(trip, user, `deleted expense: ${e.title}`);
        } else {
          assert(['POST', 'PATCH'].includes(req.method), 'Method not allowed', 405);
          if (req.method === 'POST' && body.clientRequestId !== undefined) {
            assert(
              typeof body.clientRequestId === 'string' &&
                /^[a-zA-Z0-9_-]{16,100}$/.test(body.clientRequestId),
              'Invalid offline request ID',
            );
            const operation = trip.operationIds?.[`${user.id}:${body.clientRequestId}`];
            if (operation) {
              assert(
                typeof operation === 'string' || operation.signature === requestSignature(body),
                'This bill already synced. Refresh the group, then edit the saved bill.',
                409,
              );
              return send(200, decorate(trip, user));
            }
          }
          const existing = segments[4] ? trip.expenses.find((e) => e.id === segments[4]) : null;
          assert(req.method !== 'PATCH' || existing, 'Expense not found', 404);
          assert(
            !existing || existing.createdBy === user.id || trip.ownerId === user.id,
            'Only its author or group creator can edit this expense',
            403,
          );
          assert(trip.expenses.length < 3000 || existing, 'Group expense limit reached');
          assert(body.receipt === undefined, 'Photo attachments are not supported');
          const expense = {
            id: existing?.id || id(),
            createdBy: existing?.createdBy || user.id,
            title: text(body.title, 'Expense title'),
            date: date(body.date),
            category: categories.includes(body.category) ? body.category : 'Other',
            note: String(body.note || '')
              .trim()
              .slice(0, 2000),
            ...(existing?.receipt ? { receipt: existing.receipt } : {}),
            ...expenseFromInput(body, trip),
          };
          if (existing) trip.expenses[trip.expenses.indexOf(existing)] = expense;
          else trip.expenses.push(expense);
          if (!existing && body.clientRequestId) {
            trip.operationIds ||= {};
            trip.operationIds[`${user.id}:${body.clientRequestId}`] = {
              id: expense.id,
              signature: requestSignature(body),
            };
          }
          event(trip, user, `${existing ? 'updated' : 'added'} expense: ${expense.title}`);
        }
      } else if (segments[3] === 'transfers') {
        if (req.method === 'DELETE') {
          const t = trip.transfers.find((t) => t.id === segments[4]);
          assert(t, 'Transfer not found', 404);
          assert(
            t.createdBy === user.id || trip.ownerId === user.id,
            'Only its author or group creator can delete this transfer',
            403,
          );
          trip.transfers = trip.transfers.filter((x) => x.id !== t.id);
          event(trip, user, 'deleted a transfer');
        } else {
          assert(['POST', 'PATCH'].includes(req.method), 'Method not allowed', 405);
          const existing = segments[4] ? trip.transfers.find((t) => t.id === segments[4]) : null;
          assert(req.method !== 'PATCH' || existing, 'Transfer not found', 404);
          assert(
            !existing || existing.createdBy === user.id || trip.ownerId === user.id,
            'Only its author or group creator can edit this transfer',
            403,
          );
          member(body.from);
          member(body.to);
          assert(body.from !== body.to, 'Choose two different members');
          assert(trip.transfers.length < 3000 || existing, 'Transfer limit reached');
          const transfer = {
            id: existing?.id || id(),
            createdBy: existing?.createdBy || user.id,
            from: body.from,
            to: body.to,
            amount: minor(body.amount, trip.currency),
            date: date(body.date),
            note: String(body.note || '')
              .trim()
              .slice(0, 500),
          };
          if (existing) trip.transfers[trip.transfers.indexOf(existing)] = transfer;
          else trip.transfers.push(transfer);
          event(
            trip,
            user,
            `${existing ? 'updated' : 'recorded'} a transfer from ${member(body.from).name} to ${member(body.to).name}`,
          );
        }
      } else assert(false, 'Not found', 404);
      save(trip);
      send(200, decorate(trip, user));
    } catch (error) {
      if (!error.status) console.error('API error:', error.message);
      if (!res.headersSent)
        send(error.status || 500, {
          error: error.status ? error.message : 'Something went wrong. Please try again.',
        });
    }
  });
  return { server, db };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { server } = createApp();
  const port = Number(process.env.PORT || 4310);
  server.listen(port, '0.0.0.0', () =>
    console.log(`Splitly API listening on http://localhost:${port}`),
  );
}
