import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './Typography';
import { Avatar, Btn, C, ErrorBox, Icon, Sheet, s } from './ui';
import type { Member } from '../lib/types';

export function PeopleCard({
  label,
  caption,
  members,
  summary,
  onPress,
}: {
  label: string;
  caption?: string;
  members: Member[];
  summary?: string;
  onPress: () => void;
}) {
  const names = members.map((member) => member.name).join(', ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}${caption ? `, ${caption}` : ''}: ${names || 'Choose people'}`}
      accessibilityHint="Opens member selection"
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: 0,
        padding: 14,
        gap: 13,
        borderWidth: 1,
        borderColor: pressed ? C.accent : C.line,
        borderRadius: 18,
        backgroundColor: pressed ? C.pale : C.white,
      })}
    >
      <View style={[s.between, { gap: 5 }]}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: C.dark }}>{label}</Text>
          {caption && <Text style={{ fontSize: 10, color: C.muted }}>{caption}</Text>}
        </View>
        <Icon name="chevron-forward" size={16} color={C.muted} />
      </View>
      <View style={{ gap: 7, minHeight: 39 }}>
        {members.slice(0, 2).map((member, index) => (
          <View
            key={member.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: C.pale,
              borderRadius: 24,
              padding: 4,
              paddingRight: 8,
              alignSelf: 'flex-start',
              maxWidth: '100%',
            }}
          >
            <Avatar name={member.name} photo={member.photo} size={27} index={index} />
            <Text
              numberOfLines={1}
              style={{ fontSize: 12, color: C.dark, flexShrink: 1, fontWeight: '600' }}
            >
              {member.name}
            </Text>
          </View>
        ))}
        {members.length > 2 && (
          <Text style={{ fontSize: 11, color: C.accent, fontWeight: '600' }}>
            +{members.length - 2} more
          </Text>
        )}
        {!members.length && <Text style={s.muted}>Choose people</Text>}
      </View>
      {summary && (
        <Text numberOfLines={2} style={{ fontSize: 10, color: C.muted, lineHeight: 15 }}>
          {summary}
        </Text>
      )}
    </Pressable>
  );
}

export function PersonChoice({
  member,
  me,
  selected,
  onPress,
  children,
  single = false,
}: {
  member: Member;
  me: string;
  selected: boolean;
  onPress: () => void;
  children?: React.ReactNode;
  single?: boolean;
}) {
  return (
    <View
      style={{
        backgroundColor: C.white,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: selected ? '#C9D8BD' : C.line,
        padding: 16,
        gap: 15,
      }}
    >
      <Pressable
        accessibilityRole={single ? 'radio' : 'checkbox'}
        accessibilityState={{ checked: selected }}
        accessibilityLabel={`${member.name}${member.id === me ? ' (you)' : ''}`}
        onPress={onPress}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}
      >
        <Avatar name={member.name} photo={member.photo} size={42} />
        <Text style={{ flex: 1, color: C.dark, fontWeight: '600', fontSize: 14 }}>
          {member.name}
          {member.id === me ? ' · you' : ''}
        </Text>
        <View
          style={{
            width: 23,
            height: 23,
            borderRadius: single ? 12 : 7,
            borderWidth: 1.5,
            borderColor: selected ? C.accent : '#CDD4C7',
            backgroundColor: selected ? C.accent : C.white,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected && <Icon name="checkmark" size={16} color={C.white} />}
        </View>
      </Pressable>
      {children}
    </View>
  );
}

export function SinglePersonPicker({
  title,
  members,
  me,
  selected,
  onDone,
  onBack,
}: {
  title: string;
  members: Member[];
  me: string;
  selected: string;
  onDone: (id: string) => void;
  onBack: () => void;
}) {
  const [choice, setChoice] = useState(selected),
    [error, setError] = useState('');
  return (
    <Sheet
      visible
      title={title}
      onClose={onBack}
      onBack={onBack}
      footer={
        <Btn
          title="Done"
          onPress={() => {
            if (!choice) {
              setError('Choose a person.');
              return;
            }
            onDone(choice);
          }}
        />
      }
    >
      <Text style={s.muted}>Choose one person.</Text>
      {members.map((member) => (
        <PersonChoice
          key={member.id}
          member={member}
          me={me}
          selected={choice === member.id}
          single
          onPress={() => {
            setChoice(member.id);
            setError('');
          }}
        />
      ))}
      <ErrorBox text={error} />
    </Sheet>
  );
}
