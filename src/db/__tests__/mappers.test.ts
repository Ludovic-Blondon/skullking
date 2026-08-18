import { scoreRound } from '@/core';

import {
  allBidsPlaced,
  allTricksPlaced,
  lootAlliancesOf,
  toRoundInput,
  type StoredRound,
} from '../mappers';
import type { BonusEvent, Round, RoundEntry } from '../schema';

function round(overrides: Partial<Round> = {}): Round {
  return {
    id: 1,
    gameId: 1,
    roundNumber: 3,
    cardsDealt: 3,
    destroyedTricks: 0,
    forced: false,
    ...overrides,
  };
}

function entry(playerId: number, overrides: Partial<RoundEntry> = {}): RoundEntry {
  return {
    id: playerId,
    roundId: 1,
    playerId,
    bid: 1,
    tricks: 1,
    bidModifier: 0,
    rascalBet: 0,
    cannonball: false,
    customBonus: 0,
    scoreBase: null,
    scoreBonus: null,
    scoreTotal: null,
    ...overrides,
  };
}

function bonus(
  playerId: number,
  type: BonusEvent['type'],
  overrides: Partial<BonusEvent> = {},
): BonusEvent {
  return { id: 1, roundId: 1, playerId, type, count: 1, allyPlayerId: null, ...overrides };
}

describe('toRoundInput', () => {
  it('traduit une manche complète pour le moteur', () => {
    const stored: StoredRound = {
      round: round({ destroyedTricks: 1, forced: true }),
      entries: [
        entry(7, { bid: 2, tricks: 2, bidModifier: 1, rascalBet: 20 }),
        entry(9, { bid: 0, tricks: 0 }),
      ],
      bonusEvents: [bonus(7, 'black14'), bonus(7, 'yellow14')],
    };

    expect(toRoundInput(stored)).toEqual({
      roundNumber: 3,
      cardsDealt: 3,
      destroyedTricks: 1,
      forced: true,
      lootAlliances: [],
      players: [
        {
          playerId: '7',
          bid: 2,
          tricks: 2,
          bidModifier: 1,
          rascalBet: 20,
          cannonball: false,
          customBonus: 0,
          bonuses: { black14: 1, yellow14: 1 },
        },
        {
          playerId: '9',
          bid: 0,
          tricks: 0,
          bidModifier: 0,
          rascalBet: 0,
          cannonball: false,
          customBonus: 0,
          bonuses: {},
        },
      ],
    });
  });

  it('additionne plusieurs événements du même type pour un joueur', () => {
    const stored: StoredRound = {
      round: round(),
      entries: [entry(1, { bid: 2, tricks: 2 })],
      bonusEvents: [
        bonus(1, 'skullKingCapturesPirate', { count: 2 }),
        bonus(1, 'skullKingCapturesPirate', { id: 2, count: 1 }),
      ],
    };
    expect(toRoundInput(stored).players[0].bonuses).toEqual({ skullKingCapturesPirate: 3 });
  });

  it('n’attribue pas à un joueur les bonus d’un autre', () => {
    const stored: StoredRound = {
      round: round(),
      entries: [entry(1), entry(2)],
      bonusEvents: [bonus(2, 'black14')],
    };
    const input = toRoundInput(stored);
    expect(input.players[0].bonuses).toEqual({});
    expect(input.players[1].bonuses).toEqual({ black14: 1 });
  });

  /** Une manche en cours de saisie a des colonnes nulles (PLAN.md §5). */
  it('neutralise les mises et plis non encore saisis', () => {
    const stored: StoredRound = {
      round: round(),
      entries: [entry(1, { bid: null, tricks: null })],
      bonusEvents: [],
    };
    expect(toRoundInput(stored).players[0]).toMatchObject({ bid: 0, tricks: 0 });
  });

  it('produit une entrée directement exploitable par le moteur', () => {
    const stored: StoredRound = {
      round: round({ cardsDealt: 4 }),
      entries: [entry(1, { bid: 2, tricks: 2 }), entry(2, { bid: 0, tricks: 2 })],
      bonusEvents: [bonus(1, 'black14')],
    };
    const [first, second] = scoreRound(toRoundInput(stored), {
      edition: 'current',
      advancedCards: true,
      scoring: 'classic',
      rascalCannonball: false,
      pirateAbilities: false,
      roundsPlan: [],
    });
    expect(first.total).toBe(40 + 20);
    expect(second.total).toBe(-40);
  });
});

describe('lootAlliancesOf', () => {
  it('reconstitue une alliance à partir de ses deux lignes miroir', () => {
    const events = [
      bonus(1, 'loot', { allyPlayerId: 2 }),
      bonus(2, 'loot', { id: 2, allyPlayerId: 1 }),
    ];
    expect(lootAlliancesOf(events)).toEqual([{ playerId: '1', allyId: '2' }]);
  });

  it('distingue deux alliances entre les deux mêmes joueurs', () => {
    const events = [
      bonus(1, 'loot', { allyPlayerId: 2 }),
      bonus(2, 'loot', { id: 2, allyPlayerId: 1 }),
      bonus(1, 'loot', { id: 3, allyPlayerId: 2 }),
      bonus(2, 'loot', { id: 4, allyPlayerId: 1 }),
    ];
    expect(lootAlliancesOf(events)).toHaveLength(2);
  });

  it('sépare les alliances de paires différentes', () => {
    const events = [
      bonus(1, 'loot', { allyPlayerId: 2 }),
      bonus(2, 'loot', { id: 2, allyPlayerId: 1 }),
      bonus(3, 'loot', { id: 3, allyPlayerId: 4 }),
      bonus(4, 'loot', { id: 4, allyPlayerId: 3 }),
    ];
    expect(lootAlliancesOf(events)).toEqual([
      { playerId: '1', allyId: '2' },
      { playerId: '3', allyId: '4' },
    ]);
  });

  it('ne perd pas une alliance dont la ligne miroir manque', () => {
    expect(lootAlliancesOf([bonus(1, 'loot', { allyPlayerId: 2 })])).toEqual([
      { playerId: '1', allyId: '2' },
    ]);
  });

  it('ignore les captures et les lignes sans allié', () => {
    const events = [bonus(1, 'black14'), bonus(1, 'loot', { id: 2, allyPlayerId: null })];
    expect(lootAlliancesOf(events)).toEqual([]);
  });
});

describe('progression de la saisie', () => {
  it('détecte que toutes les annonces sont posées', () => {
    const stored: StoredRound = {
      round: round(),
      entries: [entry(1, { bid: 1 }), entry(2, { bid: null })],
      bonusEvents: [],
    };
    expect(allBidsPlaced(stored)).toBe(false);
    expect(allBidsPlaced({ ...stored, entries: [entry(1), entry(2)] })).toBe(true);
  });

  it('détecte que tous les plis sont saisis', () => {
    const stored: StoredRound = {
      round: round(),
      entries: [entry(1, { tricks: 1 }), entry(2, { tricks: null })],
      bonusEvents: [],
    };
    expect(allTricksPlaced(stored)).toBe(false);
    expect(allTricksPlaced({ ...stored, entries: [entry(1), entry(2)] })).toBe(true);
  });

  it('ne considère pas une manche vide comme complète', () => {
    const empty: StoredRound = { round: round(), entries: [], bonusEvents: [] };
    expect(allBidsPlaced(empty)).toBe(false);
    expect(allTricksPlaced(empty)).toBe(false);
  });
});
