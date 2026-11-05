import type { Trip, User } from './types';
export type LocalSnapshot = { user: User; trips: Trip[] };
export type LocalSession = {
  mode: 'demo' | 'child';
  snapshot: () => LocalSnapshot;
  subscribe: (listener: () => void) => () => void;
  request: (path: string, method?: string, body?: Record<string, unknown>) => Promise<unknown>;
};
export function createLocalSession(mode: 'demo' | 'child', saved?: LocalSnapshot | null, persist?: (state: LocalSnapshot) => Promise<void>): LocalSession;
