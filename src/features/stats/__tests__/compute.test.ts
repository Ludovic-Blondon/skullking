import { DEFAULT_RULESET } from '@/core';

import { computeStats, MIN_GAMES_FOR_RATES, type StatsInput } from '../compute';

/**
 * Une manche complète : les entrées portent la saisie et le score figé, tel que
 * la base les stocke après validation (§5).
 */
function round(
  id: number,
  gameId: number,
  roundNumber: number,
  cardsDealt: number,
  entries: [player: number, bid: number | null, tricks: number | null, score: number][],
) {
  return {
    round: { id, gameId, roundNumber, cardsDealt },
    entries: entries.map(([playerId, bid, tricks, score]) => ({
      roundId: id,
      playerId,
      bid,
      tricks,
      bidModifier: 0,
      scoreTotal: score,
      scoreBonus: 0,
    })),
  };
}

/**
 * Deux parties terminées de deux manches, à deux joueurs.
 * Partie 1 : le joueur 1 l'emporte 40 à 10. Partie 2 : le joueur 2, 50 à −10.
 * Moyennes attendues : joueur 1 → 15, joueur 2 → 30.
 */
function twoGames(): StatsInput {
  const parts = [
    round(11, 1, 1, 1, [
      [1, 1, 1, 20],
      [2, 0, 0, 10],
    ]),
    round(12, 1, 2, 2, [
      [1, 0, 0, 20],
      [2, 2, 1, 0],
    ]),
    round(21, 2, 1, 1, [
      [1, 1, 0, -10],
      [2, 0, 0, 10],
    ]),
    round(22, 2, 2, 2, [
      [1, 0, 0, 0],
      [2, 2, 2, 40],
    ]),
  ];

  return {
    games: [
      { id: 1, status: 'finished', ruleset: DEFAULT_RULESET },
      { id: 2, status: 'finished', ruleset: DEFAULT_RULESET },
    ],
    rounds: parts.map((part) => part.round),
    entries: parts.flatMap((part) => part.entries),
  };
}

describe('score moyen', () => {
  it('moyenne les totaux de chaque partie terminée', () => {
    const { players } = computeStats(twoGames());

    expect(players.get(1)).toMatchObject({ games: 2, averageScore: 15, bestScore: 40 });
    expect(players.get(2)).toMatchObject({ games: 2, averageScore: 30, bestScore: 50 });
  });

  /** Une partie abandonnée en cours de route ne dit rien du niveau d'un joueur. */
  it('ignore les parties non terminées', () => {
    const input = twoGames();
    input.games[1] = { ...input.games[1], status: 'abandoned' };

    const { players, global } = computeStats(input);
    expect(players.get(1)).toMatchObject({ games: 1, averageScore: 40 });
    expect(players.get(2)).toMatchObject({ games: 1, averageScore: 10 });
    expect(global.finishedGames).toBe(1);
  });

  it('ne renvoie aucune moyenne quand rien n’est terminé', () => {
    const input = twoGames();
    input.games = input.games.map((game) => ({ ...game, status: 'in_progress' }));

    const { players, global } = computeStats(input);
    expect(players.size).toBe(0);
    expect(global.ranking).toEqual([]);
    expect(global.bestGame).toBeNull();
  });
});

describe('victoires et rangs', () => {
  it('compte une victoire par partie gagnée', () => {
    const { players } = computeStats(twoGames());
    expect(players.get(1)).toMatchObject({ wins: 1, winRate: 0.5, averageRank: 1.5 });
    expect(players.get(2)).toMatchObject({ wins: 1, winRate: 0.5, averageRank: 1.5 });
  });

  /** Deux joueurs à égalité partagent le rang, comme dans le moteur (§4.5). */
  it('partage le rang en cas d’égalité', () => {
    const input: StatsInput = {
      games: [{ id: 1, status: 'finished', ruleset: DEFAULT_RULESET }],
      ...(() => {
        const part = round(11, 1, 1, 1, [
          [1, 1, 1, 20],
          [2, 1, 1, 20],
          [3, 0, 1, -10],
        ]);
        return { rounds: [part.round], entries: part.entries };
      })(),
    };

    const { players } = computeStats(input);
    expect(players.get(1)).toMatchObject({ wins: 1, averageRank: 1 });
    expect(players.get(2)).toMatchObject({ wins: 1, averageRank: 1 });
    expect(players.get(3)).toMatchObject({ wins: 0, averageRank: 3 });
  });
});

