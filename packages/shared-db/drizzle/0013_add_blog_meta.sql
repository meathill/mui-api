-- 博客 metadata 迁移到 D1。
--
-- 正文仍保留在 MDX/Git；D1 只负责列表、SEO、来源、发布日期等 metadata。
-- tags_json: JSON string array，例如 ["Codex","AI coding"]。
-- sources_json: JSON object array，例如 [{"label":"OpenAI","url":"https://..."}]。

CREATE TABLE IF NOT EXISTS blog_posts (
  slug TEXT PRIMARY KEY,
  published_at TEXT NOT NULL,
  source_published_at TEXT NOT NULL,
  reading_minutes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS blog_post_translations (
  slug TEXT NOT NULL REFERENCES blog_posts(slug) ON DELETE CASCADE,
  locale TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  sources_json TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (slug, locale)
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_status_published ON blog_posts(status, published_at);
CREATE INDEX IF NOT EXISTS idx_blog_post_translations_locale ON blog_post_translations(locale);

INSERT OR REPLACE INTO blog_posts (slug, published_at, source_published_at, reading_minutes, status)
VALUES
  ('codex-context-drift', '2026-07-02', '2026-06-28', 4, 'published'),
  ('claude-sonnet-5', '2026-07-01', '2026-06-30', 8, 'published'),
  ('claude-fable-5', '2026-06-10', '2026-06-09', 7, 'published'),
  ('gpt-5-5', '2026-04-24', '2026-04-23', 7, 'published');

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
    'codex-context-drift',
    'en',
    'Codex Getting Worse Is Not Magic: Reduce Errors, Then Reset Context',
    'Codex degradation is better understood as a probability problem plus a context problem. Here is why optional commentary can make agent loops worse, why a clean new thread often works, and how to decide when to reset.',
    '["Codex","AI coding","context engineering"]',
    '[{"label":"Linux.do: A short mitigation for Codex degradation","url":"https://linux.do/t/topic/2490104"},{"label":"Meathill on X: Claude also getting worse","url":"https://x.com/meathill1/status/2069958333218623567"}]'
  ),
  (
    'codex-context-drift',
    'zh',
    'Codex 降智不是玄学：如何减少出错，以及何时该重开对话',
    'Codex 降智更像概率问题叠加上下文污染：某些时候更容易错，而错误输出又会影响后续输出。本文梳理 Linux.do 的低成本缓解方法、可选 commentary 的噪音风险，以及何时应该及时重开对话。',
    '["Codex","AI 编程","上下文工程"]',
    '[{"label":"Linux.do：一句话缓解 Codex 降智","url":"https://linux.do/t/topic/2490104"},{"label":"Meathill 的 X 博文：Claude 也开始变笨","url":"https://x.com/meathill1/status/2069958333218623567"}]'
  ),
  (
    'claude-sonnet-5',
    'en',
    'Claude Sonnet 5 Is Here: Anthropic''s Most Agentic Sonnet Yet Closes the Gap to Opus 4.8',
    'Anthropic released Claude Sonnet 5 on June 30, 2026, pricing agentic coding and tool-use performance close to Opus 4.8 well below Opus rates. Here is what shipped, what independent reviews and benchmarks say, the pricing catch worth knowing about, and what it means if you build with AI.',
    '["Claude Sonnet 5","Anthropic","AI models"]',
    '[{"label":"Anthropic: Claude Sonnet 5 announcement","url":"https://www.anthropic.com/news/claude-sonnet-5"},{"label":"Claude Sonnet 5 System Card","url":"https://www.anthropic.com/claude-sonnet-5-system-card"},{"label":"TechCrunch: Anthropic launches Claude Sonnet 5 as a cheaper way to run agents","url":"https://techcrunch.com/2026/06/30/anthropic-launches-claude-sonnet-5-as-a-cheaper-way-to-run-agents/"},{"label":"CodeRabbit: Claude Sonnet 5 review","url":"https://www.coderabbit.ai/blog/claude-sonnet-5-review"},{"label":"Simon Willison: What''s new in Claude Sonnet 5","url":"https://simonwillison.net/2026/Jun/30/claude-sonnet-5/"}]'
  ),
  (
    'claude-sonnet-5',
    'zh',
    'Claude Sonnet 5 来了：Anthropic 最能干的 Sonnet，性能逼近 Opus 4.8，价格却便宜一大截',
    '2026 年 6 月 30 日，Anthropic 发布 Claude Sonnet 5——目前最具代理能力的 Sonnet 模型，在编码和工具调用等基准上逼近 Opus 4.8，价格却低得多。本文汇总官方数据与独立评测（CodeRabbit、Simon Willison 等），梳理定价里的隐藏条款，以及它对开发者和 MuiRouter 用户意味着什么。',
    '["Claude Sonnet 5","Anthropic","AI 模型"]',
    '[{"label":"Anthropic：Claude Sonnet 5 发布公告","url":"https://www.anthropic.com/news/claude-sonnet-5"},{"label":"Claude Sonnet 5 System Card（系统卡）","url":"https://www.anthropic.com/claude-sonnet-5-system-card"},{"label":"TechCrunch：Anthropic 发布 Claude Sonnet 5，更便宜地运行 agent","url":"https://techcrunch.com/2026/06/30/anthropic-launches-claude-sonnet-5-as-a-cheaper-way-to-run-agents/"},{"label":"CodeRabbit：Claude Sonnet 5 评测","url":"https://www.coderabbit.ai/blog/claude-sonnet-5-review"},{"label":"Simon Willison：Claude Sonnet 5 有什么新变化","url":"https://simonwillison.net/2026/Jun/30/claude-sonnet-5/"}]'
  ),
  (
    'claude-sonnet-5',
    'fr',
    'Claude Sonnet 5 est là : le Sonnet le plus agentique d''Anthropic comble l''écart avec Opus 4.8',
    'Anthropic a lancé Claude Sonnet 5 le 30 juin 2026, avec des performances en codage agentique et en utilisation d''outils proches d''Opus 4.8, à un tarif bien inférieur. Voici ce qui a été publié, ce que disent les benchmarks et les avis indépendants, le piège tarifaire à connaître, et ce que cela signifie si vous développez avec l''IA.',
    '["Claude Sonnet 5","Anthropic","Modèles IA"]',
    '[{"label":"Anthropic : annonce de Claude Sonnet 5","url":"https://www.anthropic.com/news/claude-sonnet-5"},{"label":"System Card de Claude Sonnet 5","url":"https://www.anthropic.com/claude-sonnet-5-system-card"},{"label":"TechCrunch : Anthropic lance Claude Sonnet 5, un moyen moins coûteux de faire tourner des agents","url":"https://techcrunch.com/2026/06/30/anthropic-launches-claude-sonnet-5-as-a-cheaper-way-to-run-agents/"},{"label":"CodeRabbit : avis sur Claude Sonnet 5","url":"https://www.coderabbit.ai/blog/claude-sonnet-5-review"},{"label":"Simon Willison : les nouveautés de Claude Sonnet 5","url":"https://simonwillison.net/2026/Jun/30/claude-sonnet-5/"}]'
  ),
  (
    'claude-sonnet-5',
    'es',
    'Claude Sonnet 5 ya está aquí: el Sonnet más agéntico de Anthropic acorta la distancia con Opus 4.8',
    'Anthropic lanzó Claude Sonnet 5 el 30 de junio de 2026, con un rendimiento en codificación agéntica y uso de herramientas cercano a Opus 4.8, a un precio muy inferior. Esto es lo que se lanzó, lo que dicen los benchmarks y las reseñas independientes, la trampa de precios que conviene conocer, y qué significa si construyes con IA.',
    '["Claude Sonnet 5","Anthropic","Modelos de IA"]',
    '[{"label":"Anthropic: anuncio de Claude Sonnet 5","url":"https://www.anthropic.com/news/claude-sonnet-5"},{"label":"System Card de Claude Sonnet 5","url":"https://www.anthropic.com/claude-sonnet-5-system-card"},{"label":"TechCrunch: Anthropic lanza Claude Sonnet 5 como una forma más barata de ejecutar agentes","url":"https://techcrunch.com/2026/06/30/anthropic-launches-claude-sonnet-5-as-a-cheaper-way-to-run-agents/"},{"label":"CodeRabbit: reseña de Claude Sonnet 5","url":"https://www.coderabbit.ai/blog/claude-sonnet-5-review"},{"label":"Simon Willison: novedades de Claude Sonnet 5","url":"https://simonwillison.net/2026/Jun/30/claude-sonnet-5/"}]'
  ),
  (
    'claude-sonnet-5',
    'pt',
    'Claude Sonnet 5 chegou: o Sonnet mais agêntico da Anthropic encurta a distância para o Opus 4.8',
    'A Anthropic lançou o Claude Sonnet 5 em 30 de junho de 2026, com desempenho em codificação agêntica e uso de ferramentas próximo ao Opus 4.8, a um preço bem menor. Veja o que foi lançado, o que dizem os benchmarks e as análises independentes, a pegadinha de preço que vale conhecer, e o que isso significa para quem constrói com IA.',
    '["Claude Sonnet 5","Anthropic","Modelos de IA"]',
    '[{"label":"Anthropic: anúncio do Claude Sonnet 5","url":"https://www.anthropic.com/news/claude-sonnet-5"},{"label":"System Card do Claude Sonnet 5","url":"https://www.anthropic.com/claude-sonnet-5-system-card"},{"label":"TechCrunch: Anthropic lança o Claude Sonnet 5 como uma forma mais barata de rodar agentes","url":"https://techcrunch.com/2026/06/30/anthropic-launches-claude-sonnet-5-as-a-cheaper-way-to-run-agents/"},{"label":"CodeRabbit: análise do Claude Sonnet 5","url":"https://www.coderabbit.ai/blog/claude-sonnet-5-review"},{"label":"Simon Willison: as novidades do Claude Sonnet 5","url":"https://simonwillison.net/2026/Jun/30/claude-sonnet-5/"}]'
  ),
  (
    'claude-sonnet-5',
    'de',
    'Claude Sonnet 5 ist da: Anthropics bislang agentischstes Sonnet-Modell schließt die Lücke zu Opus 4.8',
    'Anthropic hat am 30. Juni 2026 Claude Sonnet 5 veröffentlicht, mit einer Leistung bei agentischem Coding und Tool-Nutzung nahe an Opus 4.8, aber zu einem deutlich niedrigeren Preis. Hier erfährst du, was veröffentlicht wurde, was Benchmarks und unabhängige Reviews sagen, welchen Haken die Preisgestaltung hat, und was das bedeutet, wenn du mit KI baust.',
    '["Claude Sonnet 5","Anthropic","KI-Modelle"]',
    '[{"label":"Anthropic: Ankündigung von Claude Sonnet 5","url":"https://www.anthropic.com/news/claude-sonnet-5"},{"label":"Claude Sonnet 5 System Card","url":"https://www.anthropic.com/claude-sonnet-5-system-card"},{"label":"TechCrunch: Anthropic bringt Claude Sonnet 5 als günstigeren Weg, Agenten zu betreiben","url":"https://techcrunch.com/2026/06/30/anthropic-launches-claude-sonnet-5-as-a-cheaper-way-to-run-agents/"},{"label":"CodeRabbit: Claude Sonnet 5 im Test","url":"https://www.coderabbit.ai/blog/claude-sonnet-5-review"},{"label":"Simon Willison: Was ist neu bei Claude Sonnet 5","url":"https://simonwillison.net/2026/Jun/30/claude-sonnet-5/"}]'
  ),
  (
    'claude-sonnet-5',
    'th',
    'Claude Sonnet 5 มาแล้ว: Sonnet ที่มีความสามารถเชิง agentic มากที่สุดของ Anthropic ที่ไล่ตามช่องว่างกับ Opus 4.8 ทัน',
    'Anthropic เปิดตัว Claude Sonnet 5 เมื่อวันที่ 30 มิถุนายน 2026 ด้วยประสิทธิภาพด้าน agentic coding และการใช้เครื่องมือที่ใกล้เคียง Opus 4.8 ในราคาที่ต่ำกว่ามาก บทความนี้สรุปสิ่งที่เปิดตัว ผลเบนช์มาร์กและรีวิวอิสระ ข้อควรระวังด้านราคาที่ควรรู้ และความหมายสำหรับคนที่สร้างแอปด้วย AI',
    '["Claude Sonnet 5","Anthropic","โมเดล AI"]',
    '[{"label":"Anthropic: ประกาศเปิดตัว Claude Sonnet 5","url":"https://www.anthropic.com/news/claude-sonnet-5"},{"label":"System Card ของ Claude Sonnet 5","url":"https://www.anthropic.com/claude-sonnet-5-system-card"},{"label":"TechCrunch: Anthropic เปิดตัว Claude Sonnet 5 ทางเลือกรัน agent ที่ถูกกว่า","url":"https://techcrunch.com/2026/06/30/anthropic-launches-claude-sonnet-5-as-a-cheaper-way-to-run-agents/"},{"label":"CodeRabbit: รีวิว Claude Sonnet 5","url":"https://www.coderabbit.ai/blog/claude-sonnet-5-review"},{"label":"Simon Willison: มีอะไรใหม่ใน Claude Sonnet 5","url":"https://simonwillison.net/2026/Jun/30/claude-sonnet-5/"}]'
  ),
  (
    'claude-sonnet-5',
    'ja',
    'Claude Sonnet 5 登場：Anthropic史上最もエージェント的な Sonnet が Opus 4.8 との差を縮める',
    'Anthropic は 2026 年 6 月 30 日に Claude Sonnet 5 を公開しました。agentic coding やツール利用の性能は Opus 4.8 に迫りながら、価格ははるかに安く抑えられています。公開内容、ベンチマークと独立レビューの評価、知っておくべき価格の落とし穴、そして AI で開発する人にとっての意味をまとめます。',
    '["Claude Sonnet 5","Anthropic","AI モデル"]',
    '[{"label":"Anthropic：Claude Sonnet 5 発表","url":"https://www.anthropic.com/news/claude-sonnet-5"},{"label":"Claude Sonnet 5 System Card","url":"https://www.anthropic.com/claude-sonnet-5-system-card"},{"label":"TechCrunch：Anthropic、エージェントをより安く動かす Claude Sonnet 5 を発表","url":"https://techcrunch.com/2026/06/30/anthropic-launches-claude-sonnet-5-as-a-cheaper-way-to-run-agents/"},{"label":"CodeRabbit：Claude Sonnet 5 レビュー","url":"https://www.coderabbit.ai/blog/claude-sonnet-5-review"},{"label":"Simon Willison：Claude Sonnet 5 の新機能","url":"https://simonwillison.net/2026/Jun/30/claude-sonnet-5/"}]'
  ),
  (
    'claude-fable-5',
    'en',
    'Claude Fable 5 Is Here: Anthropic''s Public Mythos-Class Model, with Safety Built In',
    'Anthropic released Claude Fable 5, the public, safety-routed version of its Mythos-class frontier model. Here is what shipped — two-tier Fable 5 / Mythos 5, a classifier-plus-Opus-4.8 fallback, and $10/$50 pricing — and what it means if you build with AI.',
    '["Claude Fable 5","Anthropic","AI models"]',
    '[{"label":"Anthropic: Claude Fable 5 and Claude Mythos 5","url":"https://www.anthropic.com/news/claude-fable-5-mythos-5"},{"label":"Claude Fable 5 on Amazon Bedrock (AWS)","url":"https://aws.amazon.com/blogs/aws/anthropic-claude-fable-5-on-aws-mythos-class-capabilities-with-built-in-safeguards-now-available/"},{"label":"TechCrunch: Anthropic releases Claude Fable 5","url":"https://techcrunch.com/2026/06/09/anthropic-released-claude-fable-5-its-most-powerful-model-publicly-days-after-warning-ai-is-getting-too-dangerous/"},{"label":"CNBC: Anthropic releases Mythos-class Claude Fable 5","url":"https://www.cnbc.com/2026/06/09/anthropic-mythos-claude-fable-5.html"}]'
  ),
  (
    'claude-fable-5',
    'zh',
    'Claude Fable 5 来了：Anthropic 面向公众的 Mythos 级模型，安全内建',
    'Anthropic 发布了 Claude Fable 5——其 Mythos 级前沿模型「带安全路由」的公开版本。本文梳理这次发布的关键：Fable 5 / Mythos 5 双档、分类器 + Opus 4.8 兜底、$10/$50 定价，以及它对开发者意味着什么。',
    '["Claude Fable 5","Anthropic","AI 模型"]',
    '[{"label":"Anthropic：Claude Fable 5 与 Claude Mythos 5 公告","url":"https://www.anthropic.com/news/claude-fable-5-mythos-5"},{"label":"Amazon Bedrock 上的 Claude Fable 5（AWS）","url":"https://aws.amazon.com/blogs/aws/anthropic-claude-fable-5-on-aws-mythos-class-capabilities-with-built-in-safeguards-now-available/"},{"label":"TechCrunch：Anthropic 发布 Claude Fable 5","url":"https://techcrunch.com/2026/06/09/anthropic-released-claude-fable-5-its-most-powerful-model-publicly-days-after-warning-ai-is-getting-too-dangerous/"},{"label":"CNBC：Anthropic 发布 Mythos 级 Claude Fable 5","url":"https://www.cnbc.com/2026/06/09/anthropic-mythos-claude-fable-5.html"}]'
  ),
  (
    'gpt-5-5',
    'en',
    'GPT-5.5 Is Here: OpenAI''s New Work Model Changes What AI Can Do for You',
    'OpenAI has released GPT-5.5 for ChatGPT and Codex, with stronger agentic coding, computer use, knowledge work, and research capabilities. Here is what changed and how to prepare for API access.',
    '["GPT-5.5","OpenAI","AI models"]',
    '[{"label":"OpenAI GPT-5.5 announcement","url":"https://openai.com/index/introducing-gpt-5-5/"},{"label":"GPT-5.5 System Card","url":"https://openai.com/index/gpt-5-5-system-card/"},{"label":"GPT-5.3 and GPT-5.5 in ChatGPT","url":"https://help.openai.com/en/articles/11909943-gpt-53-and-gpt-54-in-chatgpt"},{"label":"OpenAI API Pricing","url":"https://openai.com/api/pricing/"}]'
  ),
  (
    'gpt-5-5',
    'zh',
    'GPT-5.5 已发布：OpenAI 的新工作模型正在改变 AI 能为你做什么',
    'OpenAI 已在 ChatGPT 和 Codex 中发布 GPT-5.5，强化了 agentic coding、computer use、知识工作和科研能力。这里梳理关键变化，以及如何为 API 接入做好准备。',
    '["GPT-5.5","OpenAI","AI 模型"]',
    '[{"label":"OpenAI GPT-5.5 发布公告","url":"https://openai.com/index/introducing-gpt-5-5/"},{"label":"GPT-5.5 系统卡","url":"https://openai.com/index/gpt-5-5-system-card/"},{"label":"ChatGPT 中的 GPT-5.3 和 GPT-5.5","url":"https://help.openai.com/en/articles/11909943-gpt-53-and-gpt-54-in-chatgpt"},{"label":"OpenAI API 价格","url":"https://openai.com/api/pricing/"}]'
  ),
  (
    'gpt-5-5',
    'fr',
    'GPT-5.5 est là : le nouveau modèle de travail d''OpenAI change ce que l''IA peut faire pour vous',
    'OpenAI a publié GPT-5.5 pour ChatGPT et Codex, avec de meilleurs résultats en agentic coding, computer use, travail de connaissance et recherche scientifique. Voici ce qui change et comment préparer l''accès API.',
    '["GPT-5.5","OpenAI","Modèles IA"]',
    '[{"label":"Annonce GPT-5.5 d’OpenAI","url":"https://openai.com/index/introducing-gpt-5-5/"},{"label":"System Card GPT-5.5","url":"https://openai.com/index/gpt-5-5-system-card/"},{"label":"GPT-5.3 et GPT-5.5 dans ChatGPT","url":"https://help.openai.com/en/articles/11909943-gpt-53-and-gpt-54-in-chatgpt"},{"label":"Tarifs de l’API OpenAI","url":"https://openai.com/api/pricing/"}]'
  ),
  (
    'gpt-5-5',
    'es',
    'GPT-5.5 ya está aquí: el nuevo modelo de trabajo de OpenAI cambia lo que la IA puede hacer por ti',
    'OpenAI lanzó GPT-5.5 para ChatGPT y Codex, con más capacidad en agentic coding, computer use, trabajo de conocimiento e investigación científica. Esto es lo que cambió y cómo prepararte para el acceso API.',
    '["GPT-5.5","OpenAI","Modelos de IA"]',
    '[{"label":"Anuncio de GPT-5.5 de OpenAI","url":"https://openai.com/index/introducing-gpt-5-5/"},{"label":"Tarjeta del sistema GPT-5.5","url":"https://openai.com/index/gpt-5-5-system-card/"},{"label":"GPT-5.3 y GPT-5.5 en ChatGPT","url":"https://help.openai.com/en/articles/11909943-gpt-53-and-gpt-54-in-chatgpt"},{"label":"Precios de la API de OpenAI","url":"https://openai.com/api/pricing/"}]'
  ),
  (
    'gpt-5-5',
    'pt',
    'GPT-5.5 chegou: o novo modelo de trabalho da OpenAI muda o que a IA pode fazer por você',
    'A OpenAI lançou o GPT-5.5 para ChatGPT e Codex, com avanços em agentic coding, computer use, trabalho de conhecimento e pesquisa científica. Veja o que mudou e como se preparar para o acesso via API.',
    '["GPT-5.5","OpenAI","Modelos de IA"]',
    '[{"label":"Anúncio do GPT-5.5 da OpenAI","url":"https://openai.com/index/introducing-gpt-5-5/"},{"label":"System Card do GPT-5.5","url":"https://openai.com/index/gpt-5-5-system-card/"},{"label":"GPT-5.3 e GPT-5.5 no ChatGPT","url":"https://help.openai.com/en/articles/11909943-gpt-53-and-gpt-54-in-chatgpt"},{"label":"Preços da API da OpenAI","url":"https://openai.com/api/pricing/"}]'
  ),
  (
    'gpt-5-5',
    'de',
    'GPT-5.5 ist da: OpenAIs neues Arbeitsmodell verändert, was KI für dich tun kann',
    'OpenAI hat GPT-5.5 für ChatGPT und Codex veröffentlicht, mit stärkeren Fähigkeiten bei agentic coding, computer use, Wissensarbeit und wissenschaftlicher Forschung. Das hat sich geändert und so bereitest du dich auf den API-Zugang vor.',
    '["GPT-5.5","OpenAI","KI-Modelle"]',
    '[{"label":"OpenAI-Ankündigung zu GPT-5.5","url":"https://openai.com/index/introducing-gpt-5-5/"},{"label":"GPT-5.5 System Card","url":"https://openai.com/index/gpt-5-5-system-card/"},{"label":"GPT-5.3 und GPT-5.5 in ChatGPT","url":"https://help.openai.com/en/articles/11909943-gpt-53-and-gpt-54-in-chatgpt"},{"label":"OpenAI API-Preise","url":"https://openai.com/api/pricing/"}]'
  ),
  (
    'gpt-5-5',
    'th',
    'GPT-5.5 มาแล้ว: โมเดลทำงานรุ่นใหม่ของ OpenAI กำลังเปลี่ยนสิ่งที่ AI ทำให้คุณได้',
    'OpenAI เปิดตัว GPT-5.5 สำหรับ ChatGPT และ Codex พร้อมความสามารถที่ดีขึ้นด้าน agentic coding, computer use, งานความรู้ และงานวิจัยทางวิทยาศาสตร์ นี่คือสิ่งที่เปลี่ยนไปและวิธีเตรียมตัวสำหรับ API',
    '["GPT-5.5","OpenAI","โมเดล AI"]',
    '[{"label":"ประกาศ GPT-5.5 ของ OpenAI","url":"https://openai.com/index/introducing-gpt-5-5/"},{"label":"System Card ของ GPT-5.5","url":"https://openai.com/index/gpt-5-5-system-card/"},{"label":"GPT-5.3 และ GPT-5.5 ใน ChatGPT","url":"https://help.openai.com/en/articles/11909943-gpt-53-and-gpt-54-in-chatgpt"},{"label":"ราคา OpenAI API","url":"https://openai.com/api/pricing/"}]'
  ),
  (
    'gpt-5-5',
    'ja',
    'GPT-5.5 登場：OpenAI の新しいワークモデルが AI にできることを変える',
    'OpenAI は ChatGPT と Codex 向けに GPT-5.5 を公開しました。agentic coding、computer use、ナレッジワーク、科学研究の能力が強化されています。変更点と API アクセスに備える方法を整理します。',
    '["GPT-5.5","OpenAI","AI モデル"]',
    '[{"label":"OpenAI GPT-5.5 発表","url":"https://openai.com/index/introducing-gpt-5-5/"},{"label":"GPT-5.5 System Card","url":"https://openai.com/index/gpt-5-5-system-card/"},{"label":"ChatGPT における GPT-5.3 と GPT-5.5","url":"https://help.openai.com/en/articles/11909943-gpt-53-and-gpt-54-in-chatgpt"},{"label":"OpenAI API 料金","url":"https://openai.com/api/pricing/"}]'
  );
