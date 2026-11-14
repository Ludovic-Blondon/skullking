import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';

import GameEndScreen from '@/app/game/[id]/end';
import { DEFAULT_RULESET } from '@/core';
import { db, sqlite } from '@/db/client';
import { eraseEverything } from '@/db/repositories/backup-repo';
import {
  createGame,
  getActiveGame,
  getGame,
  removePlayerFromGame,
  seatedAtRound,
  validateRound,
} from '@/db/repositories/game-repo';
import { gamePlayers, games, players, roundEntries, rounds } from '@/db/schema';
import { translator } from '@/i18n/translate';

jest.mock('@/db/client', () => jest.requireActual('@/db/__tests__/memory-db').memoryClient());
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));
jest.mock('drizzle-orm/expo-sqlite', () => ({
  ...jest.requireActual('drizzle-orm/expo-sqlite'),
  // Les lectures restent de vraies requêtes SQLite ; seuls les listeners
  // natifs sont remplacés, la partie ne change pas pendant ces parcours.
  useLiveQuery: (query: { all: () => unknown[] }) => ({ data: query.all() }),
}));
jest.mock('@/features/settings/use-settings', () => ({
  useSettings: () => ({ language: 'fr' }),
  setSetting: jest.fn(),
}));

const t = translator('fr');
const RULES = { ...DEFAULT_RULESET, expansion: false, roundsPlan: [1, 2] };

beforeEach(async () => {
  jest.clearAllMocks();
  await eraseEverything();
  db.insert(players)
    .values(
      Array.from({ length: 9 }, (_, index) => ({
        id: index + 1,
        name: `Joueur ${index + 1}`,
        createdAt: index,
      })),
    )
    .run();
});

afterAll(() => sqlite.closeSync());

async function openEndScreen(gameId: number) {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: String(gameId) });
  await render(<GameEndScreen />);
}

/**
 * Partie terminée à neuf sans l'extension, telle qu'une ancienne version a pu
 * en créer. Écrite en base directement : `createGame` la refuse désormais.
 */
function legacyNineWithoutExpansion(): number {
  const ids = Array.from({ length: 9 }, (_, index) => index + 1);
  const game = db
    .insert(games)
    .values({
      createdAt: 1,
      finishedAt: 2,
      status: 'finished',
      ruleset: { ...RULES, roundsPlan: [1] },
      currentRound: 1,
      currentPhase: 'results',
    })
    .returning()
    .get();
  db.insert(gamePlayers)
    .values(ids.map((playerId, seatIndex) => ({ gameId: game.id, playerId, seatIndex })))
    .run();
  const round = db
    .insert(rounds)
    .values({ gameId: game.id, roundNumber: 1, cardsDealt: 1 })
    .returning()
    .get();
  db.insert(roundEntries)
    .values(ids.map((playerId) => ({ roundId: round.id, playerId, bid: 0, tricks: 0 })))
    .run();
  return game.id;
}

it('rassemble pour la revanche la table de la dernière manche', async () => {
  const gameId = await createGame([1, 2, 3], RULES);
  await validateRound(gameId, 1);
  await removePlayerFromGame(gameId, 3);
  await validateRound(gameId, 2);

  await openEndScreen(gameId);
  await fireEvent.press(screen.getByTestId('rematch'));

  await waitFor(() => expect(router.replace).toHaveBeenCalled());
  const next = getActiveGame()!;
  expect(next.id).not.toBe(gameId);
  expect(seatedAtRound(next.id, 1)).toEqual([1, 2]);
});

it('prévient quand la revanche est refusée, sans toucher à la partie terminée', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const gameId = legacyNineWithoutExpansion();

  await openEndScreen(gameId);
  await fireEvent.press(screen.getByTestId('rematch'));

  await waitFor(() =>
    expect(alert).toHaveBeenCalledWith(t('end.rematchFailed'), expect.any(String)),
  );
  expect(router.replace).not.toHaveBeenCalled();
  expect(db.select().from(games).all()).toHaveLength(1);
  expect(getGame(gameId)?.status).toBe('finished');
});
