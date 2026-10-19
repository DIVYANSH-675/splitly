import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from './Typography';
import { Avatar, C, Empty, IconButton, Page, s } from './ui';
import { useApp } from '../lib/context';
import type { Trip } from '../lib/types';
export const unreadCount = (trip: Trip, seen: Record<string, string>) => {
  const events = trip.activity || [];
  const index = events.findIndex((a) => a.id === seen[trip.id]);
  return index < 0 ? events.length : index;
};
export function NotificationBell({ groups, onPress }: { groups: Trip[]; onPress: () => void }) {
  const { seen } = useApp();
  const count = groups.reduce((n, t) => n + unreadCount(t, seen), 0);
  return (
    <View>
      <IconButton
        name="notifications-outline"
        label={`Notifications${count ? `, ${count} unread` : ''}`}
        onPress={onPress}
      />
      {count > 0 && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: -3,
            top: -4,
            minWidth: 19,
            height: 19,
            paddingHorizontal: 4,
            borderRadius: 10,
            backgroundColor: C.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 9, color: C.white, fontWeight: '800' }}>
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      )}
    </View>
  );
}
export function Notifications({
  groups,
  visible,
  onClose,
}: {
  groups: Trip[];
  visible: boolean;
  onClose: () => void;
}) {
  const { markRead } = useApp();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (visible) markRead(groups);
  }, [visible, groups, markRead]);
  const events = groups
    .flatMap((t) => (t.activity || []).map((a) => ({ ...a, group: t.name })))
    .sort((a, b) => b.at.localeCompare(a.at));
  if (!visible) return null;
  return (
    <Page>
      <View style={[s.row, {padding:24}]}><IconButton name="arrow-back" label="Back" onPress={onClose} /><Text style={s.h2}>Notifications</Text></View>
      <ScrollView contentContainerStyle={{padding:24, paddingTop:0, gap:20}}>
      <Text style={s.muted}>
        Who changed what, all in one place. Updates appear while the app is open and connected.
      </Text>
      {!events.length && (
        <Empty
          icon="notifications-outline"
          title="You’re all caught up."
          text="Group updates will appear here."
        />
      )}
      {events.map((event) => (
        <View key={event.id} style={[s.card, { gap: 12 }]}>
          <View style={[s.row, { alignItems: 'flex-start' }]}>
            <Avatar name={event.user} size={35} />
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={{ color: C.dark, fontSize: 13, fontWeight: '700' }}>
                {event.user} <Text style={{ fontWeight: '500' }}>{event.message}</Text>
              </Text>
              {groups.length > 1 && (
                <Text style={{ color: C.accent, fontSize: 10 }}>{event.group}</Text>
              )}
              <Text style={{ fontSize: 10, color: C.muted }}>
                {new Date(event.at).toLocaleString()}
              </Text>
            </View>
          </View>
          {Boolean(event.changes?.length) && (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${expanded[event.id] ? 'Hide' : 'Show'} changes by ${event.user}`}
                onPress={() => setExpanded((prev) => ({ ...prev, [event.id]: !prev[event.id] }))}
              >
                <Text style={s.link}>
                  {expanded[event.id]
                    ? 'Hide details ↑'
                    : `See ${event.changes!.length} change${event.changes!.length === 1 ? '' : 's'} →`}
                </Text>
              </Pressable>
              {expanded[event.id] &&
                event.changes?.map((change, i) => (
                  <View
                    key={i}
                    style={{ gap: 5, paddingTop: 8, borderTopWidth: 1, borderColor: C.line }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: C.dark }}>
                      {change.field}
                    </Text>
                    {Boolean(change.before) && (
                      <Text style={{ fontSize: 11, color: C.red }}>Before: {change.before}</Text>
                    )}
                    <Text style={{ fontSize: 11, color: C.accent }}>
                      {change.after ? `After: ${change.after}` : 'Removed'}
                    </Text>
                  </View>
                ))}
            </>
          )}
        </View>
      ))}
      </ScrollView>
    </Page>
  );
}
