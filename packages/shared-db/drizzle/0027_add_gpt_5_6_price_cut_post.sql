-- 新增博客文章：OpenAI GPT-5.6 Luna 与 Terra 降价解读（8 语言），并更新模型价格。
-- 正文见 packages/dashboard/src/content/blog/gpt-5-6-price-cut*.mdx。

UPDATE models
SET
  input_price = 0.2,
  output_price = 1.2,
  cached_input_price = 0.02,
  cache_write_price = 0.25
WHERE id = 'gpt-5.6-luna';

UPDATE models
SET
  input_price = 2.0,
  output_price = 12.0,
  cached_input_price = 0.20,
  cache_write_price = 2.50
WHERE id = 'gpt-5.6-terra';

INSERT OR REPLACE INTO blog_posts (slug, published_at, source_published_at, reading_minutes, status)
VALUES
  ('gpt-5-6-price-cut', '2026-07-31', '2026-07-30', 5, 'published');

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
    'gpt-5-6-price-cut',
    'en',
    'OpenAI Price Cut: GPT-5.6 Luna & Terra Drop Up to 80%',
    'OpenAI abruptly slashed prices for GPT-5.6 Luna by 80% and Terra by 20%. Here is a breakdown of developer consensus, cost-per-task model routing, and strategic analysis.',
    '["GPT-5.6","OpenAI","Price Cut","AI Agent"]',
    '[{"label":"OpenAI GPT-5.6 Price Announcement","url":"https://openai.com/api/pricing/"},{"label":"Rafael Quintanilha Analysis on X","url":"https://x.com/rafaquint/status/2082942652811485549"}]'
  ),
  (
    'gpt-5-6-price-cut',
    'zh',
    'OpenAI GPT-5.6 Luna 与 Terra 大幅降价解读',
    'OpenAI 突然下调 GPT-5.6 Luna (80%) 与 Terra (20%) 的价格。本文梳理调价细节、社区“低档+高思考”逆袭推测、1M 上下文优势及迎击开源竞争的战略分析。',
    '["GPT-5.6","OpenAI","模型降价","AI Agent"]',
    '[{"label":"OpenAI API 定价","url":"https://openai.com/api/pricing/"},{"label":"Rafael Quintanilha 的 X 分析","url":"https://x.com/rafaquint/status/2082942652811485549"}]'
  ),
  (
    'gpt-5-6-price-cut',
    'fr',
    'Baisse des prix OpenAI : GPT-5.6 Luna & Terra chutent jusqu’à 80 %',
    'OpenAI a surpris en réduisant les prix de GPT-5.6 Luna de 80 % et Terra de 20 %. Voici une analyse des retours développeurs, du routage multi-niveaux et de l’impact stratégique.',
    '["GPT-5.6","OpenAI","Baisse de prix","Agent IA"]',
    '[{"label":"Tarifs de l’API OpenAI","url":"https://openai.com/api/pricing/"},{"label":"Analyse de Rafael Quintanilha sur X","url":"https://x.com/rafaquint/status/2082942652811485549"}]'
  ),
  (
    'gpt-5-6-price-cut',
    'es',
    'Rebaja de precios en OpenAI: GPT-5.6 Luna y Terra caen hasta un 80%',
    'OpenAI redujo de forma imprevista los precios de GPT-5.6 Luna un 80% y Terra un 20%. Analizamos las opiniones de los desarrolladores, el enrutamiento multinivel y el impacto en el mercado.',
    '["GPT-5.6","OpenAI","Rebaja de precios","Agente IA"]',
    '[{"label":"Precios de la API de OpenAI","url":"https://openai.com/api/pricing/"},{"label":"Análisis de Rafael Quintanilha en X","url":"https://x.com/rafaquint/status/2082942652811485549"}]'
  ),
  (
    'gpt-5-6-price-cut',
    'pt',
    'Corte de preços na OpenAI: GPT-5.6 Luna e Terra caem até 80%',
    'A OpenAI reduziu de surpresa os preços do GPT-5.6 Luna em 80% e Terra em 20%. Veja a análise da comunidade de desenvolvedores, roteamento por tarefa e visão estratégica.',
    '["GPT-5.6","OpenAI","Corte de preços","Agent IA"]',
    '[{"label":"Preços da API da OpenAI","url":"https://openai.com/api/pricing/"},{"label":"Análise de Rafael Quintanilha no X","url":"https://x.com/rafaquint/status/2082942652811485549"}]'
  ),
  (
    'gpt-5-6-price-cut',
    'de',
    'OpenAI Preissenkung: GPT-5.6 Luna & Terra bis zu 80% günstiger',
    'OpenAI senkt die Preise für GPT-5.6 Luna um 80% und Terra um 20%. Hier ist die Analyse zu Entwickler-Reaktionen, Modell-Routing und strategischen Hintergründen.',
    '["GPT-5.6","OpenAI","Preissenkung","KI-Agent"]',
    '[{"label":"OpenAI API-Preise","url":"https://openai.com/api/pricing/"},{"label":"Rafael Quintanilha Analyse auf X","url":"https://x.com/rafaquint/status/2082942652811485549"}]'
  ),
  (
    'gpt-5-6-price-cut',
    'th',
    'OpenAI ลดราคาครั้งใหญ่: GPT-5.6 Luna & Terra ลดสูงสุด 80%',
    'OpenAI ปรับลดราคา GPT-5.6 Luna ลง 80% และ Terra 20% อย่างเหนือความคาดหมาย บทความนี้สรุปรายละเอียดการปรับราคา มุมมองนักพัฒนา และวิเคราะห์เชิงยุทธศาสตร์',
    '["GPT-5.6","OpenAI","ลดราคา","AI Agent"]',
    '[{"label":"ราคา OpenAI API","url":"https://openai.com/api/pricing/"},{"label":"บทวิเคราะห์ของ Rafael Quintanilha บน X","url":"https://x.com/rafaquint/status/2082942652811485549"}]'
  ),
  (
    'gpt-5-6-price-cut',
    'ja',
    'OpenAIがGPT-5.6 LunaとTerraを大幅値下げ：最大80%オフ',
    'OpenAIがGPT-5.6 Lunaを80%、Terraを20%突如値下げ。開発者コミュニティの反響、タスク単価ルーティング、オープンソース対抗の戦略的分析を解説します。',
    '["GPT-5.6","OpenAI","値下げ","AI Agent"]',
    '[{"label":"OpenAI API 料金","url":"https://openai.com/api/pricing/"},{"label":"Rafael Quintanilha による X 分析","url":"https://x.com/rafaquint/status/2082942652811485549"}]'
  );
