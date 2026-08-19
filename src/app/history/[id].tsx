import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { deleteGame, reopenRound } from '@/db/repositories/game-repo';
import { bonusLabel } from '@/features/game/bonus-labels';
import { ScoreGrid } from '@/features/game/score-grid';
import { useGame } from '@/features/game/use-game';
import { Avatar } from '@/ui/avatar';
import { SectionLabel } from '@/ui/screen';

const STATUS_LABELS = {
  in_progress: 'Partie en cours',
  abandoned: 'Partie abandonnée',
  finished: 'Partie terminée',
} as const;

/**
 * Détail d'une partie de l'historique (PLAN.md §7.4) : feuille de score
 * complète, bonus manche par manche, correction possible même après coup,
 * suppression.
 */
export default function GameHistoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gameId = Number(id);
  const { ready, game, seats, state, storedRounds } = useGame(gameId);

  if (!ready || !game || !state) {
    return <View className="flex-1 bg-surface" />;
  }

  const winner = state.standings[0];
  const date = new Date(game.createdAt).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const seatOf = (playerId: number) => seats.find((seat) => seat.id === playerId);

  function correctRound(roundNumber: number) {
    Alert.alert(
      `Corriger la manche ${roundNumber} ?`,
      'La partie est rouverte à cette manche et tous les totaux suivants sont recalculés.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Corriger',
          style: 'destructive',
          onPress: () => {
            void reopenRound(gameId, roundNumber).then(() =>
              router.replace({ pathname: '/game/[id]', params: { id } }),
            );
          },
        },
      ],
    );
  }

  function askDelete() {
    Alert.alert(
      'Supprimer cette partie ?',
      'Ses manches, ses bonus et ses scores disparaissent définitivement. Les joueurs, eux, sont conservés.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => void deleteGame(gameId).then(() => router.back()),
        },
      ],
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="gap-3 p-4 pb-8"
      contentInsetAdjustmentBehavior="automatic">
      <View className="gap-1 rounded-card bg-surface-raised p-4">
        <Text className="font-body text-micro uppercase tracking-widest text-content-muted">
          {STATUS_LABELS[game.status]}
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
              {state.tie ? 'À égalité en tête : ' : 'Vainqueur : '}
              <Text className="font-semi text-content">
                {state.leaders
                  .map((playerId) => seatOf(Number(playerId))?.name ?? playerId)
                  .join(', ')}
              </Text>{' '}
              — {winner.total} points
            </Text>
          </View>
        )}
      </View>

      <ScoreGrid
        seats={seats}
        state={state}
        storedRounds={storedRounds}
        onPressRound={correctRound}
      />
      <Text className="font-body text-micro text-content-muted">
        Touchez une manche pour la corriger : la partie rouvre à cette manche et les totaux suivants
        se recalculent.
      </Text>

      <SectionLabel>Bonus</SectionLabel>
      {storedRounds.every((stored) => stored.bonusEvents.length === 0) ? (
        <Text className="font-body text-caption text-content-muted">
          Aucun bonus sur cette partie.
        </Text>
      ) : (
        <View className="gap-2">
          {storedRounds.map((stored) =>
            stored.bonusEvents.length === 0 ? null : (
              <View key={stored.round.id} className="gap-1 rounded-field bg-surface-raised p-3">
                <Text className="font-semi text-caption text-content">
                  Manche {stored.round.roundNumber}
                </Text>
                {stored.bonusEvents.map((event) => {
                  const { emoji, label } = bonusLabel(event.type);
                  const ally = event.allyPlayerId ? seatOf(event.allyPlayerId) : undefined;
                  return (
                    <Text key={event.id} className="font-body text-micro text-content-muted">
                      {emoji} {label}
                      {ally ? ` avec ${ally.name}` : ''}
                      {event.count > 1 ? ` ×${event.count}` : ''} —{' '}
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
        accessibilityLabel="Supprimer cette partie"
        className="mt-2 min-h-touch items-center justify-center p-3 active:opacity-70">
        <Text className="font-semi text-caption text-negative">Supprimer cette partie</Text>
      </Pressable>
    </ScrollView>
  );
}
