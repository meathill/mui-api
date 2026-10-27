-- 回填模型对外元数据，数据来自 models.dev（第一方 provider 条目优先）。
-- 由 packages/app/scripts/fetch-model-metadata.ts 生成，不要手改；
-- 要更新请重跑脚本并 review diff。
--
-- 只回填 display_name / context_length / max_output_tokens / metadata_json 四列，
-- 定价一律不动——models.dev 上的 cost 是别家的价格，我们的价格以本表为准。
-- claude-fable-5 ← anthropic/claude-fable-5
UPDATE models SET display_name = 'Claude Fable 5', context_length = 1000000, max_output_tokens = 128000, metadata_json = '{"description":"Claude model for creative writing, analysis, and controlled agent workflows","family":"claude-fable","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"releaseDate":"2026-06-07","lastUpdated":"2026-06-09","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'claude-fable-5';

-- claude-fable-5-1 ← anthropic/claude-fable-5-1
UPDATE models SET display_name = 'Claude Fable 5.1', context_length = 1000000, max_output_tokens = 128000, metadata_json = '{"description":"Claude model for demanding reasoning and long-horizon agentic work","family":"claude-fable","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"knowledge":"2026-06","releaseDate":"2026-09-01","lastUpdated":"2026-09-01","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'claude-fable-5-1';

-- claude-fable-5.1 ← anthropic/claude-fable-5-1
UPDATE models SET display_name = 'Claude Fable 5.1', context_length = 1000000, max_output_tokens = 128000, metadata_json = '{"description":"Claude model for demanding reasoning and long-horizon agentic work","family":"claude-fable","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"knowledge":"2026-06","releaseDate":"2026-09-01","lastUpdated":"2026-09-01","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'claude-fable-5.1';

-- claude-haiku-4-5 ← anthropic/claude-haiku-4-5
UPDATE models SET display_name = 'Claude Haiku 4.5 (latest)', context_length = 200000, max_output_tokens = 64000, metadata_json = '{"description":"Fast Claude lane for lightweight agents, office tasks, and responsive chat","family":"claude-haiku","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2025-02-28","releaseDate":"2025-10-15","lastUpdated":"2025-10-15","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'claude-haiku-4-5';

-- claude-haiku-5-5 ← anthropic/claude-haiku-5-5
UPDATE models SET display_name = 'Claude Haiku 5.5', context_length = 1000000, max_output_tokens = 128000, metadata_json = '{"description":"Fast Claude model for responsive assistance, classification, and lightweight agents","family":"claude-haiku","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"knowledge":"2026-06","releaseDate":"2026-10-07","lastUpdated":"2026-10-07","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'claude-haiku-5-5';

-- claude-haiku-5.5 ← anthropic/claude-haiku-5-5
UPDATE models SET display_name = 'Claude Haiku 5.5', context_length = 1000000, max_output_tokens = 128000, metadata_json = '{"description":"Fast Claude model for responsive assistance, classification, and lightweight agents","family":"claude-haiku","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"knowledge":"2026-06","releaseDate":"2026-10-07","lastUpdated":"2026-10-07","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'claude-haiku-5.5';

-- claude-opus-4-6 ← anthropic/claude-opus-4-6
UPDATE models SET display_name = 'Claude Opus 4.6', context_length = 1000000, max_output_tokens = 128000, metadata_json = '{"description":"High-end Claude for difficult coding, planning, and slower expert reasoning","family":"claude-opus","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2025-05-31","releaseDate":"2026-02-04","lastUpdated":"2026-03-13","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'claude-opus-4-6';

-- claude-opus-4-7 ← anthropic/claude-opus-4-7
UPDATE models SET display_name = 'Claude Opus 4.7', context_length = 1000000, max_output_tokens = 128000, metadata_json = '{"description":"Stronger Opus tier for advanced software work and high-stakes reasoning","family":"claude-opus","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"knowledge":"2026-01-31","releaseDate":"2026-04-14","lastUpdated":"2026-04-16","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'claude-opus-4-7';

-- claude-opus-4-8 ← anthropic/claude-opus-4-8
UPDATE models SET display_name = 'Claude Opus 4.8', context_length = 1000000, max_output_tokens = 128000, metadata_json = '{"description":"Top Claude Opus tier for the hardest reasoning, coding, and long-horizon agents","family":"claude-opus","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"knowledge":"2026-01","releaseDate":"2026-05-28","lastUpdated":"2026-05-28","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'claude-opus-4-8';

-- claude-opus-5 ← anthropic/claude-opus-5
UPDATE models SET display_name = 'Claude Opus 5', context_length = 1000000, max_output_tokens = 128000, metadata_json = '{"description":"Strongest Claude Opus model for coding, agents, and professional work","family":"claude-opus","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"knowledge":"2026-05","releaseDate":"2026-07-24","lastUpdated":"2026-07-24","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'claude-opus-5';

-- claude-opus-5-5 ← anthropic/claude-opus-5-5
UPDATE models SET display_name = 'Claude Opus 5.5', context_length = 1000000, max_output_tokens = 128000, metadata_json = '{"description":"Claude model for long-running agentic coding and knowledge work","family":"claude-opus","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"knowledge":"2026-06","releaseDate":"2026-09-22","lastUpdated":"2026-09-22","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'claude-opus-5-5';

-- claude-opus-5.5 ← anthropic/claude-opus-5-5
UPDATE models SET display_name = 'Claude Opus 5.5', context_length = 1000000, max_output_tokens = 128000, metadata_json = '{"description":"Claude model for long-running agentic coding and knowledge work","family":"claude-opus","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"knowledge":"2026-06","releaseDate":"2026-09-22","lastUpdated":"2026-09-22","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'claude-opus-5.5';

-- claude-sonnet-4-6 ← anthropic/claude-sonnet-4-6
UPDATE models SET display_name = 'Claude Sonnet 4.6', context_length = 1000000, max_output_tokens = 128000, metadata_json = '{"description":"Claude workhorse for coding agents, careful analysis, and production cost control","family":"claude-sonnet","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2025-08-31","releaseDate":"2026-02-17","lastUpdated":"2026-03-13","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'claude-sonnet-4-6';

-- claude-sonnet-5 ← anthropic/claude-sonnet-5
UPDATE models SET display_name = 'Claude Sonnet 5', context_length = 1000000, max_output_tokens = 128000, metadata_json = '{"description":"Everyday Claude agent model for coding, planning, browsing, and general work","family":"claude-sonnet","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"knowledge":"2026-01-31","releaseDate":"2026-06-29","lastUpdated":"2026-06-30","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'claude-sonnet-5';

-- claude-sonnet-5-5 ← anthropic/claude-sonnet-5-5
UPDATE models SET display_name = 'Claude Sonnet 5.5', context_length = 1000000, max_output_tokens = 128000, metadata_json = '{"description":"Fast Claude model for everyday coding, agents, and knowledge work","family":"claude-sonnet","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"knowledge":"2026-06","releaseDate":"2026-09-28","lastUpdated":"2026-09-28","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'claude-sonnet-5-5';

