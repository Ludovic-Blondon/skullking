import type { Standing } from '@/core';

import { podiumSteps } from '../podium';

/** Classement construit à partir de totaux donnés dans l'ordre décroissant. */
function standings(...totals: number[]): Standing[] {
  const result: Standing[] = [];
  totals.forEach((total, index) => {
    const previous = result[index - 1];
    result.push({
      playerId: `p${index + 1}`,
      total,
      rank: previous && previous.total === total ? previous.rank : index + 1,
    });
  });
  return result;
}

/** Marches lisibles : les joueurs de chaque marche, or d'abord. */
function stepsOf(...totals: number[]): string[][] {
  return podiumSteps(standings(...totals)).map((step) => step.map((s) => s.playerId));
}

describe('podiumSteps', () => {
  it('donne une marche par joueur quand personne n’est à égalité', () => {
    expect(stepsOf(100, 80, 60, 40)).toEqual([['p1'], ['p2'], ['p3']]);
  });

  /** Le cœur du sujet : deux troisièmes à égalité montent tous les deux. */
  it('groupe les ex æquo sur la même marche', () => {
    expect(stepsOf(100, 80, 60, 60, 20)).toEqual([['p1'], ['p2'], ['p3', 'p4']]);
  });

  it('empile les ex æquo de tête sur la marche du vainqueur', () => {
    // Deux premiers, pas de deuxième : le troisième garde sa marche de bronze.
    expect(stepsOf(100, 100, 60)).toEqual([['p1', 'p2'], [], ['p3']]);
  });

  /** Deux deuxièmes ne laissent aucun troisième : la marche reste vide. */
  it('laisse une marche vide quand une égalité efface le rang suivant', () => {
    expect(stepsOf(100, 80, 80, 40)).toEqual([['p1'], ['p2', 'p3'], []]);
  });

  it('ne monte jamais un quatrième sur le podium', () => {
    expect(stepsOf(100, 90, 80, 70, 60, 50)).toEqual([['p1'], ['p2'], ['p3']]);
  });

  it('accepte un classement vide', () => {
    expect(stepsOf()).toEqual([[], [], []]);
  });
});
