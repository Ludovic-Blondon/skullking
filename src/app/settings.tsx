import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Text } from '@/ui/text';

import { db } from '@/db/client';
import { describeBackup, parseBackup, serializeBackup } from '@/db/backup-format';
import { eraseEverything, exportBackup, importBackup } from '@/db/repositories/backup-repo';
import { games, players } from '@/db/schema';
import { PreferenceRow } from '@/features/settings/preference-row';
import { setSetting, useSettings } from '@/features/settings/use-settings';
import { useT } from '@/i18n';
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
  const t = useT();
  const preferences = useSettings();
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
        Alert.alert(t('settings.saved'), t('settings.savedAt', { uri: file.uri }));
      }
    } catch (error) {
      Alert.alert(
        t('settings.exportFailed'),
        error instanceof Error ? error.message : String(error),
      );
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
        Alert.alert(t('settings.importUnreadable'), result.reason);
        return;
      }

      const { document } = result;
      Alert.alert(
        t('settings.importTitle'),
        t('settings.importBody', { summary: describeBackup(document) }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('settings.replace'),
            style: 'destructive',
            onPress: () => {
              void importBackup(document)
                .then(() =>
                  Alert.alert(
                    t('settings.importDone'),
                    t('settings.importDoneBody', { summary: describeBackup(document) }),
                  ),
                )
                .catch((error: unknown) =>
                  Alert.alert(
                    t('settings.importFailed'),
                    error instanceof Error ? error.message : String(error),
                  ),
                );
            },
          },
        ],
      );
    } catch (error) {
      Alert.alert(
        t('settings.importFailed'),
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setBusy(false);
    }
  }

  function askErase() {
    Alert.alert(t('settings.eraseTitle'), t('settings.eraseBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.erase'), style: 'destructive', onPress: () => void eraseEverything() },
    ]);
  }

  return (
    <Screen edgeToEdgeBottom>
      <SectionLabel>{t('settings.data')}</SectionLabel>
      <Text className="font-body text-caption text-content-muted">
        {t('settings.inventory', {
          count: allPlayers.length,
          players: allPlayers.length,
          games: allGames.length,
        })}{' '}
        {t('settings.storage')}
      </Text>

      <View className="gap-2">
        <Action
          emoji="📤"
          title={t('settings.export')}
          description={t('settings.exportHint')}
          onPress={() => void runExport()}
          busy={busy}
          testID="export-backup"
        />
        <Action
          emoji="📥"
          title={t('settings.import')}
          description={t('settings.importHint')}
          onPress={() => void runImport()}
          busy={busy}
          testID="import-backup"
        />
        <Action
          emoji="🗑️"
          title={t('settings.erase')}
          description={t('settings.eraseHint')}
          onPress={askErase}
          destructive
          testID="erase-all"
        />
      </View>

      <SectionLabel>{t('settings.preferences')}</SectionLabel>
      <PreferenceRow
        label={t('settings.language')}
        hint={t('settings.languageHint')}
        value={preferences.language}
        options={[
          { value: 'system' as const, label: t('settings.system') },
          { value: 'fr' as const, label: 'Français' },
          { value: 'en' as const, label: 'English' },
        ]}
        onChange={(language) => void setSetting('language', language)}
      />
      <PreferenceRow
        label={t('settings.theme')}
        hint={t('settings.themeHint')}
        value={preferences.theme}
        options={[
          { value: 'system' as const, label: t('settings.system') },
          { value: 'light' as const, label: t('settings.light') },
          { value: 'dark' as const, label: t('settings.dark') },
        ]}
        onChange={(theme) => void setSetting('theme', theme)}
      />
      <PreferenceRow
        label={t('settings.keepAwake')}
        hint={t('settings.keepAwakeHint')}
        value={preferences.keepAwake}
        options={[
          { value: true, label: t('settings.on') },
          { value: false, label: t('settings.off') },
        ]}
        onChange={(keepAwake) => void setSetting('keepAwake', keepAwake)}
      />

      <SectionLabel>{t('settings.about')}</SectionLabel>
      <View className="gap-2 rounded-field bg-surface-raised p-3">
        <Text className="font-body text-caption text-content-muted">{t('settings.aboutBody')}</Text>
        <Text className="font-body text-micro text-content-muted">{t('settings.disclaimer')}</Text>
      </View>
    </Screen>
  );
}
