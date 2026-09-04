import { validateRound } from '../validation';
import { scoreRound } from '../scoring';
import { bonuses, player, round, rules } from './helpers';

/** Extension officielle : cartes 7/8, Second, Casier de Davy Jones (PLAN.md §4.6). */
describe('bonus de l’extension', () => {
  const withExpansion = rules({ expansion: true });

  it.each([
    ['un 8 de couleur', 5, 'expansionEight'],
    ['un 7 de couleur', -5, 'expansionSeven'],
    ['un léviathan détruit par le Casier', 20, 'davyJonesLeviathan'],
    ['le Second capturé', 30, 'firstMateCaptured'],
  ] as const)('compte %s à %s points', (_label, expected, type) => {
    const [score] = scoreRound(
      round([player('a', 1, 1, bonuses({ [type]: 1 }))], { cardsDealt: 3 }),
      withExpansion,
    );
    expect(score.bonus).toBe(expected);
    expect(score.total).toBe(20 + expected);
  });

  it('additionne les 7 et les 8 remportés dans la même manche', () => {
    const [score] = scoreRound(
      round([player('a', 2, 2, bonuses({ expansionEight: 3, expansionSeven: 2 }))], {
        cardsDealt: 6,
      }),
      withExpansion,
    );
    expect(score.bonus).toBe(15 - 10);
  });

  it('compte 20 points par léviathan détruit par le Casier', () => {
    const [score] = scoreRound(
      round([player('a', 2, 2, bonuses({ davyJonesLeviathan: 3 }))], { cardsDealt: 5 }),
      withExpansion,
    );
    expect(score.bonus).toBe(60);
  });

  /**
   * Les ±5 suivent la règle générale : une mise ratée les annule — le 7 compris,
   * dont la pénalité est donc échappée. `lostBonus` peut en devenir négatif.
   */
  it('annule aussi la pénalité des 7 quand la mise est ratée', () => {
    const [score] = scoreRound(
      round([player('a', 2, 1, bonuses({ expansionSeven: 2 }))], { cardsDealt: 4 }),
      withExpansion,
    );
    expect(score.bonus).toBe(0);
    expect(score.lostBonus).toBe(-10);
    expect(score.total).toBe(-10);
  });

  it('ignore les compteurs d’extension quand elle n’est pas en jeu', () => {
    const counters = bonuses({
      expansionEight: 2,
      expansionSeven: 1,
      davyJonesLeviathan: 1,
      firstMateCaptured: 1,
    });
    const [score] = scoreRound(
      round([player('a', 2, 2, counters)], { cardsDealt: 5 }),
      rules({ expansion: false }),
    );
    expect(score.bonus).toBe(0);
    expect(score.total).toBe(40);
  });

  it('vaut la même chose en édition ancienne — l’extension est une boîte à part', () => {
    const [score] = scoreRound(
      round([player('a', 1, 1, bonuses({ firstMateCaptured: 1 }))], { cardsDealt: 3 }),
      rules({ expansion: true, edition: 'legacy' }),
    );
    expect(score.bonus).toBe(30);
  });

  it('cumule bonus de la boîte et bonus d’extension', () => {
    const [score] = scoreRound(
      round([player('a', 2, 2, bonuses({ black14: 1, expansionEight: 1, expansionSeven: 1 }))], {
        cardsDealt: 6,
      }),
      withExpansion,
    );
    expect(score.bonus).toBe(20 + 5 - 5);
  });
});

/** Contrôles de saisie propres à l'extension (PLAN.md §4.4 et §4.6). */
describe('validation de l’extension', () => {
  it('refuse un compteur d’extension quand l’extension est éteinte', () => {
    const issues = validateRound(
      round([player('a', 1, 1, bonuses({ expansionEight: 1 })), player('b', 0, 0)], {
        cardsDealt: 1,
      }),
      rules({ expansion: false }),
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: 'bonusUnavailableWithoutExpansion',
        severity: 'error',
        playerId: 'a',
        bonus: 'expansionEight',
      }),
    );
  });

  it('accepte le même compteur une fois l’extension activée', () => {
    const issues = validateRound(
      round([player('a', 1, 1, bonuses({ expansionEight: 1 })), player('b', 0, 0)], {
        cardsDealt: 1,
      }),
      rules({ expansion: true }),
    );
    expect(issues).toEqual([]);
  });

  it.each([
    ['expansionSeven', 4, 5],
    ['expansionEight', 4, 5],
    ['davyJonesLeviathan', 3, 4],
    ['firstMateCaptured', 1, 2],
  ] as const)('plafonne %s à %s par manche', (type, max, saisi) => {
    const issues = validateRound(
      round([player('a', 2, 2, bonuses({ [type]: saisi })), player('b', 0, 0)], { cardsDealt: 2 }),
      rules({ expansion: true }),
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ code: 'bonusCountExceeded', bonus: type, max }),
    );
  });

  /** La Raie tachetée est un troisième léviathan : trois plis peuvent tomber. */
  it('accepte trois plis détruits avec l’extension, deux sans', () => {
    const trois = round([player('a', 1, 1), player('b', 0, 0)], {
      cardsDealt: 4,
      destroyedTricks: 3,
    });
    expect(validateRound(trois, rules({ expansion: true }))).toEqual([]);
    expect(validateRound(trois, rules({ expansion: false }))).toContainEqual(
      expect.objectContaining({ code: 'destroyedTricksOutOfRange', max: 2 }),
    );
  });

  it('assied neuf joueurs avec l’extension, huit sans', () => {
    const neuf = round(
      Array.from({ length: 9 }, (_, index) => player(String(index), 0, index === 0 ? 9 : 0)),
      { cardsDealt: 9 },
    );
    expect(validateRound(neuf, rules({ expansion: true }))).toEqual([]);
    expect(validateRound(neuf, rules({ expansion: false }))).toContainEqual(
      expect.objectContaining({ code: 'playerCountOutOfRange', value: 9, max: 8 }),
    );
  });
});
