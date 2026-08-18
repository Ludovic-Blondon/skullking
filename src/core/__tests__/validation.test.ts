import type { BidModifier, Issue, IssueCode, RascalBet } from '../types';
import { hasBlockingIssues, validateRound } from '../validation';
import { bonuses, player, round, rules } from './helpers';

function codes(issues: Issue[]): IssueCode[] {
  return issues.map((issue) => issue.code);
}

/** Invariants du moteur (PLAN.md §4.4). */
describe('validateRound — manche saine', () => {
  it('ne remonte rien sur une manche cohérente', () => {
    const issues = validateRound(
      round([player('a', 1, 1), player('b', 0, 2), player('c', 1, 0)], { cardsDealt: 3 }),
      rules(),
    );
    expect(issues).toEqual([]);
    expect(hasBlockingIssues(issues)).toBe(false);
  });

  it('accepte une manche où un pli a été détruit par le Kraken', () => {
    const issues = validateRound(
      round([player('a', 1, 1), player('b', 1, 1), player('c', 0, 0)], {
        cardsDealt: 3,
        destroyedTricks: 1,
      }),
      rules(),
    );
    expect(issues).toEqual([]);
  });
});

describe('validateRound — cadre de la manche', () => {
  it('refuse un nombre de cartes distribuées absurde', () => {
    const issues = validateRound(
      round([player('a', 0, 0), player('b', 0, 0)], { cardsDealt: 0 }),
      rules(),
    );
    expect(codes(issues)).toContain('cardsDealtOutOfRange');
  });

  it('refuse une table hors de 2 à 8 joueurs', () => {
    const issues = validateRound(round([player('a', 1, 1)], { cardsDealt: 1 }), rules());
    expect(codes(issues)).toContain('playerCountOutOfRange');
  });

  it('refuse un joueur présent deux fois', () => {
    const issues = validateRound(
      round([player('a', 1, 1), player('a', 0, 0)], { cardsDealt: 1 }),
      rules(),
    );
    expect(codes(issues)).toContain('duplicatePlayer');
  });

  it('refuse plus de deux plis détruits', () => {
    const issues = validateRound(
      round([player('a', 1, 1), player('b', 0, 0)], { cardsDealt: 4, destroyedTricks: 3 }),
      rules(),
    );
    expect(codes(issues)).toContain('destroyedTricksOutOfRange');
  });

  it('refuse un pli détruit sans les cartes avancées', () => {
    const issues = validateRound(
      round([player('a', 1, 1), player('b', 0, 0)], { cardsDealt: 2, destroyedTricks: 1 }),
      rules({ advancedCards: false }),
    );
    expect(codes(issues)).toContain('destroyedTricksWithoutAdvancedCards');
  });
});

describe('validateRound — mises et plis', () => {
  it.each([
    ['mise négative', -1, 1],
    ['mise supérieure aux cartes', 5, 1],
  ])('refuse une %s', (_label, bid, tricks) => {
    const issues = validateRound(
      round([player('a', bid, tricks), player('b', 0, 2)], { cardsDealt: 3 }),
      rules(),
    );
    expect(codes(issues)).toContain('bidOutOfRange');
  });

  it('refuse un nombre de plis hors bornes', () => {
    const issues = validateRound(
      round([player('a', 1, 9), player('b', 0, 0)], { cardsDealt: 3 }),
      rules(),
    );
    expect(codes(issues)).toContain('tricksOutOfRange');
  });

  it('refuse une mise ou un nombre de plis décimal', () => {
    const issues = validateRound(
      round([player('a', 1.5, 0.5), player('b', 0, 0)], { cardsDealt: 3 }),
      rules(),
    );
    expect(codes(issues)).toEqual(expect.arrayContaining(['bidOutOfRange', 'tricksOutOfRange']));
  });

  it('refuse un ajustement manuel décimal', () => {
    const issues = validateRound(
      round([player('a', 1, 1, { customBonus: 2.5 }), player('b', 0, 0)], { cardsDealt: 1 }),
      rules(),
    );
    expect(codes(issues)).toContain('invalidCustomBonus');
  });

  /** Une validation stricte « Σ plis = N » serait un bug (PLAN.md §12.3). */
  it('refuse un total de plis incohérent', () => {
    const issues = validateRound(
      round([player('a', 1, 1), player('b', 1, 1), player('c', 0, 0)], { cardsDealt: 4 }),
      rules(),
    );
    const mismatch = issues.find((issue) => issue.code === 'trickCountMismatch');
    expect(mismatch).toMatchObject({ value: 2, expected: 4 });
  });

  it('tolère un solde de plis à 2 joueurs : le fantôme les absorbe', () => {
    const issues = validateRound(
      round([player('a', 1, 1), player('b', 0, 0)], { cardsDealt: 4 }),
      rules(),
    );
    expect(codes(issues)).not.toContain('trickCountMismatch');
  });

  it('refuse malgré tout un excès de plis à 2 joueurs', () => {
    const issues = validateRound(
      round([player('a', 3, 3), player('b', 2, 2)], { cardsDealt: 4 }),
      rules(),
    );
    expect(codes(issues)).toContain('trickCountMismatch');
  });
});

