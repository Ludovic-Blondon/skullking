import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { eq } from 'drizzle-orm';
import { useMemo } from 'react';

import { DEFAULT_RULESET, type Ruleset } from '@/core';
import { db } from '@/db/client';
import { settings } from '@/db/schema';

import { parseStoredRuleset, serializeRuleset } from './last-ruleset';

/** Préférences de l'app (PLAN.md §7.4). `system` suit le réglage de l'appareil. */
export interface AppSettings {
  language: 'system' | 'fr' | 'en';
  theme: 'system' | 'light' | 'dark';
  /** Écran maintenu allumé pendant une partie : une manche dure plus que la veille. */
  keepAwake: boolean;
  /** Règles de la dernière partie créée : la configuration en repart (§7.4). */
  lastRuleset: Ruleset;
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'system',
  theme: 'system',
  keepAwake: true,
  lastRuleset: DEFAULT_RULESET,
};

function parse(rows: { key: string; value: string }[]): AppSettings {
  const stored = new Map(rows.map((row) => [row.key, row.value]));
  const language = stored.get('language');
  const theme = stored.get('theme');
  return {
    language: language === 'fr' || language === 'en' ? language : DEFAULT_SETTINGS.language,
    theme: theme === 'light' || theme === 'dark' ? theme : DEFAULT_SETTINGS.theme,
    keepAwake: stored.get('keepAwake') !== 'false',
    lastRuleset: parseStoredRuleset(stored.get('ruleset')),
  };
}

/** Préférences courantes, réactives comme le reste de la base. */
export function useSettings(): AppSettings {
  const { data } = useLiveQuery(db.select().from(settings));
  return useMemo(() => parse(data), [data]);
}

/** Écrit une préférence — `upsert`, puisqu'une clé n'existe qu'une fois. */
export async function setSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K],
): Promise<void> {
  const stored = key === 'lastRuleset' ? serializeRuleset(value as Ruleset) : String(value);
  // La clé stockée pour les règles reste `ruleset`, plus courte que le nom du
  // champ côté app.
  const storedKey = key === 'lastRuleset' ? 'ruleset' : key;
  const existing = await db.select().from(settings).where(eq(settings.key, storedKey)).limit(1);
  if (existing.length > 0) {
    await db.update(settings).set({ value: stored }).where(eq(settings.key, storedKey));
    return;
  }
  await db.insert(settings).values({ key: storedKey, value: stored });
}
