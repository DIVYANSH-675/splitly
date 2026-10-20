import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';
import { Text } from '../components/Typography';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { openAttachment } from '../lib/attachments';
import { api } from '../lib/api';
import { categoryInfo } from '../lib/categories';
import { useApp } from '../lib/context';
import {
  money,
  prettyDate,
  type Expense,
  type Transfer,
  type PendingBill,
  type Trip,
} from '../lib/types';
import {
  Avatar,
  Btn,
  C,
  Empty,
  Enter,
  ErrorBox,
  FacePile,
  Field,
  Icon,
  IconButton,
  Logo,
  Page,
  Sheet,
  s,
} from '../components/ui';
import { BalanceCard } from '../components/FinanceCards';
import { TransactionList } from '../components/TransactionList';
import { ExpenseForm } from '../components/ExpenseForm';
import { TransferForm } from '../components/TransferForm';
import { NotificationBell } from '../components/Notifications';
import { PendingBills, SyncStatus } from '../components/PendingBills';
import { shareReport } from '../lib/export';
import { Analytics } from '../components/Analytics';
import { GroupForm } from '../components/GroupForm';
import Auth from './Auth';
type Confirm = { title: string; text: string; path: string; group?: boolean };
export default function Group() {
  const { height, width } = useWindowDimensions();
  const compact = height < 760;
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, ready, trips, pending, mutate, updateTrip, removeTrip } = useApp();
  const trip = trips.find((t) => t.id === id);
  const [tab, setTab] = useState('Bills'),
    [reportGraph, setReportGraph] = useState(false),
    [form, setForm] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [expense, setExpense] = useState<Expense | undefined>(),
    [draft, setDraft] = useState<PendingBill | undefined>(),
    [transfer, setTransfer] = useState<Transfer | undefined>(),
    [detail, setDetail] = useState<Expense | null>(null),
    [settlement, setSettlement] = useState<
      { from: string; to: string; amount: number } | undefined
    >(),
    [confirmation, setConfirmation] = useState<Confirm | null>(null),
    [memberName, setMemberName] = useState(''),
    [memberId, setMemberId] = useState(''),
    [copied, setCopied] = useState(false);
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let alive = true,
        running = false;
      const load = async () => {
        if (running) return;
        running = true;
        try {
          const t = await api<Trip>(`/trips/${id}`);
          if (alive) {
            updateTrip(t);
            setError((previous) =>
              previous.startsWith('Cannot reach your server') || previous === 'Group not found'
                ? ''
                : previous,
            );
          }
        } catch (e) {
          if (alive) setError((e as Error).message);
        } finally {
          running = false;
        }
      };
      load();
      const timer = setInterval(load, 15000);
      return () => {
        alive = false;
        clearInterval(timer);
      };
    }, [id, user, updateTrip, setError]),
  );
  const act = async (path: string, method: string, body?: unknown) => {
    setBusy(true);
    setError('');
    try {
      if (method === 'GET') updateTrip(await api<Trip>(`/trips/${id}${path}`));
      else await mutate(`/trips/${id}${path}`, method, body as Record<string, unknown>);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const close = () => {
    setForm('');
    setError('');
  };
  if (!ready)
    return (
      <Page>
        <ActivityIndicator color={C.accent} style={{ flex: 1 }} />
      </Page>
    );
  if (!user) return <Auth />;
  if (!trip)
    return (
      <Page>
        <View style={{ padding: 24, gap: 20 }}>
          <ErrorBox text={error} />
          <Empty
            icon="people-outline"
            title={error ? 'Group unavailable' : 'Loading group…'}
            text={error || 'Getting your shared bills.'}
          />
          <Btn title="Back to groups" onPress={() => router.replace('/')} />
        </View>
      </Page>
    );
  const name = (memberId: string) => trip.members.find((m) => m.id === memberId)?.name || 'Member';
  const mine = trip.balances.find((b) => b.id === trip.me);
  const balance = mine?.balance || 0;
  const bills = trip.expenses;
  return (
    <Page>
      <View style={{ paddingHorizontal: 24, paddingTop: compact ? 13 : 20, paddingBottom: 18 }}>
        <View style={s.between}>
          <IconButton
            name="arrow-back"
            label="Back to groups"
            onPress={() => router.replace('/')}
          />
          <Logo small />
          <View style={{ flexDirection: 'row', gap: 7 }}>
            <NotificationBell
              groups={[trip]}
              onPress={() => router.push(`/notifications?group=${trip.id}`)}
            />
            <IconButton
              name="ellipsis-horizontal"
              label="Group options"
              onPress={() => setForm('menu')}
            />
          </View>
        </View>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, gap: 12, paddingBottom: 20 }}
        refreshControl={
          <RefreshControl
            refreshing={busy}
            tintColor={C.accent}
            onRefresh={async () => {
              await act('', 'GET');
            }}
          />
        }
      >
        <View style={{ gap: compact ? 14 : 21, paddingBottom: 6 }}>
          <View style={{ gap: 11 }}>
            <Text
              style={[s.h2, { fontSize: compact ? 23 : 28, lineHeight: compact ? 30 : 36 }]}
              numberOfLines={2}
            >
              {trip.name}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Group members"
              onPress={() => {
                setCopied(false);
                setForm('members');
              }}
              style={[s.between, { alignSelf: 'flex-start', gap: 12 }]}
            >
              <FacePile members={trip.members} />
              <Text style={s.muted}>
                {trip.members.length} people · {trip.currency}
              </Text>
              <Icon name="chevron-forward" size={13} color={C.muted} />
            </Pressable>
          </View>
          <Enter>
            <BalanceCard
              compact={compact}
              balance={balance}
              currency={trip.currency}
              total={trip.total}
              paid={mine?.paid || 0}
              share={mine?.spent || 0}
            />
          </Enter>
          {trip.localOnly && (
            <Text style={s.muted}>Includes changes saved on this device. Waiting to sync.</Text>
          )}
          <Analytics trip={trip} />
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: '#E8EDE0',
              borderRadius: 19,
              padding: 5,
              gap: 4,
            }}
          >
            {['Bills', 'Balances'].map((t) => (
              <Pressable
                accessibilityRole="tab"
                accessibilityLabel={t}
                accessibilityState={{ selected: t === tab }}
                key={t}
                onPress={() => {
                  setTab(t);
                  setError('');
                }}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  minHeight: 41,
                  borderRadius: 14,
                  backgroundColor: t === tab ? '#FFFFFF' : 'transparent',
                  shadowColor: '#354726',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: t === tab ? 0.035 : 0,
                  shadowRadius: 4,
                }}
              >
                <Icon
                  name={t === 'Bills' ? 'receipt-outline' : 'swap-horizontal-outline'}
                  size={16}
                  color={t === tab ? C.accent : '#8C9782'}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: t === tab ? '800' : '500',
                    color: t === tab ? C.accent : '#7E8B73',
                  }}
                >
                  {t === 'Bills' ? 'Transactions' : 'Settle up'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <ErrorBox text={error} />
        <SyncStatus />
        <PendingBills
          trip={trip}
          onEdit={(bill) => {
            setExpense(undefined);
            setDraft(bill);
            setForm('expense');
          }}
        />
        {tab === 'Bills' ? (
          <>
            <View style={[s.between, { paddingTop: 4, paddingBottom: 6 }]}>
              <Text style={s.eyebrow}>TRANSACTIONS</Text>
              <Text style={{ fontSize: 10, color: C.muted }}>
                {bills.length} {bills.length === 1 ? 'bill' : 'bills'}
                {trip.transfers.length
                  ? ` · ${trip.transfers.length} ${trip.transfers.length === 1 ? 'transfer' : 'transfers'}`
                  : ''}
              </Text>
            </View>
            {!bills.length && !trip.transfers.length && (
              <Empty
                icon="receipt-outline"
                title="The first one’s on someone."
                text="Dinner, rent, or a round of coffees. Add a bill and let us do the splitting."
              />
            )}
            <TransactionList
              trip={trip}
              userId={user.id}
              onBill={setDetail}
              onTransfer={(payment) => {
                setTransfer(payment);
                setSettlement(undefined);
                setForm('transfer');
              }}
              onRemoveTransfer={(payment) =>
                setConfirmation({
                  title: 'Remove payment record?',
                  text: 'Balances will be recalculated.',
                  path: `/transfers/${payment.id}`,
                })
              }
            />
          </>
        ) : (
          <>
            <Text style={[s.eyebrow, { marginTop: 4, marginBottom: 3 }]}>EVERYONE’S BALANCE</Text>
            <View style={[s.card, { gap: 0, paddingVertical: 5 }]}>
              {trip.balances.map((b, i) => (
                <View
                  key={b.id}
                  style={[
                    s.row,
                    {
                      paddingVertical: 15,
                      borderBottomWidth: i < trip.balances.length - 1 ? 1 : 0,
                      borderColor: '#EDF0E7',
                    },
                  ]}
                >
                  <Avatar photo={b.photo} name={b.name} index={i} size={42} />
                  <View style={{ flex: 1, gap: 5 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: C.dark }}>
                      {b.name.replace(/\([^)]*\)/g, '').trim()}
                      {b.id === trip.me ? ' · you' : ''}
                    </Text>
                    <Text style={{ fontSize: 10, color: C.muted }}>
                      {b.balance > 0 ? 'Gets back' : b.balance < 0 ? 'To pay back' : 'All square'}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '800',
                      color: b.balance < 0 ? C.red : b.balance > 0 ? C.green : C.muted,
                      letterSpacing: -0.4,
                    }}
                  >
                    {b.balance > 0 ? '+' : b.balance < 0 ? '−' : ''}
                    {money(Math.abs(b.balance), trip.currency)}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={[s.eyebrow, { marginTop: 13, marginBottom: 3 }]}>
              A LITTLE SETTLING UP
            </Text>
            {!trip.settlements.length && (
              <Empty
                icon="checkmark-circle-outline"
                title="All square. All smiles."
                text="Everyone’s paid their share. Back to making memories."
              />
            )}
            {trip.settlements.map((t, i) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Record payment"
                key={i}
                onPress={() => {
                  setTransfer(undefined);
                  setSettlement(t);
                  setForm('transfer');
                }}
                style={({ pressed }) => [
                  s.card,
                  { gap: 14, backgroundColor: pressed ? C.pale : '#fff' },
                ]}
              >
                <View style={s.between}>
                  <View style={[s.row, { gap: 8, flex: 1 }]}>
                    <Avatar name={name(t.from)} size={31} index={i + 1} />
                    <Icon name="arrow-forward" size={13} color={C.muted} />
                    <Avatar name={name(t.to)} size={31} />
                  </View>
                  <Text
                    style={{
                      fontSize: 21,
                      fontWeight: '800',
                      color: C.accent,
                      letterSpacing: -0.7,
                    }}
                  >
                    {money(t.amount, trip.currency)}
                  </Text>
                </View>
                <View style={s.between}>
                  <Text style={{ fontSize: 11, color: C.muted, flex: 1 }}>
                    {name(t.from)
                      .replace(/\([^)]*\)/g, '')
                      .trim()}{' '}
                    pays{' '}
                    {name(t.to)
                      .replace(/\([^)]*\)/g, '')
                      .trim()}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Text style={s.link}>Record payment</Text>
                    <Icon name="arrow-forward" size={14} color={C.accent} />
                  </View>
                </View>
              </Pressable>
            ))}
            <Btn
              title="Record another payment"
              secondary
              small
              onPress={() => {
                setTransfer(undefined);
                setSettlement(undefined);
                setForm('transfer');
              }}
            />
          </>
        )}
      </ScrollView>
      <View
        style={{
          paddingHorizontal: 24,
          paddingTop: 8,
          paddingBottom: 18,
          backgroundColor: C.bg,
          flexDirection: 'row',
          gap: 10,
        }}
      >
        <View style={{ flex: 1 }}>
          <Btn
            title={width < 360 ? 'Bill' : 'Add a bill'}
            icon="add"
            onPress={() => {
              setDraft(undefined);
              setExpense(undefined);
              setForm('expense');
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Btn
            title="Transfer"
            icon="swap-horizontal-outline"
            secondary
            onPress={() => {
              setTransfer(undefined);
              setSettlement(undefined);
              setForm('transfer');
            }}
          />
        </View>
      </View>
      {form === 'expense' && (
        <ExpenseForm
          trip={trip}
          expense={expense}
          draft={draft}
          onClose={close}
          onSaved={updateTrip}
        />
      )}
      {form === 'transfer' && (
        <TransferForm
          trip={trip}
          initial={settlement}
          transfer={transfer}
          onClose={close}
          onSaved={updateTrip}
        />
      )}
      {form === 'settings' && <GroupForm trip={trip} onClose={close} />}
      <Sheet title="Group options" visible={form === 'menu'} onClose={close}>
        <Text style={s.h3}>Take your group with you</Text>
        <Text style={s.muted}>
          Bills, each person’s share, balances and transfers. The PDF excludes notification history.
          Exports contain confirmed records only.
          {pending.some((b) => b.tripId === trip.id)
            ? ' Sync your saved bills first to include them.'
            : ''}
        </Text>
        <ErrorBox text={error} />
        <Btn
          secondary
          title={reportGraph ? '✓ Include graphs in PDF' : 'Include graphs in PDF'}
          onPress={() => setReportGraph((v) => !v)}
        />
        {(['pdf', 'xlsx'] as const).map((format) => (
          <Btn
            key={format}
            title={`Export ${format.toUpperCase()}`}
            secondary
            icon="download-outline"
            busy={busy}
            onPress={async () => {
              setBusy(true);
              setError('');
              try {
                await shareReport(trip.id, format, reportGraph);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        ))}
        <Text style={s.muted}>
          You can edit bills and transfers you added.
          {trip.isOwner ? ' As group admin, you can edit anyone’s entries.' : ''}
        </Text>
        {trip.isOwner && (
          <>
            <Btn title="Rename group" secondary onPress={() => setForm('settings')} />
            <Btn
              title="Delete group"
              danger
              onPress={() => {
                close();
                setConfirmation({
                  title: 'Delete group?',
                  text: 'This permanently deletes this group and its bills, transfers and history for everyone.',
                  path: '',
                  group: true,
                });
              }}
            />
          </>
        )}
      </Sheet>
      <Sheet title="People in this group" visible={form === 'members'} onClose={close}>
        <View style={s.card}>
          <Text style={s.label}>Scan to join this group</Text>
          <View
            style={{
              alignItems: 'center',
              padding: 20,
              backgroundColor: C.white,
              borderRadius: 18,
            }}
          >
            {trip.code ? (
              <QRCode
                value={`splitbill:${trip.code}`}
                size={160}
                color={C.dark}
                backgroundColor={C.white}
              />
            ) : (
              <Text style={s.muted}>Your invite QR will appear after this group syncs.</Text>
            )}
          </View>
          <Text style={s.label}>Or share the invite code</Text>
          <Text
            selectable
            style={{ fontSize: 24, letterSpacing: 2, fontWeight: '700', color: C.dark }}
          >
            {trip.code}
          </Text>
          <Btn
            title={copied ? 'Copied ✓' : 'Copy invite code'}
            small
            secondary
            onPress={async () => {
              try {
                await Clipboard.setStringAsync(trip.code);
                setCopied(true);
              } catch {
                setError('Could not copy. You can select the code manually.');
              }
            }}
          />
        </View>
        {trip.members.map((m, i) => (
          <View style={s.row} key={m.id}>
            <Avatar photo={m.photo} name={m.name} index={i} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={s.body}>
                {m.name}
                {m.id === trip.me ? ' (you)' : ''}
              </Text>
              <Text style={{ fontSize: 10, color: C.muted }}>
                {m.linked
                  ? `Connected${m.username ? ` · @${m.username}` : ''}`
                  : m.username
                    ? 'Username invite · waiting to sync'
                    : 'Guest · can be claimed'}
              </Text>
            </View>
            {trip.isOwner && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Edit ${m.name}`}
                onPress={() => {
                  setMemberName(m.name);
                  setMemberId(m.id);
                  setForm('member');
                }}
              >
                <Icon name="create-outline" color={C.muted} size={20} />
              </Pressable>
            )}
          </View>
        ))}
        {trip.isOwner && (
          <Btn
            title="Add a friend"
            icon="person-add-outline"
            onPress={() => {
              setMemberName('');
              setMemberId('');
              setForm('member');
            }}
          />
        )}
        <ErrorBox text={error} />
      </Sheet>
      <Sheet
        title={memberId ? 'Edit friend' : 'Add a friend'}
        visible={form === 'member'}
        onClose={() => {
          setForm('members');
          setError('');
        }}
      >
        <Field
          label={memberId ? 'Name' : 'Name or @username'}
          value={memberName}
          onChangeText={setMemberName}
          placeholder="Jigyasu or @jigyasu_patel"
          maxLength={60}
          editable={!trip.members.find((member) => member.id === memberId)?.linked}
        />
        <Text style={s.muted}>
          {trip.members.find((member) => member.id === memberId)?.linked
            ? 'Connected members use their profile name. They can update it in Profile.'
            : 'Use a name for an unclaimed guest, or @username to add an existing account after syncing.'}
        </Text>
        <ErrorBox text={error} />
        {!trip.members.find((member) => member.id === memberId)?.linked && (
          <Btn
            title="Save friend"
            busy={busy}
            onPress={async () => {
              if (
                await act(
                  `/members${memberId ? `/${memberId}` : ''}`,
                  memberId ? 'PATCH' : 'POST',
                  {
                    name: memberName,
                  },
                )
              ) {
                setForm('members');
                setMemberName('');
              }
            }}
          />
        )}
        {memberId && memberId !== trip.me && (
          <Btn
            title="Remove friend"
            danger
            onPress={() =>
              setConfirmation({
                title: 'Remove friend?',
                text: 'A friend with recorded bills or payments must stay in the group.',
                path: `/members/${memberId}`,
              })
            }
          />
        )}
      </Sheet>
      <Sheet title="Bill details" visible={!!detail} onClose={() => setDetail(null)}>
        {detail && (
          <>
            <Text style={s.h2}>{detail.title}</Text>
            <Text style={s.h1}>{money(detail.amount, trip.currency)}</Text>
            <Text style={s.muted}>
              {categoryInfo(detail.category).label} · {prettyDate(detail.date)}
            </Text>
            {detail.currency !== trip.currency && (
              <Text style={s.muted}>
                Original amount {money(detail.originalAmount, detail.currency)} · rate {detail.rate}
              </Text>
            )}
            {detail.attachments?.map((file) => (
              <Btn
                key={file.id}
                title={file.name}
                icon="attach-outline"
                secondary
                onPress={() => openAttachment(trip.id, file).catch((e) => setError(e.message))}
              />
            ))}
            <Text style={s.h3}>Paid by</Text>
            {detail.payers.map((p) => (
              <View style={s.between} key={p.memberId}>
                <Text style={s.body}>{name(p.memberId)}</Text>
                <Text style={s.label}>{money(p.amount, trip.currency)}</Text>
              </View>
            ))}
            <Text style={s.h3}>Each person’s share</Text>
            {detail.shares.map((p) => (
              <View style={s.between} key={p.memberId}>
                <Text style={s.body}>{name(p.memberId)}</Text>
                <Text style={s.label}>{money(p.amount, trip.currency)}</Text>
              </View>
            ))}
            {(detail.createdBy === user.id || trip.isOwner) && (
              <>
                <Btn
                  title="Edit bill"
                  secondary
                  onPress={() => {
                    setDraft(undefined);
                    setExpense(detail);
                    setDetail(null);
                    setForm('expense');
                  }}
                />
                <Btn
                  title="Delete bill"
                  danger
                  onPress={() => {
                    setConfirmation({
                      title: 'Delete bill?',
                      text: `Remove “${detail.title}” and recalculate balances?`,
                      path: `/expenses/${detail.id}`,
                    });
                    setDetail(null);
                  }}
                />
              </>
            )}
          </>
        )}
      </Sheet>
      <Sheet
        title={confirmation?.title || ''}
        visible={!!confirmation}
        onClose={() => setConfirmation(null)}
      >
        <Text style={s.body}>{confirmation?.text}</Text>
        <ErrorBox text={error} />
        <Btn
          title="Confirm deletion"
          danger
          busy={busy}
          onPress={async () => {
            if (!confirmation) return;
            if (confirmation.group) {
              setBusy(true);
              try {
                await mutate(`/trips/${id}`, 'DELETE');
                removeTrip(id);
                setConfirmation(null);
                router.replace('/');
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            } else if (await act(confirmation.path, 'DELETE')) {
              if (confirmation.path.startsWith('/members')) setForm('members');
              setConfirmation(null);
            }
          }}
        />
        <Btn title="Cancel" secondary onPress={() => setConfirmation(null)} />
      </Sheet>
    </Page>
  );
}