describe('validateRound — pouvoirs des pirates', () => {
  const withAbilities = rules({ pirateAbilities: true });

  it('refuse un pouvoir utilisé alors que l’option est désactivée', () => {
    const issues = validateRound(
      round([player('a', 1, 1, { bidModifier: 1 }), player('b', 0, 0, { rascalBet: 10 })], {
        cardsDealt: 1,
      }),
      rules(),
    );
    expect(codes(issues).filter((code) => code === 'pirateAbilitiesDisabled')).toHaveLength(2);
  });

  it('refuse deux Harry sur la même manche', () => {
    const issues = validateRound(
      round([player('a', 1, 1, { bidModifier: 1 }), player('b', 1, 1, { bidModifier: -1 })], {
        cardsDealt: 2,
      }),
      withAbilities,
    );
    expect(codes(issues)).toContain('multipleHarry');
  });

  it('refuse deux paris de Rascal sur la même manche', () => {
    const issues = validateRound(
      round([player('a', 1, 1, { rascalBet: 10 }), player('b', 1, 1, { rascalBet: 20 })], {
        cardsDealt: 2,
      }),
      withAbilities,
    );
    expect(codes(issues)).toContain('multipleRascalBets');
  });

  it('refuse un modificateur de mise hors de −1, 0 et +1', () => {
    const issues = validateRound(
      round([player('a', 1, 1, { bidModifier: 2 as BidModifier }), player('b', 0, 0)], {
        cardsDealt: 1,
      }),
      withAbilities,
    );
    expect(codes(issues)).toContain('invalidBidModifier');
  });

  it('refuse un pari qui n’est ni 10 ni 20', () => {
    const issues = validateRound(
      round([player('a', 1, 1, { rascalBet: 15 as RascalBet }), player('b', 0, 0)], {
        cardsDealt: 1,
      }),
      withAbilities,
    );
    expect(codes(issues)).toContain('invalidRascalBet');
  });

  it('refuse une mise effective sortie de l’intervalle', () => {
    const tooHigh = validateRound(
      round([player('a', 2, 2, { bidModifier: 1 }), player('b', 0, 0)], { cardsDealt: 2 }),
      withAbilities,
    );
    const tooLow = validateRound(
      round([player('a', 0, 0, { bidModifier: -1 }), player('b', 2, 2)], { cardsDealt: 2 }),
      withAbilities,
    );
    expect(codes(tooHigh)).toContain('effectiveBidOutOfRange');
    expect(codes(tooLow)).toContain('effectiveBidOutOfRange');
  });
});

