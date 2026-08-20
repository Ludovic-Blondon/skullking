/**
 * Format d'échange des données (PLAN.md §7.4 : export/import JSON).
 *
 * Module **pur** : ni base, ni UI. C'est ce qui le rend testable, et c'est là
 * que vit la seule chose qui compte vraiment ici — qu'un export relu redonne
 * exactement la même partie.
 *
 * Deux principes, hérités du §5 :
 *
 * 1. **On exporte la saisie, jamais le raisonnement.** Mises, plis et
 *    événements de bonus voyagent ; les colonnes de score, non — elles se
 *    recalculent à l'import. Un barème corrigé entre-temps profite donc aux
 *    sauvegardes anciennes.
 * 2. **Les identifiants voyagent avec les données.** Une sauvegarde est une
 *    photo complète : la relire remplace tout, elle ne fusionne pas.
 */

import type { Translate } from '@/i18n';

export const BACKUP_APP = 'skull-scores';
export const BACKUP_VERSION = 1;

export interface BackupPlayer {
  id: number;
  name: string;
  emoji: string | null;
  color: string | null;
  createdAt: number;
  archivedAt: number | null;
}

export interface BackupEntry {
  playerId: number;
  bid: number | null;
  tricks: number | null;
  bidModifier: number;
  rascalBet: number;
  cannonball: boolean;
  customBonus: number;
}

export interface BackupBonusEvent {
  playerId: number;
  type: string;
  count: number;
  allyPlayerId: number | null;
}

export interface BackupRound {
  roundNumber: number;
  cardsDealt: number;
  destroyedTricks: number;
  forced: boolean;
  entries: BackupEntry[];
  bonusEvents: BackupBonusEvent[];
}

export interface BackupGame {
  id: number;
  createdAt: number;
  finishedAt: number | null;
  status: string;
  ruleset: unknown;
  currentRound: number;
  currentPhase: string;
  seats: { playerId: number; seatIndex: number }[];
  rounds: BackupRound[];
}

export interface BackupDocument {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: number;
  players: BackupPlayer[];
  games: BackupGame[];
}

