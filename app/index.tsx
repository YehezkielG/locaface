import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';

export default function IndexRoute() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;

        if (data.session) router.replace('/(tabs)/home');
        else router.replace('/auth');
      } catch (err) {
        console.warn('Session check failed:', err);
        if (mounted) router.replace('/auth');
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator size="large" />
    </View>
  );
}
