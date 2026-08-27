import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/ui/text';

import { deleteGame, reopenRound } from '@/db/repositories/game-repo';
import { bonusLabel } from '@/features/game/bonus-labels';
import { ScoreGrid } from '@/features/game/score-grid';
import { useGame } from '@/features/game/use-game';
import { dateLocale, useLanguage, useT } from '@/i18n';
import { Avatar } from '@/ui/avatar';
import { SectionLabel, CONTENT_MAX_WIDTH } from '@/ui/screen';

const STATUS_KEYS = {
  in_progress: 'history.statusInProgress',
  abandoned: 'history.statusAbandoned',
  finished: 'history.statusFinished',
} as const;

/**
 * Détail d'une partie de l'historique (PLAN.md §7.4) : feuille de score
 * complète, bonus manche par manche, correction possible même après coup,
 * suppression.
 */
export default function GameHistoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gameId = Number(id);
  const { ready, game, seats, state, storedRounds, settled, pendingRound } = useGame(gameId);
  const t = useT();
  const language = useLanguage();

  if (!ready || !game || !state) {
    return <View className="flex-1 bg-surface" />;
  }

  // Le classement acquis, pas l'aperçu : une partie abandonnée en pleine
  // manche n'a pas de vainqueur désigné par des plis jamais posés.
  const winner = settled.standings[0];
  const date = new Date(game.createdAt).toLocaleDateString(dateLocale(language), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const seatOf = (playerId: number) => seats.find((seat) => seat.id === playerId);

  function correctRound(roundNumber: number) {
    Alert.alert(t('sheet.correctTitle', { round: roundNumber }), t('sheet.correctBodyHistory'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('sheet.correct'),
        style: 'destructive',
        onPress: () => {
          void reopenRound(gameId, roundNumber).then(() =>
            router.replace({ pathname: '/game/[id]', params: { id } }),
          );
        },
      },
    ]);
  }

  function askDelete() {
    Alert.alert(t('history.deleteTitle'), t('history.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => void deleteGame(gameId).then(() => router.back()),
      },
    ]);
  }

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="mx-auto w-full gap-3 p-4 pb-8"
      contentContainerStyle={{ maxWidth: CONTENT_MAX_WIDTH }}
      contentInsetAdjustmentBehavior="automatic">
      <View className="gap-1 rounded-card bg-surface-raised p-4">
        <Text className="font-body text-micro uppercase tracking-widest text-content-muted">
          {t(STATUS_KEYS[game.status])}
        </Text>
        <Text className="font-title text-h1 text-content">{date}</Text>
        {winner && (
          <View className="flex-row items-center gap-2 pt-1">
            <Avatar
              emoji={seatOf(Number(winner.playerId))?.emoji}
              color={seatOf(Number(winner.playerId))?.color}
              size="sm"
            />
            <Text className="flex-1 font-body text-caption text-content-muted">
              {t(state.tie ? 'history.tied' : 'history.winner')}
              <Text className="font-semi text-content">
                {state.leaders
                  .map((playerId) => seatOf(Number(playerId))?.name ?? playerId)
                  .join(', ')}
              </Text>
              {t('history.points', { total: winner.total })}
            </Text>
          </View>
        )}
      </View>

      <ScoreGrid
        seats={seats}
        state={state}
        storedRounds={storedRounds}
        standings={settled.standings}
        pendingRound={pendingRound}
        onPressRound={correctRound}
      />
      <Text className="font-body text-micro text-content-muted">{t('sheet.hintHistory')}</Text>

      <SectionLabel>{t('history.bonuses')}</SectionLabel>
      {storedRounds.every((stored) => stored.bonusEvents.length === 0) ? (
        <Text className="font-body text-caption text-content-muted">{t('history.noBonus')}</Text>
      ) : (
        <View className="gap-2">
          {storedRounds.map((stored) =>
            stored.bonusEvents.length === 0 ? null : (
              <View key={stored.round.id} className="gap-1 rounded-field bg-surface-raised p-3">
                <Text className="font-semi text-caption text-content">
                  {t('history.roundLabel', { round: stored.round.roundNumber })}
                </Text>
                {stored.bonusEvents.map((event) => {
                  const { emoji, key } = bonusLabel(event.type);
                  const ally = event.allyPlayerId ? seatOf(event.allyPlayerId) : undefined;
                  return (
                    <Text key={event.id} className="font-body text-micro text-content-muted">
                      {emoji} {t(key)}
                      {ally ? t('history.withAlly', { name: ally.name }) : ''}
                      {event.count > 1 ? t('history.times', { count: event.count }) : ''} —{' '}
                      {seatOf(event.playerId)?.name ?? event.playerId}
                    </Text>
                  );
                })}
              </View>
            ),
          )}
        </View>
      )}

      <Pressable
        onPress={askDelete}
        accessibilityRole="button"
        accessibilityLabel={t('history.deleteGame')}
        className="mt-2 min-h-touch items-center justify-center p-3 active:opacity-70">
        <Text className="font-semi text-caption text-negative">{t('history.deleteGame')}</Text>
      </Pressable>
    </ScrollView>
  );
}
