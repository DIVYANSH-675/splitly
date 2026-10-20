import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../lib/context';
import { beginGoogle } from '../lib/google';
import { Btn, C, ErrorBox, s } from './ui';
import { Text } from './Typography';
export function GoogleSignIn({link=false, disabled=false}:{link?:boolean;disabled?:boolean}) {
  const {user,completeGoogle} = useApp();
  const [busy,setBusy] = useState(false), [error,setError] = useState('');
  if (link && user?.googleEmail) return <View style={[s.card,{padding:22,gap:9}]}>
    <Text style={s.h3}>Google sign-in</Text>
    <Text style={{color:C.accent,fontWeight:'700',fontSize:12}}>✓ Connected · {user.googleEmail}</Text>
    <Text style={s.muted}>Use this Google account to open your groups on another device.</Text>
  </View>;
  return <View style={link ? [s.card,{padding:22,gap:14}] : {gap:10}}>
    {link && <><Text style={s.h3}>Google sign-in</Text><Text style={s.muted}>Connect Google to restore this same account, including all your groups and balances.</Text></>}
    <Btn title={link ? 'Connect Google' : 'Continue with Google'} secondary icon="logo-google" busy={busy || disabled} onPress={async()=>{
      setBusy(true);setError('');
      try {
        const result = await beginGoogle(link);
        if (result) {await completeGoogle(result);router.replace(link ? '/profile' : '/');}
      } catch(e) {setError((e as Error).message);} finally {setBusy(false);}
    }}/>
    <ErrorBox text={error}/>
  </View>;
}
