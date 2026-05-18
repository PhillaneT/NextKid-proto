import React from "react";
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { supabase } from '@/src/lib/supabase';
import { registerForPushNotifications } from '@/src/lib/pushNotifications';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [, setSession] = useState<null | { user: unknown }>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setChecked(true);
      SplashScreen.hideAsync();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      // Register push token whenever user signs in
      if (session?.user) {
        registerForPushNotifications().catch(() => {});
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!checked) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth/reset-password" />
        <Stack.Screen name="order/[id]" />
        <Stack.Screen name="checkout/[listingId]" />
        <Stack.Screen name="cart" />
        <Stack.Screen
          name="item/[id]"
          options={{
            headerShown: true,
            headerTitle: '',
            headerBackTitle: 'Back',
            headerStyle: { backgroundColor: '#ffffff' },
            headerTintColor: '#BE1E2D',
          }}
        />
      </Stack>
    </>
  );
}