/** Ce qu'un import a compris d'un fichier, ou pourquoi il l'a refusé. */
export type ParseResult = { ok: true; document: BackupDocument } | { ok: false; reason: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function nullableInteger(value: unknown): value is number | null {
  return value === null || isFiniteInteger(value);
}

/** Document prêt à écrire sur disque, indenté pour rester lisible à l'œil. */
export function serializeBackup(document: BackupDocument): string {
  return JSON.stringify(document, null, 2);
}

function parseEntry(raw: unknown): BackupEntry | undefined {
  if (!isObject(raw) || !isFiniteInteger(raw.playerId)) return undefined;
  // Champ absent et champ nul disent la même chose : pas encore saisi. Une
  // valeur présente mais illisible, elle, invalide l'entrée.
  const bid = raw.bid ?? null;
  const tricks = raw.tricks ?? null;
  if (!nullableInteger(bid) || !nullableInteger(tricks)) return undefined;
  return {
    playerId: raw.playerId,
    bid,
    tricks,
    bidModifier: isFiniteInteger(raw.bidModifier) ? raw.bidModifier : 0,
    rascalBet: isFiniteInteger(raw.rascalBet) ? raw.rascalBet : 0,
    cannonball: raw.cannonball === true,
    customBonus: isFiniteInteger(raw.customBonus) ? raw.customBonus : 0,
  };
}

function parseBonusEvent(raw: unknown): BackupBonusEvent | undefined {
  if (!isObject(raw) || !isFiniteInteger(raw.playerId) || typeof raw.type !== 'string') {
    return undefined;
  }
  return {
    playerId: raw.playerId,
    type: raw.type,
    count: isFiniteInteger(raw.count) ? raw.count : 1,
    allyPlayerId: nullableInteger(raw.allyPlayerId) ? raw.allyPlayerId : null,
  };
}

function parseRound(raw: unknown): BackupRound | undefined {
  if (!isObject(raw) || !isFiniteInteger(raw.roundNumber) || !isFiniteInteger(raw.cardsDealt)) {
    return undefined;
  }
  const entries = Array.isArray(raw.entries)
    ? raw.entries.map(parseEntry).filter((entry): entry is BackupEntry => entry !== undefined)
    : [];
  const bonusEvents = Array.isArray(raw.bonusEvents)
    ? raw.bonusEvents
        .map(parseBonusEvent)
        .filter((event): event is BackupBonusEvent => event !== undefined)
    : [];

  return {
    roundNumber: raw.roundNumber,
    cardsDealt: raw.cardsDealt,
    destroyedTricks: isFiniteInteger(raw.destroyedTricks) ? raw.destroyedTricks : 0,
    forced: raw.forced === true,
    entries,
    bonusEvents,
  };
}

function parseGame(raw: unknown): BackupGame | undefined {
  if (!isObject(raw) || !isFiniteInteger(raw.id) || !isFiniteInteger(raw.createdAt)) {
    return undefined;
  }
  const seats = Array.isArray(raw.seats)
    ? raw.seats
        .filter(
          (seat): seat is { playerId: number; seatIndex: number } =>
            isObject(seat) && isFiniteInteger(seat.playerId) && isFiniteInteger(seat.seatIndex),
        )
        .map((seat) => ({ playerId: seat.playerId, seatIndex: seat.seatIndex }))
    : [];
  const rounds = Array.isArray(raw.rounds)
    ? raw.rounds.map(parseRound).filter((round): round is BackupRound => round !== undefined)
    : [];

  return {
    id: raw.id,
    createdAt: raw.createdAt,
    finishedAt: nullableInteger(raw.finishedAt) ? raw.finishedAt : null,
    status: typeof raw.status === 'string' ? raw.status : 'finished',
    ruleset: raw.ruleset,
    currentRound: isFiniteInteger(raw.currentRound) ? raw.currentRound : 1,
    currentPhase: raw.currentPhase === 'results' ? 'results' : 'bidding',
    seats,
    rounds,
  };
}

function parsePlayer(raw: unknown): BackupPlayer | undefined {
  if (!isObject(raw) || !isFiniteInteger(raw.id) || typeof raw.name !== 'string') return undefined;
  if (!raw.name.trim()) return undefined;
  return {
    id: raw.id,
    name: raw.name,
    emoji: typeof raw.emoji === 'string' ? raw.emoji : null,
    color: typeof raw.color === 'string' ? raw.color : null,
    createdAt: isFiniteInteger(raw.createdAt) ? raw.createdAt : 0,
    archivedAt: nullableInteger(raw.archivedAt) ? raw.archivedAt : null,
  };
}

/**
 * Relecture d'un fichier de sauvegarde.
 *
 * Tolérante sur les détails — un champ optionnel manquant reprend sa valeur par
 * défaut — mais stricte sur ce qui rend un document exploitable : la signature
 * de l'app, une version qu'on sait lire, et des joueurs identifiables. Mieux
 * vaut refuser franchement qu'importer une bouillie.
 */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: "Ce fichier n'est pas du JSON." };
  }

  if (!isObject(raw)) return { ok: false, reason: 'Ce fichier ne contient pas une sauvegarde.' };
  if (raw.app !== BACKUP_APP) {
    return { ok: false, reason: "Cette sauvegarde ne vient pas de l'app." };
  }
  if (!isFiniteInteger(raw.version) || raw.version > BACKUP_VERSION) {
    return {
      ok: false,
      reason: 'Cette sauvegarde vient d’une version plus récente de l’app.',
    };
  }
  if (!Array.isArray(raw.players)) {
    return { ok: false, reason: 'Cette sauvegarde ne contient aucun joueur.' };
  }

  const players = raw.players
    .map(parsePlayer)
    .filter((player): player is BackupPlayer => player !== undefined);
  if (players.length === 0) {
    return { ok: false, reason: 'Cette sauvegarde ne contient aucun joueur lisible.' };
  }

  const known = new Set(players.map((player) => player.id));
  const games = (Array.isArray(raw.games) ? raw.games : [])
    .map(parseGame)
    .filter((game): game is BackupGame => game !== undefined)
    // Une partie dont un joueur manque au roster ne se rejouerait pas : la
    // laisser entrer produirait une feuille de score à trous.
    .filter((game) => game.seats.length > 0 && game.seats.every((s) => known.has(s.playerId)));

  return {
    ok: true,
    document: {
      app: BACKUP_APP,
      version: BACKUP_VERSION,
      exportedAt: isFiniteInteger(raw.exportedAt) ? raw.exportedAt : Date.now(),
      players,
      games,
    },
  };
}

/**
 * Résumé lisible d'une sauvegarde, pour la demande de confirmation. La
 * traduction est passée en argument : joueurs et parties s'accordent chacun de
 * leur côté, ce qu'une seule chaîne à deux nombres ne sait pas faire.
 */
export function describeBackup(document: BackupDocument, t: Translate): string {
  return t('summary.playersAndGames', {
    players: t('summary.players', { count: document.players.length }),
    games: t('summary.games', { count: document.games.length }),
  });
}
