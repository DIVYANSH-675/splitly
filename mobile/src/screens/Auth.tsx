import React from 'react';
import { ScrollView, View } from 'react-native';
import { Text } from '../components/Typography';
import { C, Enter, Icon, Logo, Page, s } from '../components/ui';
import { GoogleSignIn } from '../components/GoogleSignIn';
import { version } from '../../package.json';

export default function Auth() {
  return (
    <Page>
      <ScrollView contentContainerStyle={{ padding: 26, gap: 30, flexGrow: 1 }}>
        <Logo />
        <Enter>
          <View style={{ backgroundColor: C.forest, borderRadius: 29, minHeight: 245, padding: 28, justifyContent: 'center', gap: 20 }}>
            <Icon name="people-outline" color={C.lime} size={38} />
            <Text style={{ fontSize: 34, lineHeight: 43, color: '#F7FAEF', fontFamily: 'ManropeBold', letterSpacing: -1 }}>
              Good company.{`\n`}Shared adventures.{`\n`}Simple splits.
            </Text>
          </View>
        </Enter>
        <View style={{ gap: 12 }}>
          <Text style={[s.h1, { fontSize: 30 }]}>Your people. One tap away.</Text>
          <Text style={s.muted}>Sign in with Google to keep your groups and balances with you, even on a new phone.</Text>
        </View>
        <GoogleSignIn />
        <View style={{ gap: 10, alignItems: 'center' }}>
          <Text style={[s.muted, { textAlign: 'center' }]}>Your Google name and photo get you started. Make them your own in Profile.</Text>
          <Text style={{ fontSize: 11, color: C.muted, textAlign: 'center' }}>Already have an account? Choose the same Google account.</Text>
        </View>
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 10, textAlign: 'center', color: C.muted }}>SplitBill {version}</Text>
      </ScrollView>
    </Page>
  );
}
