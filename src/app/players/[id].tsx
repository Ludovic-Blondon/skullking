import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Text } from '@/ui/text';

import { db } from '@/db/client';
import {
  archivePlayer,
  deletePlayer,
  PLAYER_EMOJIS,
  restorePlayer,
  updatePlayer,
} from '@/db/repositories/player-repo';
import { gamePlayers, players, type Player } from '@/db/schema';
import { AccuracyBars } from '@/features/stats/accuracy-bars';
import { MIN_GAMES_FOR_RATES, type PlayerStats } from '@/features/stats/compute';
import { useStats } from '@/features/stats/use-stats';
import { useT, type Translate } from '@/i18n';
import { Avatar } from '@/ui/avatar';
import { SectionLabel, CONTENT_MAX_WIDTH } from '@/ui/screen';
import { PLAYER_COLORS } from '@/ui/tokens';
import { useTokens } from '@/ui/use-tokens';

/**
 * Fiche joueur (PLAN.md §7.4) : identité modifiable, archivage réversible,
 * suppression réservée à qui n'a jamais joué. Les statistiques du §8 viendront
 * s'ajouter ici en P4.
 */
export default function PlayerSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const playerId = Number(id);

  const { data: rows } = useLiveQuery(db.select().from(players).where(eq(players.id, playerId)));
  const { data: seats } = useLiveQuery(
    db.select().from(gamePlayers).where(eq(gamePlayers.playerId, playerId)),
  );
  const player = rows[0];

  // La fiche n'est montée qu'une fois le joueur chargé : son prénom sert alors
  // d'état initial au champ, sans effet de synchronisation.
  if (!player) return <View className="flex-1 bg-surface" />;
  return <PlayerForm player={player} played={seats.length} />;
}

/** Tuile de statistique : un chiffre, ce qu'il mesure. */
function Tile({ value, label }: { value: string; label: string }) {
  return (
    <View className="flex-1 basis-[45%] gap-0.5 rounded-field bg-surface-raised p-3">
      <Text className="font-display text-h2 tabular-nums text-content">{value}</Text>
      <Text className="font-body text-micro text-content-muted">{label}</Text>
    </View>
  );
}

const percent = (value: number | null) => (value === null ? '–' : `${Math.round(value * 100)} %`);

/**
 * Statistiques du joueur (§8), organisées autour du **score moyen** : c'est le
 * chiffre qu'on vient chercher, le reste l'éclaire.
 *
 * Sous trois parties terminées, les taux ne sont pas affichés : « 100 % de
 * victoires » sur une partie est un mensonge statistique. Les compteurs bruts,
 * eux, restent justes dès la première.
 */
function PlayerStatsSection({ stats, t }: { stats: PlayerStats | undefined; t: Translate }) {
  const games = stats?.games ?? 0;

  if (games === 0) {
    return (
      <View className="gap-1 rounded-card bg-surface-raised p-4">
        <Text className="font-semi text-body text-content">{t('stats.noGame')}</Text>
        <Text className="font-body text-caption text-content-muted">{t('stats.noGameHint')}</Text>
      </View>
    );
  }

  const enough = games >= MIN_GAMES_FOR_RATES;
  const average = stats?.averageScore;

  return (
    <>
      <View className="flex-row items-end gap-4 rounded-card bg-surface-raised p-4">
        <View className="flex-1">
          <Text className="font-body text-micro uppercase tracking-widest text-content-muted">
            {t('stats.averageScore')}
          </Text>
          <Text className="font-display text-display tabular-nums text-content">
            {average === null || average === undefined ? '–' : Math.round(average)}
          </Text>
          <Text className="font-body text-micro text-content-muted">
            {t('stats.on', { count: games })}
          </Text>
        </View>
        <View className="items-end">
          <Text className="font-display text-h1 tabular-nums text-primary">
            {stats?.bestScore ?? '–'}
          </Text>
          <Text className="font-body text-micro text-content-muted">{t('stats.best')}</Text>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-2">
        <Tile value={enough ? percent(stats?.winRate ?? null) : '–'} label={t('stats.wins')} />
        <Tile
          value={
            enough && stats?.averageRank ? stats.averageRank.toFixed(1).replace('.', ',') : '–'
          }
          label={t('stats.averageRank')}
        />
        <Tile value={percent(stats?.accuracy ?? null)} label={t('stats.accuracy')} />
        <Tile
          value={
            stats?.averageGap === null ? '–' : (stats?.averageGap ?? 0).toFixed(1).replace('.', ',')
          }
          label={t('stats.averageGap')}
        />
      </View>

      {!enough && (
        <Text className="px-1 font-body text-micro text-content-muted">
          {t('stats.threshold', { min: MIN_GAMES_FOR_RATES })}
        </Text>
      )}

      {stats && <AccuracyBars stats={stats} />}

      <View className="gap-2 rounded-field bg-surface-raised p-3">
        <Text className="font-body text-caption text-content-muted">
          <Text className="font-semi text-content">{t('stats.zeroBids')}</Text>
          {t('stats.zeroBidsDetail', {
            tried: stats?.zeroBids ?? 0,
            won: stats?.zeroBidsWon ?? 0,
          })}
        </Text>
        <Text className="font-body text-caption text-content-muted">
          <Text className="font-semi text-content">{t('stats.bonusLine')}</Text>
          {t('stats.bonusDetail', {
            count: stats?.rounds ?? 0,
            points: stats?.bonusPoints ?? 0,
            rounds: stats?.rounds ?? 0,
          })}
        </Text>
      </View>
    </>
  );
}

