CREATE TABLE `skill_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`skill_id` text NOT NULL,
	`version` integer NOT NULL,
	`description` text NOT NULL,
	`body_md` text NOT NULL,
	`changelog` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skill_versions_skill_version` ON `skill_versions` (`skill_id`,`version`);--> statement-breakpoint
CREATE UNIQUE INDEX `skill_versions_skill_id_id` ON `skill_versions` (`skill_id`,`id`);--> statement-breakpoint
CREATE TABLE `skills` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`author_id` text NOT NULL,
	`cloned_from_skill_version_id` text,
	`row_version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deprecated_at` text,
	`trashed_at` text,
	`trashed_bot_ids` text,
	FOREIGN KEY (`cloned_from_skill_version_id`) REFERENCES `skill_versions`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "skills_trashed_needs_deprecated" CHECK("skills"."trashed_at" IS NULL OR "skills"."deprecated_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skills_slug_unique` ON `skills` (`slug`);