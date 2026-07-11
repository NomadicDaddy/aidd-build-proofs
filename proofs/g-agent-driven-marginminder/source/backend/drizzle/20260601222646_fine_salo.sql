CREATE TABLE `cost_catalog_items` (
	`active` integer DEFAULT true NOT NULL,
	`category` text NOT NULL,
	`created_at` integer NOT NULL,
	`default_markup_percent` real DEFAULT 0 NOT NULL,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`last_reviewed_at` integer,
	`name` text NOT NULL,
	`notes` text,
	`taxable` integer DEFAULT true NOT NULL,
	`unit` text NOT NULL,
	`unit_cost` real DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_cost_catalog_items_active` ON `cost_catalog_items` (`active`);--> statement-breakpoint
CREATE INDEX `idx_cost_catalog_items_active_category` ON `cost_catalog_items` (`active`,`category`);--> statement-breakpoint
CREATE INDEX `idx_cost_catalog_items_category` ON `cost_catalog_items` (`category`);--> statement-breakpoint
CREATE INDEX `idx_cost_catalog_items_updated_at` ON `cost_catalog_items` (`updated_at`);--> statement-breakpoint
CREATE TABLE `quote_scenarios` (
	`assumptions` text,
	`contingency_percent` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`customer_name` text NOT NULL,
	`discount_percent` real DEFAULT 0 NOT NULL,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`notes` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`target_margin_percent` real DEFAULT 30 NOT NULL,
	`tax_rate_percent` real DEFAULT 0 NOT NULL,
	`title` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_quote_scenarios_status` ON `quote_scenarios` (`status`);--> statement-breakpoint
CREATE INDEX `idx_quote_scenarios_status_updated_at` ON `quote_scenarios` (`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_quote_scenarios_updated_at` ON `quote_scenarios` (`updated_at`);--> statement-breakpoint
CREATE TABLE `scenario_fixed_costs` (
	`cost` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`markup_percent` real DEFAULT 0 NOT NULL,
	`name` text NOT NULL,
	`notes` text,
	`scenario_id` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`taxable` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`scenario_id`) REFERENCES `quote_scenarios`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_scenario_fixed_costs_scenario_id` ON `scenario_fixed_costs` (`scenario_id`);--> statement-breakpoint
CREATE INDEX `idx_scenario_fixed_costs_scenario_id_sort_order` ON `scenario_fixed_costs` (`scenario_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `scenario_labor_entries` (
	`billable_hourly_rate` real DEFAULT 0 NOT NULL,
	`burden_percent` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`hours` real DEFAULT 0 NOT NULL,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`internal_hourly_cost` real DEFAULT 0 NOT NULL,
	`notes` text,
	`role_name` text NOT NULL,
	`scenario_id` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`scenario_id`) REFERENCES `quote_scenarios`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_scenario_labor_entries_scenario_id` ON `scenario_labor_entries` (`scenario_id`);--> statement-breakpoint
CREATE INDEX `idx_scenario_labor_entries_scenario_id_sort_order` ON `scenario_labor_entries` (`scenario_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `scenario_line_items` (
	`catalog_item_id` integer,
	`category` text NOT NULL,
	`created_at` integer NOT NULL,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`markup_percent` real DEFAULT 0 NOT NULL,
	`name` text NOT NULL,
	`notes` text,
	`quantity` real DEFAULT 1 NOT NULL,
	`scenario_id` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`taxable` integer DEFAULT true NOT NULL,
	`unit` text NOT NULL,
	`unit_cost` real DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`catalog_item_id`) REFERENCES `cost_catalog_items`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`scenario_id`) REFERENCES `quote_scenarios`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_scenario_line_items_catalog_item_id` ON `scenario_line_items` (`catalog_item_id`);--> statement-breakpoint
CREATE INDEX `idx_scenario_line_items_scenario_id` ON `scenario_line_items` (`scenario_id`);--> statement-breakpoint
CREATE INDEX `idx_scenario_line_items_scenario_id_sort_order` ON `scenario_line_items` (`scenario_id`,`sort_order`);