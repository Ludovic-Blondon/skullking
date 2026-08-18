import { computeGame } from '../game';
import type { RoundInput } from '../types';
import { bonuses, player, round, rules } from './helpers';

/** Agrégation d'une partie (PLAN.md §4.5). */
describe('computeGame', () => {
  const classic = rules();

  const twoRounds: RoundInput[] = [
    round([player('alice', 1, 1), player('bob', 0, 0), player('chloe', 0, 0)], {
      roundNumber: 1,
      cardsDealt: 1,
    }),
    round([player('alice', 0, 1), player('bob', 1, 1), player('chloe', 0, 0)], {
      roundNumber: 2,
      cardsDealt: 2,
    }),
  ];

  it('cumule les scores manche après manche', () => {
    const state = computeGame(twoRounds, classic);
    expect(state.rounds[0].cumulative).toEqual({ alice: 20, bob: 10, chloe: 10 });
    // Manche 2 : Alice rate sa mise 0 (−20), Bob réussit 1 (+20), Chloé tient son 0 (+20).
    expect(state.rounds[1].cumulative).toEqual({ alice: 0, bob: 30, chloe: 30 });
    expect(state.totals).toEqual({ alice: 0, bob: 30, chloe: 30 });
  });

  it('classe les joueurs et partage le rang en cas d’égalité', () => {
    const state = computeGame(twoRounds, classic);
    expect(state.standings).toEqual([
      { playerId: 'bob', total: 30, rank: 1 },
      { playerId: 'chloe', total: 30, rank: 1 },
      { playerId: 'alice', total: 0, rank: 3 },
    ]);
  });

  /** Égalité en tête : le livret prévoit une manche supplémentaire (§4.1). */
  it('signale une égalité en tête', () => {
    const state = computeGame(twoRounds, classic);
    expect(state.tie).toBe(true);
    expect(state.leaders).toEqual(['bob', 'chloe']);
  });

  it('désigne un vainqueur unique quand il n’y a pas d’égalité', () => {
    const state = computeGame(
      [round([player('alice', 1, 1), player('bob', 1, 0)], { cardsDealt: 1 })],
      classic,
    );
    expect(state.tie).toBe(false);
    expect(state.leaders).toEqual(['alice']);
    expect(state.standings.map((standing) => standing.rank)).toEqual([1, 2]);
  });

  it('reprend le détail de chaque manche', () => {
    const state = computeGame(twoRounds, classic);
    expect(state.rounds).toHaveLength(2);
    expect(state.rounds[1]).toMatchObject({
      roundNumber: 2,
      cardsDealt: 2,
      destroyedTricks: 0,
      ghostTricks: 0,
    });
    expect(state.rounds[1].scores).toHaveLength(3);
  });

  it('gère une partie qui n’a pas encore commencé', () => {
    const state = computeGame([], classic, ['alice', 'bob']);
    expect(state.totals).toEqual({ alice: 0, bob: 0 });
    expect(state.standings.map((standing) => standing.rank)).toEqual([1, 1]);
    expect(state.tie).toBe(true);
  });

  it('gère une partie sans joueurs du tout', () => {
    const state = computeGame([], classic);
    expect(state).toMatchObject({ totals: {}, standings: [], leaders: [], rounds: [] });
    expect(state.tie).toBe(false);
  });

  it('accepte une liste de joueurs explicite, y compris un joueur sans manche', () => {
    const state = computeGame(
      [round([player('alice', 1, 1), player('bob', 0, 0)], { cardsDealt: 1 })],
      classic,
      ['alice', 'bob', 'chloe'],
    );
    expect(state.totals.chloe).toBe(0);
    expect(state.standings).toHaveLength(3);
  });

  it('rattrape un joueur présent dans une manche mais absent de la liste fournie', () => {
    const state = computeGame(
      [round([player('alice', 1, 1), player('bob', 0, 0)], { cardsDealt: 1 })],
      classic,
      ['alice'],
    );
    expect(state.totals).toEqual({ alice: 20, bob: 10 });
    expect(state.standings).toHaveLength(2);
  });

  it('recalcule tout après correction d’une manche passée', () => {
    const before = computeGame(twoRounds, classic);
    const corrected = [
      twoRounds[0],
      round([player('alice', 0, 0), player('bob', 1, 1), player('chloe', 1, 1)], {
        roundNumber: 2,
        cardsDealt: 2,
      }),
    ];
    const after = computeGame(corrected, classic);
    expect(before.totals.alice).toBe(0);
    expect(after.totals.alice).toBe(40);
  });

  it('transmet le jeu de règles au décompte', () => {
    const state = computeGame(
      [round([player('alice', 1, 1, bonuses({ mermaidCapturesSkullKing: 1 }))], { cardsDealt: 1 })],
      rules({ edition: 'legacy' }),
    );
    expect(state.totals.alice).toBe(20 + 50);
  });
});

describe('fantôme « Barbe Grise »', () => {
  const classic = rules();

  it('absorbe les plis non réclamés à 2 joueurs', () => {
    const state = computeGame(
      [round([player('alice', 1, 1), player('bob', 0, 0)], { roundNumber: 4, cardsDealt: 4 })],
      classic,
    );
    expect(state.rounds[0].ghostTricks).toBe(3);
    // Le fantôme ne marque pas : seuls les deux joueurs figurent au classement.
    expect(state.standings).toHaveLength(2);
  });

  it('tient compte des plis détruits dans le solde du fantôme', () => {
    const state = computeGame(
      [
        round([player('alice', 1, 1), player('bob', 0, 0)], {
          roundNumber: 4,
          cardsDealt: 4,
          destroyedTricks: 1,
        }),
      ],
      classic,
    );
    expect(state.rounds[0].ghostTricks).toBe(2);
  });

  it('ne descend jamais sous zéro même sur une saisie incohérente', () => {
    const state = computeGame(
      [round([player('alice', 3, 3), player('bob', 2, 2)], { roundNumber: 4, cardsDealt: 4 })],
      classic,
    );
    expect(state.rounds[0].ghostTricks).toBe(0);
  });

  it('n’existe pas au-delà de 2 joueurs', () => {
    const state = computeGame(
      [round([player('a', 1, 1), player('b', 0, 0), player('c', 0, 0)], { cardsDealt: 3 })],
      classic,
    );
    expect(state.rounds[0].ghostTricks).toBe(0);
  });
});
