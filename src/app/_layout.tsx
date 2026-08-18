import '@/global.css';

import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { ActivityIndicator, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import migrations from '../../drizzle/migrations';
import { db } from '@/db/client';
import { navigationThemes } from '@/ui/navigation-theme';

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  // Migrations versionnées, embarquées dans le bundle (PLAN.md §5).
  const { success, error } = useMigrations(db, migrations);

  return (
    <GestureHandlerRootView className="flex-1">
      <ThemeProvider value={navigationThemes[scheme]}>
        <StatusBar style="auto" />
        {error ? (
          <View className="flex-1 items-center justify-center gap-2 bg-surface p-8">
            <Text className="text-center text-lg font-semibold text-negative">
              La base de données n&apos;a pas pu être préparée
            </Text>
            <Text className="text-center text-sm text-content-muted">{error.message}</Text>
          </View>
        ) : !success ? (
          <View className="flex-1 items-center justify-center bg-surface">
            <ActivityIndicator />
          </View>
        ) : (
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="settings" options={{ title: 'Réglages' }} />
            <Stack.Screen name="rules" options={{ title: 'Aide-mémoire du barème' }} />
            <Stack.Screen name="game/new" options={{ title: 'Nouvelle partie' }} />
            <Stack.Screen
              name="game/[id]/index"
              options={{ title: 'Partie', headerBackVisible: false }}
            />
            <Stack.Screen
              name="game/[id]/scoresheet"
              options={{ title: 'Feuille de score', presentation: 'formSheet' }}
            />
            <Stack.Screen
              name="game/[id]/bonus/[playerId]"
              options={{ title: 'Bonus', presentation: 'formSheet' }}
            />
            <Stack.Screen name="game/[id]/end" options={{ title: 'Fin de partie' }} />
            <Stack.Screen name="history/[id]" options={{ title: 'Détail de la partie' }} />
            <Stack.Screen name="players/[id]" options={{ title: 'Fiche joueur' }} />
          </Stack>
        )}
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
