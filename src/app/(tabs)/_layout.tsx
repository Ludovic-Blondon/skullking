import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, type ColorValue } from 'react-native';

import { useT } from '@/i18n';
import { useTokens } from '@/ui/use-tokens';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// Depuis le SDK 58, la couleur passée aux icônes d'onglet est une `ColorValue`,
// qui admet aussi `null` et `number` ; Ionicons ne les admet pas. Nos teintes
// d'onglet (`tabBarActiveTintColor`, `tabBarInactiveTintColor`) sont des chaînes.
function tabIcon(name: IoniconName) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return (
      <Ionicons name={name} color={typeof color === 'string' ? color : undefined} size={size} />
    );
  };
}

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
          tabBarIcon: tabIcon('home-outline'),
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
        options={{ title: text('tabs.history'), tabBarIcon: tabIcon('time-outline') }}
      />
      <Tabs.Screen
        name="players"
        options={{ title: text('tabs.players'), tabBarIcon: tabIcon('people-outline') }}
      />
      <Tabs.Screen
        name="stats"
        options={{ title: text('tabs.stats'), tabBarIcon: tabIcon('stats-chart-outline') }}
      />
    </Tabs>
  );
}
