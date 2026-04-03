import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: {
      getItem: async (key: string) => {
        const secureKeyOk = /^[A-Za-z0-9._-]+$/.test(key);
        try {
          if (secureKeyOk) {
            const value = await SecureStore.getItemAsync(key);
            if (value != null) return value;
          }
        } catch {}
        return AsyncStorage.getItem(key);
      },
      setItem: async (key: string, value: string) => {
        const secureKeyOk = /^[A-Za-z0-9._-]+$/.test(key);
        let secureWriteSucceeded = false;
        try {
          if (secureKeyOk) {
            await SecureStore.setItemAsync(key, value);
            secureWriteSucceeded = true;
          }
        } catch {}

        if (!secureWriteSucceeded) {
          await AsyncStorage.setItem(key, value);
          return;
        }

        try {
          await AsyncStorage.removeItem(key);
        } catch {}
      },
      removeItem: async (key: string) => {
        const secureKeyOk = /^[A-Za-z0-9._-]+$/.test(key);
        try {
          if (secureKeyOk) {
            await SecureStore.deleteItemAsync(key);
          }
        } catch {}
        try {
          await AsyncStorage.removeItem(key);
        } catch {}
      },
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});