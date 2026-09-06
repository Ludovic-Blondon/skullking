import { DEFAULT_RULESET, type Ruleset } from '@/core';
import type { Translate } from '@/i18n';

/**
 * Une ligne qui résume les règles choisies (PLAN.md §7.1).
 *
 * Ne nomme que les écarts au défaut : une table qui joue comme la boîte le
 * prévoit ne lit qu'« Classique ». Sert au repli des options à la création
 * comme au rappel en lecture seule des réglages d'une partie en cours (§7.5).
 */
export function summarizeRuleset(ruleset: Ruleset, t: Translate): string {
  const parts = [t(ruleset.scoring === 'rascal' ? 'rules.rascal' : 'rules.classic')];
  if (ruleset.rascalCannonball) parts.push(t('rules.summaryCannonball'));
  if (!ruleset.pirateAbilities) parts.push(t('rules.summaryNoPowers'));
  if (!ruleset.advancedCards) parts.push(t('rules.summaryNoAdvanced'));
  if (ruleset.expansion) parts.push(t('rules.summaryExpansion'));
  if (ruleset.edition === 'legacy') parts.push(t('rules.summaryLegacy'));
  if (ruleset.roundsPlan.length !== DEFAULT_RULESET.roundsPlan.length) {
    parts.push(t('rules.summaryRounds', { count: ruleset.roundsPlan.length }));
  }
  return parts.join(', ');
}
