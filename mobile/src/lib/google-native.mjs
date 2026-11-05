import { googleCallback } from './google-flow.mjs';

// The browser session owns a live sign-in. Only a cold/late return needs a route.
export function createNativeGoogleFlow({ storage, openBrowser, apiUrl }) {
  let active = false;
  return {
    redirectSystemPath({ path, initial }) {
      if (!initial && active) {
        try {
          const url = new URL(path);
          if (url.protocol === 'splitly:' && url.host === 'auth' && url.pathname === '/google')
            return '';
        } catch { /* Leave unrelated links to Expo Router. */ }
      }
      return path;
    },
    async begin(url, pending) {
      await storage.save(pending);
      active = true;
      try {
        // Keep the Custom Tab in the app task, so returning clears it from Back.
        const result = await openBrowser(url, pending.redirect, { createTask: false });
        if (result.type !== 'success') return null;
        const proof = googleCallback(result.url, pending, apiUrl());
        await storage.remove();
        return { ...proof, link: pending.link };
      } finally {
        active = false;
        // Android can report dismissal just before delivering its link. Retain
        // the expiring proof until a validated return or the next sign-in.
      }
    },
    async resume(callback) {
      if (active) return null;
      const pending = await storage.load();
      const proof = googleCallback(callback, pending, apiUrl());
      await storage.remove();
      return { ...proof, link: Boolean(pending?.link) };
    },
  };
}
