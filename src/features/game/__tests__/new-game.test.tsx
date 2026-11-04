import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import NewGameScreen from '@/app/game/new';
import { db, sqlite } from '@/db/client';
import { eraseEverything } from '@/db/repositories/backup-repo';
import { getActiveGame, seatedAtRound } from '@/db/repositories/game-repo';
import { players } from '@/db/schema';
import { translator } from '@/i18n/translate';

jest.mock('@/db/client', () => jest.requireActual('@/db/__tests__/memory-db').memoryClient());
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('drizzle-orm/expo-sqlite', () => ({
  ...jest.requireActual('drizzle-orm/expo-sqlite'),
  // Les lectures restent de vraies requêtes SQLite ; seuls les listeners
  // natifs sont remplacés, les joueurs ne changent pas pendant ces parcours.
  useLiveQuery: (query: { all: () => unknown[] }) => ({ data: query.all() }),
}));
jest.mock('@/features/settings/use-settings', () => ({
  useSettings: () => ({
    language: 'fr',
    lastRuleset: { ...jest.requireActual('@/core').DEFAULT_RULESET, expansion: true },
  }),
  setSetting: jest.fn(),
}));

const t = translator('fr');

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

async function selectNineThenDisableExpansion() {
  await render(<NewGameScreen />);
  for (let id = 1; id <= 9; id += 1) {
    await fireEvent.press(screen.getByTestId(`player-${id}`));
  }
  expect(screen.getByTestId('player-9')).toBeChecked();
  await fireEvent.press(screen.getByTestId('toggle-options'));
  await fireEvent.press(
    screen.getByRole('radio', {
      name: `${t('rules.expansion')} : ${t('rules.without')}`,
    }),
  );
}

it('désélectionne le neuvième joueur à l’écran et crée réellement une partie à huit', async () => {
  await selectNineThenDisableExpansion();
  expect(screen.getByTestId('player-9')).not.toBeChecked();
  await fireEvent.press(screen.getByTestId('start-game'));

  await waitFor(() => expect(router.replace).toHaveBeenCalled());
  const game = getActiveGame()!;
  expect(game.ruleset.expansion).toBe(false);
  expect(seatedAtRound(game.id, 1)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
});

it('permet de remplacer un joueur après réduction sans réasseoir le neuvième à son insu', async () => {
  await selectNineThenDisableExpansion();
  await fireEvent.press(screen.getByTestId('player-1'));
  expect(screen.getByTestId('player-9')).not.toBeChecked();
  await fireEvent.press(screen.getByTestId('player-9'));
  await fireEvent.press(screen.getByTestId('start-game'));

  await waitFor(() => expect(router.replace).toHaveBeenCalled());
  expect(seatedAtRound(getActiveGame()!.id, 1)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
});
