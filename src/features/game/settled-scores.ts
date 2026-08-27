/**
 * Scores acquis d'une partie : ceux des manches déjà validées (PLAN.md §7.2).
 *
 * Une manche ouverte, elle, se décompte comme si elle était finie — c'est
 * l'aperçu qui fait vivre l'écran de saisie. Mais tant que la table n'a pas
 * validé la manche, les compteurs affichés doivent rester ceux de la manche
 * précédente : personne ne veut voir son score plonger de 20 points au moment
 * où les mises sont annoncées, avant même qu'un pli soit posé.
 */

import { standingsOf, type GameState, type PlayerId, type Standing } from '@/core';
import type { StoredRound } from '@/db/mappers';
import type { Game } from '@/db/schema';

export interface SettledScores {
  totals: Record<PlayerId, number>;
  standings: Standing[];
}

/**
 * Manche en train de se jouer, s'il y en a une.
 *
 * C'est la **dernière** manche de la partie, et seulement si la partie n'est
 * pas terminée et qu'elle en est bien là. Corriger une manche passée rouvre au
 * contraire une manche validée de longue date (§7.2) : celle-là continue de
 * compter, comme toutes celles qui la suivent.
 */
export function pendingRoundOf(game: Game, storedRounds: StoredRound[]): number | undefined {
  if (game.status === 'finished') return undefined;

  const last = storedRounds[storedRounds.length - 1];
  return last && last.round.roundNumber === game.currentRound ? last.round.roundNumber : undefined;
}

/** Cumuls et classement à l'issue de la dernière manche validée. */
export function settledScoresOf(
  state: GameState,
  storedRounds: StoredRound[],
  roster: PlayerId[],
  pendingRound?: number,
): SettledScores {
  const pending =
    pendingRound === undefined
      ? -1
      : storedRounds.findIndex((stored) => stored.round.roundNumber === pendingRound);

  const totals =
    pending < 0
      ? state.totals
      : pending === 0
        ? Object.fromEntries(roster.map((playerId) => [playerId, 0]))
        : state.rounds[pending - 1].cumulative;

  return { totals, standings: standingsOf(totals, roster) };
}
