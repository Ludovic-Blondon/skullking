import { render, screen } from '@testing-library/react-native';

import { Placeholder } from '../screen';

/** Fumigène : NativeWind, RNTL et le préréglage jest-expo fonctionnent ensemble. */
describe('Placeholder', () => {
  it('affiche son titre, sa phase et son texte', async () => {
    // RNTL 14 : `render` est asynchrone.
    await render(
      <Placeholder title="Historique" phase="Phase P3">
        Liste antichronologique des parties.
      </Placeholder>,
    );

    expect(screen.getByText('Historique')).toBeOnTheScreen();
    expect(screen.getByText('Phase P3')).toBeOnTheScreen();
    expect(screen.getByText('Liste antichronologique des parties.')).toBeOnTheScreen();
  });
});
