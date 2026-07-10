-- 补齐既有博客文章的 fr/es/pt/de/th/ja metadata。
-- 正文见 packages/dashboard/src/content/blog/{slug}.{locale}.mdx。

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
    'fr',
    'Codex ne se dégrade pas par magie : réduire les erreurs, puis réinitialiser le contexte',
    'La dégradation de Codex se comprend mieux comme un problème de probabilité et de contexte. Voici pourquoi les commentaires optionnels peuvent aggraver les boucles agentiques, pourquoi un nouveau fil propre fonctionne souvent, et quand réinitialiser.',
    '["Codex","AI coding","ingénierie du contexte"]',
    '[{"label":"Linux.do : une mitigation courte pour la dégradation de Codex","url":"https://linux.do/t/topic/2490104"},{"label":"Meathill sur X : Claude devient aussi moins fiable","url":"https://x.com/meathill1/status/2069958333218623567"}]'
  ),
  (
    'codex-context-drift',
    'es',
    'Que Codex empeore no es magia: reduce errores y luego reinicia el contexto',
    'La degradación de Codex se entiende mejor como un problema de probabilidad más un problema de contexto. Por qué el comentario opcional puede empeorar los bucles de agentes, por qué un hilo nuevo suele funcionar, y cuándo reiniciar.',
    '["Codex","AI coding","ingeniería de contexto"]',
    '[{"label":"Linux.do: una mitigación corta para la degradación de Codex","url":"https://linux.do/t/topic/2490104"},{"label":"Meathill en X: Claude también está empeorando","url":"https://x.com/meathill1/status/2069958333218623567"}]'
  ),
  (
    'codex-context-drift',
    'pt',
    'Codex piorando não é magia: reduza erros e depois reinicie o contexto',
    'A degradação do Codex é melhor entendida como um problema de probabilidade somado a um problema de contexto. Por que comentários opcionais podem piorar loops de agentes, por que uma conversa limpa costuma funcionar e quando reiniciar.',
    '["Codex","AI coding","engenharia de contexto"]',
    '[{"label":"Linux.do: uma mitigação curta para a degradação do Codex","url":"https://linux.do/t/topic/2490104"},{"label":"Meathill no X: Claude também está piorando","url":"https://x.com/meathill1/status/2069958333218623567"}]'
  ),
  (
    'codex-context-drift',
    'de',
    'Codex wird nicht durch Magie schlechter: Fehler reduzieren, dann Kontext zurücksetzen',
    'Codex-Degradation versteht man besser als Wahrscheinlichkeitsproblem plus Kontextproblem. Warum optionale Kommentare Agent-Schleifen verschlechtern können, warum ein sauberer neuer Thread oft funktioniert, und wann man zurücksetzen sollte.',
    '["Codex","AI coding","Kontext-Engineering"]',
    '[{"label":"Linux.do: kurze Gegenmaßnahme gegen Codex-Degradation","url":"https://linux.do/t/topic/2490104"},{"label":"Meathill auf X: Claude wird auch schlechter","url":"https://x.com/meathill1/status/2069958333218623567"}]'
  ),
  (
    'codex-context-drift',
    'th',
    'Codex แย่ลงไม่ใช่เวทมนตร์: ลดข้อผิดพลาด แล้วค่อยรีเซ็ต context',
    'อาการ Codex เสื่อมควรมองเป็นปัญหาความน่าจะเป็นบวกกับปัญหา context: ทำไม commentary เสริมอาจทำให้ agent loop แย่ลง ทำไม thread ใหม่ที่สะอาดมักช่วยได้ และควรรีเซ็ตเมื่อไร',
    '["Codex","AI coding","context engineering"]',
    '[{"label":"Linux.do: วิธีบรรเทาอาการ Codex เสื่อมแบบสั้น","url":"https://linux.do/t/topic/2490104"},{"label":"Meathill บน X: Claude ก็แย่ลงเช่นกัน","url":"https://x.com/meathill1/status/2069958333218623567"}]'
  ),
  (
    'codex-context-drift',
    'ja',
    'Codex の悪化は魔法ではない：エラーを減らし、コンテキストをリセットする',
    'Codex の劣化は、確率の問題とコンテキストの問題として捉える方がよい。任意の commentary が agent loop を悪化させる理由、きれいな新規 thread が効く理由、そしていつリセットすべきか。',
    '["Codex","AI coding","context engineering"]',
    '[{"label":"Linux.do：Codex 劣化への短い mitigation","url":"https://linux.do/t/topic/2490104"},{"label":"Meathill on X：Claude も悪化している","url":"https://x.com/meathill1/status/2069958333218623567"}]'
  ),
  (
    'claude-fable-5',
    'fr',
    'Claude Fable 5 est là : le modèle Mythos public d’Anthropic, avec sécurité intégrée',
    'Anthropic a publié Claude Fable 5, la version publique avec routage de sécurité de son modèle frontier de classe Mythos. Voici ce qui a été livré, les deux niveaux Fable 5 et Mythos 5, le repli classificateur vers Opus 4.8, la tarification 10/50 dollars, et ce que cela signifie pour les développeurs IA.',
    '["Claude Fable 5","Anthropic","Modèles IA"]',
    '[{"label":"Anthropic : Claude Fable 5 et Claude Mythos 5","url":"https://www.anthropic.com/news/claude-fable-5-mythos-5"},{"label":"Claude Fable 5 sur Amazon Bedrock (AWS)","url":"https://aws.amazon.com/blogs/aws/anthropic-claude-fable-5-on-aws-mythos-class-capabilities-with-built-in-safeguards-now-available/"},{"label":"TechCrunch : Anthropic publie Claude Fable 5","url":"https://techcrunch.com/2026/06/09/anthropic-released-claude-fable-5-its-most-powerful-model-publicly-days-after-warning-ai-is-getting-too-dangerous/"},{"label":"CNBC : Anthropic publie Claude Fable 5 de classe Mythos","url":"https://www.cnbc.com/2026/06/09/anthropic-mythos-claude-fable-5.html"}]'
  ),
  (
    'claude-fable-5',
    'es',
    'Claude Fable 5 ya está aquí: el modelo Mythos público de Anthropic, con seguridad integrada',
    'Anthropic lanzó Claude Fable 5, la versión pública con enrutamiento de seguridad de su modelo frontier de clase Mythos. Esto es lo que llegó: dos niveles Fable 5 y Mythos 5, fallback clasificador hacia Opus 4.8, precio de 10/50 dólares, y qué significa si construyes con IA.',
    '["Claude Fable 5","Anthropic","Modelos de IA"]',
    '[{"label":"Anthropic: Claude Fable 5 y Claude Mythos 5","url":"https://www.anthropic.com/news/claude-fable-5-mythos-5"},{"label":"Claude Fable 5 en Amazon Bedrock (AWS)","url":"https://aws.amazon.com/blogs/aws/anthropic-claude-fable-5-on-aws-mythos-class-capabilities-with-built-in-safeguards-now-available/"},{"label":"TechCrunch: Anthropic lanza Claude Fable 5","url":"https://techcrunch.com/2026/06/09/anthropic-released-claude-fable-5-its-most-powerful-model-publicly-days-after-warning-ai-is-getting-too-dangerous/"},{"label":"CNBC: Anthropic lanza Claude Fable 5 de clase Mythos","url":"https://www.cnbc.com/2026/06/09/anthropic-mythos-claude-fable-5.html"}]'
  ),
  (
    'claude-fable-5',
    'pt',
    'Claude Fable 5 chegou: o modelo Mythos público da Anthropic, com segurança embutida',
    'A Anthropic lançou o Claude Fable 5, a versão pública com roteamento de segurança do seu modelo frontier de classe Mythos. Veja o que foi lançado: dois níveis Fable 5 e Mythos 5, fallback de classificador para Opus 4.8, preço de 10/50 dólares, e o que isso significa para quem constrói com IA.',
    '["Claude Fable 5","Anthropic","Modelos de IA"]',
    '[{"label":"Anthropic: Claude Fable 5 e Claude Mythos 5","url":"https://www.anthropic.com/news/claude-fable-5-mythos-5"},{"label":"Claude Fable 5 no Amazon Bedrock (AWS)","url":"https://aws.amazon.com/blogs/aws/anthropic-claude-fable-5-on-aws-mythos-class-capabilities-with-built-in-safeguards-now-available/"},{"label":"TechCrunch: Anthropic lança Claude Fable 5","url":"https://techcrunch.com/2026/06/09/anthropic-released-claude-fable-5-its-most-powerful-model-publicly-days-after-warning-ai-is-getting-too-dangerous/"},{"label":"CNBC: Anthropic lança Claude Fable 5 de classe Mythos","url":"https://www.cnbc.com/2026/06/09/anthropic-mythos-claude-fable-5.html"}]'
  ),
  (
    'claude-fable-5',
    'de',
    'Claude Fable 5 ist da: Anthropics öffentliches Mythos-Klasse-Modell mit eingebauter Sicherheit',
    'Anthropic hat Claude Fable 5 veröffentlicht, die öffentliche sicherheitsgeroutete Version seines Frontier-Modells der Mythos-Klasse. Das wurde geliefert: zwei Stufen Fable 5 und Mythos 5, Klassifikator-Fallback zu Opus 4.8, 10/50-Dollar-Preise, und was das für KI-Entwickler bedeutet.',
    '["Claude Fable 5","Anthropic","KI-Modelle"]',
    '[{"label":"Anthropic: Claude Fable 5 und Claude Mythos 5","url":"https://www.anthropic.com/news/claude-fable-5-mythos-5"},{"label":"Claude Fable 5 auf Amazon Bedrock (AWS)","url":"https://aws.amazon.com/blogs/aws/anthropic-claude-fable-5-on-aws-mythos-class-capabilities-with-built-in-safeguards-now-available/"},{"label":"TechCrunch: Anthropic veröffentlicht Claude Fable 5","url":"https://techcrunch.com/2026/06/09/anthropic-released-claude-fable-5-its-most-powerful-model-publicly-days-after-warning-ai-is-getting-too-dangerous/"},{"label":"CNBC: Anthropic veröffentlicht Claude Fable 5 der Mythos-Klasse","url":"https://www.cnbc.com/2026/06/09/anthropic-mythos-claude-fable-5.html"}]'
  ),
  (
    'claude-fable-5',
    'th',
    'Claude Fable 5 มาแล้ว: โมเดล Mythos สาธารณะของ Anthropic พร้อม safety ในตัว',
    'Anthropic เปิดตัว Claude Fable 5 เวอร์ชันสาธารณะที่มี safety routing ของโมเดล frontier ระดับ Mythos บทความนี้สรุปสิ่งที่เปิดตัว: Fable 5 / Mythos 5 สอง tier, classifier fallback ไป Opus 4.8, ราคา $10/$50 และความหมายสำหรับคนที่สร้างด้วย AI',
    '["Claude Fable 5","Anthropic","โมเดล AI"]',
    '[{"label":"Anthropic: Claude Fable 5 และ Claude Mythos 5","url":"https://www.anthropic.com/news/claude-fable-5-mythos-5"},{"label":"Claude Fable 5 บน Amazon Bedrock (AWS)","url":"https://aws.amazon.com/blogs/aws/anthropic-claude-fable-5-on-aws-mythos-class-capabilities-with-built-in-safeguards-now-available/"},{"label":"TechCrunch: Anthropic เปิดตัว Claude Fable 5","url":"https://techcrunch.com/2026/06/09/anthropic-released-claude-fable-5-its-most-powerful-model-publicly-days-after-warning-ai-is-getting-too-dangerous/"},{"label":"CNBC: Anthropic เปิดตัว Claude Fable 5 ระดับ Mythos","url":"https://www.cnbc.com/2026/06/09/anthropic-mythos-claude-fable-5.html"}]'
  ),
  (
    'claude-fable-5',
    'ja',
    'Claude Fable 5 登場：安全性を組み込んだ Anthropic の公開 Mythos クラスモデル',
    'Anthropic は Claude Fable 5 を公開した。これは Mythos クラス frontier model の公開版で、安全性 routing を備えている。Fable 5 / Mythos 5 の二段構成、classifier と Opus 4.8 fallback、10/50 ドルの価格、そして AI 開発者にとっての意味を整理する。',
    '["Claude Fable 5","Anthropic","AI モデル"]',
    '[{"label":"Anthropic：Claude Fable 5 and Claude Mythos 5","url":"https://www.anthropic.com/news/claude-fable-5-mythos-5"},{"label":"Amazon Bedrock 上の Claude Fable 5 (AWS)","url":"https://aws.amazon.com/blogs/aws/anthropic-claude-fable-5-on-aws-mythos-class-capabilities-with-built-in-safeguards-now-available/"},{"label":"TechCrunch：Anthropic が Claude Fable 5 を公開","url":"https://techcrunch.com/2026/06/09/anthropic-released-claude-fable-5-its-most-powerful-model-publicly-days-after-warning-ai-is-getting-too-dangerous/"},{"label":"CNBC：Anthropic が Mythos クラス Claude Fable 5 を公開","url":"https://www.cnbc.com/2026/06/09/anthropic-mythos-claude-fable-5.html"}]'
  ),
  (
    'xai-grok',
    'fr',
    'Grok 4.5 est là : le nouveau flagship de classe Opus de xAI, maintenant sur MuiRouter',
    'xAI a livré Grok 4.5, un nouveau flagship entraîné avec Cursor et benchmarké face à Claude Opus 4.8, puis Grok est arrivé sur Cloudflare AI Gateway. Nous avons ajouté grok-4.5, grok-4.3 et grok-imagine-image au catalogue MuiRouter : voici ce qui a été publié et comment démarrer.',
    '["Grok 4.5","xAI","Modèles IA"]',
    '[{"label":"xAI : Introducing Grok 4.5","url":"https://x.ai/news/grok-4-5"},{"label":"MarkTechPost : SpaceXAI publie Grok 4.5","url":"https://www.marktechpost.com/2026/07/08/spacexai-releases-grok-4-5/"},{"label":"Cloudflare AI Gateway : provider xAI Grok","url":"https://developers.cloudflare.com/ai-gateway/usage/providers/grok/"},{"label":"xAI : Grok Imagine Video 1.5","url":"https://x.ai/news/grok-imagine-video-1-5"}]'
  ),
  (
    'xai-grok',
    'es',
    'Grok 4.5 ya está aquí: el nuevo flagship de clase Opus de xAI, ahora en MuiRouter',
    'xAI lanzó Grok 4.5, un nuevo flagship entrenado junto a Cursor y comparado con Claude Opus 4.8, y luego llevó Grok a Cloudflare AI Gateway. Hemos añadido grok-4.5, grok-4.3 y grok-imagine-image al catálogo de MuiRouter: esto es lo que llegó y cómo empezar.',
    '["Grok 4.5","xAI","Modelos de IA"]',
    '[{"label":"xAI: Introducing Grok 4.5","url":"https://x.ai/news/grok-4-5"},{"label":"MarkTechPost: SpaceXAI lanza Grok 4.5","url":"https://www.marktechpost.com/2026/07/08/spacexai-releases-grok-4-5/"},{"label":"Cloudflare AI Gateway: proveedor xAI Grok","url":"https://developers.cloudflare.com/ai-gateway/usage/providers/grok/"},{"label":"xAI: Grok Imagine Video 1.5","url":"https://x.ai/news/grok-imagine-video-1-5"}]'
  ),
  (
    'xai-grok',
    'pt',
    'Grok 4.5 chegou: o novo flagship de classe Opus da xAI, agora no MuiRouter',
    'A xAI lançou o Grok 4.5, um novo flagship treinado junto com o Cursor e comparado ao Claude Opus 4.8, e depois levou Grok ao Cloudflare AI Gateway. Adicionamos grok-4.5, grok-4.3 e grok-imagine-image ao catálogo do MuiRouter: veja o que foi lançado e como começar.',
    '["Grok 4.5","xAI","Modelos de IA"]',
    '[{"label":"xAI: Introducing Grok 4.5","url":"https://x.ai/news/grok-4-5"},{"label":"MarkTechPost: SpaceXAI lança Grok 4.5","url":"https://www.marktechpost.com/2026/07/08/spacexai-releases-grok-4-5/"},{"label":"Cloudflare AI Gateway: provider xAI Grok","url":"https://developers.cloudflare.com/ai-gateway/usage/providers/grok/"},{"label":"xAI: Grok Imagine Video 1.5","url":"https://x.ai/news/grok-imagine-video-1-5"}]'
  ),
  (
    'xai-grok',
    'de',
    'Grok 4.5 ist da: xAIs neues Flagship der Opus-Klasse, jetzt auf MuiRouter',
    'xAI hat Grok 4.5 veröffentlicht, ein neues Flagship, das zusammen mit Cursor trainiert und gegen Claude Opus 4.8 benchmarked wurde, danach kam Grok auf Cloudflare AI Gateway. Wir haben grok-4.5, grok-4.3 und grok-imagine-image in den MuiRouter-Katalog aufgenommen: das wurde geliefert und so starten Sie.',
    '["Grok 4.5","xAI","KI-Modelle"]',
    '[{"label":"xAI: Introducing Grok 4.5","url":"https://x.ai/news/grok-4-5"},{"label":"MarkTechPost: SpaceXAI veröffentlicht Grok 4.5","url":"https://www.marktechpost.com/2026/07/08/spacexai-releases-grok-4-5/"},{"label":"Cloudflare AI Gateway: xAI Grok Provider","url":"https://developers.cloudflare.com/ai-gateway/usage/providers/grok/"},{"label":"xAI: Grok Imagine Video 1.5","url":"https://x.ai/news/grok-imagine-video-1-5"}]'
  ),
  (
    'xai-grok',
    'th',
    'Grok 4.5 มาแล้ว: flagship ใหม่ระดับ Opus ของ xAI บน MuiRouter แล้ว',
    'xAI เปิดตัว Grok 4.5 flagship ใหม่ที่ train ร่วมกับ Cursor และ benchmark เทียบ Claude Opus 4.8 จากนั้น Grok ก็ขึ้น Cloudflare AI Gateway เราเพิ่ม grok-4.5, grok-4.3 และ grok-imagine-image เข้า catalog ของ MuiRouter แล้ว: นี่คือสิ่งที่เปิดตัวและวิธีเริ่มใช้งาน',
    '["Grok 4.5","xAI","โมเดล AI"]',
    '[{"label":"xAI: Introducing Grok 4.5","url":"https://x.ai/news/grok-4-5"},{"label":"MarkTechPost: SpaceXAI เปิดตัว Grok 4.5","url":"https://www.marktechpost.com/2026/07/08/spacexai-releases-grok-4-5/"},{"label":"Cloudflare AI Gateway: provider xAI Grok","url":"https://developers.cloudflare.com/ai-gateway/usage/providers/grok/"},{"label":"xAI: Grok Imagine Video 1.5","url":"https://x.ai/news/grok-imagine-video-1-5"}]'
  ),
  (
    'xai-grok',
    'ja',
    'Grok 4.5 登場：xAI の新しい Opus クラス flagship、MuiRouter に対応',
    'xAI は Grok 4.5 を公開した。Cursor とともに train され、Claude Opus 4.8 と benchmark 比較された新 flagship であり、その後 Grok は Cloudflare AI Gateway に対応した。MuiRouter catalog に grok-4.5、grok-4.3、grok-imagine-image を追加したので、公開内容と使い始め方をまとめる。',
    '["Grok 4.5","xAI","AI モデル"]',
    '[{"label":"xAI：Introducing Grok 4.5","url":"https://x.ai/news/grok-4-5"},{"label":"MarkTechPost：SpaceXAI が Grok 4.5 を公開","url":"https://www.marktechpost.com/2026/07/08/spacexai-releases-grok-4-5/"},{"label":"Cloudflare AI Gateway：xAI Grok provider","url":"https://developers.cloudflare.com/ai-gateway/usage/providers/grok/"},{"label":"xAI：Grok Imagine Video 1.5","url":"https://x.ai/news/grok-imagine-video-1-5"}]'
  );
