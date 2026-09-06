import { useLocalSearchParams } from 'expo-router';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';

import { DEFAULT_ROUNDS_PLAN, maxPlayersFor, MIN_PLAYERS } from '@/core';
import { addPlayerToGame, removePlayerFromGame, setRoundsCount } from '@/db/repositories/game-repo';
import { activePlayersQuery, createPlayer } from '@/db/repositories/player-repo';
import { summarizeRuleset } from '@/features/game/ruleset-summary';
import { useGame } from '@/features/game/use-game';
import { useT } from '@/i18n';
import { Avatar } from '@/ui/avatar';
import { Screen, SectionLabel } from '@/ui/screen';
import { Stepper } from '@/ui/stepper';
import { Text } from '@/ui/text';
import { useTokens } from '@/ui/use-tokens';

/**
 * Réglages d'une partie en cours (PLAN.md §7.5).
 *
 * Deux gestes, et deux seulement : le nombre de manches et la composition de la
 * table. Les règles, elles, restent celles de la création — les rappeler en
 * lecture seule évite de recalculer une feuille déjà écrite sur un geste
 * malheureux.
 */
export default function GameSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gameId = Number(id);
  const t = useT();
  const tokens = useTokens();
  const view = useGame(gameId);
  const { data: roster } = useLiveQuery(activePlayersQuery());
  const [name, setName] = useState('');

  if (!view.ready || !view.game) return <View className="flex-1 bg-surface" />;

  const { game, activeSeats, settled } = view;
  const rounds = game.ruleset.roundsPlan.length;
  const maxPlayers = maxPlayersFor(game.ruleset);
  // La table ne se change qu'entre deux manches : en Résultats, les plis sont
  // en train d'être posés.
  const betweenRounds = game.currentPhase === 'bidding';
  const canRemove = betweenRounds && activeSeats.length > MIN_PLAYERS;
  const canAdd = betweenRounds && activeSeats.length < maxPlayers;

  const benched = roster.filter((player) => !activeSeats.some((seat) => seat.id === player.id));

  function confirmRemove(playerId: number, playerName: string) {
    Alert.alert(
      t('gset.removeTitle', { name: playerName }),
      t('gset.removeBody', {
        name: playerName,
        points: settled.totals[String(playerId)] ?? 0,
        round: game.currentRound,
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('gset.remove'),
          style: 'destructive',
          onPress: () => void removePlayerFromGame(gameId, playerId),
        },
      ],
    );
  }

  async function addNewPlayer() {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const created = await createPlayer(trimmed);
      setName('');
      await addPlayerToGame(gameId, created.id);
    } catch (error) {
      Alert.alert(t('new.addFailed'), error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <Screen edgeToEdgeBottom>
      <SectionLabel>{t('gset.rounds')}</SectionLabel>
      <View className="min-h-touch flex-row items-center justify-between gap-3 rounded-field bg-surface-raised p-3">
        <View className="flex-1">
          <Text className="font-semi text-caption text-content">{t('rules.rounds')}</Text>
          <Text className="font-body text-micro text-content-muted">
            {t('gset.roundsHint', { round: game.currentRound })}
          </Text>
        </View>
        <Stepper
          value={rounds}
          onChange={(count) => void setRoundsCount(gameId, count)}
          min={game.currentRound}
          max={Math.max(DEFAULT_ROUNDS_PLAN.length, rounds)}
          size="sm"
          label={t('rules.rounds')}
          testID="rounds-count"
        />
      </View>
      {rounds === game.currentRound && (
        <Text className="px-1 font-body text-micro text-content-muted">
          {t('gset.lastRound', { round: rounds })}
        </Text>
      )}

      <SectionLabel>{t('gset.players')}</SectionLabel>
      {!betweenRounds && (
        <Text className="px-1 font-body text-micro text-content-muted">
          {t('gset.duringRound')}
        </Text>
      )}
      <View className="gap-2">
        {activeSeats.map((player) => (
          <View
            key={player.id}
            className="min-h-touch flex-row items-center gap-3 rounded-field bg-surface-raised p-2.5">
            <Avatar emoji={player.emoji} color={player.color} size="sm" />
            <Text className="flex-1 font-semi text-body text-content">{player.name}</Text>
            <Text className="font-body text-caption tabular-nums text-content-muted">
              {t('game.points', { points: settled.totals[String(player.id)] ?? 0 })}
            </Text>
            <Pressable
              onPress={() => confirmRemove(player.id, player.name)}
              disabled={!canRemove}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('gset.removeOf', { name: player.name })}
              testID={`remove-${player.id}`}
              className={`size-9 items-center justify-center rounded-full bg-surface-sunken active:opacity-60 ${
                canRemove ? '' : 'opacity-40'
              }`}>
              <Text className="font-title text-caption text-content-muted">−</Text>
            </Pressable>
          </View>
        ))}
      </View>
      <Text className="px-1 font-body text-micro text-content-muted">
        {canAdd
          ? t('gset.playersHint', { min: MIN_PLAYERS, max: maxPlayers })
          : t('gset.tableFull', { max: maxPlayers })}
      </Text>

      {canAdd && (
        <>
          {benched.length > 0 && (
            <View className="flex-row flex-wrap gap-2">
              {benched.map((player) => (
                <Pressable
                  key={player.id}
                  onPress={() => void addPlayerToGame(gameId, player.id)}
                  accessibilityRole="button"
                  accessibilityLabel={t('gset.addOf', { name: player.name })}
                  testID={`add-${player.id}`}
                  className="min-h-touch flex-row items-center gap-2 rounded-full bg-surface-raised px-3 active:opacity-70">
                  <Text className="text-base">{player.emoji ?? '🏴‍☠️'}</Text>
                  <Text className="font-semi text-body text-content">{player.name}</Text>
                  <Text className="font-title text-body text-primary">+</Text>
                </Pressable>
              ))}
            </View>
          )}

          <View className="flex-row items-center gap-2">
            <TextInput
              value={name}
              onChangeText={setName}
              onSubmitEditing={addNewPlayer}
              placeholder={t('new.addPlayer')}
              placeholderTextColor={tokens.contentMuted}
              maxFontSizeMultiplier={1.5}
              returnKeyType="done"
              autoCapitalize="words"
              testID="settings-player-name"
              className="min-h-touch flex-1 rounded-full bg-surface-raised px-4 font-body text-body text-content"
            />
            <Pressable
              onPress={() => void addNewPlayer()}
              disabled={!name.trim()}
              accessibilityRole="button"
              accessibilityLabel={t('new.addThisPlayer')}
              testID="settings-player-add"
              className={`size-touch items-center justify-center rounded-full active:opacity-80 ${
                name.trim() ? 'bg-primary' : 'bg-border'
              }`}>
              <Text
                className={`font-title text-h1 ${
                  name.trim() ? 'text-primary-fg' : 'text-content-muted'
                }`}>
                +
              </Text>
            </Pressable>
          </View>
        </>
      )}

      <SectionLabel>{t('gset.rules')}</SectionLabel>
      <View className="rounded-field bg-surface-raised p-3">
        <Text className="font-semi text-caption text-content">
          {summarizeRuleset(game.ruleset, t)}
        </Text>
        <Text className="font-body text-micro text-content-muted">{t('gset.rulesHint')}</Text>
      </View>
    </Screen>
  );
}
