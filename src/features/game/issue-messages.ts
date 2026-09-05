/**
 * Traduction des codes d'anomalie du moteur en phrases lisibles (PLAN.md §7.2).
 *
 * Le moteur ne renvoie que des codes ; ce module les mappe sur des clés du
 * catalogue et fournit les paramètres à interpoler. Il ne connaît donc aucune
 * langue — c'est l'écran qui traduit.
 */

import type { Issue } from '@/core';
import type { MessageKey, Params, PluralKey } from '@/i18n';

export function issueMessage(issue: Issue): { key: MessageKey | PluralKey; params?: Params } {
  switch (issue.code) {
    case 'trickCountMismatch':
      return {
        key: 'issue.trickCountMismatch',
        params: { count: issue.value ?? 0, value: issue.value ?? 0, expected: issue.expected ?? 0 },
      };
    case 'bonusCountExceeded':
      return {
        key: 'issue.bonusCountExceeded',
        params: { value: issue.value ?? 0, max: issue.max ?? 0 },
      };
    case 'skullKingAlreadyCaptured':
      return { key: 'issue.skullKingAlreadyCaptured' };
    case 'bonusUnavailableInEdition':
      return { key: 'issue.bonusUnavailableInEdition' };
    case 'bonusUnavailableWithoutExpansion':
      return { key: 'issue.bonusUnavailableWithoutExpansion' };
    case 'multipleHarry':
      return { key: 'issue.multipleHarry' };
    case 'multipleRascalBets':
      return { key: 'issue.multipleRascalBets' };
    case 'effectiveBidOutOfRange':
      return { key: 'issue.effectiveBidOutOfRange' };
    case 'lootWithTwoPlayers':
      return { key: 'issue.lootWithTwoPlayers' };
    case 'lootSelfAlliance':
      return { key: 'issue.lootSelfAlliance' };
    case 'lootAlliancesExceeded':
      return { key: 'issue.lootAlliancesExceeded' };
    case 'destroyedTricksWithoutAdvancedCards':
      return { key: 'issue.destroyedTricksWithoutAdvancedCards' };
    default:
      return { key: 'issue.unknown' };
  }
}

/** Première erreur bloquante, s'il y en a une. */
export function firstBlockingIssue(issues: Issue[]): Issue | undefined {
  return issues.find((issue) => issue.severity === 'error');
}
