/**
 * Pricing 页面展示的 provider 范围与每家的官方来源 URL。
 * DB 中实际存在的 provider 若不在此列表（如 workers-ai 内部模型），不在公开 pricing 页展示。
 */
export const PROVIDER_DISPLAY: Record<string, { label: string; sourceUrl: string }> = {
  openai: { label: 'OpenAI', sourceUrl: 'https://platform.openai.com/docs/pricing' },
  anthropic: { label: 'Anthropic', sourceUrl: 'https://www.anthropic.com/pricing' },
  deepseek: { label: 'DeepSeek', sourceUrl: 'https://api-docs.deepseek.com/quick_start/pricing' },
  moonshot: { label: 'Moonshot AI', sourceUrl: 'https://platform.moonshot.cn/docs/pricing' },
  grok: { label: 'xAI Grok', sourceUrl: 'https://docs.x.ai/docs/models' },
  zai: { label: 'Zhipu GLM', sourceUrl: 'https://bigmodel.cn/pricing' },
  qwen: { label: 'Qwen', sourceUrl: 'https://help.aliyun.com/zh/dashscope/developer-reference/model-pricing' },
  minimax: { label: 'MiniMax', sourceUrl: 'https://platform.minimaxi.com/document/price' },
  meta: { label: 'Meta', sourceUrl: 'https://www.llama.com/docs/pricing' },
  longcat: { label: 'LongCat', sourceUrl: 'https://longcat.chat/pricing' },
  hy: { label: 'HY', sourceUrl: 'https://hy.ai/pricing' },
  'google-ai-studio': { label: 'Gemini', sourceUrl: 'https://ai.google.dev/pricing' },
  'xiaomi-mimo': { label: 'Xiaomi MiMo', sourceUrl: 'https://api.xiaomimimo.com/pricing' },
  'workers-ai': { label: 'Workers AI', sourceUrl: 'https://developers.cloudflare.com/workers-ai/models/' },
};

export const PROVIDER_ORDER = [
  'openai',
  'anthropic',
  'deepseek',
  'moonshot',
  'grok',
  'zai',
  'qwen',
  'minimax',
  'meta',
  'longcat',
  'hy',
  'google-ai-studio',
  'xiaomi-mimo',
  'workers-ai',
];

export const providerStyles: Record<
  string,
  {
    badgeClassName: string;
    surfaceClassName: string;
    borderClassName: string;
  }
> = {
  openai: {
    badgeClassName:
      'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/20 dark:text-emerald-300',
    surfaceClassName: 'bg-emerald-500/5 dark:bg-emerald-500/10',
    borderClassName: 'from-emerald-500/70 via-emerald-400/20 to-transparent',
  },
  anthropic: {
    badgeClassName:
      'border-orange-500/20 bg-orange-500/10 text-orange-700 dark:border-orange-400/30 dark:bg-orange-500/20 dark:text-orange-300',
    surfaceClassName: 'bg-orange-500/5 dark:bg-orange-500/10',
    borderClassName: 'from-orange-500/70 via-orange-400/20 to-transparent',
  },
  'google-ai-studio': {
    badgeClassName:
      'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:border-blue-400/30 dark:bg-blue-500/20 dark:text-blue-300',
    surfaceClassName: 'bg-blue-500/5 dark:bg-blue-500/10',
    borderClassName: 'from-blue-500/70 via-sky-400/20 to-transparent',
  },
  moonshot: {
    badgeClassName:
      'border-cyan-500/20 bg-cyan-500/10 text-cyan-700 dark:border-cyan-400/30 dark:bg-cyan-500/20 dark:text-cyan-300',
    surfaceClassName: 'bg-cyan-500/5 dark:bg-cyan-500/10',
    borderClassName: 'from-cyan-500/70 via-cyan-400/20 to-transparent',
  },
  'xiaomi-mimo': {
    badgeClassName:
      'border-purple-500/20 bg-purple-500/10 text-purple-700 dark:border-purple-400/30 dark:bg-purple-500/20 dark:text-purple-300',
    surfaceClassName: 'bg-purple-500/5 dark:bg-purple-500/10',
    borderClassName: 'from-purple-500/70 via-purple-400/20 to-transparent',
  },
  grok: {
    badgeClassName:
      'border-slate-500/20 bg-slate-500/10 text-slate-700 dark:border-slate-400/30 dark:bg-slate-500/20 dark:text-slate-300',
    surfaceClassName: 'bg-slate-500/5 dark:bg-slate-500/10',
    borderClassName: 'from-slate-500/70 via-slate-400/20 to-transparent',
  },
  deepseek: {
    badgeClassName:
      'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:border-blue-400/30 dark:bg-blue-500/20 dark:text-blue-300',
    surfaceClassName: 'bg-blue-500/5 dark:bg-blue-500/10',
    borderClassName: 'from-blue-500/70 via-sky-400/20 to-transparent',
  },
  zai: {
    badgeClassName:
      'border-violet-500/20 bg-violet-500/10 text-violet-700 dark:border-violet-400/30 dark:bg-violet-500/20 dark:text-violet-300',
    surfaceClassName: 'bg-violet-500/5 dark:bg-violet-500/10',
    borderClassName: 'from-violet-500/70 via-violet-400/20 to-transparent',
  },
  qwen: {
    badgeClassName:
      'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/20 dark:text-amber-300',
    surfaceClassName: 'bg-amber-500/5 dark:bg-amber-500/10',
    borderClassName: 'from-amber-500/70 via-amber-400/20 to-transparent',
  },
  minimax: {
    badgeClassName:
      'border-teal-500/20 bg-teal-500/10 text-teal-700 dark:border-teal-400/30 dark:bg-teal-500/20 dark:text-teal-300',
    surfaceClassName: 'bg-teal-500/5 dark:bg-teal-500/10',
    borderClassName: 'from-teal-500/70 via-teal-400/20 to-transparent',
  },
  meta: {
    badgeClassName:
      'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/20 dark:text-sky-300',
    surfaceClassName: 'bg-sky-500/5 dark:bg-sky-500/10',
    borderClassName: 'from-sky-500/70 via-sky-400/20 to-transparent',
  },
  longcat: {
    badgeClassName:
      'border-pink-500/20 bg-pink-500/10 text-pink-700 dark:border-pink-400/30 dark:bg-pink-500/20 dark:text-pink-300',
    surfaceClassName: 'bg-pink-500/5 dark:bg-pink-500/10',
    borderClassName: 'from-pink-500/70 via-pink-400/20 to-transparent',
  },
  hy: {
    badgeClassName:
      'border-lime-500/20 bg-lime-500/10 text-lime-700 dark:border-lime-400/30 dark:bg-lime-500/20 dark:text-lime-300',
    surfaceClassName: 'bg-lime-500/5 dark:bg-lime-500/10',
    borderClassName: 'from-lime-500/70 via-lime-400/20 to-transparent',
  },
  'workers-ai': {
    badgeClassName:
      'border-zinc-500/20 bg-zinc-500/10 text-zinc-700 dark:border-zinc-400/30 dark:bg-zinc-500/20 dark:text-zinc-300',
    surfaceClassName: 'bg-zinc-500/5 dark:bg-zinc-500/10',
    borderClassName: 'from-zinc-500/70 via-zinc-400/20 to-transparent',
  },
};

export const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
});

export const tokenFormatter = new Intl.NumberFormat('en-US');
