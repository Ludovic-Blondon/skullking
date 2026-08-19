import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import {
  archivedPlayersQuery,
  createPlayer,
  restorePlayer,
  rosterQuery,
} from '@/db/repositories/player-repo';
import { Avatar } from '@/ui/avatar';
import { EmptyState, Screen, SectionLabel } from '@/ui/screen';
import { useTokens } from '@/ui/use-tokens';

/**
 * Roster persistant (PLAN.md §7.4) : création éclair, tri par fréquence de jeu,
 * archivage réversible. Toucher un joueur ouvre sa fiche.
 */
export default function PlayersScreen() {
  const t = useTokens();
  const { data: roster } = useLiveQuery(rosterQuery());
  const { data: archived } = useLiveQuery(archivedPlayersQuery());
  const [name, setName] = useState('');

  async function addPlayer() {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await createPlayer(trimmed);
      setName('');
    } catch (error) {
      Alert.alert(
        'Impossible d’ajouter ce joueur',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return (
    <Screen>
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

      {roster.length === 0 ? (
        <EmptyState emoji="🗺️" title="Aucun joueur">
          Ajoutez les prénoms de la table : ils seront réutilisables d’une partie à l’autre.
        </EmptyState>
      ) : (
        <View className="gap-2">
          {roster.map((player) => (
            <Link
              key={player.id}
              href={{ pathname: '/players/[id]', params: { id: String(player.id) } }}
              asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Fiche de ${player.name}`}
                testID={`roster-${player.id}`}
                className="min-h-touch flex-row items-center gap-3 rounded-card bg-surface-raised p-3 active:opacity-70">
                <Avatar emoji={player.emoji} color={player.color} />
                <Text className="flex-1 font-semi text-body text-content">{player.name}</Text>
                <Text className="font-body text-caption text-content-muted">
                  {player.games} partie{player.games > 1 ? 's' : ''}
                </Text>
              </Pressable>
            </Link>
          ))}
        </View>
      )}

      {archived.length > 0 && (
        <>
          <SectionLabel>Archivés</SectionLabel>
          <View className="gap-2">
            {archived.map((player) => (
              <View
                key={player.id}
                className="min-h-touch flex-row items-center gap-3 rounded-card border border-dashed border-border p-3">
                <Avatar emoji={player.emoji} color={player.color} size="sm" />
                <Text className="flex-1 font-semi text-body text-content-muted">{player.name}</Text>
                <Pressable
                  onPress={() => void restorePlayer(player.id)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Réactiver ${player.name}`}
                  className="active:opacity-70">
                  <Text className="font-semi text-caption text-primary">Réactiver</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </>
      )}

      <Pressable
        onPress={() => router.push('/game/new')}
        accessibilityRole="button"
        accessibilityLabel="Nouvelle partie"
        className="min-h-touch items-center justify-center active:opacity-70">
        <Text className="font-body text-caption text-content-muted">
          Ces joueurs se retrouvent dans la configuration de partie
        </Text>
      </Pressable>
    </Screen>
  );
}
