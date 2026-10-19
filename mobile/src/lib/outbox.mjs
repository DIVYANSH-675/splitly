// Platform-independent durable queue. Inject storage and transport for native/web and tests.
export class Outbox {
  constructor(storage, key) {
    this.storage = storage;
    this.key = key;
    this.items = [];
    this.writes = Promise.resolve();
    this.inFlight = null;
  }
  async load() {
    if (!this.loaded)
      this.loaded = this.storage.getItem(this.key).then((raw) => {
        const parsed = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(parsed))
          throw new Error(
            'Offline bill storage is damaged. Keep the app data and contact support.',
          );
        this.items = parsed;
      });
    await this.loaded;
    return this.items;
  }
  persist() {
    const value = JSON.stringify(this.items);
    this.writes = this.writes.catch(() => {}).then(() => this.storage.setItem(this.key, value));
    return this.writes;
  }
  async put(item) {
    await this.load();
    if (this.inFlight === item.id) throw new Error('This bill is syncing. Try again in a moment.');
    const previous = this.items;
    this.items = [...this.items.filter((v) => v.id !== item.id), { ...item, error: '' }];
    try {
      await this.persist();
    } catch (e) {
      this.items = previous;
      throw e;
    }
  }
  async remove(id) {
    await this.load();
    if (this.inFlight === id) throw new Error('This bill is syncing. Try again in a moment.');
    const previous = this.items;
    this.items = this.items.filter((v) => v.id !== id);
    try {
      await this.persist();
    } catch (e) {
      this.items = previous;
      throw e;
    }
  }
  async flush(send, onSaved) {
    if (this.flushing) return this.flushing;
    this.flushing = (async () => {
      await this.load();
      for (const item of [...this.items]) {
        if (item.error) continue;
        this.inFlight = item.id;
        try {
          const trip = await send(item);
          await onSaved(trip);
          this.items = this.items.filter((v) => v.id !== item.id);
          await this.persist();
        } catch (e) {
          // Validation/permission failures need an explicit edit/retry, never disappear.
          if (e.status >= 400 && e.status < 500 && e.status !== 429 && e.status !== 401) {
            this.items = this.items.map((v) => (v.id === item.id ? { ...v, error: e.message } : v));
            await this.persist();
          } else break;
        } finally {
          this.inFlight = null;
        }
      }
    })();
    try {
      await this.flushing;
    } finally {
      this.flushing = null;
    }
  }
}
