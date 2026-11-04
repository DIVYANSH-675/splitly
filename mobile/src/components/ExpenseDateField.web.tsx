import React from 'react';
import { View } from 'react-native';
import { Text } from './Typography';
import { C, s } from './ui';

export function ExpenseDateField({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  return <View style={{gap:8}}>
    <Text style={s.label}>Expense date</Text>
    <input type="date" aria-label="Expense date" value={value}
      onInput={event => onChange(event.currentTarget.value)} onChange={event => onChange(event.target.value)}
      style={{boxSizing:'border-box', width:'100%', minWidth:0, minHeight:54, border:`1px solid ${C.line}`, borderRadius:18,
        padding:16, background:C.white, color:C.dark, fontFamily:'ManropeRegular, sans-serif', fontSize:15}}/>
  </View>;
}
