-- 新增博客文章：Kimi K3 发布与 MuiRouter 接入（8 语言）。
-- 正文见 packages/dashboard/src/content/blog/kimi-k3*.mdx。

INSERT OR REPLACE INTO blog_posts (slug, published_at, source_published_at, reading_minutes, status)
VALUES
  ('kimi-k3', '2026-07-17', '2026-07-17', 7, 'published');

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
    'kimi-k3',
    'en',
    'Kimi K3 Is Here: The First Open 3T-Class Model, Now on MuiRouter',
    'Kimi K3 combines 2.8T parameters, a 1M-token context window, native vision, and max thinking. MuiRouter now supports it through the API and Playground with one API key.',
    '["Kimi K3","Moonshot AI","AI models"]',
    '[{"label":"Official Kimi K3 release","url":"https://www.kimi.com/blog/kimi-k3"},{"label":"Kimi K3 API guide","url":"https://platform.kimi.ai/docs/guide/kimi-k3-quickstart"},{"label":"Official Kimi K3 pricing","url":"https://platform.kimi.ai/docs/pricing/chat-k3"},{"label":"Kimi vision input guide","url":"https://platform.kimi.ai/docs/guide/use-kimi-vision-model"}]'
  ),
  (
    'kimi-k3',
    'zh',
    'Kimi K3 发布：首个 3T 级开放模型，MuiRouter 已接入',
    'Kimi K3 带来 2.8T 参数、1M context、原生视觉和 max thinking。MuiRouter 已完成 API 与 Playground 接入，一把 API Key 即可调用。',
    '["Kimi K3","Moonshot AI","AI 模型"]',
    '[{"label":"Kimi K3 官方发布文章","url":"https://www.kimi.com/blog/kimi-k3"},{"label":"Kimi K3 API 指南","url":"https://platform.kimi.ai/docs/guide/kimi-k3-quickstart"},{"label":"Kimi K3 官方价格","url":"https://platform.kimi.ai/docs/pricing/chat-k3"},{"label":"Kimi 视觉输入指南","url":"https://platform.kimi.ai/docs/guide/use-kimi-vision-model"}]'
  ),
  (
    'kimi-k3',
    'fr',
    'Kimi K3 est là : le premier modèle ouvert de classe 3T, maintenant sur MuiRouter',
    'Kimi K3 réunit 2,8 billions de paramètres, un contexte de 1M tokens, la vision native et le max thinking. MuiRouter le propose désormais via son API et son Playground avec une seule clé API.',
    '["Kimi K3","Moonshot AI","Modèles IA"]',
    '[{"label":"Annonce officielle de Kimi K3","url":"https://www.kimi.com/blog/kimi-k3"},{"label":"Guide API de Kimi K3","url":"https://platform.kimi.ai/docs/guide/kimi-k3-quickstart"},{"label":"Tarifs officiels de Kimi K3","url":"https://platform.kimi.ai/docs/pricing/chat-k3"},{"label":"Guide des entrées visuelles Kimi","url":"https://platform.kimi.ai/docs/guide/use-kimi-vision-model"}]'
  ),
  (
    'kimi-k3',
    'es',
    'Kimi K3 ya está aquí: el primer modelo abierto de clase 3T, ahora en MuiRouter',
    'Kimi K3 reúne 2,8 billones de parámetros, un contexto de 1M tokens, visión nativa y max thinking. MuiRouter ya lo ofrece mediante su API y Playground con una sola clave API.',
    '["Kimi K3","Moonshot AI","Modelos de IA"]',
    '[{"label":"Anuncio oficial de Kimi K3","url":"https://www.kimi.com/blog/kimi-k3"},{"label":"Guía de la API de Kimi K3","url":"https://platform.kimi.ai/docs/guide/kimi-k3-quickstart"},{"label":"Precios oficiales de Kimi K3","url":"https://platform.kimi.ai/docs/pricing/chat-k3"},{"label":"Guía de entrada visual de Kimi","url":"https://platform.kimi.ai/docs/guide/use-kimi-vision-model"}]'
  ),
  (
    'kimi-k3',
    'pt',
    'Kimi K3 chegou: o primeiro modelo aberto de classe 3T, agora no MuiRouter',
    'O Kimi K3 reúne 2,8 trilhões de parâmetros, contexto de 1M tokens, visão nativa e max thinking. O MuiRouter já oferece o modelo pela API e pelo Playground com uma única chave de API.',
    '["Kimi K3","Moonshot AI","Modelos de IA"]',
    '[{"label":"Anúncio oficial do Kimi K3","url":"https://www.kimi.com/blog/kimi-k3"},{"label":"Guia da API do Kimi K3","url":"https://platform.kimi.ai/docs/guide/kimi-k3-quickstart"},{"label":"Preços oficiais do Kimi K3","url":"https://platform.kimi.ai/docs/pricing/chat-k3"},{"label":"Guia de entrada visual do Kimi","url":"https://platform.kimi.ai/docs/guide/use-kimi-vision-model"}]'
  ),
  (
    'kimi-k3',
    'de',
    'Kimi K3 ist da: das erste offene Modell der 3T-Klasse, jetzt auf MuiRouter',
    'Kimi K3 vereint 2,8 Billionen Parameter, ein Kontextfenster mit 1M Tokens, native Vision und max thinking. MuiRouter bietet es jetzt per API und Playground mit einem einzigen API Key an.',
    '["Kimi K3","Moonshot AI","KI-Modelle"]',
    '[{"label":"Offizielle Ankündigung von Kimi K3","url":"https://www.kimi.com/blog/kimi-k3"},{"label":"API-Leitfaden für Kimi K3","url":"https://platform.kimi.ai/docs/guide/kimi-k3-quickstart"},{"label":"Offizielle Preise für Kimi K3","url":"https://platform.kimi.ai/docs/pricing/chat-k3"},{"label":"Leitfaden für visuelle Kimi-Eingaben","url":"https://platform.kimi.ai/docs/guide/use-kimi-vision-model"}]'
  ),
  (
    'kimi-k3',
    'th',
    'Kimi K3 มาแล้ว: โมเดลเปิดระดับ 3T ตัวแรก พร้อมใช้บน MuiRouter',
    'Kimi K3 รวมพารามิเตอร์ 2.8T, context 1M tokens, vision แบบ native และ max thinking ตอนนี้ MuiRouter รองรับแล้วทั้ง API และ Playground ด้วย API Key เพียงชุดเดียว',
    '["Kimi K3","Moonshot AI","โมเดล AI"]',
    '[{"label":"ประกาศ Kimi K3 อย่างเป็นทางการ","url":"https://www.kimi.com/blog/kimi-k3"},{"label":"คู่มือ API ของ Kimi K3","url":"https://platform.kimi.ai/docs/guide/kimi-k3-quickstart"},{"label":"ราคา Kimi K3 อย่างเป็นทางการ","url":"https://platform.kimi.ai/docs/pricing/chat-k3"},{"label":"คู่มือการส่งข้อมูลภาพของ Kimi","url":"https://platform.kimi.ai/docs/guide/use-kimi-vision-model"}]'
  ),
  (
    'kimi-k3',
    'ja',
    'Kimi K3 登場：初のオープン3T級モデル、MuiRouterに対応',
    'Kimi K3 は 2.8T パラメータ、1M token コンテキスト、ネイティブ Vision、max thinking を備えます。MuiRouter の API と Playground から、1 つの API Key で利用できます。',
    '["Kimi K3","Moonshot AI","AI モデル"]',
    '[{"label":"Kimi K3 公式発表","url":"https://www.kimi.com/blog/kimi-k3"},{"label":"Kimi K3 API ガイド","url":"https://platform.kimi.ai/docs/guide/kimi-k3-quickstart"},{"label":"Kimi K3 公式料金","url":"https://platform.kimi.ai/docs/pricing/chat-k3"},{"label":"Kimi 画像入力ガイド","url":"https://platform.kimi.ai/docs/guide/use-kimi-vision-model"}]'
  );
