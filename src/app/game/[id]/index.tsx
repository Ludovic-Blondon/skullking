import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Link, Redirect, router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/ui/text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { hasBlockingIssues, RASCAL_POINTS, scoreRound } from '@/core';
import {
  setDestroyedTricks,
  setPhase,
  updateEntry,
  validateRound as validateRoundInDb,
} from '@/db/repositories/game-repo';
import { firstBlockingIssue, issueMessage } from '@/features/game/issue-messages';
import { PlayerRow, type PlayerRowTone } from '@/features/game/player-row';
import { useGame } from '@/features/game/use-game';
import { useKeepScreenAwake } from '@/features/settings/use-keep-awake';
import { useT } from '@/i18n';
import { ValidationBar } from '@/features/game/validation-bar';
import { Avatar } from '@/ui/avatar';
import { AnimatedNumber } from '@/ui/animated-number';
import { Pulse } from '@/ui/pulse';
import { CONTENT_MAX_WIDTH, Watermark } from '@/ui/screen';
import { Stepper } from '@/ui/stepper';
import { useTokens } from '@/ui/use-tokens';

/** Bouton d'en-tête : une icône, une cible tactile réglementaire. */
function TopAction({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  const t = useTokens();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="size-9 items-center justify-center rounded-full bg-surface-raised active:opacity-70">
      <Ionicons name={icon} size={18} color={t.content} />
    </Pressable>
  );
}

