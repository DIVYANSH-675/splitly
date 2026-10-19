import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { api, ApiError, baseUrl, initApi, sessionCacheKey, setToken } from './api';
import { Outbox } from './outbox.mjs';
import { currencies, type BillInput, type PendingBill, type Trip, type User } from './types';
type Context = {
  user: User | null;
  ready: boolean;
  trips: Trip[];
  error: string;
  online: boolean;
  pending: PendingBill[];
  syncing: boolean;
  seen: Record<string, string>;
  setError: (s: string) => void;
  signIn: (values: Record<string, string>, register: boolean) => Promise<void>;
  startGuest: (name: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  updateTrip: (trip: Trip) => void;
  setUser: (u: User | null) => void;
  removeTrip: (id: string) => void;
  addBill: (tripId: string, body: BillInput, draftId?: string) => Promise<void>;
  removePending: (id: string) => Promise<void>;
  retryPending: (id?: string) => Promise<void>;
  markRead: (groups: Trip[]) => void;
};
const AppContext = createContext<Context>(null!);
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [trips, setTrips] = useState<Trip[]>([]),
    [error, setError] = useState(''),
    [online, setOnline] = useState(true),
    [pending, setPending] = useState<PendingBill[]>([]),
    [syncing, setSyncing] = useState(false),
    [seen, setSeen] = useState<Record<string, string>>({});
  const outbox = useRef<Outbox | null>(null);
  const currentUser = useRef<string | null>(null);
  const cacheWrites = useRef(Promise.resolve());
  const updateTrip = useCallback(
    (trip: Trip) =>
      setTrips((prev) => {
        const old = prev.find((t) => t.id === trip.id);
        return old && (old.version || 0) > (trip.version || 0)
          ? prev
          : [trip, ...prev.filter((t) => t.id !== trip.id)];
      }),
    [],
  );
  const refresh = useCallback(async () => {
    try {
      const data = await api<Trip[]>('/trips');
      setTrips((prev) =>
        data.map((trip) => {
          const old = prev.find((t) => t.id === trip.id);
          return old && old.version > trip.version ? old : trip;
        }),
      );
      setError('');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await setToken('');
        setUser(null);
        setTrips([]);
      }
      throw e;
    }
  }, []);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (await initApi()) {
          const raw = await AsyncStorage.getItem(sessionCacheKey());
          if (raw && alive) {
            const cached = JSON.parse(raw);
            setUser(cached.user);
            setTrips(cached.trips || []);
            setSeen(cached.seen || {});
            setReady(true);
          }
          try {
            const account = await api<User>('/me');
            if (alive) setUser(account);
            await refresh();
          } catch (e) {
            if (e instanceof ApiError && e.status === 401) {
              await setToken('');
              if (alive) {
                setUser(null);
                setTrips([]);
              }
            } else if (alive)
              setError('Using saved groups. New bills will sync when your server is reachable.');
          }
        }
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [refresh]);
  useEffect(() => {
    if (!ready || !user) return;
    const key = sessionCacheKey(),
      value = JSON.stringify({ user, trips, seen });
    cacheWrites.current = cacheWrites.current
      .catch(() => {})
      .then(() => AsyncStorage.setItem(key, value))
      .catch(() => setError('Could not save groups on this device. Check free storage.'));
  }, [ready, user, trips, seen]);
  const userId = user?.id;
  useEffect(() => {
    currentUser.current = userId || null;
    if (!userId) {
      outbox.current = null;
      return;
    }
    const box = new Outbox(AsyncStorage, `splitly.outbox:${baseUrl}:${userId}`);
    outbox.current = box;
    box
      .load()
      .then((items) => {
        if (outbox.current === box) setPending([...items]);
      })
      .catch((e) => setError(e.message));
  }, [userId]);
  const sync = useCallback(async () => {
    const box = outbox.current,
      owner = currentUser.current;
    if (!box || !owner || !online) return;
    setSyncing(true);
    try {
      await box.flush(
        (item) =>
          api<Trip>(`/trips/${item.tripId}/expenses`, 'POST', {
            ...item.body,
            clientRequestId: item.id,
          }),
        (trip) => {
          if (currentUser.current === owner) updateTrip(trip);
        },
      );
      if (outbox.current === box) setPending([...(await box.load())]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }, [online, updateTrip]);
  useEffect(() => NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)), []);
  useEffect(() => {
    if (!userId) return;
    void sync();
    const timer = setInterval(() => {
      void sync();
    }, 8000);
    const refreshTimer = setInterval(() => {
      if (online) refresh().catch(() => {});
    }, 15000);
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void sync();
        refresh().catch(() => {});
      }
    });
    return () => {
      clearInterval(timer);
      clearInterval(refreshTimer);
      listener.remove();
    };
  }, [userId, sync, refresh, online]);
  const addBill = async (tripId: string, body: BillInput, draftId?: string) => {
    const box = outbox.current;
    if (!box || !user) throw new Error('Open a saved group before adding an offline bill.');
    const decimals = currencies[body.currency];
    if (!body.title.trim() || body.title.trim().length > 120)
      throw new Error('Enter a description up to 120 characters.');
    if (
      !new RegExp(decimals ? `^\\d{1,10}(?:\\.\\d{1,${decimals}})?$` : '^\\d{1,10}$').test(
        body.amount,
      ) ||
      Number(body.amount) <= 0
    )
      throw new Error('Enter a valid amount greater than zero.');
    if (!body.shares.length || !body.payers.length)
      throw new Error('Choose who paid and who shares this bill.');
    await box.put({
      id: draftId || `bill_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`,
      tripId,
      body,
      createdAt: new Date().toISOString(),
    });
    setPending([...(await box.load())]);
    void sync();
  };
  const removePending = async (id: string) => {
    const box = outbox.current;
    if (box) {
      await box.remove(id);
      setPending([...(await box.load())]);
    }
  };
  const retryPending = async (id?: string) => {
    const box = outbox.current;
    if (!box) return;
    for (const item of [...(await box.load())])
      if (!id || item.id === id) await box.put({ ...item, error: '' });
    setPending([...(await box.load())]);
    await sync();
  };
  const signIn = async (values: Record<string, string>, register: boolean) => {
    const result = await api<{ token: string; user: User }>(
      register ? '/register' : '/login',
      'POST',
      values,
    );
    await setToken(result.token);
    setSeen({});
    setPending([]);
    setUser(result.user);
    await refresh();
  };
  const startGuest = async (name: string) => {
    const result = await api<{ token: string; user: User }>('/guest', 'POST', { name });
    await setToken(result.token);
    setSeen({});
    setPending([]);
    setUser(result.user);
    await refresh();
  };
  const signOut = async () => {
    if (outbox.current && (await outbox.current.load()).length)
      throw new Error('Sync or remove your saved offline bills before signing out.');
    try {
      await api('/logout', 'POST', {});
    } finally {
      await setToken('');
      setUser(null);
      setPending([]);
      setTrips([]);
      setError('');
    }
  };
  const removeTrip = useCallback(
    (id: string) => setTrips((prev) => prev.filter((t) => t.id !== id)),
    [],
  );
  const markRead = useCallback(
    (groups: Trip[]) =>
      setSeen((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const t of groups)
          if (t.activity?.length && prev[t.id] !== t.activity[0].id) {
            next[t.id] = t.activity[0].id;
            changed = true;
          }
        return changed ? next : prev;
      }),
    [],
  );
  return (
    <AppContext.Provider
      value={{
        user,
        ready,
        trips,
        error,
        online,
        pending,
        syncing,
        seen,
        setError,
        signIn,
        startGuest,
        signOut,
        refresh,
        updateTrip,
        setUser,
        removeTrip,
        addBill,
        removePending,
        retryPending,
        markRead,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
export const useApp = () => useContext(AppContext);
