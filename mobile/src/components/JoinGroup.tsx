import React, { useState } from 'react';
import { View } from 'react-native';
import { Text } from './Typography';
import { GroupScanner } from './GroupScanner';
import { api } from '../lib/api';
import { useApp } from '../lib/context';
import { type Trip } from '../lib/types';
import { Btn, Chip, ErrorBox, Field, Sheet, s } from './ui';
export function JoinGroup({
  onClose,
  onJoined,
}: {
  onClose: () => void;
  onJoined: (t: Trip) => void;
}) {
  const { user } = useApp();
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [preview, setPreview] = useState<{
      name: string;
      guests: { id: string; name: string }[];
    } | null>(null),
    [selected, setSelected] = useState('');
  return (
    <>
      <Sheet title="Good company is one code away" visible onClose={onClose}>
        {!preview ? (
          <>
            <Text style={s.body}>Enter the invite code your friend shared with you.</Text>
            <Field
              label="Group invite code"
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              placeholder="e.g. A3F102E7B5C9"
              maxLength={12}
            />
            <Btn title="Scan group QR code" icon="qr-code-outline" secondary onPress={() => setScanning(true)} />
            <ErrorBox text={error} />
            <Btn
              title="Find group"
              busy={busy}
              onPress={async () => {
                setBusy(true);
                setError('');
                try {
                  setPreview(await api('/join/preview', 'POST', { code }));
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            />
          </>
        ) : (
          <>
            <Text style={s.h2}>{preview.name}</Text>
            <Text style={s.body}>
              Are you already on the member list? Choose your own name to keep the expenses and
              balance already recorded for you.
            </Text>
            <View style={s.wrap}>
              {preview.guests.map((m) => (
                <Chip
                  key={m.id}
                  title={m.name}
                  active={selected === m.id}
                  onPress={() => setSelected(m.id)}
                />
              ))}
              <Chip
                title={`Join as ${user?.name} (new member)`}
                active={!selected}
                onPress={() => setSelected('')}
              />
            </View>
            <Text style={s.muted}>
              Only claim your own guest name. Connected accounts cannot be claimed by another user.
            </Text>
            <ErrorBox text={error} />
            <Btn
              title="Join this group"
              busy={busy}
              onPress={async () => {
                setBusy(true);
                setError('');
                try {
                  onJoined(
                    await api<Trip>('/join', 'POST', { code, memberId: selected || undefined }),
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            />
            <Btn
              secondary
              title="Use another code"
              onPress={() => {
                setPreview(null);
                setSelected('');
                setError('');
              }}
            />
          </>
        )}
      </Sheet>
      {scanning && <GroupScanner onClose={() => setScanning(false)} onCode={value => {setCode(value);setScanning(false);}} />}
    </>
  );
}
