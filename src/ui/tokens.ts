/**
 * Miroir JS des jetons de design définis dans `src/global.css`.
 *
 * L'UI passe par NativeWind (`className="bg-surface"`) ; ce fichier ne sert
 * qu'aux APIs qui exigent une couleur JavaScript : thème de navigation,
 * barre d'état, graphiques (victory-native en P4). Toute modification de
 * couleur doit être répercutée des deux côtés.
 */

export const tokens = {
  light: {
    surface: '#FAFAF9',
    surfaceRaised: '#FFFFFF',
    surfaceSunken: '#F0EFEC',
    border: '#E2E0DB',
    borderStrong: '#C9C6C0',
    content: '#17191C',
    contentMuted: '#5D6570',
    primary: '#0F766E',
    primaryFg: '#FFFFFF',
    accent: '#B45309',
    accentFg: '#FFFFFF',
    positive: '#15803D',
    negative: '#B91C1C',
  },
  dark: {
    surface: '#0C0F12',
    surfaceRaised: '#14181D',
    surfaceSunken: '#090B0D',
    border: '#232A31',
    borderStrong: '#35404A',
    content: '#F2F4F6',
    contentMuted: '#98A2AE',
    primary: '#2DD4BF',
    primaryFg: '#04211E',
    accent: '#F5B547',
    accentFg: '#241703',
    positive: '#4ADE80',
    negative: '#F87171',
  },
} as const;

export type ThemeName = keyof typeof tokens;
export type Tokens = (typeof tokens)[ThemeName];
