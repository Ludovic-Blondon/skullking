import { router, useLocalSearchParams } from 'expo-router';
import { Alert, ScrollView, Text, View } from 'react-native';

import { reopenRound } from '@/db/repositories/game-repo';
import { ScoreGrid } from '@/features/game/score-grid';
import { useGame } from '@/features/game/use-game';

/**
 * Feuille de score de la partie en cours (PLAN.md §7.2). Taper une manche la
 * rouvre pour correction — le recalcul en cascade est assuré par le moteur.
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
      <ScoreGrid
        seats={seats}
        state={state}
        storedRounds={storedRounds}
        onPressRound={correctRound}
      />

      <Text className="pt-4 font-body text-micro text-content-muted">
        Touchez une manche pour la corriger : les totaux suivants se recalculent tout seuls.
      </Text>
    </ScrollView>
  );
}
