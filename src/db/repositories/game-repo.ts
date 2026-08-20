/**
 * Cycle de vie d'une partie (PLAN.md §5 et §7.2).
 *
 * Chaque interaction de saisie écrit immédiatement en base : c'est ce qui rend
 * la reprise après un kill de l'app exacte, sans état à restaurer.
 */

import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { cardsDealtFor, computeGame, type Ruleset } from '@/core';

import { db } from '../client';
import { toRoundInput, type StoredRound } from '../mappers';
import {
  bonusEvents,
  gamePlayers,
  games,
  players,
  roundEntries,
  rounds,
  type BonusEventType,
  type Game,
} from '../schema';

/** Partie en cours, s'il y en a une — sert la carte « Reprendre » de l'accueil. */
export async function getActiveGame(): Promise<Game | undefined> {
  const [game] = await db
    .select()
    .from(games)
    .where(eq(games.status, 'in_progress'))
    .orderBy(desc(games.createdAt))
    .limit(1);
  return game;
}

/** Toutes les parties, la plus récente d'abord — à passer à `useLiveQuery` (§7.4). */
export function gamesQuery() {
  return db.select().from(games).orderBy(desc(games.createdAt));
}

/**
 * Total figé de chaque joueur, par partie.
 *
 * Lu dans les snapshots de `round_entries` plutôt que recalculé : c'est
 * exactement ce pour quoi ils existent (§5), et l'historique doit s'afficher
 * sans rejouer le moteur sur chaque partie de la liste.
 */
export function gameTotalsQuery() {
  return db
    .select({
      gameId: rounds.gameId,
      playerId: roundEntries.playerId,
      name: players.name,
      emoji: players.emoji,
      color: players.color,
      total: sql<number>`coalesce(sum(${roundEntries.scoreTotal}), 0)`,
    })
    .from(roundEntries)
    .innerJoin(rounds, eq(rounds.id, roundEntries.roundId))
    .innerJoin(players, eq(players.id, roundEntries.playerId))
    .groupBy(rounds.gameId, roundEntries.playerId);
}

export async function getGame(gameId: number): Promise<Game | undefined> {
  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  return game;
}

/**
 * Crée une partie et sa première manche.
 *
 * Une partie en cours est abandonnée plutôt que supprimée : son historique
 * partiel reste consultable.
 */
export async function createGame(playerIds: number[], ruleset: Ruleset): Promise<number> {
  const active = await getActiveGame();
  if (active) {
    await abandonGame(active.id);
  }

  const [game] = await db
    .insert(games)
    .values({ createdAt: Date.now(), ruleset, currentRound: 1, currentPhase: 'bidding' })
    .returning();

  await db
    .insert(gamePlayers)
    .values(playerIds.map((playerId, seatIndex) => ({ gameId: game.id, playerId, seatIndex })));

  await ensureRound(game.id, 1);
  return game.id;
}

/** Joueurs d'une partie, dans l'ordre de la table. */
export async function playerIdsOf(gameId: number): Promise<number[]> {
  const seats = await db
    .select({ playerId: gamePlayers.playerId, seatIndex: gamePlayers.seatIndex })
    .from(gamePlayers)
    .where(eq(gamePlayers.gameId, gameId));
  return seats.sort((a, b) => a.seatIndex - b.seatIndex).map((seat) => seat.playerId);
}

/**
 * Garantit l'existence d'une manche et de ses lignes joueurs, vides.
 * Le nombre de cartes distribuées suit le plan de manches, corrigé pour les
 * tables de 8 joueurs (PLAN.md §4.1).
 */
export async function ensureRound(gameId: number, roundNumber: number): Promise<number> {
  const existing = await db
    .select({ id: rounds.id })
    .from(rounds)
    .where(and(eq(rounds.gameId, gameId), eq(rounds.roundNumber, roundNumber)))
    .limit(1);
  if (existing.length > 0) return existing[0].id;

  const game = await getGame(gameId);
  if (!game) throw new Error(`Partie ${gameId} introuvable`);

  const seats = await playerIdsOf(gameId);
  const planned = game.ruleset.roundsPlan[roundNumber - 1] ?? roundNumber;
  const cardsDealt = Math.min(planned, cardsDealtFor(planned, seats.length));

  const [round] = await db.insert(rounds).values({ gameId, roundNumber, cardsDealt }).returning();

  await db.insert(roundEntries).values(seats.map((playerId) => ({ roundId: round.id, playerId })));

  return round.id;
}

/** Manche stockée, prête à être traduite pour le moteur. */
export async function getStoredRound(roundId: number): Promise<StoredRound | undefined> {
  const [round] = await db.select().from(rounds).where(eq(rounds.id, roundId)).limit(1);
  if (!round) return undefined;

  const [entries, events] = await Promise.all([
    db.select().from(roundEntries).where(eq(roundEntries.roundId, roundId)),
    db.select().from(bonusEvents).where(eq(bonusEvents.roundId, roundId)),
  ]);
  return { round, entries, bonusEvents: events };
}

