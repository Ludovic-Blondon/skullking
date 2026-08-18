import Ionicons from '@expo/vector-icons/Ionicons';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { DEFAULT_RULESET, MAX_PLAYERS, MIN_PLAYERS } from '@/core';
import { createGame } from '@/db/repositories/game-repo';
import { activePlayersQuery, createPlayer } from '@/db/repositories/player-repo';
import { Body, Card, Screen, Title } from '@/ui/screen';
import { useTokens } from '@/ui/use-tokens';

export default function NewGameScreen() {
  const t = useTokens();
  const { data: players } = useLiveQuery(activePlayersQuery());
  const [selected, setSelected] = useState<number[]>([]);
  const [name, setName] = useState('');

  const enough = selected.length >= MIN_PLAYERS;

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
      <Card>
        <Title>Qui joue ?</Title>
        <Body>
          De {MIN_PLAYERS} à {MAX_PLAYERS} joueurs. L&apos;ordre de sélection est l&apos;ordre
          autour de la table.
        </Body>
      </Card>

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
          className="min-h-touch flex-1 rounded-card border border-border bg-surface-raised px-4 text-base text-content"
        />
        <Pressable
          onPress={() => void addPlayer()}
          disabled={!name.trim()}
          accessibilityRole="button"
          accessibilityLabel="Ajouter ce joueur"
          testID="new-player-add"
          className="size-touch items-center justify-center rounded-card bg-primary active:opacity-80 disabled:opacity-40">
          <Ionicons name="add" size={24} color={t.primaryFg} />
        </Pressable>
      </View>

      {players.length === 0 ? (
        <Card>
          <Body>
            Aucun joueur enregistré pour l&apos;instant. Ajoutez les prénoms de la table : ils
            seront réutilisables d&apos;une partie à l&apos;autre.
          </Body>
        </Card>
      ) : (
        <View className="gap-2">
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
                className={`min-h-touch flex-row items-center gap-3 rounded-card border p-3 active:opacity-70 ${
                  isSelected
                    ? 'border-primary bg-surface-raised'
                    : 'border-border bg-surface-raised'
                }`}>
                <Text className="text-2xl">{player.emoji ?? '🏴‍☠️'}</Text>
                <Text className="flex-1 text-base font-semibold text-content">{player.name}</Text>
                {isSelected && (
                  <View className="size-7 items-center justify-center rounded-full bg-primary">
                    <Text className="text-sm font-bold text-primary-fg">{rank + 1}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
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
        className="min-h-touch flex-row items-center justify-center gap-2 rounded-card bg-primary p-4 active:opacity-80 disabled:opacity-40">
        <Ionicons name="play" size={20} color={t.primaryFg} />
        <Text className="text-lg font-semibold text-primary-fg">
          C&apos;est parti{enough ? ` — ${selected.length} joueurs` : ''}
        </Text>
      </Pressable>
    </Screen>
  );
}
