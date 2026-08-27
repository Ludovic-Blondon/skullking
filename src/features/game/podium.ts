/**
 * Marches du podium de fin de partie (PLAN.md §7.4).
 *
 * Le livret ne départage qu'une seule égalité : celle **en tête**, par une
 * manche supplémentaire (§4.1). Aux autres rangs, deux joueurs à égalité le
 * restent — aucune règle officielle ne les sépare, ni au nombre de plis, ni aux
 * bonus. Le podium les fait donc monter ensemble sur la même marche, plutôt que
 * d'en afficher un et d'oublier l'autre.
 */

import type { Standing } from '@/core';

/** Or, argent, bronze. */
const PODIUM_RANKS = [1, 2, 3];

/**
 * Les joueurs de chaque marche, or d'abord — une marche par **rang**, pas par
 * position au classement.
 *
 * Une marche peut être vide : deux deuxièmes à égalité ne laissent aucun
 * troisième, comme sur un podium sportif. Le classement complet, lui, est
 * affiché juste en dessous.
 */
export function podiumSteps(standings: Standing[]): Standing[][] {
  return PODIUM_RANKS.map((rank) => standings.filter((standing) => standing.rank === rank));
}