function PlayerForm({ player, played }: { player: Player; played: number }) {
  const playerId = player.id;
  const tokens = useTokens();
  const t = useT();
  const stats = useStats().players.get(playerId);
  // Le champ n'est pas piloté par la base : une écriture par frappe ferait
  // sauter le curseur à chaque rafraîchissement de la requête vive.
  const [name, setName] = useState(player.name);

  function saveName() {
    if (!name.trim() || name.trim() === player.name) return;
    void updatePlayer(playerId, { name });
  }

  function askDelete() {
    Alert.alert(t('players.deleteTitle', { name: player.name }), t('players.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          void deletePlayer(playerId).then((done) => {
            if (done) router.back();
          });
        },
      },
    ]);
  }

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="mx-auto w-full gap-3 px-4 pb-8 pt-7"
      contentContainerStyle={{ maxWidth: CONTENT_MAX_WIDTH }}>
      <View className="flex-row items-center gap-3">
        <Avatar emoji={player.emoji} color={player.color} size="lg" />
        <View className="flex-1 gap-1">
          <TextInput
            value={name}
            onChangeText={setName}
            onBlur={saveName}
            onSubmitEditing={saveName}
            placeholder={t('players.firstName')}
            placeholderTextColor={tokens.contentMuted}
            maxFontSizeMultiplier={1.5}
            returnKeyType="done"
            autoCapitalize="words"
            testID="player-name"
            className="min-h-touch rounded-field bg-surface-raised px-3 font-title text-h2 text-content"
          />
          <Text className="font-body text-micro text-content-muted">
            {played === 0 ? t('players.noGame') : t('players.played', { count: played })}
          </Text>
        </View>
      </View>

      <PlayerStatsSection stats={stats} t={t} />

      <SectionLabel>{t('players.emoji')}</SectionLabel>
      <View className="flex-row flex-wrap gap-2">
        {PLAYER_EMOJIS.map((emoji) => (
          <Pressable
            key={emoji}
            onPress={() => void updatePlayer(playerId, { emoji })}
            accessibilityRole="button"
            accessibilityLabel={t('players.emojiChoice', { emoji })}
            accessibilityState={{ selected: player.emoji === emoji }}
            className={`size-touch items-center justify-center rounded-field active:opacity-70 ${
              player.emoji === emoji ? 'bg-primary' : 'bg-surface-raised'
            }`}>
            <Text className="text-xl">{emoji}</Text>
          </Pressable>
        ))}
      </View>

      <SectionLabel>{t('players.color')}</SectionLabel>
      <View className="flex-row flex-wrap gap-2">
        {PLAYER_COLORS.map((color) => (
          <Pressable
            key={color}
            onPress={() => void updatePlayer(playerId, { color })}
            accessibilityRole="button"
            accessibilityLabel={t('players.colorChoice', { color })}
            accessibilityState={{ selected: player.color === color }}
            className="size-touch items-center justify-center rounded-field active:opacity-70"
            style={{ backgroundColor: `${color}22` }}>
            <View
              className="size-7 rounded-full"
              style={{
                backgroundColor: color,
                borderWidth: player.color === color ? 3 : 0,
                borderColor: tokens.content,
              }}
            />
          </Pressable>
        ))}
      </View>

      <View className="mt-2 gap-2">
        {player.archivedAt === null ? (
          <Pressable
            onPress={() => void archivePlayer(playerId).then(() => router.back())}
            accessibilityRole="button"
            accessibilityLabel={t('players.archiveLabel')}
            className="min-h-touch items-center justify-center rounded-card bg-surface-raised p-3 active:opacity-70">
            <Text className="font-semi text-body text-content">{t('players.archive')}</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => void restorePlayer(playerId).then(() => router.back())}
            accessibilityRole="button"
            accessibilityLabel={t('players.restoreLabel')}
            className="min-h-touch items-center justify-center rounded-card bg-primary p-3 active:opacity-80">
            <Text className="font-semi text-body text-primary-fg">{t('players.restore')}</Text>
          </Pressable>
        )}

        {played === 0 && (
          <Pressable
            onPress={askDelete}
            accessibilityRole="button"
            accessibilityLabel={t('players.deleteLabel')}
            className="min-h-touch items-center justify-center p-3 active:opacity-70">
            <Text className="font-semi text-caption text-negative">
              {t('players.deleteForever')}
            </Text>
          </Pressable>
        )}

        <Text className="px-2 font-body text-micro text-content-muted">
          {t(played === 0 ? 'players.deletableHint' : 'players.archiveHint')}
        </Text>
      </View>
    </ScrollView>
  );
}
