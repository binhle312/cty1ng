CREATE TABLE `events` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conversation_id` text,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
