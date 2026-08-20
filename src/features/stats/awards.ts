/**
 * Awards de fin de partie (PLAN.md §8) : quatre titres décernés automatiquement,
 * pour le plaisir de la table.
 *
 * Module **pur**, calculé sur une seule partie — il ne lit ni base ni écran.
 *
 * Deux règles de décence :
 *
 * 1. **Un titre sans contenu ne se décerne pas.** Personne n'a marqué de bonus ?
 *    Pas de chasseur de primes.
 * 2. **Un titre que tout le monde mérite ne se décerne pas** : si toute la table
 *    est à égalité, le titre ne distingue rien. Une égalité partielle, elle, se
 *    partage — deux visionnaires valent mieux qu'un titre escamoté.
 */

import type { PlayerId, RoundInput, RoundResult } from '@/core';
import type { MessageKey, PluralKey } from '@/i18n';

export type AwardId = 'visionary' | 'daredevil' | 'bounty' | 'zeroAdmiral';

export interface Award {
  id: AwardId;
  emoji: string;
  /** Clés du catalogue : le module ne connaît aucune langue. */
  labelKey: MessageKey;
  detailKey: PluralKey | MessageKey;
  /** Ce que le titre récompense — le compte à interpoler. */
  value: number;
  playerIds: PlayerId[];
}

const SPECS: Record<
  AwardId,
  { emoji: string; labelKey: MessageKey; detailKey: MessageKey | PluralKey }
> = {
  visionary: { emoji: '🎯', labelKey: 'award.visionary', detailKey: 'award.visionaryDetail' },
  daredevil: { emoji: '🔥', labelKey: 'award.daredevil', detailKey: 'award.daredevilDetail' },
  bounty: { emoji: '💰', labelKey: 'award.bounty', detailKey: 'award.bountyDetail' },
  zeroAdmiral: {
    emoji: '⚓',
    labelKey: 'award.zeroAdmiral',
    detailKey: 'award.zeroAdmiralDetail',
  },
};

/** Vainqueurs d'un décompte : les meilleurs, sauf si tout le monde l'est. */
function winnersOf(scores: Map<PlayerId, number>): { playerIds: PlayerId[]; value: number } | null {
  if (scores.size === 0) return null;
  const values = [...scores.values()];
  const best = Math.max(...values);
  if (best <= 0) return null;

  const playerIds = [...scores.entries()]
    .filter(([, value]) => value === best)
    .map(([playerId]) => playerId);

  return playerIds.length === scores.size ? null : { playerIds, value: best };
}

/**
 * Décerne les titres d'une partie. `rounds` porte les scores calculés par le
 * moteur, `inputs` la saisie brute — l'écart cumulé a besoin des plis, que le
 * score seul ne transporte pas.
 */
export function computeAwards(rounds: RoundResult[], inputs: RoundInput[]): Award[] {
  const exact = new Map<PlayerId, number>();
  const gaps = new Map<PlayerId, number>();
  const bonus = new Map<PlayerId, number>();
  const zeros = new Map<PlayerId, number>();

  const add = (map: Map<PlayerId, number>, playerId: PlayerId, value: number) =>
    map.set(playerId, (map.get(playerId) ?? 0) + value);

  rounds.forEach((result, index) => {
    const input = inputs[index];
    for (const score of result.scores) {
      if (!score.played) continue;
      const entry = input?.players.find((player) => player.playerId === score.playerId);

      // Chaque joueur doit figurer dans les décomptes, même à zéro : sinon un
      // titre serait décerné à l'unanimité d'un seul participant.
      add(exact, score.playerId, score.exact ? 1 : 0);
      add(bonus, score.playerId, score.bonus);
      add(gaps, score.playerId, entry ? Math.abs(entry.tricks - score.effectiveBid) : 0);
      add(zeros, score.playerId, score.effectiveBid === 0 && score.exact ? 1 : 0);
    }
  });

  const candidates: [AwardId, Map<PlayerId, number>][] = [
    ['visionary', exact],
    ['daredevil', gaps],
    ['bounty', bonus],
    ['zeroAdmiral', zeros],
  ];

  return candidates.flatMap(([id, scores]) => {
    const winner = winnersOf(scores);
    if (!winner) return [];
    const spec = SPECS[id];
    return [{ id, ...spec, value: winner.value, playerIds: winner.playerIds }];
  });
}
