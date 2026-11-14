/**
 * Base SQLite en mémoire, aux mêmes migrations que l'app, pour tester les
 * repositories sans appareil.
 *
 * Elle remplace `../client` dans une suite :
 *
 *     jest.mock('../../client', () =>
 *       jest.requireActual('../../__tests__/memory-db').memoryClient(),
 *     );
 *
 * Le moteur est `node:sqlite`, livré avec Node : aucune dépendance à ajouter.
 * Le même pilote Drizzle/Expo que sur appareil exécute les requêtes et les
 * transactions synchrones. Seule la surface native de préparation/exécution
 * des requêtes est adaptée à `node:sqlite`.
 */

import { drizzle } from 'drizzle-orm/expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import * as schema from '../schema';

const MIGRATIONS = join(__dirname, '..', '..', '..', 'drizzle');

function migrate(sqlite: DatabaseSync): void {
  const files = readdirSync(MIGRATIONS)
    .filter((file) => file.endsWith('.sql'))
    .sort();
  for (const file of files) {
    for (const statement of readFileSync(join(MIGRATIONS, file), 'utf8').split(
      '--> statement-breakpoint',
    )) {
      if (statement.trim()) sqlite.exec(statement);
    }
  }
}

export function memoryClient() {
  const sqlite = new DatabaseSync(':memory:');
  // Comme sur l'appareil : sans elles, aucune cascade ni aucun refus d'orphelin.
  sqlite.exec('PRAGMA foreign_keys = ON;');
  migrate(sqlite);

  const native = {
    execSync: (sql: string) => sqlite.exec(sql),
    closeSync: () => sqlite.close(),
    prepareSync(sql: string) {
      const statement = sqlite.prepare(sql);
      return {
        executeSync(params: SQLInputValue[] = []) {
          statement.setReturnArrays(false);
          if (statement.columns().length > 0) {
            const rows = statement.all(...params);
            return { getAllSync: () => rows, getFirstSync: () => rows[0] ?? null };
          }
          const result = statement.run(...params);
          return { changes: result.changes, lastInsertRowId: result.lastInsertRowid };
        },
        executeForRawResultSync(params: SQLInputValue[] = []) {
          // Les lignes positionnelles préservent les colonnes homonymes des
          // jointures ; Drizzle les traduit ensuite avec le schéma de l'app.
          statement.setReturnArrays(true);
          const rows = statement.all(...params);
          return { getAllSync: () => rows };
        },
        finalizeSync() {},
      };
    },
  };

  return {
    // L'adaptateur ne reproduit que les méthodes natives utilisées par le
    // pilote, pas les API asynchrones ni les listeners d'Expo.
    db: drizzle(native as unknown as SQLiteDatabase, { schema }),
    sqlite: native,
  };
}
