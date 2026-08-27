/**
 * Moteur de règles Skull King — TypeScript pur, sans dépendance à React Native
 * ni à la base de données (PLAN.md §3.1).
 *
 * La spécification complète est en §4 du plan ; chaque règle y est reprise en
 * commentaire dans le module qui l'implémente, et couverte par des tests.
 */

export * from './types';
export {
  BASE_POINTS,
  BONUS_POINTS,
  BONUS_TYPES,
  DEFAULT_ROUNDS_PLAN,
  DEFAULT_RULESET,
  MAX_DESTROYED_TRICKS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  RASCAL_BETS,
  RASCAL_POINTS,
  ROUND_BONUS_LIMITS,
} from './rules/editions';
export { effectiveBidOf, scoreRound } from './scoring';
export { hasBlockingIssues, validateRound } from './validation';
export { cardsDealtFor, computeGame, leadersOf, standingsOf } from './game';
