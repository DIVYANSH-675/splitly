import React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './Typography';
import { categoryInfo } from '../lib/categories';
import { C, FacePile, Icon, s } from './ui';
import { money, prettyDate, type Expense, type Trip } from '../lib/types';
export function BalanceCard({
  balance,
  currency,
  total,
  paid,
  share,
  compact = false,
}: {
  balance: number;
  currency: string;
  total: number;
  paid: number;
  share: number;
  compact?: boolean;
}) {
  return (
    <View
      style={{
        backgroundColor: C.forest,
        borderRadius: 28,
        padding: compact ? 18 : 23,
        overflow: 'hidden',
      }}
    >
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          position: 'absolute',
          right: -42,
          top: -48,
          width: 175,
          height: 175,
          borderRadius: 100,
          borderWidth: 30,
          borderColor: '#264D37',
          transform: [{ rotate: '-25deg' }],
        }}
      />
      <View style={s.between}>
        <Text style={{ color: '#C1D4B7', fontSize: 10, fontWeight: '700', letterSpacing: 1.6 }}>
          {balance > 0
            ? 'COMING BACK TO YOU'
            : balance < 0
              ? 'YOUR PART TO SETTLE'
              : 'ALL SQUARE. ALL GOOD.'}
        </Text>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 12,
            backgroundColor: '#355A3D',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={balance ? 'swap-horizontal' : 'checkmark'} color={C.lime} size={18} />
        </View>
      </View>
      <Text
        adjustsFontSizeToFit
        numberOfLines={1}
        minimumFontScale={0.65}
        style={{
          fontSize: compact ? 35 : 44,
          fontWeight: '800',
          color: '#F7FAEE',
          letterSpacing: -1.8,
          marginTop: 10,
          marginBottom: 3,
          fontVariant: ['tabular-nums'],
        }}
      >
        {money(Math.abs(balance), currency)}
      </Text>
      {!compact && (
        <>
          <Text style={{ color: '#B3C9AE', fontSize: 11 }}>
            {balance > 0
              ? 'Good memories. Even better when you’re settled.'
              : balance < 0
                ? 'A little settling up, then back to the good stuff.'
                : 'Nothing to pay back. Enjoy the company.'}
          </Text>
        </>
      )}
      <View
        style={{
          height: 1,
          backgroundColor: '#3B5B44',
          marginTop: compact ? 16 : 22,
          marginBottom: compact ? 13 : 18,
        }}
      />
      <View style={{ flexDirection: 'row' }}>
        {[
          { label: 'Group total', value: total },
          { label: 'You paid', value: paid },
          { label: 'Your share', value: share },
        ].map((item, i) => (
          <View
            key={item.label}
            style={{
              flex: 1,
              gap: 8,
              paddingLeft: i ? (compact ? 8 : 14) : 0,
              borderLeftWidth: i ? 1 : 0,
              borderLeftColor: '#3B5B44',
            }}
          >
            <Text style={{ fontSize: 10, color: '#B3C9AE' }}>{item.label}</Text>
            <Text
              adjustsFontSizeToFit
              numberOfLines={1}
              minimumFontScale={0.7}
              style={{
                fontSize: compact ? 12 : 14,
                fontWeight: '700',
                color: '#F3F8E7',
                fontVariant: ['tabular-nums'],
              }}
            >
              {money(item.value, currency)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
export function groupVisual(name: string) {
  const themes = [
    { icon: 'sunny-outline', color: '#6B7444', bg: '#EDF0D1' },
    { icon: 'home-outline', color: '#A2795F', bg: '#F5EADD' },
    { icon: 'cafe-outline', color: '#876D9A', bg: '#EFE9F4' },
    { icon: 'people-outline', color: '#547D85', bg: '#E3EFF0' },
  ];
  let hash = 0;
  for (const c of name) hash += c.charCodeAt(0);
  return themes[hash % themes.length];
}
export function GroupCard({ trip, onPress }: { trip: Trip; onPress: () => void }) {
  const theme = groupVisual(trip.name);
  const balance = trip.balances.find((b) => b.id === trip.me)?.balance || 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${trip.name}`}
      onPress={onPress}
      style={({ pressed }) => [
        s.card,
        {
          padding: 20,
          gap: 19,
          transform: [{ scale: pressed ? 0.985 : 1 }],
          shadowColor: '#243B24',
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.025,
          shadowRadius: 10,
        },
      ]}
    >
      <View style={s.row}>
        <View
          style={{
            width: 53,
            height: 53,
            backgroundColor: theme.bg,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 19,
          }}
        >
          <Icon name={theme.icon} color={theme.color} size={26} />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text
            numberOfLines={1}
            style={{ fontSize: 17, fontWeight: '800', color: C.dark, letterSpacing: -0.5 }}
          >
            {trip.name}
          </Text>
          <Text style={s.muted}>
            {trip.members.length} people · {trip.expenses.length} shared bills
          </Text>
        </View>
        <Icon name="arrow-forward" size={19} color={C.muted} />
      </View>
      <View style={{ height: 1, backgroundColor: '#EFF1E9' }} />
      <View style={s.between}>
        <FacePile members={trip.members} />
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={{ fontSize: 10, color: C.muted }}>
            {balance ? (balance > 0 ? 'YOU GET BACK' : 'YOU OWE') : 'ALL SETTLED'}
          </Text>
          <Text
            style={{
              fontSize: 18,
              fontWeight: '800',
              color: balance < 0 ? C.red : C.accent,
              letterSpacing: -0.6,
            }}
          >
            {money(Math.abs(balance), trip.currency)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
export function BillCard({
  expense,
  trip,
  onPress,
}: {
  expense: Expense;
  trip: Trip;
  onPress: () => void;
}) {
  const name = (id: string) => trip.members.find((m) => m.id === id)?.name || 'Member';
  const visual = categoryInfo(expense.category);
  const share = expense.shares.find((v) => v.memberId === trip.me)?.amount || 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Bill ${expense.title}`}
      onPress={onPress}
      style={({ pressed }) => [
        s.card,
        {
          flexDirection: 'row',
          alignItems: 'center',
          padding: 16,
          borderRadius: 21,
          gap: 13,
          backgroundColor: pressed ? '#EFF3E6' : '#fff',
        },
      ]}
    >
      <View
        style={{
          width: 46,
          height: 49,
          borderRadius: 16,
          backgroundColor: visual.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={visual.icon} color={visual.color} size={23} />
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <Text
          numberOfLines={2}
          style={{ fontSize: 14, fontWeight: '800', color: C.dark, letterSpacing: -0.2 }}
        >
          {expense.title}
        </Text>
        <Text numberOfLines={1} style={{ color: visual.color, fontSize: 9, fontWeight: '600' }}>
          {visual.label}
        </Text>
        <Text numberOfLines={1} style={{ color: C.muted, fontSize: 10 }}>
          {expense.payers
            .map((p) =>
              name(p.memberId)
                .replace(/\([^)]*\)/g, '')
                .trim(),
            )
            .join(', ')}{' '}
          paid · {prettyDate(expense.date).replace(/ \d{4}$/, '')}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 7 }}>
        <Text
          style={{
            fontSize: 15,
            fontWeight: '800',
            color: C.dark,
            fontVariant: ['tabular-nums'],
            letterSpacing: -0.5,
          }}
        >
          {money(expense.amount, trip.currency)}
        </Text>
        <Text style={{ fontSize: 9, color: C.muted }}>
          Your share{' '}
          <Text style={{ fontSize: 10, fontWeight: '700', color: C.accent }}>
            {money(share, trip.currency)}
          </Text>
        </Text>
      </View>
    </Pressable>
  );
}
export function PaperArt() {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ height: 168, width: 160 }}
    >
      <View
        style={{
          position: 'absolute',
          width: 103,
          height: 126,
          left: 32,
          top: 24,
          borderRadius: 17,
          backgroundColor: '#BCD486',
          transform: [{ rotate: '16deg' }],
        }}
      />
      <View
        style={{
          width: 105,
          height: 137,
          backgroundColor: '#FDFFF5',
          borderRadius: 16,
          padding: 16,
          top: 6,
          left: 13,
          transform: [{ rotate: '-11deg' }],
          shadowColor: '#1E3C21',
          shadowOpacity: 0.12,
          shadowOffset: { width: 0, height: 8 },
          shadowRadius: 15,
        }}
      >
        <Icon name="receipt-outline" color={C.accent} size={26} />
        <View
          style={{
            height: 4,
            width: 46,
            borderRadius: 3,
            backgroundColor: '#DCE5CE',
            marginTop: 13,
          }}
        />
        <View
          style={{
            height: 4,
            width: 60,
            borderRadius: 3,
            backgroundColor: '#E6ECD8',
            marginTop: 8,
          }}
        />
        <View
          style={{
            borderTopWidth: 1,
            borderStyle: 'dashed',
            borderColor: '#CCD8B8',
            marginTop: 13,
            paddingTop: 8,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '800', color: C.accent }}>fair shares.</Text>
        </View>
      </View>
      <View
        style={{
          position: 'absolute',
          bottom: 4,
          right: 3,
          backgroundColor: '#E7F8B9',
          width: 48,
          height: 48,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ rotate: '13deg' }],
        }}
      >
        <Icon name="checkmark" color={C.accent} size={27} />
      </View>
    </View>
  );
}
