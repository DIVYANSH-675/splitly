import React, { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Text } from './Typography';
import { C, Icon, s } from './ui';
import { calendarDate, isCalendarDate, pickerDate } from '../lib/expense-date.mjs';
import { prettyDate } from '../lib/types';

export function ExpenseDateField({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = pickerDate(value);
  return <View style={{ gap: 8 }}>
    <Text style={s.label}>Expense date</Text>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Expense date: ${isCalendarDate(value) ? prettyDate(value) : 'Choose date'}`}
      accessibilityHint="Choose the day this expense happened"
      onPress={() => {
        if (Platform.OS === 'android') DateTimePickerAndroid.open({
          value: selected, mode: 'date', display: 'default',
          onValueChange: (_, date) => onChange(calendarDate(date)),
        });
        else setOpen(v => !v);
      }}
      style={[s.between, { borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 16, backgroundColor: C.white }]}
    >
      <View style={s.row}><Icon name="calendar-outline" size={21} color={C.accent}/>
        <Text style={{color:C.dark}}>{isCalendarDate(value) ? prettyDate(value) : 'Choose date'}</Text>
      </View>
      <Icon name="chevron-down" size={16} color={C.muted}/>
    </Pressable>
    {open && <DateTimePicker value={selected} mode="date" display="inline" onValueChange={(_, date) => {
      onChange(calendarDate(date)); setOpen(false);
    }} onDismiss={() => setOpen(false)}/>}
  </View>;
}
