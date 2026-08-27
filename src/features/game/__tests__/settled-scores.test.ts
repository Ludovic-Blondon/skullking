import { computeGame, DEFAULT_RULESET } from '@/core';
import { toRoundInput, type StoredRound } from '@/db/mappers';
import type { Game, Round, RoundEntry } from '@/db/schema';

import { pendingRoundOf, settledScoresOf } from '../settled-scores';

function entry(playerId: number, bid: number, tricks: number | null): RoundEntry {
  return {
    id: playerId,
    roundId: 1,
    playerId,
    bid,
    tricks,
    bidModifier: 0,
    rascalBet: 0,
    cannonball: false,
    customBonus: 0,
    scoreBase: null,
    scoreBonus: null,
    scoreTotal: null,
  };
}

function storedRound(roundNumber: number, entries: RoundEntry[]): StoredRound {
  const round: Round = {
    id: roundNumber,
    gameId: 1,
    roundNumber,
    cardsDealt: roundNumber,
    destroyedTricks: 0,
    forced: false,
  };
  return { round, entries: entries.map((e) => ({ ...e, roundId: roundNumber })), bonusEvents: [] };
}

function game(overrides: Partial<Game> = {}): Game {
  return {
    id: 1,
    createdAt: 0,
    finishedAt: null,
    status: 'in_progress',
    ruleset: DEFAULT_RULESET,
    currentRound: 2,
    currentPhase: 'results',
    ...overrides,
  };
}

const roster = ['1', '2'];

/**
 * Manche 1 jouée : Alice tient sa mise 1 (+20), Bob sa mise 0 (+10).
 * Manche 2 en cours : Alice a annoncé 2 sans avoir posé de pli (−20), Bob 0 (+20).
 */
const first = storedRound(1, [entry(1, 1, 1), entry(2, 0, 0)]);
const second = storedRound(2, [entry(1, 2, null), entry(2, 0, null)]);

function stateOf(rounds: StoredRound[]) {
  return computeGame(
    rounds.map((stored) => toRoundInput(stored, { played: true })),
    DEFAULT_RULESET,
    roster,
  );
}

describe('pendingRoundOf', () => {
  it('désigne la dernière manche d’une partie en cours', () => {
    expect(pendingRoundOf(game(), [first, second])).toBe(2);
  });

  /** Corriger une manche passée n'ouvre pas une manche en cours (§7.2). */
  it('ignore une manche passée rouverte pour correction', () => {
    expect(pendingRoundOf(game({ currentRound: 1 }), [first, second])).toBeUndefined();
  });

  it('ne retient rien sur une partie terminée', () => {
    expect(pendingRoundOf(game({ status: 'finished' }), [first, second])).toBeUndefined();
  });

  /** Une partie abandonnée garde une manche jamais validée : elle ne compte pas. */
  it('retient la manche interrompue d’une partie abandonnée', () => {
    expect(pendingRoundOf(game({ status: 'abandoned' }), [first, second])).toBe(2);
  });

  it('accepte une partie sans manche', () => {
    expect(pendingRoundOf(game(), [])).toBeUndefined();
  });
});

describe('settledScoresOf', () => {
  const rounds = [first, second];

  /** Le cœur du sujet : les mises annoncées ne doivent pas bouger les compteurs. */
  it('laisse la manche en cours hors des cumuls', () => {
    const state = stateOf(rounds);
    expect(state.totals).toEqual({ '1': 0, '2': 30 });

    expect(settledScoresOf(state, rounds, roster, 2).totals).toEqual({ '1': 20, '2': 10 });
  });

  it('classe les joueurs sur les scores acquis, pas sur l’aperçu', () => {
    expect(settledScoresOf(stateOf(rounds), rounds, roster, 2).standings).toEqual([
      { playerId: '1', total: 20, rank: 1 },
      { playerId: '2', total: 10, rank: 2 },
    ]);
  });

  it('part de zéro tant qu’aucune manche n’est validée', () => {
    expect(settledScoresOf(stateOf([second]), [second], roster, 2).totals).toEqual({
      '1': 0,
      '2': 0,
    });
  });

  it('rend les totaux complets quand aucune manche n’est en cours', () => {
    const state = stateOf(rounds);
    expect(settledScoresOf(state, rounds, roster).totals).toBe(state.totals);
  });
});
