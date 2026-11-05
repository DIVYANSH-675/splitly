import type { GooglePending } from './google-flow.mjs';
type Proof = { code: string; verifier: string; link: boolean };
export function createNativeGoogleFlow(options: {
  storage: {
    save: (pending: GooglePending) => Promise<void>;
    load: () => Promise<GooglePending | null>;
    remove: () => Promise<void>;
  };
  openBrowser: (url: string, redirect: string, options: { createTask: boolean }) => Promise<
    { type: 'success'; url: string } | { type: string }
  >;
  apiUrl: () => string;
}): {
  redirectSystemPath: (options: { path: string; initial: boolean }) => string;
  begin: (url: string, pending: GooglePending) => Promise<Proof | null>;
  resume: (callback: string) => Promise<Proof | null>;
};
