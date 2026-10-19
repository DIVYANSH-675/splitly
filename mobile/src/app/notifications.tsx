import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Notifications } from '../components/Notifications';
import { useApp } from '../lib/context';
export default function NotificationPage() {
  const { trips } = useApp();
  const { group } = useLocalSearchParams<{group?: string}>();
  return <Notifications visible groups={group ? trips.filter(t => t.id === group) : trips} onClose={() => router.back()} />;
}
