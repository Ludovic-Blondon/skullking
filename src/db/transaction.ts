/**
 * Seule porte d'entrée des transactions de l'app (PLAN.md §5, écritures
 * composées atomiques). ESLint interdit `db.transaction` partout ailleurs.
 *
 * Le pilote Drizzle/Expo est synchrone : il lance le callback, puis commite
 * aussitôt qu'il a rendu la main. D'où deux pièges, que ce module ferme.
 *
 * 1. **Un callback `async`** serait commité à son premier `await` : la suite
 *    s'écrirait hors transaction, et une erreur n'annulerait plus rien. Le
 *    typage le refuse ; à l'exécution, une promesse renvoyée lève une erreur
 *    qui annule ce qui a déjà été écrit.
 * 2. **Une transaction imbriquée** ouvrirait un second `BEGIN`, que SQLite
 *    refuse. Ici, elle rejoint simplement celle en cours : tout ou rien, sur
 *    l'opération la plus large.
 *
 * Reste une règle que le typage ne voit pas : dans `work`, n'appeler que du
 * synchrone. Une fonction `async` du repository y renverrait une promesse
 * dont l'échec ne remonterait pas jusqu'ici — la transaction serait commitée.
 */

import { db } from './client';

/** Refuse au typage tout callback qui renvoie une promesse. */
type Synchronous<T> = [T] extends [PromiseLike<unknown>] ? never : unknown;

let open = false;

function isThenable(value: unknown): boolean {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

function settled<T>(result: T): T {
  if (isThenable(result)) {
    throw new Error(
      'Transaction asynchrone refusée : le pilote commiterait au premier `await` (src/db/transaction.ts).',
    );
  }
  return result;
}

/**
 * Exécute `work` d'un bloc : si elle lève, rien de ce qu'elle a écrit ne reste.
 * Appelée dans une transaction déjà ouverte, elle en fait partie.
 */
export function atomically<T>(work: () => T & Synchronous<T>): T {
  if (open) return settled(work());

  open = true;
  try {
    // eslint-disable-next-line no-restricted-syntax -- la seule transaction autorisée
    return db.transaction(() => settled(work()));
  } finally {
    open = false;
  }
}
