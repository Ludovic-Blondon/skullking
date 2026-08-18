import '@/global.css';

import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { navigationThemes } from '@/ui/navigation-theme';

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';

  return (
    <GestureHandlerRootView className="flex-1">
      <ThemeProvider value={navigationThemes[scheme]}>
        <StatusBar style="auto" />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ title: 'Réglages' }} />
          <Stack.Screen name="rules" options={{ title: 'Aide-mémoire du barème' }} />
          <Stack.Screen name="game/new" options={{ title: 'Nouvelle partie' }} />
          <Stack.Screen
            name="game/[id]/index"
            options={{ title: 'Partie', headerBackVisible: false }}
          />
          <Stack.Screen name="game/[id]/end" options={{ title: 'Fin de partie' }} />
          <Stack.Screen name="history/[id]" options={{ title: 'Détail de la partie' }} />
          <Stack.Screen name="players/[id]" options={{ title: 'Fiche joueur' }} />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
