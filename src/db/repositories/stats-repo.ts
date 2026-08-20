/**
 * Lignes nécessaires aux statistiques (PLAN.md §8).
 *
 * Le calcul, lui, vit dans `features/stats/compute.ts` : pur, donc testé. Ici
 * on ne fait que sélectionner les colonnes utiles — pas toute la base, pour que
 * les requêtes vives ne renvoient pas de quoi refaire le monde à chaque frappe.
 */

import { db } from '../client';
import { games, roundEntries, rounds } from '../schema';

export function statsGamesQuery() {
  return db.select({ id: games.id, status: games.status, ruleset: games.ruleset }).from(games);
}

export function statsRoundsQuery() {
  return db
    .select({
      id: rounds.id,
      gameId: rounds.gameId,
      roundNumber: rounds.roundNumber,
      cardsDealt: rounds.cardsDealt,
    })
    .from(rounds);
}

export function statsEntriesQuery() {
  return db
    .select({
      roundId: roundEntries.roundId,
      playerId: roundEntries.playerId,
      bid: roundEntries.bid,
      tricks: roundEntries.tricks,
      bidModifier: roundEntries.bidModifier,
      scoreTotal: roundEntries.scoreTotal,
      scoreBonus: roundEntries.scoreBonus,
    })
    .from(roundEntries);
}
