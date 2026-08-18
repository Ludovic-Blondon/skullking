import { scoreRound } from '../scoring';
import { player, round, rules } from './helpers';

/** Score de base du décompte classique (PLAN.md §4.2 et annexe A). */
describe('score de base — décompte classique', () => {
  const classic = rules();

  const cases: [string, number, number, number, number][] = [
    // libellé, mise, plis, cartes distribuées, score attendu
    ['mise 1 réussie', 1, 1, 1, 20],
    ['mise 3 réussie', 3, 3, 5, 60],
    ['mise 5 réussie', 5, 5, 5, 100],
    ['mise 3 pour 1 pli', 3, 1, 5, -20],
    ['mise 3 pour 5 plis', 3, 5, 5, -20],
    ['mise 1 pour 0 pli', 1, 0, 3, -10],
    ['mise 0 réussie sur 4 cartes', 0, 0, 4, 40],
    ['mise 0 ratée sur 4 cartes', 0, 2, 4, -40],
    ['mise 0 réussie sur 1 carte', 0, 0, 1, 10],
  ];

  it.each(cases)('%s', (_label, bid, tricks, cardsDealt, expected) => {
    const [score] = scoreRound(round([player('a', bid, tricks)], { cardsDealt }), classic);
    expect(score.base).toBe(expected);
    expect(score.total).toBe(expected);
  });

  it('ne rapporte rien pour les plis pris au-delà de la mise', () => {
    const [score] = scoreRound(round([player('a', 2, 4)], { cardsDealt: 6 }), classic);
    // Deux plis d'écart : −20, et surtout pas +20 pour les plis remportés.
    expect(score.base).toBe(-20);
    expect(score.exact).toBe(false);
  });

  /**
   * Le piège documenté en §12.4 : à 8 joueurs, les manches 9 et 10 ne
   * distribuent que 8 cartes. Une mise 0 y vaut ±80, et non ±90 ou ±100.
   */
  it('décompte la mise 0 sur les cartes distribuées, pas sur le numéro de manche', () => {
    const won = scoreRound(round([player('a', 0, 0)], { roundNumber: 9, cardsDealt: 8 }), classic);
    const lost = scoreRound(
      round([player('a', 0, 1)], { roundNumber: 10, cardsDealt: 8 }),
      classic,
    );
    expect(won[0].base).toBe(80);
    expect(lost[0].base).toBe(-80);
  });

  it('reporte la mise effective et l’exactitude dans le résultat', () => {
    const [score] = scoreRound(round([player('a', 2, 2)], { cardsDealt: 4 }), classic);
    expect(score).toMatchObject({
      playerId: 'a',
      effectiveBid: 2,
      exact: true,
      bonus: 0,
      lostBonus: 0,
      rascalBet: 0,
      custom: 0,
    });
  });

  it('ramène une mise hors bornes dans l’intervalle plutôt que de dérailler', () => {
    // La validation signale l'erreur ; le décompte, lui, reste borné.
    const [score] = scoreRound(round([player('a', 9, 3)], { cardsDealt: 3 }), classic);
    expect(score.effectiveBid).toBe(3);
    expect(score.exact).toBe(true);
  });

  it('accepte un ajustement manuel, mise réussie ou ratée', () => {
    const exact = scoreRound(
      round([player('a', 1, 1, { customBonus: 10 })], { cardsDealt: 3 }),
      classic,
    );
    const missed = scoreRound(
      round([player('a', 1, 0, { customBonus: -10 })], { cardsDealt: 3 }),
      classic,
    );
    expect(exact[0].total).toBe(30);
    // L'ajustement manuel n'est pas un bonus : il s'applique quoi qu'il arrive.
    expect(missed[0].total).toBe(-20);
  });
});
