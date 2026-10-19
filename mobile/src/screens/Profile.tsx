import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Text } from '../components/Typography';
import { router } from 'expo-router';
import { api } from '../lib/api';
import { useApp } from '../lib/context';
import type { User } from '../lib/types';
import { Avatar, BottomNav, Btn, C, ErrorBox, Field, Icon, Logo, Page, s } from '../components/ui';
import { PaperArt } from '../components/FinanceCards';
import Auth from './Auth';
export default function Profile() {
  const { user, setUser, signOut } = useApp();
  const [name, setName] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false);
  if (!user) return <Auth />;
  return (
    <Page>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 25, gap: 26 }}
      >
        <Logo small />
        <View style={{ alignItems: 'center', paddingVertical: 10, gap: 12 }}>
          <Text style={[s.eyebrow, { marginBottom: 9 }]}>YOUR LITTLE CORNER</Text>
          <Avatar name={user.name} size={82} />
          <Text style={s.h2}>{user.name}</Text>
          <Text style={s.muted}>{user.email || 'Good company starts with you.'}</Text>
        </View>
        <View style={[s.card, { padding: 22, gap: 23 }]}>
          <Field
            label="What we call you"
            value={name ?? user.name}
            onChangeText={(v) => {
              setName(v);
              setSaved(false);
            }}
            maxLength={60}
            placeholder="Your name"
          />
          <ErrorBox text={error} />
          <Btn
            title={saved ? 'Looking good. Saved ✓' : 'Save name'}
            busy={busy}
            onPress={async () => {
              setBusy(true);
              setError('');
              try {
                setUser(await api<User>('/me', 'PATCH', { name: name ?? user.name }));
                setSaved(true);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </View>
        {user.guest && (
          <View style={[s.row, { alignItems: 'flex-start', gap: 13, paddingHorizontal: 4 }]}>
            <Icon name="phone-portrait-outline" size={20} color={C.muted} />
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={{ color: C.dark, fontSize: 12, fontWeight: '700' }}>
                A familiar face, on this device.
              </Text>
              <Text style={s.muted}>Keep the app’s data to retain access to your groups.</Text>
            </View>
          </View>
        )}
        {!user.guest && (
          <Btn
            title="Sign out"
            secondary
            busy={busy}
            onPress={async () => {
              setBusy(true);
              try {
                await signOut();
                router.replace('/');
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        )}
        <View
          style={{ alignItems: 'center', transform: [{ scale: 0.7 }], height: 128, marginTop: 5 }}
        >
          <PaperArt />
        </View>
        <Text style={{ fontSize: 10, textAlign: 'center', color: '#94A085' }}>
          Less money talk. More of the good stuff.
        </Text>
      </ScrollView>
      <BottomNav active="Profile" />
    </Page>
  );
}
