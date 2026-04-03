import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Alert, BackHandler, Text, View } from 'react-native';
import "../global.css";
import { supabase } from '../src/lib/supabase';
import InAppPopupHost from '../src/components/InAppPopupHost';
import { checkSystemTimeSync } from '../src/lib/securityServices';

export const metadata = {
  title: 'locaface',
  description: 'Your AI-powered learning companion',
};

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [bootstrapped, setBootstrapped] = useState(false);
  const [timeValidationFailed, setTimeValidationFailed] = useState(false);

  const timeOutOfSyncMessage = "🛑 System Time Out of Sync. Please enable 'Automatic Date & Time' in your Phone Settings to continue.";

  const withTimeout = async <T,>(promise: PromiseLike<T>, timeoutMs: number, fallbackValue: T): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const timeoutPromise = new Promise<T>((resolve) => {
      timeoutId = setTimeout(() => resolve(fallbackValue), timeoutMs);
    });

    const result = await Promise.race([promise, timeoutPromise]);

    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    return result;
  };


  const isProfileComplete = (profile: any) => {
    if (!profile) return false;

    const requiredKeys = [
      'email',
      'username',
      'gender',
      'face_embedding_front',
      'face_embedding_left',
      'face_embedding_right',
      'avatar_url',
    ];
    for (const key of requiredKeys) {
      const value = profile[key];
      if (value === null || value === undefined) return false;
      if (typeof value === 'string' && value.trim() === '') return false;
      if (Array.isArray(value) && value.length === 0) return false;
    }

    return true;
  };

  useEffect(() => {
    let mounted = true;

    const routeForSession = async (session: any | null) => {
      const top = segments[0];
      const inAuth = top === 'auth';
      const inOnboarding = top === 'onboarding';
      const inTabs = top === '(tabs)';

      // No session => force auth, except if already in /auth
      if (!session) {
        if (!inAuth) router.replace('/auth');
        return;
      }

      const user = session.user;
      const userId = user?.id;
      if (!userId) {
        router.replace('/auth');
        return;
      }

      const profileResult = await withTimeout(
        supabase
          .from('profiles')
          .select('id, email, username, gender, face_embedding_front, face_embedding_left, face_embedding_right, avatar_url, user_tag')
          .eq('id', userId)
          .maybeSingle(),
        8_000,
        { data: null, error: new Error('Profile check timeout') } as any
      );

      const { data: profile, error } = profileResult;

      if (error) console.warn('Profile check error:', error);

      if (!profile || !isProfileComplete(profile)) {
        if (!inOnboarding) {
          router.replace({
            pathname: '/onboarding',
            params: {
              userId,
              avatar: user?.user_metadata?.avatar_url,
              fullName: user?.user_metadata?.full_name || user?.email,
            },
          });
        }

        
      } else {
        // Profile exists, redirect to tabs
        if (!inTabs) {
          router.replace('/(tabs)/home');
        }
      }
    };

    (async () => {
      try {
        const timeSyncResult = await withTimeout(
          checkSystemTimeSync(),
          8_000,
          { inSync: true, diffMs: 0, checked: false }
        );

        if (!timeSyncResult.inSync) {
          setTimeValidationFailed(true);
          Alert.alert(
            'System Time Out of Sync',
            timeOutOfSyncMessage,
            [
              {
                  text: 'Exit App',
                  onPress: () => BackHandler.exitApp(),
                },
              ],
            { cancelable: false }
          );
          return;
        }

        const sessionResult = await withTimeout(
          supabase.auth.getSession(),
          8_000,
          { data: { session: null } } as any
        );

        const { data } = sessionResult;
        if (!mounted) return;
        await routeForSession(data.session);
      } catch (error) {
        console.warn('Startup bootstrap error:', error);
        if (mounted) router.replace('/auth');
      } finally {
        if (mounted) setBootstrapped(true);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await routeForSession(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router, segments]);

  if (!bootstrapped) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (timeValidationFailed) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-center text-red-600 text-base font-semibold">{timeOutOfSyncMessage}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
      <Stack screenOptions={{ headerShown: false }} />
      <InAppPopupHost />
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}
