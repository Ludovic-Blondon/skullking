import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { reopenRound } from '@/db/repositories/game-repo';
import { useGame } from '@/features/game/use-game';
import { PLAYER_COLORS } from '@/ui/tokens';

const ROUND_COLUMN = 32;
const SCORE_COLUMN = 58;

/**
 * Feuille de score façon carnet papier (PLAN.md §7.2) : une colonne par joueur,
 * une ligne par manche, le cumul en bas. Taper une ligne rouvre la manche pour
 * correction — le recalcul en cascade est assuré par le moteur.
 */
export default function ScoreSheetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gameId = Number(id);
  const { ready, seats, state, storedRounds } = useGame(gameId);

  if (!ready || !state) {
    return <View className="flex-1 bg-surface" />;
  }

  function correctRound(roundNumber: number) {
    Alert.alert(
      `Corriger la manche ${roundNumber} ?`,
      'La partie revient à cette manche et tous les totaux suivants sont recalculés.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Corriger',
          style: 'destructive',
          onPress: () => {
            void reopenRound(gameId, roundNumber).then(() => router.back());
          },
        },
      ],
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="p-4"
      contentInsetAdjustmentBehavior="automatic">
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerClassName="grow">
        <View>
          <View className="flex-row pb-2">
            <View style={{ width: ROUND_COLUMN }} />
            {seats.map((seat, index) => (
              <View key={seat.id} style={{ width: SCORE_COLUMN }} className="items-center gap-0.5">
                <Text className="text-base">{seat.emoji ?? '🏴‍☠️'}</Text>
                <Text
                  numberOfLines={1}
                  className="font-semi text-micro"
                  style={{ color: seat.color ?? PLAYER_COLORS[index % PLAYER_COLORS.length] }}>
                  {seat.name}
                </Text>
              </View>
            ))}
          </View>

          <View className="gap-1 pb-2">
            {state.rounds.map((result, index) => {
              const stored = storedRounds[index];
              const played = stored.entries.every((entry) => entry.tricks !== null);
              return (
                <Pressable
                  key={result.roundNumber}
                  onPress={() => correctRound(result.roundNumber)}
                  accessibilityRole="button"
                  accessibilityLabel={`Corriger la manche ${result.roundNumber}`}
                  className="flex-row items-center active:opacity-60">
                  <Text
                    style={{ width: ROUND_COLUMN }}
                    className="font-semi text-micro text-content-muted">
                    {result.roundNumber}
                    {stored.round.forced ? ' !' : ''}
                  </Text>
                  {seats.map((seat) => {
                    const score = result.scores.find((s) => s.playerId === String(seat.id));
                    return (
                      <View key={seat.id} style={{ width: SCORE_COLUMN }} className="px-0.5">
                        <View className="items-center rounded-tile bg-surface-raised py-1.5">
                          <Text
                            className={`font-semi text-caption tabular-nums ${
                              !played || !score
                                ? 'text-content-muted'
                                : score.total > 0
                                  ? 'text-positive'
                                  : score.total < 0
                                    ? 'text-negative'
                                    : 'text-content'
                            }`}>
                            {!played || !score
                              ? '–'
                              : `${score.total > 0 ? '+' : ''}${score.total}`}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </Pressable>
              );
            })}
          </View>

          <View className="flex-row items-start border-t border-border pt-2">
            <View style={{ width: ROUND_COLUMN }} />
            {seats.map((seat) => {
              const standing = state.standings.find((s) => s.playerId === String(seat.id));
              return (
                <View key={seat.id} style={{ width: SCORE_COLUMN }} className="items-center">
                  <Text className="font-display text-h2 tabular-nums text-content">
                    {standing?.total ?? 0}
                  </Text>
                  <Text className="font-body text-micro text-content-muted">{standing?.rank}ᵉ</Text>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <Text className="pt-4 font-body text-micro text-content-muted">
        Touchez une manche pour la corriger : les totaux suivants se recalculent tout seuls.
      </Text>
    </ScrollView>
  );
}
