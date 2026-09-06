import { DEFAULT_ROUNDS_PLAN, DEFAULT_RULESET, type Ruleset } from '@/core';

/**
 * Règles retenues d'une partie à l'autre (PLAN.md §7.4, « règles par défaut »).
 *
 * Une table joue presque toujours de la même façon : lui faire re-cocher les
 * pouvoirs des pirates chaque soir est une corvée sans contrepartie. La
 * configuration part donc des règles de la dernière partie créée.
 *
 * Module **pur** : il ne lit ni base ni écran, seulement une chaîne stockée —
 * c'est ce qui le rend testable, et il en a besoin, puisqu'il relit du JSON
 * écrit par une version antérieure de l'app.
 */

function isRoundsPlan(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => Number.isInteger(entry) && entry > 0)
  );
}

/**
 * Relit des règles stockées, champ par champ.
 *
 * Chaque valeur inconnue retombe sur celle par défaut plutôt que d'invalider
 * l'ensemble : une clé ajoutée dans une version future ne doit pas faire perdre
 * à la table le reste de ses habitudes.
 */
export function parseStoredRuleset(stored: string | undefined): Ruleset {
  if (!stored) return DEFAULT_RULESET;

  let raw: unknown;
  try {
    raw = JSON.parse(stored);
  } catch {
    return DEFAULT_RULESET;
  }
  if (typeof raw !== 'object' || raw === null) return DEFAULT_RULESET;

  const value = raw as Partial<Record<keyof Ruleset, unknown>>;
  const scoring = value.scoring === 'rascal' ? 'rascal' : DEFAULT_RULESET.scoring;

  return {
    edition: value.edition === 'legacy' ? 'legacy' : DEFAULT_RULESET.edition,
    advancedCards:
      typeof value.advancedCards === 'boolean'
        ? value.advancedCards
        : DEFAULT_RULESET.advancedCards,
    scoring,
    // Le Boulet de canon n'existe que dans le décompte Rascal : le retenir avec
    // le décompte classique laisserait une option armée qu'aucun écran n'affiche.
    rascalCannonball: scoring === 'rascal' && value.rascalCannonball === true,
    pirateAbilities:
      typeof value.pirateAbilities === 'boolean'
        ? value.pirateAbilities
        : DEFAULT_RULESET.pirateAbilities,
    expansion: typeof value.expansion === 'boolean' ? value.expansion : DEFAULT_RULESET.expansion,
    roundsPlan: isRoundsPlan(value.roundsPlan)
      ? value.roundsPlan.slice(0, DEFAULT_ROUNDS_PLAN.length)
      : DEFAULT_RULESET.roundsPlan,
  };
}

export function serializeRuleset(ruleset: Ruleset): string {
  return JSON.stringify(ruleset);
}
