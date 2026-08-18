import { scoreRound } from '../scoring';
import { bonuses, player, round, rules } from './helpers';

/**
 * Décompte Rascal le Flambeur : potentiel de 10 points par carte, intégral si
 * la mise est exacte, à moitié à un pli près, jamais négatif (PLAN.md §4.3).
 */
describe('décompte Rascal', () => {
  const rascal = rules({ scoring: 'rascal' });

  it.each([
    ['mise exacte', 3, 3, 6, 60],
    ['un pli de trop', 3, 4, 6, 30],
    ['un pli de moins', 3, 2, 6, 30],
    ['deux plis d’écart', 3, 5, 6, 0],
    ['mise 0 réussie', 0, 0, 4, 40],
    ['mise 0 ratée d’un pli', 0, 1, 4, 20],
    ['mise 0 ratée de trois plis', 0, 3, 4, 0],
  ])('%s', (_label, bid, tricks, cardsDealt, expected) => {
    const [score] = scoreRound(round([player('a', bid, tricks)], { cardsDealt }), rascal);
    expect(score.base).toBe(expected);
  });

  it('ne descend jamais sous zéro', () => {
    const [score] = scoreRound(round([player('a', 5, 0)], { cardsDealt: 5 }), rascal);
    expect(score.base).toBe(0);
    expect(score.total).toBe(0);
  });

  it('arrondit la demi-manche sur un nombre impair de cartes', () => {
    const [score] = scoreRound(round([player('a', 2, 3)], { cardsDealt: 5 }), rascal);
    expect(score.base).toBe(25);
  });

  it('conserve les bonus, toujours conditionnés à l’exactitude', () => {
    const exact = scoreRound(
      round([player('a', 2, 2, bonuses({ black14: 1 }))], { cardsDealt: 4 }),
      rascal,
    );
    const nearMiss = scoreRound(
      round([player('a', 2, 3, bonuses({ black14: 1 }))], { cardsDealt: 4 }),
      rascal,
    );
    expect(exact[0].total).toBe(40 + 20);
    // Un pli d'écart rapporte la moitié du potentiel, mais pas le bonus.
    expect(nearMiss[0].base).toBe(20);
    expect(nearMiss[0].bonus).toBe(0);
    expect(nearMiss[0].lostBonus).toBe(20);
  });
});

describe('option Boulet de canon', () => {
  const cannonballRules = rules({ scoring: 'rascal', rascalCannonball: true });

  it('paie 15 points par carte si la mise est exacte', () => {
    const [score] = scoreRound(
      round([player('a', 2, 2, { cannonball: true })], { cardsDealt: 6 }),
      cannonballRules,
    );
    expect(score.base).toBe(90);
  });

  it('ne paie rien dès qu’il y a un écart, même d’un seul pli', () => {
    const [score] = scoreRound(
      round([player('a', 2, 3, { cannonball: true })], { cardsDealt: 6 }),
      cannonballRules,
    );
    expect(score.base).toBe(0);
  });

  it('se choisit joueur par joueur', () => {
    const scores = scoreRound(
      round([player('a', 2, 3, { cannonball: true }), player('b', 3, 4)], { cardsDealt: 7 }),
      cannonballRules,
    );
    expect(scores[0].base).toBe(0);
    // Sans boulet de canon, un pli d'écart rapporte encore la moitié.
    expect(scores[1].base).toBe(35);
  });

  it('est sans effet si l’option n’est pas activée dans la partie', () => {
    const [score] = scoreRound(
      round([player('a', 2, 2, { cannonball: true })], { cardsDealt: 6 }),
      rules({ scoring: 'rascal' }),
    );
    expect(score.base).toBe(60);
  });

  it('est sans effet en décompte classique', () => {
    const [score] = scoreRound(
      round([player('a', 2, 2, { cannonball: true })], { cardsDealt: 6 }),
      rules({ rascalCannonball: true }),
    );
    expect(score.base).toBe(40);
  });
});
