CREATE TABLE `spending_limits` (
	`user_id` text PRIMARY KEY NOT NULL,
	`monthly_limit` real,
	`alert_threshold` real DEFAULT 0.8,
	`is_suspended` integer DEFAULT false,
	`last_alert_at` integer,
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
