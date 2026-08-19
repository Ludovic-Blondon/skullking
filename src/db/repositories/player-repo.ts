/** Accès au roster de joueurs (PLAN.md §5 et §7.4). */

import { asc, count, desc, eq, isNotNull, isNull } from 'drizzle-orm';

import { PLAYER_COLORS } from '@/ui/tokens';

import { db } from '../client';
import { gamePlayers, players, type Player } from '../schema';

/**
 * Identité attribuée à la création éclair d'un joueur (§7.1 : « prénom →
 * emoji/couleur auto »). Emojis nautiques génériques, aucun artwork officiel.
 */
export const PLAYER_EMOJIS = ['🦜', '⚓', '🏴', '🗺️', '💎', '🔱', '🧭', '🐚'];
// Les huit teintes viennent des jetons de design : une seule palette, qu'on la
// regarde depuis une pastille de joueur ou depuis une colonne de feuille.
const COLORS = PLAYER_COLORS;

/** Requête des joueurs actifs, par ordre alphabétique — à passer à `useLiveQuery`. */
export function activePlayersQuery() {
  return db.select().from(players).where(isNull(players.archivedAt)).orderBy(asc(players.name));
}

/**
 * Roster trié par **fréquence de jeu** (§7.4) : ceux qui jouent le plus
 * remontent, les ex æquo restent alphabétiques. C'est l'ordre utile quand on
 * remonte une table habituelle.
 */
export function rosterQuery() {
  return db
    .select({
      id: players.id,
      name: players.name,
      emoji: players.emoji,
      color: players.color,
      games: count(gamePlayers.gameId),
    })
    .from(players)
    .leftJoin(gamePlayers, eq(gamePlayers.playerId, players.id))
    .where(isNull(players.archivedAt))
    .groupBy(players.id)
    .orderBy(desc(count(gamePlayers.gameId)), asc(players.name));
}

/** Joueurs mis de côté, les plus récemment archivés d'abord. */
export function archivedPlayersQuery() {
  return db
    .select()
    .from(players)
    .where(isNotNull(players.archivedAt))
    .orderBy(desc(players.archivedAt));
}

export async function listActivePlayers(): Promise<Player[]> {
  return activePlayersQuery();
}

export async function getPlayer(playerId: number): Promise<Player | undefined> {
  const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  return player;
}

/** Nombre de parties auxquelles un joueur a été assis. */
export async function gameCountOf(playerId: number): Promise<number> {
  const [row] = await db
    .select({ games: count() })
    .from(gamePlayers)
    .where(eq(gamePlayers.playerId, playerId));
  return row?.games ?? 0;
}

export async function createPlayer(name: string): Promise<Player> {
  const trimmed = name.trim();
  const existing = await db.select({ id: players.id }).from(players);
  const index = existing.length % PLAYER_EMOJIS.length;

  const [created] = await db
    .insert(players)
    .values({
      name: trimmed,
      emoji: PLAYER_EMOJIS[index],
      color: COLORS[index],
      createdAt: Date.now(),
    })
    .returning();
  return created;
}

/** Renommage et changement d'identité — le prénom vide est refusé. */
export async function updatePlayer(
  playerId: number,
  patch: { name?: string; emoji?: string; color?: string },
): Promise<void> {
  const name = patch.name?.trim();
  if (patch.name !== undefined && !name) return;

  await db
    .update(players)
    .set({ ...patch, ...(name ? { name } : {}) })
    .where(eq(players.id, playerId));
}

/** Un joueur ayant participé à des parties n'est jamais supprimé (§5). */
export async function archivePlayer(playerId: number): Promise<void> {
  await db.update(players).set({ archivedAt: Date.now() }).where(eq(players.id, playerId));
}

export async function restorePlayer(playerId: number): Promise<void> {
  await db.update(players).set({ archivedAt: null }).where(eq(players.id, playerId));
}

/**
 * Suppression définitive, réservée à un joueur qui n'a jamais joué : sinon son
 * historique perdrait ses noms. Renvoie faux quand la suppression est refusée,
 * à charge pour l'appelant de proposer l'archivage.
 */
export async function deletePlayer(playerId: number): Promise<boolean> {
  if ((await gameCountOf(playerId)) > 0) return false;
  await db.delete(players).where(eq(players.id, playerId));
  return true;
}
