CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`device_id` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`sync_status` text NOT NULL,
	`field_versions_json` text,
	`name` text NOT NULL,
	`parent_id` text,
	`default_unit` text
);
--> statement-breakpoint
CREATE INDEX `categories_name_idx` ON `categories` (`name`);--> statement-breakpoint
CREATE INDEX `categories_parent_id_idx` ON `categories` (`parent_id`);--> statement-breakpoint
CREATE INDEX `categories_updated_at_idx` ON `categories` (`updated_at`);--> statement-breakpoint
CREATE INDEX `categories_deleted_at_idx` ON `categories` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `categories_sync_status_idx` ON `categories` (`sync_status`);--> statement-breakpoint
CREATE TABLE `images` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`device_id` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`sync_status` text NOT NULL,
	`field_versions_json` text,
	`local_uri` text,
	`remote_object_key` text,
	`thumbnail_uri` text,
	`mime_type` text,
	`width` integer,
	`height` integer,
	`file_size` integer,
	`sha256` text,
	`upload_status` text NOT NULL,
	`captured_at` integer
);
--> statement-breakpoint
CREATE INDEX `images_sha256_idx` ON `images` (`sha256`);--> statement-breakpoint
CREATE INDEX `images_upload_status_idx` ON `images` (`upload_status`);--> statement-breakpoint
CREATE INDEX `images_updated_at_idx` ON `images` (`updated_at`);--> statement-breakpoint
CREATE INDEX `images_deleted_at_idx` ON `images` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `images_sync_status_idx` ON `images` (`sync_status`);--> statement-breakpoint
CREATE TABLE `prices` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`device_id` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`sync_status` text NOT NULL,
	`field_versions_json` text,
	`product_id` text NOT NULL,
	`store_id` text,
	`currency` text NOT NULL,
	`regular_price_minor` integer NOT NULL,
	`promotional_price_minor` integer,
	`loyalty_price_minor` integer,
	`expected_checkout_price_minor` integer,
	`unit_price_minor` integer,
	`unit_price_unit` text,
	`min_promo_quantity` integer,
	`tax_included` integer,
	`captured_at` integer NOT NULL,
	`source_image_id` text,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `prices_product_id_idx` ON `prices` (`product_id`);--> statement-breakpoint
CREATE INDEX `prices_store_id_idx` ON `prices` (`store_id`);--> statement-breakpoint
CREATE INDEX `prices_captured_at_idx` ON `prices` (`captured_at`);--> statement-breakpoint
CREATE INDEX `prices_updated_at_idx` ON `prices` (`updated_at`);--> statement-breakpoint
CREATE INDEX `prices_deleted_at_idx` ON `prices` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `prices_sync_status_idx` ON `prices` (`sync_status`);--> statement-breakpoint
CREATE TABLE `product_barcodes` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`device_id` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`sync_status` text NOT NULL,
	`field_versions_json` text,
	`product_id` text NOT NULL,
	`barcode` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `product_barcodes_barcode_idx` ON `product_barcodes` (`barcode`);--> statement-breakpoint
