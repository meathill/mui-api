-- 向 D1 插入 grok-4.6 / deepseek-v4-pro 模型及各自 8 语种博客元数据
-- 执行命令：
--   wrangler d1 execute mui-api --remote --file=scripts/insert-grok-4-6-deepseek-v4-pro.sql
-- 执行后请清除 KV catalog 缓存：
--   wrangler kv key delete --binding=KV --remote models:catalog
--
-- grok-4.6：xAI 官方 2026-08-12 发布，定价 $2/$6（与 grok-4.5 同价），无 prompt caching 折扣
-- （沿用 grok 系列 NO_CACHE_NO_TIER 口径）。markup 1.05：走 Stored Keys 自付，与 Claude BYOK 同口径。
-- deepseek-v4-pro：DeepSeek-V4-Pro-0813 正式版，官方 $0.435/$0.87，cache hit $0.003625。
-- 元数据来自 models.dev（xai/grok-4.6、deepseek/deepseek-v4-pro），deepseek 的 open_weights
-- 按 DeepSeek 官方开源事实修正为 true（models.dev 条目误标 false）。

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
) VALUES
  (
    'grok-4.6',
    'grok',
    'grok-4.6',
    2,
    6,
    1.05,
    NULL,
    'Grok 4.6',
    500000,
    500000,
    '{"description":"xAI''s frontier model for long-running agents, coding, knowledge work, and visual projects","family":"grok","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2026-02-01","releaseDate":"2026-08-12","lastUpdated":"2026-08-12","modalities":{"input":["text","image","pdf"],"output":["text"]}}'
  ),
  (
    'deepseek-v4-pro',
    'deepseek',
    'deepseek-v4-pro',
    0.435,
    0.87,
    1.2,
    0.003625,
    'DeepSeek V4 Pro',
    1000000,
    384000,
    '{"description":"DeepSeek V4 Pro snapshot with million-token context and support for thinking and non-thinking modes","family":"deepseek-v4","attachment":false,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":true,"releaseDate":"2026-08-12","lastUpdated":"2026-08-12","modalities":{"input":["text"],"output":["text"]}}'
  );

