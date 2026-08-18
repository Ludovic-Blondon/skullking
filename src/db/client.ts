import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

/**
 * Base locale unique de l'application. `enableChangeListener` est ce qui rend
 * `useLiveQuery` réactif : la base est la source de vérité, l'UI se réabonne
 * toute seule (PLAN.md §6).
 */
export const sqlite = openDatabaseSync('skullking.db', { enableChangeListener: true });

// SQLite désactive les clés étrangères par défaut ; sans ça, `onDelete: cascade`
// ne s'appliquerait pas et supprimer une partie laisserait ses manches orphelines.
sqlite.execSync('PRAGMA foreign_keys = ON;');

export const db = drizzle(sqlite, { schema });

export type Database = typeof db;