-- claude-sonnet-5.5 ← anthropic/claude-sonnet-5-5
UPDATE models SET display_name = 'Claude Sonnet 5.5', context_length = 1000000, max_output_tokens = 128000, metadata_json = '{"description":"Fast Claude model for everyday coding, agents, and knowledge work","family":"claude-sonnet","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"knowledge":"2026-06","releaseDate":"2026-09-28","lastUpdated":"2026-09-28","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'claude-sonnet-5.5';

-- deepseek-v4-1-flash ← neon/deepseek-v4-1-flash
UPDATE models SET display_name = 'DeepSeek V4.1 Flash', context_length = 1000000, max_output_tokens = 384000, metadata_json = '{"description":"DeepSeek V4.1 Flash model for reasoning and agentic coding","family":"deepseek-flash","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":true,"knowledge":"2025-05","releaseDate":"2026-09-10","lastUpdated":"2026-09-10","modalities":{"input":["text","image"],"output":["text"]}}' WHERE id = 'deepseek-v4-1-flash';

-- deepseek-v4-1-flash-1017 ← cloudflare-workers-ai/@cf/deepseek-ai/deepseek-v4.1-flash-1017
UPDATE models SET display_name = 'Deepseek V4.1 Flash 1017', context_length = 1048576, max_output_tokens = 1048576, metadata_json = '{"description":"Fast DeepSeek model for efficient chat, coding help, and agent loops","family":"deepseek","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":true,"releaseDate":"2026-10-17","lastUpdated":"2026-10-17","modalities":{"input":["text","image"],"output":["text"]}}' WHERE id = 'deepseek-v4-1-flash-1017';

-- deepseek-v4-flash ← deepseek/deepseek-v4-flash
UPDATE models SET display_name = 'DeepSeek V4 Flash', context_length = 1048576, max_output_tokens = 393216, metadata_json = '{"description":"October 17 update of DeepSeek V4.1 Flash with improved reasoning, coding, agentic tasks, and visual understanding","family":"deepseek-flash","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":true,"knowledge":"2025-05","releaseDate":"2026-10-17","lastUpdated":"2026-10-17","modalities":{"input":["text","image"],"output":["text"]}}' WHERE id = 'deepseek-v4-flash';

-- deepseek-v4-flash-vision-exp ← deepseek/deepseek-v4-flash-vision-exp
UPDATE models SET display_name = 'DeepSeek V4 Flash Vision Exp', context_length = 1048576, max_output_tokens = 393216, metadata_json = '{"description":"October 17 update of DeepSeek V4.1 Flash with improved reasoning, coding, agentic tasks, and visual understanding","family":"deepseek-flash","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":true,"knowledge":"2025-05","releaseDate":"2026-10-17","lastUpdated":"2026-10-17","modalities":{"input":["text","image"],"output":["text"]}}' WHERE id = 'deepseek-v4-flash-vision-exp';

-- deepseek-v4-pro ← deepseek/deepseek-v4-pro
UPDATE models SET display_name = 'DeepSeek V4 Pro', context_length = 1048576, max_output_tokens = 393216, metadata_json = '{"description":"DeepSeek V4 Pro snapshot with million-token context and support for thinking and non-thinking modes","family":"deepseek-thinking","attachment":false,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":true,"releaseDate":"2026-08-13","lastUpdated":"2026-08-22","modalities":{"input":["text"],"output":["text"]}}' WHERE id = 'deepseek-v4-pro';

-- deepseek-v4.1-flash ← scaleway/deepseek-v4.1-flash
UPDATE models SET display_name = 'DeepSeek V4.1 Flash', context_length = 256000, max_output_tokens = 32768, metadata_json = '{"description":"DeepSeek V4.1 Flash model for reasoning and agentic coding","family":"deepseek-flash","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":true,"knowledge":"2025-05","releaseDate":"2026-09-10","lastUpdated":"2026-09-10","modalities":{"input":["text","image"],"output":["text"]}}' WHERE id = 'deepseek-v4.1-flash';

-- deepseek-v4.1-flash-1017 ← cloudflare-workers-ai/@cf/deepseek-ai/deepseek-v4.1-flash-1017
UPDATE models SET display_name = 'Deepseek V4.1 Flash 1017', context_length = 1048576, max_output_tokens = 1048576, metadata_json = '{"description":"Fast DeepSeek model for efficient chat, coding help, and agent loops","family":"deepseek","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":true,"releaseDate":"2026-10-17","lastUpdated":"2026-10-17","modalities":{"input":["text","image"],"output":["text"]}}' WHERE id = 'deepseek-v4.1-flash-1017';

-- gemini-2.5-flash ← google/gemini-2.5-flash
UPDATE models SET display_name = 'Gemini 2.5 Flash', context_length = 1048576, max_output_tokens = 65536, metadata_json = '{"description":"Fast Gemini workhorse for multimodal apps where latency and price matter","family":"gemini-flash","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2025-01","releaseDate":"2025-06-17","lastUpdated":"2025-06-17","modalities":{"input":["text","image","audio","video","pdf"],"output":["text"]}}' WHERE id = 'gemini-2.5-flash';

-- gemini-2.5-flash-lite ← google/gemini-2.5-flash-lite
UPDATE models SET display_name = 'Gemini 2.5 Flash-Lite', context_length = 1048576, max_output_tokens = 65536, metadata_json = '{"description":"Lean Gemini 2.5 lane for cheap multimodal traffic and quick agents","family":"gemini-flash-lite","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2025-01","releaseDate":"2025-06-17","lastUpdated":"2025-06-17","modalities":{"input":["text","image","audio","video","pdf"],"output":["text"]}}' WHERE id = 'gemini-2.5-flash-lite';

-- gemini-2.5-pro ← google/gemini-2.5-pro
UPDATE models SET display_name = 'Gemini 2.5 Pro', context_length = 1048576, max_output_tokens = 65536, metadata_json = '{"description":"Google''s proven reasoning model for coding, math, and multimodal analysis","family":"gemini-pro","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2025-01","releaseDate":"2025-06-17","lastUpdated":"2025-06-17","modalities":{"input":["text","image","audio","video","pdf"],"output":["text"]}}' WHERE id = 'gemini-2.5-pro';

-- gemini-3-1-flash-lite ← google/gemini-3.1-flash-lite
UPDATE models SET display_name = 'Gemini 3.1 Flash Lite', context_length = 1048576, max_output_tokens = 65536, metadata_json = '{"description":"Low-latency Gemini model for high-volume multimodal and agent workloads","family":"gemini-flash-lite","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2025-01","releaseDate":"2026-05-07","lastUpdated":"2026-05-07","modalities":{"input":["text","image","video","audio","pdf"],"output":["text"]}}' WHERE id = 'gemini-3-1-flash-lite';

