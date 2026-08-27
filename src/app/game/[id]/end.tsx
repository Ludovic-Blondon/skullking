import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Text } from '@/ui/text';

import { createGame, addTiebreakRound } from '@/db/repositories/game-repo';
import { podiumSteps } from '@/features/game/podium';
import { useGame } from '@/features/game/use-game';
import { setSetting } from '@/features/settings/use-settings';
import { computeAwards } from '@/features/stats/awards';
import { useT } from '@/i18n';
import { Avatar } from '@/ui/avatar';
import { Screen, SectionLabel, Watermark } from '@/ui/screen';

/**
 * Marches du podium, dans l'ordre d'affichage : deuxième, premier, troisième.
 *
 * `step` est un **rang**, pas une position au classement : `podiumSteps()`
 * groupe les ex æquo, et ils montent ensemble sur la même marche.
 */
const STEPS = [
  { step: 1, height: 44, width: 48, gain: 28 },
  { step: 0, height: 72, width: 56, gain: 42 },
  { step: 2, height: 30, width: 48, gain: 28 },
];

/**
 * Avatars affichés par marche. Au-delà, la marche déborderait de l'écran : le
 * compte des absents suffit, le classement complet est juste en dessous.
 */
const MAX_AVATARS = 3;

export default function GameEndScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gameId = Number(id);
  const view = useGame(gameId);
  const t = useT();

  if (!view.ready || !view.state || !view.game) return <View className="flex-1 bg-surface" />;

  const { state, seats, game, settled } = view;
  const seatOf = (playerId: string) => seats.find((seat) => String(seat.id) === playerId);
  const nameOf = (playerId: string) => seatOf(playerId)?.name ?? playerId;
  const awards = computeAwards(state.rounds, view.inputs);
  // Le classement acquis, pas l'aperçu : cet écran s'atteint aussi par lien
  // profond ou par l'historique du routeur, partie non terminée — et on ne
  // monte pas sur le podium avec des plis qui ne sont pas encore validés.
  const podium = podiumSteps(settled.standings);

  async function rematch() {
    // Une revanche redevient la dernière partie jouée : c'est de ses règles
    // que partira la prochaine configuration.
    await setSetting('lastRuleset', game.ruleset);
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
        {settled.tie ? (
          <View className="gap-3 rounded-card border-[1.5px] border-accent bg-accent/10 p-4">
            <Text className="font-title text-h1 text-content">
              {t('end.tie', { score: settled.standings[0]?.total ?? 0 })}
            </Text>
            <Text className="font-body text-body text-content-muted">
              {t('end.tieBody', { names: settled.leaders.map(nameOf).join(' · ') })}
            </Text>
            <Pressable
              onPress={() => void tiebreak()}
              accessibilityRole="button"
              accessibilityLabel={t('end.tiebreak')}
              className="min-h-touch items-center justify-center rounded-card bg-accent p-3 active:opacity-80">
              <Text className="font-title text-h2 text-accent-fg">{t('end.tiebreak')}</Text>
            </Pressable>
          </View>
        ) : (
          <View className="gap-4 rounded-card bg-surface-raised p-4">
            <Text className="text-center font-title text-h1 text-content">{t('end.over')}</Text>
            <View className="flex-row items-end justify-center gap-3">
              {STEPS.map(({ step, height, width, gain }) => {
                const tied = podium[step];
                // Marche vide : deux deuxièmes à égalité ne laissent pas de
                // troisième, et le podium n'a alors que deux marches.
                if (tied.length === 0) return null;
                const first = step === 0;
                const shown = tied.slice(0, MAX_AVATARS);
                const hidden = tied.length - shown.length;
                // La marche s'élargit avec le nombre d'ex æquo : les avatars
                // tiennent côte à côte plutôt que de se chevaucher. Le compte
                // des absents occupe une place de plus, sans quoi il déborde de
                // la marche sur laquelle il repose.
                const stepWidth = width + (shown.length - (hidden > 0 ? 0 : 1)) * gain;
                return (
                  <View key={step} className="items-center gap-1.5">
                    <View className="flex-row items-end gap-1">
                      {shown.map(({ playerId }) => {
                        const seat = seatOf(playerId);
                        return (
                          <Avatar
                            key={playerId}
                            emoji={seat?.emoji}
                            color={seat?.color}
                            size={first ? 'md' : 'sm'}
                          />
                        );
                      })}
                      {hidden > 0 && (
                        <Text className="font-semi text-micro text-content-muted">+{hidden}</Text>
                      )}
                    </View>
                    <Text
                      className={`font-display tabular-nums ${
                        first ? 'text-h2 text-content' : 'text-caption text-content-muted'
                      }`}>
                      {tied[0].total}
                    </Text>
                    <View
                      style={{ height, width: stepWidth }}
                      className={`rounded-t-field ${first ? 'bg-primary' : 'bg-border'}`}
                    />
                    <Text
                      style={{ width: stepWidth }}
                      className={`text-center font-semi text-micro ${
                        first ? 'text-content' : 'text-content-muted'
                      }`}
                      numberOfLines={2}>
                      {/* Les mêmes noms que les avatars au-dessus : concaténer
                          les absents ici les tronquerait tous dans la largeur
                          d'une marche. Le classement complet est juste en
                          dessous. */}
                      {shown.map((standing) => nameOf(standing.playerId)).join(' · ')}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {awards.length > 0 && (
          <>
            <SectionLabel>{t('end.awards')}</SectionLabel>
            <View className="flex-row flex-wrap gap-2">
              {awards.map((award) => (
                <View
                  key={award.id}
                  className="flex-1 basis-[45%] items-center gap-0.5 rounded-field bg-surface-raised p-3">
                  <Text className="text-xl">{award.emoji}</Text>
                  <Text className="text-center font-semi text-caption text-content">
                    {t(award.labelKey)}
                  </Text>
                  <Text
                    className="text-center font-body text-micro text-content-muted"
                    numberOfLines={1}>
                    {award.playerIds.map(nameOf).join(' & ')}
                  </Text>
                  <Text className="text-center font-body text-micro text-content-muted">
                    {t(award.detailKey, { count: award.value })}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        <SectionLabel>{t('end.ranking')}</SectionLabel>
        <View className="gap-2">
          {settled.standings.map((standing) => {
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
            accessibilityLabel={t('end.rematch')}
            testID="rematch"
            className="min-h-touch flex-1 items-center justify-center rounded-card bg-primary p-3.5 active:opacity-80">
            <Text className="font-title text-h2 text-primary-fg">{t('end.rematch')}</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: '/game/[id]/scoresheet', params: { id } })}
            accessibilityRole="button"
            accessibilityLabel={t('end.seeSheet')}
            className="min-h-touch flex-1 items-center justify-center rounded-card bg-surface-raised p-3.5 active:opacity-70">
            <Text className="font-title text-h2 text-content">{t('end.detail')}</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => router.replace('/')}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          className="min-h-touch items-center justify-center active:opacity-70">
          <Text className="font-body text-caption text-content-muted">{t('common.back')}</Text>
        </Pressable>
      </Screen>
    </View>
  );
}
