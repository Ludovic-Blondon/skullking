/**
 * Les quatre langues de la v1 (PLAN.md §13.3) : français et anglais depuis la
 * P6, espagnol et allemand ajoutés en P7 — le marché du jeu est largement
 * hispanophone et germanophone, et l'infrastructure était déjà là.
 *
 * `fr` porte les clés, les trois autres s'y accordent par le typage.
 */

import { de } from './de';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';

export { de, en, es, fr };
export type { MessageKey, PluralKey } from './fr';

export const catalogs = { fr, en, es, de } as const;
export type Language = keyof typeof catalogs;
