/**
 * Export et import de la base (PLAN.md §7.4 et §11, critère « export→import
 * sans perte »).
 *
 * Le format, lui, vit dans `backup-format.ts` : pur, donc testé. Ce module ne
 * fait que la traduction avec SQLite.
 */

import { BACKUP_APP, BACKUP_VERSION, type BackupDocument, type BackupGame } from '../backup-format';
import { db, sqlite } from '../client';
import {
  bonusEvents,
  gamePlayers,
  games,
  players,
  roundEntries,
  rounds,
  type BonusEventType,
} from '../schema';

import { persistScores } from './game-repo';

/** Photo complète de la base, prête à sérialiser. */
export async function exportBackup(): Promise<BackupDocument> {
  const [allPlayers, allGames, allSeats, allRounds, allEntries, allEvents] = await Promise.all([
    db.select().from(players),
    db.select().from(games),
    db.select().from(gamePlayers),
    db.select().from(rounds),
    db.select().from(roundEntries),
    db.select().from(bonusEvents),
  ]);

  const exported: BackupGame[] = allGames.map((game) => ({
    id: game.id,
    createdAt: game.createdAt,
    finishedAt: game.finishedAt,
    status: game.status,
    ruleset: game.ruleset,
    currentRound: game.currentRound,
    currentPhase: game.currentPhase,
    seats: allSeats
      .filter((seat) => seat.gameId === game.id)
      .sort((a, b) => a.seatIndex - b.seatIndex)
      .map((seat) => ({ playerId: seat.playerId, seatIndex: seat.seatIndex })),
    rounds: allRounds
      .filter((round) => round.gameId === game.id)
      .sort((a, b) => a.roundNumber - b.roundNumber)
      .map((round) => ({
        roundNumber: round.roundNumber,
        cardsDealt: round.cardsDealt,
        destroyedTricks: round.destroyedTricks,
        forced: round.forced,
        // Les colonnes de score ne voyagent pas : elles se recalculent (§5).
        entries: allEntries
          .filter((entry) => entry.roundId === round.id)
          .map((entry) => ({
            playerId: entry.playerId,
            bid: entry.bid,
            tricks: entry.tricks,
            bidModifier: entry.bidModifier,
            rascalBet: entry.rascalBet,
            cannonball: entry.cannonball,
            customBonus: entry.customBonus,
          })),
        bonusEvents: allEvents
          .filter((event) => event.roundId === round.id)
          .map((event) => ({
            playerId: event.playerId,
            type: event.type,
            count: event.count,
            allyPlayerId: event.allyPlayerId,
          })),
      })),
  }));

  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    players: allPlayers.map((player) => ({
      id: player.id,
      name: player.name,
      emoji: player.emoji,
      color: player.color,
      createdAt: player.createdAt,
      archivedAt: player.archivedAt,
    })),
    games: exported,
  };
}

/**
 * Remplace **tout** le contenu de la base par celui d'une sauvegarde.
 *
 * Une sauvegarde est une photo, pas un apport : fusionner deux bases dont les
 * identifiants se recouvrent produirait des parties chimériques. L'écran
 * prévient avant d'appeler ici.
 *
 * Les identifiants de manche, eux, sont réattribués : ils n'ont aucun sens hors
 * de la base qui les a émis, et le format ne les transporte pas.
 */
export async function importBackup(document: BackupDocument): Promise<void> {
  await sqlite.withTransactionAsync(async () => {
    await db.delete(bonusEvents);
    await db.delete(roundEntries);
    await db.delete(rounds);
    await db.delete(gamePlayers);
    await db.delete(games);
    await db.delete(players);

    if (document.players.length > 0) {
      await db.insert(players).values(document.players);
    }

    for (const game of document.games) {
      await db.insert(games).values({
        id: game.id,
        createdAt: game.createdAt,
        finishedAt: game.finishedAt,
        status: game.status as 'in_progress' | 'finished' | 'abandoned',
        ruleset: game.ruleset as never,
        currentRound: game.currentRound,
        currentPhase: game.currentPhase as 'bidding' | 'results',
      });

      if (game.seats.length > 0) {
        await db
          .insert(gamePlayers)
          .values(game.seats.map((seat) => ({ gameId: game.id, ...seat })));
      }

      for (const round of game.rounds) {
        const [inserted] = await db
          .insert(rounds)
          .values({
            gameId: game.id,
            roundNumber: round.roundNumber,
            cardsDealt: round.cardsDealt,
            destroyedTricks: round.destroyedTricks,
            forced: round.forced,
          })
          .returning({ id: rounds.id });

        if (round.entries.length > 0) {
          await db
            .insert(roundEntries)
            .values(round.entries.map((entry) => ({ roundId: inserted.id, ...entry })));
        }
        if (round.bonusEvents.length > 0) {
          await db.insert(bonusEvents).values(
            round.bonusEvents.map((event) => ({
              roundId: inserted.id,
              playerId: event.playerId,
              type: event.type as BonusEventType,
              count: event.count,
              allyPlayerId: event.allyPlayerId,
            })),
          );
        }
      }
    }
  });

  // Les scores figés se reconstruisent depuis la saisie : une sauvegarde
  // ancienne profite ainsi d'un barème corrigé entre-temps (§12.5).
  for (const game of document.games) {
    await persistScores(game.id);
  }
}

/** Vide la base — utilisé par l'écran de réglages, avec confirmation. */
export async function eraseEverything(): Promise<void> {
  await sqlite.withTransactionAsync(async () => {
    await db.delete(bonusEvents);
    await db.delete(roundEntries);
    await db.delete(rounds);
    await db.delete(gamePlayers);
    await db.delete(games);
    await db.delete(players);
  });
}

/** Nombre de parties et de joueurs actuellement en base, pour l'écran. */
export async function countContents(): Promise<{ players: number; games: number }> {
  const [allPlayers, allGames] = await Promise.all([
    db.select({ id: players.id }).from(players),
    db.select({ id: games.id }).from(games),
  ]);
  return { players: allPlayers.length, games: allGames.length };
}
