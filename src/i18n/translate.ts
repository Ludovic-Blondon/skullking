/**
 * Traduction pure : ni React, ni base de données — c'est ce qui la rend
 * testable. Les hooks, qui lisent la préférence de langue, vivent dans
 * `index.ts`.
 */

import { catalogs, type Language, type MessageKey, type PluralKey } from './messages';

export type Params = Record<string, string | number>;

/** Les quatre langues de la v1, dans l'ordre du sélecteur (PLAN.md §13.3). */
export const LANGUAGES = Object.keys(catalogs) as Language[];

/** Chaque langue nommée dans sa propre langue : un sélecteur ne se traduit pas. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  fr: 'Français',
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
};

/**
 * Langue de l'appareil, sans dépendance native : Hermes embarque un ICU complet,
 * donc `Intl` connaît déjà la locale du système. Tout ce qui n'est pas une des
 * quatre langues retombe sur l'anglais.
 */
export function deviceLanguage(): Language {
  try {
    const locale = (Intl.DateTimeFormat().resolvedOptions().locale ?? 'en').toLowerCase();
    return LANGUAGES.find((language) => locale.startsWith(language)) ?? 'en';
  } catch {
    return 'en';
  }
}

/**
 * Locale de formatage des dates. Elle suit le réglage de l'app, pas celui du
 * système : une app en espagnol n'affiche pas ses dates en anglais.
 */
const DATE_LOCALES: Record<Language, string> = {
  fr: 'fr-FR',
  en: 'en-GB',
  es: 'es-ES',
  de: 'de-DE',
};

export function dateLocale(language: Language): string {
  return DATE_LOCALES[language];
}

/**
 * Suffixe ordinal — « la 3ᵉ », « the 3rd », « la 3.ª », « die 3. ». Sert au rang
 * de la feuille de score comme au numéro de la meilleure manche ; il était
 * français en dur aux deux endroits, y compris dans une app allemande.
 */
export function ordinalSuffix(language: Language, value: number): string {
  switch (language) {
    case 'fr':
      return value === 1 ? 'ʳᵉ' : 'ᵉ';
    case 'es':
      return '.ª';
    case 'de':
      return '.';
    default: {
      // 11, 12 et 13 font exception à la règle des unités : « 11th », pas « 11st ».
      const teens = value % 100;
      if (teens >= 11 && teens <= 13) return 'th';
      return { 1: 'st', 2: 'nd', 3: 'rd' }[value % 10] ?? 'th';
    }
  }
}

/**
 * Choix du pluriel. Le français met **zéro au singulier** (« 0 partie ») ; les
 * trois autres langues n'accordent au singulier que l'unité exacte.
 */
function pluralForm(language: Language, count: number): 'one' | 'other' {
  if (language === 'fr') return Math.abs(count) < 2 ? 'one' : 'other';
  return Math.abs(count) === 1 ? 'one' : 'other';
}

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export type Translate = (key: MessageKey | PluralKey, params?: Params) => string;

/** Traduction dans une langue donnée — utilisable hors composant. */
export function translator(language: Language): Translate {
  const catalog = catalogs[language];
  const fallback = catalogs.fr;

  return (key, params) => {
    const count = params?.count;
    if (typeof count === 'number') {
      const suffixed = `${key}#${pluralForm(language, count)}` as MessageKey;
      const accorded = catalog[suffixed] ?? fallback[suffixed];
      if (accorded) return interpolate(accorded, params);
    }
    // Une clé absente affiche le français plutôt que sa propre clé : mieux vaut
    // une phrase dans la mauvaise langue qu'un identifiant à l'écran.
    const message = catalog[key as MessageKey] ?? fallback[key as MessageKey];
    return message ? interpolate(message, params) : String(key);
  };
}
