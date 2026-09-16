CREATE TABLE `sync_conflicts` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`table_name` text NOT NULL,
	`record_id` text NOT NULL,
	`field` text NOT NULL,
	`winning_side` text NOT NULL,
	`winning_value_json` text,
	`losing_value_json` text,
	`local_revision` integer,
	`remote_revision` integer,
	`local_device_id` text,
	`remote_device_id` text
);
--> statement-breakpoint
CREATE INDEX `sync_conflicts_record_idx` ON `sync_conflicts` (`table_name`,`record_id`);--> statement-breakpoint
CREATE INDEX `sync_conflicts_created_idx` ON `sync_conflicts` (`created_at`);