-- gemini-3-1-pro-preview ← google/gemini-3.1-pro-preview
UPDATE models SET display_name = 'Gemini 3.1 Pro Preview', context_length = 1048576, max_output_tokens = 65536, metadata_json = '{"description":"Reasoning-first Gemini preview for agentic coding and complex problem solving","family":"gemini-pro","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2025-01","releaseDate":"2026-02-19","lastUpdated":"2026-02-19","modalities":{"input":["text","image","video","audio","pdf"],"output":["text"]}}' WHERE id = 'gemini-3-1-pro-preview';

-- gemini-3-5-flash-lite ← google/gemini-3.5-flash-lite
UPDATE models SET display_name = 'Gemini 3.5 Flash Lite', context_length = 1048576, max_output_tokens = 65536, metadata_json = '{"description":"Fast Gemini model balancing multimodal reasoning, tool use, and cost","family":"gemini-flash-lite","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2026-03","releaseDate":"2026-07-21","lastUpdated":"2026-07-21","modalities":{"input":["text","image","video","audio","pdf"],"output":["text"]}}' WHERE id = 'gemini-3-5-flash-lite';

-- gemini-3-6-flash ← google/gemini-3.6-flash
UPDATE models SET display_name = 'Gemini 3.6 Flash', context_length = 1048576, max_output_tokens = 65536, metadata_json = '{"description":"Fast Gemini model balancing multimodal reasoning, tool use, and cost","family":"gemini-flash","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2026-03","releaseDate":"2026-07-21","lastUpdated":"2026-07-21","modalities":{"input":["text","image","video","audio","pdf"],"output":["text"]}}' WHERE id = 'gemini-3-6-flash';

-- gemini-3-8-flash ← google/gemini-3.8-flash
UPDATE models SET display_name = 'Gemini 3.8 Flash', context_length = 1048576, max_output_tokens = 65536, metadata_json = '{"description":"Google''s most intelligent Flash model, engineered for long-horizon software engineering, autonomous agents, and complex enterprise workflows","family":"gemini-flash","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"releaseDate":"2026-09-02","lastUpdated":"2026-09-02","modalities":{"input":["text","image","video","audio","pdf"],"output":["text"]}}' WHERE id = 'gemini-3-8-flash';

-- gemini-3-flash ← google/gemini-3-flash-preview
UPDATE models SET display_name = 'Gemini 3 Flash Preview', context_length = 1048576, max_output_tokens = 65536, metadata_json = '{"description":"New Gemini flash lane bringing frontier-style multimodal reasoning to cheaper runs","family":"gemini-flash","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2025-01","releaseDate":"2025-12-17","lastUpdated":"2025-12-17","modalities":{"input":["text","image","video","audio","pdf"],"output":["text"]}}' WHERE id = 'gemini-3-flash';

-- gemini-3.1-flash-lite ← google/gemini-3.1-flash-lite
UPDATE models SET display_name = 'Gemini 3.1 Flash Lite', context_length = 1048576, max_output_tokens = 65536, metadata_json = '{"description":"Low-latency Gemini model for high-volume multimodal and agent workloads","family":"gemini-flash-lite","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2025-01","releaseDate":"2026-05-07","lastUpdated":"2026-05-07","modalities":{"input":["text","image","video","audio","pdf"],"output":["text"]}}' WHERE id = 'gemini-3.1-flash-lite';

-- gemini-3.1-flash-lite-preview ← google/gemini-3.1-flash-lite-preview
UPDATE models SET display_name = 'Gemini 3.1 Flash Lite Preview', context_length = 1048576, max_output_tokens = 65536, metadata_json = '{"description":"Legacy model retained for compatibility with older integrations","family":"gemini-flash-lite","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2025-01","releaseDate":"2026-03-03","lastUpdated":"2026-03-03","modalities":{"input":["text","image","video","audio","pdf"],"output":["text"]}}' WHERE id = 'gemini-3.1-flash-lite-preview';

-- gemini-3.1-pro-preview ← google/gemini-3.1-pro-preview
UPDATE models SET display_name = 'Gemini 3.1 Pro Preview', context_length = 1048576, max_output_tokens = 65536, metadata_json = '{"description":"Reasoning-first Gemini preview for agentic coding and complex problem solving","family":"gemini-pro","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2025-01","releaseDate":"2026-02-19","lastUpdated":"2026-02-19","modalities":{"input":["text","image","video","audio","pdf"],"output":["text"]}}' WHERE id = 'gemini-3.1-pro-preview';

-- gemini-3.5-flash ← google/gemini-3.5-flash
UPDATE models SET display_name = 'Gemini 3.5 Flash', context_length = 1048576, max_output_tokens = 65536, metadata_json = '{"description":"Fast Gemini model balancing multimodal reasoning, tool use, and cost","family":"gemini-flash","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2025-01","releaseDate":"2026-05-19","lastUpdated":"2026-05-19","modalities":{"input":["text","image","video","audio","pdf"],"output":["text"]}}' WHERE id = 'gemini-3.5-flash';

-- gemini-3.5-flash-lite ← google/gemini-3.5-flash-lite
UPDATE models SET display_name = 'Gemini 3.5 Flash Lite', context_length = 1048576, max_output_tokens = 65536, metadata_json = '{"description":"Fast Gemini model balancing multimodal reasoning, tool use, and cost","family":"gemini-flash-lite","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2026-03","releaseDate":"2026-07-21","lastUpdated":"2026-07-21","modalities":{"input":["text","image","video","audio","pdf"],"output":["text"]}}' WHERE id = 'gemini-3.5-flash-lite';

-- gemini-3.6-flash ← google/gemini-3.6-flash
UPDATE models SET display_name = 'Gemini 3.6 Flash', context_length = 1048576, max_output_tokens = 65536, metadata_json = '{"description":"Fast Gemini model balancing multimodal reasoning, tool use, and cost","family":"gemini-flash","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2026-03","releaseDate":"2026-07-21","lastUpdated":"2026-07-21","modalities":{"input":["text","image","video","audio","pdf"],"output":["text"]}}' WHERE id = 'gemini-3.6-flash';

-- gemini-3.8-flash ← google/gemini-3.8-flash
UPDATE models SET display_name = 'Gemini 3.8 Flash', context_length = 1048576, max_output_tokens = 65536, metadata_json = '{"description":"Google''s most intelligent Flash model, engineered for long-horizon software engineering, autonomous agents, and complex enterprise workflows","family":"gemini-flash","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"releaseDate":"2026-09-02","lastUpdated":"2026-09-02","modalities":{"input":["text","image","video","audio","pdf"],"output":["text"]}}' WHERE id = 'gemini-3.8-flash';

-- gemini-4-argon ← google/gemini-4-argon
UPDATE models SET display_name = 'Gemini 4 Argon', context_length = 1048576, max_output_tokens = 32768, metadata_json = '{"description":"Google''s flagship reasoning model for complex software engineering, deep math and science, and long-horizon autonomous agents","family":"gemini","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2026-03","releaseDate":"2026-10-13","lastUpdated":"2026-10-13","modalities":{"input":["text","image","video","audio","pdf"],"output":["text"]}}' WHERE id = 'gemini-4-argon';

