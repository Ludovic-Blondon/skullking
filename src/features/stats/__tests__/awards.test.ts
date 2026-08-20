import { computeGame, DEFAULT_RULESET, type RoundInput } from '@/core';

import { computeAwards, type Award } from '../awards';

/** Une manche saisie, telle qu'elle arrive du mapper. */
function round(
  roundNumber: number,
  cardsDealt: number,
  players: {
    playerId: string;
    bid: number;
    tricks: number;
    bonuses?: RoundInput['players'][number]['bonuses'];
  }[],
): RoundInput {
  return { roundNumber, cardsDealt, players };
}

/** Décerne les titres d'une partie décrite par ses manches. */
function awardsOf(inputs: RoundInput[]): Award[] {
  const state = computeGame(inputs, DEFAULT_RULESET);
  return computeAwards(state.rounds, inputs);
}

function labels(awards: Award[]): Record<string, { players: string[]; detail: string }> {
  // Le module ne renvoie que des clés : le test lit la clé et son compte.
  return Object.fromEntries(
    awards.map((award) => [
      award.id,
      { players: award.playerIds, detail: `${award.detailKey}=${award.value}` },
    ]),
  );
}

describe('awards de fin de partie', () => {
  it('décerne le visionnaire au plus juste, la tête brûlée au plus large', () => {
    const awards = awardsOf([
      round(1, 1, [
        { playerId: 'a', bid: 1, tricks: 1 },
        { playerId: 'b', bid: 0, tricks: 0 },
      ]),
      round(2, 2, [
        { playerId: 'a', bid: 2, tricks: 2 },
        { playerId: 'b', bid: 2, tricks: 0 },
      ]),
    ]);

    expect(labels(awards).visionary).toEqual({ players: ['a'], detail: 'award.visionaryDetail=2' });
    expect(labels(awards).daredevil).toEqual({ players: ['b'], detail: 'award.daredevilDetail=2' });
  });

  it('couronne le chasseur de primes et l’amiral du zéro', () => {
    const awards = awardsOf([
      round(1, 1, [
        { playerId: 'a', bid: 0, tricks: 0 },
        { playerId: 'b', bid: 1, tricks: 1, bonuses: { black14: 1 } },
      ]),
      round(2, 2, [
        { playerId: 'a', bid: 0, tricks: 0 },
        { playerId: 'b', bid: 2, tricks: 2 },
      ]),
    ]);

    expect(labels(awards).bounty).toEqual({ players: ['b'], detail: 'award.bountyDetail=20' });
    expect(labels(awards).zeroAdmiral).toEqual({
      players: ['a'],
      detail: 'award.zeroAdmiralDetail=2',
    });
  });

  /** Un titre que personne n'a mérité ne se décerne pas. */
  it('n’invente pas un titre sans contenu', () => {
    const awards = awardsOf([
      round(1, 1, [
        { playerId: 'a', bid: 1, tricks: 1 },
        { playerId: 'b', bid: 1, tricks: 0 },
      ]),
    ]);

    expect(labels(awards).bounty).toBeUndefined();
    expect(labels(awards).zeroAdmiral).toBeUndefined();
    expect(labels(awards).visionary).toEqual({ players: ['a'], detail: 'award.visionaryDetail=1' });
  });

  /** Un titre que toute la table mérite ne distingue personne. */
  it('escamote un titre où tout le monde est à égalité', () => {
    const awards = awardsOf([
      round(1, 1, [
        { playerId: 'a', bid: 0, tricks: 0 },
        { playerId: 'b', bid: 1, tricks: 1 },
      ]),
    ]);

    // Une annonce exacte chacun : le visionnaire ne veut rien dire.
    expect(labels(awards).visionary).toBeUndefined();
    // Le zéro, lui, n'a été tenu que par un seul.
    expect(labels(awards).zeroAdmiral).toEqual({
      players: ['a'],
      detail: 'award.zeroAdmiralDetail=1',
    });
  });

  it('partage un titre entre deux ex æquo si un troisième est derrière', () => {
    const awards = awardsOf([
      round(1, 1, [
        { playerId: 'a', bid: 0, tricks: 0 },
        { playerId: 'b', bid: 0, tricks: 0 },
        { playerId: 'c', bid: 1, tricks: 1 },
      ]),
      round(2, 2, [
        { playerId: 'a', bid: 0, tricks: 0 },
        { playerId: 'b', bid: 0, tricks: 0 },
        { playerId: 'c', bid: 2, tricks: 1 },
      ]),
    ]);

    expect(labels(awards).zeroAdmiral).toEqual({
      players: ['a', 'b'],
      detail: 'award.zeroAdmiralDetail=2',
    });
  });

  it('ignore une manche dont la saisie est incomplète', () => {
    const inputs = [
      round(1, 1, [
        { playerId: 'a', bid: 1, tricks: 1 },
        { playerId: 'b', bid: 0, tricks: 0 },
      ]),
      {
        ...round(2, 2, [
          { playerId: 'a', bid: 2, tricks: 2 },
          { playerId: 'b', bid: 0, tricks: 0 },
        ]),
        players: [
          { playerId: 'a', bid: 2, tricks: 2, played: false },
          { playerId: 'b', bid: 0, tricks: 0, played: false },
        ],
      },
    ];

    expect(labels(awardsOf(inputs)).visionary).toBeUndefined();
  });

  it('ne décerne rien sur une partie vide', () => {
    expect(computeAwards([], [])).toEqual([]);
  });
});