export async function getStoredRounds(gameId: number): Promise<StoredRound[]> {
  const gameRounds = await db
    .select()
    .from(rounds)
    .where(eq(rounds.gameId, gameId))
    .orderBy(rounds.roundNumber);
  if (gameRounds.length === 0) return [];

  const ids = gameRounds.map((round) => round.id);
  const [entries, events] = await Promise.all([
    db.select().from(roundEntries).where(inArray(roundEntries.roundId, ids)),
    db.select().from(bonusEvents).where(inArray(bonusEvents.roundId, ids)),
  ]);

  return gameRounds.map((round) => ({
    round,
    entries: entries.filter((entry) => entry.roundId === round.id),
    bonusEvents: events.filter((event) => event.roundId === round.id),
  }));
}

// — Saisie ————————————————————————————————————————————————————————————————

type EntryPatch = Partial<{
  bid: number | null;
  tricks: number | null;
  bidModifier: number;
  rascalBet: number;
  cannonball: boolean;
  customBonus: number;
}>;

export async function updateEntry(
  roundId: number,
  playerId: number,
  patch: EntryPatch,
): Promise<void> {
  await db
    .update(roundEntries)
    .set(patch)
    .where(and(eq(roundEntries.roundId, roundId), eq(roundEntries.playerId, playerId)));
}

export async function setDestroyedTricks(roundId: number, count: number): Promise<void> {
  await db.update(rounds).set({ destroyedTricks: count }).where(eq(rounds.id, roundId));
}

/**
 * Pose un compteur de bonus de capture. Un compteur nul efface la ligne :
 * `bonus_events` ne contient que ce qui s'est réellement produit.
 */
export async function setCaptureBonus(
  roundId: number,
  playerId: number,
  type: BonusEventType,
  count: number,
): Promise<void> {
  await db
    .delete(bonusEvents)
    .where(
      and(
        eq(bonusEvents.roundId, roundId),
        eq(bonusEvents.playerId, playerId),
        eq(bonusEvents.type, type),
      ),
    );
  if (count > 0) {
    await db.insert(bonusEvents).values({ roundId, playerId, type, count });
  }
}

/** Ajoute une alliance de Butin — deux lignes miroir (PLAN.md §5). */
export async function addLootAlliance(
  roundId: number,
  playerId: number,
  allyId: number,
): Promise<void> {
  await db.insert(bonusEvents).values([
    { roundId, playerId, type: 'loot', count: 1, allyPlayerId: allyId },
    { roundId, playerId: allyId, type: 'loot', count: 1, allyPlayerId: playerId },
  ]);
}

export async function removeLootAlliance(
  roundId: number,
  playerId: number,
  allyId: number,
): Promise<void> {
  const events = await db
    .select()
    .from(bonusEvents)
    .where(and(eq(bonusEvents.roundId, roundId), eq(bonusEvents.type, 'loot')));

  const toDelete = [
    events.find((e) => e.playerId === playerId && e.allyPlayerId === allyId)?.id,
    events.find((e) => e.playerId === allyId && e.allyPlayerId === playerId)?.id,
  ].filter((id): id is number => id !== undefined);

  if (toDelete.length > 0) {
    await db.delete(bonusEvents).where(inArray(bonusEvents.id, toDelete));
  }
}

// — Progression ————————————————————————————————————————————————————————————

/** Identifiant de la manche en cours de saisie. */
async function currentRoundId(gameId: number): Promise<number | undefined> {
  const game = await getGame(gameId);
  if (!game) return undefined;
  const [round] = await db
    .select({ id: rounds.id })
    .from(rounds)
    .where(and(eq(rounds.gameId, gameId), eq(rounds.roundNumber, game.currentRound)))
    .limit(1);
  return round?.id;
}

/**
 * Pose 0 sur les cases qu'on n'a pas touchées.
 *
 * L'écran affiche 0 par défaut — autour de la table, on ne touche que ce qui
 * diffère (§7.2). Ce 0-là n'est écrit qu'au moment où la manche avance : avant,
 * `null` garde son sens de « pas encore saisi », qui empêche le moteur de
 * décompter une manche que personne n'a jouée.
 */
async function fillBlanks(roundId: number, fields: ('bid' | 'tricks')[]): Promise<void> {
  for (const field of fields) {
    await db
      .update(roundEntries)
      .set({ [field]: 0 })
      .where(and(eq(roundEntries.roundId, roundId), isNull(roundEntries[field])));
  }
}

