/**
 * Contrôles de cohérence d'une manche (PLAN.md §4.4).
 *
 * Le moteur renvoie des **codes**, jamais des phrases : les messages lisibles
 * vivent dans les fichiers de traduction. Une `error` empêche de valider la
 * manche ; un `warning` est purement informatif — l'UI l'affiche, le décompte
 * s'en accommode.
 */

import {
  ALL_BONUS_TYPES,
  BONUS_POINTS,
  bonusTypesFor,
  maxDestroyedTricksFor,
  maxPlayersFor,
  MIN_PLAYERS,
  RASCAL_BETS,
  ROUND_BONUS_LIMITS,
} from './rules/editions';
import { effectiveBidOf } from './scoring';
import type { BonusType, Issue, PlayerId, RoundInput, Ruleset } from './types';

function isInteger(value: number): boolean {
  return Number.isInteger(value);
}

/** Total d'un type de bonus sur la manche, tous joueurs confondus. */
function totalBonus(input: RoundInput, type: BonusType): number {
  return input.players.reduce((sum, player) => sum + (player.bonuses?.[type] ?? 0), 0);
}

export function validateRound(input: RoundInput, ruleset: Ruleset): Issue[] {
  const issues: Issue[] = [];
  const { cardsDealt } = input;
  const scale = BONUS_POINTS[ruleset.edition];
  const destroyed = input.destroyedTricks ?? 0;
  // Compteurs réellement décomptés : ceux de la boîte, plus ceux de l'extension
  // quand elle est en jeu (PLAN.md §4.6).
  const countedTypes = bonusTypesFor(ruleset);
  const maxPlayers = maxPlayersFor(ruleset);
  const maxDestroyed = maxDestroyedTricksFor(ruleset);

  // — Cadre de la manche ————————————————————————————————————————————————
  if (!isInteger(cardsDealt) || cardsDealt < 1) {
    issues.push({ code: 'cardsDealtOutOfRange', severity: 'error', value: cardsDealt, min: 1 });
  }

  if (input.players.length < MIN_PLAYERS || input.players.length > maxPlayers) {
    issues.push({
      code: 'playerCountOutOfRange',
      severity: 'error',
      value: input.players.length,
      min: MIN_PLAYERS,
      max: maxPlayers,
    });
  }

  const seen = new Set<PlayerId>();
  for (const player of input.players) {
    if (seen.has(player.playerId)) {
      issues.push({ code: 'duplicatePlayer', severity: 'error', playerId: player.playerId });
    }
    seen.add(player.playerId);
  }

  if (!isInteger(destroyed) || destroyed < 0 || destroyed > maxDestroyed) {
    issues.push({
      code: 'destroyedTricksOutOfRange',
      severity: 'error',
      value: destroyed,
      min: 0,
      max: maxDestroyed,
    });
  }
  if (destroyed > 0 && !ruleset.advancedCards) {
    issues.push({
      code: 'destroyedTricksWithoutAdvancedCards',
      severity: 'error',
      value: destroyed,
    });
  }

  // — Saisie de chaque joueur ————————————————————————————————————————————
  let harryCount = 0;
  let betCount = 0;

  for (const player of input.players) {
    const { playerId } = player;

    if (!isInteger(player.bid) || player.bid < 0 || player.bid > cardsDealt) {
      issues.push({
        code: 'bidOutOfRange',
        severity: 'error',
        playerId,
        value: player.bid,
        min: 0,
        max: cardsDealt,
      });
    }

    if (!isInteger(player.tricks) || player.tricks < 0 || player.tricks > cardsDealt) {
      issues.push({
        code: 'tricksOutOfRange',
        severity: 'error',
        playerId,
        value: player.tricks,
        min: 0,
        max: cardsDealt,
      });
    }

    if (player.customBonus !== undefined && !isInteger(player.customBonus)) {
      issues.push({
        code: 'invalidCustomBonus',
        severity: 'error',
        playerId,
        value: player.customBonus,
      });
    }

    // — Pouvoirs des pirates —
    const modifier = player.bidModifier ?? 0;
    const bet = player.rascalBet ?? 0;

    if (modifier !== 0) harryCount += 1;
    if (bet !== 0) betCount += 1;

    if (!ruleset.pirateAbilities && (modifier !== 0 || bet !== 0)) {
      issues.push({ code: 'pirateAbilitiesDisabled', severity: 'error', playerId });
    }

    if (![-1, 0, 1].includes(modifier)) {
      issues.push({ code: 'invalidBidModifier', severity: 'error', playerId, value: modifier });
    }

    if (!(RASCAL_BETS as readonly number[]).includes(bet)) {
      issues.push({ code: 'invalidRascalBet', severity: 'error', playerId, value: bet });
    }

    // La mise effective est calculée sans écrêtage ici : sortir de l'intervalle
    // est une erreur de saisie, pas quelque chose à corriger en silence.
    const rawEffectiveBid = player.bid + modifier;
    if (modifier !== 0 && (rawEffectiveBid < 0 || rawEffectiveBid > cardsDealt)) {
      issues.push({
        code: 'effectiveBidOutOfRange',
        severity: 'error',
        playerId,
        value: rawEffectiveBid,
        min: 0,
        max: cardsDealt,
      });
    }

    // — Compteurs de bonus —
    for (const type of ALL_BONUS_TYPES) {
      const count = player.bonuses?.[type] ?? 0;
      if (!isInteger(count) || count < 0) {
        issues.push({
          code: 'invalidBonusCount',
          severity: 'error',
          playerId,
          bonus: type,
          value: count,
        });
        continue;
      }
      // Seuls les compteurs d'extension peuvent manquer à l'appel : les cartes
      // ne sont pas sur la table, la saisie n'a pas de sens.
      if (count > 0 && !countedTypes.includes(type)) {
        issues.push({
          code: 'bonusUnavailableWithoutExpansion',
          severity: 'error',
          playerId,
          bonus: type,
        });
        continue;
      }
      if (count > 0 && scale[type] === null) {
        issues.push({
          code: 'bonusUnavailableInEdition',
          severity: 'error',
          playerId,
          bonus: type,
        });
      }
    }
  }

  if (harryCount > 1) {
    issues.push({ code: 'multipleHarry', severity: 'error', value: harryCount, max: 1 });
  }
  if (betCount > 1) {
    issues.push({ code: 'multipleRascalBets', severity: 'error', value: betCount, max: 1 });
  }

  // — Cohérence des bonus sur la manche ——————————————————————————————————
  const mermaidOnSkullKing = totalBonus(input, 'mermaidCapturesSkullKing');

  for (const type of countedTypes) {
    const total = totalBonus(input, type);
    // Une sirène qui a capturé le Skull King a remporté son pli : elle n'a pas
    // pu être capturée par un pirate dans le même temps.
    const limit =
      type === 'pirateCapturesMermaid'
        ? Math.max(0, ROUND_BONUS_LIMITS[type] - Math.min(mermaidOnSkullKing, 1))
        : ROUND_BONUS_LIMITS[type];

    if (total > limit) {
      issues.push({
        code: 'bonusCountExceeded',
        severity: 'error',
        bonus: type,
        value: total,
        max: limit,
      });
    }
  }

  // Le Skull King est une carte unique : capturé par une sirène, il a perdu son
  // pli — il n'a donc capturé aucun pirate de la manche (PLAN.md §4.2).
  if (mermaidOnSkullKing > 0 && totalBonus(input, 'skullKingCapturesPirate') > 0) {
    issues.push({ code: 'skullKingAlreadyCaptured', severity: 'error' });
  }

  // — Butin ——————————————————————————————————————————————————————————————
  const alliances = input.lootAlliances ?? [];
  if (alliances.length > 0) {
    if (!ruleset.advancedCards) {
      issues.push({ code: 'lootWithoutAdvancedCards', severity: 'error', value: alliances.length });
    }
    // Les cartes Butin ne sont pas utilisées à 2 joueurs (PLAN.md §4.1).
    if (input.players.length === MIN_PLAYERS) {
      issues.push({ code: 'lootWithTwoPlayers', severity: 'error', value: alliances.length });
    }
    if (alliances.length > ROUND_BONUS_LIMITS.lootAlliances) {
      issues.push({
        code: 'lootAlliancesExceeded',
        severity: 'error',
        value: alliances.length,
        max: ROUND_BONUS_LIMITS.lootAlliances,
      });
    }
    for (const alliance of alliances) {
      // Pas d'alliance si le poseur remporte son propre pli.
      if (alliance.playerId === alliance.allyId) {
        issues.push({ code: 'lootSelfAlliance', severity: 'error', playerId: alliance.playerId });
        continue;
      }
      for (const id of [alliance.playerId, alliance.allyId]) {
        if (!seen.has(id)) {
          issues.push({ code: 'lootUnknownPlayer', severity: 'error', playerId: id });
        }
      }
    }
  }

  // — Total des plis ——————————————————————————————————————————————————————
  const claimedTricks = input.players.reduce((sum, player) => sum + player.tricks, 0);
  const accounted = claimedTricks + destroyed;
  // À 2 joueurs le fantôme « Barbe Grise » absorbe le solde : le total peut être
  // inférieur au nombre de cartes, jamais supérieur.
  const mismatch =
    input.players.length === MIN_PLAYERS ? accounted > cardsDealt : accounted !== cardsDealt;
  if (mismatch) {
    issues.push({
      code: 'trickCountMismatch',
      severity: 'error',
      value: accounted,
      expected: cardsDealt,
    });
  }

  // — Avertissements ————————————————————————————————————————————————————
  for (const player of input.players) {
    const effectiveBid = effectiveBidOf(player, cardsDealt, ruleset);
    if (player.tricks === effectiveBid) continue;

    const hasCaptures = countedTypes.some((type) => (player.bonuses?.[type] ?? 0) > 0);
    const inAlliance = alliances.some(
      (alliance) => alliance.playerId === player.playerId || alliance.allyId === player.playerId,
    );
    if (hasCaptures || inAlliance) {
      issues.push({ code: 'bonusOnMissedBid', severity: 'warning', playerId: player.playerId });
    }
  }

  return issues;
}

/** Vrai si la manche peut être validée telle quelle. */
export function hasBlockingIssues(issues: Issue[]): boolean {
  return issues.some((issue) => issue.severity === 'error');
}
