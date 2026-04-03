import { supabase } from './supabase';
import { router } from 'expo-router';
import { clearHmacSession } from './securityServices';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

export const fetchUserProfile = async () => {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      router.replace('/auth');
      return null;
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*') 
      .eq('id', user.id)
      .single(); 

    if (profileError) {
      console.error("Failed to fetch profile data:", profileError.message);
      return null;
    }

    return profileData;

  } catch (error) {
    console.error("An error occurred:", error);
    return null;
  }
};

export interface user_metadata {
  id:string;
  username: string;
  email: string;
  avatar_url?: string;
  full_name?: string;
}

export const handleLogout = async () => {
    try {
      await clearHmacSession();
      await GoogleSignin.signOut();
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Failed to log out:", error);
    } finally {
      // setIsLoggingOut(false);
    }
};