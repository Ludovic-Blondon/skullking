/** Accès au roster de joueurs (PLAN.md §5). */

import { asc, eq, isNull } from 'drizzle-orm';

import { db } from '../client';
import { players, type Player } from '../schema';

/**
 * Palette d'identité attribuée à la création éclair d'un joueur (§7.1 :
 * « prénom → emoji/couleur auto »). Volontairement sobre, touches pirates
 * discrètes (§13.5).
 */
const EMOJIS = ['🏴‍☠️', '⚓', '🦜', '🗡️', '🧭', '💰', '🐙', '🦈'];
const COLORS = [
  '#0F766E',
  '#B45309',
  '#7C3AED',
  '#B91C1C',
  '#0369A1',
  '#4D7C0F',
  '#BE185D',
  '#475569',
];

/** Requête des joueurs actifs — à passer à `useLiveQuery`. */
export function activePlayersQuery() {
  return db.select().from(players).where(isNull(players.archivedAt)).orderBy(asc(players.name));
}

export async function listActivePlayers(): Promise<Player[]> {
  return activePlayersQuery();
}

export async function createPlayer(name: string): Promise<Player> {
  const trimmed = name.trim();
  const existing = await db.select({ id: players.id }).from(players);
  const index = existing.length % EMOJIS.length;

  const [created] = await db
    .insert(players)
    .values({
      name: trimmed,
      emoji: EMOJIS[index],
      color: COLORS[index],
      createdAt: Date.now(),
    })
    .returning();
  return created;
}

/** Un joueur ayant participé à des parties n'est jamais supprimé (§5). */
export async function archivePlayer(playerId: number): Promise<void> {
  await db.update(players).set({ archivedAt: Date.now() }).where(eq(players.id, playerId));
}

export async function restorePlayer(playerId: number): Promise<void> {
  await db.update(players).set({ archivedAt: null }).where(eq(players.id, playerId));
}
