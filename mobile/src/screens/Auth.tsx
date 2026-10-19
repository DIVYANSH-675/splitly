import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Text } from '../components/Typography';
import { useApp } from '../lib/context';
import { api, baseUrl, setApiUrl } from '../lib/api';
import { Btn, C, Enter, ErrorBox, Field, Icon, Logo, Page, Sheet, s } from '../components/ui';
import { PaperArt } from '../components/FinanceCards';
export default function Auth() {
  const { recoverEmail, startGuest } = useApp();
  const [account, setAccount] = useState(false),
    [name, setName] = useState(''),
    [username, setUsername] = useState(''),
    [email, setEmail] = useState(''),
    [code, setCode] = useState(''),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [config, setConfig] = useState(false),
    [url, setUrl] = useState(baseUrl);
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      if (account) {
        if (sent) await recoverEmail(email, code);
        else {
          await api('/email-login/start', 'POST', { email });
          setSent(true);
        }
      } else await startGuest(name, username);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 26, gap: 27, flexGrow: 1 }}
        >
          <Logo />
          <Enter>
            <View
              style={{
                backgroundColor: C.forest,
                borderRadius: 29,
                minHeight: 204,
                padding: 24,
                overflow: 'hidden',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  position: 'absolute',
                  width: 180,
                  height: 180,
                  right: -35,
                  bottom: -58,
                  backgroundColor: '#2D5339',
                  borderRadius: 100,
                }}
              />
              <View style={{ gap: 13, width: '62%', zIndex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name="sparkles-outline" color={C.lime} size={13} />
                  <Text
                    style={{ fontSize: 9, fontWeight: '700', color: C.lime, letterSpacing: 1.7 }}
                  >
                    BETTER TOGETHER
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 27,
                    lineHeight: 35,
                    fontWeight: '800',
                    color: '#F7FAEF',
                    letterSpacing: -1,
                  }}
                >
                  Keep the{`\n`}good company.
                </Text>
              </View>
              <View
                style={{ position: 'absolute', right: -8, top: 26, transform: [{ scale: 0.9 }] }}
              >
                <PaperArt />
              </View>
            </View>
          </Enter>
          <View style={{ gap: 9 }}>
            <Text style={[s.h1, { fontSize: 32, lineHeight: 41 }]}>
              {account ? 'Good to have\nyou back.' : 'Shared bills.\nLighter living.'}
            </Text>
            <Text style={s.muted}>
              {account
                ? 'Use the backup email you verified in Settings.'
                : 'Your name and a unique username. That’s all.'}
            </Text>
          </View>
          {!account ? (
            <>
              <Field
                label="Your name"
                value={name}
                onChangeText={setName}
                placeholder="What should we call you?"
                autoComplete="name"
                maxLength={60}
                onSubmitEditing={submit}
              />
              <Field
                label="Unique username"
                value={username}
                onChangeText={setUsername}
                placeholder="e.g. aarav_27"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={24}
              />
            </>
          ) : (
            <>
              <Field
                label="Email address"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              {sent && (
                <>
                  <Text style={s.muted}>
                    If this is your verified backup email, a code is on its way. Check your inbox.
                  </Text>
                  <Field
                    label="Email code"
                    value={code}
                    onChangeText={setCode}
                    placeholder="Verification code"
                    keyboardType="number-pad"
                    autoComplete="one-time-code"
                    maxLength={8}
                    onSubmitEditing={submit}
                  />
                </>
              )}
            </>
          )}
          <ErrorBox text={error} />
          <Btn
            title={account ? (sent ? 'Verify code & sign in' : 'Send sign-in code') : 'Get started'}
            icon="arrow-forward"
            onPress={submit}
            busy={busy}
          />
          <View style={{ alignItems: 'center', gap: 16 }}>
            <Text style={{ fontSize: 10, color: C.muted }}>
              {account
                ? 'Welcome to your little corner of SplitBill.'
                : 'No email. No password. Just your people.'}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setAccount((v) => !v);
                setSent(false);
                setCode('');
                setError('');
              }}
            >
              <Text style={s.link}>
                {account ? 'Start with just your name' : 'Sign in with backup email'}
              </Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setError('');
              setConfig(true);
            }}
            style={{ alignSelf: 'center', paddingVertical: 10 }}
          >
            <Text style={{ fontSize: 10, color: '#8B9584' }}>Connection settings</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
      <Sheet title="Connection settings" visible={config} onClose={() => setConfig(false)}>
        <Text style={s.muted}>
          For local testing, use your computer’s Wi-Fi address. Your phone and computer need to be
          on the same network.
        </Text>
        <Field
          label="Server URL"
          value={url}
          onChangeText={setUrl}
          placeholder="http://192.168.1.5:4310"
          autoCapitalize="none"
        />
        <ErrorBox text={error} />
        <Btn
          title="Save connection"
          busy={busy}
          onPress={async () => {
            setBusy(true);
            setError('');
            try {
              await setApiUrl(url);
              setConfig(false);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </Sheet>
    </Page>
  );
}
