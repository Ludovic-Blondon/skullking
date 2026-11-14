/** Garde-fou des transactions, sur SQLite réel (PLAN.md §5). */

import { db, sqlite } from '../client';
import { players } from '../schema';
import { atomically } from '../transaction';

jest.mock('../client', () => jest.requireActual('./memory-db').memoryClient());

function addPlayer(name: string): void {
  db.insert(players).values({ name, createdAt: 0 }).run();
}

function names(): string[] {
  return db
    .select({ name: players.name })
    .from(players)
    .all()
    .map((row) => row.name);
}

beforeEach(() => {
  db.delete(players).run();
});

afterAll(() => sqlite.closeSync());

it('commite le travail et rend son résultat', () => {
  expect(
    atomically(() => {
      addPlayer('Lou');
      return 42;
    }),
  ).toBe(42);
  expect(names()).toEqual(['Lou']);
});

it('annule tout ce qui a été écrit quand le travail lève', () => {
  expect(() =>
    atomically(() => {
      addPlayer('Lou');
      throw new Error('interrompu');
    }),
  ).toThrow('interrompu');
  expect(names()).toEqual([]);
});

it('fait rejoindre la transaction en cours à une transaction imbriquée', () => {
  atomically(() => {
    addPlayer('Lou');
    atomically(() => addPlayer('Nina'));
  });
  expect(names()).toEqual(['Lou', 'Nina']);
});

it('annule l’opération entière quand une transaction imbriquée échoue', () => {
  expect(() =>
    atomically(() => {
      addPlayer('Lou');
      atomically(() => {
        addPlayer('Nina');
        throw new Error('interrompu');
      });
    }),
  ).toThrow('interrompu');
  expect(names()).toEqual([]);
});

it('refuse un travail asynchrone et annule sa partie déjà écrite', () => {
  expect(() =>
    // @ts-expect-error — le typage refuse un callback qui renvoie une promesse.
    atomically(async () => {
      addPlayer('Lou');
    }),
  ).toThrow('Transaction asynchrone refusée');
  expect(names()).toEqual([]);
});

it('rouvre normalement une transaction après un échec', () => {
  expect(() =>
    atomically(() => {
      throw new Error('interrompu');
    }),
  ).toThrow();
  atomically(() => addPlayer('Lou'));
  expect(names()).toEqual(['Lou']);
});