-- grok-4-6 博客（8 语言），正文见 packages/dashboard/src/content/blog/grok-4-6*.mdx
INSERT OR REPLACE INTO blog_posts (slug, published_at, source_published_at, reading_minutes, status)
VALUES
  ('grok-4-6', '2026-08-13', '2026-08-12', 6, 'published');

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
    'grok-4-6',
    'en',
    'Grok 4.6 Is Here: xAI''s Agent-Focused Frontier Model, Now on MuiRouter',
    'xAI released Grok 4.6 with a focus on long-running agents and ambitious interactive and visual work. It matches GPT-5.6 Sol on the AA Intelligence Index and is now live on MuiRouter.',
    '["Grok 4.6","xAI","AI models"]',
    '[{"label":"xAI: Introducing Grok 4.6","url":"https://x.ai/news/grok-4-6"}]'
  ),
  (
    'grok-4-6',
    'zh',
    'Grok 4.6 发布：xAI 专注长期 Agent 的前沿模型，MuiRouter 已接入',
    'xAI 发布专注长期 Agent 任务与交互/视觉工作的 Grok 4.6，AA 智能指数追平 GPT-5.6 Sol。MuiRouter 已完成接入，一把 API Key 即可调用。',
    '["Grok 4.6","xAI","AI 模型"]',
    '[{"label":"xAI：Grok 4.6 发布公告","url":"https://x.ai/news/grok-4-6"}]'
  ),
  (
    'grok-4-6',
    'fr',
    'Grok 4.6 est là : le modèle de pointe d''xAI pour les agents, disponible sur MuiRouter',
    'xAI a lancé Grok 4.6, pensé pour les agents de longue durée et les projets visuels et interactifs ambitieux. Il égale GPT-5.6 Sol sur l''indice d''intelligence AA et est disponible sur MuiRouter.',
    '["Grok 4.6","xAI","Modèles IA"]',
    '[{"label":"xAI : annonce de Grok 4.6","url":"https://x.ai/news/grok-4-6"}]'
  ),
  (
    'grok-4-6',
    'es',
    'Grok 4.6 ya está aquí: el modelo de frontera de xAI para agentes, ahora en MuiRouter',
    'xAI lanzó Grok 4.6, enfocado en agentes de larga duración y proyectos visuales e interactivos ambiciosos. Iguala a GPT-5.6 Sol en el índice de inteligencia AA y ya está en MuiRouter.',
    '["Grok 4.6","xAI","Modelos de IA"]',
    '[{"label":"xAI: presentación de Grok 4.6","url":"https://x.ai/news/grok-4-6"}]'
  ),
  (
    'grok-4-6',
    'pt',
    'Grok 4.6 chegou: o modelo de fronteira da xAI para agentes, agora no MuiRouter',
    'A xAI lançou o Grok 4.6, focado em agentes de longa duração e projetos visuais e interativos ambiciosos. Ele iguala o GPT-5.6 Sol no índice de inteligência AA e já está no MuiRouter.',
    '["Grok 4.6","xAI","Modelos de IA"]',
    '[{"label":"xAI: anúncio do Grok 4.6","url":"https://x.ai/news/grok-4-6"}]'
  ),
  (
    'grok-4-6',
    'de',
    'Grok 4.6 ist da: xAIs Agenten-Spitzenmodell, jetzt auf MuiRouter',
    'xAI hat Grok 4.6 mit Fokus auf langlebige Agenten und ambitionierte interaktive und visuelle Projekte veröffentlicht. Es erreicht den AA-Intelligenzindex von GPT-5.6 Sol und ist jetzt auf MuiRouter.',
    '["Grok 4.6","xAI","KI-Modelle"]',
    '[{"label":"xAI: Ankündigung von Grok 4.6","url":"https://x.ai/news/grok-4-6"}]'
  ),
  (
    'grok-4-6',
    'th',
    'Grok 4.6 มาแล้ว: โมเดลระดับแนวหน้าของ xAI สำหรับงาน Agent พร้อมใช้งานบน MuiRouter',
    'xAI เปิดตัว Grok 4.6 ที่เน้นงาน Agent ระยะยาวและงาน Visual/Interactive ทะเยอทะยาน ทำคะแนน AA Intelligence Index เท่ากับ GPT-5.6 Sol พร้อมใช้งานบน MuiRouter แล้ว',
    '["Grok 4.6","xAI","โมเดล AI"]',
    '[{"label":"xAI: ประกาศ Grok 4.6","url":"https://x.ai/news/grok-4-6"}]'
  ),
  (
    'grok-4-6',
    'ja',
    'Grok 4.6 登場：長期エージェントに特化した xAI の最前線モデル、MuiRouter に対応',
    'xAI が長期エージェントと意欲的なインタラクティブ・ビジュアル作業に特化した Grok 4.6 を発表。AA インテリジェンス指数で GPT-5.6 Sol に並び、MuiRouter ですぐに利用できます。',
    '["Grok 4.6","xAI","AI モデル"]',
    '[{"label":"xAI：Grok 4.6 発表","url":"https://x.ai/news/grok-4-6"}]'
  );

