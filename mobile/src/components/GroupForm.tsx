import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './Typography';
import { router } from 'expo-router';
import { api } from '../lib/api';
import { useApp } from '../lib/context';
import { currencies, type Trip } from '../lib/types';
import { Btn, Chip, ErrorBox, Field, Sheet, s } from './ui';
export function GroupForm({ onClose, trip }: { onClose: () => void; trip?: Trip }) {
  const { updateTrip } = useApp();
  const [name, setName] = useState(trip?.name || ''),
    [currency, setCurrency] = useState(trip?.currency || 'INR'),
    [showCurrency, setShowCurrency] = useState(false),
    [guests, setGuests] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await api<Trip>(trip ? `/trips/${trip.id}` : '/trips', trip ? 'PATCH' : 'POST', {
        name,
        currency,
        guests: guests
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      updateTrip(data);
      onClose();
      if (!trip) router.push({ pathname: '/group/[id]', params: { id: data.id } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet visible title={trip ? 'Group name' : 'New group'} onClose={onClose}>
      <Field
        label="Group name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Flatmates"
        maxLength={80}
      />
      {!trip && (
        <>
          <Field
            label="Friends (optional)"
            value={guests}
            onChangeText={setGuests}
            placeholder="Aarav, Priya, Rohan"
          />
          <Text style={s.muted}>Separate names with commas. You can add more people later.</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change group currency"
            onPress={() => setShowCurrency((v) => !v)}
          >
            <Text style={s.link}>Currency: {currency} · Change</Text>
          </Pressable>
          {showCurrency && (
            <View style={s.wrap}>
              {Object.keys(currencies).map((c) => (
                <Chip
                  key={c}
                  title={c}
                  active={c === currency}
                  onPress={() => {
                    setCurrency(c);
                    setShowCurrency(false);
                  }}
                />
              ))}
            </View>
          )}
        </>
      )}
      <ErrorBox text={error} />
      <Btn title={trip ? 'Save changes' : 'Create group'} busy={busy} onPress={submit} />
    </Sheet>
  );
}
