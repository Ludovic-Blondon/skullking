import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { db } from '@/db/client';
import { describeBackup, parseBackup, serializeBackup } from '@/db/backup-format';
import { eraseEverything, exportBackup, importBackup } from '@/db/repositories/backup-repo';
import { games, players } from '@/db/schema';
import { Screen, SectionLabel } from '@/ui/screen';

/** `skull-scores-2026-08-19.json` : un nom de fichier qui se relit dans un an. */
function backupFileName(): string {
  return `skull-scores-${new Date().toISOString().slice(0, 10)}.json`;
}

type ActionProps = {
  emoji: string;
  title: string;
  description: string;
  onPress: () => void;
  busy?: boolean;
  destructive?: boolean;
  testID?: string;
};

function Action({ emoji, title, description, onPress, busy, destructive, testID }: ActionProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={title}
      testID={testID}
      className={`min-h-touch flex-row items-center gap-3 rounded-field bg-surface-raised p-3 active:opacity-70 ${
        busy ? 'opacity-50' : ''
      }`}>
      <Text className="text-xl">{emoji}</Text>
      <View className="flex-1">
        <Text className={`font-semi text-body ${destructive ? 'text-negative' : 'text-content'}`}>
          {title}
        </Text>
        <Text className="font-body text-micro text-content-muted">{description}</Text>
      </View>
    </Pressable>
  );
}

/**
 * Réglages (PLAN.md §7.4). En P3, l'écran porte l'export/import JSON et
 * l'à-propos ; langue, thème et keep-awake le rejoindront en P6.
 */
export default function SettingsScreen() {
  const { data: allPlayers } = useLiveQuery(db.select({ id: players.id }).from(players));
  const { data: allGames } = useLiveQuery(db.select({ id: games.id }).from(games));
  const [busy, setBusy] = useState(false);

  async function runExport() {
    setBusy(true);
    try {
      const document = await exportBackup();
      const file = new File(Paths.cache, backupFileName());
      // Le fichier est réécrit à chaque export : la sauvegarde du jour remplace
      // celle du jour, et rien ne s'accumule dans le cache.
      if (file.exists) file.delete();
      file.create();
      file.write(serializeBackup(document));

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: 'Sauvegarde Skull Scores',
          UTI: 'public.json',
        });
      } else {
        Alert.alert('Sauvegarde enregistrée', `Fichier : ${file.uri}`);
      }
    } catch (error) {
      Alert.alert('Export impossible', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    setBusy(true);
    try {
      // Le sélecteur renvoie une enveloppe `{ result, canceled }` — et non le
      // fichier directement : sortir de l'écran ne doit pas ressembler à une
      // erreur.
      const picked = await File.pickFileAsync({ mimeTypes: ['application/json'] });
      if (picked.canceled || !picked.result) return;

      const result = parseBackup(await picked.result.text());
      if (!result.ok) {
        Alert.alert('Sauvegarde illisible', result.reason);
        return;
      }

      const { document } = result;
      Alert.alert(
        'Remplacer toutes les données ?',
        `Cette sauvegarde contient ${describeBackup(document)}. Les parties et les joueurs actuellement dans l’app seront remplacés.`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Remplacer',
            style: 'destructive',
            onPress: () => {
              void importBackup(document)
                .then(() =>
                  Alert.alert('Sauvegarde restaurée', `${describeBackup(document)} rechargés.`),
                )
                .catch((error: unknown) =>
                  Alert.alert(
                    'Import impossible',
                    error instanceof Error ? error.message : String(error),
                  ),
                );
            },
          },
        ],
      );
    } catch (error) {
      Alert.alert('Import impossible', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  function askErase() {
    Alert.alert(
      'Tout effacer ?',
      'Toutes les parties et tous les joueurs disparaissent définitivement. Exportez d’abord si vous tenez à cet historique.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Tout effacer', style: 'destructive', onPress: () => void eraseEverything() },
      ],
    );
  }

  return (
    <Screen edgeToEdgeBottom>
      <SectionLabel>Données</SectionLabel>
      <Text className="font-body text-caption text-content-muted">
        {allPlayers.length} joueur{allPlayers.length > 1 ? 's' : ''} · {allGames.length} partie
        {allGames.length > 1 ? 's' : ''} en mémoire. Tout est stocké sur cet appareil, sans compte
        ni serveur.
      </Text>

      <View className="gap-2">
        <Action
          emoji="📤"
          title="Exporter"
          description="Un fichier JSON à envoyer où vous voulez"
          onPress={() => void runExport()}
          busy={busy}
          testID="export-backup"
        />
        <Action
          emoji="📥"
          title="Importer"
          description="Remplace les données par celles d’une sauvegarde"
          onPress={() => void runImport()}
          busy={busy}
          testID="import-backup"
        />
        <Action
          emoji="🗑️"
          title="Tout effacer"
          description="Repartir d’une app vide"
          onPress={askErase}
          destructive
          testID="erase-all"
        />
      </View>

      <SectionLabel>À propos</SectionLabel>
      <View className="gap-2 rounded-field bg-surface-raised p-3">
        <Text className="font-body text-caption text-content-muted">
          Skull Scores compte les points de vos parties de Skull King : hors ligne, sans publicité,
          sans compte et sans traceur.
        </Text>
        <Text className="font-body text-micro text-content-muted">
          Application non affiliée à Grandpa Beck&apos;s Games. « Skull King » est une marque de son
          éditeur ; l&apos;iconographie de cette app est originale.
        </Text>
      </View>

      <Text className="px-1 font-body text-micro text-content-muted">
        Langue, thème et écran maintenu allumé arriveront avec la phase P6.
      </Text>
    </Screen>
  );
}
