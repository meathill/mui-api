-- App 共享表：这些表由 packages/app 的 migration 首次创建，
-- 此处使用 IF NOT EXISTS 确保 dashboard 本地开发时也能正确初始化。
-- 线上环境这些表已存在，IF NOT EXISTS 会安全跳过。

CREATE TABLE IF NOT EXISTS `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`stripe_customer_id` text,
	`created_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `users_email_unique` ON `users` (`email`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `wallets` (
	`user_id` text PRIMARY KEY NOT NULL,
	`balance` real DEFAULT 0,
	`currency` text DEFAULT 'USD',
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
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
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
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
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
