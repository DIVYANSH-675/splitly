import { test } from 'node:test';
import { strict as a } from 'node:assert';
import { createNativeGoogleFlow } from '../mobile/src/lib/google-native.mjs';

const pending = () => ({
  verifier: 'v'.repeat(64), state: 'device-state', redirect: 'splitly://auth/google',
  apiUrl: 'https://api.test', createdAt: Date.now(), link: false,
});
const callback = 'splitly://auth/google?state=device-state&code=one-use';
function setup() {
  let saved = null, finish, options;
  const storage = {
    save: async (value) => { saved = structuredClone(value); },
    load: async () => saved,
    remove: async () => { saved = null; },
  };
  const make = () => createNativeGoogleFlow({
    storage, apiUrl: () => 'https://api.test',
    openBrowser: (...args) => {
      options = args;
      return new Promise((resolve) => { finish = resolve; });
    },
  });
  return { make, saved: () => saved, options: () => options, finish: (value) => finish(value) };
}

test('warm Google return has one owner and does not push another sign-in route', async () => {
  const h = setup(), flow = h.make();
  const login = flow.begin('https://accounts.test', pending());
  await Promise.resolve();
  a.deepEqual(h.options(), ['https://accounts.test', 'splitly://auth/google', { createTask: false }]);
  // Router sees the same Linking event as WebBrowser, before its promise resolves.
  a.equal(flow.redirectSystemPath({ path: callback, initial: false }), '');
  a.equal(await flow.resume(callback), null);
  const other = 'splitly://group/group-id';
  a.equal(flow.redirectSystemPath({ path: other, initial: false }), other);
  const evil = 'other://auth/google?state=device-state&code=bad';
  a.equal(flow.redirectSystemPath({ path: evil, initial: false }), evil);
  h.finish({ type: 'success', url: callback });
  a.deepEqual(await login, { code: 'one-use', verifier: 'v'.repeat(64), link: false });
  a.equal(h.saved(), null);
});

test('a callback arriving after Android dismissal still completes with its current URL', async () => {
  const h = setup(), flow = h.make(), p = pending();
  p.link = true;
  const login = flow.begin('https://accounts.test', p);
  await Promise.resolve();
  h.finish({ type: 'dismiss' });
  a.equal(await login, null);
  a.ok(h.saved());
  a.equal(flow.redirectSystemPath({ path: callback, initial: false }), callback);
  a.deepEqual(await flow.resume(callback), { code: 'one-use', verifier: p.verifier, link: true });
  a.equal(h.saved(), null);
  await a.rejects(() => flow.resume(callback), /expired/);
});

test('process restart recovers a saved Google sign-in through the callback page', async () => {
  const h = setup(), flow = h.make(), p = pending();
  const login = flow.begin('https://accounts.test', p);
  await Promise.resolve();
  const restarted = h.make();
  a.equal(restarted.redirectSystemPath({ path: callback, initial: true }), callback);
  a.deepEqual(await restarted.resume(callback), { code: 'one-use', verifier: p.verifier, link: false });
  a.equal(h.saved(), null);
  h.finish({ type: 'cancel' });
  await login;
});

test('late returns retain state, expiry and API binding checks', async () => {
  const h = setup(), flow = h.make(), p = pending();
  p.createdAt -= 600001;
  const login = flow.begin('https://accounts.test', p);
  await Promise.resolve();
  h.finish({ type: 'dismiss' });
  await login;
  await a.rejects(() => flow.resume(callback), /expired/);
  const next = flow.begin('https://accounts.test', pending());
  await Promise.resolve();
  h.finish({ type: 'cancel' });
  await next;
  await a.rejects(() => flow.resume(callback.replace('device-state', 'attacker')), /matched/);
  a.ok(h.saved(), 'an invalid link must not consume the legitimate pending sign-in');
  a.equal((await flow.resume(callback)).code, 'one-use');
});
