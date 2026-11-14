/**
 * Export et import contre une vraie base SQLite (PLAN.md §11, critère « export →
 * import sans perte »), et la garantie qui va avec : un import qui échoue ne
 * touche à rien.
 */

import { DEFAULT_RULESET } from '@/core';

import { BACKUP_APP, BACKUP_VERSION, type BackupDocument } from '../../backup-format';
import { exportBackup, importBackup } from '../backup-repo';
import { gameTotalsQuery } from '../game-repo';

jest.mock('../../client', () => jest.requireActual('../../__tests__/memory-db').memoryClient());

function backup(): BackupDocument {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: 1_700_000_000_000,
    players: [
      { id: 1, name: 'Lou', emoji: '🦜', color: '#E8785A', createdAt: 1, archivedAt: null },
      { id: 2, name: 'Nina', emoji: '⚓', color: null, createdAt: 2, archivedAt: null },
    ],
    games: [
      {
        id: 7,
        createdAt: 1_699_000_000_000,
        finishedAt: 1_699_000_100_000,
        status: 'finished',
        ruleset: { ...DEFAULT_RULESET, roundsPlan: [1] },
        currentRound: 1,
        currentPhase: 'results',
        seats: [
          { playerId: 1, seatIndex: 0 },
          { playerId: 2, seatIndex: 1 },
        ],
        rounds: [
          {
            roundNumber: 1,
            cardsDealt: 1,
            destroyedTricks: 0,
            forced: false,
            entries: [
              {
                playerId: 1,
                bid: 1,
                tricks: 1,
                bidModifier: 0,
                rascalBet: 0,
                cannonball: false,
                customBonus: 0,
              },
              {
                playerId: 2,
                bid: 0,
                tricks: 0,
                bidModifier: 0,
                rascalBet: 0,
                cannonball: false,
                customBonus: 5,
              },
            ],
            bonusEvents: [{ playerId: 1, type: 'black14', count: 1, allyPlayerId: null }],
          },
        ],
      },
    ],
  };
}

async function totals(): Promise<Record<string, number>> {
  const rows = await gameTotalsQuery();
  return Object.fromEntries(rows.map((row) => [`${row.gameId}/${row.name}`, row.total]));
}

beforeEach(async () => {
  // Chaque test part d'une base contenant la sauvegarde de référence.
  await importBackup(backup());
});

it('relit exactement ce qui a été importé', async () => {
  const { exportedAt: _ignored, ...exported } = await exportBackup();
  const { exportedAt: _source, ...source } = backup();
  expect(exported).toEqual(source);
});

it('reconstruit les scores figés depuis la saisie', async () => {
  // Lou : mise 1 exacte (+20) et 14 noir (+20). Nina : mise 0 sur une carte
  // (+10) et 5 d'ajustement manuel.
  expect(await totals()).toEqual({ '7/Lou': 40, '7/Nina': 15 });
});

/**
 * Le moteur ne sait pas décompter une édition inconnue. L'import doit alors
 * échouer d'un bloc : la base d'avant reste là, scores figés compris.
 */
it('laisse la base intacte quand le moteur ne sait pas décompter une partie', async () => {
  const before = await exportBackup();
  const unreadable = backup();
  unreadable.players = [{ ...unreadable.players[0], name: 'Intrus' }, unreadable.players[1]];
  unreadable.games[0].ruleset = { ...DEFAULT_RULESET, edition: 'future' as never };

  await expect(importBackup(unreadable)).rejects.toThrow();

  expect({ ...(await exportBackup()), exportedAt: 0 }).toEqual({ ...before, exportedAt: 0 });
  expect(await totals()).toEqual({ '7/Lou': 40, '7/Nina': 15 });
});
