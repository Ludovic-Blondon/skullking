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

/** La même manche 2, jouée jusqu'au bout : Alice tient sa mise 2 (+40), Bob sa mise 0 (+20). */
const secondPlayed = storedRound(2, [entry(1, 2, 2), entry(2, 0, 0)]);

/** Manche 1 où les deux joueurs tiennent leur mise 1 : 20 partout. */
const firstTied = storedRound(1, [entry(1, 1, 1), entry(2, 1, 1)]);

function stateOf(rounds: StoredRound[]) {
  return computeGame(
    rounds.map((stored) => toRoundInput(stored, { forcePlayed: true })),
    DEFAULT_RULESET,
    roster,
  );
}

describe('pendingRoundOf', () => {
  it('désigne la manche courante d’une partie en cours', () => {
    expect(pendingRoundOf(game(), [first, second])).toBe(2);
  });

  /**
   * Le cas qui piégeait la lecture par position : après avoir revalidé une
   * manche corrigée, la partie repart au milieu de la feuille alors que la
   * dernière manche stockée est bien plus loin (§7.2).
   */
  it('désigne une manche rouverte pour correction, où qu’elle soit', () => {
    expect(pendingRoundOf(game({ currentRound: 1 }), [first, second])).toBe(1);
  });

  it('ne retient rien sur une partie terminée', () => {
    expect(pendingRoundOf(game({ status: 'finished' }), [first, second])).toBeUndefined();
  });

  /** Une partie abandonnée garde une manche jamais validée : elle ne compte pas. */
  it('retient la manche interrompue d’une partie abandonnée', () => {
    expect(pendingRoundOf(game({ status: 'abandoned' }), [first, second])).toBe(2);
  });

  it('ignore une manche courante qui n’existe pas encore en base', () => {
    expect(pendingRoundOf(game({ currentRound: 3 }), [first, second])).toBeUndefined();
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

    expect(settledScoresOf(state, roster, 2).totals).toEqual({ '1': 20, '2': 10 });
  });

  it('classe les joueurs sur les scores acquis, pas sur l’aperçu', () => {
    expect(settledScoresOf(stateOf(rounds), roster, 2).standings).toEqual([
      { playerId: '1', total: 20, rank: 1 },
      { playerId: '2', total: 10, rank: 2 },
    ]);
  });

  /**
   * Corriger la manche 2 d'une partie de 10 ne fait pas disparaître les huit
   * suivantes : seule la manche rouverte sort du décompte.
   */
  it('garde les manches qui suivent celle qu’on corrige', () => {
    const corrected = [first, secondPlayed];
    const state = stateOf(corrected);
    expect(state.totals).toEqual({ '1': 60, '2': 30 });

    expect(settledScoresOf(state, roster, 1).totals).toEqual({ '1': 40, '2': 20 });
  });

  it('part de zéro tant qu’aucune manche n’est validée', () => {
    expect(settledScoresOf(stateOf([second]), roster, 2).totals).toEqual({ '1': 0, '2': 0 });
  });

  it('rend les totaux complets quand aucune manche n’est en cours', () => {
    const state = stateOf(rounds);
    expect(settledScoresOf(state, roster).totals).toEqual(state.totals);
  });

  /** L'égalité déclenche une manche supplémentaire (§4.1) : elle se lit sur les acquis. */
  it('départage sur les scores acquis, pas sur l’aperçu', () => {
    const state = stateOf([firstTied, second]);
    expect(state.tie).toBe(false);

    const settled = settledScoresOf(state, roster, 2);
    expect(settled.tie).toBe(true);
    expect(settled.leaders).toEqual(['1', '2']);
  });
});
