CREATE TABLE `bot_skills` (
	`bot_id` text NOT NULL,
	`skill_id` text NOT NULL,
	`skill_version_id` text NOT NULL,
	`always_load` integer DEFAULT false NOT NULL,
	`added_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`bot_id`, `skill_id`),
	FOREIGN KEY (`bot_id`) REFERENCES `bots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`skill_id`,`skill_version_id`) REFERENCES `skill_versions`(`skill_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `bots` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`row_version` integer DEFAULT 1 NOT NULL,
	`description` text NOT NULL,
	`persona_md` text NOT NULL,
	`avatar_style` text DEFAULT 'flat' NOT NULL,
	`avatar_colour` text NOT NULL,
	`avatar_path` text,
	`model_id` text NOT NULL,
	`effort` text,
	`request_limit` integer NOT NULL,
	`max_reply_chars` integer NOT NULL,
	`history_share_pct` integer NOT NULL,
	`tool_settings` text NOT NULL,
	`cloned_from_bot_id` text,
	`create_key` text,
	`create_request_hash` text,
	`pinned_position` integer,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`purged_at` text,
	FOREIGN KEY (`cloned_from_bot_id`) REFERENCES `bots`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bots_purged_needs_deleted" CHECK("bots"."purged_at" IS NULL OR "bots"."deleted_at" IS NOT NULL),
	CONSTRAINT "bots_create_key_with_hash" CHECK(("bots"."create_key" IS NULL) = ("bots"."create_request_hash" IS NULL)),
	CONSTRAINT "bots_avatar_style" CHECK("bots"."avatar_style" IN ('flat', 'jelly', 'pixel', 'upload')),
	CONSTRAINT "bots_avatar_upload_has_path" CHECK(("bots"."avatar_style" = 'upload') = ("bots"."avatar_path" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bots_slug_unique` ON `bots` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `bots_create_key_unique` ON `bots` (`create_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `bots_name_kept` ON `bots` (`name_key`) WHERE "bots"."purged_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `bots_pinned_position` ON `bots` (`pinned_position`) WHERE "bots"."pinned_position" IS NOT NULL;