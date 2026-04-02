ALTER TABLE `recharge_logs` ADD COLUMN `source` text DEFAULT 'admin';
--> statement-breakpoint
ALTER TABLE `recharge_logs` ADD COLUMN `source_id` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `recharge_logs_source_source_id_unique` ON `recharge_logs` (`source`, `source_id`);
--> statement-breakpoint
CREATE TABLE `stripe_topup_sessions` (
  `checkout_session_id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `amount` real NOT NULL,
  `currency` text NOT NULL DEFAULT 'USD',
  `status` text NOT NULL DEFAULT 'created',
  `payment_status` text,
  `stripe_customer_id` text,
  `payment_intent_id` text,
  `balance_after` real,
  `last_error` text,
  `created_at` integer DEFAULT (unixepoch()),
  `updated_at` integer DEFAULT (unixepoch()),
  `completed_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_stripe_topup_sessions_user_created_at` ON `stripe_topup_sessions` (`user_id`, `created_at`);
