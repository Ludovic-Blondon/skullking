import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';

import { tokens, type ThemeName } from './tokens';

/** Thèmes React Navigation dérivés des jetons de l'app (§3.2, thème clair/sombre). */
function buildTheme(name: ThemeName, base: Theme): Theme {
  const t = tokens[name];
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: t.primary,
      background: t.surface,
      card: t.surfaceRaised,
      text: t.content,
      border: t.border,
      notification: t.accent,
    },
  };
}

export const navigationThemes: Record<ThemeName, Theme> = {
  light: buildTheme('light', DefaultTheme),
  dark: buildTheme('dark', DarkTheme),
};
