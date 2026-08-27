/**
 * Ordre des colonnes de la feuille de score (PLAN.md §7.2).
 *
 * Du premier au dernier, plutôt que dans l'ordre des places à table : la
 * feuille s'ouvre pour savoir qui mène, et à sept joueurs la grille déborde en
 * largeur — chercher le leader colonne par colonne prend plus longtemps que de
 * lire la première. Le rang vient des scores **acquis**, donc les colonnes ne
 * se réorganisent qu'à la validation d'une manche, jamais sous les doigts
 * pendant la saisie.
 */

import type { Standing } from '@/core';
import { PLAYER_COLORS } from '@/ui/tokens';

import type { SeatedPlayer } from './use-game';

export interface ScoreColumn {
  seat: SeatedPlayer;
  /** Couleur d'en-tête, celle du joueur ou celle de sa place. */
  color: string;
}

export function rankedColumns(seats: SeatedPlayer[], standings: Standing[]): ScoreColumn[] {
  // La couleur de repli reste attachée à la **place** à table : indexée sur le
  // rang, elle changerait à chaque manche et personne ne retrouverait sa
  // colonne d'un coup d'œil.
  const columns = seats.map((seat, index) => ({
    seat,
    color: seat.color ?? PLAYER_COLORS[index % PLAYER_COLORS.length],
  }));

  const positionOf = new Map(standings.map((standing, index) => [standing.playerId, index]));
  // Un joueur absent du classement passe en fin de grille plutôt que d'y
  // prendre la première place — l'ordre des places le départage.
  const last = columns.length;
  return columns.sort(
    (a, b) =>
      (positionOf.get(String(a.seat.id)) ?? last) - (positionOf.get(String(b.seat.id)) ?? last),
  );
}
