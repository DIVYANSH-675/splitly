import React, { useState } from 'react';
import { View } from 'react-native';
import { Text } from './Typography';
import { GroupScanner } from './GroupScanner';
import { api } from '../lib/api';
import { useApp } from '../lib/context';
import { type Trip } from '../lib/types';
import { Btn, ErrorBox, Field, Sheet, s } from './ui';
import { PersonChoice } from './PeoplePicker';
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
      joined: boolean;
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
            <Btn
              title="Scan group QR code"
              icon="qr-code-outline"
              secondary
              onPress={() => setScanning(true)}
            />
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
            {preview.joined ? (
              <Text style={s.body}>You’re already a member of this group. Open it below.</Text>
            ) : (
              <>
                <Text style={s.body}>
                  Are you already on the member list? Choose your own name to keep the expenses and
                  balance already recorded for you.
                </Text>
                <View style={{ gap: 12 }}>
                  {preview.guests.map((m) => (
                    <PersonChoice
                      key={m.id}
                      member={{ ...m, linked: false }}
                      me=""
                      single
                      selected={selected === m.id}
                      onPress={() => setSelected(m.id)}
                    >
                      <Text style={s.muted}>
                        Claim existing · keep this person’s recorded expenses and balance
                      </Text>
                    </PersonChoice>
                  ))}
                  <PersonChoice
                    member={{
                      id: 'new',
                      name: `${user?.name} · new member`,
                      linked: false,
                      photo: user?.photo,
                    }}
                    me=""
                    single
                    selected={!selected}
                    onPress={() => setSelected('')}
                  >
                    <Text style={s.muted}>Join as new · start with a separate balance</Text>
                  </PersonChoice>
                </View>
                <Text style={s.muted}>
                  Claiming updates the name to {user?.name}. Only unclaimed guests can be selected;
                  existing bills keep their original author and editing permissions.
                </Text>
              </>
            )}
            <ErrorBox text={error} />
            <Btn
              title={
                preview.joined
                  ? 'Open group'
                  : selected
                    ? 'Claim name & join'
                    : 'Join as new member'
              }
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
      {scanning && (
        <GroupScanner
          onClose={() => setScanning(false)}
          onCode={(value) => {
            setCode(value);
            setScanning(false);
          }}
        />
      )}
    </>
  );
}
