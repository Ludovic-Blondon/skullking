import { router, useLocalSearchParams } from 'expo-router';
import { Alert, ScrollView, View } from 'react-native';
import { Text } from '@/ui/text';

import { reopenRound } from '@/db/repositories/game-repo';
import { ScoreGrid } from '@/features/game/score-grid';
import { useGame } from '@/features/game/use-game';
import { useT } from '@/i18n';
import { CONTENT_MAX_WIDTH } from '@/ui/screen';

/**
 * Feuille de score de la partie en cours (PLAN.md §7.2). Taper une manche la
 * rouvre pour correction — le recalcul en cascade est assuré par le moteur.
 */
export default function ScoreSheetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gameId = Number(id);
  const { ready, seats, state, storedRounds } = useGame(gameId);
  const t = useT();

  if (!ready || !state) {
    return <View className="flex-1 bg-surface" />;
  }

  function correctRound(roundNumber: number) {
    Alert.alert(t('sheet.correctTitle', { round: roundNumber }), t('sheet.correctBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('sheet.correct'),
        style: 'destructive',
        onPress: () => {
          void reopenRound(gameId, roundNumber).then(() => router.back());
        },
      },
    ]);
  }

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="mx-auto w-full p-4"
      contentContainerStyle={{ maxWidth: CONTENT_MAX_WIDTH }}
      contentInsetAdjustmentBehavior="automatic">
      <ScoreGrid
        seats={seats}
        state={state}
        storedRounds={storedRounds}
        onPressRound={correctRound}
      />

      <Text className="pt-4 font-body text-micro text-content-muted">{t('sheet.hint')}</Text>
    </ScrollView>
  );
}
