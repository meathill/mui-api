-- 向 D1 插入 deepseek-v4-flash 模型及 8 语种博客元数据
-- 执行命令：
--   wrangler d1 execute mui-api --remote --file=scripts/insert-deepseek-v4-flash.sql
-- 执行后请清除 KV catalog 缓存：
--   wrangler kv key delete --binding=KV --remote models:catalog

INSERT OR REPLACE INTO models (
  id,
  provider,
  upstream_model_id,
  input_price,
  output_price,
  markup_rate,
  cached_input_price,
  display_name,
  context_length,
  max_output_tokens,
  metadata_json
) VALUES (
  'deepseek-v4-flash',
  'deepseek',
  'deepseek-v4-flash',
  0.14,
  0.28,
  1.0,
  0.0028,
  'DeepSeek V4 Flash',
  1000000,
  8192,
  '{"description":"DeepSeek-V4-Flash is a high-efficiency 284B MoE model (13B active) with 1M context, optimized for coding and reasoning.","family":"deepseek-v4","attachment":false,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":true,"releaseDate":"2026-07-31","lastUpdated":"2026-07-31","modalities":{"input":["text"],"output":["text"]}}'
);

INSERT OR REPLACE INTO blog_posts (slug, published_at, source_published_at, reading_minutes, status)
VALUES
  ('deepseek-v4-flash', '2026-07-31', '2026-07-31', 5, 'published');

INSERT OR REPLACE INTO blog_post_translations (
  slug,
  locale,
  title,
  description,
  tags_json,
  sources_json
)
VALUES
  (
    'deepseek-v4-flash',
    'en',
    'DeepSeek V4 Flash Released: High-Throughput 284B MoE, Now Available on MuiRouter',
    'DeepSeek V4 Flash brings 284B total parameters, 1M context window, and ultra-low prompt caching costs. MuiRouter supports it via API and Playground with pay-as-you-go pricing.',
    '["DeepSeek V4 Flash","DeepSeek","AI models"]',
    '[{"label":"DeepSeek API Models & Pricing","url":"https://api.deepseek.com"}]'
  ),
  (
    'deepseek-v4-flash',
    'zh',
    'DeepSeek V4 Flash 发布：高吞吐 284B MoE 模型，MuiRouter 已接入',
    'DeepSeek V4 Flash 带来 2840 亿总参数、1M context 与极致 Prompt Caching 成本。MuiRouter 已完成 API 与 Playground 接入，透明计费按量结算。',
    '["DeepSeek V4 Flash","DeepSeek","AI 模型"]',
    '[{"label":"DeepSeek 官方 API 价格页","url":"https://api.deepseek.com"}]'
  ),
  (
    'deepseek-v4-flash',
    'fr',
    'DeepSeek V4 Flash est là : modèle MoE 284B haute performance, disponible sur MuiRouter',
    'DeepSeek V4 Flash réunit 284B paramètres, un contexte de 1M tokens et un coût de prompt caching ultra-bas. MuiRouter le propose via son API avec tarification à l''usage.',
    '["DeepSeek V4 Flash","DeepSeek","Modèles IA"]',
    '[{"label":"Tarifs officiels DeepSeek API","url":"https://api.deepseek.com"}]'
  ),
  (
    'deepseek-v4-flash',
    'es',
    'Lanzamiento de DeepSeek V4 Flash: modelo MoE de 284B, ya disponible en MuiRouter',
    'DeepSeek V4 Flash ofrece 284B de parámetros, ventana de contexto de 1M y costes de almacenamiento en caché de prompt ultra bajos. Disponible en MuiRouter.',
    '["DeepSeek V4 Flash","DeepSeek","Modelos de IA"]',
    '[{"label":"Precios oficiales de la API de DeepSeek","url":"https://api.deepseek.com"}]'
  ),
  (
    'deepseek-v4-flash',
    'pt',
    'DeepSeek V4 Flash lançado: modelo MoE de 284B de alto rendimento, agora no MuiRouter',
    'O DeepSeek V4 Flash traz 284B de parâmetros, contexto de 1M tokens e custo de prompt caching incrivelmente baixo. O MuiRouter já oferece o modelo pela API.',
    '["DeepSeek V4 Flash","DeepSeek","Modelos de IA"]',
    '[{"label":"Preços oficiais da API DeepSeek","url":"https://api.deepseek.com"}]'
  ),
  (
    'deepseek-v4-flash',
    'de',
    'DeepSeek V4 Flash veröffentlicht: Leistungsstarkes 284B MoE-Modell auf MuiRouter',
    'DeepSeek V4 Flash bietet 284B Parameter, ein 1M-Token-Kontextfenster und extrem günstiges Prompt-Caching. MuiRouter unterstützt das Modell ab sofort.',
    '["DeepSeek V4 Flash","DeepSeek","KI-Modelle"]',
    '[{"label":"Offizielle Preise der DeepSeek API","url":"https://api.deepseek.com"}]'
  ),
  (
    'deepseek-v4-flash',
    'th',
    'เปิดตัว DeepSeek V4 Flash: โมเดล MoE 284B ความเร็วสูง พร้อมใช้งานแล้วบน MuiRouter',
    'DeepSeek V4 Flash มาพร้อมพารามิเตอร์ 284B, context 1M tokens และต้นทุน Prompt Caching ที่ต่ำเป็นพิเศษ MuiRouter รองรับแล้วทั้ง API และ Playground',
    '["DeepSeek V4 Flash","DeepSeek","โมเดล AI"]',
    '[{"label":"ราคา DeepSeek API อย่างเป็นทางการ","url":"https://api.deepseek.com"}]'
  ),
  (
    'deepseek-v4-flash',
    'ja',
    'DeepSeek V4 Flash 登場：高スループット 284B MoE モデル、MuiRouter に対応',
    'DeepSeek V4 Flash は 2840 億パラメータ、1M コンテキスト、超低コストな Prompt Caching を提供します。MuiRouter の API からすぐにご利用いただけます。',
    '["DeepSeek V4 Flash","DeepSeek","AI モデル"]',
    '[{"label":"DeepSeek API 公式料金","url":"https://api.deepseek.com"}]'
  );
