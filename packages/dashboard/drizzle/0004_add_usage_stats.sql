-- 用量统计聚合表
CREATE TABLE `usage_stats` (
  `id` text PRIMARY KEY NOT NULL,
  `granularity` text NOT NULL,
  `period_start` integer NOT NULL,
  `period_end` integer NOT NULL,
  `user_id` text,
  `model_id` text,
  `total_cost` real DEFAULT 0,
  `total_input_tokens` integer DEFAULT 0,
  `total_output_tokens` integer DEFAULT 0,
  `request_count` integer DEFAULT 0,
  `created_at` integer DEFAULT (unixepoch()),
  `updated_at` integer DEFAULT (unixepoch())
);

-- 唯一索引：防止同一时间窗口+维度重复聚合
CREATE UNIQUE INDEX `idx_usage_stats_unique` ON `usage_stats` (`granularity`, `period_start`, `user_id`, `model_id`);

-- 查询索引：支持按粒度和时间范围查询
CREATE INDEX `idx_usage_stats_query` ON `usage_stats` (`granularity`, `period_start`, `period_end`);
