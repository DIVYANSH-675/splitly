import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { api, baseUrl } from './api';
import { googleAuthorizeUrl, googleCallback, type GooglePending } from './google-flow.mjs';
const pendingKey = 'splitbill.google.pending';
let nativeAuthActive = false;
export async function beginGoogle(link = false) {
  const { authorizeUrl } = await api<{authorizeUrl:string}>('/google/config');
  const randomHex = async () => Array.from(await Crypto.getRandomBytesAsync(32), b => b.toString(16).padStart(2,'0')).join('');
  const verifier = await randomHex();
  const state = await randomHex();
  const challenge = (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,verifier,{encoding:Crypto.CryptoEncoding.BASE64})).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const redirect = Platform.OS === 'web' ? `${window.location.origin}/auth/google` : 'splitly://auth/google';
  const pending:GooglePending = {verifier,state,redirect,apiUrl:baseUrl,createdAt:Date.now(),link};
  const url = googleAuthorizeUrl(authorizeUrl,redirect,state,challenge);
  if (Platform.OS === 'web') {
    // Same-tab redirect avoids popup blockers and survives the OAuth navigation.
    window.sessionStorage.setItem(pendingKey, JSON.stringify(pending));
    window.location.assign(url);
    return null;
  }
  await SecureStore.setItemAsync(pendingKey, JSON.stringify(pending));
  nativeAuthActive = true;
  try {
    const result = await WebBrowser.openAuthSessionAsync(url,redirect);
    if (result.type !== 'success') return null;
    return {...googleCallback(result.url,pending,baseUrl),link};
  } finally {
    nativeAuthActive = false;
    await SecureStore.deleteItemAsync(pendingKey);
  }
}
export async function resumeGoogle() {
  if (Platform.OS !== 'web' && nativeAuthActive) return null;
  const raw = Platform.OS === 'web'
    ? window.sessionStorage.getItem(pendingKey)
    : await SecureStore.getItemAsync(pendingKey);
  const callback = Platform.OS === 'web' ? window.location.href : await Linking.getInitialURL();
  if (Platform.OS === 'web') {
    window.sessionStorage.removeItem(pendingKey);
    // Remove the short-lived code from the address bar before exchanging it.
    window.history.replaceState(null,'','/auth/google');
  } else await SecureStore.deleteItemAsync(pendingKey);
  const pending:GooglePending|null = raw ? JSON.parse(raw) : null;
  return {...googleCallback(callback || '',pending,baseUrl),link:Boolean(pending?.link)};
}
