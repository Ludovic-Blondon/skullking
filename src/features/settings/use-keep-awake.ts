import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';

import { useSettings } from './use-settings';

const TAG = 'skull-scores-game';

/**
 * Maintient l'écran allumé pendant une partie (PLAN.md §7.2), si la préférence
 * l'autorise.
 *
 * Une manche dure plus longtemps que le verrouillage automatique, et personne
 * n'a envie de rallumer son téléphone entre deux plis. La veille reprend ses
 * droits dès qu'on quitte l'écran de jeu.
 */
export function useKeepScreenAwake(): void {
  const { keepAwake } = useSettings();

  useEffect(() => {
    if (!keepAwake) return;
    void activateKeepAwakeAsync(TAG);
    return () => {
      void deactivateKeepAwake(TAG);
    };
  }, [keepAwake]);
}
