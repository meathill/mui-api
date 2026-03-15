-- App 业务表
-- 用户体系统一使用 better-auth 的 user 表，此处只创建业务表
-- 外键引用 user 表（由 0000 migration 创建）

CREATE TABLE IF NOT EXISTS `wallets` (
	`user_id` text PRIMARY KEY NOT NULL,
	`balance` real DEFAULT 0,
	`currency` text DEFAULT 'USD',
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`key_prefix` text NOT NULL,
	`key_hash` text NOT NULL,
	`name` text,
	`is_active` integer DEFAULT true,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `api_keys_key_hash_unique` ON `api_keys` (`key_hash`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `claim_tokens` (
	`token` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`temp_raw_key` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used` integer DEFAULT false
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `models` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`upstream_model_id` text,
	`input_price` real,
	`output_price` real,
	`markup_rate` real DEFAULT 1.2
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `usage_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`api_key_id` text,
	`model_id` text,
	`input_tokens` integer,
	`output_tokens` integer,
	`cost` real,
	`created_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `spending_limits` (
	`user_id` text PRIMARY KEY NOT NULL,
	`monthly_limit` real,
	`alert_threshold` real DEFAULT 0.8,
	`is_suspended` integer DEFAULT false,
	`last_alert_at` integer,
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
