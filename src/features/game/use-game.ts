/**
 * Lecture d'une partie : la base est la source de vérité, le moteur fait le
 * reste (PLAN.md §6).
 *
 * `useLiveQuery` réabonne l'UI à chaque écriture, ce qui rend la saisie
 * immédiatement visible sans état local à synchroniser — et rend la reprise
 * après un kill de l'app exacte par construction.
 */

import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { computeGame, validateRound, type GameState, type Issue, type RoundInput } from '@/core';
import { db } from '@/db/client';
import { toRoundInput, type StoredRound } from '@/db/mappers';
import {
  bonusEvents,
  gamePlayers,
  games,
  players,
  roundEntries,
  rounds,
  type Game,
} from '@/db/schema';

import { pendingRoundOf, settledScoresOf, type SettledScores } from './settled-scores';

export interface SeatedPlayer {
  id: number;
  name: string;
  emoji: string | null;
  color: string | null;
  seatIndex: number;
}

export interface GameView {
  ready: boolean;
  game?: Game;
  /**
   * Tous les joueurs de la partie, ceux qui l'ont quittée compris.
   *
   * C'est ce roster que voient la feuille de score, le podium et le moteur : un
   * joueur retiré en cours de route garde ses manches et son rang (PLAN.md §7.5).
   */
  seats: SeatedPlayer[];
  /**
   * Joueurs assis à la manche en cours — ceux qui ont une ligne dedans.
   *
   * C'est la table du moment : l'écran de partie ne saisit que ceux-là.
   */
  activeSeats: SeatedPlayer[];
  storedRounds: StoredRound[];
  inputs: RoundInput[];
  state?: GameState;
  /** Manche en cours de saisie, d'après `games.current_round`. */
  current?: { stored: StoredRound; input: RoundInput; index: number };
  /**
   * Scores **acquis** : ceux des manches déjà validées.
   *
   * `state` donne l'aperçu, manche ouverte comprise — c'est lui qui montre ce
   * que la manche en cours rapportera. Les cumuls affichés, eux, ne bougent
   * qu'à la validation (voir `settledScoresOf`).
   */
  settled: SettledScores;
  /**
   * Manche en train de se jouer : son score n'est qu'un aperçu (§7.2).
   *
   * Ce n'est pas forcément la dernière de la feuille — une manche rouverte
   * pour correction se rejoue à sa place dans la partie.
   */
  pendingRound?: number;
  /** Anomalies de la manche courante, telles que renvoyées par le moteur. */
  issues: Issue[];
  /** Joueur qui distribue : la donne tourne d'une manche à l'autre (§7.2). */
  dealer?: SeatedPlayer;
}

export function useGame(gameId: number): GameView {
  const gameQuery = useLiveQuery(db.select().from(games).where(eq(games.id, gameId)));

  const seatsQuery = useLiveQuery(
    db
      .select({
        id: players.id,
        name: players.name,
        emoji: players.emoji,
        color: players.color,
        seatIndex: gamePlayers.seatIndex,
      })
      .from(gamePlayers)
      .innerJoin(players, eq(gamePlayers.playerId, players.id))
      .where(eq(gamePlayers.gameId, gameId)),
  );

  const roundsQuery = useLiveQuery(
    db.select().from(rounds).where(eq(rounds.gameId, gameId)).orderBy(rounds.roundNumber),
  );

  const entriesQuery = useLiveQuery(
    db
      .select({ entry: roundEntries })
      .from(roundEntries)
      .innerJoin(rounds, eq(roundEntries.roundId, rounds.id))
      .where(eq(rounds.gameId, gameId)),
  );

  const eventsQuery = useLiveQuery(
    db
      .select({ event: bonusEvents })
      .from(bonusEvents)
      .innerJoin(rounds, eq(bonusEvents.roundId, rounds.id))
      .where(eq(rounds.gameId, gameId)),
  );

  const game = gameQuery.data[0];

  return useMemo(() => {
    const seats = [...seatsQuery.data].sort((a, b) => a.seatIndex - b.seatIndex);
    const entries = entriesQuery.data.map((row) => row.entry);
    const events = eventsQuery.data.map((row) => row.event);

    const storedRounds: StoredRound[] = roundsQuery.data.map((round) => ({
      round,
      entries: entries
        .filter((entry) => entry.roundId === round.id)
        // L'ordre de la table prime sur l'ordre d'insertion.
        .sort(
          (a, b) =>
            seats.findIndex((seat) => seat.id === a.playerId) -
            seats.findIndex((seat) => seat.id === b.playerId),
        ),
      bonusEvents: events.filter((event) => event.roundId === round.id),
    }));

    if (!game || seats.length === 0) {
      return {
        ready: false,
        seats,
        activeSeats: seats,
        storedRounds,
        inputs: [],
        settled: { totals: {}, standings: [], leaders: [], tie: false },
        issues: [],
      };
    }

    const roster = seats.map((seat) => String(seat.id));
    const inputs = storedRounds.map((stored) =>
      toRoundInput(stored, {
        // La manche qu'on est en train de jouer se décompte comme à la
        // validation : un pli laissé vide vaut 0 pris (voir `toRoundInput`).
        forcePlayed:
          stored.round.roundNumber === game.currentRound && game.currentPhase === 'results',
      }),
    );
    const state = computeGame(inputs, game.ruleset, roster);

    const index = storedRounds.findIndex(
      (stored) => stored.round.roundNumber === game.currentRound,
    );
    const current =
      index >= 0 ? { stored: storedRounds[index], input: inputs[index], index } : undefined;

    const pendingRound = pendingRoundOf(game, storedRounds);

    // La table du moment se lit dans les lignes de la manche en cours : c'est
    // elle qui dit qui est assis, une fois qu'on peut partir ou arriver en
    // cours de partie (PLAN.md §7.5).
    const activeSeats = current
      ? seats.filter((seat) => current.stored.entries.some((entry) => entry.playerId === seat.id))
      : seats;

    return {
      ready: true,
      game,
      seats,
      activeSeats,
      storedRounds,
      inputs,
      state,
      current,
      settled: settledScoresOf(state, roster, pendingRound),
      pendingRound,
      issues: current ? validateRound(current.input, game.ruleset) : [],
      // La donne tourne sur la table du moment, pas sur les partants.
      dealer: activeSeats[(game.currentRound - 1) % Math.max(activeSeats.length, 1)],
    };
  }, [game, seatsQuery.data, roundsQuery.data, entriesQuery.data, eventsQuery.data]);
}
