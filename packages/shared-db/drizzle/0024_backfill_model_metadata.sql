-- 回填模型对外元数据，数据来自 models.dev（第一方 provider 条目优先）。
-- 由 packages/app/scripts/fetch-model-metadata.ts 生成，不要手改；
-- 要更新请重跑脚本并 review diff。
--
-- 只回填 display_name / context_length / max_output_tokens / metadata_json 四列，
-- 定价一律不动——models.dev 上的 cost 是别家的价格，我们的价格以本表为准。
-- claude-fable-5 ← anthropic/claude-fable-5
UPDATE models SET display_name = 'Claude Fable 5', context_length = 1000000, max_output_tokens = 128000, metadata_json = '{"description":"Claude model for creative writing, analysis, and controlled agent workflows","family":"claude-fable","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"releaseDate":"2026-06-07","lastUpdated":"2026-06-09","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'claude-fable-5';

-- claude-haiku-4-5 ← anthropic/claude-haiku-4-5
UPDATE models SET display_name = 'Claude Haiku 4.5 (latest)', context_length = 200000, max_output_tokens = 64000, metadata_json = '{"description":"Fast Claude lane for lightweight agents, office tasks, and responsive chat","family":"claude-haiku","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2025-02-28","releaseDate":"2025-10-15","lastUpdated":"2025-10-15","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'claude-haiku-4-5';

-- claude-opus-4-6 ← anthropic/claude-opus-4-6
UPDATE models SET display_name = 'Claude Opus 4.6', context_length = 1000000, max_output_tokens = 128000, metadata_json = '{"description":"High-end Claude for difficult coding, planning, and slower expert reasoning","family":"claude-opus","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2025-05-31","releaseDate":"2026-02-04","lastUpdated":"2026-03-13","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'claude-opus-4-6';

-- claude-opus-4-7 ← anthropic/claude-opus-4-7
UPDATE models SET display_name = 'Claude Opus 4.7', context_length = 1000000, max_output_tokens = 128000, metadata_json = '{"description":"Stronger Opus tier for advanced software work and high-stakes reasoning","family":"claude-opus","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"knowledge":"2026-01-31","releaseDate":"2026-04-14","lastUpdated":"2026-04-16","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'claude-opus-4-7';

-- claude-opus-4-8 ← anthropic/claude-opus-4-8
UPDATE models SET display_name = 'Claude Opus 4.8', context_length = 1000000, max_output_tokens = 128000, metadata_json = '{"description":"Top Claude Opus tier for the hardest reasoning, coding, and long-horizon agents","family":"claude-opus","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"knowledge":"2026-01","releaseDate":"2026-05-28","lastUpdated":"2026-05-28","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'claude-opus-4-8';

-- claude-opus-5 ← anthropic/claude-opus-5
UPDATE models SET display_name = 'Claude Opus 5', context_length = 1000000, max_output_tokens = 128000, metadata_json = '{"description":"Strongest Claude Opus model for coding, agents, and professional work","family":"claude-opus","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"knowledge":"2026-05","releaseDate":"2026-07-24","lastUpdated":"2026-07-24","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'claude-opus-5';

-- claude-sonnet-4-6 ← anthropic/claude-sonnet-4-6
UPDATE models SET display_name = 'Claude Sonnet 4.6', context_length = 1000000, max_output_tokens = 128000, metadata_json = '{"description":"Claude workhorse for coding agents, careful analysis, and production cost control","family":"claude-sonnet","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2025-08-31","releaseDate":"2026-02-17","lastUpdated":"2026-03-13","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'claude-sonnet-4-6';

-- claude-sonnet-5 ← anthropic/claude-sonnet-5
UPDATE models SET display_name = 'Claude Sonnet 5', context_length = 1000000, max_output_tokens = 128000, metadata_json = '{"description":"Everyday Claude agent model for coding, planning, browsing, and general work","family":"claude-sonnet","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"knowledge":"2026-01-31","releaseDate":"2026-06-29","lastUpdated":"2026-06-30","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'claude-sonnet-5';

