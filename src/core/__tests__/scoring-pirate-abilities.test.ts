import { effectiveBidOf, scoreRound } from '../scoring';
import { bonuses, player, round, rules } from './helpers';

/** Pouvoirs des pirates : Harry le Géant et pari de Rascal (PLAN.md §4.2). */
describe('Harry le Géant', () => {
  const withAbilities = rules({ pirateAbilities: true });

  it('rattrape une mise ratée en l’augmentant de 1', () => {
    const [score] = scoreRound(
      round([player('a', 2, 3, { bidModifier: 1 })], { cardsDealt: 5 }),
      withAbilities,
    );
    expect(score.effectiveBid).toBe(3);
    expect(score.exact).toBe(true);
    expect(score.base).toBe(60);
  });

  it('rattrape une mise ratée en la diminuant de 1', () => {
    const [score] = scoreRound(
      round([player('a', 3, 2, { bidModifier: -1 })], { cardsDealt: 5 }),
      withAbilities,
    );
    expect(score.effectiveBid).toBe(2);
    expect(score.base).toBe(40);
  });

  it('fait basculer une mise 1 vers le décompte de la mise 0', () => {
    const [score] = scoreRound(
      round([player('a', 1, 0, { bidModifier: -1 })], { cardsDealt: 6 }),
      withAbilities,
    );
    expect(score.effectiveBid).toBe(0);
    // Mise 0 réussie : ±10 × cartes distribuées, pas +20 × 1.
    expect(score.base).toBe(60);
  });

  it('fait basculer une mise 0 vers le décompte d’une mise ≥ 1', () => {
    const [score] = scoreRound(
      round([player('a', 0, 1, { bidModifier: 1 })], { cardsDealt: 6 }),
      withAbilities,
    );
    expect(score.effectiveBid).toBe(1);
    expect(score.base).toBe(20);
  });

  it('conditionne les bonus à la mise effective, pas à la mise annoncée', () => {
    const [score] = scoreRound(
      round([player('a', 2, 3, { bidModifier: 1, ...bonuses({ black14: 1 }) })], {
        cardsDealt: 5,
      }),
      withAbilities,
    );
    expect(score.bonus).toBe(20);
    expect(score.lostBonus).toBe(0);
  });

  it('reste borné à l’intervalle des cartes distribuées', () => {
    const low = scoreRound(
      round([player('a', 0, 0, { bidModifier: -1 })], { cardsDealt: 3 }),
      withAbilities,
    );
    const high = scoreRound(
      round([player('a', 3, 3, { bidModifier: 1 })], { cardsDealt: 3 }),
      withAbilities,
    );
    expect(low[0].effectiveBid).toBe(0);
    expect(high[0].effectiveBid).toBe(3);
  });

  it('est sans effet quand les pouvoirs des pirates sont désactivés', () => {
    const [score] = scoreRound(
      round([player('a', 2, 3, { bidModifier: 1 })], { cardsDealt: 5 }),
      rules(),
    );
    expect(score.effectiveBid).toBe(2);
    expect(score.exact).toBe(false);
  });

  it('expose la mise effective pour l’affichage « 2 → 3 »', () => {
    const entry = player('a', 2, 2, { bidModifier: 1 });
    expect(effectiveBidOf(entry, 5, rules({ pirateAbilities: true }))).toBe(3);
    expect(entry.bid).toBe(2);
  });
});

describe('pari de Rascal le Flambeur', () => {
  const withAbilities = rules({ pirateAbilities: true });

  it.each([10, 20] as const)('rapporte %s points si la mise est exacte', (bet) => {
    const [score] = scoreRound(
      round([player('a', 2, 2, { rascalBet: bet })], { cardsDealt: 4 }),
      withAbilities,
    );
    expect(score.rascalBet).toBe(bet);
    expect(score.total).toBe(40 + bet);
  });

  it.each([10, 20] as const)('est débité de %s points si la mise est ratée', (bet) => {
    const [score] = scoreRound(
      round([player('a', 2, 1, { rascalBet: bet })], { cardsDealt: 4 }),
      withAbilities,
    );
    expect(score.rascalBet).toBe(-bet);
    expect(score.total).toBe(-10 - bet);
  });

  it('ne change rien sans pari', () => {
    const [score] = scoreRound(
      round([player('a', 2, 2, { rascalBet: 0 })], { cardsDealt: 4 }),
      withAbilities,
    );
    expect(score.rascalBet).toBe(0);
  });

  it('est ignoré quand les pouvoirs des pirates sont désactivés', () => {
    const [score] = scoreRound(
      round([player('a', 2, 1, { rascalBet: 20 })], { cardsDealt: 4 }),
      rules(),
    );
    expect(score.rascalBet).toBe(0);
    expect(score.total).toBe(-10);
  });

  /**
   * Le pari exige l'exactitude même en décompte Rascal, où un pli d'écart
   * rapporte pourtant la moitié du potentiel (PLAN.md §4.2).
   */
  it('est perdu à un pli près en décompte Rascal, malgré les 50 % du potentiel', () => {
    const [score] = scoreRound(
      round([player('a', 3, 2, { rascalBet: 20 })], { cardsDealt: 6 }),
      rules({ pirateAbilities: true, scoring: 'rascal' }),
    );
    expect(score.base).toBe(30);
    expect(score.rascalBet).toBe(-20);
    expect(score.total).toBe(10);
  });

  it('se cumule avec Harry sur des joueurs différents', () => {
    const scores = scoreRound(
      round([player('a', 1, 2, { bidModifier: 1 }), player('b', 2, 2, { rascalBet: 10 })], {
        cardsDealt: 4,
      }),
      withAbilities,
    );
    expect(scores[0].total).toBe(40);
    expect(scores[1].total).toBe(50);
  });
});
