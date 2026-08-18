import { useColorScheme } from 'nativewind';

import { tokens, type Tokens } from './tokens';

/**
 * Jetons de couleur du thème actif, pour les APIs qui n'acceptent pas de
 * `className` (icônes, thème de navigation, graphiques).
 */
export function useTokens(): Tokens {
  const { colorScheme } = useColorScheme();
  return tokens[colorScheme === 'dark' ? 'dark' : 'light'];
}
