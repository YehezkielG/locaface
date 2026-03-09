import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RootLayout() {
  return <>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
        <Stack screenOptions={{ headerShown: false }} />      
        <StatusBar style="dark" />
      </SafeAreaView>
  </>;
}
