import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Text } from '../components/Typography';
import { router, useFocusEffect } from 'expo-router';
import { useApp } from '../lib/context';
import { money } from '../lib/types';
import {
  Avatar,
  BottomNav,
  Btn,
  C,
  Empty,
  Enter,
  ErrorBox,
  Field,
  Icon,
  Logo,
  Page,
  s,
} from '../components/ui';
import { GroupCard, PaperArt } from '../components/FinanceCards';
import { GroupForm } from '../components/GroupForm';
import { JoinGroup } from '../components/JoinGroup';
import { NotificationBell, Notifications } from '../components/Notifications';
import { SyncStatus } from '../components/PendingBills';
import Auth from './Auth';
export default function Home() {
  const { user, ready, trips, refresh, updateTrip, error, setError } = useApp();
  const [notifications, setNotifications] = useState(false);
  const [create, setCreate] = useState(false),
    [join, setJoin] = useState(false),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState('');
  useFocusEffect(
    useCallback(() => {
      if (user) refresh().catch((e) => setError((e as Error).message));
    }, [user, refresh, setError]),
  );
  if (!ready)
    return (
      <Page>
        <ActivityIndicator color={C.accent} style={{ flex: 1 }} />
      </Page>
    );
  if (!user) return <Auth />;
  const groups = trips.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));
  const allCurrency = new Set(trips.map((t) => t.currency));
  const currency = trips[0]?.currency || 'INR';
  const balance =
    allCurrency.size === 1
      ? trips.reduce((n, t) => n + (t.balances.find((b) => b.id === t.me)?.balance || 0), 0)
      : 0;
  const hasOpenBalance = trips.some(
    (t) => (t.balances.find((b) => b.id === t.me)?.balance || 0) !== 0,
  );
  const firstName = user.name
    .replace(/\([^)]*\)/g, '')
    .trim()
    .split(' ')[0];
  return (
    <Page>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 25, paddingTop: 23, gap: 24, paddingBottom: 22 }}
        refreshControl={
          <RefreshControl
            refreshing={busy}
            tintColor={C.accent}
            onRefresh={async () => {
              setBusy(true);
              try {
                await refresh();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        }
      >
        <SyncStatus />
        <View style={s.between}>
          <Logo />
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <NotificationBell groups={trips} onPress={() => setNotifications(true)} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Your profile"
              onPress={() => router.push('/profile')}
            >
              <Avatar name={user.name} size={43} />
            </Pressable>
          </View>
        </View>
        <Enter>
          <View style={{ gap: 8, marginTop: 9 }}>
            <View style={[s.row, { gap: 7 }]}>
              <Text style={s.eyebrow}>HEY, {firstName}</Text>
              <Icon name="sunny-outline" color="#929E6C" size={14} />
            </View>
            <Text style={[s.h1, { fontSize: 36, lineHeight: 44 }]}>
              Good company.{`\n`}Fair shares.
            </Text>
            <Text style={s.muted}>Less money talk. More of the good stuff.</Text>
          </View>
        </Enter>
        <Enter delay={65}>
          <View
            style={{
              backgroundColor: '#E7EED9',
              borderRadius: 27,
              padding: 22,
              minHeight: 162,
              overflow: 'hidden',
              justifyContent: 'center',
            }}
          >
            <View style={{ width: '69%', gap: 9, zIndex: 1 }}>
              <Text
                style={{ fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: '#62764E' }}
              >
                {!trips.length
                  ? 'A LITTLE LESS MATHS'
                  : allCurrency.size !== 1
                    ? 'IN GOOD COMPANY'
                    : balance > 0
                      ? 'YOU GET BACK'
                      : balance < 0
                        ? 'YOU OWE'
                        : hasOpenBalance
                          ? 'YOUR NET BALANCE'
                          : 'ALL SQUARE. NICE.'}
              </Text>
              <Text
                adjustsFontSizeToFit
                numberOfLines={2}
                minimumFontScale={0.7}
                style={{ fontSize: 31, fontWeight: '800', color: C.forest, letterSpacing: -1.1 }}
              >
                {!trips.length
                  ? 'More moments.\nLess maths.'
                  : allCurrency.size !== 1
                    ? `${trips.length} happy groups`
                    : money(Math.abs(balance), currency)}
              </Text>
              <Text style={{ fontSize: 10, color: '#738263', lineHeight: 17, maxWidth: 170 }}>
                {!trips.length
                  ? 'One little place for your shared bills.'
                  : allCurrency.size === 1
                    ? `Net balance across your ${currency} groups`
                    : 'Each currency stays in its own lane.'}
              </Text>
            </View>
            <View
              style={{ position: 'absolute', right: -20, top: 3, transform: [{ scale: 0.85 }] }}
            >
              <PaperArt />
            </View>
          </View>
        </Enter>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Btn title="New group" icon="add" onPress={() => setCreate(true)} />
          </View>
          <View style={{ flex: 1 }}>
            <Btn title="Join group" icon="link-outline" secondary onPress={() => setJoin(true)} />
          </View>
        </View>
        <View style={[s.between, { marginTop: 4 }]}>
          <Text style={s.h3}>Your groups</Text>
          <View
            style={{
              backgroundColor: '#E7ECDD',
              minWidth: 29,
              height: 27,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: C.accent }}>
              {String(trips.length).padStart(2, '0')}
            </Text>
          </View>
        </View>
        {trips.length > 5 && (
          <Field
            label="Find a group"
            placeholder="Search groups"
            value={search}
            onChangeText={setSearch}
          />
        )}
        <ErrorBox text={error} />
        {!groups.length && (
          <Empty
            icon="people-outline"
            title={trips.length ? 'No matching groups' : 'The best things are shared.'}
            text={
              trips.length
                ? 'Try another name.'
                : 'Start a group with your favourite people. We’ll take care of the numbers.'
            }
          />
        )}
        {groups.map((t, i) => (
          <Enter key={t.id} delay={Math.min(i, 3) * 45}>
            <GroupCard
              trip={t}
              onPress={() => router.push({ pathname: '/group/[id]', params: { id: t.id } })}
            />
          </Enter>
        ))}
        {groups.length > 0 && (
          <View style={[s.row, { justifyContent: 'center', gap: 7, paddingVertical: 3 }]}>
            <Icon name="heart-outline" size={13} color="#A0AB93" />
            <Text style={{ fontSize: 10, color: '#8A967E' }}>
              Made for friends. And everything you share.
            </Text>
          </View>
        )}
      </ScrollView>
      <Notifications
        groups={trips}
        visible={notifications}
        onClose={() => setNotifications(false)}
      />
      <BottomNav active="Groups" />
      {create && <GroupForm onClose={() => setCreate(false)} />}
      {join && (
        <JoinGroup
          onClose={() => setJoin(false)}
          onJoined={(t) => {
            updateTrip(t);
            setJoin(false);
            router.push({ pathname: '/group/[id]', params: { id: t.id } });
          }}
        />
      )}
    </Page>
  );
}
