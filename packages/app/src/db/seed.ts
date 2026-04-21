/**
 * 模型种子数据
 * 用法：通过 wrangler d1 execute 执行 SQL，或在管理后台手动添加
 *
 * 定价基于 2026 年 3 月各 Provider 官方定价（$/1M tokens）
 */

import type { NewModel } from './schema';

export const SEED_MODELS: NewModel[] = [
  // OpenAI
  {
    id: 'gpt-5',
    provider: 'openai',
    upstreamModelId: 'gpt-5',
    inputPrice: 1.25,
    outputPrice: 10,
    markupRate: 1.2,
  },
  {
    id: 'gpt-5-mini',
    provider: 'openai',
    upstreamModelId: 'gpt-5-mini',
    inputPrice: 0.25,
    outputPrice: 2,
    markupRate: 1.2,
  },
  {
    id: 'gpt-5-nano',
    provider: 'openai',
    upstreamModelId: 'gpt-5-nano',
    inputPrice: 0.05,
    outputPrice: 0.4,
    markupRate: 1.2,
  },
  {
    id: 'gpt-4.1',
    provider: 'openai',
    upstreamModelId: 'gpt-4.1',
    inputPrice: 2,
    outputPrice: 8,
    markupRate: 1.2,
  },
  {
    id: 'gpt-4o',
    provider: 'openai',
    upstreamModelId: 'gpt-4o',
    inputPrice: 2.5,
    outputPrice: 10,
    markupRate: 1.2,
  },
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    upstreamModelId: 'gpt-4o-mini',
    inputPrice: 0.15,
    outputPrice: 0.6,
    markupRate: 1.2,
  },

  // Google AI Studio (Gemini)
  {
    id: 'gemini-2.5-pro',
    provider: 'google-ai-studio',
    upstreamModelId: 'gemini-2.5-pro',
    inputPrice: 1.25,
    outputPrice: 10,
    markupRate: 1.2,
  },
  {
    id: 'gemini-2.5-flash',
    provider: 'google-ai-studio',
    upstreamModelId: 'gemini-2.5-flash',
    inputPrice: 0.3,
    outputPrice: 2.5,
    markupRate: 1.2,
  },
  {
    id: 'gemini-2.5-flash-lite',
    provider: 'google-ai-studio',
    upstreamModelId: 'gemini-2.5-flash-lite',
    inputPrice: 0.1,
    outputPrice: 0.4,
    markupRate: 1.2,
  },
  {
    id: 'gemini-3-flash',
    provider: 'google-ai-studio',
    upstreamModelId: 'gemini-3-flash-preview',
    inputPrice: 0.5,
    outputPrice: 3,
    markupRate: 1.2,
  },

  // Anthropic (Claude) — 通过 CF Workers AI 代付费，upstream 使用 CF 的点号命名
  {
    id: 'claude-opus-4-7',
    provider: 'anthropic',
    upstreamModelId: 'claude-opus-4.7',
    inputPrice: 5,
    outputPrice: 25,
    markupRate: 1.2,
  },
  {
    id: 'claude-opus-4-6',
    provider: 'anthropic',
    upstreamModelId: 'claude-opus-4.6',
    inputPrice: 5,
    outputPrice: 25,
    markupRate: 1.2,
  },
  {
    id: 'claude-sonnet-4-6',
    provider: 'anthropic',
    upstreamModelId: 'claude-sonnet-4.6',
    inputPrice: 3,
    outputPrice: 15,
    markupRate: 1.2,
  },
  {
    id: 'claude-haiku-4-5',
    provider: 'anthropic',
    upstreamModelId: 'claude-haiku-4.5',
    inputPrice: 1,
    outputPrice: 5,
    markupRate: 1.2,
  },

  // Cloudflare Workers AI
  {
    id: 'glm-4.7-flash',
    provider: 'workers-ai',
    upstreamModelId: '@cf/zai-org/glm-4.7-flash',
    inputPrice: 0.06,
    outputPrice: 0.4,
    markupRate: 1.2,
  },
  {
    id: 'qwen3-30b',
    provider: 'workers-ai',
    upstreamModelId: '@cf/qwen/qwen3-30b-a3b-fp8',
    inputPrice: 0.051,
    outputPrice: 0.335,
    markupRate: 1.2,
  },
  {
    id: 'kimi-k2.6',
    provider: 'workers-ai',
    upstreamModelId: '@cf/moonshotai/kimi-k2.6',
    inputPrice: 0.95,
    outputPrice: 4,
    markupRate: 1.2,
  },
];

/**
 * 生成 SQL INSERT 语句，可直接用 wrangler d1 execute 执行
 */
export function generateSeedSQL(): string {
  const values = SEED_MODELS.map(
    (m) => `('${m.id}', '${m.provider}', '${m.upstreamModelId}', ${m.inputPrice}, ${m.outputPrice}, ${m.markupRate})`,
  ).join(',\n  ');

  return `INSERT OR REPLACE INTO models (id, provider, upstream_model_id, input_price, output_price, markup_rate) VALUES\n  ${values};`;
}
