import { createGoogleAuth } from './google.mjs';
import { auditSnapshot, auditChanges } from './audit.mjs';
import { exportTrip } from './export.mjs';
import { randomBytes, randomUUID, scrypt, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
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
const inputEmail = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();
const id = () => randomUUID();
const clientId = (value) => (value && /^[a-zA-Z0-9_-]{16,100}$/.test(value) ? value : id());
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

export function createHandler(db, attempts = new Map(), googleAuth = createGoogleAuth(), { allowLegacyAuth = false } = {}) {
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
  const save = async (trip) => {
    trip.version = (trip.version || 0) + 1;
    trip.updatedAt = new Date().toISOString();
    await db
      .prepare('INSERT INTO trips VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data')
      .run(trip.id, trip.code, JSON.stringify(trip));
  };
  const newUsername = async (name) => {
    const base = String(name || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4) || 'user';
    for (let attempt = 0; attempt < 100; attempt++) {
      const username = attempt < 20
        ? `${base}${String(randomBytes(4).readUInt32BE() % 10000).padStart(4, '0')}`
        : randomBytes(4).toString('hex');
      if (!(await db.prepare('SELECT user_id FROM profiles WHERE username=?').get(username))) return username;
    }
    throw Object.assign(new Error('Could not assign a username. Please try again.'), {status:503});
  };
  const publicUser = async (user) => {
    let profile=await db.prepare('SELECT username,photo FROM profiles WHERE user_id=?').get(user.id);
    if (!profile) {
      // Older device identities predate usernames; preserve their ID and group access.
      const username = await newUsername(user.name);
      await db.prepare('INSERT INTO profiles(user_id,username,photo) VALUES(?,?,?)').run(user.id,username,'');
      profile={username,photo:''};
    }
    return {
      googleEmail:(await db.prepare("SELECT email FROM oauth_identities WHERE user_id=? AND provider='google'").get(user.id))?.email || '',
      ...profile,id:user.id,name:user.name,
      email:user.email.endsWith('@guest.splitly.local') ? '' : user.email,
      guest:user.email.endsWith('@guest.splitly.local'),
    };
  };
  const googleAccount = async (identity, currentUser) => {
    const linked = await db.prepare("SELECT user_id FROM oauth_identities WHERE provider='google' AND subject=?").get(identity.subject);
    if (currentUser) {
      assert(!linked || linked.user_id === currentUser.id, 'This Google account is already connected to another SplitBill account.', 409);
      const own = await db.prepare("SELECT subject FROM oauth_identities WHERE user_id=? AND provider='google'").get(currentUser.id);
      assert(!own || own.subject === identity.subject, 'This SplitBill account already has a different Google account connected.', 409);
    }
    let user = currentUser || (linked && await db.prepare('SELECT * FROM users WHERE id=?').get(linked.user_id));
    if (!user) {
      const userId = id();
      user = { id: userId, email: `guest-${userId}@guest.splitly.local`, name: identity.name, salt: randomBytes(16).toString('hex'), password: randomBytes(64).toString('hex') };
      await db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(user.id,user.email,user.name,user.salt,user.password);
      const username = await newUsername(identity.name);
      await db.prepare('INSERT INTO profiles(user_id,username,photo) VALUES(?,?,?)').run(user.id,username,identity.photo || '');
    }
    if (!linked) await db.prepare('INSERT INTO oauth_identities(provider,subject,user_id,email) VALUES(?,?,?,?)').run('google',identity.subject,user.id,identity.email);
    else await db.prepare("UPDATE oauth_identities SET email=? WHERE provider='google' AND subject=?").run(identity.email,identity.subject);
    return user;
  };
  const decorate = async (trip, user) => {
    const decoratedMembers = await Promise.all(
      trip.members.map(async ({ userId, ...m }) => ({
        ...m,
        linked: Boolean(userId),
        ...(userId
          ? (await db.prepare('SELECT username,photo FROM profiles WHERE user_id=?').get(userId)) ||
            {}
          : {}),
      })),
    );
    return {
      id: trip.id,
      name: trip.name,
      code: trip.code,
      currency: trip.currency,
      categories: [...categories, ...(trip.categories || [])],
      ownerId: trip.ownerId,
      version: trip.version || 0,
      updatedAt: trip.updatedAt,
      me: trip.members.find((m) => m.userId === user.id)?.id,
      isOwner: trip.ownerId === user.id,
      members: decoratedMembers,
      expenses: trip.expenses.map(({ receipt, ...expense }) => expense),
      transfers: trip.transfers,
      activity: trip.activity || [],
      balances: balances(trip).map(({ userId, ...m }) => ({
        ...m,
        ...decoratedMembers.find((p) => p.id === m.id),
      })),
      settlements: settlements(trip),
      total: trip.expenses.reduce((a, e) => a + e.amount, 0),
    };
  };
  const snapshots = new WeakMap();
  const resolvePerson = async (value, usernameValue, emailValue) => {
    const raw = String(value || '').trim();
    const username = String(usernameValue || (raw.startsWith('@') ? raw.slice(1) : '')).trim().toLowerCase();
    if (username || raw.startsWith('@')) {
      assert(/^[a-z0-9_]{3,24}$/.test(username), 'Use @ followed by a valid username');
      const account = await db.prepare('SELECT users.id,users.name FROM profiles JOIN users ON users.id=profiles.user_id WHERE profiles.username=?').get(username);
      assert(account, `No account found for @${username}. Check the username or add a guest by name.`);
      return {name:account.name,userId:account.id};
    }
    if (emailValue) {
      const account=await db.prepare('SELECT id,name FROM users WHERE email=?').get(String(emailValue).trim().toLowerCase());
      assert(account,'No account with this email. Add a guest by name or share the invite code.');
      return {name:account.name,userId:account.id};
    }
    return {name:text(raw,'Member name',60)};
  };
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
  return async (req, res) => {
    let operation = null;
    const send = async (status, data) => {
      if (operation && status >= 200 && status < 300)
        await db
          .prepare('INSERT INTO operations VALUES(?,?,?,?,?)')
          .run(
            operation.userId,
            operation.id,
            operation.path,
            operation.signature,
            JSON.stringify(
              data?.members
                ? { id: data.id, members: [] }
                : data?.guest !== undefined
                  ? { profile: true }
                  : { ok: true },
            ),
          );
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
      if (url.pathname === '/api/health')
        return await send(200, { ok: true, service: 'SplitBill API' });
      if (url.pathname === '/api/google/config' && req.method === 'GET')
        return await send(200, await googleAuth.config());
      let body = {};
      if (['POST', 'PATCH', 'DELETE'].includes(req.method)) {
        assert(
          (req.headers['content-type'] || '').includes('application/json'),
          'JSON body required',
          415,
        );
        let raw = '',
          size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          assert(size <= 3_000_000, 'Request is too large', 413);
          raw += chunk;
        }
        try {
          body = !raw && req.method === 'DELETE' ? {} : JSON.parse(raw);
        } catch {
          assert(false, 'Invalid JSON');
        }
        assert(body && typeof body === 'object' && !Array.isArray(body), 'Invalid request body');
      }
      if (url.pathname === '/api/google/login' && req.method === 'POST') {
        throttle(`google:${req.socket.remoteAddress}`, 15);
        const recovered = await googleAccount(await googleAuth.exchange(body.code, body.verifier));
        const session = randomBytes(32).toString('hex');
        await db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(session), recovered.id, Date.now()+3650*86400_000);
        return await send(200, {token:session,user:await publicUser(recovered)});
      }
      if (['email-login', 'backup-email'].includes(segments[1]))
        return await send(410, { error: 'Email sign-in has been replaced by Google. Update SplitBill and continue with Google.' });
      if (['guest', 'register', 'login'].includes(segments[1]) && !allowLegacyAuth)
        return await send(410, { error: 'Continue with Google to create or restore your SplitBill account.' });
      if (segments[1] === 'guest' && req.method === 'POST') {
        throttle(`auth:${req.socket.remoteAddress}`);
        const username = String(body.username || `user_${randomBytes(6).toString('hex')}`)
          .trim()
          .toLowerCase();
        assert(
          /^[a-z0-9_]{3,24}$/.test(username),
          'Use 3–24 letters, numbers or underscores for your username',
        );
        assert(
          !(await db.prepare('SELECT user_id FROM profiles WHERE username=?').get(username)),
          'That username is taken. Choose another.',
          409,
        );
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
        await db
          .prepare('INSERT INTO users VALUES(?,?,?,?,?)')
          .run(user.id, user.email, user.name, user.salt, user.password);
        await db
          .prepare('INSERT INTO profiles(user_id,username,photo) VALUES(?,?,?)')
          .run(user.id, username, '');
        const token = randomBytes(32).toString('hex');
        await db
          .prepare('INSERT INTO sessions VALUES(?,?,?)')
          .run(hash(token), user.id, Date.now() + 3650 * 86400_000);
        return await send(200, { token, user: await publicUser(user) });
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
            !(await db.prepare('SELECT id FROM users WHERE email=?').get(email)),
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
            await db
              .prepare('INSERT INTO users VALUES(?,?,?,?,?)')
              .run(user.id, user.email, user.name, user.salt, user.password);
          } catch (e) {
            if (String(e.message).includes('UNIQUE'))
              assert(false, 'An account already exists for this email', 409);
            throw e;
          }
        } else {
          user = await db.prepare('SELECT * FROM users WHERE email=?').get(email);
          const actual = Buffer.from(await derive(password, user?.salt || 'memogo-dummy-salt', 64));
          assert(
            user && timingSafeEqual(actual, Buffer.from(user.password, 'hex')),
            'Email or password is incorrect',
            401,
          );
        }
        await db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
        const token = randomBytes(32).toString('hex');
        await db
          .prepare('INSERT INTO sessions VALUES(?,?,?)')
          .run(hash(token), user.id, Date.now() + 30 * 86400_000);
        return await send(200, { token, user: await publicUser(user) });
      }
      const token = (req.headers.authorization || '').replace(/^Bearer /, '');
      const user = await db
        .prepare(
          'SELECT users.* FROM users JOIN sessions ON users.id=sessions.user_id WHERE sessions.token=? AND sessions.expires>?',
        )
        .get(hash(token), Date.now());
      assert(user, 'Please sign in again', 401);
      if (url.pathname === '/api/google/link' && req.method === 'POST') {
        throttle(`google-link:${user.id}`, 10);
        await googleAccount(await googleAuth.exchange(body.code,body.verifier),user);
        return await send(200, await publicUser(user));
      }
      if (
        body.clientRequestId &&
        !['logout'].includes(segments[1]) &&
        !(segments[3] === 'expenses' && req.method === 'POST')
      ) {
        assert(/^[a-zA-Z0-9_-]{16,100}$/.test(body.clientRequestId), 'Invalid offline request ID');
        const previous = await db
          .prepare('SELECT * FROM operations WHERE user_id=? AND request_id=?')
          .get(user.id, body.clientRequestId);
        if (previous) {
          assert(
            previous.path === `${req.method}:${url.pathname}` &&
              previous.signature === requestSignature(body),
            'This update already synced. Refresh before changing it.',
            409,
          );
          const recorded = JSON.parse(previous.response);
          if (recorded.members) {
            const latest = await db.prepare('SELECT data FROM trips WHERE id=?').get(recorded.id);
            if (!latest) return await send(200, {ok:true});
            const currentTrip=JSON.parse(latest.data);
            assert(currentTrip.members.some(member=>member.userId===user.id),'You do not have access to this group',403);
            return await send(200, await decorate(currentTrip,user));
          }
          return await send(200, recorded.profile ? await publicUser(user) : recorded);
        }
        operation = {
          userId: user.id,
          id: body.clientRequestId,
          path: `${req.method}:${url.pathname}`,
          signature: requestSignature(body),
        };
      }
      if (segments[1] === 'logout' && req.method === 'POST') {
        await db.prepare('DELETE FROM sessions WHERE token=?').run(hash(token));
        return await send(200, { ok: true });
      }
      if (segments[1] === 'me') {
        if (req.method === 'PATCH') {
          const current = await publicUser(user);
          const nextName = text(body.name ?? user.name, 'Name', 60);
          const username = String(body.username ?? current.username ?? '')
            .trim()
            .toLowerCase();
          {
            assert(/^[a-z0-9_]{3,24}$/.test(username), 'Use 3–24 letters, numbers or underscores');
            const taken = await db
              .prepare('SELECT user_id FROM profiles WHERE username=?')
              .get(username);
            assert(!taken || taken.user_id === user.id, 'That username is taken', 409);
          }
          const photo = body.photo ?? current.photo ?? '';
          assert(
            typeof photo === 'string' &&
              photo.length < 120000 &&
              (!photo || photo === current.photo || /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(photo)),
            'Choose a smaller profile photo',
          );
          if (username)
            await db
              .prepare(
                'INSERT INTO profiles(user_id,username,photo) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET username=excluded.username,photo=excluded.photo',
              )
              .run(user.id, username, photo);
          user.name = nextName;
          await db.prepare('UPDATE users SET name=? WHERE id=?').run(user.name, user.id);
          for (const row of await db.prepare('SELECT data FROM trips').all()) {
            const group = JSON.parse(row.data);
            const person = group.members.find((m) => m.userId === user.id);
            if (person && person.name !== user.name) {
              snapshots.set(group, auditSnapshot(group));
              person.name = user.name;
              event(group, user, 'updated their name');
              await save(group);
            }
          }
        }
        return await send(200, await publicUser(user));
      }
      if (segments[1] === 'join' && req.method === 'POST') {
        throttle(`join:${user.id}`, 30);
        const row = await db.prepare('SELECT data FROM trips WHERE code=?').get(
          String(body.code || '')
            .trim()
            .toUpperCase(),
        );
        assert(row, 'Group code not found', 404);
        const trip = JSON.parse(row.data);
        snapshots.set(trip, auditSnapshot(trip));
        if (segments[2] === 'preview')
          return await send(200, {
            name: trip.name,
            joined: trip.members.some(member=>member.userId===user.id),
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
            guest.name = user.name;
          } else {
            assert(trip.members.length < 100, 'This group is full');
            trip.members.push({ id: id(), name: user.name, userId: user.id });
          }
          event(trip, user, 'joined the group');
          await save(trip);
        }
        return await send(200, await decorate(trip, user));
      }
      assert(segments[1] === 'trips', 'Not found', 404);
      if (!segments[2]) {
        if (req.method === 'GET') {
          const trips = (await db.prepare('SELECT data FROM trips').all())
            .map((r) => JSON.parse(r.data))
            .filter((t) => t.members.some((m) => m.userId === user.id))
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
          return await send(200, await Promise.all(trips.map((t) => decorate(t, user))));
        }
        assert(req.method === 'POST', 'Method not allowed', 405);
        assert(Object.hasOwn(currencies, body.currency || 'INR'), 'Choose a supported currency');
        const tripId=clientId(body.id);
        assert(!(await db.prepare('SELECT id FROM trips WHERE id=?').get(tripId)), 'Group ID already exists',409);
        const trip = {
          id: tripId,
          code: randomBytes(6).toString('hex').toUpperCase(),
          ownerId: user.id,
          name: text(body.name, 'Group name', 80),
          currency: body.currency || 'INR',
          members: [{ id: clientId(body.me), name: user.name, userId: user.id }],
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
          for (const [index, name] of body.guests.entries()) {
            const person=await resolvePerson(name);
            assert(!person.userId || !trip.members.some(member=>member.userId===person.userId),'This account is already included in the group',409);
            trip.members.push({
              id: clientId(body.memberIds?.[index]),
              ...person,
            });
          }
        }
        assert(new Set(trip.members.map(member=>member.id)).size===trip.members.length,'Member IDs must be unique');
        event(trip, user, 'created the group');
        await save(trip);
        return await send(201, await decorate(trip, user));
      }
      const row = await db.prepare('SELECT data FROM trips WHERE id=?').get(segments[2]);
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
      if (segments[3] === 'attachments') {
        if (req.method === 'POST') {
          const attachmentId = text(body.id, 'File ID', 100);
          assert(/^[a-zA-Z0-9_-]{16,100}$/.test(attachmentId), 'Invalid file ID');
          const mime = String(body.mime || '');
          assert(
            ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(mime),
            'Choose a JPG, PNG, WebP or PDF',
          );
          assert(
            typeof body.data === 'string' && /^[A-Za-z0-9+/]*={0,2}$/.test(body.data),
            'Invalid file',
          );
          const bytes = Buffer.from(body.data, 'base64');
          assert(bytes.length > 0 && bytes.length <= 2_000_000, 'Each file must be under 2 MB');
          const valid =
            mime === 'application/pdf'
              ? bytes.subarray(0, 5).toString() === '%PDF-'
              : mime === 'image/jpeg'
                ? bytes[0] === 255 && bytes[1] === 216
                : mime === 'image/png'
                  ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
                  : bytes.subarray(0, 4).toString() === 'RIFF' &&
                    bytes.subarray(8, 12).toString() === 'WEBP';
          assert(valid, 'The file content does not match its type');
          const filename = text(body.name, 'Filename', 120).replace(/[\\/\r\n]/g, '_');
          const existing = await db
            .prepare('SELECT * FROM attachments WHERE id=?')
            .get(attachmentId);
          if (existing)
            assert(
              existing.trip_id === trip.id &&
                existing.user_id === user.id &&
                existing.data === body.data,
              'File ID already used',
              409,
            );
          else
            await db
              .prepare('INSERT INTO attachments VALUES(?,?,?,?,?,?)')
              .run(attachmentId, trip.id, user.id, filename, mime, body.data);
          return await send(200, { id: attachmentId, name: filename, mime, size: bytes.length });
        }
        assert(req.method === 'GET', 'Method not allowed', 405);
        const file = await db
          .prepare('SELECT * FROM attachments WHERE id=? AND trip_id=?')
          .get(segments[4], trip.id);
        assert(file, 'File not found', 404);
        assert(
          file.user_id === user.id ||
            trip.expenses.some((e) => e.attachments?.some((a) => a.id === file.id)),
          'File not found',
          404,
        );
        res.writeHead(200, {
          'Content-Type': file.mime,
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        });
        return res.end(Buffer.from(file.data, 'base64'));
      }
      if (segments[3] === 'export' && req.method === 'GET') {
        const format = segments[4];
        assert(['pdf', 'xlsx'].includes(format), 'Choose PDF or XLSX');
        const output = await exportTrip(await decorate(trip, user), format, {
          analytics: url.searchParams.get('analytics') === '1',
        });
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
        if (req.method === 'GET') return await send(200, await decorate(trip, user));
        owner();
        if (req.method === 'DELETE') {
          await db.prepare('DELETE FROM trips WHERE id=?').run(trip.id);
          return await send(200, { ok: true });
        }
        assert(req.method === 'PATCH', 'Method not allowed', 405);
        if (body.name !== undefined) trip.name = text(body.name, 'Group name', 80);
        event(trip, user, 'updated group settings');
      } else if (segments[3] === 'categories') {
        assert(req.method === 'POST', 'Method not allowed', 405);
        const category = text(body.name, 'Category', 40);
        trip.categories ||= [];
        if (
          ![...categories, ...trip.categories].some(
            (c) => c.toLowerCase() === category.toLowerCase(),
          )
        ) {
          assert(trip.categories.length < 100, 'This group has reached 100 custom categories');
          trip.categories.push(category);
          event(trip, user, `added category: ${category}`);
        } else return await send(200, await decorate(trip, user));
      } else if (segments[3] === 'members') {
        owner();
        if (req.method === 'POST') {
          assert(trip.members.length < 100, 'Group member limit reached');
          const person=await resolvePerson(body.name,body.username,body.email);
          assert(
            !person.userId || !trip.members.some((m) => m.userId === person.userId),
            'This user is already a member',
            409,
          );
          assert(!trip.members.some(member=>member.id===body.id),'Member ID already exists',409);
          trip.members.push({
            id: clientId(body.id),
            ...person,
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
            assert(!m.userId,'Connected members use their profile name. They can change it in Profile.',409);
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
              return await send(200, await decorate(trip, user));
            }
          }
          const existing = segments[4] ? trip.expenses.find((e) => e.id === segments[4]) : null;
          assert(req.method !== 'PATCH' || existing, 'Expense not found', 404);
          assert(
            !existing || existing.createdBy === user.id || trip.ownerId === user.id,
            'Only its author or group creator can edit this expense',
            403,
          );
          assert(req.method !== 'POST' || !trip.expenses.some(entry=>entry.id===body.id),'Bill ID already exists',409);
          assert(trip.expenses.length < 3000 || existing, 'Group expense limit reached');
          assert(body.receipt === undefined, 'Use the attachment picker to add a file');
          const files = body.attachments ?? existing?.attachments ?? [];
          assert(Array.isArray(files) && files.length <= 3, 'Add up to 3 attachments');
          const attachments = await Promise.all(
            files.map(async (a) => {
              const file = await db
                .prepare('SELECT * FROM attachments WHERE id=? AND trip_id=?')
                .get(a.id, trip.id);
              assert(
                file &&
                  (file.user_id === user.id ||
                    existing?.attachments?.some((old) => old.id === file.id)),
                'Upload the attachment before saving',
              );
              return {
                id: file.id,
                name: file.name,
                mime: file.mime,
                size: Buffer.from(file.data, 'base64').length,
              };
            }),
          );
          const category = text(body.category || 'Other', 'Category', 40);
          trip.categories ||= [];
          if (![...categories, ...trip.categories].includes(category)) {
            assert(trip.categories.length < 100, 'Custom category limit reached');
            trip.categories.push(category);
          }
          const expense = {
            id: existing?.id || clientId(body.id),
            createdBy: existing?.createdBy || user.id,
            title: text(body.title, 'Expense title'),
            date: date(body.date),
            category,
            attachments,
            createdAt: existing?.createdAt || new Date().toISOString(),
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
          assert(req.method !== 'POST' || !trip.transfers.some(entry=>entry.id===body.id),'Transfer ID already exists',409);
          assert(trip.transfers.length < 3000 || existing, 'Transfer limit reached');
          const transfer = {
            id: existing?.id || clientId(body.id),
            createdBy: existing?.createdBy || user.id,
            createdAt: existing?.createdAt || new Date().toISOString(),
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
      await save(trip);
      return await send(200, await decorate(trip, user));
    } catch (error) {
      if (!error.status) console.error('API error:', error.message);
      if (!res.headersSent)
        send(error.status || 500, {
          error: error.status ? error.message : 'Something went wrong. Please try again.',
        });
    }
  };
}
