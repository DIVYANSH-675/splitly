import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useApp } from '../lib/context';
import { Btn, C, s } from './ui';
import { Text } from './Typography';
export function LocalNotice() {
  const { mode, resetDemo, signOut, manageAge } = useApp();
  if (mode === 'online') return null;
  return <SafeAreaView edges={['top']} style={{ backgroundColor: C.pale }}><View style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
    <Text style={[s.label, { color: C.forest }]}>{mode === 'demo' ? 'DEMO · SAMPLE DATA' : 'ON THIS DEVICE · PRIVATE'}</Text>
    <Text style={{ fontSize: 11, color: C.muted }}>{mode === 'demo' ? 'Sample data only. Changes clear on exit; invitations and uploads are simulated locally.' : 'No account, Internet sharing or uploads. Keep app data to keep your ledger.'}</Text>
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {mode === 'demo' ? <><Btn small secondary title="Reset demo" onPress={() => { resetDemo(); router.replace('/'); }} /><Btn small secondary title="Exit demo" onPress={async () => { await signOut(); router.replace('/'); }} /></> : <Btn small secondary title="Parent settings" onPress={manageAge} />}
    </View>
  </View></SafeAreaView>;
}
