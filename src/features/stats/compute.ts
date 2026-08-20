/**
 * Calcul des statistiques (PLAN.md §8).
 *
 * Module **pur** : il reçoit des lignes déjà lues, il ne connaît pas SQLite.
 * Le plan prévoyait des agrégats SQL ; les écrire ici plutôt qu'en requêtes
 * les rend **testables sur fixtures**, ce que le plan exige aussi (§8) et que
 * Jest ne peut pas faire sur une base SQLite dans cet environnement. Le volume
 * s'y prête : dix manches par partie, huit joueurs au plus.
 *
 * Deux décisions structurantes :
 *
 * 1. **Seules les parties terminées comptent.** Une partie abandonnée à la
 *    manche 3 ferait plonger une moyenne sans rien dire du joueur.
 * 2. **Les points viennent des snapshots** (§5), pas d'un recalcul : ils sont
 *    déjà à jour et déjà conformes au barème de leur partie.
 */

import { effectiveBidOf, type Ruleset } from '@/core';

export interface StatsGame {
  id: number;
  status: string;
  ruleset: Ruleset;
}

export interface StatsRound {
  id: number;
  gameId: number;
  roundNumber: number;
  cardsDealt: number;
}

export interface StatsEntry {
  roundId: number;
  playerId: number;
  bid: number | null;
  tricks: number | null;
  bidModifier: number;
  scoreTotal: number | null;
  scoreBonus: number | null;
}

export interface StatsInput {
  games: StatsGame[];
  rounds: StatsRound[];
  entries: StatsEntry[];
}

export interface PlayerStats {
  playerId: number;
  /** Parties terminées — le dénominateur de tout ce qui suit. */
  games: number;
  /** Le chiffre principal de la fiche : score moyen par partie terminée. */
  averageScore: number | null;
  bestScore: number | null;
  wins: number;
  /** Part de victoires, `null` tant qu'aucune partie n'est terminée. */
  winRate: number | null;
  /** Position moyenne au classement final (1 = vainqueur). */
  averageRank: number | null;
  /** Manches jouées, c'est-à-dire annonce **et** plis saisis. */
  rounds: number;
  exactRounds: number;
  /** Part de manches où la mise est tombée juste. */
  accuracy: number | null;
  /** Écart moyen |mise − plis|, mesure d'audace autant que d'erreur. */
  averageGap: number | null;
  zeroBids: number;
  zeroBidsWon: number;
  bonusPoints: number;
  /** Manches exactes par numéro de manche — matière de la courbe du §8. */
  byRound: { roundNumber: number; played: number; exact: number }[];
}

export interface GlobalStats {
  finishedGames: number;
  /** Manches réellement jouées, une manche comptant pour une quel que soit le nombre de joueurs. */
  playedRounds: number;
  /** Meilleur score jamais réalisé sur une partie. */
  bestGame: { playerId: number; score: number } | null;
  /** Meilleure manche : le plus gros score sur une seule manche. */
  bestRound: { playerId: number; score: number; roundNumber: number } | null;
  /**
   * Classement all-time **à la moyenne**, pas au cumul : trier par total
   * reviendrait à classer par assiduité. Seuls les joueurs ayant atteint le
   * seuil de parties y figurent.
   */
  ranking: { playerId: number; averageScore: number; games: number }[];
}

/** En dessous, une moyenne ne veut rien dire : l'écran le dit plutôt que de mentir. */
export const MIN_GAMES_FOR_RATES = 3;

