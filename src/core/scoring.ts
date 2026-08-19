/**
 * Décompte des points d'une manche (PLAN.md §4.2).
 *
 * Le moteur ne juge pas la cohérence de la saisie : c'est le rôle de
 * `validateRound()`. Il reste défensif — une mise hors bornes est ramenée dans
 * l'intervalle plutôt que de produire un score aberrant.
 */

import {
  BASE_POINTS,
  BONUS_POINTS,
  BONUS_TYPES,
  RASCAL_POINTS,
  type BonusScale,
} from './rules/editions';
import type { PlayerId, PlayerRoundInput, PlayerRoundScore, RoundInput, Ruleset } from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Mise réellement décomptée : l'annonce, éventuellement corrigée de ±1 par
 * Harry le Géant, ramenée dans [0, cartes distribuées] (PLAN.md §4.2).
 *
 * C'est elle qui décide de tout : bascule mise 0 ↔ mise ≥ 1, exactitude des
 * bonus, issue du pari de Rascal. La mise d'origine reste conservée pour
 * l'affichage (« 2 → 3 ») et pour des statistiques honnêtes.
 */
export function effectiveBidOf(
  player: PlayerRoundInput,
  cardsDealt: number,
  ruleset: Ruleset,
): number {
  const modifier = ruleset.pirateAbilities ? (player.bidModifier ?? 0) : 0;
  return clamp(player.bid + modifier, 0, Math.max(cardsDealt, 0));
}

/** Score de base du décompte classique. */
function classicBase(bid: number, tricks: number, cardsDealt: number): number {
  if (bid === 0) {
    // ±10 par carte distribuée — jamais par numéro de manche (PLAN.md §12.4).
    const stake = BASE_POINTS.zeroBidPerCard * cardsDealt;
    return tricks === 0 ? stake : -stake;
  }
  if (tricks === bid) {
    return BASE_POINTS.perTrickWhenExact * bid;
  }
  // Mise ratée : rien pour les plis pris, seulement la pénalité d'écart.
  return -BASE_POINTS.perTrickOfError * Math.abs(tricks - bid);
}

/**
 * Score de base du décompte Rascal : un potentiel proportionnel à la manche,
 * intégral si la mise est exacte, à moitié à un pli près, jamais négatif.
 */
function rascalBase(bid: number, tricks: number, cardsDealt: number, cannonball: boolean): number {
  const exact = tricks === bid;
  if (cannonball) {
    return exact ? RASCAL_POINTS.cannonballPerCard * cardsDealt : 0;
  }
  const potential = RASCAL_POINTS.potentialPerCard * cardsDealt;
  if (exact) {
    return potential;
  }
  if (Math.abs(tricks - bid) === 1) {
    return Math.round(potential * RASCAL_POINTS.nearMissRatio);
  }
  return 0;
}

/** Somme des bonus de capture saisis, aux valeurs de l'édition. */
function captureBonusPoints(player: PlayerRoundInput, scale: BonusScale): number {
  let points = 0;
  for (const type of BONUS_TYPES) {
    const value = scale[type];
    // `null` : le bonus n'existe pas dans cette édition — il ne rapporte rien.
    if (value === null) continue;
    points += value * (player.bonuses?.[type] ?? 0);
  }
  return points;
}

/** Points de Butin d'un joueur, séparés en acquis et perdus. */
function lootPointsFor(
  playerId: PlayerId,
  input: RoundInput,
  exactByPlayer: Map<PlayerId, boolean>,
  scale: BonusScale,
  ruleset: Ruleset,
): { earned: number; lost: number } {
  // Sans les cartes avancées le Butin n'est pas en jeu : les alliances saisies
  // sont ignorées (et signalées par la validation).
  if (!ruleset.advancedCards) {
    return { earned: 0, lost: 0 };
  }

  let earned = 0;
  let lost = 0;
  for (const alliance of input.lootAlliances ?? []) {
    // Pas d'alliance avec soi-même : le poseur qui remporte son propre pli ne
    // s'allie à personne (PLAN.md §4.2).
    if (alliance.playerId === alliance.allyId) continue;
    if (alliance.playerId !== playerId && alliance.allyId !== playerId) continue;

    // Les **deux** mises doivent être exactes.
    const bothExact =
      (exactByPlayer.get(alliance.playerId) ?? false) &&
      (exactByPlayer.get(alliance.allyId) ?? false);
    if (bothExact) {
      earned += scale.loot;
    } else {
      lost += scale.loot;
    }
  }
  return { earned, lost };
}

/** Le pari de Rascal le Flambeur : gagné si la mise est exacte, débité sinon. */
function rascalBetDelta(player: PlayerRoundInput, exact: boolean, ruleset: Ruleset): number {
  if (!ruleset.pirateAbilities) return 0;
  const bet = player.rascalBet ?? 0;
  return exact ? bet : -bet;
}

/** Score de chaque joueur pour une manche. */
export function scoreRound(input: RoundInput, ruleset: Ruleset): PlayerRoundScore[] {
  const scale = BONUS_POINTS[ruleset.edition];
  const cardsDealt = Math.max(input.cardsDealt, 0);

  // Les mises effectives de toute la table sont nécessaires avant tout calcul :
  // le Butin dépend de l'exactitude de l'allié.
  const prepared = input.players.map((player) => {
    const effectiveBid = effectiveBidOf(player, cardsDealt, ruleset);
    // Une saisie incomplète n'est jamais « exacte » : sinon un allié pas encore
    // saisi ferait marquer le Butin par anticipation.
    const played = player.played ?? true;
    return { player, played, effectiveBid, exact: played && player.tricks === effectiveBid };
  });
  const exactByPlayer = new Map(prepared.map((entry) => [entry.player.playerId, entry.exact]));

  return prepared.map(({ player, played, effectiveBid, exact }) => {
    // Manche pas encore jouée pour ce joueur : rien à décompter. Le zéro
    // annoncé et le zéro « pas encore saisi » se ressemblent trop pour laisser
    // le décompte trancher tout seul.
    if (!played) {
      return {
        playerId: player.playerId,
        effectiveBid,
        exact: false,
        base: 0,
        bonus: 0,
        lostBonus: 0,
        rascalBet: 0,
        custom: 0,
        total: 0,
        played: false,
      };
    }

    const useCannonball =
      ruleset.scoring === 'rascal' && ruleset.rascalCannonball && (player.cannonball ?? false);
    const base =
      ruleset.scoring === 'rascal'
        ? rascalBase(effectiveBid, player.tricks, cardsDealt, useCannonball)
        : classicBase(effectiveBid, player.tricks, cardsDealt);

    // Les bonus ne comptent que si la mise est exacte. Ceux d'une mise ratée
    // sont conservés à part : l'UI les barre, les statistiques les comptent.
    const captures = captureBonusPoints(player, scale);
    const loot = lootPointsFor(player.playerId, input, exactByPlayer, scale, ruleset);
    const bonus = (exact ? captures : 0) + loot.earned;
    const lostBonus = (exact ? 0 : captures) + loot.lost;

    const bet = rascalBetDelta(player, exact, ruleset);
    const custom = player.customBonus ?? 0;

    return {
      playerId: player.playerId,
      effectiveBid,
      exact,
      base,
      bonus,
      lostBonus,
      rascalBet: bet,
      custom,
      total: base + bonus + bet + custom,
      played: true,
    };
  });
}
