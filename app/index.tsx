import React, { useEffect } from 'react';
import {  useRouter, useSegments } from 'expo-router';
import "../global.css";
import { supabase } from '../src/lib/supabase';
import { Text } from 'react-native';

export const metadata = {
  title: 'Locaface',
  description: 'A online abcence App with location and face validation.',
};

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
          const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session?.user?.id)
          .maybeSingle();
        console.log("Cek profil user:", { data, error });
        if (!data) {
        router.push({
          pathname:'/onboarding',
          params: {
            userId: session.user.id,
            avatar: session.user.user_metadata.avatar_url,
            fullName: session.user.user_metadata.full_name || session.user.email
          }
        }); 
      } else {
        console.log('User sudah terdaftar:', data);
        if (segments[0] !== 'home') {
          router.replace('/home'); 
        }
      }
      } 
      else if (!session) {
        router.replace('./auth');
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [segments]); 

  return (
    <>
     <Text className="text-center text-2xl text-gray-800 font-bold mb-10">
      Locaface
     </Text>
    </>
  );
}