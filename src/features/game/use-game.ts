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
  seats: SeatedPlayer[];
  storedRounds: StoredRound[];
  inputs: RoundInput[];
  state?: GameState;
  /** Manche en cours de saisie, d'après `games.current_round`. */
  current?: { stored: StoredRound; input: RoundInput; index: number };
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
      return { ready: false, seats, storedRounds, inputs: [], issues: [] };
    }

    const inputs = storedRounds.map(toRoundInput);
    const state = computeGame(
      inputs,
      game.ruleset,
      seats.map((seat) => String(seat.id)),
    );

    const index = storedRounds.findIndex(
      (stored) => stored.round.roundNumber === game.currentRound,
    );
    const current =
      index >= 0 ? { stored: storedRounds[index], input: inputs[index], index } : undefined;

    return {
      ready: true,
      game,
      seats,
      storedRounds,
      inputs,
      state,
      current,
      issues: current ? validateRound(current.input, game.ruleset) : [],
      dealer: seats[(game.currentRound - 1) % seats.length],
    };
  }, [game, seatsQuery.data, roundsQuery.data, entriesQuery.data, eventsQuery.data]);
}
