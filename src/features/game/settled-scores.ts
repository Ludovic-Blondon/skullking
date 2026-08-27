/**
 * Scores acquis d'une partie : ceux des manches déjà validées (PLAN.md §7.2).
 *
 * Une manche ouverte, elle, se décompte comme si elle était finie — c'est
 * l'aperçu qui fait vivre l'écran de saisie. Mais tant que la table n'a pas
 * validé la manche, les compteurs affichés doivent rester ceux de la manche
 * précédente : personne ne veut voir son score plonger de 20 points au moment
 * où les mises sont annoncées, avant même qu'un pli soit posé.
 */

import { leadersOf, standingsOf, type GameState, type PlayerId, type Standing } from '@/core';
import type { StoredRound } from '@/db/mappers';
import type { Game } from '@/db/schema';

export interface SettledScores {
  totals: Record<PlayerId, number>;
  standings: Standing[];
  /** Joueurs en tête sur les scores acquis. */
  leaders: PlayerId[];
  /** Égalité en tête : le livret prévoit une manche supplémentaire (§4.1). */
  tie: boolean;
}

/**
 * Manche en train de se jouer, s'il y en a une.
 *
 * C'est la manche courante de la partie, quelle que soit sa place dans la
 * feuille : corriger une manche passée la rouvre (§7.2), et la table la
 * rejoue comme n'importe quelle autre — ses points ne sont donc acquis qu'à
 * sa revalidation. La repérer à sa position, elle, se trompait dès la
 * première correction : après avoir revalidé la manche 1, la partie repart à
 * la manche 2 alors que la dernière manche stockée est la 10.
 */
export function pendingRoundOf(game: Game, storedRounds: StoredRound[]): number | undefined {
  if (game.status === 'finished') return undefined;

  const exists = storedRounds.some((stored) => stored.round.roundNumber === game.currentRound);
  return exists ? game.currentRound : undefined;
}

/**
 * Cumuls et classement, manche en cours exclue.
 *
 * On resomme les manches une à une plutôt que de reprendre le cumul de la
 * manche précédente : la manche rouverte peut être n'importe laquelle, et
 * celles qui la suivent restent acquises — leurs points ne disparaissent pas
 * parce qu'on corrige la manche 2 d'une partie de 10.
 */
export function settledScoresOf(
  state: GameState,
  roster: PlayerId[],
  pendingRound?: number,
): SettledScores {
  const totals: Record<PlayerId, number> = Object.fromEntries(
    roster.map((playerId) => [playerId, 0]),
  );

  for (const result of state.rounds) {
    if (result.roundNumber === pendingRound) continue;
    for (const score of result.scores) {
      totals[score.playerId] = (totals[score.playerId] ?? 0) + score.total;
    }
  }

  const standings = standingsOf(totals, roster);
  const leaders = leadersOf(standings);
  return { totals, standings, leaders, tie: leaders.length > 1 };
}