-- gemini-2.5-flash ← google/gemini-2.5-flash
UPDATE models SET display_name = 'Gemini 2.5 Flash', context_length = 1048576, max_output_tokens = 65536, metadata_json = '{"description":"Fast Gemini workhorse for multimodal apps where latency and price matter","family":"gemini-flash","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2025-01","releaseDate":"2025-06-17","lastUpdated":"2025-06-17","modalities":{"input":["text","image","audio","video","pdf"],"output":["text"]}}' WHERE id = 'gemini-2.5-flash';

-- gemini-2.5-flash-lite ← google/gemini-2.5-flash-lite
UPDATE models SET display_name = 'Gemini 2.5 Flash-Lite', context_length = 1048576, max_output_tokens = 65536, metadata_json = '{"description":"Lean Gemini 2.5 lane for cheap multimodal traffic and quick agents","family":"gemini-flash-lite","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2025-01","releaseDate":"2025-06-17","lastUpdated":"2025-06-17","modalities":{"input":["text","image","audio","video","pdf"],"output":["text"]}}' WHERE id = 'gemini-2.5-flash-lite';

-- gemini-2.5-pro ← google/gemini-2.5-pro
UPDATE models SET display_name = 'Gemini 2.5 Pro', context_length = 1048576, max_output_tokens = 65536, metadata_json = '{"description":"Google''s proven reasoning model for coding, math, and multimodal analysis","family":"gemini-pro","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2025-01","releaseDate":"2025-06-17","lastUpdated":"2025-06-17","modalities":{"input":["text","image","audio","video","pdf"],"output":["text"]}}' WHERE id = 'gemini-2.5-pro';

-- gemini-3-flash ← google/gemini-3-flash-preview
UPDATE models SET display_name = 'Gemini 3 Flash Preview', context_length = 1048576, max_output_tokens = 65536, metadata_json = '{"description":"New Gemini flash lane bringing frontier-style multimodal reasoning to cheaper runs","family":"gemini-flash","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2025-01","releaseDate":"2025-12-17","lastUpdated":"2025-12-17","modalities":{"input":["text","image","video","audio","pdf"],"output":["text"]}}' WHERE id = 'gemini-3-flash';

-- gemini-3-flash-preview ← google/gemini-3-flash-preview
UPDATE models SET display_name = 'Gemini 3 Flash Preview', context_length = 1048576, max_output_tokens = 65536, metadata_json = '{"description":"New Gemini flash lane bringing frontier-style multimodal reasoning to cheaper runs","family":"gemini-flash","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2025-01","releaseDate":"2025-12-17","lastUpdated":"2025-12-17","modalities":{"input":["text","image","video","audio","pdf"],"output":["text"]}}' WHERE id = 'gemini-3-flash-preview';

-- gemini-3.1-flash-lite-preview ← google/gemini-3.1-flash-lite-preview
UPDATE models SET display_name = 'Gemini 3.1 Flash Lite Preview', context_length = 1048576, max_output_tokens = 65536, metadata_json = '{"description":"Legacy model retained for compatibility with older integrations","family":"gemini-flash-lite","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2025-01","releaseDate":"2026-03-03","lastUpdated":"2026-03-03","modalities":{"input":["text","image","video","audio","pdf"],"output":["text"]}}' WHERE id = 'gemini-3.1-flash-lite-preview';

-- gemini-3.1-pro-preview ← google/gemini-3.1-pro-preview
UPDATE models SET display_name = 'Gemini 3.1 Pro Preview', context_length = 1048576, max_output_tokens = 65536, metadata_json = '{"description":"Reasoning-first Gemini preview for agentic coding and complex problem solving","family":"gemini-pro","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2025-01","releaseDate":"2026-02-19","lastUpdated":"2026-02-19","modalities":{"input":["text","image","video","audio","pdf"],"output":["text"]}}' WHERE id = 'gemini-3.1-pro-preview';