export async function setPhase(gameId: number, phase: 'bidding' | 'results'): Promise<void> {
  if (phase === 'results') {
    const roundId = await currentRoundId(gameId);
    // Annonces **et** plis : à partir d'ici, le 0 affiché est la valeur, et
    // l'aperçu doit calculer exactement ce que la validation calculera.
    //
    // Ne matérialiser que les annonces laissait un joueur qui annonce 0 et ne
    // prend aucun pli — donc ne touche rien — hors du décompte : il n'était pas
    // « exact » aux yeux du moteur, et son alliance de Butin tombait à l'écran
    // alors qu'elle tenait après validation.
    if (roundId !== undefined) await fillBlanks(roundId, ['bid', 'tricks']);
  }
  await db.update(games).set({ currentPhase: phase }).where(eq(games.id, gameId));
}

/**
 * Valide la manche courante : fige les scores, puis ouvre la suivante ou
 * termine la partie.
 */
export async function validateRound(
  gameId: number,
  roundNumber: number,
  options: { forced?: boolean } = {},
): Promise<{ finished: boolean }> {
  const game = await getGame(gameId);
  if (!game) throw new Error(`Partie ${gameId} introuvable`);

  if (options.forced) {
    await db
      .update(rounds)
      .set({ forced: true })
      .where(and(eq(rounds.gameId, gameId), eq(rounds.roundNumber, roundNumber)));
  }

  // Ce qui reste vide vaut 0 : la manche est jouée, elle doit être décomptée
  // en entier — y compris les joueurs qui n'ont pris aucun pli.
  const [round] = await db
    .select({ id: rounds.id })
    .from(rounds)
    .where(and(eq(rounds.gameId, gameId), eq(rounds.roundNumber, roundNumber)))
    .limit(1);
  if (round) await fillBlanks(round.id, ['bid', 'tricks']);

  await persistScores(gameId);

  const isLastRound = roundNumber >= game.ruleset.roundsPlan.length;
  if (isLastRound) {
    await db
      .update(games)
      .set({ status: 'finished', finishedAt: Date.now() })
      .where(eq(games.id, gameId));
    return { finished: true };
  }

  await ensureRound(gameId, roundNumber + 1);
  await db
    .update(games)
    .set({ currentRound: roundNumber + 1, currentPhase: 'bidding' })
    .where(eq(games.id, gameId));
  return { finished: false };
}

/**
 * Rouvre une manche passée pour correction. Le recalcul en cascade est assuré
 * par `persistScores`, qui repasse par `computeGame` (PLAN.md §12.5).
 */
export async function reopenRound(gameId: number, roundNumber: number): Promise<void> {
  await db
    .update(games)
    .set({
      currentRound: roundNumber,
      currentPhase: 'results',
      status: 'in_progress',
      finishedAt: null,
    })
    .where(eq(games.id, gameId));
}

/**
 * Réécrit les scores figés de toute la partie.
 *
 * Jamais de delta appliqué à la main : on relit les manches et on redemande au
 * moteur, ce qui garantit qu'une correction se propage partout.
 */
export async function persistScores(gameId: number): Promise<void> {
  const game = await getGame(gameId);
  if (!game) return;

  const stored = await getStoredRounds(gameId);
  const state = computeGame(stored.map(toRoundInput), game.ruleset);

  for (const [index, result] of state.rounds.entries()) {
    const roundId = stored[index].round.id;
    for (const score of result.scores) {
      await db
        .update(roundEntries)
        .set({ scoreBase: score.base, scoreBonus: score.bonus, scoreTotal: score.total })
        .where(
          and(eq(roundEntries.roundId, roundId), eq(roundEntries.playerId, Number(score.playerId))),
        );
    }
  }
}

/**
 * Manche supplémentaire pour départager une égalité en fin de partie : le
 * livret la prévoit explicitement (PLAN.md §4.1).
 */
export async function addTiebreakRound(gameId: number): Promise<void> {
  const game = await getGame(gameId);
  if (!game) return;

  const roundsPlan = [...game.ruleset.roundsPlan];
  // La manche de départage reprend le format de la dernière manche jouée.
  roundsPlan.push(roundsPlan[roundsPlan.length - 1] ?? 1);
  const roundNumber = roundsPlan.length;

  await db
    .update(games)
    .set({
      ruleset: { ...game.ruleset, roundsPlan },
      status: 'in_progress',
      finishedAt: null,
      currentRound: roundNumber,
      currentPhase: 'bidding',
    })
    .where(eq(games.id, gameId));

  await ensureRound(gameId, roundNumber);
}

export async function abandonGame(gameId: number): Promise<void> {
  await db
    .update(games)
    .set({ status: 'abandoned', finishedAt: Date.now() })
    .where(eq(games.id, gameId));
}

export async function deleteGame(gameId: number): Promise<void> {
  await db.delete(games).where(eq(games.id, gameId));
}
