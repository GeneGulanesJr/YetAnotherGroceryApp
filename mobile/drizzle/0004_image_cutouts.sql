CREATE TABLE `image_cutouts` (
	`image_id` text PRIMARY KEY NOT NULL,
	`uri` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE no action
);
