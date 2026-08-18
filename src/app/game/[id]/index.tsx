import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Link, Redirect, Stack, router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { hasBlockingIssues, scoreRound } from '@/core';
import { allBidsPlaced, allTricksPlaced } from '@/db/mappers';
import {
  setDestroyedTricks,
  setPhase,
  updateEntry,
  validateRound as validateRoundInDb,
} from '@/db/repositories/game-repo';
import { firstBlockingIssue, issueMessage } from '@/features/game/issue-messages';
import { PlayerRow } from '@/features/game/player-row';
import { useGame } from '@/features/game/use-game';
import { ValidationBar } from '@/features/game/validation-bar';
import { useTokens } from '@/ui/use-tokens';

export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gameId = Number(id);
  const view = useGame(gameId);
  const insets = useSafeAreaInsets();
  const t = useTokens();

  if (!view.ready || !view.game || !view.current) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator />
      </View>
    );
  }

  const { game, seats, current, state } = view;
  const { round } = current.stored;
  const { cardsDealt } = round;
  const totalRounds = game.ruleset.roundsPlan.length;
  const bidding = game.currentPhase === 'bidding';

  if (game.status === 'finished') {
    return <Redirect href={{ pathname: '/game/[id]/end', params: { id } }} />;
  }

  const entryOf = (playerId: number) =>
    current.stored.entries.find((entry) => entry.playerId === playerId);

  const bidsTotal = current.stored.entries.reduce((sum, entry) => sum + (entry.bid ?? 0), 0);
  const tricksTotal = current.stored.entries.reduce((sum, entry) => sum + (entry.tricks ?? 0), 0);
  const accounted = tricksTotal + round.destroyedTricks;
  const ghostTricks = seats.length === 2 ? Math.max(0, cardsDealt - accounted) : 0;

  const scores = scoreRound(current.input, game.ruleset);
  const scoreOf = (playerId: number) => scores.find((s) => s.playerId === String(playerId));

  const bidsReady = allBidsPlaced(current.stored);
  const tricksReady = allTricksPlaced(current.stored);
  // La cohérence de la manche est jugée par le moteur, pas refaite ici : il
  // connaît le Kraken, le fantôme à 2 joueurs et l'unicité des bonus (§4.4).
  const blocking = firstBlockingIssue(view.issues);
  const roundOk = tricksReady && !hasBlockingIssues(view.issues);

  async function launchRound() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await setPhase(gameId, 'results');
  }

  async function confirmRound(forced = false) {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const { finished } = await validateRoundInDb(gameId, round.roundNumber, { forced });
    if (finished) {
      router.replace({ pathname: '/game/[id]/end', params: { id } });
    }
  }

  return (
    <View className="flex-1 bg-surface">
      <Stack.Screen
        options={{
          title: `Manche ${round.roundNumber} / ${totalRounds}`,
          headerRight: () => (
            <Link href={{ pathname: '/game/[id]/scoresheet', params: { id } }} asChild>
              <Pressable hitSlop={12} className="pr-1" accessibilityLabel="Feuille de score">
                <Ionicons name="list-outline" size={22} color={t.content} />
              </Pressable>
            </Link>
          ),
        }}
      />

      <ScrollView contentContainerClassName="gap-3 p-4" contentInsetAdjustmentBehavior="automatic">
        <View className="flex-row items-center justify-between rounded-card border border-border bg-surface-sunken px-4 py-3">
          <Text className="text-base font-semibold text-content">
            {cardsDealt} carte{cardsDealt > 1 ? 's' : ''} par joueur
          </Text>
          {view.dealer && (
            <Text className="text-sm text-content-muted">Donne : {view.dealer.name}</Text>
          )}
        </View>

        {seats.map((player) => {
          const entry = entryOf(player.id);
          const score = scoreOf(player.id);
          const total = state?.totals[String(player.id)] ?? 0;

          return bidding ? (
            <PlayerRow
              key={player.id}
              player={player}
              value={entry?.bid ?? null}
              onChange={(bid) => void updateEntry(round.id, player.id, { bid })}
              max={cardsDealt}
              label="Annonce"
              testID={`bid-${player.id}`}
              subtitle={<Text className="text-sm text-content-muted">{total} pts</Text>}
            />
          ) : (
            <PlayerRow
              key={player.id}
              player={player}
              value={entry?.tricks ?? null}
              onChange={(tricks) => void updateEntry(round.id, player.id, { tricks })}
              max={cardsDealt}
              label="Plis"
              testID={`tricks-${player.id}`}
              subtitle={
                <Text className="text-sm text-content-muted">
                  Annonce {entry?.bid ?? 0} · {total} pts
                </Text>
              }
              trailing={
                <Link
                  href={{
                    pathname: '/game/[id]/bonus/[playerId]',
                    params: { id, playerId: String(player.id) },
                  }}
                  asChild>
                  <Pressable
                    accessibilityLabel={`Bonus de ${player.name}`}
                    className={`min-h-touch min-w-touch items-center justify-center rounded-card border px-2 active:opacity-70 ${
                      score && score.bonus > 0
                        ? 'border-accent bg-accent/10'
                        : 'border-border bg-surface-sunken'
                    }`}>
                    {score && score.bonus > 0 ? (
                      <Text className="text-base font-bold text-accent">+{score.bonus}</Text>
                    ) : (
                      <Ionicons name="sparkles-outline" size={20} color={t.contentMuted} />
                    )}
                  </Pressable>
                </Link>
              }
            />
          );
        })}

        {!bidding && game.ruleset.advancedCards && (
          <PlayerRow
            player={{
              id: -1,
              name: 'Pli détruit',
              emoji: '🐙',
              color: null,
              seatIndex: -1,
            }}
            value={round.destroyedTricks}
            onChange={(count) => void setDestroyedTricks(round.id, count)}
            max={2}
            label="Plis détruits"
            subtitle={<Text className="text-sm text-content-muted">Kraken ou Baleine blanche</Text>}
          />
        )}

        {!bidding && seats.length === 2 && (
          <View className="flex-row items-center gap-3 rounded-card border border-dashed border-border bg-surface-sunken p-3">
            <Text className="text-2xl">👻</Text>
            <View className="flex-1">
              <Text className="text-base font-semibold text-content-muted">Barbe Grise</Text>
              <Text className="text-sm text-content-muted">Ne mise pas, ne marque pas</Text>
            </View>
            <Text className="text-2xl font-bold tabular-nums text-content-muted">
              {ghostTricks}
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={{ paddingBottom: insets.bottom }}>
        {bidding ? (
          <ValidationBar
            summary={`Σ annonces ${bidsTotal} pour ${cardsDealt} pli${cardsDealt > 1 ? 's' : ''}${
              bidsTotal > cardsDealt
                ? ' — table sur-annoncée'
                : bidsTotal < cardsDealt
                  ? ' — table sous-annoncée'
                  : ''
            }`}
            ok={bidsReady}
            problem={bidsReady ? undefined : 'Toutes les annonces ne sont pas posées'}
            actionLabel="Lancer la manche"
            onAction={() => void launchRound()}
          />
        ) : (
          <ValidationBar
            summary={`Σ plis ${tricksTotal}${
              round.destroyedTricks > 0 ? ` + ${round.destroyedTricks} détruit` : ''
            } = ${accounted} / ${cardsDealt}`}
            ok={roundOk}
            problem={
              !tricksReady
                ? 'Tous les plis ne sont pas saisis'
                : blocking
                  ? issueMessage(blocking)
                  : undefined
            }
            actionLabel={
              round.roundNumber >= totalRounds ? 'Terminer la partie' : 'Valider la manche'
            }
            onAction={() => void confirmRound()}
            onForce={tricksReady ? () => void confirmRound(true) : undefined}
          />
        )}
      </View>
    </View>
  );
}
