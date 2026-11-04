/** Transactions et reprise après interruption, sur SQLite réel (PLAN.md §5, §9). */
import { DEFAULT_RULESET } from '@/core';
import { db, sqlite } from '../../client';
import { bonusEvents, gamePlayers, games, players, roundEntries, rounds } from '../../schema';
import { eraseEverything } from '../backup-repo';
import {
  addLootAlliance,
  addPlayerToGame,
  addTiebreakRound,
  createGame,
  ensureRound,
  getGame,
  getStoredRound,
  getStoredRounds,
  removePlayerFromGame,
  reopenRound,
  seatedAtRound,
  setCaptureBonus,
  setPhase,
  updateEntry,
  validateRound,
} from '../game-repo';

jest.mock('../../client', () => jest.requireActual('../../__tests__/memory-db').memoryClient());

const RULES = { ...DEFAULT_RULESET, roundsPlan: [1, 2] };

/** Inclut les snapshots : un rollback doit annuler aussi les scores déjà réécrits. */
function contents() {
  return {
    games: db.select().from(games).all(),
    seats: db.select().from(gamePlayers).all(),
    rounds: db.select().from(rounds).all(),
    entries: db.select().from(roundEntries).all(),
    events: db.select().from(bonusEvents).all(),
  };
}

function failOn(event: string) {
  sqlite.execSync(`CREATE TEMP TRIGGER fail_write BEFORE ${event}
    BEGIN SELECT RAISE(ABORT, 'écriture interrompue'); END;`);
}

beforeEach(async () => {
  sqlite.execSync('DROP TRIGGER IF EXISTS fail_write');
  await eraseEverything();
  db.insert(players)
    .values(
      Array.from({ length: 9 }, (_, index) => ({
        id: index + 1,
        name: `Joueur ${index + 1}`,
        createdAt: index,
      })),
    )
    .run();
});

afterAll(() => sqlite.closeSync());

it('annule la création entière et conserve la partie active si sa première manche échoue', async () => {
  await createGame([1, 2], RULES);
  const before = contents();
  failOn('INSERT ON round_entries');

  await expect(createGame([2, 3], RULES)).rejects.toThrow('écriture interrompue');
  expect(contents()).toEqual(before);
});

it('conserve les clés étrangères dans les transactions de création', async () => {
  await createGame([1, 2], RULES);
  const before = contents();

  await expect(createGame([1, 99], RULES)).rejects.toThrow();
  expect(contents()).toEqual(before);
});

it.each([[1], [1, 1], [1, 2, 3, 4, 5, 6, 7, 8, 9]])(
  'refuse une table invalide sans abandonner la partie active : %j',
  async (...ids: number[]) => {
    await createGame([1, 2], RULES);
    const before = contents();
    await expect(createGame(ids, RULES)).rejects.toThrow();
    expect(contents()).toEqual(before);
  },
);

it('accepte neuf joueurs avec l’extension et borne la donne à neuf cartes', async () => {
  const gameId = await createGame([1, 2, 3, 4, 5, 6, 7, 8, 9], {
    ...RULES,
    expansion: true,
    roundsPlan: [10],
  });
  const [round] = getStoredRounds(gameId);
  expect(round.entries).toHaveLength(9);
  expect(round.round.cardsDealt).toBe(9);
});

it('annule une manche dont les entrées ne peuvent pas être créées, puis permet de réessayer', async () => {
  const gameId = await createGame([1, 2], RULES);
  const before = contents();
  failOn('INSERT ON round_entries');
  await expect(ensureRound(gameId, 2)).rejects.toThrow('écriture interrompue');
  expect(contents()).toEqual(before);

  sqlite.execSync('DROP TRIGGER fail_write');
  const roundId = await ensureRound(gameId, 2);
  expect(getStoredRound(roundId)?.entries).toHaveLength(2);
});

it('répare une ancienne manche vide en reprenant la table précédente, sans réasseoir un partant', async () => {
  const gameId = await createGame([1, 2, 3], RULES);
  await removePlayerFromGame(gameId, 3);
  const empty = db
    .insert(rounds)
    .values({ gameId, roundNumber: 2, cardsDealt: 2 })
    .returning()
    .get();

  expect(await ensureRound(gameId, 2)).toBe(empty.id);
  expect(seatedAtRound(gameId, 2)).toEqual([1, 2]);
  expect(await ensureRound(gameId, 2)).toBe(empty.id);
  expect(getStoredRound(empty.id)?.entries).toHaveLength(2);
});

it('répare également une première manche vide à partir des places de la partie', async () => {
  const gameId = await createGame([2, 1], RULES);
  const [round] = getStoredRounds(gameId);
  db.delete(roundEntries).run();

  expect(await ensureRound(gameId, 1)).toBe(round.round.id);
  expect(seatedAtRound(gameId, 1)).toEqual([2, 1]);
});

it('ne réintroduit pas un joueur retiré d’une manche qui contient encore des joueurs', async () => {
  const gameId = await createGame([1, 2, 3], RULES);
  await validateRound(gameId, 1);
  await removePlayerFromGame(gameId, 3);
  await ensureRound(gameId, 2);
  expect(seatedAtRound(gameId, 2)).toEqual([1, 2]);
});

