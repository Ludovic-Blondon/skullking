/** Constructeurs d'entrées pour les tests du moteur. */

import { DEFAULT_RULESET } from '../rules/editions';
import type { BonusCounts, PlayerRoundInput, RoundInput, Ruleset } from '../types';

export function rules(overrides: Partial<Ruleset> = {}): Ruleset {
  return { ...DEFAULT_RULESET, ...overrides };
}

export function player(
  playerId: string,
  bid: number,
  tricks: number,
  extra: Omit<Partial<PlayerRoundInput>, 'playerId' | 'bid' | 'tricks'> = {},
): PlayerRoundInput {
  return { playerId, bid, tricks, ...extra };
}

export function bonuses(counts: BonusCounts): { bonuses: BonusCounts } {
  return { bonuses: counts };
}

/**
 * Manche cohérente par défaut : le nombre de cartes distribuées est déduit des
 * plis saisis, afin que la validation passe sans avoir à le préciser.
 */
export function round(
  players: PlayerRoundInput[],
  overrides: Partial<RoundInput> = {},
): RoundInput {
  const claimed = players.reduce((sum, entry) => sum + entry.tricks, 0);
  return {
    roundNumber: 1,
    cardsDealt: claimed + (overrides.destroyedTricks ?? 0),
    players,
    ...overrides,
  };
}
