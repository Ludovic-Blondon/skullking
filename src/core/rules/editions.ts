/**
 * Barèmes, en un seul endroit (PLAN.md §12.2 : « barème centralisé »).
 *
 * Source de vérité : les livrets officiels EN ©2024 et FR ©2022.
 * - https://cdn.shopify.com/s/files/1/0565/3230/4053/files/Skull_King_Simplified_Rulebook_US_WEB_NO_CROP_a0eb3b84-f1cd-4087-8bda-0aab43d231af.pdf
 * - https://cdn.shopify.com/s/files/1/0565/3230/4053/files/SK_FR_Rulebook_Optimized.pdf
 * - https://cdn.shopify.com/s/files/1/0565/3230/4053/files/Skull_King_Rascal_Scoring.pdf
 *
 * Aucune de ces valeurs ne doit être recopiée dans l'UI : elle les lit via le
 * `Ruleset` de la partie.
 */

import type { BonusType, Edition, Ruleset } from '../types';

/** Score de base, identique à toutes les éditions (PLAN.md §4.2). */
export const BASE_POINTS = {
  /** Mise ≥ 1 réussie : 20 points par pli annoncé. */
  perTrickWhenExact: 20,
  /** Mise ≥ 1 ratée : 10 points de pénalité par pli d'écart. */
  perTrickOfError: 10,
  /**
   * Mise 0 : ±10 par **carte distribuée** — et non par numéro de manche.
   * L'écart n'apparaît qu'à 8 joueurs aux manches 9 et 10 (PLAN.md §12.4).
   */
  zeroBidPerCard: 10,
} as const;

/** Décompte Rascal le Flambeur (PLAN.md §4.3). */
export const RASCAL_POINTS = {
  /** Potentiel de la manche : 10 points par carte distribuée. */
  potentialPerCard: 10,
  /** Un pli d'écart rapporte encore la moitié du potentiel. */
  nearMissRatio: 0.5,
  /** Option « Boulet de canon » : tout ou rien, à 15 points par carte. */
  cannonballPerCard: 15,
} as const;

/** Valeur du pari de Rascal le Flambeur : gagné si exact, débité sinon. */
export const RASCAL_BETS = [0, 10, 20] as const;

/**
 * Valeur des bonus par édition. `null` = le bonus n'existe pas dans cette
 * édition ; le saisir est une erreur de validation.
 */
export type BonusScale = Record<BonusType, number | null> & { loot: number };

/**
 * Bonus de l'extension officielle (PLAN.md §4.6). Identiques d'une édition à
 * l'autre : l'extension est une boîte à part, vendue pour la 2021, et son
 * livret ne connaît qu'un barème. C'est `ruleset.expansion` qui décide de les
 * compter, pas l'édition — comme `advancedCards` décide du Butin.
 */
const EXPANSION_POINTS = {
  /** Le nouveau 7 coûte 5 points à qui le remporte : une pénalité, pas un bonus. */
  expansionSeven: -5,
  expansionEight: 5,
  davyJonesLeviathan: 20,
  firstMateCaptured: 30,
} as const;

export const BONUS_POINTS: Record<Edition, BonusScale> = {
  current: {
    yellow14: 10,
    green14: 10,
    purple14: 10,
    black14: 20,
    mermaidCapturesSkullKing: 40,
    skullKingCapturesPirate: 30,
    pirateCapturesMermaid: 20,
    loot: 20,
    ...EXPANSION_POINTS,
  },
  legacy: {
    yellow14: 10,
    green14: 10,
    purple14: 10,
    black14: 20,
    // Le bonus valait 50 avant l'édition 2021 (PLAN.md §2.1).
    mermaidCapturesSkullKing: 50,
    skullKingCapturesPirate: 30,
    // « Pirate capture Sirène » n'existe que depuis 2021 (PLAN.md §2.1).
    pirateCapturesMermaid: null,
    // PLAN.md §4.3 signale un « Butin old-rule » sans le détailler : en attendant
    // vérification sur le livret pré-2021, la valeur de l'édition courante est
    // conservée. Un seul chiffre à changer ici le jour où c'est tranché.
    loot: 20,
    ...EXPANSION_POINTS,
  },
};

/**
 * Plafonds imposés par le contenu de la boîte, tous joueurs confondus sur une
 * même manche (PLAN.md §4.2). Ils ne dépendent pas de l'édition : ce sont des
 * cartes, elles ne sont jouées qu'une fois par manche.
 */
