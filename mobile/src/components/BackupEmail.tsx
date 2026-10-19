import React, { useState } from 'react';
import { View } from 'react-native';
import { Text } from './Typography';
import { Btn, C, ErrorBox, Field, Icon, s } from './ui';
import { api } from '../lib/api';
import { useApp } from '../lib/context';
import type { User } from '../lib/types';
export function BackupEmail() {
  const { user, setUser } = useApp();
  const [email, setEmail] = useState(user?.backupEmail || ''),
    [code, setCode] = useState(''),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const verified = Boolean(user?.backupEmail && email.trim().toLowerCase() === user.backupEmail);
  return (
    <View style={[s.card, { gap: 18, padding: 22 }]}>
      <View style={s.row}>
        <Icon name="mail-outline" color={C.accent} size={21} />
        <Text style={s.h3}>Backup email</Text>
      </View>
      <Text style={s.muted}>
        Forgot your username or changed phones? Sign in with a code sent to your verified backup
        email.
      </Text>
      <Field
        label="Backup email address"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setSent(false);
          setError('');
        }}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
      />
      {verified && (
        <Text style={{ color: C.accent, fontWeight: '700', fontSize: 12 }}>
          ✓ Verified · ready for account recovery
        </Text>
      )}
      {sent && !verified && (
        <>
          <Text style={s.muted}>Check your inbox. Enter the code within 10 minutes.</Text>
          <Field
            label="Email code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={8}
            placeholder="Verification code"
          />
        </>
      )}
      <ErrorBox text={error} />
      {!verified && (
        <Btn
          title={sent ? 'Verify backup email' : 'Send verification code'}
          busy={busy}
          onPress={async () => {
            setBusy(true);
            setError('');
            try {
              if (sent) {
                setUser(await api<User>('/backup-email/verify', 'POST', { email, code }));
                setSent(false);
                setCode('');
              } else {
                await api('/backup-email/start', 'POST', { email });
                setSent(true);
              }
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
      {sent && !verified && (
        <Btn
          title="Send a new code"
          secondary
          busy={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await api('/backup-email/start', 'POST', { email });
              setCode('');
              setError('');
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </View>
  );
}
