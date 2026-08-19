import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { DEFAULT_RULESET, MAX_PLAYERS, MIN_PLAYERS } from '@/core';
import { createGame } from '@/db/repositories/game-repo';
import { activePlayersQuery, createPlayer } from '@/db/repositories/player-repo';
import { Avatar } from '@/ui/avatar';
import { EmptyState, Screen, SectionLabel } from '@/ui/screen';
import { useTokens } from '@/ui/use-tokens';

export default function NewGameScreen() {
  const t = useTokens();
  const { data: players } = useLiveQuery(activePlayersQuery());
  const [selected, setSelected] = useState<number[]>([]);
  const [name, setName] = useState('');

  const enough = selected.length >= MIN_PLAYERS;
  const seated = selected
    .map((id) => players.find((player) => player.id === id))
    .filter((player): player is (typeof players)[number] => player !== undefined);

  function toggle(playerId: number) {
    setSelected((current) =>
      current.includes(playerId)
        ? current.filter((id) => id !== playerId)
        : current.length >= MAX_PLAYERS
          ? current
          : [...current, playerId],
    );
  }

  async function addPlayer() {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const created = await createPlayer(trimmed);
      setName('');
      setSelected((current) =>
        current.length >= MAX_PLAYERS ? current : [...current, created.id],
      );
    } catch (error) {
      // Une écriture qui échoue en silence est le pire des cas : l'utilisateur
      // retape son prénom sans comprendre pourquoi rien ne se passe.
      Alert.alert(
        'Impossible d’ajouter ce joueur',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async function start() {
    const gameId = await createGame(selected, DEFAULT_RULESET);
    router.replace({ pathname: '/game/[id]', params: { id: String(gameId) } });
  }

  return (
    <Screen edgeToEdgeBottom>
      <SectionLabel>
        Qui joue ? De {MIN_PLAYERS} à {MAX_PLAYERS} joueurs
      </SectionLabel>

      {players.length === 0 ? (
        <EmptyState emoji="🗺️" title="Aucun joueur enregistré">
          Ajoutez les prénoms de la table : ils seront réutilisables d’une partie à l’autre.
        </EmptyState>
      ) : (
        <View className="flex-row flex-wrap gap-2">
          {players.map((player) => {
            const rank = selected.indexOf(player.id);
            const isSelected = rank >= 0;
            return (
              <Pressable
                key={player.id}
                onPress={() => toggle(player.id)}
                accessibilityRole="checkbox"
                accessibilityLabel={player.name}
                accessibilityState={{ checked: isSelected }}
                testID={`player-${player.id}`}
                className={`min-h-touch flex-row items-center gap-2 rounded-full px-3 active:opacity-70 ${
                  isSelected ? 'bg-primary' : 'bg-surface-raised'
                }`}>
                <Text className="text-base">{player.emoji ?? '🏴‍☠️'}</Text>
                <Text
                  className={`font-semi text-body ${
                    isSelected ? 'text-primary-fg' : 'text-content'
                  }`}>
                  {player.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <View className="flex-row items-center gap-2">
        <TextInput
          value={name}
          onChangeText={setName}
          onSubmitEditing={addPlayer}
          placeholder="Ajouter un joueur"
          placeholderTextColor={t.contentMuted}
          returnKeyType="done"
          autoCapitalize="words"
          testID="new-player-name"
          className="min-h-touch flex-1 rounded-full bg-surface-raised px-4 font-body text-body text-content"
        />
        <Pressable
          onPress={() => void addPlayer()}
          disabled={!name.trim()}
          accessibilityRole="button"
          accessibilityLabel="Ajouter ce joueur"
          testID="new-player-add"
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

      {seated.length > 0 && (
        <>
          <SectionLabel>Ordre à table</SectionLabel>
          <View className="gap-2">
            {seated.map((player, index) => (
              <View
                key={player.id}
                className="flex-row items-center gap-3 rounded-field bg-surface-raised p-2.5">
                <Text className="w-4 text-center font-title text-caption text-content-muted">
                  {index + 1}
                </Text>
                <Avatar emoji={player.emoji} color={player.color} size="sm" />
                <Text className="flex-1 font-semi text-body text-content">{player.name}</Text>
                {index === 0 && (
                  <Text className="font-body text-micro text-content-muted">1ʳᵉ donne</Text>
                )}
              </View>
            ))}
          </View>
        </>
      )}

      <Pressable
        onPress={() => {
          if (!enough) {
            Alert.alert('Il faut au moins deux joueurs', 'Sélectionnez les joueurs de la table.');
            return;
          }
          void start();
        }}
        disabled={!enough}
        testID="start-game"
        accessibilityRole="button"
        accessibilityLabel="Démarrer la partie"
        className={`mt-2 min-h-touch items-center justify-center rounded-card p-4 active:opacity-80 ${
          enough ? 'bg-primary' : 'bg-border'
        }`}>
        <Text className={`font-title text-h2 ${enough ? 'text-primary-fg' : 'text-content-muted'}`}>
          C&apos;est parti{enough ? ` — ${selected.length} joueurs` : ''}
        </Text>
      </Pressable>
    </Screen>
  );
}