describe('précision d’annonce', () => {
  it('compte les manches exactes et l’écart moyen', () => {
    const { players } = computeStats(twoGames());

    // Joueur 1 : exact, exact, raté d'un pli, exact → 3 sur 4, écart moyen 0,25.
    expect(players.get(1)).toMatchObject({ rounds: 4, exactRounds: 3, accuracy: 0.75 });
    expect(players.get(1)?.averageGap).toBeCloseTo(0.25);
  });

  it('ne compte pas une manche dont la saisie est incomplète', () => {
    const input = twoGames();
    input.entries = input.entries.map((entry) =>
      entry.roundId === 11 && entry.playerId === 1 ? { ...entry, tricks: null } : entry,
    );

    const { players, global } = computeStats(input);
    expect(players.get(1)).toMatchObject({ rounds: 3, exactRounds: 2 });
    // La manche 11 reste jouée : le joueur 2 y a bien été saisi.
    expect(global.playedRounds).toBe(4);
  });

  /** La mise qui compte est l'effective : Harry le Géant peut l'avoir décalée. */
  it('suit la mise corrigée par Harry le Géant', () => {
    const part = round(11, 1, 1, 3, [[1, 2, 3, 60]]);
    const input: StatsInput = {
      games: [
        { id: 1, status: 'finished', ruleset: { ...DEFAULT_RULESET, pirateAbilities: true } },
      ],
      rounds: [part.round],
      entries: part.entries.map((entry) => ({ ...entry, bidModifier: 1 })),
    };

    expect(computeStats(input).players.get(1)).toMatchObject({ exactRounds: 1, accuracy: 1 });

    // Pouvoirs désactivés : le modificateur est ignoré, la mise reste 2.
    const withoutPowers: StatsInput = {
      ...input,
      games: [{ ...input.games[0], ruleset: { ...DEFAULT_RULESET, pirateAbilities: false } }],
    };
    expect(computeStats(withoutPowers).players.get(1)).toMatchObject({ exactRounds: 0 });
  });

  it('détaille la précision manche par manche', () => {
    const { players } = computeStats(twoGames());
    expect(players.get(2)?.byRound).toEqual([
      { roundNumber: 1, played: 2, exact: 2 },
      { roundNumber: 2, played: 2, exact: 1 },
    ]);
  });
});

describe('mises 0 et bonus', () => {
  it('compte les mises 0 tentées et tenues', () => {
    const { players } = computeStats(twoGames());
    // Joueur 1 : deux mises 0, toutes deux tenues.
    expect(players.get(1)).toMatchObject({ zeroBids: 2, zeroBidsWon: 2 });
    // Joueur 2 : deux mises 0 en manche 1, tenues.
    expect(players.get(2)).toMatchObject({ zeroBids: 2, zeroBidsWon: 2 });
  });

  it('cumule les points de bonus effectivement marqués', () => {
    const input = twoGames();
    input.entries = input.entries.map((entry) =>
      entry.playerId === 1 && entry.roundId === 12 ? { ...entry, scoreBonus: 20 } : entry,
    );
    expect(computeStats(input).players.get(1)?.bonusPoints).toBe(20);
  });
});

describe('statistiques globales', () => {
  it('retient le meilleur score de partie et de manche', () => {
    const { global } = computeStats(twoGames());
    expect(global.bestGame).toEqual({ playerId: 2, score: 50 });
    expect(global.bestRound).toEqual({ playerId: 2, score: 40, roundNumber: 2 });
  });

  /**
   * Le classement se trie à la moyenne : au cumul, il classerait par assiduité.
   * En dessous du seuil de parties, un joueur n'y figure pas.
   */
  it('classe à la moyenne, au-dessus du seuil de parties', () => {
    const input = twoGames();
    expect(computeStats(input).global.ranking).toEqual([]);

    // Une troisième partie fait passer les deux joueurs au-dessus du seuil.
    const third = round(31, 3, 1, 1, [
      [1, 1, 1, 60],
      [2, 0, 1, -10],
    ]);
    input.games.push({ id: 3, status: 'finished', ruleset: DEFAULT_RULESET });
    input.rounds.push(third.round);
    input.entries.push(...third.entries);

    const { global, players } = computeStats(input);
    expect(players.get(1)?.games).toBe(MIN_GAMES_FOR_RATES);
    expect(global.ranking).toEqual([
      { playerId: 1, averageScore: (40 - 10 + 60) / 3, games: 3 },
      { playerId: 2, averageScore: (10 + 50 - 10) / 3, games: 3 },
    ]);
  });
});

describe('cas dégénérés', () => {
  it('accepte une base vide', () => {
    const { players, global } = computeStats({ games: [], rounds: [], entries: [] });
    expect(players.size).toBe(0);
    expect(global).toMatchObject({ finishedGames: 0, playedRounds: 0, bestRound: null });
  });

  it('ignore une entrée dont la manche a disparu', () => {
    const input = twoGames();
    input.entries.push({
      roundId: 999,
      playerId: 9,
      bid: 1,
      tricks: 1,
      bidModifier: 0,
      scoreTotal: 20,
      scoreBonus: 0,
    });
    expect(computeStats(input).players.has(9)).toBe(false);
  });
});
