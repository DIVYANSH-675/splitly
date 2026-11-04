import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import * as Linking from 'expo-linking';
import { Text } from './Typography';
import { C, ErrorBox } from './ui';

const pages = 'https://divyansh-675.github.io/splitly/store/';

export function SupportLinks() {
  const [error, setError] = useState('');
  const open = async (page: string) => {
    setError('');
    try { await Linking.openURL(pages + page); }
    catch { setError('Could not open this page. Contact developerg675@gmail.com for help.'); }
  };
  return <View style={{ gap: 10 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 20 }}>
      <Pressable accessibilityRole="link" onPress={() => open('privacy.html')} style={{ paddingVertical: 10 }}>
        <Text style={{ color: C.accent, fontSize: 12, textDecorationLine: 'underline' }}>Privacy policy</Text>
      </Pressable>
      <Pressable accessibilityRole="link" onPress={() => open('delete-account.html')} style={{ paddingVertical: 10 }}>
        <Text style={{ color: C.accent, fontSize: 12, textDecorationLine: 'underline' }}>Request account deletion</Text>
      </Pressable>
    </View>
    <ErrorBox text={error} />
  </View>;
}
