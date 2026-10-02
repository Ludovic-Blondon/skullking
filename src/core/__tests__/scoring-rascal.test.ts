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

  /** Fiche « Rascal's Scoring », « Bonus Points » : la même règle que le potentiel. */
  describe('bonus de capture', () => {
    const withBlack14 = (bid: number, tricks: number) =>
      scoreRound(
        round([player('a', bid, tricks, bonuses({ black14: 1 }))], { cardsDealt: 4 }),
        rascal,
      )[0];

    it('comptent entiers si la mise est exacte', () => {
      const score = withBlack14(2, 2);
      expect(score.bonus).toBe(20);
      expect(score.total).toBe(40 + 20);
    });

    it('comptent à moitié à un pli près', () => {
      const score = withBlack14(2, 3);
      expect(score.base).toBe(20);
      expect(score.bonus).toBe(10);
      expect(score.lostBonus).toBe(10);
      expect(score.total).toBe(20 + 10);
    });

    it('ne comptent plus à deux plis d’écart', () => {
      const score = withBlack14(2, 4);
      expect(score.bonus).toBe(0);
      expect(score.lostBonus).toBe(20);
    });

    it('règlent le demi-point de l’extension en faveur du joueur', () => {
      const [eight, seven] = scoreRound(
        round([
          player('a', 1, 2, bonuses({ expansionEight: 1 })),
          player('b', 2, 1, bonuses({ expansionSeven: 1 })),
        ]),
        rules({ scoring: 'rascal', expansion: true }),
      );
      // +2,5 arrondi à +3, −2,5 arrondi à −2.
      expect(eight.bonus).toBe(3);
      expect(eight.lostBonus).toBe(2);
      expect(seven.bonus).toBe(-2);
      expect(seven.lostBonus).toBe(-3);
    });

    it('laissent le Butin exiger deux mises exactes', () => {
      const [poser, ally] = scoreRound(
        round([player('a', 1, 2), player('b', 1, 1), player('c', 0, 0)], {
          lootAlliances: [{ playerId: 'a', allyId: 'b' }],
        }),
        rascal,
      );
      expect(poser.bonus).toBe(0);
      expect(poser.lostBonus).toBe(20);
      expect(ally.bonus).toBe(0);
    });
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

  it('reste tout ou rien pour les bonus de capture', () => {
    const [score] = scoreRound(
      round([player('a', 2, 3, { cannonball: true, ...bonuses({ black14: 1 }) })], {
        cardsDealt: 6,
      }),
      cannonballRules,
    );
    expect(score.bonus).toBe(0);
    expect(score.lostBonus).toBe(20);
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