export const ROUND_BONUS_LIMITS: Record<BonusType, number> & { lootAlliances: number } = {
  yellow14: 1,
  green14: 1,
  purple14: 1,
  black14: 1,
  mermaidCapturesSkullKing: 1,
  /** 5 pirates, plus la Tigresse jouée en pirate. */
  skullKingCapturesPirate: 6,
  pirateCapturesMermaid: 2,
  lootAlliances: 2,
  /** Un 7 et un 8 par couleur dans l'extension (PLAN.md §4.6). */
  expansionSeven: 4,
  expansionEight: 4,
  /** Le Casier ne peut détruire que les léviathans en jeu : trois au plus. */
  davyJonesLeviathan: 3,
  firstMateCaptured: 1,
};

/** Nombre de plis qu'une manche peut perdre (Kraken, Baleine blanche). */
export const MAX_DESTROYED_TRICKS = 2;

/** Troisième léviathan apporté par l'extension : la Raie tachetée (§4.6). */
export const MAX_DESTROYED_TRICKS_WITH_EXPANSION = 3;

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;

/** L'extension ajoute de quoi asseoir un joueur de plus (PLAN.md §4.6). */
export const MAX_PLAYERS_WITH_EXPANSION = 9;

/**
 * Cartes réellement distribuables : 56 numérotées (4 couleurs × 14) et 14
 * spéciales (5 fuites, 5 pirates, la Tigresse, 2 sirènes, le Skull King). Les
 * cartes avancées de la boîte 2021 remplacent des fuites plutôt que de s'y
 * ajouter : le total ne bouge pas.
 */
export const DECK_SIZE = 70;

/** Les 19 cartes jouables de l'extension s'ajoutent, elles, au paquet (§4.6). */
export const DECK_SIZE_WITH_EXPANSION = 89;

/** Plan de manches par défaut : 10 manches, la manche N distribuant N cartes. */
export const DEFAULT_ROUNDS_PLAN: number[] = Array.from({ length: 10 }, (_, i) => i + 1);

/**
 * Règles par défaut de l'app : la boîte 2021 complète, cartes avancées et
 * pouvoirs des pirates compris.
 *
 * Le défaut penche vers « tout est là » : une table qui joue les pouvoirs et
 * ne les trouve pas dans l'app est bloquée au milieu d'une manche, alors qu'une
 * table qui ne les joue pas laisse simplement un bouton de côté.
 */
export const DEFAULT_RULESET: Ruleset = {
  edition: 'current',
  advancedCards: true,
  scoring: 'classic',
  rascalCannonball: false,
  pirateAbilities: true,
  // Seule option éteinte par défaut : l'extension est une boîte qu'il faut avoir
  // achetée. Proposer ses compteurs à qui n'a pas les cartes serait du bruit à
  // chaque manche, là où le reste du défaut ne coûte qu'un bouton ignoré.
  expansion: false,
  roundsPlan: DEFAULT_ROUNDS_PLAN,
};

/** Bonus de la boîte de base, dans l'ordre d'affichage de la saisie (§7.3). */
export const BONUS_TYPES: BonusType[] = [
  'yellow14',
  'green14',
  'purple14',
  'black14',
  'mermaidCapturesSkullKing',
  'skullKingCapturesPirate',
  'pirateCapturesMermaid',
];

/** Bonus apportés par l'extension officielle, dans le même ordre (§4.6). */
export const EXPANSION_BONUS_TYPES: BonusType[] = [
  'firstMateCaptured',
  'expansionEight',
  'expansionSeven',
  'davyJonesLeviathan',
];

/** Tous les compteurs saisissables, extension comprise — pour les parcourir. */
export const ALL_BONUS_TYPES: BonusType[] = [...BONUS_TYPES, ...EXPANSION_BONUS_TYPES];

/**
 * Bonus décomptés pour ces règles-là.
 *
 * Le décompte, la validation et la feuille de saisie itèrent tous cette
 * liste : un compteur d'extension saisi puis l'extension éteinte ne rapporte
 * plus rien, exactement comme le Butin sans cartes avancées.
 */
export function bonusTypesFor(ruleset: Ruleset): BonusType[] {
  return ruleset.expansion ? [...BONUS_TYPES, ...EXPANSION_BONUS_TYPES] : BONUS_TYPES;
}

/** Plis qu'une manche peut perdre : la Raie tachetée en ajoute un troisième. */
export function maxDestroyedTricksFor(ruleset: Ruleset): number {
  return ruleset.expansion ? MAX_DESTROYED_TRICKS_WITH_EXPANSION : MAX_DESTROYED_TRICKS;
}

/** Joueurs qu'on peut asseoir : 8, ou 9 avec le paquet agrandi de l'extension. */
export function maxPlayersFor(ruleset: Ruleset): number {
  return ruleset.expansion ? MAX_PLAYERS_WITH_EXPANSION : MAX_PLAYERS;
}

/** Taille du paquet, qui borne les cartes distribuables des dernières manches. */
export function deckSizeFor(ruleset?: Ruleset): number {
  return ruleset?.expansion ? DECK_SIZE_WITH_EXPANSION : DECK_SIZE;
}
