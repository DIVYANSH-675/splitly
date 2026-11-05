import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { ageBands, createParentLock } from '../lib/access-policy.mjs';
import { Btn, C, Chip, ErrorBox, Field, Logo, Page, Sheet, s } from './ui';
import { Text } from './Typography';

const ageKey = 'splitbill.access.age.v1';
const pinKey = 'splitbill.parent.lock.v1';
const parentLock = createParentLock({
  storage: {
    get: () => Platform.OS === 'web' ? AsyncStorage.getItem(pinKey) : SecureStore.getItemAsync(pinKey),
    set: (value) => Platform.OS === 'web' ? AsyncStorage.setItem(pinKey, value) : SecureStore.setItemAsync(pinKey, value),
  },
  digest: (value) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value),
  randomHex: async () => Array.from(await Crypto.getRandomBytesAsync(32), b => b.toString(16).padStart(2, '0')).join(''),
});
export function AccessShell({ children }: { children: (band: string, manage: () => void) => React.ReactNode }) {
  const [band, setBand] = useState<string | null>(null), [selected, setSelected] = useState(''),
    [error, setError] = useState(''), [busy, setBusy] = useState(false),
    [gate, setGate] = useState<'setup' | 'unlock' | ''>(''),
    [birthday, setBirthday] = useState(''), [pin, setPin] = useState(''), [confirm, setConfirm] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(ageKey).then(async value => {
      if (value && ageBands.includes(value) && value !== '18+' && !await parentLock.hasPin()) throw new Error('Parent control record is unavailable.');
      if (alive) { setBand(value && ageBands.includes(value) ? value : ''); setError(''); }
    }).catch(() => { if (alive) setError('Could not read device privacy settings. Please try again. No online account has been opened.'); });
    return () => { alive = false; };
  }, [retry]);
  const save = async (value: string) => {
    await AsyncStorage.setItem(ageKey, value);
    setBand(value); setGate(''); setPin(''); setConfirm(''); setBirthday(''); setError('');
  };
  const manage = () => {
    setError(''); setPin('');
    if (band && band !== '18+') setGate('unlock');
    else { void AsyncStorage.removeItem(ageKey).then(() => { setSelected(''); setBand(''); }).catch(e => setError(e.message)); }
  };
  if (band === null) return <Page>{error ? <View style={{ padding: 26, gap: 20 }}><ErrorBox text={error} /><Btn title="Try again" onPress={() => { setError(''); setRetry(v => v + 1); }} /></View> : <ActivityIndicator color={C.accent} style={{ flex: 1 }} />}</Page>;
  return <>
    {band ? children(band, manage) : <Page><ScrollView contentContainerStyle={{ padding: 26, gap: 26, flexGrow: 1 }}>
      <Logo />
      <View style={{ gap: 12 }}><Text style={s.h1}>A little about you</Text><Text style={s.muted}>Choose your age range to continue. Your age range stays on this device.</Text></View>
      <View style={{ gap: 12 }}>
        {['Under 9', ...ageBands].map(value => <Chip key={value} title={value} active={selected === value} onPress={() => { setSelected(value); setError(''); }} />)}
      </View>
      <ErrorBox text={error} />
      <Btn title="Continue" busy={busy} onPress={async () => {
        setBusy(true); setError('');
        try {
          if (!selected) throw new Error('Choose an age range.');
          if (selected === 'Under 9') throw new Error('SplitBill is designed for ages 9 and over. Ask a parent or guardian for help.');
          if (selected !== '18+' && !await parentLock.hasPin()) setGate('setup');
          else await save(selected);
        } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
      }} />
      <Text style={s.muted}>For younger users, a parent sets up a private, on-device ledger. It has no sign-in, cloud sharing, camera, photos or online group joining. Adults can use Google sign-in and online groups.</Text>
      <Text style={s.muted}>No name, email or birth date is collected on this screen. Local ledgers are not uploaded or synced.</Text>
    </ScrollView></Page>}
    {gate !== '' && <Sheet visible title={gate === 'setup' ? 'Parent or guardian setup' : 'Parent settings'} onClose={() => { setGate(''); setPin(''); setConfirm(''); setBirthday(''); setError(''); }}>
      <Text style={s.body}>{gate === 'setup' ? 'A parent or guardian aged 18 or over must set up this device. Choose a six-digit PIN and keep it private.' : 'Enter the parent PIN to return to device age settings. Local groups stay on this device and are never moved into a Google account.'}</Text>
      {gate === 'setup' && <Field label="Parent’s birth date · YYYY-MM-DD" value={birthday} onChangeText={setBirthday} placeholder="YYYY-MM-DD" maxLength={10} autoCapitalize="none" />}
      <Field label="Parent PIN · 6 digits" value={pin} onChangeText={setPin} secureTextEntry keyboardType="number-pad" maxLength={6} />
      {gate === 'setup' && <Field label="Confirm parent PIN" value={confirm} onChangeText={setConfirm} secureTextEntry keyboardType="number-pad" maxLength={6} />}
      <ErrorBox text={error} />
      <Btn title={gate === 'setup' ? 'Set up local mode' : 'Open device age settings'} busy={busy} onPress={async () => {
        setBusy(true); setError('');
        try {
          if (gate === 'setup') { await parentLock.setup(birthday, pin, confirm); await save(selected); }
          else { await parentLock.unlock(pin); await AsyncStorage.removeItem(ageKey); setBand(''); setSelected(''); setGate(''); setPin(''); }
        } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
      }} />
      {gate === 'setup' && <Text style={s.muted}>The birth date is checked on this device and then discarded. Only a salted PIN hash is saved. Forgotten parent PINs cannot be recovered through Google sign-in; keep the PIN somewhere safe.</Text>}
    </Sheet>}
  </>;
}
