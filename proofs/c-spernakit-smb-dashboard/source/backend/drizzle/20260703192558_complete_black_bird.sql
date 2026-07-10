CREATE TABLE `asset_change_events` (
	`action` text NOT NULL,
	`actor_id` integer,
	`asset_id` integer,
	`changes` text,
	`created_at` integer NOT NULL,
	`entity_id` integer,
	`entity_type` text NOT NULL,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`import_id` integer,
	`summary` text,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`import_id`) REFERENCES `imports`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_asset_change_events_asset_id` ON `asset_change_events` (`asset_id`);--> statement-breakpoint
CREATE INDEX `idx_asset_change_events_entity_type` ON `asset_change_events` (`entity_type`);--> statement-breakpoint
CREATE INDEX `idx_asset_change_events_created_at` ON `asset_change_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_asset_change_events_import_id` ON `asset_change_events` (`import_id`);--> statement-breakpoint
CREATE TABLE `import_rows` (
	`created_at` integer NOT NULL,
	`created_by` integer,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`import_id` integer NOT NULL,
	`message` text,
	`parsed_data` text,
	`raw_data` text,
	`row_number` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`target_asset_id` integer,
	`updated_at` integer NOT NULL,
	`updated_by` integer,
	FOREIGN KEY (`import_id`) REFERENCES `imports`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_import_rows_import_id` ON `import_rows` (`import_id`);--> statement-breakpoint