-- glm-4.7-flash ← zhipuai/glm-4.7-flash
UPDATE models SET display_name = 'GLM-4.7-Flash', context_length = 200000, max_output_tokens = 131072, metadata_json = '{"description":"Budget GLM lane for fast coding help, routing, and everyday automation","family":"glm-flash","attachment":false,"reasoning":true,"toolCall":true,"temperature":true,"openWeights":true,"knowledge":"2025-04","releaseDate":"2026-01-19","lastUpdated":"2026-01-19","modalities":{"input":["text"],"output":["text"]}}' WHERE id = 'glm-4.7-flash';

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
UPDATE models SET display_name = 'GPT-5.4', context_length = 1050000, max_output_tokens = 128000, metadata_json = '{"description":"Agent-ready GPT for coding and computer-use workflows at a lower cost","family":"gpt","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":false,"knowledge":"2025-08-31","releaseDate":"2026-03-05","lastUpdated":"2026-03-05","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'gpt-5.4';

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

-- gpt-image-2 ← openai/gpt-image-2
UPDATE models SET display_name = 'gpt-image-2', context_length = 0, max_output_tokens = 0, metadata_json = '{"description":"Image model for prompt-driven generation, editing, and visual design workflows","family":"gpt-image","attachment":true,"reasoning":false,"toolCall":false,"temperature":false,"openWeights":false,"releaseDate":"2026-04-21","lastUpdated":"2026-04-21","modalities":{"input":["text","image"],"output":["image"]}}' WHERE id = 'gpt-image-2';

-- grok-4.3 ← xai/grok-4.3
UPDATE models SET display_name = 'Grok 4.3', context_length = 1000000, max_output_tokens = 30000, metadata_json = '{"description":"xAI''s Grok for chat, coding, agentic tools, and lower hallucination risk","family":"grok","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"releaseDate":"2026-04-17","lastUpdated":"2026-04-17","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'grok-4.3';

-- grok-4.5 ← xai/grok-4.5
UPDATE models SET display_name = 'Grok 4.5', context_length = 500000, max_output_tokens = 500000, metadata_json = '{"description":"xAI''s latest Grok for chat, coding, agentic tools, and lower hallucination risk","family":"grok","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"releaseDate":"2026-07-08","lastUpdated":"2026-07-08","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'grok-4.5';

-- grok-build-0.1 ← xai/grok-build-0.1
UPDATE models SET display_name = 'Grok Build 0.1', context_length = 256000, max_output_tokens = 256000, metadata_json = '{"description":"Fast Grok coding model tuned for agentic engineering and iterative edits","family":"grok-build","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"releaseDate":"2026-04-16","lastUpdated":"2026-04-16","modalities":{"input":["text","image","pdf"],"output":["text"]}}' WHERE id = 'grok-build-0.1';

-- grok-imagine-image ← xai/grok-imagine-image
UPDATE models SET display_name = 'Grok Imagine Image', context_length = 8000, max_output_tokens = 0, metadata_json = '{"description":"Image model for prompt-driven generation, editing, and visual design workflows","family":"grok","attachment":true,"reasoning":false,"toolCall":false,"temperature":false,"openWeights":false,"releaseDate":"2026-01-28","lastUpdated":"2026-01-28","modalities":{"input":["text","image","pdf"],"output":["image","pdf"]}}' WHERE id = 'grok-imagine-image';

-- grok-imagine-image-quality ← xai/grok-imagine-image-quality
UPDATE models SET display_name = 'Grok Imagine Image Quality', context_length = 8000, max_output_tokens = 0, metadata_json = '{"description":"Image model for prompt-driven generation, editing, and visual design workflows","family":"grok","attachment":true,"reasoning":false,"toolCall":false,"temperature":false,"openWeights":false,"releaseDate":"2026-04-03","lastUpdated":"2026-04-03","modalities":{"input":["text","image","pdf"],"output":["image","pdf"]}}' WHERE id = 'grok-imagine-image-quality';

