import React, {useEffect,useRef,useState} from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../lib/context';
import { resumeGoogle } from '../../lib/google';
import { Btn,C,ErrorBox,Logo,Page,s } from '../../components/ui';
import { Text } from '../../components/Typography';
export default function GoogleCallback() {
  const {ready,completeGoogle} = useApp();
  const started=useRef(false);
  const [error,setError]=useState('');
  useEffect(()=>{
    if (!ready || started.current) return;
    started.current=true;
    (async()=>{
      try {
        const result=await resumeGoogle();
        if (!result) {router.replace('/');return;}
        await completeGoogle(result);
        router.replace(result.link ? '/profile' : '/');
      } catch(e) {setError((e as Error).message);}
    })();
  },[ready,completeGoogle]);
  return <Page><View style={{padding:26,gap:24}}><Logo/>
    <Text style={s.h2}>Returning to SplitBill</Text>
    {error ? <><ErrorBox text={error}/><Btn title="Back to SplitBill" onPress={()=>router.replace('/')}/></> : <><ActivityIndicator color={C.forest}/><Text style={s.muted}>Finishing your secure sign-in…</Text><Btn title="Try again" secondary onPress={()=>router.replace('/')}/></>}
  </View></Page>;
}
