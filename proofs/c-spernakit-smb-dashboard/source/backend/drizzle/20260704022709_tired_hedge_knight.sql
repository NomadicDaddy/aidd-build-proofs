CREATE TABLE `saved_views` (
	`created_at` integer NOT NULL,
	`created_by` integer,
	`deleted_at` integer,
	`deleted_by` integer,
	`filters` text NOT NULL,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`name` text NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` integer,
	`user_id` integer NOT NULL,
	`workspace_id` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_saved_views_user_id` ON `saved_views` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_saved_views_is_deleted` ON `saved_views` (`is_deleted`);--> statement-breakpoint
CREATE INDEX `idx_saved_views_user_id_is_deleted` ON `saved_views` (`user_id`,`is_deleted`);--> statement-breakpoint
CREATE INDEX `idx_saved_views_workspace_id` ON `saved_views` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `idx_saved_views_workspace_id_user_id` ON `saved_views` (`workspace_id`,`user_id`);