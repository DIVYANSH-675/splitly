import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { AppProvider } from '../lib/context';
export default function Layout() {
  const [loaded, error] = useFonts({
    ManropeRegular: require('@expo-google-fonts/manrope/400Regular/Manrope_400Regular.ttf'),
    ManropeMedium: require('@expo-google-fonts/manrope/500Medium/Manrope_500Medium.ttf'),
    ManropeSemiBold: require('@expo-google-fonts/manrope/600SemiBold/Manrope_600SemiBold.ttf'),
    ManropeBold: require('@expo-google-fonts/manrope/800ExtraBold/Manrope_800ExtraBold.ttf'),
  });
  if (!loaded && !error)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#F6F6EF',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color="#285443" />
      </View>
    );
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F6F6EF' } }}
        />
      </AppProvider>
    </SafeAreaProvider>
  );
}
