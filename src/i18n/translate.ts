/**
 * Traduction pure : ni React, ni base de données — c'est ce qui la rend
 * testable. Les hooks, qui lisent la préférence de langue, vivent dans
 * `index.ts`.
 */

import { catalogs, type Language, type MessageKey, type PluralKey } from './messages';

export type Params = Record<string, string | number>;

/**
 * Langue de l'appareil, sans dépendance native : Hermes embarque un ICU complet,
 * donc `Intl` connaît déjà la locale du système.
 */
export function deviceLanguage(): Language {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? 'en';
    return locale.toLowerCase().startsWith('fr') ? 'fr' : 'en';
  } catch {
    return 'en';
  }
}

/**
 * Choix du pluriel. Le français met **zéro au singulier** (« 0 partie »),
 * l'anglais non (« 0 games ») : c'est la seule règle qui diffère entre les deux
 * langues de la v1.
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
