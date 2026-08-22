import { DEFAULT_RULESET, type Ruleset } from '@/core';

import { parseStoredRuleset, serializeRuleset } from '../last-ruleset';

const RASCAL: Ruleset = {
  edition: 'legacy',
  advancedCards: false,
  scoring: 'rascal',
  rascalCannonball: true,
  pirateAbilities: true,
  roundsPlan: [1, 2, 3, 4, 5],
};

describe('parseStoredRuleset', () => {
  it('rend les règles par défaut quand rien n’a encore été joué', () => {
    expect(parseStoredRuleset(undefined)).toEqual(DEFAULT_RULESET);
  });

  it('fait l’aller-retour sans rien perdre', () => {
    expect(parseStoredRuleset(serializeRuleset(RASCAL))).toEqual(RASCAL);
    expect(parseStoredRuleset(serializeRuleset(DEFAULT_RULESET))).toEqual(DEFAULT_RULESET);
  });

  it('retient les pouvoirs des pirates, le motif du signalement', () => {
    const stored = serializeRuleset({ ...DEFAULT_RULESET, pirateAbilities: true });
    expect(parseStoredRuleset(stored).pirateAbilities).toBe(true);
  });

  it('ignore une valeur illisible plutôt que de casser l’écran', () => {
    expect(parseStoredRuleset('{oops')).toEqual(DEFAULT_RULESET);
    expect(parseStoredRuleset('null')).toEqual(DEFAULT_RULESET);
    expect(parseStoredRuleset('"rascal"')).toEqual(DEFAULT_RULESET);
  });

  it('ne garde d’un champ aberrant que ce champ', () => {
    const stored = JSON.stringify({ scoring: 'rascal', edition: 42, pirateAbilities: 'oui' });
    expect(parseStoredRuleset(stored)).toEqual({
      ...DEFAULT_RULESET,
      scoring: 'rascal',
    });
  });

  it('désarme le boulet de canon si le décompte n’est plus Rascal', () => {
    const stored = JSON.stringify({ scoring: 'classic', rascalCannonball: true });
    expect(parseStoredRuleset(stored).rascalCannonball).toBe(false);
  });

  it('refuse un plan de manches vide, négatif ou trop long', () => {
    const plan = (roundsPlan: unknown) => parseStoredRuleset(JSON.stringify({ roundsPlan }));
    expect(plan([]).roundsPlan).toEqual(DEFAULT_RULESET.roundsPlan);
    expect(plan([1, 0, 3]).roundsPlan).toEqual(DEFAULT_RULESET.roundsPlan);
    expect(plan([1, 2.5]).roundsPlan).toEqual(DEFAULT_RULESET.roundsPlan);
    expect(plan('1,2,3').roundsPlan).toEqual(DEFAULT_RULESET.roundsPlan);
    expect(plan(Array(50).fill(1)).roundsPlan).toHaveLength(DEFAULT_RULESET.roundsPlan.length);
  });
});
