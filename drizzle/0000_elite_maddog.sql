CREATE TABLE `bonus_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`round_id` integer NOT NULL,
	`player_id` integer NOT NULL,
	`type` text NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`ally_player_id` integer,
	FOREIGN KEY (`round_id`) REFERENCES `rounds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ally_player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `bonus_events_round` ON `bonus_events` (`round_id`);--> statement-breakpoint
CREATE TABLE `game_players` (
	`game_id` integer NOT NULL,
	`player_id` integer NOT NULL,
	`seat_index` integer NOT NULL,
	PRIMARY KEY(`game_id`, `player_id`),
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `games` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer NOT NULL,
	`finished_at` integer,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`ruleset` text NOT NULL,
	`current_round` integer DEFAULT 1 NOT NULL,
	`current_phase` text DEFAULT 'bidding' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`emoji` text,
	`color` text,
	`created_at` integer NOT NULL,
	`archived_at` integer
);
--> statement-breakpoint
CREATE TABLE `round_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`round_id` integer NOT NULL,
	`player_id` integer NOT NULL,
	`bid` integer,
	`tricks` integer,
	`bid_modifier` integer DEFAULT 0 NOT NULL,
	`rascal_bet` integer DEFAULT 0 NOT NULL,
	`cannonball` integer DEFAULT false NOT NULL,
	`custom_bonus` integer DEFAULT 0 NOT NULL,
	`score_base` integer,
	`score_bonus` integer,
	`score_total` integer,
	FOREIGN KEY (`round_id`) REFERENCES `rounds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `round_entries_round_player` ON `round_entries` (`round_id`,`player_id`);--> statement-breakpoint
CREATE TABLE `rounds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` integer NOT NULL,
	`round_number` integer NOT NULL,
	`cards_dealt` integer NOT NULL,
	`destroyed_tricks` integer DEFAULT 0 NOT NULL,
	`forced` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rounds_game_round` ON `rounds` (`game_id`,`round_number`);