import React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './Typography';
import { BillCard } from './FinanceCards';
import { C, Icon, s } from './ui';
import { money, prettyDate, type Expense, type Transfer, type Trip } from '../lib/types';
import { transactionDays } from '../lib/transaction-days.mjs';

export function TransactionList({
  trip,
  userId,
  onBill,
  onTransfer,
  onRemoveTransfer,
}: {
  trip: Trip;
  userId: string;
  onBill: (bill: Expense) => void;
  onTransfer: (transfer: Transfer) => void;
  onRemoveTransfer: (transfer: Transfer) => void;
}) {
  const name = (id: string) => trip.members.find((member) => member.id === id)?.name || 'Member';
  return (
    <>
      {transactionDays(trip.expenses, trip.transfers).map((day) => (
        <View key={day.date || 'undated'} style={{ gap: 13 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 13,
              paddingTop: 7,
              paddingBottom: 1,
            }}
          >
            <Text
              accessibilityRole="header"
              style={[s.eyebrow, { color: C.accent, letterSpacing: 1 }]}
            >
              {day.date ? prettyDate(day.date) : 'Date not set'}
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: C.line }} />
          </View>
          {day.entries.map((item) =>
            item.kind === 'bill' ? (
              <BillCard
                key={`bill:${item.entry.id}`}
                expense={item.entry}
                trip={trip}
                onPress={() => onBill(item.entry)}
              />
            ) : (
              <View key={`transfer:${item.entry.id}`} style={[s.card, { gap: 9 }]}>
                <Text style={{ fontSize: 9, fontWeight: '700', color: C.muted, letterSpacing: 1 }}>
                  TRANSFER · NOT AN EXPENSE
                </Text>
                <View style={s.between}>
                  <Text style={{ fontSize: 12, color: C.dark, fontWeight: '700', flex: 1 }}>
                    {name(item.entry.from)} → {name(item.entry.to)}
                  </Text>
                  <Text style={{ fontSize: 13, color: C.accent, fontWeight: '700' }}>
                    {money(item.entry.amount, trip.currency)}
                  </Text>
                </View>
                <View style={s.between}>
                  <View style={{ flex: 1, gap: 5 }}>
                    {Boolean(item.entry.note) && <Text style={s.muted}>{item.entry.note}</Text>}
                  </View>
                  {(item.entry.createdBy === userId || trip.isOwner) && (
                    <View style={{ flexDirection: 'row', gap: 18, paddingLeft: 10 }}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Edit transfer"
                        onPress={() => onTransfer(item.entry)}
                      >
                        <Icon name="create-outline" color={C.accent} size={18} />
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Remove payment record"
                        onPress={() => onRemoveTransfer(item.entry)}
                      >
                        <Icon name="trash-outline" color={C.muted} size={17} />
                      </Pressable>
                    </View>
                  )}
                </View>
              </View>
            ),
          )}
        </View>
      ))}
    </>
  );
}
