/**
 * Cycle de vie d'une partie (PLAN.md §5 et §7.2).
 *
 * Chaque interaction de saisie écrit immédiatement en base : c'est ce qui rend
 * la reprise après un kill de l'app exacte, sans état à restaurer.
 *
 * Les opérations composées passent par `atomically` (PLAN.md §5) : tout ou
 * rien, dans une transaction synchrone. Les helpers y écrivent avec `.all()`,
 * `.get()` et `.run()`, sans `await` qui rendrait la main avant le commit. Les
 * actions publiques restent des promesses pour que leurs appelants puissent
 * attendre le résultat et traiter les erreurs.
 */

import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';

import {
  cardsDealtFor,
  computeGame,
  DEFAULT_ROUNDS_PLAN,
  maxPlayersFor,
  MIN_PLAYERS,
  type Ruleset,
} from '@/core';

import { db } from '../client';
import { isEntryPlayed, toRoundInput, type StoredRound } from '../mappers';
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
import { atomically } from '../transaction';

/** Partie en cours, s'il y en a une — sert la carte « Reprendre » de l'accueil. */
export function getActiveGame(): Game | undefined {
  const [game] = db
    .select()
    .from(games)
    .where(eq(games.status, 'in_progress'))
    .orderBy(desc(games.createdAt))
    .limit(1)
    .all();
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

export function getGame(gameId: number): Game | undefined {
  const [game] = db.select().from(games).where(eq(games.id, gameId)).limit(1).all();
  return game;
}

/**
 * Crée une partie et sa première manche.
 *
 * Une partie en cours est abandonnée plutôt que supprimée : son historique
 * partiel reste consultable.
 */
export async function createGame(playerIds: number[], ruleset: Ruleset): Promise<number> {
  return atomically(() => {
    // Vérifier avant d'abandonner la partie active (PLAN.md §4.1 et §4.6).
    if (playerIds.length < MIN_PLAYERS || playerIds.length > maxPlayersFor(ruleset)) {
      throw new Error('Nombre de joueurs incompatible avec les règles de la partie');
    }
    if (new Set(playerIds).size !== playerIds.length) {
      throw new Error('Un joueur ne peut pas occuper deux places');
    }
    const active = getActiveGame();
    if (active) {
      db.update(games)
        .set({ status: 'abandoned', finishedAt: Date.now() })
        .where(eq(games.id, active.id))
        .run();
    }

    const [game] = db
      .insert(games)
      .values({ createdAt: Date.now(), ruleset, currentRound: 1, currentPhase: 'bidding' })
      .returning()
      .all();

    db.insert(gamePlayers)
      .values(playerIds.map((playerId, seatIndex) => ({ gameId: game.id, playerId, seatIndex })))
      .run();

    ensureRoundRows(game.id, 1);
    return game.id;
  });
}

/** Joueurs d'une partie, dans l'ordre de la table. */
export function playerIdsOf(gameId: number): number[] {
  const seats = db
    .select({ playerId: gamePlayers.playerId, seatIndex: gamePlayers.seatIndex })
    .from(gamePlayers)
    .where(eq(gamePlayers.gameId, gameId))
    .all();
  return seats.sort((a, b) => a.seatIndex - b.seatIndex).map((seat) => seat.playerId);
}

/**
 * Joueurs assis à une manche donnée, dans l'ordre de la table.
 *
 * C'est la **ligne de manche qui fait foi** (PLAN.md §7.5) : un joueur parti à
 * la manche 5 n'a plus de ligne à partir de la 6, un arrivant en a une à partir
 * de son arrivée. `game_players` garde, lui, le roster complet de la partie.
 */
export function seatedAtRound(gameId: number, roundNumber: number): number[] {
  const seats = db
    .select({ playerId: roundEntries.playerId, seatIndex: gamePlayers.seatIndex })
    .from(roundEntries)
    .innerJoin(rounds, eq(roundEntries.roundId, rounds.id))
    .innerJoin(
      gamePlayers,
      and(eq(gamePlayers.gameId, rounds.gameId), eq(gamePlayers.playerId, roundEntries.playerId)),
    )
    .where(and(eq(rounds.gameId, gameId), eq(rounds.roundNumber, roundNumber)))
    .all();
  return seats.sort((a, b) => a.seatIndex - b.seatIndex).map((seat) => seat.playerId);
}

/**
 * Garantit l'existence d'une manche et de ses lignes joueurs, vides.
 * Le nombre de cartes distribuées suit le plan de manches, corrigé pour les
 * tables de 8 joueurs (PLAN.md §4.1).
 *
 * La table héritée est celle de la manche précédente, pas celle de la création
 * de la partie : c'est ce qui fait qu'un départ ou une arrivée entre deux
 * manches se propage tout seul aux manches suivantes (§7.5).
 */
export async function ensureRound(gameId: number, roundNumber: number): Promise<number> {
  return atomically(() => ensureRoundRows(gameId, roundNumber));
}

/** Appelé dans la transaction de création, de validation ou de départage. */
function ensureRoundRows(gameId: number, roundNumber: number): number {
  const existing = db
    .select({ id: rounds.id })
    .from(rounds)
    .where(and(eq(rounds.gameId, gameId), eq(rounds.roundNumber, roundNumber)))
    .limit(1)
    .all();
  if (existing.length > 0) {
    const entry = db
      .select({ id: roundEntries.id })
      .from(roundEntries)
      .where(eq(roundEntries.roundId, existing[0].id))
      .limit(1)
      .get();
    // Réparer une création interrompue par une ancienne version. Une manche
    // non vide garde sa table, même si elle diffère de la manche précédente.
    if (entry) return existing[0].id;
  }

  const game = getGame(gameId);
  if (!game) throw new Error(`Partie ${gameId} introuvable`);

  const previous = roundNumber > 1 ? seatedAtRound(gameId, roundNumber - 1) : [];
  const seats = previous.length > 0 ? previous : playerIdsOf(gameId);
  const planned = game.ruleset.roundsPlan[roundNumber - 1] ?? roundNumber;
  // Le paquet dépend des règles : l'extension en ajoute 19 cartes (§4.6).
  const cardsDealt = Math.min(planned, cardsDealtFor(planned, seats.length, game.ruleset));

  const round =
    existing[0] ?? db.insert(rounds).values({ gameId, roundNumber, cardsDealt }).returning().get();

  db.insert(roundEntries)
    .values(seats.map((playerId) => ({ roundId: round.id, playerId })))
    .run();

  return round.id;
}

/** Manche stockée, prête à être traduite pour le moteur. */
export function getStoredRound(roundId: number): StoredRound | undefined {
  const [round] = db.select().from(rounds).where(eq(rounds.id, roundId)).limit(1).all();
  if (!round) return undefined;

  const entries = db.select().from(roundEntries).where(eq(roundEntries.roundId, roundId)).all();
  const events = db.select().from(bonusEvents).where(eq(bonusEvents.roundId, roundId)).all();
  return { round, entries, bonusEvents: events };
}

export function getStoredRounds(gameId: number): StoredRound[] {
  const gameRounds = db
    .select()
    .from(rounds)
    .where(eq(rounds.gameId, gameId))
    .orderBy(rounds.roundNumber)
    .all();
  if (gameRounds.length === 0) return [];

  const ids = gameRounds.map((round) => round.id);
  const entries = db.select().from(roundEntries).where(inArray(roundEntries.roundId, ids)).all();
  const events = db.select().from(bonusEvents).where(inArray(bonusEvents.roundId, ids)).all();

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
  db.update(roundEntries)
    .set(patch)
    .where(and(eq(roundEntries.roundId, roundId), eq(roundEntries.playerId, playerId)))
    .run();
}

export async function setDestroyedTricks(roundId: number, count: number): Promise<void> {
  db.update(rounds).set({ destroyedTricks: count }).where(eq(rounds.id, roundId)).run();
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
  return atomically(() => {
    db.delete(bonusEvents)
      .where(
        and(
          eq(bonusEvents.roundId, roundId),
          eq(bonusEvents.playerId, playerId),
          eq(bonusEvents.type, type),
        ),
      )
      .run();
    if (count > 0) {
      db.insert(bonusEvents).values({ roundId, playerId, type, count }).run();
    }
  });
}

/** Ajoute une alliance de Butin — deux lignes miroir (PLAN.md §5). */
export async function addLootAlliance(
  roundId: number,
  playerId: number,
  allyId: number,
): Promise<void> {
  db.insert(bonusEvents)
    .values([
      { roundId, playerId, type: 'loot', count: 1, allyPlayerId: allyId },
      { roundId, playerId: allyId, type: 'loot', count: 1, allyPlayerId: playerId },
    ])
    .run();
}

export async function removeLootAlliance(
  roundId: number,
  playerId: number,
  allyId: number,
): Promise<void> {
  return atomically(() => {
    const events = db
      .select()
      .from(bonusEvents)
      .where(and(eq(bonusEvents.roundId, roundId), eq(bonusEvents.type, 'loot')))
      .all();

    const toDelete = [
      events.find((e) => e.playerId === playerId && e.allyPlayerId === allyId)?.id,
      events.find((e) => e.playerId === allyId && e.allyPlayerId === playerId)?.id,
    ].filter((id): id is number => id !== undefined);

    if (toDelete.length > 0) {
      db.delete(bonusEvents).where(inArray(bonusEvents.id, toDelete)).run();
    }
  });
}

// — Progression ————————————————————————————————————————————————————————————

/** Identifiant de la manche en cours de saisie. */
function currentRoundId(gameId: number): number | undefined {
  const game = getGame(gameId);
  if (!game) return undefined;
  const [round] = db
    .select({ id: rounds.id })
    .from(rounds)
    .where(and(eq(rounds.gameId, gameId), eq(rounds.roundNumber, game.currentRound)))
    .limit(1)
    .all();
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
function fillBlanks(roundId: number, fields: ('bid' | 'tricks')[]): void {
  for (const field of fields) {
    db.update(roundEntries)
      .set({ [field]: 0 })
      .where(and(eq(roundEntries.roundId, roundId), isNull(roundEntries[field])))
      .run();
  }
}

export async function setPhase(gameId: number, phase: 'bidding' | 'results'): Promise<void> {
  return atomically(() => {
    if (phase === 'results') {
      const roundId = currentRoundId(gameId);
      // Les annonces, et elles seules : la phase Annonces est close, le 0 affiché
      // à l'écran devient la mise du joueur.
      //
      // Les plis, eux, restent `null` — c'est ce qui distingue « pas encore
      // saisi » de « aucun pli pris », et donc ce qui empêche l'écran d'afficher
      // le score d'une manche que personne n'a encore jouée (§7.2). Le moteur,
      // lui, lit déjà ces plis vides comme des 0 : `toRoundInput({ forcePlayed })`.
      if (roundId !== undefined) fillBlanks(roundId, ['bid']);
    }
    db.update(games).set({ currentPhase: phase }).where(eq(games.id, gameId)).run();
  });
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
  return atomically(() => {
    const game = getGame(gameId);
    if (!game) throw new Error(`Partie ${gameId} introuvable`);

    if (options.forced) {
      db.update(rounds)
        .set({ forced: true })
        .where(and(eq(rounds.gameId, gameId), eq(rounds.roundNumber, roundNumber)))
        .run();
    }

    // Ce qui reste vide vaut 0 : la manche est jouée, elle doit être décomptée
    // en entier — y compris les joueurs qui n'ont pris aucun pli.
    const [round] = db
      .select({ id: rounds.id })
      .from(rounds)
      .where(and(eq(rounds.gameId, gameId), eq(rounds.roundNumber, roundNumber)))
      .limit(1)
      .all();
    if (round) fillBlanks(round.id, ['bid', 'tricks']);

    persistScores(gameId);

    const isLastRound = roundNumber >= game.ruleset.roundsPlan.length;
    if (isLastRound) {
      db.update(games)
        .set({ status: 'finished', finishedAt: Date.now() })
        .where(eq(games.id, gameId))
        .run();
      return { finished: true };
    }

    ensureRoundRows(gameId, roundNumber + 1);
    db.update(games)
      .set({ currentRound: roundNumber + 1, currentPhase: 'bidding' })
      .where(eq(games.id, gameId))
      .run();
    return { finished: false };
  });
}

/**
 * Rouvre une manche passée pour correction. Le recalcul en cascade est assuré
 * par `persistScores`, qui repasse par `computeGame` (PLAN.md §12.5).
 */
export async function reopenRound(gameId: number, roundNumber: number): Promise<void> {
  db.update(games)
    .set({
      currentRound: roundNumber,
      currentPhase: 'results',
      status: 'in_progress',
      finishedAt: null,
    })
    .where(eq(games.id, gameId))
    .run();
}

/**
 * Réécrit les scores figés de toute la partie.
 *
 * Jamais de delta appliqué à la main : on relit les manches et on redemande au
 * moteur, ce qui garantit qu'une correction se propage partout.
 *
 * Une ligne qu'on n'a pas fini de saisir n'a pas de score : ses colonnes
 * restent `null`. Sans cela, valider une correction figerait un 0 sur toutes
 * les manches encore à jouer — et ce 0 jamais joué ressortirait en
 * « meilleure manche » dans les stats d'une partie tout en négatif (§8).
 *
 * Appelée depuis une validation, un changement de table ou un import, elle
 * rejoint leur transaction ; seule, elle ouvre la sienne.
 */
export function persistScores(gameId: number): void {
  atomically(() => rewriteScores(gameId));
}

function rewriteScores(gameId: number): void {
  const game = getGame(gameId);
  if (!game) return;

  const stored = getStoredRounds(gameId);
  const state = computeGame(
    stored.map((round) => toRoundInput(round)),
    game.ruleset,
  );

  for (const [index, result] of state.rounds.entries()) {
    const { round, entries } = stored[index];
    for (const score of result.scores) {
      const playerId = Number(score.playerId);
      const entry = entries.find((row) => row.playerId === playerId);
      const played = entry !== undefined && isEntryPlayed(entry);
      db.update(roundEntries)
        .set(
          played
            ? { scoreBase: score.base, scoreBonus: score.bonus, scoreTotal: score.total }
            : { scoreBase: null, scoreBonus: null, scoreTotal: null },
        )
        .where(and(eq(roundEntries.roundId, round.id), eq(roundEntries.playerId, playerId)))
        .run();
    }
  }
}

/**
 * Manche supplémentaire pour départager une égalité en fin de partie : le
 * livret la prévoit explicitement (PLAN.md §4.1).
 */
export async function addTiebreakRound(gameId: number): Promise<void> {
  return atomically(() => {
    const game = getGame(gameId);
    if (!game) return;

    const roundsPlan = [...game.ruleset.roundsPlan];
    // La manche de départage reprend le format de la dernière manche jouée.
    roundsPlan.push(roundsPlan[roundsPlan.length - 1] ?? 1);
    const roundNumber = roundsPlan.length;

    db.update(games)
      .set({
        ruleset: { ...game.ruleset, roundsPlan },
        status: 'in_progress',
        finishedAt: null,
        currentRound: roundNumber,
        currentPhase: 'bidding',
      })
      .where(eq(games.id, gameId))
      .run();

    ensureRoundRows(gameId, roundNumber);
  });
}

// — Réglages d'une partie en cours (PLAN.md §7.5) ——————————————————————————

/**
 * Change le nombre de manches d'une partie déjà commencée.
 *
 * Le plancher est la manche en cours : raccourcir une partie ne peut pas
 * effacer ce qui s'est joué. Le format des manches déjà prévues est conservé —
 * une manche de départage ajoutée par `addTiebreakRound()` garde le sien.
 */
export async function setRoundsCount(gameId: number, count: number): Promise<void> {
  return atomically(() => {
    const game = getGame(gameId);
    if (!game) return;

    const target = Math.max(count, game.currentRound);
    const current = game.ruleset.roundsPlan;
    const roundsPlan = Array.from(
      { length: target },
      (_, index) => current[index] ?? DEFAULT_ROUNDS_PLAN[index] ?? index + 1,
    );

    db.update(games)
      .set({ ruleset: { ...game.ruleset, roundsPlan } })
      .where(eq(games.id, gameId))
      .run();
  });
}

/**
 * Recalcule les cartes distribuées d'une manche après un changement de table.
 *
 * Le paquet ne suit pas : à 9 joueurs, la dernière manche ne peut plus en
 * distribuer 10 (§4.1). Une arrivée ou un départ peut donc faire bouger la
 * donne de la manche en cours.
 */
function refreshCardsDealt(gameId: number, roundNumber: number): void {
  const game = getGame(gameId);
  if (!game) return;

  const seats = seatedAtRound(gameId, roundNumber);
  if (seats.length === 0) return;

  const planned = game.ruleset.roundsPlan[roundNumber - 1] ?? roundNumber;
  const cardsDealt = Math.min(planned, cardsDealtFor(planned, seats.length, game.ruleset));
  db.update(rounds)
    .set({ cardsDealt })
    .where(and(eq(rounds.gameId, gameId), eq(rounds.roundNumber, roundNumber)))
    .run();
}

/**
 * Assoit un joueur à partir de la manche en cours.
 *
 * Il démarre à 0 : aucune ligne n'est créée sur les manches passées, donc le
 * moteur ne lui compte rien avant son arrivée (PLAN.md §7.5). Sa place à table
 * est la dernière — la donne continuera de tourner dans le même ordre.
 */
export async function addPlayerToGame(gameId: number, playerId: number): Promise<void> {
  return atomically(() => {
    const game = getGame(gameId);
    const roundId = currentRoundId(gameId);
    if (!game || roundId === undefined) return;

    const seats = db.select().from(gamePlayers).where(eq(gamePlayers.gameId, gameId)).all();
    if (!seats.some((seat) => seat.playerId === playerId)) {
      const seatIndex = seats.reduce((last, seat) => Math.max(last, seat.seatIndex), -1) + 1;
      db.insert(gamePlayers).values({ gameId, playerId, seatIndex }).run();
    }

    const existing = db
      .select({ id: roundEntries.id })
      .from(roundEntries)
      .where(and(eq(roundEntries.roundId, roundId), eq(roundEntries.playerId, playerId)))
      .limit(1)
      .all();
    if (existing.length === 0) {
      db.insert(roundEntries).values({ roundId, playerId }).run();
    }

    refreshCardsDealt(gameId, game.currentRound);
    persistScores(gameId);
  });
}

/**
 * Sort un joueur de la table à partir de la manche en cours.
 *
 * Sa ligne `game_players` reste : ses manches passées, son total et sa place au
 * classement ne bougent plus, mais ils restent (PLAN.md §7.5). Seule sa ligne de
 * la manche en cours disparaît, avec les bonus qu'elle portait — alliances de
 * Butin comprises, dont la ligne miroir vit chez l'allié.
 */
export async function removePlayerFromGame(gameId: number, playerId: number): Promise<void> {
  return atomically(() => {
    const game = getGame(gameId);
    const roundId = currentRoundId(gameId);
    if (!game || roundId === undefined) return;

    db.delete(bonusEvents)
      .where(
        and(
          eq(bonusEvents.roundId, roundId),
          or(eq(bonusEvents.playerId, playerId), eq(bonusEvents.allyPlayerId, playerId)),
        ),
      )
      .run();
    db.delete(roundEntries)
      .where(and(eq(roundEntries.roundId, roundId), eq(roundEntries.playerId, playerId)))
      .run();

    refreshCardsDealt(gameId, game.currentRound);
    persistScores(gameId);
  });
}

export async function abandonGame(gameId: number): Promise<void> {
  db.update(games)
    .set({ status: 'abandoned', finishedAt: Date.now() })
    .where(eq(games.id, gameId))
    .run();
}

export async function deleteGame(gameId: number): Promise<void> {
  db.delete(games).where(eq(games.id, gameId)).run();
}
