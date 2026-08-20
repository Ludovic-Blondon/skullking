import { useMemo } from 'react';

import { useSettings } from '@/features/settings/use-settings';

import { deviceLanguage, translator, type Translate } from './translate';
import type { Language } from './messages';

export type { Language, MessageKey, PluralKey } from './messages';
export type { Params, Translate } from './translate';
export { deviceLanguage, translator } from './translate';

/** Langue effective : le réglage de l'app, ou celle de l'appareil. */
export function useLanguage(): Language {
  const { language } = useSettings();
  return language === 'system' ? deviceLanguage() : language;
}

/** Fonction de traduction de l'écran courant. */
export function useT(): Translate {
  const language = useLanguage();
  return useMemo(() => translator(language), [language]);
}