-- glm-4.7-flash ← zhipuai/glm-4.7-flash
UPDATE models SET display_name = 'GLM-4.7-Flash', context_length = 200000, max_output_tokens = 131072, metadata_json = '{"description":"Budget GLM lane for fast coding help, routing, and everyday automation","family":"glm-flash","attachment":false,"reasoning":true,"toolCall":true,"temperature":true,"openWeights":true,"knowledge":"2025-04","releaseDate":"2026-01-19","lastUpdated":"2026-01-19","modalities":{"input":["text"],"output":["text"]}}' WHERE id = 'glm-4.7-flash';

-- glm-5.1 ← zhipuai/glm-5.1
UPDATE models SET display_name = 'GLM-5.1', context_length = 200000, max_output_tokens = 131072, metadata_json = '{"description":"Strong GLM coding model for agentic engineering, terminals, and repository generation","family":"glm","attachment":false,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":true,"releaseDate":"2026-04-07","lastUpdated":"2026-04-07","modalities":{"input":["text"],"output":["text"]}}' WHERE id = 'glm-5.1';

-- glm-5.2 ← zhipuai/glm-5.2
UPDATE models SET display_name = 'GLM-5.2', context_length = 1000000, max_output_tokens = 131072, metadata_json = '{"description":"Open flagship GLM for long-horizon coding agents and million-token context work","family":"glm","attachment":false,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":true,"releaseDate":"2026-06-13","lastUpdated":"2026-06-13","modalities":{"input":["text"],"output":["text"]}}' WHERE id = 'glm-5.2';

-- glm-5.3 ← zhipuai/glm-5.3
UPDATE models SET display_name = 'GLM-5.3', context_length = 1000000, max_output_tokens = 131072, metadata_json = '{"description":"Flagship GLM model for long-horizon coding, agents, and complex project delivery","family":"glm","attachment":false,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":true,"releaseDate":"2026-08-14","lastUpdated":"2026-08-14","modalities":{"input":["text"],"output":["text"]}}' WHERE id = 'glm-5.3';

-- glm-5.3-flash ← zhipuai/glm-5.3-flash
UPDATE models SET display_name = 'GLM-5.3-Flash', context_length = 1000000, max_output_tokens = 131072, metadata_json = '{"description":"Native multimodal GLM model for efficient coding and long-horizon agent tasks","family":"glm-flash","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":true,"releaseDate":"2026-08-26","lastUpdated":"2026-08-26","modalities":{"input":["text","image","video","pdf"],"output":["text"]}}' WHERE id = 'glm-5.3-flash';

-- gpt-4.1 ← openai/gpt-4.1
UPDATE models SET display_name = 'GPT-4.1', context_length = 1047576, max_output_tokens = 32768, metadata_json = '{"description":"Long-lived GPT workhorse for coding, instruction following, and production apps","family":"gpt","attachment":true,"reasoning":false,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2024-04","releaseDate":"2025-04-14","lastUpdated":"2025-04-14","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'gpt-4.1';

-- gpt-4o ← openai/gpt-4o
UPDATE models SET display_name = 'GPT-4o', context_length = 128000, max_output_tokens = 16384, metadata_json = '{"description":"Omni-era GPT for multimodal chat, practical coding, and general assistants","family":"gpt","attachment":true,"reasoning":false,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2023-09","releaseDate":"2024-05-13","lastUpdated":"2024-08-06","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'gpt-4o';

-- gpt-4o-mini ← openai/gpt-4o-mini
UPDATE models SET display_name = 'GPT-4o mini', context_length = 128000, max_output_tokens = 16384, metadata_json = '{"description":"Small omni GPT for cheap multimodal assistance and production-scale traffic","family":"gpt-mini","attachment":true,"reasoning":false,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2023-09","releaseDate":"2024-07-18","lastUpdated":"2024-07-18","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'gpt-4o-mini';

-- gpt-5 ← openai/gpt-5
UPDATE models SET display_name = 'GPT-5', context_length = 400000, max_output_tokens = 128000, metadata_json = '{"description":"Original GPT-5 workhorse for reasoning, coding, writing, and tool workflows","family":"gpt","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"knowledge":"2024-09-30","releaseDate":"2025-08-07","lastUpdated":"2025-08-07","modalities":{"input":["text","image"],"output":["text"]}}' WHERE id = 'gpt-5';

-- gpt-5-mini ← openai/gpt-5-mini
UPDATE models SET display_name = 'GPT-5 Mini', context_length = 400000, max_output_tokens = 128000, metadata_json = '{"description":"Small GPT-5 for responsive agents, coding help, and everyday automation","family":"gpt-mini","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"knowledge":"2024-05-30","releaseDate":"2025-08-07","lastUpdated":"2025-08-07","modalities":{"input":["text","image"],"output":["text"]}}' WHERE id = 'gpt-5-mini';

-- gpt-5-nano ← openai/gpt-5-nano
UPDATE models SET display_name = 'GPT-5 Nano', context_length = 400000, max_output_tokens = 128000, metadata_json = '{"description":"Tiny GPT-5 lane for routing, extraction, classification, and bulk jobs","family":"gpt-nano","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"knowledge":"2024-05-30","releaseDate":"2025-08-07","lastUpdated":"2025-08-07","modalities":{"input":["text","image"],"output":["text"]}}' WHERE id = 'gpt-5-nano';

-- gpt-5.4 ← openai/gpt-5.4
UPDATE models SET display_name = 'GPT-5.4', context_length = 1050000, max_output_tokens = 128000, metadata_json = '{"description":"Agent-ready GPT for coding and computer-use workflows at a lower cost","family":"gpt","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2025-08-31","releaseDate":"2026-03-05","lastUpdated":"2026-03-05","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'gpt-5.4';

-- gpt-5.5 ← openai/gpt-5.5
UPDATE models SET display_name = 'GPT-5.5', context_length = 1050000, max_output_tokens = 128000, metadata_json = '{"description":"Default frontier GPT for coding, computer use, research, and knowledge work","family":"gpt","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"knowledge":"2025-12-01","releaseDate":"2026-04-23","lastUpdated":"2026-04-23","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'gpt-5.5';

-- gpt-5.6 ← openai/gpt-5.6
UPDATE models SET display_name = 'GPT-5.6', context_length = 1050000, max_output_tokens = 128000, metadata_json = '{"description":"Frontier GPT-5.6 model for complex professional work, coding, and agentic workflows","family":"gpt-sol","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"knowledge":"2026-02-16","releaseDate":"2026-07-09","lastUpdated":"2026-07-09","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'gpt-5.6';

-- gpt-5.6-luna ← openai/gpt-5.6-luna
UPDATE models SET display_name = 'GPT-5.6 Luna', context_length = 1050000, max_output_tokens = 128000, metadata_json = '{"description":"Cost-efficient GPT-5.6 model for fast, high-volume workloads","family":"gpt-luna","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"knowledge":"2026-02-16","releaseDate":"2026-07-09","lastUpdated":"2026-07-09","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'gpt-5.6-luna';

