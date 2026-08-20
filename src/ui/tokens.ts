/**
 * Miroir JS des jetons de design définis dans `src/global.css`.
 *
 * L'UI passe par NativeWind (`className="bg-surface"`) ; ce fichier ne sert
 * qu'aux APIs qui exigent une couleur JavaScript : thème de navigation,
 * barre d'état, graphiques (victory-native en P4). Toute modification de
 * couleur doit être répercutée des deux côtés — un test le vérifie.
 */

export const tokens = {
  light: {
    surface: '#F6F2EA',
    surfaceRaised: '#FFFFFF',
    surfaceSunken: '#F1ECE2',
    border: '#E5DED0',
    borderStrong: '#CFC5B2',
    content: '#1C2436',
    contentMuted: '#686B70',
    primary: '#B34A27',
    primaryFg: '#FFFFFF',
    accent: '#90621B',
    accentFg: '#FFFFFF',
    positive: '#337756',
    negative: '#B8222F',
  },
  dark: {
    surface: '#0E1420',
    surfaceRaised: '#1C2436',
    surfaceSunken: '#141B2A',
    border: '#212B40',
    borderStrong: '#2E3A54',
    content: '#F4F1EA',
    contentMuted: '#8A90A0',
    primary: '#E8785A',
    primaryFg: '#0E1420',
    accent: '#E8B84B',
    accentFg: '#0E1420',
    positive: '#5FB88A',
    negative: '#F5A8A6',
  },
} as const;

export type ThemeName = keyof typeof tokens;
export type Tokens = (typeof tokens)[ThemeName];

/**
 * Couleurs d'identité des joueurs, attribuées à la création (§7.1). Huit teintes
 * sobres qui tiennent sur les deux thèmes — elles servent de pastille et de
 * liseré, jamais de fond de texte.
 */
export const PLAYER_COLORS = [
  '#E8785A',
  '#4FA8A0',
  '#D9A24E',
  '#9083C7',
  '#6BBF9C',
  '#6C9BC9',
  '#C97AA0',
  '#B9A47E',
] as const;
