import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Text } from '@/ui/text';

import { gamesQuery, gameTotalsQuery } from '@/db/repositories/game-repo';
import { dateLocale, useLanguage, useT, type Language } from '@/i18n';
import { EmptyState, Screen } from '@/ui/screen';

/** « 12 août », « 12 août 2025 » si la partie date d'une autre année. */
export function formatDate(timestamp: number, language: Language): string {
  const date = new Date(timestamp);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(dateLocale(language), {
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

const STATUS_KEYS = {
  in_progress: 'history.inProgress',
  abandoned: 'history.abandoned',
  finished: null,
} as const;

/**
 * Historique des parties (PLAN.md §7.4) : liste antichronologique — date,
 * nombre de joueurs, vainqueur, score. Toucher une ligne ouvre le détail.
 */
export default function HistoryScreen() {
  const t = useT();
  const language = useLanguage();
  const { data: games } = useLiveQuery(gamesQuery());
  const { data: totals } = useLiveQuery(gameTotalsQuery());

  if (games.length === 0) {
    return (
      <Screen>
        <EmptyState emoji="🗺️" title={t('history.empty')}>
          {t('history.emptyHint')}
        </EmptyState>
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="gap-2">
        {games.map((game) => {
          const standings = totals
            .filter((row) => row.gameId === game.id)
            .sort((a, b) => b.total - a.total);
          const winner = standings[0];
          const statusKey = STATUS_KEYS[game.status];

          return (
            <Link
              key={game.id}
              href={{ pathname: '/history/[id]', params: { id: String(game.id) } }}
              asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('history.gameOf', {
                  date: formatDate(game.createdAt, language),
                })}
                testID={`history-${game.id}`}
                className="min-h-touch flex-row items-center gap-3 rounded-card bg-surface-raised p-3 active:opacity-70">
                <View className="flex-1 gap-0.5">
                  <View className="flex-row items-center gap-2">
                    <Text className="font-semi text-body text-content">
                      {formatDate(game.createdAt, language)}
                    </Text>
                    {statusKey && (
                      <Text className="font-body text-micro text-content-muted">
                        · {t(statusKey)}
                      </Text>
                    )}
                  </View>
                  <Text className="font-body text-caption text-content-muted" numberOfLines={1}>
                    {t('history.players', { count: standings.length })}
                    {winner ? ` · ${winner.emoji ?? ''} ${winner.name}` : ''}
                  </Text>
                </View>
                {winner && (
                  <Text className="font-display text-h2 tabular-nums text-primary">
                    {winner.total}
                  </Text>
                )}
              </Pressable>
            </Link>
          );
        })}
      </View>
    </Screen>
  );
}
