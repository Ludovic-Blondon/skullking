import { DEFAULT_RULESET, type Ruleset } from '@/core';
import { translator } from '@/i18n/translate';

import { summarizeRuleset } from '../ruleset-summary';

const t = translator('fr');
const summarize = (overrides: Partial<Ruleset> = {}) =>
  summarizeRuleset({ ...DEFAULT_RULESET, ...overrides }, t);

/** Résumé des règles (PLAN.md §7.1) : seuls les écarts au défaut se disent. */
describe('summarizeRuleset', () => {
  it('ne nomme que le décompte quand la table joue comme la boîte', () => {
    expect(summarize()).toBe('Classique');
  });

  it.each([
    [{ scoring: 'rascal' } as Partial<Ruleset>, 'Rascal'],
    [{ pirateAbilities: false }, 'Classique, sans pouvoirs'],
    [{ advancedCards: false }, 'Classique, sans cartes avancées'],
    [{ expansion: true }, 'Classique, extension'],
    [{ edition: 'legacy' as const }, 'Classique, ancienne édition'],
    [{ roundsPlan: [1, 2, 3] }, 'Classique, 3 manches'],
  ])('résume %s', (overrides, expected) => {
    expect(summarize(overrides)).toBe(expected);
  });

  it('cumule les écarts dans l’ordre des options', () => {
    expect(
      summarize({
        scoring: 'rascal',
        rascalCannonball: true,
        expansion: true,
        roundsPlan: [1, 2, 3, 4, 5],
      }),
    ).toBe('Rascal, boulet de canon, extension, 5 manches');
  });
});
