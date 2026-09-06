/**
 * Types du moteur de règles.
 *
 * Ce module — et tout `src/core` — est du TypeScript pur : ni React, ni React
 * Native, ni base de données (PLAN.md §3.1). Il est testable en Jest sans
 * émulateur et réutilisable tel quel hors mobile.
 *
 * Vocabulaire : une **partie** est une suite de **manches** ; à chaque manche
 * un joueur pose une **mise** (son annonce) puis remporte des **plis**.
 */

export type PlayerId = string;

/**
 * Édition de règles. Les valeurs de bonus ont changé en 2021 (PLAN.md §2.1) ;
 * `legacy` couvre les boîtes antérieures.
 */
export type Edition = 'current' | 'legacy';

/** Variante de décompte (PLAN.md §4.3). */
export type ScoringVariant = 'classic' | 'rascal';

/** Paramètres de règles d'une partie. Le barème n'est jamais codé en dur ailleurs. */
export interface Ruleset {
  edition: Edition;
  /** Kraken, Baleine blanche et Butin en jeu. */
  advancedCards: boolean;
  scoring: ScoringVariant;
  /** Option « Boulet de canon » du décompte Rascal, choisie manche par manche. */
  rascalCannonball: boolean;
  /** Pouvoirs des pirates : Harry le Géant et pari de Rascal le Flambeur. */
  pirateAbilities: boolean;
  /**
   * Extension officielle en jeu (PLAN.md §4.6) : cartes 7 et 8, Second, Raie
   * tachetée, Casier de Davy Jones.
   *
   * Une boîte à part, pas une édition : elle s'ajoute au barème choisi plutôt
   * que de le remplacer. Absent des parties enregistrées avant sa sortie —
   * `undefined` s'y lit « éteinte », ce qui laisse leur décompte intact.
   */
  expansion: boolean;
  /** Nombre de cartes distribuées par manche, avant correction à 8 joueurs. */
  roundsPlan: number[];
}

/**
 * Bonus de capture, saisis par joueur sous forme de compteurs.
 * Les quatre premiers sont des cartes uniques : leur compteur vaut 0 ou 1.
 *
 * Les quatre derniers viennent de l'extension officielle (PLAN.md §4.6) et ne
 * sont décomptés que si elle est en jeu. `expansionSeven` est le seul compteur
 * qui **retire** des points : le livret en fait une pénalité soumise aux mêmes
 * conditions qu'un bonus.
 */
export type BonusType =
  | 'yellow14'
  | 'green14'
  | 'purple14'
  | 'black14'
  | 'mermaidCapturesSkullKing'
  | 'skullKingCapturesPirate'
  | 'pirateCapturesMermaid'
  | 'expansionSeven'
  | 'expansionEight'
  | 'davyJonesLeviathan'
  | 'firstMateCaptured';

export type BonusCounts = Partial<Record<BonusType, number>>;

/**
 * Alliance du Butin : le joueur qui pose la carte et celui qui remporte le pli
 * marquent chacun le bonus, à condition que **les deux** mises soient exactes
 * (PLAN.md §4.2).
 *
 * Modélisé au niveau de la manche plutôt que par joueur : la règle porte sur la
 * paire. La persistance (§5) en dérive deux lignes `bonus_events`, une par
 * bénéficiaire, chacune pointant l'allié.
 */
export interface LootAlliance {
  playerId: PlayerId;
  allyId: PlayerId;
}

/** Modificateur de mise apporté par Harry le Géant. */
export type BidModifier = -1 | 0 | 1;

/** Mise du pari de Rascal le Flambeur. */
export type RascalBet = 0 | 10 | 20;

/** Saisie d'un joueur pour une manche. */
export interface PlayerRoundInput {
  playerId: PlayerId;
  /** Mise annoncée, avant le pouvoir de Harry. */
  bid: number;
  tricks: number;
  /**
   * Saisie terminée pour ce joueur — annonce **et** plis posés (PLAN.md §5 :
   * les deux colonnes sont nullables tant que la manche n'est pas jouée).
   *
   * Faux, le joueur ne marque rien : sans ce drapeau une manche vierge se lit
   * « mise 0 réussie » et crédite tout le monde de +10 × cartes distribuées.
   * Absent = saisie complète, pour ne rien changer aux appels qui n'ont que des
   * nombres à fournir.
   */
  played?: boolean;
  /** Harry le Géant : ±1 sur la mise, un seul joueur par manche. */
  bidModifier?: BidModifier;
  /** Pari de Rascal : gagné si la mise effective est exacte, **débité** sinon. */
  rascalBet?: RascalBet;
  /** Boulet de canon : 15 × cartes si exact, 0 sinon (décompte Rascal). */
  cannonball?: boolean;
  bonuses?: BonusCounts;
  /** Ajustement manuel — filet de sécurité pour une règle maison (PLAN.md §7.3). */
  customBonus?: number;
}

