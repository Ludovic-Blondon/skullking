import { scoreRound } from '../scoring';
import { bonuses, player, round, rules } from './helpers';

/** Bonus de capture et Butin (PLAN.md §4.2, annexe A). */
describe('bonus de capture', () => {
  const classic = rules();

  it.each([
    ['14 jaune', 'yellow14', 10],
    ['14 vert', 'green14', 10],
    ['14 violet', 'purple14', 10],
    ['14 noir', 'black14', 20],
    ['sirène qui capture le Skull King', 'mermaidCapturesSkullKing', 40],
  ] as const)('%s vaut %s points en édition courante', (_label, type, expected) => {
    const [score] = scoreRound(
      round([player('a', 1, 1, bonuses({ [type]: 1 }))], { cardsDealt: 3 }),
      classic,
    );
    expect(score.bonus).toBe(expected);
    expect(score.total).toBe(20 + expected);
  });

  it('compte 30 points par pirate capturé par le Skull King', () => {
    const [score] = scoreRound(
      round([player('a', 2, 2, bonuses({ skullKingCapturesPirate: 3 }))], { cardsDealt: 5 }),
      classic,
    );
    expect(score.bonus).toBe(90);
  });

  it('compte 20 points par sirène capturée par un pirate', () => {
    const [score] = scoreRound(
      round([player('a', 2, 2, bonuses({ pirateCapturesMermaid: 2 }))], { cardsDealt: 5 }),
      classic,
    );
    expect(score.bonus).toBe(40);
  });

  it('cumule plusieurs bonus sur la même manche', () => {
    const [score] = scoreRound(
      round([player('a', 2, 2, bonuses({ yellow14: 1, black14: 1, skullKingCapturesPirate: 2 }))], {
        cardsDealt: 6,
      }),
      classic,
    );
    expect(score.bonus).toBe(10 + 20 + 60);
    expect(score.total).toBe(40 + 90);
  });

  /** « Les bonus ne comptent que si l'annonce est exacte » (PLAN.md §2.1). */
  it('annule les bonus d’une mise ratée, mais les conserve en mémoire', () => {
    const [score] = scoreRound(
      round([player('a', 2, 1, bonuses({ black14: 1, mermaidCapturesSkullKing: 1 }))], {
        cardsDealt: 4,
      }),
      classic,
    );
    expect(score.bonus).toBe(0);
    // Suivi pour la statistique « bonus perdus » (PLAN.md §8).
    expect(score.lostBonus).toBe(60);
    expect(score.total).toBe(-10);
  });

  it('n’invente pas de bonus quand aucun n’est saisi', () => {
    const [score] = scoreRound(round([player('a', 1, 1)], { cardsDealt: 2 }), classic);
    expect(score.bonus).toBe(0);
    expect(score.lostBonus).toBe(0);
  });
});

describe('édition legacy', () => {
  const legacy = rules({ edition: 'legacy' });

  it('paie la capture du Skull King par une sirène 50 points', () => {
    const [score] = scoreRound(
      round([player('a', 1, 1, bonuses({ mermaidCapturesSkullKing: 1 }))], { cardsDealt: 3 }),
      legacy,
    );
    expect(score.bonus).toBe(50);
  });

  it('ignore « pirate capture sirène », qui n’existait pas avant 2021', () => {
    const [score] = scoreRound(
      round([player('a', 1, 1, bonuses({ pirateCapturesMermaid: 2 }))], { cardsDealt: 3 }),
      legacy,
    );
    expect(score.bonus).toBe(0);
  });

  it('conserve la valeur des 14 et des pirates capturés', () => {
    const [score] = scoreRound(
      round([player('a', 1, 1, bonuses({ black14: 1, skullKingCapturesPirate: 1 }))], {
        cardsDealt: 3,
      }),
      legacy,
    );
    expect(score.bonus).toBe(50);
  });
});

describe('Butin', () => {
  const classic = rules();

  it('rapporte 20 points à chacun quand les deux mises sont exactes', () => {
    const scores = scoreRound(
      round([player('a', 1, 1), player('b', 2, 2), player('c', 0, 0)], {
        cardsDealt: 3,
        lootAlliances: [{ playerId: 'a', allyId: 'b' }],
      }),
      classic,
    );
    expect(scores[0].bonus).toBe(20);
    expect(scores[1].bonus).toBe(20);
    // Le troisième joueur n'est dans aucune alliance.
    expect(scores[2].bonus).toBe(0);
  });

  it('est accessible à un joueur ayant misé 0', () => {
    const scores = scoreRound(
      round([player('a', 0, 0), player('b', 3, 3)], {
        cardsDealt: 3,
        lootAlliances: [{ playerId: 'a', allyId: 'b' }],
      }),
      classic,
    );
    expect(scores[0].bonus).toBe(20);
    expect(scores[0].total).toBe(30 + 20);
  });

  it('tombe pour les deux alliés dès qu’une des deux mises est ratée', () => {
    const scores = scoreRound(
      round([player('a', 1, 1), player('b', 2, 1)], {
        cardsDealt: 2,
        lootAlliances: [{ playerId: 'a', allyId: 'b' }],
      }),
      classic,
    );
    expect(scores[0].bonus).toBe(0);
    expect(scores[0].lostBonus).toBe(20);
    expect(scores[1].bonus).toBe(0);
    expect(scores[1].lostBonus).toBe(20);
  });

  it('accepte deux alliances distinctes sur la même manche', () => {
    const scores = scoreRound(
      round([player('a', 1, 1), player('b', 1, 1), player('c', 1, 1), player('d', 1, 1)], {
        cardsDealt: 4,
        lootAlliances: [
          { playerId: 'a', allyId: 'b' },
          { playerId: 'a', allyId: 'c' },
        ],
      }),
      classic,
    );
    expect(scores[0].bonus).toBe(40);
    expect(scores[1].bonus).toBe(20);
    expect(scores[3].bonus).toBe(0);
  });

  it('ignore une alliance avec soi-même', () => {
    const scores = scoreRound(
      round([player('a', 1, 1), player('b', 1, 1)], {
        cardsDealt: 2,
        lootAlliances: [{ playerId: 'a', allyId: 'a' }],
      }),
      classic,
    );
    expect(scores[0].bonus).toBe(0);
    expect(scores[0].lostBonus).toBe(0);
  });

  it('ne rapporte rien quand l’allié n’est pas à la table', () => {
    const scores = scoreRound(
      round([player('a', 1, 1), player('b', 1, 1)], {
        cardsDealt: 2,
        lootAlliances: [{ playerId: 'a', allyId: 'inconnu' }],
      }),
      classic,
    );
    expect(scores[0].bonus).toBe(0);
    expect(scores[0].lostBonus).toBe(20);
  });

  it('ne rapporte rien quand le poseur de l’alliance n’est pas à la table', () => {
    const scores = scoreRound(
      round([player('a', 1, 1), player('b', 1, 1)], {
        cardsDealt: 2,
        lootAlliances: [{ playerId: 'inconnu', allyId: 'a' }],
      }),
      classic,
    );
    expect(scores[0].bonus).toBe(0);
    expect(scores[0].lostBonus).toBe(20);
  });

  it('n’est pas en jeu sans les cartes avancées', () => {
    const scores = scoreRound(
      round([player('a', 1, 1), player('b', 1, 1)], {
        cardsDealt: 2,
        lootAlliances: [{ playerId: 'a', allyId: 'b' }],
      }),
      rules({ advancedCards: false }),
    );
    expect(scores[0].bonus).toBe(0);
    expect(scores[0].lostBonus).toBe(0);
  });
});
