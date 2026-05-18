-- 计费系统升级：cache 分档 + 长上下文档位
--
-- models 表：补充 cache 单价和长上下文档位的完整价格表
--   - cached_input_price / cache_write_price：cache 命中（读）/ cache 写入（anthropic 专属）单价
--   - long_context_*：当 input + cached + cache_write 之和 > long_context_threshold_tokens 时启用
--   全部 nullable；null 视为未启用对应特性、回退到基础 input_price
--
-- usage_logs 表：记录 cache token 拆分和本次请求采用的档位
--   - cached_input_tokens / cache_write_tokens：分别记录两类 cache token 用量
--   - tier：本次请求落入的档位（standard / long_context），便于后续分析
--
-- usage_stats 表：聚合维度同步扩展
--   - total_cached_input_tokens / total_cache_write_tokens：cache token 累计
--   - long_context_request_count：触发长上下文档位的请求数

ALTER TABLE models ADD COLUMN cached_input_price REAL;
ALTER TABLE models ADD COLUMN cache_write_price REAL;
ALTER TABLE models ADD COLUMN long_context_threshold_tokens INTEGER;
ALTER TABLE models ADD COLUMN long_context_input_price REAL;
ALTER TABLE models ADD COLUMN long_context_cached_input_price REAL;
ALTER TABLE models ADD COLUMN long_context_cache_write_price REAL;
ALTER TABLE models ADD COLUMN long_context_output_price REAL;

ALTER TABLE usage_logs ADD COLUMN cached_input_tokens INTEGER DEFAULT 0;
ALTER TABLE usage_logs ADD COLUMN cache_write_tokens INTEGER DEFAULT 0;
ALTER TABLE usage_logs ADD COLUMN tier TEXT DEFAULT 'standard';

ALTER TABLE usage_stats ADD COLUMN total_cached_input_tokens INTEGER DEFAULT 0;
ALTER TABLE usage_stats ADD COLUMN total_cache_write_tokens INTEGER DEFAULT 0;
ALTER TABLE usage_stats ADD COLUMN long_context_request_count INTEGER DEFAULT 0;
