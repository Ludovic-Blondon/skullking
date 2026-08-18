import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { reopenRound } from '@/db/repositories/game-repo';
import { useGame } from '@/features/game/use-game';

const NAME_COLUMN = 128;
const SCORE_COLUMN = 72;

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
    <ScrollView className="flex-1 bg-surface" contentContainerClassName="p-4">
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerClassName="grow">
        <View>
          <View className="flex-row border-b border-border-strong pb-2">
            <Text
              style={{ width: NAME_COLUMN }}
              className="text-sm font-semibold text-content-muted">
              Manche
            </Text>
            {seats.map((seat) => (
              <Text
                key={seat.id}
                style={{ width: SCORE_COLUMN }}
                numberOfLines={1}
                className="text-center text-sm font-semibold text-content">
                {seat.emoji} {seat.name}
              </Text>
            ))}
          </View>

          {state.rounds.map((result, index) => {
            const stored = storedRounds[index];
            const played = stored.entries.every((entry) => entry.tricks !== null);
            return (
              <Pressable
                key={result.roundNumber}
                onPress={() => correctRound(result.roundNumber)}
                accessibilityRole="button"
                accessibilityLabel={`Corriger la manche ${result.roundNumber}`}
                className="flex-row items-center border-b border-border py-2 active:opacity-60">
                <View style={{ width: NAME_COLUMN }} className="flex-row items-baseline gap-2">
                  <Text className="text-base font-semibold text-content">{result.roundNumber}</Text>
                  <Text className="text-xs text-content-muted">
                    {result.cardsDealt} c.
                    {stored.round.forced ? ' · forcée' : ''}
                  </Text>
                </View>
                {seats.map((seat) => {
                  const score = result.scores.find((s) => s.playerId === String(seat.id));
                  if (!played || !score) {
                    return (
                      <Text
                        key={seat.id}
                        style={{ width: SCORE_COLUMN }}
                        className="text-center text-base text-content-muted">
                        –
                      </Text>
                    );
                  }
                  return (
                    <View key={seat.id} style={{ width: SCORE_COLUMN }} className="items-center">
                      <Text
                        className={`text-base font-semibold tabular-nums ${
                          score.total >= 0 ? 'text-positive' : 'text-negative'
                        }`}>
                        {score.total > 0 ? '+' : ''}
                        {score.total}
                      </Text>
                      <Text className="text-xs tabular-nums text-content-muted">
                        {result.cumulative[String(seat.id)]}
                      </Text>
                    </View>
                  );
                })}
              </Pressable>
            );
          })}

          <View className="mt-2 flex-row border-t-2 border-border-strong pt-2">
            <Text style={{ width: NAME_COLUMN }} className="text-base font-bold text-content">
              Total
            </Text>
            {seats.map((seat) => {
              const standing = state.standings.find((s) => s.playerId === String(seat.id));
              return (
                <View key={seat.id} style={{ width: SCORE_COLUMN }} className="items-center">
                  <Text className="text-lg font-bold tabular-nums text-content">
                    {standing?.total ?? 0}
                  </Text>
                  <Text className="text-xs text-content-muted">{standing?.rank}ᵉ</Text>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <Text className="pt-4 text-sm text-content-muted">
        Touchez une manche pour la corriger : les totaux suivants se recalculent tout seuls.
      </Text>
    </ScrollView>
  );
}
