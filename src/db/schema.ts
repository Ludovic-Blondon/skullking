/**
 * Schéma relationnel (PLAN.md §5).
 *
 * Deux principes structurent ces tables :
 *
 * 1. **On enregistre la saisie, jamais le raisonnement.** Mises, plis et
 *    événements de bonus sont des faits ; les points, eux, sont recalculés par
 *    `src/core`. Corriger un barème par mise à jour d'app suffit alors à
 *    reconstruire tout l'historique.
 * 2. **Les colonnes de score sont un cache.** Elles évitent de rejouer le
 *    moteur pour afficher une feuille de score, et sont réécrites à chaque
 *    validation ou correction de manche.
 */

import { relations } from 'drizzle-orm';
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

import type { BonusType, Ruleset } from '@/core';

/** Types d'événements stockés : les captures du moteur, plus le Butin. */
export type BonusEventType = BonusType | 'loot';

export const players = sqliteTable('players', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  emoji: text('emoji'),
  color: text('color'),
  createdAt: integer('created_at').notNull(),
  /** Un joueur ayant des parties n'est jamais supprimé, seulement archivé. */
  archivedAt: integer('archived_at'),
});

export const games = sqliteTable('games', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  createdAt: integer('created_at').notNull(),
  finishedAt: integer('finished_at'),
  status: text('status', { enum: ['in_progress', 'finished', 'abandoned'] })
    .notNull()
    .default('in_progress'),
  /** Le jeu de règles est figé à la création : l'historique reste décodable. */
  ruleset: text('ruleset', { mode: 'json' }).$type<Ruleset>().notNull(),
  currentRound: integer('current_round').notNull().default(1),
  currentPhase: text('current_phase', { enum: ['bidding', 'results'] })
    .notNull()
    .default('bidding'),
});

export const gamePlayers = sqliteTable(
  'game_players',
  {
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    playerId: integer('player_id')
      .notNull()
      .references(() => players.id),
    /** Position autour de la table : détermine la rotation du donneur. */
    seatIndex: integer('seat_index').notNull(),
  },
  (table) => [primaryKey({ columns: [table.gameId, table.playerId] })],
);

export const rounds = sqliteTable(
  'rounds',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    roundNumber: integer('round_number').notNull(),
    cardsDealt: integer('cards_dealt').notNull(),
    /** Plis détruits par le Kraken ou la Baleine blanche. */
    destroyedTricks: integer('destroyed_tricks').notNull().default(0),
    /** Manche validée malgré une incohérence assumée à table (PLAN.md §4.4). */
    forced: integer('forced', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => [uniqueIndex('rounds_game_round').on(table.gameId, table.roundNumber)],
);

export const roundEntries = sqliteTable(
  'round_entries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    roundId: integer('round_id')
      .notNull()
      .references(() => rounds.id, { onDelete: 'cascade' }),
    playerId: integer('player_id')
      .notNull()
      .references(() => players.id),
    /**
     * Nullables tous les deux : une manche dont les annonces sont posées mais
     * non jouée est un état légitime, et c'est ce qui permet de reprendre une
     * partie tuée en plein milieu (PLAN.md §5).
     */
    bid: integer('bid'),
    tricks: integer('tricks'),
    /** Harry le Géant : −1, 0 ou +1 sur la mise. */
    bidModifier: integer('bid_modifier').notNull().default(0),
    /** Pari de Rascal le Flambeur : 0, 10 ou 20. */
    rascalBet: integer('rascal_bet').notNull().default(0),
    /** Option Boulet de canon, choisie par joueur et par manche (§4.3). */
    cannonball: integer('cannonball', { mode: 'boolean' }).notNull().default(false),
    customBonus: integer('custom_bonus').notNull().default(0),
    scoreBase: integer('score_base'),
    scoreBonus: integer('score_bonus'),
    scoreTotal: integer('score_total'),
  },
  (table) => [uniqueIndex('round_entries_round_player').on(table.roundId, table.playerId)],
);

/**
 * Un événement par bénéficiaire — table dédiée plutôt que colonnes, pour
 * accueillir l'extension 2026 sans migration et pour agréger les statistiques
 * en SQL (PLAN.md §5).
 *
 * Une alliance de Butin s'écrit en **deux lignes miroir**, chacune pointant
 * l'autre joueur : le moteur, lui, la voit comme une paire.
 */
export const bonusEvents = sqliteTable(
  'bonus_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    roundId: integer('round_id')
      .notNull()
      .references(() => rounds.id, { onDelete: 'cascade' }),
    playerId: integer('player_id')
      .notNull()
      .references(() => players.id),
    type: text('type').notNull().$type<BonusEventType>(),
    count: integer('count').notNull().default(1),
    allyPlayerId: integer('ally_player_id').references(() => players.id),
  },
  (table) => [index('bonus_events_round').on(table.roundId)],
);

export const gamesRelations = relations(games, ({ many }) => ({
  gamePlayers: many(gamePlayers),
  rounds: many(rounds),
}));

export const gamePlayersRelations = relations(gamePlayers, ({ one }) => ({
  game: one(games, { fields: [gamePlayers.gameId], references: [games.id] }),
  player: one(players, { fields: [gamePlayers.playerId], references: [players.id] }),
}));

export const roundsRelations = relations(rounds, ({ one, many }) => ({
  game: one(games, { fields: [rounds.gameId], references: [games.id] }),
  entries: many(roundEntries),
  bonusEvents: many(bonusEvents),
}));

export const roundEntriesRelations = relations(roundEntries, ({ one }) => ({
  round: one(rounds, { fields: [roundEntries.roundId], references: [rounds.id] }),
  player: one(players, { fields: [roundEntries.playerId], references: [players.id] }),
}));

export const bonusEventsRelations = relations(bonusEvents, ({ one }) => ({
  round: one(rounds, { fields: [bonusEvents.roundId], references: [rounds.id] }),
  player: one(players, { fields: [bonusEvents.playerId], references: [players.id] }),
}));

export type Player = typeof players.$inferSelect;
export type Game = typeof games.$inferSelect;
export type Round = typeof rounds.$inferSelect;
export type RoundEntry = typeof roundEntries.$inferSelect;
export type BonusEvent = typeof bonusEvents.$inferSelect;
