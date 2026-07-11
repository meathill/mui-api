-- 新增博客文章：OpenAI GPT-5.6 发布解读（8 语言）。
-- 正文见 packages/dashboard/src/content/blog/gpt-5-6*.mdx。

INSERT OR REPLACE INTO blog_posts (slug, published_at, source_published_at, reading_minutes, status)
VALUES
  ('gpt-5-6', '2026-07-11', '2026-07-09', 7, 'published');

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
    'gpt-5-6',
    'en',
    'GPT-5.6 Is Here: Sol, Terra, Luna — Efficiency by Default, Power on Demand',
    'OpenAI launched GPT-5.6 on July 9, 2026 across ChatGPT, Codex, and the API: flagship Sol, balanced Terra, and cost-efficient Luna. Here is what shipped, the new pricing tiers, and what it means if you build with AI.',
    '["GPT-5.6","OpenAI","AI models"]',
    '[{"label":"OpenAI GPT-5.6 announcement","url":"https://openai.com/index/gpt-5-6/"},{"label":"Previewing GPT-5.6 Sol","url":"https://openai.com/index/previewing-gpt-5-6-sol/"},{"label":"GPT-5.6 in ChatGPT","url":"https://help.openai.com/en/articles/20001325-a-preview-of-gpt-56-sol-terra-and-luna"},{"label":"OpenAI API Pricing","url":"https://openai.com/api/pricing/"}]'
  ),
  (
    'gpt-5-6',
    'zh',
    'GPT-5.6 已发布：Sol、Terra、Luna — 默认高效，需要时再拉满',
    '2026 年 7 月 9 日，OpenAI 在 ChatGPT、Codex 与 API 同步上线 GPT-5.6：旗舰 Sol、均衡 Terra、高性价比 Luna。本文梳理发布内容、三档定价，以及对开发者的意义。',
    '["GPT-5.6","OpenAI","AI 模型"]',
    '[{"label":"OpenAI GPT-5.6 发布公告","url":"https://openai.com/index/gpt-5-6/"},{"label":"GPT-5.6 Sol 预览","url":"https://openai.com/index/previewing-gpt-5-6-sol/"},{"label":"ChatGPT 中的 GPT-5.6","url":"https://help.openai.com/en/articles/20001325-a-preview-of-gpt-56-sol-terra-and-luna"},{"label":"OpenAI API 价格","url":"https://openai.com/api/pricing/"}]'
  ),
  (
    'gpt-5-6',
    'fr',
    'GPT-5.6 est là : Sol, Terra, Luna — efficacité par défaut, puissance à la demande',
    'OpenAI a lancé GPT-5.6 le 9 juillet 2026 sur ChatGPT, Codex et l’API : flagship Sol, équilibré Terra et économique Luna. Voici ce qui a été publié, les trois tarifs, et ce que cela signifie si vous construisez avec l’IA.',
    '["GPT-5.6","OpenAI","Modèles IA"]',
    '[{"label":"Annonce GPT-5.6 d’OpenAI","url":"https://openai.com/index/gpt-5-6/"},{"label":"Préversion de GPT-5.6 Sol","url":"https://openai.com/index/previewing-gpt-5-6-sol/"},{"label":"GPT-5.6 dans ChatGPT","url":"https://help.openai.com/en/articles/20001325-a-preview-of-gpt-56-sol-terra-and-luna"},{"label":"Tarifs de l’API OpenAI","url":"https://openai.com/api/pricing/"}]'
  ),
  (
    'gpt-5-6',
    'es',
    'GPT-5.6 ya está aquí: Sol, Terra, Luna — eficiencia por defecto, potencia bajo demanda',
    'OpenAI lanzó GPT-5.6 el 9 de julio de 2026 en ChatGPT, Codex y la API: flagship Sol, equilibrado Terra y económico Luna. Esto es lo que se publicó, los tres precios y qué significa si construyes con IA.',
    '["GPT-5.6","OpenAI","Modelos de IA"]',
    '[{"label":"Anuncio de GPT-5.6 de OpenAI","url":"https://openai.com/index/gpt-5-6/"},{"label":"Vista previa de GPT-5.6 Sol","url":"https://openai.com/index/previewing-gpt-5-6-sol/"},{"label":"GPT-5.6 en ChatGPT","url":"https://help.openai.com/en/articles/20001325-a-preview-of-gpt-56-sol-terra-and-luna"},{"label":"Precios de la API de OpenAI","url":"https://openai.com/api/pricing/"}]'
  ),
  (
    'gpt-5-6',
    'pt',
    'GPT-5.6 chegou: Sol, Terra, Luna — eficiência por padrão, poder sob demanda',
    'A OpenAI lançou o GPT-5.6 em 9 de julho de 2026 no ChatGPT, Codex e na API: flagship Sol, equilibrado Terra e econômico Luna. Veja o que foi lançado, os três preços e o que isso significa se você constrói com IA.',
    '["GPT-5.6","OpenAI","Modelos de IA"]',
    '[{"label":"Anúncio do GPT-5.6 da OpenAI","url":"https://openai.com/index/gpt-5-6/"},{"label":"Preview do GPT-5.6 Sol","url":"https://openai.com/index/previewing-gpt-5-6-sol/"},{"label":"GPT-5.6 no ChatGPT","url":"https://help.openai.com/en/articles/20001325-a-preview-of-gpt-56-sol-terra-and-luna"},{"label":"Preços da API da OpenAI","url":"https://openai.com/api/pricing/"}]'
  ),
  (
    'gpt-5-6',
    'de',
    'GPT-5.6 ist da: Sol, Terra, Luna — Effizienz by default, Power on demand',
    'OpenAI hat GPT-5.6 am 9. Juli 2026 für ChatGPT, Codex und die API freigegeben: Flagship Sol, ausgewogenes Terra und kostengünstiges Luna. Hier erfährst du, was veröffentlicht wurde, die drei Preisstufen und was das bedeutet, wenn du mit KI baust.',
    '["GPT-5.6","OpenAI","KI-Modelle"]',
    '[{"label":"OpenAI-Ankündigung zu GPT-5.6","url":"https://openai.com/index/gpt-5-6/"},{"label":"Vorschau auf GPT-5.6 Sol","url":"https://openai.com/index/previewing-gpt-5-6-sol/"},{"label":"GPT-5.6 in ChatGPT","url":"https://help.openai.com/en/articles/20001325-a-preview-of-gpt-56-sol-terra-and-luna"},{"label":"OpenAI API-Preise","url":"https://openai.com/api/pricing/"}]'
  ),
  (
    'gpt-5-6',
    'th',
    'GPT-5.6 มาแล้ว: Sol, Terra, Luna — มีประสิทธิภาพโดยค่าเริ่มต้น พลังเมื่อต้องการ',
    'OpenAI เปิดตัว GPT-5.6 เมื่อ 9 กรกฎาคม 2026 บน ChatGPT, Codex และ API: แฟลกชิป Sol, สมดุล Terra และประหยัด Luna นี่คือสิ่งที่เปิดตัว ราคาสามระดับ และความหมายสำหรับคนที่สร้างด้วย AI',
    '["GPT-5.6","OpenAI","โมเดล AI"]',
    '[{"label":"ประกาศ GPT-5.6 ของ OpenAI","url":"https://openai.com/index/gpt-5-6/"},{"label":"พรีวิว GPT-5.6 Sol","url":"https://openai.com/index/previewing-gpt-5-6-sol/"},{"label":"GPT-5.6 ใน ChatGPT","url":"https://help.openai.com/en/articles/20001325-a-preview-of-gpt-56-sol-terra-and-luna"},{"label":"ราคา OpenAI API","url":"https://openai.com/api/pricing/"}]'
  ),
  (
    'gpt-5-6',
    'ja',
    'GPT-5.6 登場：Sol / Terra / Luna — デフォルトは効率、必要時にパワー',
    'OpenAI は 2026 年 7 月 9 日、ChatGPT・Codex・API 向けに GPT-5.6 を公開しました。フラッグシップ Sol、バランス型 Terra、コスト効率の Luna。公開内容と三段階の価格、AI で開発する人への意味を整理します。',
    '["GPT-5.6","OpenAI","AI モデル"]',
    '[{"label":"OpenAI GPT-5.6 発表","url":"https://openai.com/index/gpt-5-6/"},{"label":"GPT-5.6 Sol プレビュー","url":"https://openai.com/index/previewing-gpt-5-6-sol/"},{"label":"ChatGPT の GPT-5.6","url":"https://help.openai.com/en/articles/20001325-a-preview-of-gpt-56-sol-terra-and-luna"},{"label":"OpenAI API 料金","url":"https://openai.com/api/pricing/"}]'
  );