-- gpt-5.6-sol ← openai/gpt-5.6-sol
UPDATE models SET display_name = 'GPT-5.6 Sol', context_length = 1050000, max_output_tokens = 128000, metadata_json = '{"description":"Frontier GPT-5.6 model for complex professional work, coding, and agentic workflows","family":"gpt-sol","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"knowledge":"2026-02-16","releaseDate":"2026-07-09","lastUpdated":"2026-07-09","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'gpt-5.6-sol';

-- gpt-5.6-terra ← openai/gpt-5.6-terra
UPDATE models SET display_name = 'GPT-5.6 Terra', context_length = 1050000, max_output_tokens = 128000, metadata_json = '{"description":"Balanced GPT-5.6 model for capable, cost-efficient everyday work","family":"gpt-terra","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"knowledge":"2026-02-16","releaseDate":"2026-07-09","lastUpdated":"2026-07-09","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'gpt-5.6-terra';

-- gpt-6 ← openai/gpt-6-sol
UPDATE models SET display_name = 'GPT-6 Sol', context_length = 1050000, max_output_tokens = 128000, metadata_json = '{"description":"OpenAI model for complex coding and agentic workflows","family":"gpt-sol","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"knowledge":"2026-04-20","releaseDate":"2026-09-22","lastUpdated":"2026-09-22","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'gpt-6';

-- gpt-6-1-sol ← openai/gpt-6.1-sol
UPDATE models SET display_name = 'GPT-6.1 Sol', context_length = 1050000, max_output_tokens = 128000, metadata_json = '{"description":"Near-Astra performance for complex coding, computer use, and professional work at a lower cost.","family":"gpt-sol","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"knowledge":"2026-04-30","releaseDate":"2026-09-29","lastUpdated":"2026-09-29","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'gpt-6-1-sol';

-- gpt-6-1-terra ← openai/gpt-6.1-terra
UPDATE models SET display_name = 'GPT-6.1 Terra', context_length = 1050000, max_output_tokens = 128000, metadata_json = '{"description":"Fast, efficient model for visual reasoning, precise computer use, and clear, natural writing.","family":"gpt-terra","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"knowledge":"2026-06-01","releaseDate":"2026-10-26","lastUpdated":"2026-10-26","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'gpt-6-1-terra';

-- gpt-6-astra ← openai/gpt-6-astra
UPDATE models SET display_name = 'GPT-6 Astra', context_length = 1050000, max_output_tokens = 128000, metadata_json = '{"description":"GPT-6 Astra is OpenAI''s most capable model for complex reasoning, coding, computer use, research, and document creation.","family":"gpt-astra","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"knowledge":"2026-04-30","releaseDate":"2026-09-04","lastUpdated":"2026-09-04","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'gpt-6-astra';

-- gpt-6-luna ← openai/gpt-6-luna
UPDATE models SET display_name = 'GPT-6 Luna', context_length = 1050000, max_output_tokens = 128000, metadata_json = '{"description":"OpenAI''s most efficient model for focused, high-volume tasks","family":"gpt-luna","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"knowledge":"2026-05-18","releaseDate":"2026-09-22","lastUpdated":"2026-09-22","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'gpt-6-luna';

-- gpt-6-sol ← openai/gpt-6-sol
UPDATE models SET display_name = 'GPT-6 Sol', context_length = 1050000, max_output_tokens = 128000, metadata_json = '{"description":"OpenAI model for complex coding and agentic workflows","family":"gpt-sol","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"knowledge":"2026-04-20","releaseDate":"2026-09-22","lastUpdated":"2026-09-22","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'gpt-6-sol';

-- gpt-6.1 ← openai/gpt-6.1-sol
UPDATE models SET display_name = 'GPT-6.1 Sol', context_length = 1050000, max_output_tokens = 128000, metadata_json = '{"description":"Near-Astra performance for complex coding, computer use, and professional work at a lower cost.","family":"gpt-sol","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"knowledge":"2026-04-30","releaseDate":"2026-09-29","lastUpdated":"2026-09-29","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'gpt-6.1';

-- gpt-6.1-sol ← openai/gpt-6.1-sol
UPDATE models SET display_name = 'GPT-6.1 Sol', context_length = 1050000, max_output_tokens = 128000, metadata_json = '{"description":"Near-Astra performance for complex coding, computer use, and professional work at a lower cost.","family":"gpt-sol","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"knowledge":"2026-04-30","releaseDate":"2026-09-29","lastUpdated":"2026-09-29","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'gpt-6.1-sol';

-- gpt-6.1-terra ← openai/gpt-6.1-terra
UPDATE models SET display_name = 'GPT-6.1 Terra', context_length = 1050000, max_output_tokens = 128000, metadata_json = '{"description":"Fast, efficient model for visual reasoning, precise computer use, and clear, natural writing.","family":"gpt-terra","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"knowledge":"2026-06-01","releaseDate":"2026-10-26","lastUpdated":"2026-10-26","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'gpt-6.1-terra';

-- gpt-image-2 ← openai/gpt-image-2
UPDATE models SET display_name = 'gpt-image-2', context_length = 0, max_output_tokens = 0, metadata_json = '{"description":"Image model for prompt-driven generation, editing, and visual design workflows","family":"gpt-image","attachment":true,"reasoning":false,"toolCall":false,"temperature":false,"openWeights":false,"releaseDate":"2026-04-21","lastUpdated":"2026-04-21","modalities":{"input":["text","image"],"output":["image"]}}' WHERE id = 'gpt-image-2';

-- grok-4 ← google-vertex/xai/grok-4.6
UPDATE models SET display_name = 'Grok 4.6', context_length = 524288, max_output_tokens = 500000, metadata_json = '{"description":"xAI''s frontier model for long-running agents, coding, knowledge work, and visual projects","family":"grok","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2026-02-01","releaseDate":"2026-08-12","lastUpdated":"2026-08-12","modalities":{"input":["text","image"],"output":["text"]}}' WHERE id = 'grok-4';

-- grok-4.3 ← google-vertex/xai/grok-4.3
UPDATE models SET display_name = 'Grok 4.3', context_length = 200000, max_output_tokens = 30000, metadata_json = '{"description":"xAI''s default Grok for chat, coding, agentic tools, and lower hallucination risk","family":"grok","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"releaseDate":"2026-04-17","lastUpdated":"2026-04-17","modalities":{"input":["text","image"],"output":["text"]}}' WHERE id = 'grok-4.3';

-- grok-4.5 ← xai/grok-4.5
UPDATE models SET display_name = 'Grok 4.5', context_length = 500000, max_output_tokens = 500000, metadata_json = '{"description":"xAI''s Grok model for chat, coding, agentic tools, and lower hallucination risk","family":"grok","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"releaseDate":"2026-07-08","lastUpdated":"2026-07-08","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'grok-4.5';

