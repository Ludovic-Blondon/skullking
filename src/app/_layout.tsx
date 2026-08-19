import '@/global.css';

import {
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/outfit';
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
  // Outfit : quatre graisses statiques, donc quatre familles (cf. tailwind.config.js).
  const [fontsLoaded] = useFonts({
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
  });

  return (
    <GestureHandlerRootView className="flex-1">
      <ThemeProvider value={navigationThemes[scheme]}>
        <StatusBar style="auto" />
        {error ? (
          <View className="flex-1 items-center justify-center gap-2 bg-surface p-8">
            <Text className="text-center font-title text-h2 text-negative">
              La base de données n&apos;a pas pu être préparée
            </Text>
            <Text className="text-center font-body text-caption text-content-muted">
              {error.message}
            </Text>
          </View>
        ) : !success || !fontsLoaded ? (
          <View className="flex-1 items-center justify-center bg-surface">
            <ActivityIndicator />
          </View>
        ) : (
          <Stack screenOptions={{ headerTitleStyle: { fontFamily: 'Outfit_700Bold' } }}>
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
              options={{
                title: 'Feuille de score',
                presentation: 'formSheet',
                sheetGrabberVisible: true,
              }}
            />
            <Stack.Screen
              name="game/[id]/bonus/[playerId]"
              // La feuille porte son propre titre (« Bonus — Lou », avec la
              // pastille du joueur) : un en-tête natif ferait doublon.
              options={{
                headerShown: false,
                presentation: 'formSheet',
                sheetGrabberVisible: true,
              }}
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
