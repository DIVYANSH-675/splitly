import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './Typography';
import { C, Icon, s } from './ui';
import { categoryInfo } from '../lib/categories';
import { money, type Trip } from '../lib/types';
export function Analytics({ trip }: { trip: Trip }) {
  const [open, setOpen] = useState(false);
  const totals: Record<string, number> = {};
  for (const expense of trip.expenses)
    totals[expense.category] = (totals[expense.category] || 0) + expense.amount;
  const rows = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  return (
    <View style={[s.card, { padding: 18, gap: 18 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Graphs and analytics"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={s.between}
      >
        <View style={s.row}>
          <Icon name="bar-chart-outline" color={C.accent} size={19} />
          <Text style={{ fontWeight: '700', color: C.dark }}>Where it went</Text>
        </View>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} color={C.muted} />
      </Pressable>
      {open && (
        <>
          <Text style={s.muted}>Confirmed expenses by category. Transfers are excluded.</Text>
          {!rows.length && <Text style={s.body}>Your first bill starts the story.</Text>}
          {rows.map(([category, amount]) => {
            const info = categoryInfo(category);
            return (
              <View key={category} style={{ gap: 9 }}>
                <View style={s.between}>
                  <Text style={{ color: C.dark, fontSize: 12 }}>{info.label}</Text>
                  <Text style={{ color: C.accent, fontWeight: '700', fontSize: 12 }}>
                    {money(amount, trip.currency)} · {Math.round((amount / trip.total) * 100)}%
                  </Text>
                </View>
                <View
                  style={{
                    height: 9,
                    borderRadius: 5,
                    backgroundColor: C.pale,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      height: 9,
                      borderRadius: 5,
                      width: `${(amount / trip.total) * 100}%`,
                      backgroundColor: info.color,
                    }}
                  />
                </View>
              </View>
            );
          })}
          <Text style={[s.label, { marginTop: 8 }]}>Each person’s share</Text>
          {trip.balances.map((member) => (
            <View key={member.id} style={s.between}>
              <Text style={s.muted}>{member.name}</Text>
              <Text style={s.label}>{money(member.spent, trip.currency)}</Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}