-- grok-4.6 ← google-vertex/xai/grok-4.6
UPDATE models SET display_name = 'Grok 4.6', context_length = 524288, max_output_tokens = 500000, metadata_json = '{"description":"xAI''s frontier model for long-running agents, coding, knowledge work, and visual projects","family":"grok","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2026-02-01","releaseDate":"2026-08-12","lastUpdated":"2026-08-12","modalities":{"input":["text","image"],"output":["text"]}}' WHERE id = 'grok-4.6';

-- grok-build-0.1 ← xai/grok-build-0.1
UPDATE models SET display_name = 'Grok Build 0.1', context_length = 256000, max_output_tokens = 256000, metadata_json = '{"description":"Fast Grok coding model tuned for agentic engineering and iterative edits","family":"grok-build","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"releaseDate":"2026-04-16","lastUpdated":"2026-04-16","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'grok-build-0.1';

-- grok-imagine-image ← xai/grok-imagine-image
UPDATE models SET display_name = 'Grok Imagine Image', context_length = 16000, max_output_tokens = 0, metadata_json = '{"description":"Image model for prompt-driven generation, editing, and visual design workflows","family":"grok","attachment":true,"reasoning":false,"toolCall":false,"temperature":false,"openWeights":false,"releaseDate":"2026-01-28","lastUpdated":"2026-01-28","modalities":{"input":["text","image"],"output":["image"]}}' WHERE id = 'grok-imagine-image';

-- grok-imagine-image-quality ← xai/grok-imagine-image-quality
UPDATE models SET display_name = 'Grok Imagine Image Quality', context_length = 16000, max_output_tokens = 0, metadata_json = '{"description":"Higher-fidelity Grok Imagine image model for prompt-driven generation, editing, and visual design workflows","family":"grok","attachment":true,"reasoning":false,"toolCall":false,"temperature":false,"openWeights":false,"releaseDate":"2026-04-03","lastUpdated":"2026-04-03","modalities":{"input":["text","image"],"output":["image"]}}' WHERE id = 'grok-imagine-image-quality';

-- grok-imagine-video ← xai/grok-imagine-video
UPDATE models SET display_name = 'Grok Imagine Video', context_length = 1024, max_output_tokens = 0, metadata_json = '{"description":"Image model for prompt-driven generation, editing, and visual design workflows","family":"grok","attachment":true,"reasoning":false,"toolCall":false,"temperature":false,"openWeights":false,"releaseDate":"2026-01-28","lastUpdated":"2026-01-28","modalities":{"input":["text","image","video"],"output":["video"]}}' WHERE id = 'grok-imagine-video';

-- grok-imagine-video-1.5 ← xai/grok-imagine-video-1.5
UPDATE models SET display_name = 'Grok Imagine Video 1.5', context_length = 1024, max_output_tokens = 0, metadata_json = '{"description":"Video model for text-to-video, image-to-video, and reference-to-video generation with optional voice references","family":"grok","attachment":true,"reasoning":false,"toolCall":false,"temperature":false,"openWeights":false,"releaseDate":"2026-05-30","lastUpdated":"2026-05-30","modalities":{"input":["text","image","audio"],"output":["video"]}}' WHERE id = 'grok-imagine-video-1.5';

-- hy3 ← openrouter/tencent/hy3
UPDATE models SET display_name = 'Hy3', context_length = 262144, max_output_tokens = 128000, metadata_json = '{"description":"Tencent Hy reasoning model for coding, instruction following, and agent tasks","family":"Hy","attachment":false,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":true,"releaseDate":"2026-07-06","lastUpdated":"2026-07-06","modalities":{"input":["text"],"output":["text"]}}' WHERE id = 'hy3';

-- kimi-k2.6 ← moonshotai/kimi-k2.6
UPDATE models SET display_name = 'Kimi K2.6', context_length = 262144, max_output_tokens = 262144, metadata_json = '{"description":"Multimodal Kimi workhorse for agent loops, coding tasks, and visual context","family":"kimi-k2","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":true,"knowledge":"2025-01","releaseDate":"2026-04-20","lastUpdated":"2026-04-20","modalities":{"input":["text","image","video"],"output":["text"]}}' WHERE id = 'kimi-k2.6';

-- kimi-k2.7-code ← moonshotai/kimi-k2.7-code
UPDATE models SET display_name = 'Kimi K2.7 Code', context_length = 262144, max_output_tokens = 262144, metadata_json = '{"description":"Coding-focused Kimi model, stronger on long-horizon repo work with less overthinking","family":"kimi-k2","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":true,"knowledge":"2025-01","releaseDate":"2026-06-12","lastUpdated":"2026-06-12","modalities":{"input":["text","image","video"],"output":["text"]}}' WHERE id = 'kimi-k2.7-code';

-- kimi-k3 ← moonshotai/kimi-k3
UPDATE models SET display_name = 'Kimi K3', context_length = 1048576, max_output_tokens = 1048576, metadata_json = '{"description":"Multimodal Kimi model with 1M context and toggleable max-effort thinking for long-horizon agent work","family":"kimi-k3","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":true,"releaseDate":"2026-07-16","lastUpdated":"2026-07-16","modalities":{"input":["text","image","video"],"output":["text"]}}' WHERE id = 'kimi-k3';

-- kimi-k3-1-pro ← moonshotai/kimi-k3.1-pro
UPDATE models SET display_name = 'Kimi K3.1 Pro', context_length = 1048576, max_output_tokens = 1048576, metadata_json = '{"description":"Multimodal Kimi model with 1M context and always-on reasoning for coding, 3D creation, financial research, and agentic work","family":"kimi-k3","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"releaseDate":"2026-10-23","lastUpdated":"2026-10-23","modalities":{"input":["text","image","video"],"output":["text"]}}' WHERE id = 'kimi-k3-1-pro';

-- kimi-k3-1-pro-highspeed ← moonshotai/kimi-k3.1-pro-highspeed
UPDATE models SET display_name = 'Kimi K3.1 Pro Highspeed', context_length = 1048576, max_output_tokens = 1048576, metadata_json = '{"description":"Multimodal Kimi model with 1M context and always-on reasoning for coding, 3D creation, financial research, and agentic work","family":"kimi-k3","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"releaseDate":"2026-10-23","lastUpdated":"2026-10-23","modalities":{"input":["text","image","video"],"output":["text"]}}' WHERE id = 'kimi-k3-1-pro-highspeed';

-- kimi-k3.1-pro ← moonshotai/kimi-k3.1-pro
UPDATE models SET display_name = 'Kimi K3.1 Pro', context_length = 1048576, max_output_tokens = 1048576, metadata_json = '{"description":"Multimodal Kimi model with 1M context and always-on reasoning for coding, 3D creation, financial research, and agentic work","family":"kimi-k3","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"releaseDate":"2026-10-23","lastUpdated":"2026-10-23","modalities":{"input":["text","image","video"],"output":["text"]}}' WHERE id = 'kimi-k3.1-pro';

