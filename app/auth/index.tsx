import { Text, View, TouchableHighlight, Image } from "react-native";
import React from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase'; 
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { showPopup } from '@/src/lib/inAppPopup';

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID as string,
});

export default function App() {
  const [isAuthenticating, setIsAuthenticating] = React.useState(false);
  const loginInProgressRef = React.useRef(false);
  const router = useRouter();

  const handleNativeGoogleLogin = async () => {
    if (isAuthenticating || loginInProgressRef.current) {
      return;
    }

    loginInProgressRef.current = true;

    try {
      setIsAuthenticating(true);
      await GoogleSignin.hasPlayServices();
      
      const userInfo = await GoogleSignin.signIn();

      const fallbackTokens = await GoogleSignin.getTokens().catch(() => null);
      const idToken = userInfo.data?.idToken || fallbackTokens?.idToken;

      if (idToken) {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
        });

        if (error) throw error;
        router.replace('/home');
      } else {
        throw new Error('Google token is unavailable');
      }
    } catch (error: any) {
      const code = error?.code;
      if (code === statusCodes.IN_PROGRESS || String(error?.message || '').toLowerCase().includes('sign-in in progress')) {
        showPopup({
          title: 'Login',
          message: 'Google sign-in is already in progress. Please wait a moment.',
          type: 'info',
        });
      } else {
        console.error("Native login failed:", error?.message || String(error));
        showPopup({
          title: 'Login Failed',
          message: error?.message || 'Unable to sign in with Google. Please try again.',
          type: 'error',
        });
      }
    } finally {
      loginInProgressRef.current = false;
      setIsAuthenticating(false);
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <View className="w-full max-w-md p-8 g">
        {/* <Image src="/logo.png" alt="Logo" width={75} height={75} className="mx-auto mb-4" /> */}
        <Text className="text-center text-2xl text-gray-800 font-bold mb-5">
          locaface
        </Text>
        <Text className="text-center text-gray-600 mb-6">
          AI-powered automated attendance
        </Text>

        <View className="mb-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <Text className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
            Why Locaface?
          </Text>
          <Text className="text-sm text-gray-700 mb-1">• Fast location-aware class check-in</Text>
          <Text className="text-sm text-gray-700 mb-1">• AI face verification for safer precence</Text>
          <Text className="text-sm text-gray-600">• Your profile setup is completed after sign in</Text>
        </View>

        <TouchableHighlight
          onPress={handleNativeGoogleLogin}
          disabled={isAuthenticating}
          className="mb-3  rounded-md"
          underlayColor="#f3f4f6" // Ini untuk warna efek saat tombol ditekan (opsional)
        >
          <View className={`flex-row py-4 w-full items-center justify-center gap-2 rounded-md border border-gray-300 ${isAuthenticating ? 'bg-gray-100' : 'bg-white'}`}>
            <Image
              source={require('../../assets/images/auth/google.png')} className="w-5 h-5" resizeMode="contain"
            />
            <Text className="font-semibold text-gray-800" >{isAuthenticating ? "Authenticating..." : "Continue With Google"}</Text>
          
          </View>
        </TouchableHighlight>
        <Text className="mt-2 text-center text-xs text-gray-400">
          By continuing, you agree to use your account for class precence verification.
        </Text>
      </View>
    </View>
  );
}
