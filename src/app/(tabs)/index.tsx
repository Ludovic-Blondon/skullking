import Ionicons from '@expo/vector-icons/Ionicons';
import { desc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { db } from '@/db/client';
import { games } from '@/db/schema';
import { Body, Card, Screen, Title } from '@/ui/screen';
import { useTokens } from '@/ui/use-tokens';

export default function HomeScreen() {
  const t = useTokens();
  // Reprise automatique d'une partie interrompue (PLAN.md §1 et §7.1).
  const { data: ongoing } = useLiveQuery(
    db
      .select()
      .from(games)
      .where(eq(games.status, 'in_progress'))
      .orderBy(desc(games.createdAt))
      .limit(1),
  );
  const current = ongoing[0];

  return (
    <Screen>
      {current ? (
        <Link href={{ pathname: '/game/[id]', params: { id: String(current.id) } }} asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reprendre la partie"
            testID="resume-game"
            className="gap-1 rounded-card border border-primary bg-surface-raised p-4 active:opacity-80">
            <View className="flex-row items-center gap-2">
              <Ionicons name="play-circle" size={22} color={t.primary} />
              <Text className="text-lg font-bold text-content">Reprendre la partie</Text>
            </View>
            <Text className="text-sm text-content-muted">
              Manche {current.currentRound} ·{' '}
              {current.currentPhase === 'bidding' ? 'annonces' : 'résultats'}
            </Text>
          </Pressable>
        </Link>
      ) : (
        <Card>
          <Title>Skull King</Title>
          <Body>
            Comptage de points, historique et statistiques. 100 % hors ligne, sans pub ni compte.
          </Body>
        </Card>
      )}

      <Link href="/game/new" asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Nouvelle partie"
          testID="new-game"
          className="min-h-touch flex-row items-center justify-center gap-2 rounded-card bg-primary p-4 active:opacity-80">
          <Ionicons name="play" size={20} color={t.primaryFg} />
          <Text className="text-lg font-semibold text-primary-fg">Nouvelle partie</Text>
        </Pressable>
      </Link>

      <Link href="/rules" asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Aide-mémoire du barème"
          className="min-h-touch flex-row items-center gap-3 rounded-card border border-border bg-surface-raised p-4 active:opacity-70">
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
