import React, {useEffect,useRef,useState} from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '../../lib/context';
import { resumeGoogle } from '../../lib/google';
import { Btn,C,ErrorBox,Logo,Page,s } from '../../components/ui';
import { Text } from '../../components/Typography';
export default function GoogleCallback() {
  const {ready,completeGoogle,user} = useApp();
  const params = useLocalSearchParams<{code?:string;state?:string;error?:string;error_description?:string}>();
  const query = new URLSearchParams();
  for (const key of ['code', 'state', 'error', 'error_description'] as const) {
    const value = params[key];
    if (typeof value === 'string') query.set(key, value);
  }
  const callback = Platform.OS === 'web' ? undefined : `splitly://auth/google?${query}`;
  const started=useRef(false);
  const [error,setError]=useState('');
  useEffect(()=>{
    if (!ready || started.current) return;
    started.current=true;
    (async()=>{
      try {
        const result=await resumeGoogle(callback);
        if (!result) {router.replace('/');return;}
        await completeGoogle(result);
        router.replace(result.link ? '/profile' : '/');
      } catch(e) {
        // A repeated return must not strand an already authenticated account.
        if (user) router.replace('/');
        else setError((e as Error).message);
      }
    })();
  },[ready,completeGoogle,callback,user]);
  return <Page><View style={{padding:26,gap:24}}><Logo/>
    <Text style={s.h2}>Returning to SplitBill</Text>
    {error ? <><ErrorBox text={error}/><Btn title="Back to SplitBill" onPress={()=>router.replace('/')}/></> : <><ActivityIndicator color={C.forest}/><Text style={s.muted}>Finishing your secure sign-in…</Text><Btn title="Try again" secondary onPress={()=>router.replace('/')}/></>}
  </View></Page>;
}
