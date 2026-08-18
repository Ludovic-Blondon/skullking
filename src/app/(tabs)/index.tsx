import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Body, Card, Screen, Title } from '@/ui/screen';
import { useTokens } from '@/ui/use-tokens';

export default function HomeScreen() {
  const t = useTokens();

  return (
    <Screen>
      <Card>
        <Title>Skull King</Title>
        <Body>
          Comptage de points, historique et statistiques. 100 % hors ligne, sans pub ni compte.
        </Body>
      </Card>

      <Link href="/game/new" asChild>
        <Pressable className="min-h-touch flex-row items-center justify-center gap-2 rounded-card bg-primary p-4 active:opacity-80">
          <Ionicons name="play" size={20} color={t.primaryFg} />
          <Text className="text-lg font-semibold text-primary-fg">Nouvelle partie</Text>
        </Pressable>
      </Link>

      <Link href="/rules" asChild>
        <Pressable className="min-h-touch flex-row items-center gap-3 rounded-card border border-border bg-surface-raised p-4 active:opacity-70">
          <Ionicons name="book-outline" size={20} color={t.accent} />
          <View className="flex-1">
            <Text className="text-base font-semibold text-content">Aide-mémoire du barème</Text>
            <Text className="text-sm text-content-muted">Qui marque quoi, et combien</Text>
          </View>
        </Pressable>
      </Link>
    </Screen>
  );
}
