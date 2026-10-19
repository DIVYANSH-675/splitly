import React, { useState } from 'react';
import { View } from 'react-native';
import { Text } from './Typography';
import { useApp } from '../lib/context';
import { inputMoney, localDate, type Transfer, type Trip } from '../lib/types';
import { Btn, Chip, ErrorBox, Field, Sheet, s } from './ui';
export function TransferForm({
  trip,
  initial,
  transfer,
  onClose,
  onSaved,
}: {
  trip: Trip;
  transfer?: Transfer;
  initial?: { from: string; to: string; amount: number };
  onClose: () => void;
  onSaved: (t: Trip) => void;
}) {
  const {mutate} = useApp();
  const [from, setFrom] = useState(transfer?.from || initial?.from || trip.me),
    [to, setTo] = useState(
      transfer?.to || initial?.to || trip.members.find((m) => m.id !== trip.me)?.id || '',
    ),
    [amount, setAmount] = useState(
      transfer
        ? inputMoney(transfer.amount, trip.currency)
        : initial
          ? inputMoney(initial.amount, trip.currency)
          : '',
    ),
    [note, setNote] = useState(transfer?.note || ''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Sheet
      visible
      title={transfer ? 'Edit transfer' : initial ? 'Record a settlement' : 'Add a transfer'}
      onClose={onClose}
    >
      <Text style={s.body}>
        Record money already sent between two people. It updates balances without adding to trip
        expenses.
      </Text>
      <Text style={s.label}>From</Text>
      <View style={s.wrap}>
        {trip.members.map((m) => (
          <Chip key={m.id} title={m.name} active={from === m.id} onPress={() => setFrom(m.id)} />
        ))}
      </View>
      <Text style={s.label}>To</Text>
      <View style={s.wrap}>
        {trip.members.map((m) => (
          <Chip key={m.id} title={m.name} active={to === m.id} onPress={() => setTo(m.id)} />
        ))}
      </View>
      <Field
        label={`Amount (${trip.currency})`}
        placeholder="0.00"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
      />
      <Field
        label="Note (optional)"
        placeholder="e.g. Advance for the trip"
        value={note}
        onChangeText={setNote}
        maxLength={500}
      />
      <ErrorBox text={error} />
      <Btn
        title={initial && !transfer ? 'Confirm payment was made' : 'Save transfer'}
        busy={busy}
        onPress={async () => {
          setError('');
          if (from === to) {
            setError('Choose two different people for the transfer.');
            return;
          }
          setBusy(true);
          try {
            onSaved(
              await mutate(
                `/trips/${trip.id}/transfers${transfer ? `/${transfer.id}` : ''}`,
                transfer ? 'PATCH' : 'POST',
                {
                  from,
                  to,
                  amount,
                  date: transfer?.date || localDate(),
                  note,
                },
              ) as Trip,
            );
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      <Text style={s.muted}>
        Record only payments that actually happened. This app does not send money.
      </Text>
    </Sheet>
  );
}
