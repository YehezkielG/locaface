import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import "../global.css";
import { supabase } from '../src/lib/supabase';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      
      const inAuthGroup = segments[0] === '(auth)';
      const isCallbackPage = segments.includes('auth-callback');

      if (session) {
        if (segments[0] !== 'home') { 
          router.replace('/home');
        }
      } 
      else if (!session && !isCallbackPage) {
        router.replace('/'); // Kembali ke index/login
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [segments]); 

  return (
    <>
      <StatusBar style="dark" />
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="home" options={{ headerShown: false }} />
        <Stack.Screen name="auth-callback" options={{ headerShown: false, presentation: 'modal' }} />
      </Stack>
    </>
  );
}