describe('validateRound — cohérence des bonus', () => {
  it('refuse un compteur de bonus négatif ou décimal', () => {
    const issues = validateRound(
      round(
        [
          player('a', 1, 1, bonuses({ black14: -1 })),
          player('b', 0, 0, bonuses({ yellow14: 0.5 })),
        ],
        {
          cardsDealt: 1,
        },
      ),
      rules(),
    );
    expect(codes(issues).filter((code) => code === 'invalidBonusCount')).toHaveLength(2);
  });

  it('refuse deux fois la même carte unique sur une manche', () => {
    const issues = validateRound(
      round(
        [player('a', 1, 1, bonuses({ black14: 1 })), player('b', 1, 1, bonuses({ black14: 1 }))],
        {
          cardsDealt: 2,
        },
      ),
      rules(),
    );
    const exceeded = issues.find((issue) => issue.code === 'bonusCountExceeded');
    expect(exceeded).toMatchObject({ bonus: 'black14', value: 2, max: 1 });
  });

  it('plafonne les pirates capturés par le Skull King à six', () => {
    const issues = validateRound(
      round([player('a', 3, 3, bonuses({ skullKingCapturesPirate: 7 })), player('b', 0, 0)], {
        cardsDealt: 3,
      }),
      rules(),
    );
    expect(codes(issues)).toContain('bonusCountExceeded');
  });

  it('plafonne les sirènes capturées à deux', () => {
    const issues = validateRound(
      round([player('a', 3, 3, bonuses({ pirateCapturesMermaid: 3 })), player('b', 0, 0)], {
        cardsDealt: 3,
      }),
      rules(),
    );
    expect(codes(issues)).toContain('bonusCountExceeded');
  });

  /**
   * Une sirène qui capture le Skull King remporte son pli : elle n'a pas pu
   * être capturée par un pirate au même moment.
   */
  it('n’autorise qu’une sirène capturée quand l’autre a pris le Skull King', () => {
    const issues = validateRound(
      round(
        [
          player('a', 1, 1, bonuses({ mermaidCapturesSkullKing: 1 })),
          player('b', 1, 1, bonuses({ pirateCapturesMermaid: 2 })),
        ],
        { cardsDealt: 2 },
      ),
      rules(),
    );
    const exceeded = issues.find((issue) => issue.code === 'bonusCountExceeded');
    expect(exceeded).toMatchObject({ bonus: 'pirateCapturesMermaid', max: 1 });
  });

  /** Le Skull King est une carte unique : capturé, il n'a capturé personne. */
  it('refuse un Skull King à la fois capturé et captureur', () => {
    const issues = validateRound(
      round(
        [
          player('a', 1, 1, bonuses({ mermaidCapturesSkullKing: 1 })),
          player('b', 1, 1, bonuses({ skullKingCapturesPirate: 2 })),
        ],
        { cardsDealt: 2 },
      ),
      rules(),
    );
    expect(codes(issues)).toContain('skullKingAlreadyCaptured');
  });

  it('refuse un bonus qui n’existe pas dans l’édition choisie', () => {
    const issues = validateRound(
      round([player('a', 1, 1, bonuses({ pirateCapturesMermaid: 1 })), player('b', 0, 0)], {
        cardsDealt: 1,
      }),
      rules({ edition: 'legacy' }),
    );
    expect(codes(issues)).toContain('bonusUnavailableInEdition');
  });

  /** Toléré : le moteur neutralise, l'UI barre, la statistique compte. */
  it('signale sans bloquer des bonus saisis sur une mise ratée', () => {
    const issues = validateRound(
      round([player('a', 2, 1, bonuses({ black14: 1 })), player('b', 0, 2)], { cardsDealt: 3 }),
      rules(),
    );
    const warning = issues.find((issue) => issue.code === 'bonusOnMissedBid');
    expect(warning).toMatchObject({ severity: 'warning', playerId: 'a' });
    expect(hasBlockingIssues([warning as Issue])).toBe(false);
  });

  it('signale aussi une alliance de Butin sur une mise ratée', () => {
    const issues = validateRound(
      round([player('a', 1, 0), player('b', 1, 1), player('c', 1, 1)], {
        cardsDealt: 2,
        lootAlliances: [{ playerId: 'a', allyId: 'b' }],
      }),
      rules(),
    );
    expect(codes(issues)).toContain('bonusOnMissedBid');
  });

  it('signale l’avertissement même quand le joueur est l’allié de l’alliance', () => {
    const issues = validateRound(
      round([player('a', 1, 0), player('b', 1, 1), player('c', 1, 1)], {
        cardsDealt: 2,
        lootAlliances: [{ playerId: 'b', allyId: 'a' }],
      }),
      rules(),
    );
    const warning = issues.find((issue) => issue.code === 'bonusOnMissedBid');
    expect(warning).toMatchObject({ playerId: 'a' });
  });
});

describe('validateRound — Butin', () => {
  const alliance = [{ playerId: 'a', allyId: 'b' }];

  it('refuse le Butin sans les cartes avancées', () => {
    const issues = validateRound(
      round([player('a', 1, 1), player('b', 1, 1), player('c', 0, 0)], {
        cardsDealt: 2,
        lootAlliances: alliance,
      }),
      rules({ advancedCards: false }),
    );
    expect(codes(issues)).toContain('lootWithoutAdvancedCards');
  });

  it('refuse le Butin à 2 joueurs', () => {
    const issues = validateRound(
      round([player('a', 1, 1), player('b', 1, 1)], { cardsDealt: 2, lootAlliances: alliance }),
      rules(),
    );
    expect(codes(issues)).toContain('lootWithTwoPlayers');
  });

  it('refuse une alliance avec soi-même', () => {
    const issues = validateRound(
      round([player('a', 1, 1), player('b', 1, 1), player('c', 0, 0)], {
        cardsDealt: 2,
        lootAlliances: [{ playerId: 'a', allyId: 'a' }],
      }),
      rules(),
    );
    expect(codes(issues)).toContain('lootSelfAlliance');
  });

  it('refuse une alliance avec un joueur absent de la table', () => {
    const issues = validateRound(
      round([player('a', 1, 1), player('b', 1, 1), player('c', 0, 0)], {
        cardsDealt: 2,
        lootAlliances: [{ playerId: 'a', allyId: 'zoe' }],
      }),
      rules(),
    );
    expect(codes(issues)).toContain('lootUnknownPlayer');
  });

  it('refuse plus de deux alliances sur une manche', () => {
    const issues = validateRound(
      round([player('a', 1, 1), player('b', 1, 1), player('c', 1, 1), player('d', 0, 0)], {
        cardsDealt: 3,
        lootAlliances: [
          { playerId: 'a', allyId: 'b' },
          { playerId: 'a', allyId: 'c' },
          { playerId: 'b', allyId: 'c' },
        ],
      }),
      rules(),
    );
    expect(codes(issues)).toContain('lootAlliancesExceeded');
  });
});

describe('hasBlockingIssues', () => {
  it('distingue une erreur d’un avertissement', () => {
    expect(hasBlockingIssues([{ code: 'trickCountMismatch', severity: 'error' }])).toBe(true);
    expect(hasBlockingIssues([{ code: 'bonusOnMissedBid', severity: 'warning' }])).toBe(false);
    expect(hasBlockingIssues([])).toBe(false);
  });
});
