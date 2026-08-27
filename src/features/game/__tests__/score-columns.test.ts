import type { Standing } from '@/core';
import { PLAYER_COLORS } from '@/ui/tokens';

import { rankedColumns } from '../score-columns';
import type { SeatedPlayer } from '../use-game';

function seat(id: number, name: string, color: string | null = null): SeatedPlayer {
  return { id, name, emoji: null, color, seatIndex: id - 1 };
}

function standing(playerId: string, total: number, rank: number): Standing {
  return { playerId, total, rank };
}

/** Alice, Bob et Chloé, dans l'ordre des places à table. */
const seats = [seat(1, 'Alice'), seat(2, 'Bob'), seat(3, 'Chloé')];

const namesOf = (columns: ReturnType<typeof rankedColumns>) =>
  columns.map((column) => column.seat.name);

describe('rankedColumns', () => {
  it('range les colonnes du premier au dernier', () => {
    const standings = [standing('3', 60, 1), standing('1', 40, 2), standing('2', 10, 3)];

    expect(namesOf(rankedColumns(seats, standings))).toEqual(['Chloé', 'Alice', 'Bob']);
  });

  /** Deux ex æquo partagent un rang : c'est la place à table qui les départage. */
  it('garde l’ordre des places entre ex æquo', () => {
    const standings = [standing('1', 40, 1), standing('2', 40, 1), standing('3', 10, 3)];

    expect(namesOf(rankedColumns(seats, standings))).toEqual(['Alice', 'Bob', 'Chloé']);
  });

  /**
   * La couleur de repli est celle de la place, pas celle du rang : indexée sur
   * le classement, tout le monde changerait de couleur à chaque manche.
   */
  it('laisse la couleur de repli attachée à la place à table', () => {
    const standings = [standing('3', 60, 1), standing('2', 40, 2), standing('1', 10, 3)];

    expect(rankedColumns(seats, standings).map((column) => column.color)).toEqual([
      PLAYER_COLORS[2],
      PLAYER_COLORS[1],
      PLAYER_COLORS[0],
    ]);
  });

  it('préfère la couleur choisie par le joueur', () => {
    const chosen = [seat(1, 'Alice', '#123456'), seat(2, 'Bob')];
    const standings = [standing('1', 40, 1), standing('2', 10, 2)];

    expect(rankedColumns(chosen, standings)[0].color).toBe('#123456');
  });

  it('renvoie un joueur absent du classement en fin de grille', () => {
    const standings = [standing('3', 60, 1), standing('2', 40, 2)];

    expect(namesOf(rankedColumns(seats, standings))).toEqual(['Chloé', 'Bob', 'Alice']);
  });
});
