import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { createGame, addTiebreakRound } from '@/db/repositories/game-repo';
import { useGame } from '@/features/game/use-game';
import { Screen } from '@/ui/screen';
import { useTokens } from '@/ui/use-tokens';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function GameEndScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gameId = Number(id);
  const view = useGame(gameId);
  const t = useTokens();

  if (!view.ready || !view.state || !view.game) return <View className="flex-1 bg-surface" />;

  const { state, seats, game } = view;
  const nameOf = (playerId: string) =>
    seats.find((seat) => String(seat.id) === playerId)?.name ?? playerId;
  const emojiOf = (playerId: string) =>
    seats.find((seat) => String(seat.id) === playerId)?.emoji ?? '🏴‍☠️';

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
    <Screen edgeToEdgeBottom>
      {state.tie ? (
        <View className="gap-3 rounded-card border border-accent bg-accent/10 p-4">
          <Text className="text-xl font-bold text-content">
            Égalité à {state.standings[0]?.total ?? 0} points
          </Text>
          <Text className="text-base text-content-muted">
            {state.leaders.map(nameOf).join(' et ')} terminent au coude à coude. Le livret prévoit
            une manche supplémentaire pour les départager.
          </Text>
          <Pressable
            onPress={() => void tiebreak()}
            className="min-h-touch items-center justify-center rounded-card bg-accent p-3 active:opacity-80">
            <Text className="text-base font-semibold text-accent-fg">Jouer la manche décisive</Text>
          </Pressable>
        </View>
      ) : (
        <View className="items-center gap-1 rounded-card border border-border bg-surface-raised p-6">
          <Text className="text-5xl">{emojiOf(state.leaders[0] ?? '')}</Text>
          <Text className="text-2xl font-bold text-content">{nameOf(state.leaders[0] ?? '')}</Text>
          <Text className="text-base text-content-muted">
            l&apos;emporte avec {state.standings[0]?.total ?? 0} points
          </Text>
        </View>
      )}

      <View className="gap-2">
        {state.standings.map((standing, index) => (
          <View
            key={standing.playerId}
            className="flex-row items-center gap-3 rounded-card border border-border bg-surface-raised p-3">
            <Text className="w-8 text-center text-xl">{MEDALS[index] ?? `${standing.rank}ᵉ`}</Text>
            <Text className="text-2xl">{emojiOf(standing.playerId)}</Text>
            <Text className="flex-1 text-base font-semibold text-content">
              {nameOf(standing.playerId)}
            </Text>
            <Text className="text-lg font-bold tabular-nums text-content">{standing.total}</Text>
          </View>
        ))}
      </View>

      <Link href={{ pathname: '/game/[id]/scoresheet', params: { id } }} asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voir la feuille de score"
          className="min-h-touch flex-row items-center justify-center gap-2 rounded-card border border-border bg-surface-raised p-3 active:opacity-70">
          <Ionicons name="list-outline" size={20} color={t.content} />
          <Text className="text-base font-semibold text-content">Voir la feuille de score</Text>
        </Pressable>
      </Link>

      <Pressable
        onPress={() => void rematch()}
        accessibilityRole="button"
        accessibilityLabel="Revanche"
        testID="rematch"
        className="min-h-touch flex-row items-center justify-center gap-2 rounded-card bg-primary p-4 active:opacity-80">
        <Ionicons name="refresh" size={20} color={t.primaryFg} />
        <Text className="text-lg font-semibold text-primary-fg">Revanche</Text>
      </Pressable>

      <Pressable
        onPress={() => router.replace('/')}
        className="min-h-touch items-center justify-center p-2 active:opacity-70">
        <Text className="text-base font-semibold text-content-muted">Retour à l&apos;accueil</Text>
      </Pressable>
    </Screen>
  );
}
