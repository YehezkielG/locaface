import { Text, View, TouchableHighlight, Image, TextInput } from "react-native";
import React from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase'; 
import { GoogleSignin } from '@react-native-google-signin/google-signin';

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID as string,
});

export default function App() {
  const [isAuthenticating, setIsAuthenticating] = React.useState(false);
  const router = useRouter();

  const handleNativeGoogleLogin = async () => {
    try {
      setIsAuthenticating(true);
      await GoogleSignin.hasPlayServices();
      
      const userInfo = await GoogleSignin.signIn();
      
      if (userInfo.data?.idToken) {
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: userInfo.data?.idToken,
        });

        if (error) throw error;
        console.log("Login sukses! Menyimpan sesi...");
        router.replace('./home');
      } else {
        throw new Error('Tidak ada ID Token dari Google');
      }
    } catch (error: any) {
      console.error("Native Login Gagal:", error.message);
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <View className="w-full max-w-md p-8 g">
        {/* <Image src="/logo.png" alt="Logo" width={75} height={75} className="mx-auto mb-4" /> */}
        <Text className="text-center text-2xl text-gray-800 font-bold mb-10">
          locaface
        </Text>
        <TouchableHighlight
          onPress={handleNativeGoogleLogin}
          className="mb-3  rounded-md"
          underlayColor="#f3f4f6" // Ini untuk warna efek saat tombol ditekan (opsional)
        >
          <View className="flex-row py-4 w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white">
            <Image
              source={require('../../assets/images/auth/google.png')} className="w-5 h-5" resizeMode="contain"
            />
            <Text className="font-semibold text-gray-800" >{isAuthenticating ? "Authenticating..." : "Continue With Google"}</Text>
          
          </View>
        </TouchableHighlight>

        <View className="my-6 flex-row items-center w-full">
          <View className="flex-1 h-[1px] bg-gray-300" />
          <Text className="mx-4 text-gray-400 text-xs uppercase font-semibold">
            or
          </Text>
          <View className="flex-1 h-[1px] bg-gray-300" />
        </View>

        {/* Email Form */}
        <View>
          <View className="mb-4">
            <Text className="block text-sm font-medium text-gray-400">
              Email address
            </Text>
            <TextInput
              keyboardType="email-address"
              id="email"
              placeholder="you@example.com"
              className={`mt-1 w-full rounded-md border py-4 px-4 text-gray-800 transition-all duration-200`}
            />
          </View>

          <TouchableHighlight className="w-full rounded-md bg-blue-500 py-4 font-semibold text-white transition hover:bg-blue-600 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
            <View>
              <Text className="text-gray-100">Continue with Email</Text>
            </View>
          </TouchableHighlight>
        </View>
      </View>
    </View>
  );
}