/** Saisie complète d'une manche. */
export interface RoundInput {
  roundNumber: number;
  /** Cartes distribuées : `cardsDealtFor()` par défaut, modifiable à la main. */
  cardsDealt: number;
  /**
   * Plis détruits par les léviathans : Kraken et Baleine blanche (0 à 2), plus
   * la Raie tachetée quand l'extension est en jeu (0 à 3, PLAN.md §4.6).
   */
  destroyedTricks?: number;
  players: PlayerRoundInput[];
  lootAlliances?: LootAlliance[];
  /** Manche validée malgré une incohérence de plis (PLAN.md §4.4). */
  forced?: boolean;
}

/** Score d'un joueur sur une manche. */
export interface PlayerRoundScore {
  playerId: PlayerId;
  /** Mise après application du pouvoir de Harry — c'est elle qui fait foi. */
  effectiveBid: number;
  exact: boolean;
  base: number;
  /** Bonus effectivement comptés. */
  bonus: number;
  /**
   * Bonus annulés par une mise ratée : sans effet ici, mais suivis en
   * statistiques. Peut être négatif quand la mise ratée annule surtout des 7
   * de l'extension — une pénalité échappée n'est pas un bonus perdu.
   */
  lostBonus: number;
  /** Gain ou perte du pari de Rascal (négatif si perdu). */
  rascalBet: number;
  /** Ajustement manuel repris tel quel. */
  custom: number;
  total: number;
  /** Faux tant que la saisie du joueur est incomplète : tout est à zéro. */
  played: boolean;
}

/** Résultat d'une manche, joueurs et fantôme confondus. */
export interface RoundResult {
  roundNumber: number;
  cardsDealt: number;
  destroyedTricks: number;
  /**
   * Plis absorbés par le fantôme « Barbe Grise » à 2 joueurs : le solde entre
   * les plis attribués et les cartes distribuées (PLAN.md §4.1).
   */
  ghostTricks: number;
  scores: PlayerRoundScore[];
  /** Score cumulé de chaque joueur à l'issue de cette manche. */
  cumulative: Record<PlayerId, number>;
}

export interface Standing {
  playerId: PlayerId;
  total: number;
  /** Rang à partir de 1 ; deux joueurs à égalité partagent le même rang. */
  rank: number;
}

export interface GameState {
  rounds: RoundResult[];
  totals: Record<PlayerId, number>;
  standings: Standing[];
  /** Joueurs en tête — plusieurs en cas d'égalité. */
  leaders: PlayerId[];
  /** Égalité en tête : le livret prévoit alors une manche supplémentaire. */
  tie: boolean;
}

export type IssueSeverity = 'error' | 'warning';

/**
 * Anomalies de saisie. Le moteur ne renvoie que des codes : les messages
 * lisibles vivent dans les fichiers de traduction (PLAN.md §7.2).
 */
export type IssueCode =
  | 'cardsDealtOutOfRange'
  | 'playerCountOutOfRange'
  | 'duplicatePlayer'
  | 'bidOutOfRange'
  | 'tricksOutOfRange'
  | 'destroyedTricksOutOfRange'
  | 'destroyedTricksWithoutAdvancedCards'
  | 'trickCountMismatch'
  | 'pirateAbilitiesDisabled'
  | 'multipleHarry'
  | 'multipleRascalBets'
  | 'invalidRascalBet'
  | 'invalidBidModifier'
  | 'effectiveBidOutOfRange'
  | 'invalidBonusCount'
  | 'bonusCountExceeded'
  | 'bonusUnavailableInEdition'
  | 'bonusUnavailableWithoutExpansion'
  | 'skullKingAlreadyCaptured'
  | 'lootWithoutAdvancedCards'
  | 'lootWithTwoPlayers'
  | 'lootSelfAlliance'
  | 'lootUnknownPlayer'
  | 'lootAlliancesExceeded'
  | 'invalidCustomBonus'
  | 'bonusOnMissedBid';

export interface Issue {
  code: IssueCode;
  severity: IssueSeverity;
  playerId?: PlayerId;
  bonus?: BonusType;
  value?: number;
  min?: number;
  max?: number;
  expected?: number;
}
