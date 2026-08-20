import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { createGame, addTiebreakRound } from '@/db/repositories/game-repo';
import { useGame } from '@/features/game/use-game';
import { computeAwards } from '@/features/stats/awards';
import { Avatar } from '@/ui/avatar';
import { Screen, SectionLabel, Watermark } from '@/ui/screen';

/**
 * Marches du podium, dans l'ordre d'affichage : deuxième, premier, troisième.
 *
 * On prend les joueurs par **position au classement**, pas par rang : deux ex
 * æquo partagent le rang 2, et chercher un rang 3 ferait disparaître l'un
 * d'eux du podium.
 */
const STEPS = [
  { index: 1, height: 44 },
  { index: 0, height: 72 },
  { index: 2, height: 30 },
];

export default function GameEndScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gameId = Number(id);
  const view = useGame(gameId);

  if (!view.ready || !view.state || !view.game) return <View className="flex-1 bg-surface" />;

  const { state, seats, game } = view;
  const seatOf = (playerId: string) => seats.find((seat) => String(seat.id) === playerId);
  const nameOf = (playerId: string) => seatOf(playerId)?.name ?? playerId;
  const awards = computeAwards(state.rounds, view.inputs);

  async function rematch() {
    const newGameId = await createGame(
      seats.map((seat) => seat.id),
      game.ruleset,
    );
    router.replace({ pathname: '/game/[id]', params: { id: String(newGameId) } });
  }

  async function tiebreak() {
    await addTiebreakRound(gameId);
    router.replace({ pathname: '/game/[id]', params: { id } });
  }

  return (
    <View className="flex-1 bg-surface">
      <Watermark emoji="🏆" size={200} />
      <Screen edgeToEdgeBottom transparent>
        {state.tie ? (
          <View className="gap-3 rounded-card border-[1.5px] border-accent bg-accent/10 p-4">
            <Text className="font-title text-h1 text-content">
              Égalité à {state.standings[0]?.total ?? 0} points
            </Text>
            <Text className="font-body text-body text-content-muted">
              {state.leaders.map(nameOf).join(' et ')} terminent au coude à coude. Le livret prévoit
              une manche supplémentaire pour les départager.
            </Text>
            <Pressable
              onPress={() => void tiebreak()}
              className="min-h-touch items-center justify-center rounded-card bg-accent p-3 active:opacity-80">
              <Text className="font-title text-h2 text-accent-fg">Jouer la manche décisive</Text>
            </Pressable>
          </View>
        ) : (
          <View className="gap-4 rounded-card bg-surface-raised p-4">
            <Text className="text-center font-title text-h1 text-content">Partie terminée</Text>
            <View className="flex-row items-end justify-center gap-3">
              {STEPS.map(({ index, height }) => {
                const standing = state.standings[index];
                if (!standing) return null;
                const seat = seatOf(standing.playerId);
                const first = index === 0;
                return (
                  <View key={standing.playerId} className="items-center gap-1.5">
                    <Avatar emoji={seat?.emoji} color={seat?.color} size={first ? 'md' : 'sm'} />
                    <Text
                      className={`font-display tabular-nums ${
                        first ? 'text-h2 text-content' : 'text-caption text-content-muted'
                      }`}>
                      {standing.total}
                    </Text>
                    <View
                      style={{ height, width: first ? 56 : 48 }}
                      className={`rounded-t-field ${first ? 'bg-primary' : 'bg-border'}`}
                    />
                    <Text
                      className={`font-semi text-micro ${
                        first ? 'text-content' : 'text-content-muted'
                      }`}
                      numberOfLines={1}>
                      {nameOf(standing.playerId)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {awards.length > 0 && (
          <>
            <SectionLabel>Palmarès</SectionLabel>
            <View className="flex-row flex-wrap gap-2">
              {awards.map((award) => (
                <View
                  key={award.id}
                  className="flex-1 basis-[45%] items-center gap-0.5 rounded-field bg-surface-raised p-3">
                  <Text className="text-xl">{award.emoji}</Text>
                  <Text className="text-center font-semi text-caption text-content">
                    {award.label}
                  </Text>
                  <Text
                    className="text-center font-body text-micro text-content-muted"
                    numberOfLines={1}>
                    {award.playerIds.map(nameOf).join(' & ')}
                  </Text>
                  <Text className="text-center font-body text-micro text-content-muted">
                    {award.detail}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        <SectionLabel>Classement</SectionLabel>
        <View className="gap-2">
          {state.standings.map((standing) => {
            const seat = seatOf(standing.playerId);
            return (
              <View
                key={standing.playerId}
                className="flex-row items-center gap-3 rounded-field bg-surface-raised p-3">
                <Text className="w-5 text-center font-title text-caption text-content-muted">
                  {standing.rank}
                </Text>
                <Avatar emoji={seat?.emoji} color={seat?.color} size="sm" />
                <Text className="flex-1 font-semi text-body text-content">
                  {nameOf(standing.playerId)}
                </Text>
                <Text className="font-display text-h2 tabular-nums text-content">
                  {standing.total}
                </Text>
              </View>
            );
          })}
        </View>

        <View className="mt-1 flex-row gap-2.5">
          <Pressable
            onPress={() => void rematch()}
            accessibilityRole="button"
            accessibilityLabel="Revanche"
            testID="rematch"
            className="min-h-touch flex-1 items-center justify-center rounded-card bg-primary p-3.5 active:opacity-80">
            <Text className="font-title text-h2 text-primary-fg">Revanche</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: '/game/[id]/scoresheet', params: { id } })}
            accessibilityRole="button"
            accessibilityLabel="Voir la feuille de score"
            className="min-h-touch flex-1 items-center justify-center rounded-card bg-surface-raised p-3.5 active:opacity-70">
            <Text className="font-title text-h2 text-content">Détail</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => router.replace('/')}
          className="min-h-touch items-center justify-center active:opacity-70">
          <Text className="font-body text-caption text-content-muted">Retour à l&apos;accueil</Text>
        </Pressable>
      </Screen>
    </View>
  );
}