function ratio(part: number, whole: number): number | null {
  return whole === 0 ? null : part / whole;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function emptyStats(playerId: number): PlayerStats {
  return {
    playerId,
    games: 0,
    averageScore: null,
    bestScore: null,
    wins: 0,
    winRate: null,
    averageRank: null,
    rounds: 0,
    exactRounds: 0,
    accuracy: null,
    averageGap: null,
    zeroBids: 0,
    zeroBidsWon: 0,
    bonusPoints: 0,
    byRound: [],
  };
}

/**
 * Statistiques de tous les joueurs en une passe : la fiche d'un joueur et le
 * classement all-time se nourrissent des mêmes agrégats.
 */
export function computeStats(input: StatsInput): {
  players: Map<number, PlayerStats>;
  global: GlobalStats;
} {
  const finished = input.games.filter((game) => game.status === 'finished');
  const gameById = new Map(finished.map((game) => [game.id, game]));
  const roundsById = new Map(input.rounds.map((round) => [round.id, round]));

  // Totaux par partie et par joueur, puis rangs — la base des moyennes.
  const totals = new Map<number, Map<number, number>>();
  const perPlayer = new Map<number, PlayerStats>();
  const byRound = new Map<number, Map<number, { played: number; exact: number }>>();
  const gapsByPlayer = new Map<number, number[]>();

  let bestGame: GlobalStats['bestGame'] = null;
  let bestRound: GlobalStats['bestRound'] = null;
  // Des manches, pas des lignes de saisie : une manche à quatre joueurs reste
  // une manche.
  const playedRounds = new Set<number>();

  const statsOf = (playerId: number): PlayerStats => {
    const existing = perPlayer.get(playerId);
    if (existing) return existing;
    const created = emptyStats(playerId);
    perPlayer.set(playerId, created);
    return created;
  };

  for (const entry of input.entries) {
    const round = roundsById.get(entry.roundId);
    if (!round) continue;
    const game = gameById.get(round.gameId);
    if (!game) continue;

    const stats = statsOf(entry.playerId);

    const gameTotals = totals.get(round.gameId) ?? new Map<number, number>();
    gameTotals.set(entry.playerId, (gameTotals.get(entry.playerId) ?? 0) + (entry.scoreTotal ?? 0));
    totals.set(round.gameId, gameTotals);

    stats.bonusPoints += entry.scoreBonus ?? 0;

    if (entry.scoreTotal !== null && (bestRound === null || entry.scoreTotal > bestRound.score)) {
      bestRound = {
        playerId: entry.playerId,
        score: entry.scoreTotal,
        roundNumber: round.roundNumber,
      };
    }

    // Une manche n'est « jouée » que si annonce et plis sont posés : le reste
    // est une saisie en cours, elle ne dit rien de la justesse d'un joueur.
    if (entry.bid === null || entry.tricks === null) continue;

    playedRounds.add(round.id);
    // La mise qui fait foi est l'effective : Harry le Géant peut l'avoir
    // décalée. C'est le moteur qui tranche, pas une règle réécrite ici.
    const effectiveBid = effectiveBidOf(
      {
        playerId: String(entry.playerId),
        bid: entry.bid,
        tricks: entry.tricks,
        bidModifier: entry.bidModifier as -1 | 0 | 1,
      },
      round.cardsDealt,
      game.ruleset,
    );
    const exact = entry.tricks === effectiveBid;

    stats.rounds += 1;
    if (exact) stats.exactRounds += 1;
    if (effectiveBid === 0) {
      stats.zeroBids += 1;
      if (exact) stats.zeroBidsWon += 1;
    }

    const buckets =
      byRound.get(entry.playerId) ?? new Map<number, { played: number; exact: number }>();
    const bucket = buckets.get(round.roundNumber) ?? { played: 0, exact: 0 };
    bucket.played += 1;
    if (exact) bucket.exact += 1;
    buckets.set(round.roundNumber, bucket);
    byRound.set(entry.playerId, buckets);

    const gaps = gapsByPlayer.get(entry.playerId) ?? [];
    gaps.push(Math.abs(entry.tricks - effectiveBid));
    gapsByPlayer.set(entry.playerId, gaps);
  }

  // Moyennes, rangs et victoires, partie par partie.
  const scoresByPlayer = new Map<number, number[]>();
  const ranksByPlayer = new Map<number, number[]>();

  for (const [, gameTotals] of totals) {
    const standings = [...gameTotals.entries()].sort((a, b) => b[1] - a[1]);
    standings.forEach(([playerId, total], index) => {
      const stats = statsOf(playerId);
      stats.games += 1;

      const scores = scoresByPlayer.get(playerId) ?? [];
      scores.push(total);
      scoresByPlayer.set(playerId, scores);

      // Rang partagé en cas d'égalité, comme dans le moteur (§4.5).
      const rank =
        index > 0 && standings[index - 1][1] === total
          ? (ranksByPlayer.get(standings[index - 1][0]) ?? []).slice(-1)[0]
          : index + 1;
      const ranks = ranksByPlayer.get(playerId) ?? [];
      ranks.push(rank);
      ranksByPlayer.set(playerId, ranks);

      if (rank === 1) stats.wins += 1;
      if (bestGame === null || total > bestGame.score) {
        bestGame = { playerId, score: total };
      }
    });
  }

  for (const stats of perPlayer.values()) {
    const scores = scoresByPlayer.get(stats.playerId) ?? [];
    stats.averageScore = mean(scores);
    stats.bestScore = scores.length > 0 ? Math.max(...scores) : null;
    stats.winRate = ratio(stats.wins, stats.games);
    stats.averageRank = mean(ranksByPlayer.get(stats.playerId) ?? []);
    stats.accuracy = ratio(stats.exactRounds, stats.rounds);
    stats.averageGap = mean(gapsByPlayer.get(stats.playerId) ?? []);
    stats.byRound = [...(byRound.get(stats.playerId) ?? new Map())]
      .map(([roundNumber, bucket]) => ({ roundNumber, ...bucket }))
      .sort((a, b) => a.roundNumber - b.roundNumber);
  }

  const ranking = [...perPlayer.values()]
    .filter((stats) => stats.games >= MIN_GAMES_FOR_RATES && stats.averageScore !== null)
    .map((stats) => ({
      playerId: stats.playerId,
      averageScore: stats.averageScore as number,
      games: stats.games,
    }))
    .sort((a, b) => b.averageScore - a.averageScore);

  return {
    players: perPlayer,
    global: {
      finishedGames: finished.length,
      playedRounds: playedRounds.size,
      bestGame,
      bestRound,
      ranking,
    },
  };
}
