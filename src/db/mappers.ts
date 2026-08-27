/**
 * Traduction entre les lignes de la base et les entrées du moteur de règles.
 *
 * C'est la seule couche qui connaît les deux mondes : `src/core` ignore la base
 * (PLAN.md §6), et le schéma ignore le moteur. Fonctions pures, donc testables
 * sans base de données.
 */

import {
  BONUS_TYPES,
  type BidModifier,
  type BonusCounts,
  type LootAlliance,
  type RascalBet,
  type RoundInput,
} from '@/core';

import type { BonusEvent, Round, RoundEntry } from './schema';

/** Une manche telle qu'elle est stockée, avec ses lignes filles. */
export interface StoredRound {
  round: Round;
  entries: RoundEntry[];
  bonusEvents: BonusEvent[];
}

const CAPTURE_TYPES = new Set<string>(BONUS_TYPES);

/** Compteurs de capture d'un joueur, indexés par type. */
function bonusCountsOf(events: BonusEvent[], playerId: number): BonusCounts {
  const counts: BonusCounts = {};
  for (const event of events) {
    if (event.playerId !== playerId || !CAPTURE_TYPES.has(event.type)) continue;
    const type = event.type as keyof BonusCounts;
    counts[type] = (counts[type] ?? 0) + event.count;
  }
  return counts;
}

/**
 * Alliances de Butin, reconstituées à partir des lignes miroir.
 *
 * La base stocke un événement par bénéficiaire ; le moteur raisonne par paire.
 * Deux lignes symétriques valent donc une alliance — et quatre lignes entre les
 * deux mêmes joueurs, deux alliances (il y a deux cartes Butin dans la boîte).
 */
export function lootAlliancesOf(events: BonusEvent[]): LootAlliance[] {
  const byPair = new Map<string, { playerId: number; allyId: number; rows: number }>();

  for (const event of events) {
    if (event.type !== 'loot' || event.allyPlayerId === null) continue;
    const [low, high] = [event.playerId, event.allyPlayerId].sort((a, b) => a - b);
    const key = `${low}-${high}`;
    const pair = byPair.get(key) ?? { playerId: low, allyId: high, rows: 0 };
    pair.rows += 1;
    byPair.set(key, pair);
  }

  const alliances: LootAlliance[] = [];
  for (const pair of byPair.values()) {
    // `ceil` plutôt que `floor` : une ligne miroir manquante ne doit pas faire
    // disparaître l'alliance en silence.
    const count = Math.ceil(pair.rows / 2);
    for (let index = 0; index < count; index += 1) {
      alliances.push({ playerId: String(pair.playerId), allyId: String(pair.allyId) });
    }
  }
  return alliances;
}

/** Options de traduction d'une manche. */
export interface ToRoundInputOptions {
  /**
   * Force la manche à l'état « jouée ».
   *
   * En phase Résultats la manche est en train d'être jouée : un pli laissé
   * vide vaut **0 pris**, exactement ce que la validation écrira (§7.2). Sans
   * cela, un joueur qui annonce 0 et ne prend aucun pli — donc ne touche à
   * rien — resterait hors du décompte et son alliance de Butin tomberait à
   * l'écran alors qu'elle tient après validation.
   */
  played?: boolean;
}

/** Manche stockée → entrée du moteur. */
export function toRoundInput(stored: StoredRound, options: ToRoundInputOptions = {}): RoundInput {
  return {
    roundNumber: stored.round.roundNumber,
    cardsDealt: stored.round.cardsDealt,
    destroyedTricks: stored.round.destroyedTricks,
    forced: stored.round.forced,
    players: stored.entries.map((entry) => ({
      playerId: String(entry.playerId),
      // Une manche en cours de saisie a des colonnes nulles : le moteur, lui,
      // raisonne sur des nombres. 0 est la valeur neutre côté décompte, et
      // `played` lui dit de ne pas confondre ce 0-là avec une mise 0 réussie.
      bid: entry.bid ?? 0,
      tricks: entry.tricks ?? 0,
      played: options.played ?? (entry.bid !== null && entry.tricks !== null),
      bidModifier: entry.bidModifier as BidModifier,
      rascalBet: entry.rascalBet as RascalBet,
      cannonball: entry.cannonball,
      customBonus: entry.customBonus,
      bonuses: bonusCountsOf(stored.bonusEvents, entry.playerId),
    })),
    lootAlliances: lootAlliancesOf(stored.bonusEvents),
  };
}