CREATE INDEX `product_barcodes_product_id_idx` ON `product_barcodes` (`product_id`);--> statement-breakpoint
CREATE INDEX `product_barcodes_updated_at_idx` ON `product_barcodes` (`updated_at`);--> statement-breakpoint
CREATE INDEX `product_barcodes_deleted_at_idx` ON `product_barcodes` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `product_barcodes_sync_status_idx` ON `product_barcodes` (`sync_status`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`device_id` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`sync_status` text NOT NULL,
	`field_versions_json` text,
	`name` text NOT NULL,
	`brand` text,
	`category_id` text,
	`package_quantity` integer,
	`package_size` text,
	`unit` text,
	`notes` text,
	`photo_image_id` text,
	`is_favorite` integer DEFAULT 0 NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`photo_image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `products_category_id_idx` ON `products` (`category_id`);--> statement-breakpoint
CREATE INDEX `products_name_idx` ON `products` (`name`);--> statement-breakpoint
CREATE INDEX `products_is_favorite_idx` ON `products` (`is_favorite`);--> statement-breakpoint
CREATE INDEX `products_archived_at_idx` ON `products` (`archived_at`);--> statement-breakpoint
CREATE INDEX `products_updated_at_idx` ON `products` (`updated_at`);--> statement-breakpoint
CREATE INDEX `products_deleted_at_idx` ON `products` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `products_sync_status_idx` ON `products` (`sync_status`);--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`device_id` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`sync_status` text NOT NULL,
	`field_versions_json` text,
	`product_id` text NOT NULL,
	`trip_id` text,
	`store_id` text,
	`receipt_id` text,
	`receipt_line_id` text,
	`currency` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`barcode` text,
	`shelf_price_minor` integer NOT NULL,
	`unit_price_minor` integer,
	`expected_unit_price_minor` integer,
	`receipt_unit_price_minor` integer,
	`receipt_line_total_minor` integer,
	`discount_minor` integer,
	`final_paid_amount_minor` integer,
	`tax_amount_minor` integer,
	`price_discrepancy_minor` integer,
	`purchased_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`receipt_id`) REFERENCES `receipts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`receipt_line_id`) REFERENCES `receipt_lines`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `purchases_product_id_idx` ON `purchases` (`product_id`);--> statement-breakpoint
CREATE INDEX `purchases_trip_id_idx` ON `purchases` (`trip_id`);--> statement-breakpoint
CREATE INDEX `purchases_store_id_idx` ON `purchases` (`store_id`);--> statement-breakpoint
CREATE INDEX `purchases_receipt_id_idx` ON `purchases` (`receipt_id`);--> statement-breakpoint
CREATE INDEX `purchases_purchased_at_idx` ON `purchases` (`purchased_at`);--> statement-breakpoint
CREATE INDEX `purchases_updated_at_idx` ON `purchases` (`updated_at`);--> statement-breakpoint
CREATE INDEX `purchases_deleted_at_idx` ON `purchases` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `purchases_sync_status_idx` ON `purchases` (`sync_status`);--> statement-breakpoint
CREATE TABLE `receipt_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`device_id` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`sync_status` text NOT NULL,
	`field_versions_json` text,
	`receipt_id` text NOT NULL,
	`product_id` text,
	`line_number` integer NOT NULL,
	`line_type` text NOT NULL,
	`description_raw` text,
	`description_corrected` text,
	`quantity` integer,
	`raw_unit_price_minor` integer,
	`raw_line_total_minor` integer,
	`unit_price_minor` integer,
	`line_total_minor` integer,
	`confidence` real,
	`matched_alias` text,
	FOREIGN KEY (`receipt_id`) REFERENCES `receipts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `receipt_lines_receipt_id_idx` ON `receipt_lines` (`receipt_id`);--> statement-breakpoint
CREATE INDEX `receipt_lines_product_id_idx` ON `receipt_lines` (`product_id`);--> statement-breakpoint
CREATE INDEX `receipt_lines_updated_at_idx` ON `receipt_lines` (`updated_at`);--> statement-breakpoint
CREATE INDEX `receipt_lines_deleted_at_idx` ON `receipt_lines` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `receipt_lines_sync_status_idx` ON `receipt_lines` (`sync_status`);--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`device_id` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`sync_status` text NOT NULL,
	`field_versions_json` text,
	`store_id` text,
	`trip_id` text,
	`currency` text NOT NULL,
	`subtotal_minor` integer,
	`total_minor` integer,
	`tax_minor` integer,
	`discount_minor` integer,
	`savings_minor` integer,
	`overcharge_minor` integer,
	`captured_at` integer,
	`source_image_id` text,
	`raw_ocr_text` text,
	`verified_at` integer,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `receipts_store_id_idx` ON `receipts` (`store_id`);--> statement-breakpoint
CREATE INDEX `receipts_trip_id_idx` ON `receipts` (`trip_id`);--> statement-breakpoint
CREATE INDEX `receipts_captured_at_idx` ON `receipts` (`captured_at`);--> statement-breakpoint
CREATE INDEX `receipts_updated_at_idx` ON `receipts` (`updated_at`);--> statement-breakpoint
CREATE INDEX `receipts_deleted_at_idx` ON `receipts` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `receipts_sync_status_idx` ON `receipts` (`sync_status`);--> statement-breakpoint
CREATE TABLE `shopping_list_items` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`device_id` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`sync_status` text NOT NULL,
	`field_versions_json` text,
	`list_id` text NOT NULL,
	`product_id` text,
	`name` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`unit` text,
	`purchased` integer DEFAULT 0 NOT NULL,
	`store_id` text,
	`currency` text,
	`estimated_price_minor` integer,
	FOREIGN KEY (`list_id`) REFERENCES `shopping_lists`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `shopping_list_items_list_id_idx` ON `shopping_list_items` (`list_id`);--> statement-breakpoint
CREATE INDEX `shopping_list_items_product_id_idx` ON `shopping_list_items` (`product_id`);--> statement-breakpoint
CREATE INDEX `shopping_list_items_store_id_idx` ON `shopping_list_items` (`store_id`);--> statement-breakpoint
CREATE INDEX `shopping_list_items_purchased_idx` ON `shopping_list_items` (`purchased`);--> statement-breakpoint
CREATE INDEX `shopping_list_items_updated_at_idx` ON `shopping_list_items` (`updated_at`);--> statement-breakpoint
CREATE INDEX `shopping_list_items_deleted_at_idx` ON `shopping_list_items` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `shopping_list_items_sync_status_idx` ON `shopping_list_items` (`sync_status`);--> statement-breakpoint
CREATE TABLE `shopping_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`device_id` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`sync_status` text NOT NULL,
	`field_versions_json` text,
	`name` text NOT NULL,
	`store_id` text,
	`currency` text,
	`estimated_total_minor` integer,
	`trip_id` text,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `shopping_lists_store_id_idx` ON `shopping_lists` (`store_id`);--> statement-breakpoint
