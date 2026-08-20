import { Text as RNText, type TextProps } from 'react-native';

/**
 * Plafond d'agrandissement du texte (PLAN.md §12.10, accessibilité).
 *
 * L'app suit la taille de texte du système, mais pas jusqu'à l'absurde : à la
 * plus grande taille d'accessibilité d'iOS, l'en-tête de manche occupait
 * l'écran entier et les joueurs passaient hors champ — une feuille de score qui
 * ne montre plus les joueurs n'est plus une feuille de score.
 *
 * Le plafond laisse une marge confortable (jusqu'à une fois et demie) et
 * garantit qu'une ligne joueur reste une ligne.
 */
const MAX_SCALE = 1.5;

/**
 * Plafond plus serré pour les chiffres alignés en colonnes : compteurs,
 * cellules de feuille de score. Au-delà, une colonne cesse d'être une colonne.
 */
export const DENSE_MAX_SCALE = 1.2;

/**
 * `Text` de l'app. Même API que celui de React Native, avec le plafond posé —
 * qu'un appel peut toujours resserrer en passant son propre
 * `maxFontSizeMultiplier`.
 */
export function Text(props: TextProps) {
  return <RNText maxFontSizeMultiplier={MAX_SCALE} {...props} />;
}