it('annule les zéros implicites si le changement de phase échoue', async () => {
  const gameId = await createGame([1, 2], RULES);
  const before = contents();
  failOn('UPDATE ON games');
  await expect(setPhase(gameId, 'results')).rejects.toThrow('écriture interrompue');
  expect(contents()).toEqual(before);
});

it('annule scores, marquage forcé et progression si la manche suivante échoue', async () => {
  const gameId = await createGame([1, 2], RULES);
  await setPhase(gameId, 'results');
  const before = contents();
  failOn('INSERT ON round_entries');

  await expect(validateRound(gameId, 1, { forced: true })).rejects.toThrow('écriture interrompue');
  expect(contents()).toEqual(before);
});

it('annule une fin de partie si son changement de statut échoue', async () => {
  const gameId = await createGame([1, 2], { ...RULES, roundsPlan: [1] });
  const before = contents();
  failOn('UPDATE ON games');

  await expect(validateRound(gameId, 1)).rejects.toThrow('écriture interrompue');
  expect(contents()).toEqual(before);
});

it('valide, termine et recalcule en cascade une correction avec les mêmes transactions', async () => {
  const gameId = await createGame([1, 2], RULES);
  const [first] = getStoredRounds(gameId);
  await updateEntry(first.round.id, 1, { bid: 1, tricks: 1 });
  expect(await validateRound(gameId, 1)).toEqual({ finished: false });
  expect(getGame(gameId)).toMatchObject({ currentRound: 2, currentPhase: 'bidding' });
  expect(getStoredRounds(gameId)[1].entries.every((entry) => entry.scoreTotal === null)).toBe(true);
  expect(await validateRound(gameId, 2)).toEqual({ finished: true });

  await reopenRound(gameId, 1);
  await updateEntry(first.round.id, 1, { tricks: 0 });
  await validateRound(gameId, 1);
  expect(
    getStoredRounds(gameId).map((stored) => stored.entries.map((entry) => entry.scoreTotal)),
  ).toEqual([
    [-10, 10],
    [20, 20],
  ]);
});

it('annule une arrivée si la ligne de manche échoue après l’ajout de sa place', async () => {
  const gameId = await createGame([1, 2], RULES);
  const before = contents();
  failOn('INSERT ON round_entries');
  await expect(addPlayerToGame(gameId, 3)).rejects.toThrow('écriture interrompue');
  expect(contents()).toEqual(before);
});

it('annule le départ et les deux côtés du Butin si le recalcul échoue', async () => {
  const gameId = await createGame([1, 2, 3], RULES);
  const [round] = getStoredRounds(gameId);
  await addLootAlliance(round.round.id, 1, 3);
  const before = contents();
  // Le deuxième snapshot échoue après suppression du joueur et des alliances.
  failOn('UPDATE OF score_total ON round_entries WHEN OLD.player_id = 2');
  await expect(removePlayerFromGame(gameId, 3)).rejects.toThrow('écriture interrompue');
  expect(contents()).toEqual(before);
});

it('conserve les manches passées d’un partant et fait démarrer un arrivant à zéro', async () => {
  const gameId = await createGame([1, 2, 3], RULES);
  await validateRound(gameId, 1);
  await removePlayerFromGame(gameId, 3);
  await addPlayerToGame(gameId, 4);
  const [first, second] = getStoredRounds(gameId);
  expect(first.entries.map((entry) => entry.playerId)).toEqual([1, 2, 3]);
  expect(first.entries.every((entry) => entry.scoreTotal === 10)).toBe(true);
  expect(second.entries.map((entry) => entry.playerId)).toEqual([1, 2, 4]);
  expect(second.entries.every((entry) => entry.scoreTotal === null)).toBe(true);
});

it('conserve le bonus précédent si son remplacement échoue après suppression', async () => {
  const gameId = await createGame([1, 2], RULES);
  const [round] = getStoredRounds(gameId);
  await setCaptureBonus(round.round.id, 1, 'skullKingCapturesPirate', 1);
  const before = contents();
  failOn('INSERT ON bonus_events');
  await expect(setCaptureBonus(round.round.id, 1, 'skullKingCapturesPirate', 2)).rejects.toThrow(
    'écriture interrompue',
  );
  expect(contents()).toEqual(before);
});

it('conserve la partie terminée et son plan si le départage ne peut pas être créé', async () => {
  const gameId = await createGame([1, 2], { ...RULES, roundsPlan: [1] });
  await validateRound(gameId, 1);
  const before = contents();
  failOn('INSERT ON round_entries');
  await expect(addTiebreakRound(gameId)).rejects.toThrow('écriture interrompue');
  expect(contents()).toEqual(before);

  sqlite.execSync('DROP TRIGGER fail_write');
  await addTiebreakRound(gameId);
  expect(getGame(gameId)).toMatchObject({
    status: 'in_progress',
    currentRound: 2,
    finishedAt: null,
  });
  expect(getStoredRounds(gameId)[1].round.cardsDealt).toBe(1);
});
