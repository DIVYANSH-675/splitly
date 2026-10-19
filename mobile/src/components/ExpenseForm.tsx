import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './Typography';
import { pickAttachment } from '../lib/attachments';
import { useApp } from '../lib/context';
import { categoryInfo, expenseCategories } from '../lib/categories';
import {
  currencies,
  inputMoney,
  localDate,
  money,
  type Attachment,
  type BillInput,
  type PendingBill,
  type Expense,
  type Trip,
} from '../lib/types';
import { Btn, C, Chip, ErrorBox, Field, Icon, Sheet, s } from './ui';
export function ExpenseForm({
  trip,
  expense,
  draft,
  onClose,
  onSaved,
}: {
  trip: Trip;
  expense?: Expense;
  draft?: PendingBill;
  onClose: () => void;
  onSaved: (t: Trip) => void;
}) {
  const { addBill, mutate } = useApp();
  const [attachments, setAttachments] = useState<Attachment[]>(
    expense?.attachments || draft?.body.attachments || [],
  );
  const [newCategory, setNewCategory] = useState('');
  const currency = expense?.currency || draft?.body.currency || trip.currency;
  const [amount, setAmount] = useState(
      expense ? inputMoney(expense.originalAmount, currency) : draft?.body.amount || '',
    ),
    [title, setTitle] = useState(expense?.title || draft?.body.title || ''),
    [category, setCategory] = useState(expense?.category || draft?.body.category || 'Other'),
    [choosingCategory, setChoosingCategory] = useState(false),
    [mode, setMode] = useState(expense?.mode || draft?.body.mode || 'equal'),
    [custom, setCustom] = useState(
      Boolean(
        (expense && (expense.mode !== 'equal' || expense.payers.length > 1)) ||
          (draft && (draft.body.mode !== 'equal' || draft.body.payers.length > 1)),
      ),
    ),
    [multiple, setMultiple] = useState(
      (expense?.payers.length || draft?.body.payers.length || 0) > 1,
    ),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(
      expense?.shares.map((s) => s.memberId) ||
        draft?.body.shares.map((s) => s.memberId) ||
        trip.members.map((m) => m.id),
    ),
    [payers, setPayers] = useState(
      expense?.payers.map((p) => p.memberId) ||
        draft?.body.payers.map((p) => p.memberId) || [trip.me],
    ),
    [values, setValues] = useState<Record<string, string>>(
      Object.fromEntries(
        expense?.shares.map((s) => [s.memberId, String(s.value)]) ||
          draft?.body.shares.map((s) => [s.memberId, s.value]) ||
          [],
      ),
    ),
    [paid, setPaid] = useState<Record<string, string>>(
      Object.fromEntries(
        expense?.payers.map((p) => [p.memberId, inputMoney(p.originalAmount, currency)]) ||
          draft?.body.payers.map((p) => [p.memberId, p.amount]) ||
          [],
      ),
    );
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const body: BillInput = {
        title,
        attachments,
        amount,
        currency,
        rate: expense?.rate || draft?.body.rate || 1,
        date: expense?.date || draft?.body.date || localDate(),
        category,
        note: expense?.note || draft?.body.note || '',
        mode,
        shares: selected.map((memberId) => ({ memberId, value: values[memberId] || '0' })),
        payers: payers.map((memberId) => ({ memberId, amount: paid[memberId] || '0' })),
      };
      if (expense)
        onSaved((await mutate(`/trips/${trip.id}/expenses/${expense.id}`, 'PATCH', body)) as Trip);
      else await addBill(trip.id, body, draft?.id);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const categoryVisual = categoryInfo(category);
  const numeric = /^\d+(?:\.\d+)?$/.test(amount) ? Number(amount) : 0;
  const totalMinor =
    Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric * 10 ** currencies[currency]) : 0;
  const each =
    selected.length && totalMinor ? money(Math.floor(totalMinor / selected.length), currency) : '';
  return (
    <Sheet visible title={expense || draft ? 'Edit bill' : 'Add a bill'} onClose={onClose}>
      <Field
        label={`Amount (${currency})`}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0.00"
        style={{
          fontSize: 45,
          lineHeight: 60,
          minHeight: 91,
          paddingVertical: 8,
          fontFamily: 'ManropeBold',
          letterSpacing: -1.7,
        }}
      />
      <Field
        label="What was it for?"
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Dinner"
        maxLength={120}
      />
      <View style={{ gap: 10 }}>
        <Text style={s.label}>Category</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Category: ${categoryVisual.label}`}
          accessibilityState={{ expanded: choosingCategory }}
          onPress={() => setChoosingCategory((v) => !v)}
          style={[
            s.between,
            {
              backgroundColor: C.white,
              borderWidth: 1,
              borderColor: C.line,
              borderRadius: 18,
              padding: 14,
            },
          ]}
        >
          <View style={s.row}>
            <Icon name={categoryVisual.icon} color={categoryVisual.color} size={20} />
            <Text style={{ color: C.dark, fontSize: 13, fontWeight: '600' }}>
              {categoryVisual.label}
            </Text>
          </View>
          <Icon name={choosingCategory ? 'chevron-up' : 'chevron-down'} size={16} color={C.muted} />
        </Pressable>
        {choosingCategory && (
          <View style={s.wrap}>
            {[
              ...expenseCategories,
              ...(trip.categories || [])
                .filter((c) => !expenseCategories.some((v) => v.value === c))
                .map((c) => ({ value: c, label: c })),
            ].map((item) => (
              <Chip
                key={item.value}
                title={item.label}
                active={category === item.value}
                onPress={() => {
                  setCategory(item.value);
                  setChoosingCategory(false);
                }}
              />
            ))}
          </View>
        )}
        {choosingCategory && (
          <View style={{ gap: 10 }}>
            <Field
              label="New group category"
              value={newCategory}
              onChangeText={setNewCategory}
              placeholder="e.g. Camping"
              maxLength={40}
            />
            <Btn
              title="Add group category"
              secondary
              onPress={async () => {
                if (!newCategory.trim()) return;
                try {
                  await mutate(`/trips/${trip.id}/categories`, 'POST', {
                    name: newCategory.trim(),
                  });
                  setCategory(newCategory.trim());
                  setChoosingCategory(false);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            />
            <Text style={s.muted}>Available to everyone in this group after syncing.</Text>
          </View>
        )}
      </View>
      <View style={{ gap: 12 }}>
        <Text style={s.label}>Attachments · optional</Text>
        {attachments.map((file) => (
          <View key={file.id} style={s.between}>
            <Text style={[s.muted, { flex: 1 }]} numberOfLines={1}>
              {file.name}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${file.name}`}
              onPress={() => setAttachments((prev) => prev.filter((a) => a.id !== file.id))}
            >
              <Text style={{ color: C.red }}>Remove</Text>
            </Pressable>
          </View>
        ))}
        {attachments.length < 3 && (
          <Btn
            title="Attach receipt or file"
            icon="attach-outline"
            secondary
            onPress={async () => {
              try {
                const file = await pickAttachment();
                if (file) setAttachments((prev) => [...prev, file].slice(0, 3));
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          />
        )}
        <Text style={s.muted}>
          JPG, PNG, WebP or PDF · up to 2 MB each. Saved on your device until synced.
        </Text>
      </View>
      <Text style={s.label}>Who paid?</Text>
      <View style={s.wrap}>
        {trip.members.map((m) => (
          <Chip
            key={m.id}
            title={m.name}
            active={payers.includes(m.id)}
            onPress={() =>
              setPayers((prev) =>
                multiple
                  ? prev.includes(m.id)
                    ? prev.filter((id) => id !== m.id)
                    : [...prev, m.id]
                  : [m.id],
              )
            }
          />
        ))}
      </View>
      {multiple &&
        payers.map((id) => (
          <Field
            key={id}
            label={`${trip.members.find((m) => m.id === id)?.name} paid (${currency})`}
            value={paid[id] || ''}
            onChangeText={(v) => setPaid((prev) => ({ ...prev, [id]: v }))}
            keyboardType="decimal-pad"
            placeholder="0.00"
          />
        ))}
      <View style={{ backgroundColor: C.pale, padding: 17, borderRadius: 19, gap: 13 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ backgroundColor: '#DCE6CB', padding: 9, borderRadius: 12 }}>
            <Icon name="people-outline" color={C.accent} size={18} />
          </View>
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: C.accent }}>
              {mode === 'equal'
                ? `Split equally · ${selected.length} people`
                : 'Custom split selected'}
            </Text>
            {mode === 'equal' && Boolean(each) && (
              <Text style={{ fontSize: 11, color: C.muted }}>
                {totalMinor % selected.length ? 'About ' : ''}
                {each} each
              </Text>
            )}
          </View>
        </View>
        <Pressable accessibilityRole="button" onPress={() => setCustom((v) => !v)}>
          <Text style={s.link}>{custom ? 'Hide split options ↑' : 'Split differently →'}</Text>
        </Pressable>
      </View>
      {custom && (
        <>
          <Text style={s.label}>Split between</Text>
          <View style={s.wrap}>
            {trip.members.map((m) => (
              <Chip
                key={m.id}
                title={`${selected.includes(m.id) ? '✓ ' : ''}${m.name}`}
                active={selected.includes(m.id)}
                onPress={() =>
                  setSelected((prev) =>
                    prev.includes(m.id) ? prev.filter((id) => id !== m.id) : [...prev, m.id],
                  )
                }
              />
            ))}
          </View>
          <View style={s.wrap}>
            {[
              { id: 'equal', name: 'Equally' },
              { id: 'exact', name: 'Exact amounts' },
              { id: 'percent', name: 'Percentages' },
              { id: 'shares', name: 'Shares' },
            ].map((m) => (
              <Chip
                key={m.id}
                title={m.name}
                active={mode === m.id}
                onPress={() => setMode(m.id)}
              />
            ))}
          </View>
          {mode !== 'equal' &&
            selected.map((id) => (
              <Field
                key={id}
                label={`${trip.members.find((m) => m.id === id)?.name} (${mode === 'percent' ? '%' : mode === 'shares' ? 'shares' : currency})`}
                value={values[id] || ''}
                onChangeText={(v) => setValues((prev) => ({ ...prev, [id]: v }))}
                keyboardType="decimal-pad"
                placeholder="0"
              />
            ))}
          <Chip
            title="Multiple people paid"
            active={multiple}
            onPress={() => {
              setMultiple((v) => !v);
              if (multiple) setPayers((p) => p.slice(0, 1));
            }}
          />
        </>
      )}
      <ErrorBox text={error} />
      {!expense && (
        <Text style={s.muted}>
          Saved on this device first. Syncs automatically when your server is reachable.
        </Text>
      )}
      <Btn title="Save bill" busy={busy} onPress={submit} />
    </Sheet>
  );
}
