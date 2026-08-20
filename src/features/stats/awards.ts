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

export type AwardId = 'visionary' | 'daredevil' | 'bounty' | 'zeroAdmiral';

export interface Award {
  id: AwardId;
  emoji: string;
  label: string;
  /** Ce que le titre récompense, dit en clair (« 6 annonces exactes »). */
  detail: string;
  playerIds: PlayerId[];
}

interface AwardSpec {
  id: AwardId;
  emoji: string;
  label: string;
  detail: (value: number) => string;
}

const SPECS: Record<AwardId, AwardSpec> = {
  visionary: {
    id: 'visionary',
    emoji: '🎯',
    label: 'Visionnaire',
    detail: (value) => `${value} annonce${value > 1 ? 's' : ''} exacte${value > 1 ? 's' : ''}`,
  },
  daredevil: {
    id: 'daredevil',
    emoji: '🔥',
    label: 'Tête brûlée',
    detail: (value) => `${value} pli${value > 1 ? 's' : ''} d’écart cumulé`,
  },
  bounty: {
    id: 'bounty',
    emoji: '💰',
    label: 'Chasseur de primes',
    detail: (value) => `${value} points de bonus`,
  },
  zeroAdmiral: {
    id: 'zeroAdmiral',
    emoji: '⚓',
    label: 'Amiral du zéro',
    detail: (value) => `${value} mise${value > 1 ? 's' : ''} 0 tenue${value > 1 ? 's' : ''}`,
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
    return [
      {
        id,
        emoji: spec.emoji,
        label: spec.label,
        detail: spec.detail(winner.value),
        playerIds: winner.playerIds,
      },
    ];
  });
}
