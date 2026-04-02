PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `wallets__new` (
  `user_id` text PRIMARY KEY NOT NULL,
  `balance` real DEFAULT 0,
  `currency` text DEFAULT 'USD',
  `updated_at` integer DEFAULT (unixepoch()),
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `wallets__new` (`user_id`, `balance`, `currency`, `updated_at`)
SELECT `user_id`, `balance`, `currency`, `updated_at`
FROM `wallets`;
--> statement-breakpoint
DROP TABLE `wallets`;
--> statement-breakpoint
ALTER TABLE `wallets__new` RENAME TO `wallets`;
--> statement-breakpoint
CREATE TABLE `spending_limits__new` (
  `user_id` text PRIMARY KEY NOT NULL,
  `monthly_limit` real,
  `alert_threshold` real DEFAULT 0.8,
  `is_suspended` integer DEFAULT false,
  `last_alert_at` integer,
  `updated_at` integer DEFAULT (unixepoch()),
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `spending_limits__new` (
  `user_id`,
  `monthly_limit`,
  `alert_threshold`,
  `is_suspended`,
  `last_alert_at`,
  `updated_at`
)
SELECT
  `user_id`,
  `monthly_limit`,
  `alert_threshold`,
  `is_suspended`,
  `last_alert_at`,
  `updated_at`
FROM `spending_limits`;
--> statement-breakpoint
DROP TABLE `spending_limits`;
--> statement-breakpoint
ALTER TABLE `spending_limits__new` RENAME TO `spending_limits`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
