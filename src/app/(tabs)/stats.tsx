import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { db } from '@/db/client';
import { players } from '@/db/schema';
import { MIN_GAMES_FOR_RATES } from '@/features/stats/compute';
import { useStats } from '@/features/stats/use-stats';
import { useT } from '@/i18n';
import { Avatar } from '@/ui/avatar';
import { EmptyState, Screen, SectionLabel } from '@/ui/screen';

/**
 * Statistiques globales (PLAN.md §8) : le volume joué, les records, et le
 * classement all-time.
 */
export default function StatsScreen() {
  const t = useT();
  const { data: roster } = useLiveQuery(db.select().from(players));
  const { global } = useStats();

  const playerOf = (playerId: number) => roster.find((player) => player.id === playerId);
  const nameOf = (playerId: number) =>
    playerOf(playerId)?.name ?? t('stats.unknownPlayer', { id: playerId });

  if (global.finishedGames === 0) {
    return (
      <Screen>
        <EmptyState emoji="📊" title={t('stats.globalEmpty')}>
          {t('stats.globalEmptyHint')}
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
            {t('stats.finishedGames', { count: global.finishedGames })}
          </Text>
        </View>
        <View className="flex-1 gap-0.5 rounded-field bg-surface-raised p-3">
          <Text className="font-display text-h1 tabular-nums text-content">
            {global.playedRounds}
          </Text>
          <Text className="font-body text-micro text-content-muted">{t('stats.playedRounds')}</Text>
        </View>
      </View>

      <SectionLabel>{t('stats.records')}</SectionLabel>
      <View className="gap-2">
        {global.bestGame && (
          <View className="flex-row items-center gap-3 rounded-field bg-surface-raised p-3">
            <Text className="text-xl">🏆</Text>
            <View className="flex-1">
              <Text className="font-semi text-body text-content">
                {nameOf(global.bestGame.playerId)}
              </Text>
              <Text className="font-body text-micro text-content-muted">{t('stats.bestGame')}</Text>
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
                {t('stats.bestRound', {
                  round: global.bestRound.roundNumber,
                  suffix: global.bestRound.roundNumber === 1 ? 'ʳᵉ' : 'ᵉ',
                })}
              </Text>
            </View>
            <Text className="font-display text-h2 tabular-nums text-primary">
              +{global.bestRound.score}
            </Text>
          </View>
        )}
      </View>

      <SectionLabel>{t('stats.allTime')}</SectionLabel>
      {global.ranking.length === 0 ? (
        <Text className="px-1 font-body text-caption text-content-muted">
          {t('stats.rankingEmpty', { min: MIN_GAMES_FOR_RATES })}
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
                    accessibilityLabel={t('players.sheetOf', { name: nameOf(row.playerId) })}
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
                        {t('stats.rankingGames', { count: row.games })}
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
            {t('stats.rankingHint', { min: MIN_GAMES_FOR_RATES })}
          </Text>
        </>
      )}
    </Screen>
  );
}
