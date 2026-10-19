import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './Typography';
import { Btn, C, ErrorBox, Icon, Sheet, s } from './ui';
import { useApp } from '../lib/context';
import { categoryInfo } from '../lib/categories';
import type { PendingBill, Trip } from '../lib/types';
export function SyncStatus() {
  const { online, pending, syncing, actions, retryActions, retryPending, setError, removeAction } = useApp();
  if (online && !pending.length && !actions.length) return null;
  return (
    <View style={{ backgroundColor: C.pale, borderRadius: 17, padding: 14, gap: 9 }}>
      <View style={s.row}>
        <Icon name="cloud-offline-outline" color={C.accent} size={18} />
        <Text style={{ flex: 1, color: C.accent, fontSize: 11, fontWeight: '600' }}>
          {!online
            ? 'You’re offline. Your changes are saved on this device.'
            : `${pending.length + actions.length} change${pending.length + actions.length === 1 ? '' : 's'} waiting to sync.`}
        </Text>
      </View>
      {actions.filter(a => a.error).map(a => <View key={a.id} style={{gap:8}}><ErrorBox text={a.error || ''} /><Pressable accessibilityRole="button" onPress={() => removeAction(a.id).catch(e=>setError(e.message))}><Text style={s.link}>Discard failed update</Text></Pressable></View>)}
      {pending.length + actions.length > 0 && (
        <Pressable
          accessibilityRole="button"
          disabled={syncing}
          onPress={() => Promise.all([retryPending(),retryActions()]).catch((e) => setError(e.message))}
        >
          <Text style={s.link}>{syncing ? 'Syncing…' : 'Try syncing now →'}</Text>
        </Pressable>
      )}
    </View>
  );
}
export function PendingBills({
  trip,
  onEdit,
}: {
  trip: Trip;
  onEdit: (bill: PendingBill) => void;
}) {
  const { pending, syncing, removePending, retryPending } = useApp();
  const bills = pending.filter((b) => b.tripId === trip.id);
  const [removeId, setRemoveId] = useState(''),
    [error, setError] = useState('');
  if (!bills.length) return null;
  return (
    <>
      <Text style={s.eyebrow}>SAVED ON THIS DEVICE</Text>
      <Text style={s.muted}>Not included in confirmed balances or exports until synced.</Text>
      {bills.map((bill) => (
        <View key={bill.id} style={[s.card, { backgroundColor: C.pale, gap: 12 }]}>
          <View style={s.between}>
            <Text style={{ flex: 1, color: C.dark, fontSize: 13, fontWeight: '700' }}>
              {bill.body.title}
            </Text>
            <Text style={{ color: C.accent, fontWeight: '800' }}>
              {bill.body.currency} {bill.body.amount}
            </Text>
          </View>
          <Text style={s.muted}>
            {categoryInfo(bill.body.category).label} ·{' '}
            {bill.error ? 'Needs attention' : syncing ? 'Syncing…' : 'Waiting to sync'}
          </Text>
          <ErrorBox text={bill.error || ''} />
          <View style={[s.row, { gap: 20 }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Edit offline bill ${bill.body.title}`}
              disabled={syncing}
              onPress={() => onEdit(bill)}
            >
              <Text style={s.link}>Edit</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Retry offline bill ${bill.body.title}`}
              disabled={syncing}
              onPress={() => retryPending(bill.id).catch((e) => setError(e.message))}
            >
              <Text style={s.link}>Retry</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove offline bill ${bill.body.title}`}
              disabled={syncing}
              onPress={() => {
                setError('');
                setRemoveId(bill.id);
              }}
            >
              <Text style={{ ...s.link, color: C.red }}>Remove</Text>
            </Pressable>
          </View>
        </View>
      ))}
      <ErrorBox text={error} />
      <Sheet title="Remove saved bill?" visible={Boolean(removeId)} onClose={() => setRemoveId('')}>
        <Text style={s.body}>
          This removes the bill waiting on this device. A bill already accepted by the server must
          be removed from the shared bills list.
        </Text>
        <ErrorBox text={error} />
        <Btn
          title="Remove saved bill"
          danger
          onPress={async () => {
            try {
              await removePending(removeId);
              setRemoveId('');
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
        <Btn title="Keep bill" secondary onPress={() => setRemoveId('')} />
      </Sheet>
    </>
  );
}
