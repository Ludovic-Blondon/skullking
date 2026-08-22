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
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Text } from '@/ui/text';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import migrations from '../../drizzle/migrations';
import { db } from '@/db/client';
import { useSettings } from '@/features/settings/use-settings';
import { useT } from '@/i18n';
import { navigationThemes } from '@/ui/navigation-theme';

export default function RootLayout() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const { theme } = useSettings();
  const t = useT();
  // Le thème choisi dans les réglages pilote NativeWind ; « système » lui rend
  // la main.
  useEffect(() => setColorScheme(theme), [theme, setColorScheme]);
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
            <Text className="text-center font-title text-h2 text-negative">{t('db.failed')}</Text>
            <Text className="text-center font-body text-caption text-content-muted">
              {error.message}
            </Text>
          </View>
        ) : !success || !fontsLoaded ? (
          <View className="flex-1 items-center justify-center bg-surface">
            <ActivityIndicator />
          </View>
        ) : (
          <Stack
            screenOptions={{
              headerTitleStyle: { fontFamily: 'Outfit_700Bold' },
              // Sans ce libellé, iOS reprend le titre de l'écran précédent — et
              // ceux qui portent leur propre en-tête n'en ont pas : le bouton
              // retour affichait alors le nom de la route, « (tabs) » ou
              // « game/[id]/index ».
              headerBackTitle: t('route.back'),
            }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="settings" options={{ title: t('route.settings') }} />
            <Stack.Screen name="rules" options={{ title: t('route.rules') }} />
            <Stack.Screen name="game/new" options={{ title: t('route.newGame') }} />
            <Stack.Screen
              // L'écran porte son propre en-tête (« Manche 4/10 · 4 cartes ») :
              // le déclarer ici plutôt que dans l'écran évite que l'en-tête
              // natif clignote pendant le chargement de la partie.
              name="game/[id]/index"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="game/[id]/scoresheet"
              options={{
                title: t('route.scoresheet'),
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
            <Stack.Screen name="game/[id]/end" options={{ title: t('route.gameEnd') }} />
            <Stack.Screen name="history/[id]" options={{ title: t('route.gameDetail') }} />
            <Stack.Screen
              // La fiche porte son propre titre : le prénom, éditable sur place.
              name="players/[id]"
              options={{
                headerShown: false,
                presentation: 'formSheet',
                sheetGrabberVisible: true,
              }}
            />
          </Stack>
        )}
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