-- grok-imagine-video ← xai/grok-imagine-video
UPDATE models SET display_name = 'Grok Imagine Video', context_length = 1024, max_output_tokens = 0, metadata_json = '{"description":"Image model for prompt-driven generation, editing, and visual design workflows","family":"grok","attachment":true,"reasoning":false,"toolCall":false,"temperature":false,"openWeights":false,"releaseDate":"2026-01-28","lastUpdated":"2026-01-28","modalities":{"input":["text","image","video","pdf"],"output":["video"]}}' WHERE id = 'grok-imagine-video';

-- grok-imagine-video-1.5 ← xai/grok-imagine-video-1.5
UPDATE models SET display_name = 'Grok Imagine Video 1.5', context_length = 1024, max_output_tokens = 0, metadata_json = '{"description":"Video model for image-to-video generation, editing, and extension workflows","family":"grok","attachment":true,"reasoning":false,"toolCall":false,"temperature":false,"openWeights":false,"releaseDate":"2026-05-30","lastUpdated":"2026-05-30","modalities":{"input":["image","pdf"],"output":["video"]}}' WHERE id = 'grok-imagine-video-1.5';

-- kimi-k2.6 ← moonshotai/kimi-k2.6
UPDATE models SET display_name = 'Kimi K2.6', context_length = 262144, max_output_tokens = 262144, metadata_json = '{"description":"Multimodal Kimi workhorse for agent loops, coding tasks, and visual context","family":"kimi-k2","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":true,"knowledge":"2025-01","releaseDate":"2026-04-21","lastUpdated":"2026-04-21","modalities":{"input":["text","image","video"],"output":["text"]}}' WHERE id = 'kimi-k2.6';

-- kimi-k3 ← moonshotai/kimi-k3
UPDATE models SET display_name = 'Kimi K3', context_length = 1048576, max_output_tokens = 131072, metadata_json = '{"description":"Multimodal Kimi model with 1M context and toggleable max-effort thinking for long-horizon agent work","family":"kimi-k3","attachment":true,"reasoning":true,"toolCall":true,"temperature":false,"structuredOutput":true,"openWeights":true,"releaseDate":"2026-07-16","lastUpdated":"2026-07-16","modalities":{"input":["text","image","video"],"output":["text"]}}' WHERE id = 'kimi-k3';

-- mimo-v2-omni ← xiaomi/mimo-v2-omni
UPDATE models SET display_name = 'MiMo-V2-Omni', context_length = 262144, max_output_tokens = 131072, metadata_json = '{"description":"Legacy model retained for compatibility with older integrations","family":"mimo","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"openWeights":false,"knowledge":"2024-12","releaseDate":"2026-03-18","lastUpdated":"2026-06-24","modalities":{"input":["text","image","audio","video","pdf"],"output":["text"]}}' WHERE id = 'mimo-v2-omni';

-- mimo-v2-pro ← xiaomi/mimo-v2-pro
UPDATE models SET display_name = 'MiMo-V2-Pro', context_length = 1048576, max_output_tokens = 131072, metadata_json = '{"description":"Earlier MiMo Pro model for multimodal agents, reasoning, and code tasks","family":"mimo","attachment":false,"reasoning":true,"toolCall":true,"temperature":true,"openWeights":false,"knowledge":"2024-12","releaseDate":"2026-03-18","lastUpdated":"2026-06-24","modalities":{"input":["text"],"output":["text"]}}' WHERE id = 'mimo-v2-pro';

-- mimo-v2-tts ← xiaomi-token-plan-sgp/mimo-v2-tts
UPDATE models SET display_name = 'MiMo-V2-TTS', context_length = 8192, max_output_tokens = 8192, metadata_json = '{"description":"Speech generation model for controllable voice, narration, and audio delivery","family":"mimo","attachment":false,"reasoning":false,"toolCall":false,"openWeights":true,"releaseDate":"2026-03-18","lastUpdated":"2026-03-18","modalities":{"input":["text"],"output":["audio"]}}' WHERE id = 'mimo-v2-tts';

