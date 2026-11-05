import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { api, baseUrl } from './api';
import { googleAuthorizeUrl, googleCallback, type GooglePending } from './google-flow.mjs';
import { createNativeGoogleFlow } from './google-native.mjs';
const pendingKey = 'splitbill.google.pending';
const nativeFlow = createNativeGoogleFlow({
  storage: {
    save: (pending) => SecureStore.setItemAsync(pendingKey, JSON.stringify(pending)),
    load: async () => {
      const raw = await SecureStore.getItemAsync(pendingKey);
      return raw ? JSON.parse(raw) : null;
    },
    remove: () => SecureStore.deleteItemAsync(pendingKey),
  },
  openBrowser: WebBrowser.openAuthSessionAsync,
  apiUrl: () => baseUrl,
});
export const redirectGoogleSystemPath = nativeFlow.redirectSystemPath;
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
  return nativeFlow.begin(url, pending);
}
export async function resumeGoogle(nativeCallback?: string) {
  if (Platform.OS !== 'web')
    return nativeFlow.resume(nativeCallback || await Linking.getInitialURL() || '');
  const raw = window.sessionStorage.getItem(pendingKey);
  const callback = window.location.href;
  window.sessionStorage.removeItem(pendingKey);
  // Remove the short-lived code from the address bar before exchanging it.
  window.history.replaceState(null,'','/auth/google');
  const pending:GooglePending|null = raw ? JSON.parse(raw) : null;
  return {...googleCallback(callback,pending,baseUrl),link:Boolean(pending?.link)};
}
