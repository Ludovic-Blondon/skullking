import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { db } from '@/db/client';
import { players } from '@/db/schema';
import { MIN_GAMES_FOR_RATES } from '@/features/stats/compute';
import { useStats } from '@/features/stats/use-stats';
import { Avatar } from '@/ui/avatar';
import { EmptyState, Screen, SectionLabel } from '@/ui/screen';

/**
 * Statistiques globales (PLAN.md §8) : le volume joué, les records, et le
 * classement all-time.
 */
export default function StatsScreen() {
  const { data: roster } = useLiveQuery(db.select().from(players));
  const { global } = useStats();

  const playerOf = (playerId: number) => roster.find((player) => player.id === playerId);
  const nameOf = (playerId: number) => playerOf(playerId)?.name ?? `Joueur ${playerId}`;

  if (global.finishedGames === 0) {
    return (
      <Screen>
        <EmptyState emoji="📊" title="Pas encore de statistiques">
          Terminez une partie : les records et le classement se remplissent tout seuls. Les parties
          abandonnées, elles, ne comptent pas.
        </EmptyState>
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="flex-row gap-2">
        <View className="flex-1 gap-0.5 rounded-field bg-surface-raised p-3">
          <Text className="font-display text-h1 tabular-nums text-content">
            {global.finishedGames}
          </Text>
          <Text className="font-body text-micro text-content-muted">
            partie{global.finishedGames > 1 ? 's' : ''} terminée
            {global.finishedGames > 1 ? 's' : ''}
          </Text>
        </View>
        <View className="flex-1 gap-0.5 rounded-field bg-surface-raised p-3">
          <Text className="font-display text-h1 tabular-nums text-content">
            {global.playedRounds}
          </Text>
          <Text className="font-body text-micro text-content-muted">manches jouées</Text>
        </View>
      </View>

      <SectionLabel>Records</SectionLabel>
      <View className="gap-2">
        {global.bestGame && (
          <View className="flex-row items-center gap-3 rounded-field bg-surface-raised p-3">
            <Text className="text-xl">🏆</Text>
            <View className="flex-1">
              <Text className="font-semi text-body text-content">
                {nameOf(global.bestGame.playerId)}
              </Text>
              <Text className="font-body text-micro text-content-muted">
                meilleur score sur une partie
              </Text>
            </View>
            <Text className="font-display text-h2 tabular-nums text-primary">
              {global.bestGame.score}
            </Text>
          </View>
        )}
        {global.bestRound && (
          <View className="flex-row items-center gap-3 rounded-field bg-surface-raised p-3">
            <Text className="text-xl">⚡</Text>
            <View className="flex-1">
              <Text className="font-semi text-body text-content">
                {nameOf(global.bestRound.playerId)}
              </Text>
              <Text className="font-body text-micro text-content-muted">
                meilleure manche — la {global.bestRound.roundNumber}
                {global.bestRound.roundNumber === 1 ? 'ʳᵉ' : 'ᵉ'}
              </Text>
            </View>
            <Text className="font-display text-h2 tabular-nums text-primary">
              +{global.bestRound.score}
            </Text>
          </View>
        )}
      </View>

      <SectionLabel>Classement all-time</SectionLabel>
      {global.ranking.length === 0 ? (
        <Text className="px-1 font-body text-caption text-content-muted">
          Le classement se trie au <Text className="font-semi text-content">score moyen</Text>, pas
          au cumul — sinon il récompenserait l’assiduité plutôt que le jeu. Il s’ouvre aux joueurs
          ayant terminé {MIN_GAMES_FOR_RATES} parties.
        </Text>
      ) : (
        <>
          <View className="gap-2">
            {global.ranking.map((row, index) => {
              const player = playerOf(row.playerId);
              return (
                <Link
                  key={row.playerId}
                  href={{ pathname: '/players/[id]', params: { id: String(row.playerId) } }}
                  asChild>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Fiche de ${nameOf(row.playerId)}`}
                    className="min-h-touch flex-row items-center gap-3 rounded-card bg-surface-raised p-3 active:opacity-70">
                    <Text className="w-5 text-center font-title text-caption text-content-muted">
                      {index + 1}
                    </Text>
                    <Avatar emoji={player?.emoji} color={player?.color} size="sm" />
                    <View className="flex-1">
                      <Text className="font-semi text-body text-content">
                        {nameOf(row.playerId)}
                      </Text>
                      <Text className="font-body text-micro text-content-muted">
                        {row.games} parties terminées
                      </Text>
                    </View>
                    <Text className="font-display text-h2 tabular-nums text-content">
                      {Math.round(row.averageScore)}
                    </Text>
                  </Pressable>
                </Link>
              );
            })}
          </View>
          <Text className="px-1 font-body text-micro text-content-muted">
            Classement au score moyen par partie, pas au cumul : sinon il récompenserait l’assiduité
            plutôt que le jeu. À partir de {MIN_GAMES_FOR_RATES} parties terminées.
          </Text>
        </>
      )}
    </Screen>
  );
}