-- mimo-v2.5 ← xiaomi/mimo-v2.5
UPDATE models SET display_name = 'MiMo-V2.5', context_length = 1048576, max_output_tokens = 131072, metadata_json = '{"description":"Open MiMo model for multimodal coding agents and long-context automation","family":"mimo","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"openWeights":true,"knowledge":"2024-12","releaseDate":"2026-04-22","lastUpdated":"2026-06-24","modalities":{"input":["text","image","audio","video"],"output":["text"]}}' WHERE id = 'mimo-v2.5';

-- mimo-v2.5-pro ← xiaomi/mimo-v2.5-pro
UPDATE models SET display_name = 'MiMo-V2.5-Pro', context_length = 1048576, max_output_tokens = 131072, metadata_json = '{"description":"Stronger MiMo Pro tier for multimodal reasoning and coding-agent execution","family":"mimo","attachment":false,"reasoning":true,"toolCall":true,"temperature":true,"openWeights":true,"knowledge":"2024-12","releaseDate":"2026-04-22","lastUpdated":"2026-06-24","modalities":{"input":["text"],"output":["text"]}}' WHERE id = 'mimo-v2.5-pro';

-- mimo-v2.5-tts ← xiaomi-token-plan-sgp/mimo-v2.5-tts
UPDATE models SET display_name = 'MiMo-V2.5-TTS', context_length = 8192, max_output_tokens = 8192, metadata_json = '{"description":"Speech generation model for controllable voice, narration, and audio delivery","family":"mimo","attachment":false,"reasoning":false,"toolCall":false,"openWeights":true,"releaseDate":"2026-04-22","lastUpdated":"2026-04-22","modalities":{"input":["text"],"output":["audio"]}}' WHERE id = 'mimo-v2.5-tts';

-- mimo-v2.5-tts-voiceclone ← xiaomi-token-plan-sgp/mimo-v2.5-tts-voiceclone
UPDATE models SET display_name = 'MiMo-V2.5-TTS-VoiceClone', context_length = 8192, max_output_tokens = 8192, metadata_json = '{"description":"Speech generation model for controllable voice, narration, and audio delivery","family":"mimo","attachment":false,"reasoning":false,"toolCall":false,"openWeights":true,"releaseDate":"2026-04-22","lastUpdated":"2026-04-22","modalities":{"input":["text"],"output":["audio"]}}' WHERE id = 'mimo-v2.5-tts-voiceclone';

-- mimo-v2.5-tts-voicedesign ← xiaomi-token-plan-sgp/mimo-v2.5-tts-voicedesign
UPDATE models SET display_name = 'MiMo-V2.5-TTS-VoiceDesign', context_length = 8192, max_output_tokens = 8192, metadata_json = '{"description":"Speech generation model for controllable voice, narration, and audio delivery","family":"mimo","attachment":false,"reasoning":false,"toolCall":false,"openWeights":true,"releaseDate":"2026-04-22","lastUpdated":"2026-04-22","modalities":{"input":["text"],"output":["audio"]}}' WHERE id = 'mimo-v2.5-tts-voicedesign';

-- qwen3-30b ← cloudflare-workers-ai/@cf/qwen/qwen3-30b-a3b-fp8
UPDATE models SET display_name = 'Qwen3 30B A3b fp8', context_length = 32768, max_output_tokens = 32768, metadata_json = '{"description":"Qwen instruction model for multilingual chat, reasoning, and tool use","family":"qwen","attachment":false,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":false,"openWeights":true,"releaseDate":"2025-04-30","lastUpdated":"2025-04-30","modalities":{"input":["text"],"output":["text"]}}' WHERE id = 'qwen3-30b';
