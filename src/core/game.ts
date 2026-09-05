/**
 * Agrégation d'une partie : cumuls, classement, égalités (PLAN.md §4.5).
 *
 * Toute correction d'une manche passée repasse par `computeGame()` — jamais de
 * delta appliqué à la main sur un total (PLAN.md §12.5). Recalculer 10 manches
 * pour 8 joueurs est instantané.
 */

import { deckSizeFor, MIN_PLAYERS } from './rules/editions';
import { scoreRound } from './scoring';
import type { GameState, PlayerId, RoundInput, RoundResult, Ruleset, Standing } from './types';

/**
 * Cartes distribuées à la manche demandée.
 *
 * La manche N distribue N cartes, sauf quand le paquet ne suffit plus : à
 * 8 joueurs, les manches 9 et 10 se jouent à 8 cartes (PLAN.md §4.1). La borne
 * se déduit de la taille du paquet, ce qui couvre aussi bien les 19 cartes de
 * l'extension (§4.6) que les formats de manches alternatifs prévus en v1.1.
 *
 * Sans `ruleset`, c'est le paquet de base qui borne : un appelant qui n'a pas
 * les règles sous la main ne doit pas distribuer des cartes qui n'existent pas.
 */
export function cardsDealtFor(roundNumber: number, playerCount: number, ruleset?: Ruleset): number {
  if (playerCount < 1) return roundNumber;
  return Math.min(roundNumber, Math.floor(deckSizeFor(ruleset) / playerCount));
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

/**
 * Classement : total décroissant, rang partagé en cas d'égalité.
 *
 * Exporté parce que l'app classe aussi des totaux qui ne sont pas ceux de
 * `computeGame` — les scores acquis, manche en cours exclue (PLAN.md §7.2).
 */
export function standingsOf(totals: Record<PlayerId, number>, players: PlayerId[]): Standing[] {
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

/**
 * Joueurs en tête : ceux qui partagent le meilleur total.
 *
 * Exporté pour la même raison que `standingsOf` : l'app départage aussi des
 * classements qui ne sortent pas de `computeGame` — ceux des scores acquis,
 * manche en cours exclue (PLAN.md §7.2). Une égalité en tête appelle une
 * manche supplémentaire (§4.1), autant la lire au même endroit partout.
 */
export function leadersOf(standings: Standing[]): PlayerId[] {
  const best = standings.length > 0 ? standings[0].total : 0;
  return standings.filter((standing) => standing.total === best).map((s) => s.playerId);
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
  const leaders = leadersOf(standings);

  return {
    rounds: results,
    totals,
    standings,
    leaders,
    // Égalité en tête : le livret prévoit une manche supplémentaire (§4.1).
    tie: leaders.length > 1,
  };
}