-- kimi-k3.1-pro-highspeed ← moonshotai/kimi-k3.1-pro-highspeed
UPDATE models SET display_name = 'Kimi K3.1 Pro Highspeed', context_length = 1048576, max_output_tokens = 1048576, metadata_json = '{"description":"Multimodal Kimi model with 1M context and always-on reasoning for coding, 3D creation, financial research, and agentic work","family":"kimi-k3","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"releaseDate":"2026-10-23","lastUpdated":"2026-10-23","modalities":{"input":["text","image","video"],"output":["text"]}}' WHERE id = 'kimi-k3.1-pro-highspeed';

-- longcat-2.0 ← openrouter/meituan/longcat-2.0
UPDATE models SET display_name = 'LongCat-2.0', context_length = 1048756, max_output_tokens = 262144, metadata_json = '{"description":"Reasoning model for deliberate analysis, multi-step problem solving, and tool use","family":"longcat","attachment":false,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":false,"openWeights":true,"releaseDate":"2026-06-30","lastUpdated":"2026-06-30","modalities":{"input":["text"],"output":["text"]}}' WHERE id = 'longcat-2.0';

-- mimo-v2-omni ← 人工录入
UPDATE models SET display_name = 'MiMo-V2-Omni', context_length = 262144, max_output_tokens = 8192, metadata_json = '{"description":"Xiaomi MiMo 2 Omni multimodal foundation model supporting audio, image, and text","family":"mimo-v2","attachment":true,"reasoning":false,"toolCall":true,"openWeights":false,"releaseDate":"2026-04-20","lastUpdated":"2026-04-20","modalities":{"input":["text","image","audio"],"output":["text"]}}' WHERE id = 'mimo-v2-omni';

-- mimo-v2-pro ← abacus/mimo-v2-pro
UPDATE models SET display_name = 'MiMo-V2-Pro', context_length = 1048576, max_output_tokens = 131072, metadata_json = '{"description":"Earlier MiMo Pro model for multimodal agents, reasoning, and code tasks","family":"mimo","attachment":false,"reasoning":true,"toolCall":true,"temperature":true,"openWeights":false,"knowledge":"2024-12","releaseDate":"2026-03-18","lastUpdated":"2026-03-18","modalities":{"input":["text"],"output":["text"]}}' WHERE id = 'mimo-v2-pro';

-- mimo-v2-tts ← 人工录入
UPDATE models SET display_name = 'MiMo-V2-TTS', context_length = 8192, max_output_tokens = 8192, metadata_json = '{"description":"Xiaomi MiMo 2 TTS voice synthesis model","family":"mimo-v2","attachment":false,"reasoning":false,"toolCall":false,"openWeights":false,"releaseDate":"2026-04-20","lastUpdated":"2026-04-20","modalities":{"input":["text"],"output":["audio"]}}' WHERE id = 'mimo-v2-tts';

-- mimo-v2.5 ← xiaomi/mimo-v2.5
UPDATE models SET display_name = 'MiMo-V2.5', context_length = 1048576, max_output_tokens = 131072, metadata_json = '{"description":"Open MiMo model for multimodal coding agents and long-context automation","family":"mimo","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"openWeights":true,"knowledge":"2024-12","releaseDate":"2026-04-22","lastUpdated":"2026-04-22","modalities":{"input":["text","image","audio","video"],"output":["text"]}}' WHERE id = 'mimo-v2.5';

-- mimo-v2.5-flash ← 人工录入
UPDATE models SET display_name = 'MiMo-V2.5-Flash', context_length = 262144, max_output_tokens = 8192, metadata_json = '{"description":"Xiaomi MiMo 2.5 Flash lightweight high-speed model with 256K context","family":"mimo-v2.5","attachment":true,"reasoning":false,"toolCall":true,"openWeights":false,"releaseDate":"2026-05-15","lastUpdated":"2026-05-15","modalities":{"input":["text","image"],"output":["text"]}}' WHERE id = 'mimo-v2.5-flash';

-- mimo-v2.5-pro ← xiaomi/mimo-v2.5-pro
UPDATE models SET display_name = 'MiMo-V2.5-Pro', context_length = 1048576, max_output_tokens = 131072, metadata_json = '{"description":"Stronger MiMo Pro tier for multimodal reasoning and coding-agent execution","family":"mimo","attachment":false,"reasoning":true,"toolCall":true,"temperature":true,"openWeights":true,"knowledge":"2024-12","releaseDate":"2026-04-22","lastUpdated":"2026-04-22","modalities":{"input":["text"],"output":["text"]}}' WHERE id = 'mimo-v2.5-pro';

-- mimo-v2.5-tts ← xiaomi-token-plan-sgp/mimo-v2.5-tts
UPDATE models SET display_name = 'MiMo-V2.5-TTS', context_length = 8192, max_output_tokens = 8192, metadata_json = '{"description":"Speech generation model for controllable voice, narration, and audio delivery","family":"mimo","attachment":false,"reasoning":false,"toolCall":false,"temperature":false,"openWeights":false,"releaseDate":"2026-04-22","lastUpdated":"2026-04-22","modalities":{"input":["text"],"output":["audio"]}}' WHERE id = 'mimo-v2.5-tts';

-- mimo-v2.5-tts-voiceclone ← xiaomi-token-plan-sgp/mimo-v2.5-tts-voiceclone
UPDATE models SET display_name = 'MiMo-V2.5-TTS-VoiceClone', context_length = 8192, max_output_tokens = 8192, metadata_json = '{"description":"Speech generation model for controllable voice, narration, and audio delivery","family":"mimo","attachment":false,"reasoning":false,"toolCall":false,"temperature":false,"openWeights":false,"releaseDate":"2026-04-22","lastUpdated":"2026-04-22","modalities":{"input":["text"],"output":["audio"]}}' WHERE id = 'mimo-v2.5-tts-voiceclone';

-- mimo-v2.5-tts-voicedesign ← xiaomi-token-plan-sgp/mimo-v2.5-tts-voicedesign
UPDATE models SET display_name = 'MiMo-V2.5-TTS-VoiceDesign', context_length = 8192, max_output_tokens = 8192, metadata_json = '{"description":"Speech generation model for controllable voice, narration, and audio delivery","family":"mimo","attachment":false,"reasoning":false,"toolCall":false,"temperature":false,"openWeights":false,"releaseDate":"2026-04-22","lastUpdated":"2026-04-22","modalities":{"input":["text"],"output":["audio"]}}' WHERE id = 'mimo-v2.5-tts-voicedesign';

-- mimo-v2.6-flash ← xiaomi/mimo-v2.6-flash
UPDATE models SET display_name = 'MiMo-V2.6-Flash', context_length = 1048576, max_output_tokens = 131072, metadata_json = '{"description":"MiMo Flash model for multimodal coding agents and long-context automation","family":"mimo","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":true,"releaseDate":"2026-09-22","lastUpdated":"2026-09-22","modalities":{"input":["text","image","audio","video"],"output":["text"]}}' WHERE id = 'mimo-v2.6-flash';