-- deepseek-v4-pro 博客（8 语言），正文见 packages/dashboard/src/content/blog/deepseek-v4-pro*.mdx
INSERT OR REPLACE INTO blog_posts (slug, published_at, source_published_at, reading_minutes, status)
VALUES
  ('deepseek-v4-pro', '2026-08-13', '2026-08-12', 6, 'published');

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
    'deepseek-v4-pro',
    'en',
    'DeepSeek V4 Pro Is Now Generally Available, Now on MuiRouter',
    'DeepSeek shipped the V4 Pro stable (V4-Pro-0813): 1.6T MoE, 1M context, 384K max output, and thinking/non-thinking modes. Now live on MuiRouter with one API key.',
    '["DeepSeek V4 Pro","DeepSeek","AI models"]',
    '[{"label":"DeepSeek API Models & Pricing","url":"https://api-docs.deepseek.com/quick_start/pricing"},{"label":"DeepSeek-V4 Preview release notes","url":"https://api-docs.deepseek.com/news/news260424"}]'
  ),
  (
    'deepseek-v4-pro',
    'zh',
    'DeepSeek V4 Pro 正式版发布：1.6T 开源旗舰，MuiRouter 已接入',
    'DeepSeek 放出 V4 Pro 正式版（V4-Pro-0813）：1.6T MoE、1M context、384K 最大输出、思考/非思考双模式。MuiRouter 已完成接入，一把 API Key 即可调用。',
    '["DeepSeek V4 Pro","DeepSeek","AI 模型"]',
    '[{"label":"DeepSeek API 模型与价格","url":"https://api-docs.deepseek.com/quick_start/pricing"},{"label":"DeepSeek-V4 Preview 发布说明","url":"https://api-docs.deepseek.com/news/news260424"}]'
  ),
  (
    'deepseek-v4-pro',
    'fr',
    'DeepSeek V4 Pro est disponible en version stable, maintenant sur MuiRouter',
    'DeepSeek a publié la version stable de V4 Pro (V4-Pro-0813) : MoE 1,6T, contexte 1M, sortie maximale de 384K et modes réflexion/non-réflexion. Disponible sur MuiRouter avec une seule clé API.',
    '["DeepSeek V4 Pro","DeepSeek","Modèles IA"]',
    '[{"label":"Tarifs et modèles de l''API DeepSeek","url":"https://api-docs.deepseek.com/quick_start/pricing"},{"label":"Notes de version DeepSeek-V4 Preview","url":"https://api-docs.deepseek.com/news/news260424"}]'
  ),
  (
    'deepseek-v4-pro',
    'es',
    'DeepSeek V4 Pro ya está disponible en versión estable, ahora en MuiRouter',
    'DeepSeek publicó la versión estable de V4 Pro (V4-Pro-0813): MoE 1,6T, contexto de 1M, salida máxima de 384K y modos de razonamiento/sin razonamiento. Ya está en MuiRouter con una sola clave API.',
    '["DeepSeek V4 Pro","DeepSeek","Modelos de IA"]',
    '[{"label":"Modelos y precios de la API de DeepSeek","url":"https://api-docs.deepseek.com/quick_start/pricing"},{"label":"Notas de la versión DeepSeek-V4 Preview","url":"https://api-docs.deepseek.com/news/news260424"}]'
  ),
  (
    'deepseek-v4-pro',
    'pt',
    'DeepSeek V4 Pro está disponível em versão estável, agora no MuiRouter',
    'A DeepSeek publicou a versão estável do V4 Pro (V4-Pro-0813): MoE 1,6T, contexto de 1M, saída máxima de 384K e modos de raciocínio/sem raciocínio. Já está no MuiRouter com uma única chave de API.',
    '["DeepSeek V4 Pro","DeepSeek","Modelos de IA"]',
    '[{"label":"Modelos e preços da API DeepSeek","url":"https://api-docs.deepseek.com/quick_start/pricing"},{"label":"Notas de lançamento do DeepSeek-V4 Preview","url":"https://api-docs.deepseek.com/news/news260424"}]'
  ),
  (
    'deepseek-v4-pro',
    'de',
    'DeepSeek V4 Pro ist jetzt in der stabilen Version verfügbar, jetzt auf MuiRouter',
    'DeepSeek hat die stabile Version von V4 Pro (V4-Pro-0813) veröffentlicht: 1,6T-MoE, 1M-Kontext, 384K maximale Ausgabe und Denk-/Nicht-Denk-Modi. Jetzt mit einem einzigen API Key auf MuiRouter.',
    '["DeepSeek V4 Pro","DeepSeek","KI-Modelle"]',
    '[{"label":"DeepSeek API Modelle & Preise","url":"https://api-docs.deepseek.com/quick_start/pricing"},{"label":"DeepSeek-V4 Preview Versionshinweise","url":"https://api-docs.deepseek.com/news/news260424"}]'
  ),
  (
    'deepseek-v4-pro',
    'th',
    'DeepSeek V4 Pro ปล่อยเวอร์ชันเต็มแล้ว พร้อมใช้งานบน MuiRouter',
    'DeepSeek ปล่อยเวอร์ชันเต็มของ V4 Pro (V4-Pro-0813): MoE 1.6T, context 1M, output สูงสุด 384K และโหมดคิด/ไม่คิด พร้อมใช้งานบน MuiRouter ด้วย API Key เดียว',
    '["DeepSeek V4 Pro","DeepSeek","โมเดล AI"]',
    '[{"label":"โมเดลและราคา DeepSeek API","url":"https://api-docs.deepseek.com/quick_start/pricing"},{"label":"บันทึกการเปิดตัว DeepSeek-V4 Preview","url":"https://api-docs.deepseek.com/news/news260424"}]'
  ),
  (
    'deepseek-v4-pro',
    'ja',
    'DeepSeek V4 Pro 正式版が登場、MuiRouter に対応',
    'DeepSeek が V4 Pro 正式版（V4-Pro-0813）を公開：1.6T MoE、1M コンテキスト、最大出力 384K、思考/非思考の両モード。MuiRouter で 1 つの API Key から利用できます。',
    '["DeepSeek V4 Pro","DeepSeek","AI モデル"]',
    '[{"label":"DeepSeek API モデルと料金","url":"https://api-docs.deepseek.com/quick_start/pricing"},{"label":"DeepSeek-V4 Preview リリースノート","url":"https://api-docs.deepseek.com/news/news260424"}]'
  );
