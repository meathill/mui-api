CREATE TABLE IF NOT EXISTS `rate_limit` (
  `id` text PRIMARY KEY NOT NULL,
  `key` text NOT NULL,
  `count` integer NOT NULL,
  `last_request` integer NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS `rate_limit_key_unique` ON `rate_limit` (`key`);