CREATE INDEX `idx_import_rows_status` ON `import_rows` (`status`);--> statement-breakpoint
CREATE INDEX `idx_import_rows_target_asset_id` ON `import_rows` (`target_asset_id`);--> statement-breakpoint
CREATE TABLE `imports` (
	`accepted_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`created_by` integer,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`imported_by` integer,
	`kind` text NOT NULL,
	`notes` text,
	`rejected_count` integer DEFAULT 0 NOT NULL,
	`row_count` integer DEFAULT 0 NOT NULL,
	`source` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` integer,
	`warning_count` integer DEFAULT 0 NOT NULL,
	`workspace_id` integer,
	FOREIGN KEY (`imported_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_imports_status` ON `imports` (`status`);--> statement-breakpoint
CREATE INDEX `idx_imports_kind` ON `imports` (`kind`);--> statement-breakpoint
CREATE INDEX `idx_imports_workspace_id` ON `imports` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `asset_hardware_profiles` (
	`asset_id` integer NOT NULL,
	`chassis_model` text,
	`cluster_name` text,
	`cpu_cores` integer,
	`cpu_model` text,
	`cpu_sockets` integer,
	`cpu_threads` integer,
	`created_at` integer NOT NULL,
	`created_by` integer,
	`form_factor` text,
	`guest_os` text,
	`hardware_model` text,
	`host_role` text,
	`hypervisor` text,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`notes` text,
	`ram_mb` integer,
	`snapshot_notes` text,
	`total_storage_gb` integer,
	`updated_at` integer NOT NULL,
	`updated_by` integer,
	`vcpu_count` integer,
	`vm_tools_status` text,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_asset_hardware_profiles_asset_id` ON `asset_hardware_profiles` (`asset_id`);--> statement-breakpoint
CREATE TABLE `asset_network_interfaces` (
	`asset_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`created_by` integer,
	`dns_name` text,
	`gateway` text,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ip_address` text,
	`is_primary` integer DEFAULT false NOT NULL,
	`mac_address` text,
	`name` text,
	`network_zone_id` integer,
	`notes` text,
	`subnet_mask` text,
	`updated_at` integer NOT NULL,
	`updated_by` integer,
	`vlan_id` integer,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`network_zone_id`) REFERENCES `network_zones`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_asset_network_interfaces_asset_id` ON `asset_network_interfaces` (`asset_id`);--> statement-breakpoint
CREATE INDEX `idx_asset_network_interfaces_ip_address` ON `asset_network_interfaces` (`ip_address`);--> statement-breakpoint
CREATE INDEX `idx_asset_network_interfaces_network_zone_id` ON `asset_network_interfaces` (`network_zone_id`);--> statement-breakpoint
CREATE TABLE `asset_storage_allocations` (
	`asset_id` integer NOT NULL,
	`capacity_gb` integer,
	`created_at` integer NOT NULL,
	`created_by` integer,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mount_point` text,
	`name` text,
	`notes` text,
	`storage_pool_asset_id` integer,
	`storage_type` text,
	`updated_at` integer NOT NULL,
	`updated_by` integer,
	`used_gb` integer,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`storage_pool_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_asset_storage_allocations_asset_id` ON `asset_storage_allocations` (`asset_id`);--> statement-breakpoint
CREATE INDEX `idx_asset_storage_allocations_storage_pool_asset_id` ON `asset_storage_allocations` (`storage_pool_asset_id`);--> statement-breakpoint
CREATE TABLE `asset_relationships` (
	`confidence` text DEFAULT 'confirmed' NOT NULL,
	`created_at` integer NOT NULL,
	`created_by` integer,
	`deleted_at` integer,
	`deleted_by` integer,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`notes` text,
	`relationship_type` text NOT NULL,
	`source_asset_id` integer NOT NULL,
	`target_asset_id` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` integer,
	`workspace_id` integer,
	FOREIGN KEY (`source_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_asset_relationships_source_asset_id` ON `asset_relationships` (`source_asset_id`);--> statement-breakpoint
CREATE INDEX `idx_asset_relationships_target_asset_id` ON `asset_relationships` (`target_asset_id`);--> statement-breakpoint
CREATE INDEX `idx_asset_relationships_relationship_type` ON `asset_relationships` (`relationship_type`);--> statement-breakpoint
CREATE INDEX `idx_asset_relationships_is_deleted` ON `asset_relationships` (`is_deleted`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_asset_relationships_unique_active` ON `asset_relationships` (`source_asset_id`,`target_asset_id`,`relationship_type`) WHERE "asset_relationships"."is_deleted" = 0;--> statement-breakpoint
CREATE TABLE `asset_aliases` (
	`alias_type` text DEFAULT 'other' NOT NULL,
	`asset_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`created_by` integer,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`notes` text,
	`updated_at` integer NOT NULL,
	`updated_by` integer,
	`value` text NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_asset_aliases_asset_id` ON `asset_aliases` (`asset_id`);--> statement-breakpoint
CREATE INDEX `idx_asset_aliases_value` ON `asset_aliases` (`value`);--> statement-breakpoint
CREATE INDEX `idx_asset_aliases_alias_type` ON `asset_aliases` (`alias_type`);--> statement-breakpoint
CREATE TABLE `asset_tags` (
	`asset_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`created_by` integer,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`label` text NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_asset_tags_asset_id` ON `asset_tags` (`asset_id`);--> statement-breakpoint
CREATE INDEX `idx_asset_tags_label` ON `asset_tags` (`label`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_asset_tags_asset_id_label` ON `asset_tags` (`asset_id`,`label`);--> statement-breakpoint
CREATE TABLE `assets` (
	`asset_tag` text,
	`asset_type` text NOT NULL,
	`business_owner_id` integer,
	`created_at` integer NOT NULL,
	`created_by` integer,
	`criticality` text DEFAULT 'unknown' NOT NULL,
	`decommissioned_at` integer,
	`deleted_at` integer,
	`deleted_by` integer,
	`description` text,
	`documentation_url` text,
	`fqdn` text,
	`hostname` text,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`is_virtual` integer DEFAULT false NOT NULL,
	`last_verified_at` integer,
	`management_url` text,
	`name` text NOT NULL,
	`network_zone_id` integer,
	`notes` text,
	`operating_system` text,
	`os_version` text,
	`parent_host_id` integer,
	`planned_replacement_at` integer,
	`platform` text,
	`primary_ip` text,
	`purchase_date` integer,
	`role` text,
	`serial_number` text,
	`site_id` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`support_contact` text,
	`support_ends_at` integer,
	`technical_owner_id` integer,
	`updated_at` integer NOT NULL,
	`updated_by` integer,
	`vendor_id` integer,
	`warranty_expires_at` integer,
	`workspace_id` integer,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`network_zone_id`) REFERENCES `network_zones`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`business_owner_id`) REFERENCES `owners`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`technical_owner_id`) REFERENCES `owners`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`parent_host_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_assets_asset_type` ON `assets` (`asset_type`);--> statement-breakpoint
CREATE INDEX `idx_assets_status` ON `assets` (`status`);--> statement-breakpoint
CREATE INDEX `idx_assets_criticality` ON `assets` (`criticality`);--> statement-breakpoint
CREATE INDEX `idx_assets_site_id` ON `assets` (`site_id`);--> statement-breakpoint
CREATE INDEX `idx_assets_parent_host_id` ON `assets` (`parent_host_id`);--> statement-breakpoint
CREATE INDEX `idx_assets_workspace_id` ON `assets` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `idx_assets_hostname` ON `assets` (`hostname`);--> statement-breakpoint
CREATE INDEX `idx_assets_name` ON `assets` (`name`);--> statement-breakpoint
CREATE INDEX `idx_assets_is_deleted` ON `assets` (`is_deleted`);--> statement-breakpoint
CREATE TABLE `asset_ports` (
	`asset_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`created_by` integer,
	`exposure_level` text DEFAULT 'unknown' NOT NULL,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`notes` text,
	`port_number` integer NOT NULL,
	`protocol` text DEFAULT 'tcp' NOT NULL,
	`review_state` text DEFAULT 'expected' NOT NULL,
	`scope` text,
	`service_id` integer,
	`service_name` text,
	`source` text DEFAULT 'documented' NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` integer,
	`verified_at` integer,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `service_catalog`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_asset_ports_asset_id` ON `asset_ports` (`asset_id`);--> statement-breakpoint
CREATE INDEX `idx_asset_ports_service_id` ON `asset_ports` (`service_id`);--> statement-breakpoint
CREATE INDEX `idx_asset_ports_port_number` ON `asset_ports` (`port_number`);--> statement-breakpoint
CREATE INDEX `idx_asset_ports_review_state` ON `asset_ports` (`review_state`);--> statement-breakpoint
CREATE TABLE `asset_services` (
	`asset_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`created_by` integer,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`notes` text,
	`role` text,
	`service_id` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` integer,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `service_catalog`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_asset_services_asset_id` ON `asset_services` (`asset_id`);--> statement-breakpoint
CREATE INDEX `idx_asset_services_service_id` ON `asset_services` (`service_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_asset_services_asset_id_service_id` ON `asset_services` (`asset_id`,`service_id`);--> statement-breakpoint
CREATE TABLE `network_zones` (
	`cidr` text,
	`created_at` integer NOT NULL,
	`created_by` integer,
	`deleted_at` integer,
	`deleted_by` integer,
	`description` text,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`name` text NOT NULL,
	`notes` text,
	`site_id` integer,
	`trust_level` text,
	`updated_at` integer NOT NULL,
	`updated_by` integer,
	`vlan_id` integer,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_network_zones_site_id` ON `network_zones` (`site_id`);--> statement-breakpoint
CREATE INDEX `idx_network_zones_is_deleted` ON `network_zones` (`is_deleted`);--> statement-breakpoint
CREATE TABLE `owners` (
	`created_at` integer NOT NULL,
	`created_by` integer,
	`deleted_at` integer,
	`deleted_by` integer,
	`email` text,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`kind` text DEFAULT 'person' NOT NULL,
	`name` text NOT NULL,
	`notes` text,
	`phone` text,
	`updated_at` integer NOT NULL,
	`updated_by` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_owners_is_deleted` ON `owners` (`is_deleted`);--> statement-breakpoint
CREATE INDEX `idx_owners_name` ON `owners` (`name`);--> statement-breakpoint
CREATE TABLE `service_catalog` (
	`category` text,
	`created_at` integer NOT NULL,
	`created_by` integer,
	`criticality` text DEFAULT 'unknown' NOT NULL,
	`deleted_at` integer,
	`deleted_by` integer,
	`description` text,
	`expected_availability` text,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`name` text NOT NULL,
	`notes` text,
	`owner_id` integer,
	`updated_at` integer NOT NULL,
	`updated_by` integer,
	`vendor_id` integer,
	`workspace_id` integer,
	FOREIGN KEY (`owner_id`) REFERENCES `owners`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_service_catalog_name` ON `service_catalog` (`name`);--> statement-breakpoint
CREATE INDEX `idx_service_catalog_category` ON `service_catalog` (`category`);--> statement-breakpoint
CREATE INDEX `idx_service_catalog_workspace_id` ON `service_catalog` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `idx_service_catalog_is_deleted` ON `service_catalog` (`is_deleted`);--> statement-breakpoint
CREATE TABLE `service_dependencies` (
	`created_at` integer NOT NULL,
	`created_by` integer,
	`dependency_type` text,
	`depends_on_asset_id` integer,
	`depends_on_service_id` integer,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`notes` text,
	`service_id` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` integer,
	FOREIGN KEY (`service_id`) REFERENCES `service_catalog`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`depends_on_service_id`) REFERENCES `service_catalog`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`depends_on_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_service_dependencies_service_id` ON `service_dependencies` (`service_id`);--> statement-breakpoint
CREATE INDEX `idx_service_dependencies_depends_on_service_id` ON `service_dependencies` (`depends_on_service_id`);--> statement-breakpoint
CREATE INDEX `idx_service_dependencies_depends_on_asset_id` ON `service_dependencies` (`depends_on_asset_id`);--> statement-breakpoint
CREATE TABLE `sites` (
	`address` text,
	`code` text,
	`created_at` integer NOT NULL,
	`created_by` integer,
	`deleted_at` integer,
	`deleted_by` integer,
	`description` text,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`name` text NOT NULL,
	`notes` text,
	`updated_at` integer NOT NULL,
	`updated_by` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_sites_is_deleted` ON `sites` (`is_deleted`);--> statement-breakpoint
CREATE INDEX `idx_sites_name` ON `sites` (`name`);--> statement-breakpoint
CREATE TABLE `vendors` (
	`created_at` integer NOT NULL,
	`created_by` integer,
	`deleted_at` integer,
	`deleted_by` integer,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`name` text NOT NULL,
	`notes` text,
	`support_contact` text,
	`support_email` text,
	`support_phone` text,
	`updated_at` integer NOT NULL,
	`updated_by` integer,
	`website` text,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_vendors_is_deleted` ON `vendors` (`is_deleted`);--> statement-breakpoint
CREATE INDEX `idx_vendors_name` ON `vendors` (`name`);