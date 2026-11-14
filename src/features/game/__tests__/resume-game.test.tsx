import { render, screen, waitFor } from '@testing-library/react-native';
import { eq } from 'drizzle-orm';
import { useLocalSearchParams } from 'expo-router';

import GameScreen from '@/app/game/[id]/index';
import { DEFAULT_RULESET } from '@/core';
import { db, sqlite } from '@/db/client';
import { eraseEverything } from '@/db/repositories/backup-repo';
import {
  abandonGame,
  createGame,
  getStoredRounds,
  removePlayerFromGame,
  seatedAtRound,
  validateRound,
} from '@/db/repositories/game-repo';
import { games, players, roundEntries } from '@/db/schema';

jest.mock('@/db/client', () => jest.requireActual('@/db/__tests__/memory-db').memoryClient());
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
  useLocalSearchParams: jest.fn(),
  Link: ({ children }: { children: unknown }) => children,
  Redirect: () => null,
}));
jest.mock('drizzle-orm/expo-sqlite', () => ({
  ...jest.requireActual('drizzle-orm/expo-sqlite'),
  // Les lectures restent de vraies requêtes SQLite ; seuls les listeners
  // natifs sont remplacés : l'écran relit la base à chaque rendu, pas à
  // chaque écriture — d'où les `rerender` après une réparation.
  useLiveQuery: (query: { all: () => unknown[] }) => ({ data: query.all() }),
}));
jest.mock('@/features/settings/use-settings', () => ({
  useSettings: () => ({ language: 'fr' }),
  setSetting: jest.fn(),
}));
// L'écran de partie anime ses compteurs ; hors appareil, le module natif des
// worklets n'existe pas — les deux bibliothèques livrent un mock pour ce cas.
jest.mock('react-native-worklets', () =>
  jest.requireActual('react-native-worklets/lib/module/mock'),
);
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual('react-native-reanimated/mock'),
  // Absent du mock : les compteurs affichent leur valeur sans transition.
  useReducedMotion: () => true,
}));

const RULES = { ...DEFAULT_RULESET, roundsPlan: [1, 2] };

beforeEach(async () => {
  jest.clearAllMocks();
  await eraseEverything();
  db.insert(players)
    .values(
      Array.from({ length: 3 }, (_, index) => ({
        id: index + 1,
        name: `Joueur ${index + 1}`,
        createdAt: index,
      })),
    )
    .run();
});

afterAll(() => sqlite.closeSync());

/** Le parcours « Reprendre » de l'accueil : il ouvre l'écran de partie. */
async function resume(gameId: number) {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: String(gameId) });
  await render(<GameScreen />);
}

it('rassoit les joueurs d’une manche laissée vide par une ancienne interruption', async () => {
  const gameId = await createGame([1, 2], RULES);
  // Création interrompue par une ancienne version : la manche existe, pas ses
  // lignes joueurs.
  db.delete(roundEntries).run();

  await resume(gameId);

  await waitFor(() => expect(seatedAtRound(gameId, 1)).toEqual([1, 2]));
  await screen.rerender(<GameScreen />);
  expect(screen.getByTestId('bid-1')).toBeTruthy();
  expect(screen.getByTestId('bid-2')).toBeTruthy();
});

it('crée la manche de départage qu’une ancienne interruption n’a pas ouverte, sans réasseoir un partant', async () => {
  const gameId = await createGame([1, 2, 3], { ...RULES, roundsPlan: [1] });
  await removePlayerFromGame(gameId, 3);
  await validateRound(gameId, 1);
  // Départage interrompu par une ancienne version : la partie pointe déjà sur
  // la manche 2, qui n'a jamais été créée.
  db.update(games)
    .set({
      ruleset: { ...RULES, roundsPlan: [1, 1] },
      status: 'in_progress',
      finishedAt: null,
      currentRound: 2,
      currentPhase: 'bidding',
    })
    .where(eq(games.id, gameId))
    .run();

  await resume(gameId);

  await waitFor(() => expect(seatedAtRound(gameId, 2)).toEqual([1, 2]));
  await screen.rerender(<GameScreen />);
  expect(screen.getByTestId('bid-1')).toBeTruthy();
  expect(screen.queryByTestId('bid-3')).toBeNull();
});

it('laisse telle quelle une partie qui n’est plus en cours', async () => {
  const gameId = await createGame([1, 2], RULES);
  db.delete(roundEntries).run();
  await abandonGame(gameId);

  await resume(gameId);

  expect(getStoredRounds(gameId)[0].entries).toHaveLength(0);
});
