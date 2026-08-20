import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, Tabs } from 'expo-router';
import { Pressable } from 'react-native';

import { useT } from '@/i18n';
import { useTokens } from '@/ui/use-tokens';

export default function TabsLayout() {
  const t = useTokens();
  const text = useT();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.contentMuted,
        tabBarLabelStyle: { fontFamily: 'Outfit_600SemiBold' },
        headerTitleStyle: { fontFamily: 'Outfit_700Bold' },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: text('tabs.home'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" color={color} size={size} />
          ),
          headerRight: () => (
            <Link href="/settings" asChild>
              <Pressable hitSlop={12} className="pr-4" accessibilityLabel={text('route.settings')}>
                <Ionicons name="settings-outline" color={t.content} size={22} />
              </Pressable>
            </Link>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: text('tabs.history'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="players"
        options={{
          title: text('tabs.players'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: text('tabs.stats'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
