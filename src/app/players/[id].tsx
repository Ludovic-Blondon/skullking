import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

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
import { Avatar } from '@/ui/avatar';
import { SectionLabel } from '@/ui/screen';
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
function PlayerStatsSection({ stats }: { stats: PlayerStats | undefined }) {
  const games = stats?.games ?? 0;

  if (games === 0) {
    return (
      <View className="gap-1 rounded-card bg-surface-raised p-4">
        <Text className="font-semi text-body text-content">Aucune partie terminée</Text>
        <Text className="font-body text-caption text-content-muted">
          Les statistiques arrivent dès qu’une partie va jusqu’au bout. Les parties abandonnées
          n’entrent pas dans les moyennes.
        </Text>
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
            Score moyen
          </Text>
          <Text className="font-display text-display tabular-nums text-content">
            {average === null || average === undefined ? '–' : Math.round(average)}
          </Text>
          <Text className="font-body text-micro text-content-muted">
            sur {games} partie{games > 1 ? 's' : ''} terminée{games > 1 ? 's' : ''}
          </Text>
        </View>
        <View className="items-end">
          <Text className="font-display text-h1 tabular-nums text-primary">
            {stats?.bestScore ?? '–'}
          </Text>
          <Text className="font-body text-micro text-content-muted">meilleur score</Text>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-2">
        <Tile value={enough ? percent(stats?.winRate ?? null) : '–'} label="Victoires" />
        <Tile
          value={
            enough && stats?.averageRank ? stats.averageRank.toFixed(1).replace('.', ',') : '–'
          }
          label="Position moyenne"
        />
        <Tile value={percent(stats?.accuracy ?? null)} label="Annonces exactes" />
        <Tile
          value={
            stats?.averageGap === null ? '–' : (stats?.averageGap ?? 0).toFixed(1).replace('.', ',')
          }
          label="Écart moyen"
        />
      </View>

      {!enough && (
        <Text className="px-1 font-body text-micro text-content-muted">
          Victoires et position moyenne s’affichent à partir de {MIN_GAMES_FOR_RATES} parties
          terminées : sur une seule, elles ne diraient rien. La précision, elle, se mesure sur
          chaque manche.
        </Text>
      )}

      {stats && <AccuracyBars stats={stats} />}

      <View className="gap-2 rounded-field bg-surface-raised p-3">
        <Text className="font-body text-caption text-content-muted">
          <Text className="font-semi text-content">Mises 0</Text> — {stats?.zeroBids ?? 0} tentée
          {(stats?.zeroBids ?? 0) > 1 ? 's' : ''}, {stats?.zeroBidsWon ?? 0} tenue
          {(stats?.zeroBidsWon ?? 0) > 1 ? 's' : ''}
        </Text>
        <Text className="font-body text-caption text-content-muted">
          <Text className="font-semi text-content">Bonus</Text> — {stats?.bonusPoints ?? 0} points
          marqués sur {stats?.rounds ?? 0} manche{(stats?.rounds ?? 0) > 1 ? 's' : ''} jouée
          {(stats?.rounds ?? 0) > 1 ? 's' : ''}
        </Text>
      </View>
    </>
  );
}

function PlayerForm({ player, played }: { player: Player; played: number }) {
  const playerId = player.id;
  const t = useTokens();
  const stats = useStats().players.get(playerId);
  // Le champ n'est pas piloté par la base : une écriture par frappe ferait
  // sauter le curseur à chaque rafraîchissement de la requête vive.
  const [name, setName] = useState(player.name);

  function saveName() {
    if (!name.trim() || name.trim() === player.name) return;
    void updatePlayer(playerId, { name });
  }

  function askDelete() {
    Alert.alert(
      `Supprimer ${player.name} ?`,
      "Ce joueur n'a jamais joué : sa suppression ne retire rien d'un historique.",
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            void deletePlayer(playerId).then((done) => {
              if (done) router.back();
            });
          },
        },
      ],
    );
  }

  return (
    <ScrollView className="flex-1 bg-surface" contentContainerClassName="gap-3 px-4 pb-8 pt-7">
      <View className="flex-row items-center gap-3">
        <Avatar emoji={player.emoji} color={player.color} size="lg" />
        <View className="flex-1 gap-1">
          <TextInput
            value={name}
            onChangeText={setName}
            onBlur={saveName}
            onSubmitEditing={saveName}
            placeholder="Prénom"
            placeholderTextColor={t.contentMuted}
            returnKeyType="done"
            autoCapitalize="words"
            testID="player-name"
            className="min-h-touch rounded-field bg-surface-raised px-3 font-title text-h2 text-content"
          />
          <Text className="font-body text-micro text-content-muted">
            {played === 0
              ? 'Aucune partie jouée'
              : `${played} partie${played > 1 ? 's' : ''} jouée${played > 1 ? 's' : ''}`}
          </Text>
        </View>
      </View>

      <PlayerStatsSection stats={stats} />

      <SectionLabel>Emoji</SectionLabel>
      <View className="flex-row flex-wrap gap-2">
        {PLAYER_EMOJIS.map((emoji) => (
          <Pressable
            key={emoji}
            onPress={() => void updatePlayer(playerId, { emoji })}
            accessibilityRole="button"
            accessibilityLabel={`Emoji ${emoji}`}
            accessibilityState={{ selected: player.emoji === emoji }}
            className={`size-touch items-center justify-center rounded-field active:opacity-70 ${
              player.emoji === emoji ? 'bg-primary' : 'bg-surface-raised'
            }`}>
            <Text className="text-xl">{emoji}</Text>
          </Pressable>
        ))}
      </View>

      <SectionLabel>Couleur</SectionLabel>
      <View className="flex-row flex-wrap gap-2">
        {PLAYER_COLORS.map((color) => (
          <Pressable
            key={color}
            onPress={() => void updatePlayer(playerId, { color })}
            accessibilityRole="button"
            accessibilityLabel={`Couleur ${color}`}
            accessibilityState={{ selected: player.color === color }}
            className="size-touch items-center justify-center rounded-field active:opacity-70"
            style={{ backgroundColor: `${color}22` }}>
            <View
              className="size-7 rounded-full"
              style={{
                backgroundColor: color,
                borderWidth: player.color === color ? 3 : 0,
                borderColor: t.content,
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
            accessibilityLabel="Archiver ce joueur"
            className="min-h-touch items-center justify-center rounded-card bg-surface-raised p-3 active:opacity-70">
            <Text className="font-semi text-body text-content">Archiver</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => void restorePlayer(playerId).then(() => router.back())}
            accessibilityRole="button"
            accessibilityLabel="Réactiver ce joueur"
            className="min-h-touch items-center justify-center rounded-card bg-primary p-3 active:opacity-80">
            <Text className="font-semi text-body text-primary-fg">Réactiver</Text>
          </Pressable>
        )}

        {played === 0 && (
          <Pressable
            onPress={askDelete}
            accessibilityRole="button"
            accessibilityLabel="Supprimer ce joueur"
            className="min-h-touch items-center justify-center p-3 active:opacity-70">
            <Text className="font-semi text-caption text-negative">Supprimer définitivement</Text>
          </Pressable>
        )}

        <Text className="px-2 font-body text-micro text-content-muted">
          {played === 0
            ? 'Un joueur qui n’a jamais joué peut être supprimé ; sinon, l’archivage le retire des listes sans toucher à son historique.'
            : 'Un joueur ayant des parties n’est jamais supprimé : l’archivage le retire des listes sans rien perdre de son historique.'}
        </Text>
      </View>
    </ScrollView>
  );
}
