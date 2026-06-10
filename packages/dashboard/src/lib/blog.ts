import { defaultLocale, type Locale } from '@/i18n/config';

// 旧导入入口：路径/hreflang 的真实实现已迁到 lib/seo.ts，这里只做转发。
export { getLanguageAlternates, getLocalizedPath, getResolvedLocale } from '@/lib/seo';

export type BlogSource = {
  label: string;
  url: string;
};

export type LocalizedBlogPost = {
  slug: string;
  href: string;
  title: string;
  description: string;
  publishedAt: string;
  sourcePublishedAt: string;
  readingMinutes: number;
  tags: readonly string[];
  sources: readonly BlogSource[];
};

type LocalizedBlogSource = {
  url: string;
  labels: Record<Locale, string>;
};

type BlogPostTranslation = {
  title: string;
  description: string;
  tags: readonly string[];
};

type BlogPost = {
  slug: string;
  href: string;
  publishedAt: string;
  sourcePublishedAt: string;
  readingMinutes: number;
  translations: Record<Locale, BlogPostTranslation>;
  sources: readonly LocalizedBlogSource[];
};

export const BLOG_POSTS = [
  {
    slug: 'claude-fable-5',
    href: '/blog/claude-fable-5',
    publishedAt: '2026-06-10',
    sourcePublishedAt: '2026-06-09',
    readingMinutes: 7,
    translations: {
      en: {
        title: "Claude Fable 5 Is Here: Anthropic's Public Mythos-Class Model, with Safety Built In",
        description:
          'Anthropic released Claude Fable 5, the public, safety-routed version of its Mythos-class frontier model. Here is what shipped — two-tier Fable 5 / Mythos 5, a classifier-plus-Opus-4.8 fallback, and $10/$50 pricing — and what it means if you build with AI.',
        tags: ['Claude Fable 5', 'Anthropic', 'AI models'],
      },
      zh: {
        title: 'Claude Fable 5 来了：Anthropic 面向公众的 Mythos 级模型，安全内建',
        description:
          'Anthropic 发布了 Claude Fable 5——其 Mythos 级前沿模型「带安全路由」的公开版本。本文梳理这次发布的关键：Fable 5 / Mythos 5 双档、分类器 + Opus 4.8 兜底、$10/$50 定价，以及它对开发者意味着什么。',
        tags: ['Claude Fable 5', 'Anthropic', 'AI 模型'],
      },
      // fr/es/pt/de/th/ja 暂用英文占位（路由回退 en MDX），补译时替换。
      fr: {
        title: "Claude Fable 5 Is Here: Anthropic's Public Mythos-Class Model, with Safety Built In",
        description:
          'Anthropic released Claude Fable 5, the public, safety-routed version of its Mythos-class frontier model. Here is what shipped — two-tier Fable 5 / Mythos 5, a classifier-plus-Opus-4.8 fallback, and $10/$50 pricing — and what it means if you build with AI.',
        tags: ['Claude Fable 5', 'Anthropic', 'AI models'],
      },
      es: {
        title: "Claude Fable 5 Is Here: Anthropic's Public Mythos-Class Model, with Safety Built In",
        description:
          'Anthropic released Claude Fable 5, the public, safety-routed version of its Mythos-class frontier model. Here is what shipped — two-tier Fable 5 / Mythos 5, a classifier-plus-Opus-4.8 fallback, and $10/$50 pricing — and what it means if you build with AI.',
        tags: ['Claude Fable 5', 'Anthropic', 'AI models'],
      },
      pt: {
        title: "Claude Fable 5 Is Here: Anthropic's Public Mythos-Class Model, with Safety Built In",
        description:
          'Anthropic released Claude Fable 5, the public, safety-routed version of its Mythos-class frontier model. Here is what shipped — two-tier Fable 5 / Mythos 5, a classifier-plus-Opus-4.8 fallback, and $10/$50 pricing — and what it means if you build with AI.',
        tags: ['Claude Fable 5', 'Anthropic', 'AI models'],
      },
      de: {
        title: "Claude Fable 5 Is Here: Anthropic's Public Mythos-Class Model, with Safety Built In",
        description:
          'Anthropic released Claude Fable 5, the public, safety-routed version of its Mythos-class frontier model. Here is what shipped — two-tier Fable 5 / Mythos 5, a classifier-plus-Opus-4.8 fallback, and $10/$50 pricing — and what it means if you build with AI.',
        tags: ['Claude Fable 5', 'Anthropic', 'AI models'],
      },
      th: {
        title: "Claude Fable 5 Is Here: Anthropic's Public Mythos-Class Model, with Safety Built In",
        description:
          'Anthropic released Claude Fable 5, the public, safety-routed version of its Mythos-class frontier model. Here is what shipped — two-tier Fable 5 / Mythos 5, a classifier-plus-Opus-4.8 fallback, and $10/$50 pricing — and what it means if you build with AI.',
        tags: ['Claude Fable 5', 'Anthropic', 'AI models'],
      },
      ja: {
        title: "Claude Fable 5 Is Here: Anthropic's Public Mythos-Class Model, with Safety Built In",
        description:
          'Anthropic released Claude Fable 5, the public, safety-routed version of its Mythos-class frontier model. Here is what shipped — two-tier Fable 5 / Mythos 5, a classifier-plus-Opus-4.8 fallback, and $10/$50 pricing — and what it means if you build with AI.',
        tags: ['Claude Fable 5', 'Anthropic', 'AI models'],
      },
    },
    sources: [
      {
        url: 'https://www.anthropic.com/news/claude-fable-5-mythos-5',
        labels: {
          en: 'Anthropic: Claude Fable 5 and Claude Mythos 5',
          zh: 'Anthropic：Claude Fable 5 与 Claude Mythos 5 公告',
          fr: 'Anthropic: Claude Fable 5 and Claude Mythos 5',
          es: 'Anthropic: Claude Fable 5 and Claude Mythos 5',
          pt: 'Anthropic: Claude Fable 5 and Claude Mythos 5',
          de: 'Anthropic: Claude Fable 5 and Claude Mythos 5',
          th: 'Anthropic: Claude Fable 5 and Claude Mythos 5',
          ja: 'Anthropic: Claude Fable 5 and Claude Mythos 5',
        },
      },
      {
        url: 'https://aws.amazon.com/blogs/aws/anthropic-claude-fable-5-on-aws-mythos-class-capabilities-with-built-in-safeguards-now-available/',
        labels: {
          en: 'Claude Fable 5 on Amazon Bedrock (AWS)',
          zh: 'Amazon Bedrock 上的 Claude Fable 5（AWS）',
          fr: 'Claude Fable 5 on Amazon Bedrock (AWS)',
          es: 'Claude Fable 5 on Amazon Bedrock (AWS)',
          pt: 'Claude Fable 5 on Amazon Bedrock (AWS)',
          de: 'Claude Fable 5 on Amazon Bedrock (AWS)',
          th: 'Claude Fable 5 on Amazon Bedrock (AWS)',
          ja: 'Claude Fable 5 on Amazon Bedrock (AWS)',
        },
      },
      {
        url: 'https://techcrunch.com/2026/06/09/anthropic-released-claude-fable-5-its-most-powerful-model-publicly-days-after-warning-ai-is-getting-too-dangerous/',
        labels: {
          en: 'TechCrunch: Anthropic releases Claude Fable 5',
          zh: 'TechCrunch：Anthropic 发布 Claude Fable 5',
          fr: 'TechCrunch: Anthropic releases Claude Fable 5',
          es: 'TechCrunch: Anthropic releases Claude Fable 5',
          pt: 'TechCrunch: Anthropic releases Claude Fable 5',
          de: 'TechCrunch: Anthropic releases Claude Fable 5',
          th: 'TechCrunch: Anthropic releases Claude Fable 5',
          ja: 'TechCrunch: Anthropic releases Claude Fable 5',
        },
      },
      {
        url: 'https://www.cnbc.com/2026/06/09/anthropic-mythos-claude-fable-5.html',
        labels: {
          en: 'CNBC: Anthropic releases Mythos-class Claude Fable 5',
          zh: 'CNBC：Anthropic 发布 Mythos 级 Claude Fable 5',
          fr: 'CNBC: Anthropic releases Mythos-class Claude Fable 5',
          es: 'CNBC: Anthropic releases Mythos-class Claude Fable 5',
          pt: 'CNBC: Anthropic releases Mythos-class Claude Fable 5',
          de: 'CNBC: Anthropic releases Mythos-class Claude Fable 5',
          th: 'CNBC: Anthropic releases Mythos-class Claude Fable 5',
          ja: 'CNBC: Anthropic releases Mythos-class Claude Fable 5',
        },
      },
    ],
  },
  {
    slug: 'gpt-5-5',
    href: '/blog/gpt-5-5',
    publishedAt: '2026-04-24',
    sourcePublishedAt: '2026-04-23',
    readingMinutes: 7,
    translations: {
      en: {
        title: "GPT-5.5 Is Here: OpenAI's New Work Model Changes What AI Can Do for You",
        description:
          'OpenAI has released GPT-5.5 for ChatGPT and Codex, with stronger agentic coding, computer use, knowledge work, and research capabilities. Here is what changed and how to prepare for API access.',
        tags: ['GPT-5.5', 'OpenAI', 'AI models'],
      },
      zh: {
        title: 'GPT-5.5 已发布：OpenAI 的新工作模型正在改变 AI 能为你做什么',
        description:
          'OpenAI 已在 ChatGPT 和 Codex 中发布 GPT-5.5，强化了 agentic coding、computer use、知识工作和科研能力。这里梳理关键变化，以及如何为 API 接入做好准备。',
        tags: ['GPT-5.5', 'OpenAI', 'AI 模型'],
      },
      fr: {
        title: "GPT-5.5 est là : le nouveau modèle de travail d'OpenAI change ce que l'IA peut faire pour vous",
        description:
          "OpenAI a publié GPT-5.5 pour ChatGPT et Codex, avec de meilleurs résultats en agentic coding, computer use, travail de connaissance et recherche scientifique. Voici ce qui change et comment préparer l'accès API.",
        tags: ['GPT-5.5', 'OpenAI', 'Modèles IA'],
      },
      es: {
        title: 'GPT-5.5 ya está aquí: el nuevo modelo de trabajo de OpenAI cambia lo que la IA puede hacer por ti',
        description:
          'OpenAI lanzó GPT-5.5 para ChatGPT y Codex, con más capacidad en agentic coding, computer use, trabajo de conocimiento e investigación científica. Esto es lo que cambió y cómo prepararte para el acceso API.',
        tags: ['GPT-5.5', 'OpenAI', 'Modelos de IA'],
      },
      pt: {
        title: 'GPT-5.5 chegou: o novo modelo de trabalho da OpenAI muda o que a IA pode fazer por você',
        description:
          'A OpenAI lançou o GPT-5.5 para ChatGPT e Codex, com avanços em agentic coding, computer use, trabalho de conhecimento e pesquisa científica. Veja o que mudou e como se preparar para o acesso via API.',
        tags: ['GPT-5.5', 'OpenAI', 'Modelos de IA'],
      },
      de: {
        title: 'GPT-5.5 ist da: OpenAIs neues Arbeitsmodell verändert, was KI für dich tun kann',
        description:
          'OpenAI hat GPT-5.5 für ChatGPT und Codex veröffentlicht, mit stärkeren Fähigkeiten bei agentic coding, computer use, Wissensarbeit und wissenschaftlicher Forschung. Das hat sich geändert und so bereitest du dich auf den API-Zugang vor.',
        tags: ['GPT-5.5', 'OpenAI', 'KI-Modelle'],
      },
      th: {
        title: 'GPT-5.5 มาแล้ว: โมเดลทำงานรุ่นใหม่ของ OpenAI กำลังเปลี่ยนสิ่งที่ AI ทำให้คุณได้',
        description:
          'OpenAI เปิดตัว GPT-5.5 สำหรับ ChatGPT และ Codex พร้อมความสามารถที่ดีขึ้นด้าน agentic coding, computer use, งานความรู้ และงานวิจัยทางวิทยาศาสตร์ นี่คือสิ่งที่เปลี่ยนไปและวิธีเตรียมตัวสำหรับ API',
        tags: ['GPT-5.5', 'OpenAI', 'โมเดล AI'],
      },
      ja: {
        title: 'GPT-5.5 登場：OpenAI の新しいワークモデルが AI にできることを変える',
        description:
          'OpenAI は ChatGPT と Codex 向けに GPT-5.5 を公開しました。agentic coding、computer use、ナレッジワーク、科学研究の能力が強化されています。変更点と API アクセスに備える方法を整理します。',
        tags: ['GPT-5.5', 'OpenAI', 'AI モデル'],
      },
    },
    sources: [
      {
        url: 'https://openai.com/index/introducing-gpt-5-5/',
        labels: {
          en: 'OpenAI GPT-5.5 announcement',
          zh: 'OpenAI GPT-5.5 发布公告',
          fr: 'Annonce GPT-5.5 d’OpenAI',
          es: 'Anuncio de GPT-5.5 de OpenAI',
          pt: 'Anúncio do GPT-5.5 da OpenAI',
          de: 'OpenAI-Ankündigung zu GPT-5.5',
          th: 'ประกาศ GPT-5.5 ของ OpenAI',
          ja: 'OpenAI GPT-5.5 発表',
        },
      },
      {
        url: 'https://openai.com/index/gpt-5-5-system-card/',
        labels: {
          en: 'GPT-5.5 System Card',
          zh: 'GPT-5.5 系统卡',
          fr: 'System Card GPT-5.5',
          es: 'Tarjeta del sistema GPT-5.5',
          pt: 'System Card do GPT-5.5',
          de: 'GPT-5.5 System Card',
          th: 'System Card ของ GPT-5.5',
          ja: 'GPT-5.5 System Card',
        },
      },
      {
        url: 'https://help.openai.com/en/articles/11909943-gpt-53-and-gpt-54-in-chatgpt',
        labels: {
          en: 'GPT-5.3 and GPT-5.5 in ChatGPT',
          zh: 'ChatGPT 中的 GPT-5.3 和 GPT-5.5',
          fr: 'GPT-5.3 et GPT-5.5 dans ChatGPT',
          es: 'GPT-5.3 y GPT-5.5 en ChatGPT',
          pt: 'GPT-5.3 e GPT-5.5 no ChatGPT',
          de: 'GPT-5.3 und GPT-5.5 in ChatGPT',
          th: 'GPT-5.3 และ GPT-5.5 ใน ChatGPT',
          ja: 'ChatGPT における GPT-5.3 と GPT-5.5',
        },
      },
      {
        url: 'https://openai.com/api/pricing/',
        labels: {
          en: 'OpenAI API Pricing',
          zh: 'OpenAI API 价格',
          fr: 'Tarifs de l’API OpenAI',
          es: 'Precios de la API de OpenAI',
          pt: 'Preços da API da OpenAI',
          de: 'OpenAI API-Preise',
          th: 'ราคา OpenAI API',
          ja: 'OpenAI API 料金',
        },
      },
    ],
  },
] as const satisfies readonly BlogPost[];

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}

export function getLocalizedBlogPost(post: BlogPost, locale: Locale): LocalizedBlogPost {
  const translation = post.translations[locale] ?? post.translations[defaultLocale];

  return {
    slug: post.slug,
    href: post.href,
    title: translation.title,
    description: translation.description,
    publishedAt: post.publishedAt,
    sourcePublishedAt: post.sourcePublishedAt,
    readingMinutes: post.readingMinutes,
    tags: translation.tags,
    sources: post.sources.map((source) => ({
      label: source.labels[locale] ?? source.labels[defaultLocale],
      url: source.url,
    })),
  };
}

export function getLocalizedBlogPosts(locale: Locale): LocalizedBlogPost[] {
  return BLOG_POSTS.map((post) => getLocalizedBlogPost(post, locale));
}