-- mimo-v2.6-pro ← xiaomi/mimo-v2.6-pro
UPDATE models SET display_name = 'MiMo-V2.6-Pro', context_length = 1048576, max_output_tokens = 131072, metadata_json = '{"description":"MiMo Pro model for multimodal coding agents and long-context automation","family":"mimo","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":true,"releaseDate":"2026-09-22","lastUpdated":"2026-09-22","modalities":{"input":["text","image","audio","video"],"output":["text"]}}' WHERE id = 'mimo-v2.6-pro';

-- mimo-v2.6-pro-ultraspeed ← xiaomi/mimo-v2.6-pro-ultraspeed
UPDATE models SET display_name = 'MiMo-V2.6-Pro-UltraSpeed', context_length = 1048576, max_output_tokens = 131072, metadata_json = '{"description":"MiMo pro model for strong multimodal reasoning and agent execution","family":"mimo","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":true,"releaseDate":"2026-09-21","lastUpdated":"2026-09-21","modalities":{"input":["text","image","audio","video"],"output":["text"]}}' WHERE id = 'mimo-v2.6-pro-ultraspeed';

-- mimo-v2.6-ultraspeed ← xiaomi/mimo-v2.6-pro-ultraspeed
UPDATE models SET display_name = 'MiMo-V2.6-Pro-UltraSpeed', context_length = 1048576, max_output_tokens = 131072, metadata_json = '{"description":"MiMo pro model for strong multimodal reasoning and agent execution","family":"mimo","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":true,"releaseDate":"2026-09-21","lastUpdated":"2026-09-21","modalities":{"input":["text","image","audio","video"],"output":["text"]}}' WHERE id = 'mimo-v2.6-ultraspeed';

-- minimax-m2.5 ← openrouter/minimax/minimax-m2.5
UPDATE models SET display_name = 'MiniMax-M2.5', context_length = 204800, max_output_tokens = 131072, metadata_json = '{"description":"Prior MiniMax coding model for agent workflows, office edits, and automation","family":"minimax","attachment":false,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":true,"releaseDate":"2026-02-12","lastUpdated":"2026-02-12","modalities":{"input":["text"],"output":["text"]}}' WHERE id = 'minimax-m2.5';

-- minimax-m2.7 ← openrouter/minimax/minimax-m2.7
UPDATE models SET display_name = 'MiniMax-M2.7', context_length = 204800, max_output_tokens = 131072, metadata_json = '{"description":"Open MiniMax flagship for coding agents, office automation, and complex environments","family":"minimax","attachment":false,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":false,"openWeights":true,"releaseDate":"2026-03-18","lastUpdated":"2026-03-18","modalities":{"input":["text"],"output":["text"]}}' WHERE id = 'minimax-m2.7';

-- minimax-m3 ← openrouter/minimax/minimax-m3
UPDATE models SET display_name = 'MiniMax-M3', context_length = 1048576, max_output_tokens = 512000, metadata_json = '{"description":"MiniMax multimodal model for long-context coding, perception, and agent planning","family":"minimax","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":true,"releaseDate":"2026-06-01","lastUpdated":"2026-06-01","modalities":{"input":["text","image","video"],"output":["text"]}}' WHERE id = 'minimax-m3';

-- muse-spark-1.2-contributor ← openrouter/meta/muse-spark-1.2-contributor
UPDATE models SET display_name = 'Muse Spark 1.2 Contributor', context_length = 1048576, max_output_tokens = 943718, metadata_json = '{"description":"Open Llama multimodal model for image understanding and text reasoning","family":"muse","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"releaseDate":"2026-08-21","lastUpdated":"2026-08-21","modalities":{"input":["text","image","video","pdf"],"output":["text"]}}' WHERE id = 'muse-spark-1.2-contributor';

-- muse-spark-1.3 ← cloudflare-ai-gateway/meta/muse-spark-1.3
UPDATE models SET display_name = 'Muse Spark 1.3', context_length = 1048576, max_output_tokens = 131072, metadata_json = '{"description":"Muse Spark 1.3 is a multimodal reasoning model from Meta for long-running agentic, multi-agent, and coding workflows. It improves long-horizon agent collaboration, instruction following, and coding efficiency relative to Muse Spark 1.2.","family":"muse","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":false,"openWeights":false,"releaseDate":"2026-09-02","lastUpdated":"2026-09-02","modalities":{"input":["text","image","video","pdf","audio"],"output":["text"]}}' WHERE id = 'muse-spark-1.3';

-- qwen3-30b ← cloudflare-workers-ai/@cf/qwen/qwen3-30b-a3b-fp8
UPDATE models SET display_name = 'Qwen3 30B A3b fp8', context_length = 32768, max_output_tokens = 32768, metadata_json = '{"description":"Qwen instruction model for multilingual chat, reasoning, and tool use","family":"qwen","attachment":false,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":false,"openWeights":true,"releaseDate":"2025-04-28","lastUpdated":"2025-04-28","modalities":{"input":["text"],"output":["text"]}}' WHERE id = 'qwen3-30b';

-- qwen3.6-plus ← alibaba/qwen3.6-plus
UPDATE models SET display_name = 'Qwen3.6 Plus', context_length = 1000000, max_output_tokens = 65536, metadata_json = '{"description":"Earlier Qwen multimodal workhorse for million-token agent and document tasks","family":"qwen","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2025-04","releaseDate":"2026-04-02","lastUpdated":"2026-04-02","modalities":{"input":["text","image","video"],"output":["text"]}}' WHERE id = 'qwen3.6-plus';

-- qwen3.7-max ← alibaba/qwen3.7-max
UPDATE models SET display_name = 'Qwen3.7 Max', context_length = 1000000, max_output_tokens = 131072, metadata_json = '{"description":"Qwen frontier model tuned for agent frameworks, coding assistants, and long tasks","family":"qwen","attachment":false,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"releaseDate":"2026-05-21","lastUpdated":"2026-05-21","modalities":{"input":["text"],"output":["text"]}}' WHERE id = 'qwen3.7-max';

-- qwen3.7-plus ← alibaba/qwen3.7-plus
UPDATE models SET display_name = 'Qwen3.7 Plus', context_length = 1000000, max_output_tokens = 131072, metadata_json = '{"description":"Multimodal Qwen workhorse for long-context agents, visual inputs, and coding","family":"qwen","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2025-04","releaseDate":"2026-06-02","lastUpdated":"2026-06-04","modalities":{"input":["text","image","video"],"output":["text"]}}' WHERE id = 'qwen3.7-plus';

-- qwen3.8-max ← alibaba/qwen3.8-max
UPDATE models SET display_name = 'Qwen3.8 Max', context_length = 1000000, max_output_tokens = 131072, metadata_json = '{"description":"2.4-trillion-parameter MoE flagship for coding, professional work, multimodal understanding, and long-horizon agentic workflows","family":"qwen","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"releaseDate":"2026-08-03","lastUpdated":"2026-08-03","modalities":{"input":["text","image","video","pdf"],"output":["text"]}}' WHERE id = 'qwen3.8-max';
