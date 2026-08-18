/**
 * Traduction des codes d'anomalie du moteur en phrases lisibles (PLAN.md §7.2).
 *
 * Le moteur ne renvoie que des codes ; ces libellés partiront dans les fichiers
 * de traduction en P6.
 */

import type { Issue } from '@/core';

export function issueMessage(issue: Issue): string {
  switch (issue.code) {
    case 'trickCountMismatch':
      return `Le compte n'y est pas : ${issue.value} pli${(issue.value ?? 0) > 1 ? 's' : ''} pour ${issue.expected} cartes`;
    case 'bonusCountExceeded':
      return `Ce bonus est saisi ${issue.value} fois pour un maximum de ${issue.max}`;
    case 'skullKingAlreadyCaptured':
      return 'Le Skull King a été capturé par une sirène : il ne peut pas avoir capturé de pirate';
    case 'bonusUnavailableInEdition':
      return "Ce bonus n'existe pas dans l'édition choisie";
    case 'multipleHarry':
      return 'Un seul joueur par manche peut modifier sa mise avec Harry le Géant';
    case 'multipleRascalBets':
      return 'Un seul pari de Rascal par manche';
    case 'effectiveBidOutOfRange':
      return 'La mise modifiée sort du nombre de cartes distribuées';
    case 'lootWithTwoPlayers':
      return "Le Butin n'est pas utilisé à 2 joueurs";
    case 'lootSelfAlliance':
      return 'Une alliance de Butin se fait à deux joueurs différents';
    case 'lootAlliancesExceeded':
      return 'Deux alliances de Butin au maximum par manche';
    case 'destroyedTricksWithoutAdvancedCards':
      return 'Les cartes avancées ne sont pas en jeu dans cette partie';
    default:
      return 'La saisie de cette manche est incohérente';
  }
}

/** Première erreur bloquante, s'il y en a une. */
export function firstBlockingIssue(issues: Issue[]): Issue | undefined {
  return issues.find((issue) => issue.severity === 'error');
}
