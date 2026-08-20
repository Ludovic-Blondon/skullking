import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { statsEntriesQuery, statsGamesQuery, statsRoundsQuery } from '@/db/repositories/stats-repo';

import { computeStats, type GlobalStats, type PlayerStats } from './compute';

export interface StatsView {
  players: Map<number, PlayerStats>;
  global: GlobalStats;
}

/**
 * Statistiques de toute la base, recalculées à chaque écriture (PLAN.md §8).
 *
 * Une seule passe sert la fiche d'un joueur comme le classement all-time : les
 * deux lisent les mêmes agrégats, ils ne peuvent donc pas se contredire.
 */
export function useStats(): StatsView {
  const gamesQuery = useLiveQuery(statsGamesQuery());
  const roundsQuery = useLiveQuery(statsRoundsQuery());
  const entriesQuery = useLiveQuery(statsEntriesQuery());

  return useMemo(
    () =>
      computeStats({
        games: gamesQuery.data,
        rounds: roundsQuery.data,
        entries: entriesQuery.data,
      }),
    [gamesQuery.data, roundsQuery.data, entriesQuery.data],
  );
}
