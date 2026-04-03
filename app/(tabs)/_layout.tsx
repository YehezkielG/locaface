import React from 'react';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import BottomTabBar from '@/src/components/BottomTabBar';

export default function TabsLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      <BottomTabBar />
    </View>
  );
}
