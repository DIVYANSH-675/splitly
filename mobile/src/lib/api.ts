import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { getLocalSession } from './local-gateway.mjs';
import { demoReport } from './demo-report.mjs';
import { decodeDemoFile } from './demo-assets.mjs';
import type { Trip } from './types';

const configured = process.env.EXPO_PUBLIC_API_URL;
const host =
  Platform.OS === 'web'
    ? typeof window !== 'undefined'
      ? window.location.hostname
      : 'localhost'
    : Constants.expoConfig?.hostUri?.split(':')[0] || '10.0.2.2';
export let baseUrl = configured || (Platform.OS === 'web' ? `http://${host}:4310` : 'https://gomowueeizpwzzbqugod.supabase.co/functions/v1/splitbill-api');
let token = '';
export const sessionCacheKey = () => `splitly.cache:${baseUrl}:${token.slice(-16)}`;
async function timedFetch(url: string, options: RequestInit = {}, timeout = 18000) {
  if (getLocalSession()) throw new Error('Internet requests are disabled in local mode.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function initApi() {
  const stored = await AsyncStorage.getItem('memogo.api');
  if (stored) baseUrl = stored;
  token =
    (Platform.OS === 'web'
      ? await AsyncStorage.getItem('memogo.token')
      : await SecureStore.getItemAsync('memogo.token')) || '';
  return Boolean(token);
}
export async function setApiUrl(url: string) {
  const clean = url.trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s]+$/.test(clean))
    throw new Error('Enter a full server URL, for example http://192.168.1.5:4310');
  const response = await timedFetch(`${clean}/api/health`, {}, 8000);
  if (!response.ok || (await response.json()).service !== 'SplitBill API')
    throw new Error('This address is not a SplitBill server');
  await setToken('');
  baseUrl = clean;
  await AsyncStorage.setItem('memogo.api', clean);
}
export async function setToken(value: string) {
  token = value;
  if (Platform.OS === 'web') {
    if (value) await AsyncStorage.setItem('memogo.token', value);
    else await AsyncStorage.removeItem('memogo.token');
  } else {
    if (value) await SecureStore.setItemAsync('memogo.token', value);
    else await SecureStore.deleteItemAsync('memogo.token');
  }
}
export async function api<T = unknown>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const local = getLocalSession();
  if (local) {
    // A cloud outbox may still be awaiting a file read when device mode changes.
    // Never acknowledge that old account's queued write against a local ledger.
    if (body && typeof body === 'object' && 'clientRequestId' in body)
      throw new Error('Cloud sync is paused while local mode is open. Your queued change is retained.');
    return await local.request(path, method, body as Record<string, unknown>) as T;
  }
  let response: Response;
  try {
    response = await timedFetch(`${baseUrl}/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error('Cannot reach your server. Check your connection and server address.');
  }
  const data = await response.json();
  if (!response.ok) throw new ApiError(data.error || 'Request failed', response.status);
  return data;
}

export async function exportBytes(tripId: string, format: 'pdf' | 'xlsx', analytics = false) {
  const local = getLocalSession();
  if (local) {
    if (local.mode !== 'demo') throw new Error('Report sharing is unavailable in on-device child mode.');
    return demoReport(await local.request(`/trips/${tripId}`) as Trip, format, analytics);
  }
  const response = await timedFetch(
    `${baseUrl}/api/trips/${tripId}/export/${format}?analytics=${analytics ? 1 : 0}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
    120000,
  );
  if (!response.ok)
    throw new ApiError((await response.json()).error || 'Export failed', response.status);
  return new Uint8Array(await response.arrayBuffer());
}

export async function attachmentBytes(tripId: string, id: string) {
  const local = getLocalSession();
  if (local) {
    if (local.mode !== 'demo') throw new Error('Online attachments are unavailable in local mode.');
    const file = await local.request(`/trips/${tripId}/attachments/${id}`) as { data: string };
    return decodeDemoFile(file.data);
  }
  const response = await timedFetch(`${baseUrl}/api/trips/${tripId}/attachments/${id}`, { headers: {Authorization: `Bearer ${token}`} });
  if (!response.ok) throw new ApiError((await response.json()).error || 'Could not open attachment', response.status);
  return new Uint8Array(await response.arrayBuffer());
}
