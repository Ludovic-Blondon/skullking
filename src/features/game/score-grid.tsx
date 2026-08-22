import { Pressable, ScrollView, View } from 'react-native';
import { DENSE_MAX_SCALE, Text } from '@/ui/text';

import type { GameState } from '@/core';
import type { StoredRound } from '@/db/mappers';
import { ordinalSuffix, useLanguage, useT } from '@/i18n';
import { PLAYER_COLORS } from '@/ui/tokens';

import type { SeatedPlayer } from './use-game';

const ROUND_COLUMN = 32;
const SCORE_COLUMN = 58;

type ScoreGridProps = {
  seats: SeatedPlayer[];
  state: GameState;
  storedRounds: StoredRound[];
  /** Rend chaque ligne touchable — la correction d'une manche passée (§7.2). */
  onPressRound?: (roundNumber: number) => void;
};

/**
 * Feuille de score façon carnet papier (PLAN.md §7.2) : une colonne par joueur,
 * une ligne par manche, le cumul et le rang en bas.
 *
 * Partagée par la feuille d'une partie en cours et par le détail d'une partie
 * de l'historique : la même grille, lue à deux moments différents.
 */
export function ScoreGrid({ seats, state, storedRounds, onPressRound }: ScoreGridProps) {
  const t = useT();
  const language = useLanguage();
  return (
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
            const played = stored?.entries.every((entry) => entry.tricks !== null) ?? false;
            return (
              <Pressable
                key={result.roundNumber}
                onPress={() => onPressRound?.(result.roundNumber)}
                disabled={!onPressRound}
                accessibilityRole={onPressRound ? 'button' : undefined}
                accessibilityLabel={
                  onPressRound ? t('sheet.correctRound', { round: result.roundNumber }) : undefined
                }
                className="flex-row items-center active:opacity-60">
                <Text
                  style={{ width: ROUND_COLUMN }}
                  className="font-semi text-micro text-content-muted">
                  {result.roundNumber}
                  {stored?.round.forced ? ' !' : ''}
                </Text>
                {seats.map((seat) => {
                  const score = result.scores.find((s) => s.playerId === String(seat.id));
                  return (
                    <View key={seat.id} style={{ width: SCORE_COLUMN }} className="px-0.5">
                      <View className="items-center rounded-tile bg-surface-raised py-1.5">
                        <Text
                          maxFontSizeMultiplier={DENSE_MAX_SCALE}
                          className={`font-semi text-caption tabular-nums ${
                            !played || !score
                              ? 'text-content-muted'
                              : score.total > 0
                                ? 'text-positive'
                                : score.total < 0
                                  ? 'text-negative'
                                  : 'text-content'
                          }`}>
                          {!played || !score ? '–' : `${score.total > 0 ? '+' : ''}${score.total}`}
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
                <Text
                  maxFontSizeMultiplier={DENSE_MAX_SCALE}
                  className="font-display text-h2 tabular-nums text-content">
                  {standing?.total ?? 0}
                </Text>
                <Text className="font-body text-micro text-content-muted">
                  {standing ? `${standing.rank}${ordinalSuffix(language, standing.rank)}` : ''}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}
