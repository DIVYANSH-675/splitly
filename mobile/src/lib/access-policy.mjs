import { isCalendarDate } from './expense-date.mjs';
export const ageBands = ['9-12', '13-15', '16-17', '18+'];
export const canAccessCloud = (band) => band === '18+';
export function isAdultBirthDate(value, now = new Date()) {
  if (!isCalendarDate(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const age = now.getFullYear() - year - (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day) ? 1 : 0);
  return age >= 18 && age <= 120;
}
export function createParentLock({ storage, digest, randomHex, now = () => Date.now() }) {
  let pending = Promise.resolve();
  const read = async () => { const raw = await storage.get(); return raw ? JSON.parse(raw) : null; };
  return {
    hasPin: async () => Boolean(await read()),
    async setup(birthday, pin, confirmation) {
      if (await read()) throw new Error('A parent PIN already exists. Use it to open parent settings.');
      if (!isAdultBirthDate(birthday, new Date(now()))) throw new Error('A parent or guardian aged 18 or over must set up this device.');
      if (!/^\d{6}$/.test(pin) || pin !== confirmation) throw new Error('Enter and confirm a six-digit parent PIN.');
      const salt = await randomHex();
      await storage.set(JSON.stringify({ salt, hash: await digest(`${salt}:${pin}`), attempts: 0, lockedUntil: 0 }));
      // Birth date and plain PIN are deliberately never stored.
    },
    unlock(pin) {
      const job = pending.catch(() => {}).then(async () => {
        const record = await read();
        if (!record) throw new Error('A parent must set up this device first.');
        if (record.lockedUntil > now()) throw new Error('Too many attempts. Wait five minutes before trying again.');
        const hash = await digest(`${record.salt}:${pin}`);
        let different = hash.length ^ record.hash.length;
        for (let i = 0; i < record.hash.length; i++) different |= (hash.charCodeAt(i) || 0) ^ record.hash.charCodeAt(i);
        if (different || !/^\d{6}$/.test(pin)) {
          record.attempts += 1;
          if (record.attempts >= 5) { record.lockedUntil = now() + 300000; record.attempts = 0; }
          await storage.set(JSON.stringify(record));
          throw new Error('Incorrect parent PIN.');
        }
        await storage.set(JSON.stringify({ ...record, attempts: 0, lockedUntil: 0 }));
      });
      pending = job;
      return job;
    },
  };
}
