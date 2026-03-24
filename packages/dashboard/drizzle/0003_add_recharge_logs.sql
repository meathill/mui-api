CREATE TABLE `recharge_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`operator_id` text,
	`amount` real NOT NULL,
	`balance_after` real,
	`note` text,
	`created_at` integer DEFAULT (unixepoch())
);
