import type { Locale } from '@/i18n/config';

/** 文案只有中英两套的营销页；这些页面在其它语言下 canonical 指向英文版（见 BILINGUAL_CONTENT_LOCALES）。 */
export type BilingualPage = 'about' | 'contact' | 'privacy' | 'terms' | 'models';

type PageMeta = {
  title: string;
  /** 目标 120–160 字符：Bing 把 <120 判为过短，超过 160 会在结果页被截断。 */
  description: string;
};

// 这些页面的文案量不足以放进 messages/*.json（非 en/zh 语言没有译本，放进去只会复制英文），
// 因此集中在这里，页面与长度回归测试共用同一份来源。
const PAGE_META: Record<BilingualPage, Record<'en' | 'zh', PageMeta>> = {
  about: {
    en: {
      title: 'About MuiRouter — Vision, Roadmap and Principles',
      description:
        'MuiRouter is an OpenAI-compatible AI router for OpenAI, Claude, Gemini, Grok, Kimi and MiMo models. Read the vision, roadmap and principles behind the gateway.',
    },
    zh: {
      title: '关于 MuiRouter：愿景、路线图与原则',
      description:
        'MuiRouter 是面向开发者的 OpenAI 兼容 AI 路由层，一个端点即可调用 OpenAI、Claude、Gemini、Grok、Kimi 与 MiMo 等模型。这里说明我们的愿景、产品路线图与工程原则，以及我们如何让模型接入保持稳定。',
    },
  },
  contact: {
    en: {
      title: 'Contact MuiRouter — Support and Feedback',
      description:
        'Reach the MuiRouter team at support@muirouter.com or through the feedback form below. Bug reports, billing questions and partnership enquiries reach one inbox.',
    },
    zh: {
      title: '联系 MuiRouter：支持邮箱与反馈',
      description:
        '你可以通过邮箱 support@muirouter.com 或页面下方的反馈表单联系 MuiRouter 团队：故障报告、计费问题与合作咨询都会进入同一个收件箱，我们按优先级依次处理，尽量在一个工作日内回复。如涉及账号或支付问题，请附上注册邮箱与订单号。',
    },
  },
  privacy: {
    en: {
      title: 'Privacy Policy — Data We Collect and Why',
      description:
        "How MuiRouter collects, uses and protects account, billing and usage data, what stays on Cloudflare's edge, and how to have your data exported or deleted.",
    },
    zh: {
      title: '隐私政策：数据收集范围与用途',
      description:
        '本政策说明 MuiRouter 收集、使用与保护账号、计费与调用数据的方式：哪些数据留在 Cloudflare 边缘节点、哪些写入数据库，以及你如何申请导出或删除自己的个人信息。我们不会向第三方出售你的数据，也不会用它训练模型；如有疑问可随时联系我们。',
    },
  },
  terms: {
    en: {
      title: 'Terms of Service — Billing, Refunds and Use',
      description:
        'The rules for using MuiRouter: acceptable use, per-token billing and top-ups, refunds, service tier and suspension policy, and the limits of our liability.',
    },
    zh: {
      title: '使用协议：计费、退款与使用规则',
      description:
        '使用 MuiRouter 的完整规则：可接受使用范围、按 token 计费与充值方式、退款条件、服务暂停与账号处置策略、内容与责任边界，以及发生争议时的处理流程。注册账号即表示你已阅读并同意本协议；企业采购如需额外条款，可以联系我们单独协商。',
    },
  },
  models: {
    en: {
      title: 'All Models — Catalog and List Pricing',
      description:
        'Full MuiRouter model catalog grouped by provider — OpenAI, Claude, Gemini, Grok, Kimi, MiMo — with context windows and list prices per million tokens.',
    },
    zh: {
      title: '全量模型列表：定价与上下文',
      description:
        'MuiRouter 支持的全部模型，按 OpenAI、Claude、Gemini、Grok、Kimi、MiMo 等厂商分组，含上下文长度、最大输出与每百万 token 的原厂定价，方便按成本与能力挑模型。价格与原厂公开价保持一致，充值后按实际用量扣费，不额外加价。',
    },
  },
};

/** 取该页在指定语言下的 metadata 文案：只有 zh 命中中文，其余语言统一用英文。 */
export function getBilingualPageMeta(page: BilingualPage, locale: Locale): PageMeta {
  return PAGE_META[page][locale === 'zh' ? 'zh' : 'en'];
}
