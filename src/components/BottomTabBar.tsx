import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface TabItem {
  name: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const TABS: TabItem[] = [
  { name: 'Home', route: '/home', icon: 'home' },
  { name: 'Classes', route: '/classes', icon: 'book' },
  { name: 'History', route: '/history', icon: 'time' },
  { name: 'Profile', route: '/profile', icon: 'person' },
];

export default function BottomTabBar() {
  const router = useRouter();
  const pathname = usePathname();

  const current = pathname ?? '/';
  const isActive = (route: string) => {
    try {
      const normalized = current.split('?')[0].split('#')[0];
      return normalized === route || normalized.startsWith(route + '/') || normalized.startsWith(route + '?');
    } catch {
      return false;
    }
  };

  return (
    <View style={styles.container}>
      {TABS.map((tab) => (
        <TouchableOpacity
          key={tab.route}
          style={styles.tabButton}
          onPress={() => router.push(tab.route as any)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isActive(tab.route) ? tab.icon : (`${tab.icon}-outline` as any)}
            size={24}
            color={isActive(tab.route) ? '#313131' : '#9CA3AF'}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingVertical: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
});