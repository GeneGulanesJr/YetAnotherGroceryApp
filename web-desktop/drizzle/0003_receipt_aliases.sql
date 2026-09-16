CREATE TABLE `receipt_aliases` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`device_id` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`sync_status` text NOT NULL,
	`field_versions_json` text,
	`store_id` text,
	`alias` text NOT NULL,
	`product_id` text NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `receipt_aliases_alias_idx` ON `receipt_aliases` (`alias`);--> statement-breakpoint
CREATE INDEX `receipt_aliases_store_idx` ON `receipt_aliases` (`store_id`);--> statement-breakpoint
CREATE INDEX `receipt_aliases_product_idx` ON `receipt_aliases` (`product_id`);--> statement-breakpoint
CREATE INDEX `receipt_aliases_updated_at_idx` ON `receipt_aliases` (`updated_at`);--> statement-breakpoint
CREATE INDEX `receipt_aliases_deleted_at_idx` ON `receipt_aliases` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `receipt_aliases_sync_status_idx` ON `receipt_aliases` (`sync_status`);