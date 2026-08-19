import {
  BACKUP_APP,
  BACKUP_VERSION,
  describeBackup,
  parseBackup,
  serializeBackup,
  type BackupDocument,
} from '../backup-format';

function document(overrides: Partial<BackupDocument> = {}): BackupDocument {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: 1_700_000_000_000,
    players: [
      { id: 1, name: 'Lou', emoji: '🦜', color: '#E8785A', createdAt: 1, archivedAt: null },
      { id: 2, name: 'Nina', emoji: '⚓', color: '#4FA8A0', createdAt: 2, archivedAt: 3 },
    ],
    games: [
      {
        id: 7,
        createdAt: 1_699_000_000_000,
        finishedAt: 1_699_000_100_000,
        status: 'finished',
        ruleset: { edition: 'current', roundsPlan: [1, 2] },
        currentRound: 2,
        currentPhase: 'results',
        seats: [
          { playerId: 1, seatIndex: 0 },
          { playerId: 2, seatIndex: 1 },
        ],
        rounds: [
          {
            roundNumber: 1,
            cardsDealt: 1,
            destroyedTricks: 0,
            forced: false,
            entries: [
              {
                playerId: 1,
                bid: 1,
                tricks: 1,
                bidModifier: 0,
                rascalBet: 0,
                cannonball: false,
                customBonus: 0,
              },
              {
                playerId: 2,
                bid: 0,
                tricks: 0,
                bidModifier: 0,
                rascalBet: 0,
                cannonball: false,
                customBonus: 10,
              },
            ],
            bonusEvents: [{ playerId: 1, type: 'black14', count: 1, allyPlayerId: null }],
          },
        ],
      },
    ],
    ...overrides,
  };
}

/** Le critère d'acceptation de P3 (§11) : export → import sans perte. */
describe('aller-retour', () => {
  it('rend exactement le document exporté', () => {
    const source = document();
    const result = parseBackup(serializeBackup(source));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document).toEqual(source);
  });

  it('conserve les colonnes nulles d’une manche en cours de saisie', () => {
    const source = document({
      games: [
        {
          ...document().games[0],
          rounds: [
            {
              roundNumber: 2,
              cardsDealt: 2,
              destroyedTricks: 1,
              forced: true,
              entries: [
                {
                  playerId: 1,
                  bid: null,
                  tricks: null,
                  bidModifier: 1,
                  rascalBet: 20,
                  cannonball: true,
                  customBonus: -10,
                },
              ],
              bonusEvents: [{ playerId: 1, type: 'loot', count: 1, allyPlayerId: 2 }],
            },
          ],
        },
      ],
    });

    const result = parseBackup(serializeBackup(source));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.games[0].rounds[0]).toEqual(source.games[0].rounds[0]);
  });
});

describe('refus', () => {
  const cases: [string, string][] = [
    ['du texte qui n’est pas du JSON', 'ceci n’est pas un fichier'],
    ['un JSON qui n’est pas un objet', '[]'],
    ['un document sans signature', JSON.stringify({ version: 1, players: [] })],
    [
      'une signature étrangère',
      JSON.stringify({ app: 'autre-app', version: 1, players: [{ id: 1, name: 'Lou' }] }),
    ],
    [
      'une version future',
      JSON.stringify({ app: BACKUP_APP, version: BACKUP_VERSION + 1, players: [] }),
    ],
    ['une sauvegarde sans joueurs', JSON.stringify({ app: BACKUP_APP, version: 1, players: [] })],
  ];

  it.each(cases)('refuse %s', (_label, text) => {
    const result = parseBackup(text);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason.length).toBeGreaterThan(0);
  });

  it('refuse un roster où aucun joueur n’est lisible', () => {
    const text = JSON.stringify({
      app: BACKUP_APP,
      version: 1,
      players: [{ id: 'x', name: 'Lou' }, { name: '   ' }],
    });
    expect(parseBackup(text).ok).toBe(false);
  });
});

describe('tolérance', () => {
  it('complète les champs optionnels absents', () => {
    const text = JSON.stringify({
      app: BACKUP_APP,
      version: BACKUP_VERSION,
      players: [{ id: 1, name: 'Lou' }],
      games: [
        {
          id: 1,
          createdAt: 10,
          seats: [{ playerId: 1, seatIndex: 0 }],
          rounds: [{ roundNumber: 1, cardsDealt: 1, entries: [{ playerId: 1 }] }],
        },
      ],
    });

    const result = parseBackup(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.document.players[0]).toEqual({
      id: 1,
      name: 'Lou',
      emoji: null,
      color: null,
      createdAt: 0,
      archivedAt: null,
    });
    const [game] = result.document.games;
    expect(game).toMatchObject({ status: 'finished', currentRound: 1, currentPhase: 'bidding' });
    expect(game.rounds[0]).toMatchObject({ destroyedTricks: 0, forced: false, bonusEvents: [] });
    expect(game.rounds[0].entries[0]).toEqual({
      playerId: 1,
      bid: null,
      tricks: null,
      bidModifier: 0,
      rascalBet: 0,
      cannonball: false,
      customBonus: 0,
    });
  });

  /**
   * Une partie dont un joueur manque au roster produirait une feuille de score
   * à trous : mieux vaut la laisser dehors que l'importer à moitié.
   */
  it('écarte une partie dont un joueur est absent du roster', () => {
    const source = document();
    const orphan = { ...source.games[0], id: 8, seats: [{ playerId: 99, seatIndex: 0 }] };
    const result = parseBackup(serializeBackup({ ...source, games: [...source.games, orphan] }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.games.map((game) => game.id)).toEqual([7]);
  });

  it('écarte une manche et une entrée illisibles sans perdre le reste', () => {
    const source = document();
    const text = JSON.stringify({
      ...source,
      games: [
        {
          ...source.games[0],
          rounds: [
            source.games[0].rounds[0],
            { cardsDealt: 2 },
            { roundNumber: 2, cardsDealt: 2, entries: [{ bid: 1 }, { playerId: 2, bid: 1 }] },
          ],
        },
      ],
    });

    const result = parseBackup(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [game] = result.document.games;
    expect(game.rounds).toHaveLength(2);
    expect(game.rounds[1].entries).toHaveLength(1);
  });
});

describe('describeBackup', () => {
  it('résume ce que le fichier contient', () => {
    expect(describeBackup(document())).toBe('2 joueurs et 1 partie');
  });

  it('accorde au singulier', () => {
    expect(describeBackup(document({ players: [document().players[0]], games: [] }))).toBe(
      '1 joueur et 0 partie',
    );
  });
});
