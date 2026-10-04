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
  bonusTypesFor,
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

/** Boulet de canon réellement joué : l'option doit être ouverte dans la partie. */
function playsCannonball(player: PlayerRoundInput, ruleset: Ruleset): boolean {
  return ruleset.scoring === 'rascal' && ruleset.rascalCannonball && (player.cannonball ?? false);
}

/**
 * Part des bonus de capture qui compte, selon l'écart entre plis et mise
 * effective : tout si la mise est exacte, rien sinon. Le décompte Rascal leur
 * applique la même règle qu'au potentiel — la moitié à un pli près (fiche
 * « Rascal's Scoring », « Bonus Points »), pénalité des 7 de l'extension
 * comprise — sauf au Boulet de canon, qui reste tout ou rien.
 *
 * Le Butin n'en dépend pas : son alliance exige deux mises exactes.
 */
function captureShare(gap: number, ruleset: Ruleset, cannonball: boolean): number {
  if (gap === 0) return 1;
  const glancingBlow = gap === 1 && ruleset.scoring === 'rascal' && !cannonball;
  return glancingBlow ? RASCAL_POINTS.nearMissRatio : 0;
}

/** La même part, lue sur la saisie brute — pour la validation, qui n'a pas de score. */
export function captureShareOf(
  player: PlayerRoundInput,
  cardsDealt: number,
  ruleset: Ruleset,
): number {
  const gap = Math.abs(player.tricks - effectiveBidOf(player, cardsDealt, ruleset));
  return captureShare(gap, ruleset, playsCannonball(player, ruleset));
}

/**
 * Somme des bonus de capture saisis, aux valeurs de l'édition.
 *
 * Le total peut être négatif : les 7 de l'extension retirent 5 points chacun
 * (PLAN.md §4.6). Rien de spécial à faire pour autant — le livret les soumet à
 * la même condition d'exactitude que les bonus, donc au même calcul.
 */
function captureBonusPoints(player: PlayerRoundInput, scale: BonusScale, ruleset: Ruleset): number {
  let points = 0;
  // Extension éteinte : ses compteurs ne sont pas dans la liste, donc ignorés.
  for (const type of bonusTypesFor(ruleset)) {
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
        captureShare: 0,
        rascalBet: 0,
        custom: 0,
        total: 0,
        played: false,
      };
    }

    const cannonball = playsCannonball(player, ruleset);
    const base =
      ruleset.scoring === 'rascal'
        ? rascalBase(effectiveBid, player.tricks, cardsDealt, cannonball)
        : classicBase(effectiveBid, player.tricks, cardsDealt);

    // Les bonus ne comptent entiers que si la mise est exacte. La part perdue
    // est conservée à part : l'UI la barre, les statistiques la comptent. Le
    // demi-point des 7 et 8 de l'extension se règle en faveur du joueur.
    const captures = captureBonusPoints(player, scale, ruleset);
    const share = captureShare(Math.abs(player.tricks - effectiveBid), ruleset, cannonball);
    const keptCaptures = Math.round(captures * share);
    const loot = lootPointsFor(player.playerId, input, exactByPlayer, scale, ruleset);
    const bonus = keptCaptures + loot.earned;
    const lostBonus = captures - keptCaptures + loot.lost;

    const bet = rascalBetDelta(player, exact, ruleset);
    const custom = player.customBonus ?? 0;

    return {
      playerId: player.playerId,
      effectiveBid,
      exact,
      base,
      bonus,
      lostBonus,
      captureShare: share,
      rascalBet: bet,
      custom,
      total: base + bonus + bet + custom,
      played: true,
    };
  });
}
