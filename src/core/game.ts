/**
 * Agrégation d'une partie : cumuls, classement, égalités (PLAN.md §4.5).
 *
 * Toute correction d'une manche passée repasse par `computeGame()` — jamais de
 * delta appliqué à la main sur un total (PLAN.md §12.5). Recalculer 10 manches
 * pour 8 joueurs est instantané.
 */

import { MIN_PLAYERS } from './rules/editions';
import { scoreRound } from './scoring';
import type { GameState, PlayerId, RoundInput, RoundResult, Ruleset, Standing } from './types';

/**
 * Cartes du jeu réellement distribuables : 56 cartes numérotées (4 couleurs × 14)
 * et 14 cartes spéciales (5 fuites, 5 pirates, la Tigresse, 2 sirènes, le Skull
 * King). Les cartes avancées de la boîte 2021 remplacent des fuites plutôt que
 * de s'y ajouter : le total ne bouge pas.
 */
const DECK_SIZE = 70;

/**
 * Cartes distribuées à la manche demandée.
 *
 * La manche N distribue N cartes, sauf quand le paquet ne suffit plus : à
 * 8 joueurs, les manches 9 et 10 se jouent à 8 cartes (PLAN.md §4.1). La borne
 * se déduit de la taille du paquet, ce qui couvre aussi les formats de manches
 * alternatifs prévus en v1.1.
 */
export function cardsDealtFor(roundNumber: number, playerCount: number): number {
  if (playerCount < 1) return roundNumber;
  return Math.min(roundNumber, Math.floor(DECK_SIZE / playerCount));
}

/** Liste des joueurs d'une partie, dans l'ordre où ils apparaissent. */
function playersOf(rounds: RoundInput[], explicit?: PlayerId[]): PlayerId[] {
  if (explicit) return [...explicit];
  const ordered: PlayerId[] = [];
  for (const round of rounds) {
    for (const player of round.players) {
      if (!ordered.includes(player.playerId)) ordered.push(player.playerId);
    }
  }
  return ordered;
}

/**
 * Plis absorbés par le fantôme « Barbe Grise » : à 2 joueurs, la troisième main
 * remporte des plis mais ne marque pas (PLAN.md §4.1).
 */
function ghostTricksOf(round: RoundInput): number {
  if (round.players.length !== MIN_PLAYERS) return 0;
  const claimed = round.players.reduce((sum, player) => sum + player.tricks, 0);
  return Math.max(0, round.cardsDealt - claimed - (round.destroyedTricks ?? 0));
}

/** Classement : total décroissant, rang partagé en cas d'égalité. */
function standingsOf(totals: Record<PlayerId, number>, players: PlayerId[]): Standing[] {
  const sorted = [...players].sort((a, b) => totals[b] - totals[a]);

  const standings: Standing[] = [];
  sorted.forEach((playerId, index) => {
    const total = totals[playerId];
    const shareRankWithPrevious = index > 0 && standings[index - 1].total === total;
    standings.push({
      playerId,
      total,
      rank: shareRankWithPrevious ? standings[index - 1].rank : index + 1,
    });
  });
  return standings;
}

/** État complet d'une partie à partir de ses manches saisies. */
export function computeGame(
  rounds: RoundInput[],
  ruleset: Ruleset,
  players?: PlayerId[],
): GameState {
  const roster = playersOf(rounds, players);
  const totals: Record<PlayerId, number> = Object.fromEntries(roster.map((id) => [id, 0]));

  const results: RoundResult[] = rounds.map((round) => {
    const scores = scoreRound(round, ruleset);
    for (const score of scores) {
      // Un joueur absent de la liste fournie est ajouté au classement : mieux
      // vaut un classement complet qu'un score qui disparaît.
      if (!(score.playerId in totals)) {
        totals[score.playerId] = 0;
        roster.push(score.playerId);
      }
      totals[score.playerId] += score.total;
    }
    return {
      roundNumber: round.roundNumber,
      cardsDealt: round.cardsDealt,
      destroyedTricks: round.destroyedTricks ?? 0,
      ghostTricks: ghostTricksOf(round),
      scores,
      cumulative: { ...totals },
    };
  });

  const standings = standingsOf(totals, roster);
  const best = standings.length > 0 ? standings[0].total : 0;
  const leaders = standings.filter((standing) => standing.total === best).map((s) => s.playerId);

  return {
    rounds: results,
    totals,
    standings,
    leaders,
    // Égalité en tête : le livret prévoit une manche supplémentaire (§4.1).
    tie: leaders.length > 1,
  };
}