export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gameId = Number(id);
  const view = useGame(gameId);
  const insets = useSafeAreaInsets();
  const t = useT();
  useKeepScreenAwake();

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

  // La cohérence de la manche est jugée par le moteur, pas refaite ici : il
  // connaît le Kraken, le fantôme à 2 joueurs et l'unicité des bonus (§4.4).
  // Rien n'exige d'avoir touché chaque joueur : un compteur laissé à 0 est une
  // saisie comme une autre (§7.2).
  const blocking = firstBlockingIssue(view.issues);
  const roundOk = !hasBlockingIssues(view.issues);

  async function launchRound() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await setPhase(gameId, 'results');
  }

  /**
   * Retour à la phase Annonces. Une annonce mal saisie était sans recours :
   * la feuille de score ne rouvre une manche qu'en Résultats (§7.2). Rien
   * n'est détruit — les plis déjà posés restent, le moteur repasse dessus.
   */
  async function backToBids() {
    await Haptics.selectionAsync();
    await setPhase(gameId, 'bidding');
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
      <Watermark />

      <View
        style={{ paddingTop: insets.top + 6, maxWidth: CONTENT_MAX_WIDTH }}
        className="mx-auto w-full gap-2 px-5 pb-3">
        <View className="flex-row items-start justify-between gap-3">
          <Text className="flex-1 font-title text-h1 text-content">
            {t('game.round', { round: round.roundNumber, total: totalRounds })} ·{' '}
            {bidding ? t('game.cards', { count: cardsDealt }) : t('game.results')}
          </Text>
          <View className="flex-row gap-2">
            {!bidding && (
              <TopAction
                icon="arrow-undo-outline"
                label={t('game.backToBids')}
                testID="back-to-bids"
                onPress={() => void backToBids()}
              />
            )}
            <TopAction
              icon="home-outline"
              label={t('common.back')}
              onPress={() => router.replace('/')}
            />
            <TopAction
              icon="list-outline"
              label={t('game.scoresheet')}
              onPress={() => router.push({ pathname: '/game/[id]/scoresheet', params: { id } })}
            />
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          {view.dealer && <Avatar emoji={view.dealer.emoji} color={view.dealer.color} size="sm" />}
          {/* Une seule ligne de texte, qui se replie : à grande taille de
              police, deux textes côte à côte débordaient sans se couper. */}
          <Text className="flex-1 font-body text-caption text-content-muted">
            {view.dealer ? t('game.dealer', { name: view.dealer.name }) : ''}
            {game.ruleset.scoring === 'rascal'
              ? ` ${t(
                  game.ruleset.rascalCannonball ? 'game.potentialCannonball' : 'game.potential',
                  {
                    value: RASCAL_POINTS.potentialPerCard * cardsDealt,
                    cannonball: RASCAL_POINTS.cannonballPerCard * cardsDealt,
                  },
                )}`
              : ''}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerClassName="mx-auto w-full gap-2.5 px-4 pb-4"
        contentContainerStyle={{ maxWidth: CONTENT_MAX_WIDTH }}>
        {seats.map((player) => {
          const entry = entryOf(player.id);
          const score = scoreOf(player.id);
          const total = state?.totals[String(player.id)] ?? 0;
          // Bonus et ajustement manuel comptent ensemble : un ±10 posé à la main
          // doit se voir depuis la manche, pas seulement depuis sa feuille.
          const extra = score ? score.bonus + score.custom : 0;
          const played = score?.played ?? false;

          // En annonces, aucune couleur : rien n'est encore joué. En résultats,
          // le liseré ne s'allume que pour les joueurs dont les plis sont saisis.
          const tone: PlayerRowTone = bidding
            ? 'idle'
            : !played
              ? 'idle'
              : score?.exact
                ? 'exact'
                : 'missed';

          return bidding ? (
            <PlayerRow
              key={player.id}
              player={player}
              value={entry?.bid ?? 0}
              onChange={(bid) => void updateEntry(round.id, player.id, { bid })}
              max={cardsDealt}
              label={t('game.bidLabel')}
              tone={tone}
              testID={`bid-${player.id}`}
              subtitle={
                <AnimatedNumber
                  value={total}
                  className="font-body text-micro text-content-muted"
                  format={(points) => t('game.points', { points })}
                />
              }
            />
          ) : (
            <Pulse key={player.id} trigger={score?.total ?? 0}>
              <PlayerRow
                player={player}
                value={entry?.tricks ?? 0}
                onChange={(tricks) => void updateEntry(round.id, player.id, { tricks })}
                max={cardsDealt}
                label={t('game.tricksLabel')}
                tone={tone}
                testID={`tricks-${player.id}`}
                subtitle={
                  <Text className="font-body text-micro text-content-muted">
                    {t('game.announced', { bid: entry?.bid ?? 0 })}
                    {played && score
                      ? ` · ${t('game.thisRound', {
                          delta: `${score.total > 0 ? '+' : ''}${score.total}`,
                        })}`
                      : ''}
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
                      hitSlop={8}
                      accessibilityLabel={t('game.bonusOf', { name: player.name })}
                      className="min-w-9 items-end active:opacity-70">
                      <Text
                        className={`font-title text-caption ${
                          extra > 0
                            ? 'text-positive'
                            : extra < 0
                              ? 'text-negative'
                              : 'text-content-muted'
                        }`}>
                        {extra >= 0 ? '+' : ''}
                        {extra}
                      </Text>
                    </Pressable>
                  </Link>
                }
              />
            </Pulse>
          );
        })}

        {!bidding && game.ruleset.advancedCards && (
          <View className="flex-row items-center justify-between gap-3 px-1 pt-1">
            <Text className="flex-1 font-body text-caption text-content-muted">
              {t('game.destroyed')}
            </Text>
            <Stepper
              value={round.destroyedTricks}
              onChange={(count) => void setDestroyedTricks(round.id, count)}
              max={2}
              size="sm"
              label={t('game.destroyedLabel')}
            />
          </View>
        )}

        {!bidding && seats.length === 2 && (
          <View className="flex-row items-center gap-3 rounded-card border-[1.5px] border-dashed border-border p-3">
            <View className="size-9 items-center justify-center rounded-full bg-surface-sunken">
              <Text className="text-base">👻</Text>
            </View>
            <View className="flex-1">
              <Text className="font-semi text-body text-content-muted">{t('game.ghost')}</Text>
              <Text className="font-body text-micro text-content-muted">{t('game.ghostHint')}</Text>
            </View>
            <Text className="font-display text-h2 tabular-nums text-content-muted">
              {ghostTricks}
            </Text>
          </View>
        )}
      </ScrollView>

      {bidding ? (
        <ValidationBar
          summary={
            t('game.bidsSum', { bids: bidsTotal, cards: cardsDealt }) +
            (bidsTotal > cardsDealt
              ? t('game.overbid')
              : bidsTotal < cardsDealt
                ? t('game.underbid')
                : '')
          }
          tone={bidsTotal === cardsDealt ? 'ok' : 'warn'}
          ok
          actionLabel={t('game.launch')}
          onAction={() => void launchRound()}
        />
      ) : (
        <ValidationBar
          summary={
            round.destroyedTricks > 0
              ? t('game.tricksSumDestroyed', {
                  tricks: tricksTotal,
                  destroyed: round.destroyedTricks,
                  accounted,
                  cards: cardsDealt,
                })
              : t('game.tricksSum', { tricks: tricksTotal, cards: cardsDealt })
          }
          ok={roundOk}
          problem={
            blocking ? (({ key, params }) => t(key, params))(issueMessage(blocking)) : undefined
          }
          actionLabel={t(round.roundNumber >= totalRounds ? 'game.finish' : 'game.validate')}
          onAction={() => void confirmRound()}
          onForce={() => void confirmRound(true)}
        />
      )}
    </View>
  );
}
