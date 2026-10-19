import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

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
  const response = await timedFetch(`${baseUrl}/api/trips/${tripId}/attachments/${id}`, { headers: {Authorization: `Bearer ${token}`} });
  if (!response.ok) throw new ApiError((await response.json()).error || 'Could not open attachment', response.status);
  return new Uint8Array(await response.arrayBuffer());
}
