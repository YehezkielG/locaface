import { GoogleSignin } from '@react-native-google-signin/google-signin';
import React from 'react';
import { View, Text, Button } from 'react-native';
import { supabase } from '../src/lib/supabase';

export default function HomePage() {
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  
  const handleLogout = async () => {
    try {
      await GoogleSignin.signOut();
      await supabase.auth.signOut();
      console.log("Berhasil keluar sepenuhnya!");
    } catch (error) {
      console.error("Gagal logout:", error);
    }
  };
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-2xl font-bold text-gray-800">Home</Text>
      <Text className="mt-2 text-gray-600">You are signed in — welcome!</Text>
      <Button title="Logout (Hapus Sesi)" onPress={handleLogout} color="#ff0000" />
    </View>
  );
}
