CREATE TABLE `video_generation_jobs` (
  `request_id` text PRIMARY KEY NOT NULL,
  `reservation_id` text NOT NULL,
  `user_id` text NOT NULL,
  `api_key_id` text,
  `model_id` text NOT NULL,
  `duration` integer NOT NULL,
  `resolution` text NOT NULL,
  `estimated_cost` real NOT NULL,
  `markup_rate` real NOT NULL,
  `rate_multiplier` real NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `actual_cost` real,
  `settled_cost` real,
  `billed_at` integer,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
CREATE UNIQUE INDEX `video_generation_jobs_reservation_id_unique` ON `video_generation_jobs` (`reservation_id`);

INSERT OR REPLACE INTO models (
  id, provider, upstream_model_id, input_price, output_price, markup_rate,
  cached_input_price, cache_write_price, long_context_threshold_tokens,
  long_context_input_price, long_context_cached_input_price,
  long_context_cache_write_price, long_context_output_price
) VALUES
  ('grok-imagine-video', 'grok', 'grok-imagine-video', 0, 1, 1.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('grok-imagine-video-1.5', 'grok', 'grok-imagine-video-1.5', 0, 1, 1.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
