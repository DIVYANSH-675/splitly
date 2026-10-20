import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { allocate, expenseFromInput } from '../lib/finance.mjs';
import { currencies, inputMoney, money, type Trip } from '../lib/types';
import { Text } from './Typography';
import { Btn, C, ErrorBox, Field, Icon, Sheet, s } from './ui';
import { PersonChoice } from './PeoplePicker';

export function BillPeoplePicker({
  trip,
  kind,
  amount,
  currency,
  selected,
  values,
  mode,
  onDone,
  onBack,
}: {
  trip: Trip;
  kind: 'payers' | 'shares';
  amount: number;
  currency: string;
  selected: string[];
  values: Record<string, string>;
  mode: string;
  onDone: (ids: string[], values: Record<string, string>, mode: string) => void;
  onBack: () => void;
}) {
  const paying = kind === 'payers';
  const [ids, setIds] = useState(selected),
    [split, setSplit] = useState(mode),
    [entries, setEntries] = useState(values),
    [error, setError] = useState('');
  const equalValues = (next: string[], method = split) => {
    if (!next.length) return {};
    const total = method === 'percent' ? 10000 : amount;
    const parts = allocate(
      total,
      next.map(() => 1),
    );
    return Object.fromEntries(
      next.map((id, index) => [
        id,
        method === 'shares'
          ? '1'
          : method === 'percent'
            ? String(parts[index] / 100)
            : inputMoney(parts[index], currency),
      ]),
    );
  };
  const equalAmounts = ids.length
    ? allocate(
        amount,
        ids.map(() => 1),
      )
    : [];
  const all = ids.length === trip.members.length;
  const sum = ids.reduce((n, id) => n + Number(entries[id] || 0), 0);
  const scale = 10 ** currencies[currency];
  const target = split === 'percent' ? 100 : amount / scale;
  const exact = paying || split === 'exact';
  const difference =
    split === 'percent'
      ? Math.round((target - sum) * 100) / 100
      : Math.round((target - sum) * scale) / scale;
  const needsTotal = paying ? ids.length > 1 : split === 'exact' || split === 'percent';
  const changeSelection = (next: string[]) => {
    setIds(next);
    setError('');
    if (paying) setEntries(equalValues(next, 'exact'));
  };
  const rowValue = (id: string, index: number) =>
    paying && ids.length === 1
      ? inputMoney(amount, currency)
      : split === 'equal' && !paying
        ? inputMoney(equalAmounts[index] || 0, currency)
        : entries[id] || '';
  const finish = () => {
    if (!ids.length) {
      setError('Choose at least one person.');
      return;
    }
    if (amount > 0 && needsTotal && difference !== 0) {
      setError(
        split === 'percent'
          ? 'Percentages must add up to 100%.'
          : `Amounts must add up to ${money(amount, currency)}.`,
      );
      return;
    }
    if (
      (!paying || ids.length > 1) &&
      (exact || split === 'percent' || split === 'shares') &&
      ids.some(
        (id) => entries[id] && (!Number.isFinite(Number(entries[id])) || Number(entries[id]) < 0),
      )
    ) {
      setError('Enter valid values, zero or greater.');
      return;
    }
    if (split === 'shares' && !paying && !ids.some((id) => Number(entries[id]) > 0)) {
      setError('Enter a share greater than zero.');
      return;
    }
    if (amount > 0) {
      try {
        expenseFromInput(
          {
            amount: inputMoney(amount, currency),
            currency,
            rate: 1,
            mode: paying ? 'equal' : split,
            shares: (paying ? trip.members.map((member) => member.id) : ids).map((memberId) => ({
              memberId,
              value: entries[memberId] || '0',
            })),
            payers: (paying ? ids : [trip.me]).map((memberId) => ({
              memberId,
              amount: entries[memberId] || '0',
            })),
          },
          trip,
        );
      } catch (error) {
        setError((error as Error).message);
        return;
      }
    }
    onDone(ids, entries, paying ? 'equal' : split);
  };
  return (
    <Sheet
      visible
      title={paying ? 'Paid by' : 'Paid for'}
      onClose={onBack}
      onBack={onBack}
      footer={<Btn title="Done" onPress={finish} />}
    >
      {!paying && (
        <View
          style={{
            flexDirection: 'row',
            padding: 4,
            gap: 3,
            borderRadius: 16,
            backgroundColor: C.pale,
          }}
        >
          {[
            { id: 'equal', label: 'Equal' },
            { id: 'exact', label: 'Amount' },
            { id: 'shares', label: 'Shares' },
            { id: 'percent', label: 'Percent' },
          ].map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: split === item.id }}
              accessibilityLabel={`Split by ${item.label}`}
              onPress={() => {
                setSplit(item.id);
                setEntries(equalValues(ids, item.id));
                setError('');
              }}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: split === item.id ? C.white : 'transparent',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  color: split === item.id ? C.accent : C.muted,
                  fontWeight: '700',
                }}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <View style={s.between}>
        <View style={{ gap: 5 }}>
          <Text style={s.h3}>Total · {money(amount, currency)}</Text>
          <Text style={s.muted}>
            {paying ? 'Choose who paid and how much.' : 'Select who shares this bill.'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel="Select everyone"
          accessibilityState={{ checked: all }}
          onPress={() => changeSelection(all ? [] : trip.members.map((member) => member.id))}
          style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name={all ? 'checkbox' : 'square-outline'} color={C.accent} size={25} />
        </Pressable>
      </View>
      {(paying || split !== 'equal') && (
        <Btn
          title={paying ? 'Split payment equally' : 'Reset to equal shares'}
          secondary
          small
          onPress={() => {
            setEntries(equalValues(ids, paying ? 'exact' : split));
            setError('');
          }}
        />
      )}
      {trip.members.map((member) => {
        const index = ids.indexOf(member.id),
          checked = index >= 0;
        const readOnly = (!paying && split === 'equal') || (paying && ids.length === 1);
        return (
          <PersonChoice
            key={member.id}
            member={member}
            me={trip.me}
            selected={checked}
            onPress={() =>
              changeSelection(checked ? ids.filter((id) => id !== member.id) : [...ids, member.id])
            }
          >
            {checked &&
              (readOnly ? (
                <Text style={{ fontSize: 23, fontWeight: '700', color: C.dark }}>
                  {money(paying ? amount : equalAmounts[index] || 0, currency)}
                </Text>
              ) : (
                <Field
                  label={`${member.name}${paying ? ' paid' : split === 'percent' ? ' percent' : split === 'shares' ? ' shares' : ' amount'}`}
                  value={rowValue(member.id, index)}
                  onChangeText={(value) => {
                    setEntries((previous) => ({ ...previous, [member.id]: value }));
                    setError('');
                  }}
                  keyboardType="decimal-pad"
                  placeholder={split === 'shares' ? '1' : '0'}
                />
              ))}
          </PersonChoice>
        );
      })}
      {amount > 0 && needsTotal && (
        <Text
          style={{ color: difference === 0 ? C.accent : C.red, fontSize: 12, fontWeight: '600' }}
        >
          {difference === 0
            ? '✓ Total matches'
            : `${difference > 0 ? 'Remaining' : 'Over by'} · ${split === 'percent' ? `${Math.abs(difference)}%` : money(Math.round(Math.abs(difference) * scale), currency)}`}
        </Text>
      )}
      <ErrorBox text={error} />
    </Sheet>
  );
}