CREATE INDEX `shopping_lists_updated_at_idx` ON `shopping_lists` (`updated_at`);--> statement-breakpoint
CREATE INDEX `shopping_lists_deleted_at_idx` ON `shopping_lists` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `shopping_lists_sync_status_idx` ON `shopping_lists` (`sync_status`);--> statement-breakpoint
CREATE TABLE `stores` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`device_id` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`sync_status` text NOT NULL,
	`field_versions_json` text,
	`name` text NOT NULL,
	`branch` text,
	`address` text,
	`logo_image_id` text,
	FOREIGN KEY (`logo_image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `stores_updated_at_idx` ON `stores` (`updated_at`);--> statement-breakpoint
CREATE INDEX `stores_deleted_at_idx` ON `stores` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `stores_sync_status_idx` ON `stores` (`sync_status`);--> statement-breakpoint
CREATE TABLE `sync_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_mutations` (
	`id` text PRIMARY KEY NOT NULL,
	`table_name` text NOT NULL,
	`record_id` text NOT NULL,
	`operation` text NOT NULL,
	`changed_fields_json` text,
	`payload_json` text,
	`device_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`local_revision` integer,
	`status` text NOT NULL,
	`last_attempt_at` integer,
	`attempts` integer DEFAULT 0 NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE INDEX `sync_mutations_status_idx` ON `sync_mutations` (`status`);--> statement-breakpoint
CREATE INDEX `sync_mutations_table_name_idx` ON `sync_mutations` (`table_name`);--> statement-breakpoint
CREATE INDEX `sync_mutations_record_id_idx` ON `sync_mutations` (`record_id`);--> statement-breakpoint
CREATE INDEX `sync_mutations_created_at_idx` ON `sync_mutations` (`created_at`);--> statement-breakpoint
CREATE TABLE `trips` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`device_id` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`sync_status` text NOT NULL,
	`field_versions_json` text,
	`store_id` text,
	`status` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`currency` text,
	`budget_minor` integer,
	`notes` text,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `trips_store_id_idx` ON `trips` (`store_id`);--> statement-breakpoint
CREATE INDEX `trips_status_idx` ON `trips` (`status`);--> statement-breakpoint
CREATE INDEX `trips_started_at_idx` ON `trips` (`started_at`);--> statement-breakpoint
CREATE INDEX `trips_updated_at_idx` ON `trips` (`updated_at`);--> statement-breakpoint
CREATE INDEX `trips_deleted_at_idx` ON `trips` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `trips_sync_status_idx` ON `trips` (`sync_status`);