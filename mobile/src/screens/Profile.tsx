import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Text } from '../components/Typography';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useApp } from '../lib/context';
import type { User } from '../lib/types';
import { Avatar, BottomNav, Btn, C, ErrorBox, Field, Icon, Logo, Page, s } from '../components/ui';
import { PaperArt } from '../components/FinanceCards';
import Auth from './Auth';
import { BackupEmail } from '../components/BackupEmail';
export default function Profile() {
  const { user, setUser, signOut, mutate } = useApp();
  const [name, setName] = useState<string | null>(null),
    [username, setUsername] = useState<string | null>(null),
    [photo, setPhoto] = useState<string | null>(null),
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
          <Avatar photo={photo ?? user.photo} name={user.name} size={82} />
          <Btn
            title="Change profile photo"
            secondary
            onPress={async () => {
              try {
                const picked = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ['images'],
                  allowsEditing: true,
                  aspect: [1, 1],
                  quality: 0.7,
                });
                if (picked.canceled) return;
                const result = await ImageManipulator.manipulate(picked.assets[0].uri)
                  .resize({ width: 192 })
                  .renderAsync();
                const file = await result.saveAsync({
                  format: SaveFormat.JPEG,
                  compress: 0.65,
                  base64: true,
                });
                setPhoto(`data:image/jpeg;base64,${file.base64}`);
                setSaved(false);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          />
          {Boolean(photo ?? user.photo) && (
            <Btn title="Remove photo" secondary onPress={() => setPhoto('')} />
          )}
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
          <Field
            label="Unique username"
            value={username ?? user.username ?? ''}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={24}
            placeholder="your_username"
          />
          <ErrorBox text={error} />
          <Btn
            title={saved ? 'Looking good. Saved ✓' : 'Save profile'}
            busy={busy}
            onPress={async () => {
              setBusy(true);
              setError('');
              try {
                setUser(
                  (await mutate('/me', 'PATCH', {
                    name: name ?? user.name,
                    username: username ?? user.username,
                    photo: photo ?? user.photo,
                  })) as User,
                );
                setSaved(true);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </View>
        <Text style={s.eyebrow}>SETTINGS</Text>
        <BackupEmail />
        {user.guest && (
          <View style={[s.row, { alignItems: 'flex-start', gap: 13, paddingHorizontal: 4 }]}>
            <Icon name="phone-portrait-outline" size={20} color={C.muted} />
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={{ color: C.dark, fontSize: 12, fontWeight: '700' }}>
                A familiar face, on this device.
              </Text>
              <Text style={s.muted}>
                Add a verified backup email to restore this account on another device.
              </Text>
            </View>
          </View>
        )}
        {(!user.guest || Boolean(user.backupEmail)) && (
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
