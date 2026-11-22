import type { NewModel } from '../schema';
import { NO_LONG_CONTEXT, geminiCache, round } from './helpers.ts';

export const GOOGLE_MODELS: NewModel[] = [
  // Google AI Studio (Gemini)
  // Gemini 4 Carbon（Google 最强深度推理前沿旗舰，专为长程智能体与网络安全攻防设计）：
  // 官方 Standard 限时定价（2026-11-30 前）：input $2.00 / output $10.00，隐式缓存 $0.10（5% input）
  {
    id: 'gemini-4-carbon',
    provider: 'google-ai-studio',
    upstreamModelId: 'gemini-4-carbon',
    inputPrice: 2,
    outputPrice: 10,
    markupRate: 1,
    cachedInputPrice: 0.1,
    cacheWritePrice: null,
    ...NO_LONG_CONTEXT,
  },
  // Gemini 4 Hydrogen（Flash 系列官方替代者，超快速度与高性价比 Agent 工作流）：
  // input $1.50 / output $7.50，隐式缓存 $0.075（5% input）
  {
    id: 'gemini-4-hydrogen',
    provider: 'google-ai-studio',
    upstreamModelId: 'gemini-4-hydrogen',
    inputPrice: 1.5,
    outputPrice: 7.5,
    markupRate: 1,
    cachedInputPrice: 0.075,
    cacheWritePrice: null,
    ...NO_LONG_CONTEXT,
  },
  // Gemini 4 Argon（旗舰推理大模型，支持 1M tokens 长上下文生成与复杂多步骤智能体）：
  // 官方 Standard 限时定价（2026-11-30 前）：input $2.00 / output $10.00，隐式缓存 $0.10（5% input）
  {
    id: 'gemini-4-argon',
    provider: 'google-ai-studio',
    upstreamModelId: 'gemini-4-argon',
    inputPrice: 2,
    outputPrice: 10,
    markupRate: 1,
    cachedInputPrice: 0.1,
    cacheWritePrice: null,
    ...NO_LONG_CONTEXT,
  },
  // Gemini 3.8 Flash（高智力 Flash 模型，专为长程软件工程与企业级智能体工作流设计）：
  // 官方 Standard 限时定价（2026-12-31 前）：input $0.75 / output $3.75，缓存读 $0.075（10% input）
  {
    id: 'gemini-3.8-flash',
    provider: 'google-ai-studio',
    upstreamModelId: 'gemini-3.8-flash',
    inputPrice: 0.75,
    outputPrice: 3.75,
    markupRate: 1,
    ...geminiCache(0.75),
    ...NO_LONG_CONTEXT,
  },
  // 别名支持 dash 形式：gemini-3-8-flash
  {
    id: 'gemini-3-8-flash',
    provider: 'google-ai-studio',
    upstreamModelId: 'gemini-3.8-flash',
    inputPrice: 0.75,
    outputPrice: 3.75,
    markupRate: 1,
    ...geminiCache(0.75),
    ...NO_LONG_CONTEXT,
  },
  // Gemini 3.5 Flash-Lite：
  {
    id: 'gemini-3.5-flash-lite',
    provider: 'google-ai-studio',
    upstreamModelId: 'gemini-3.5-flash-lite',
    inputPrice: 0.3,
    outputPrice: 2.5,
    markupRate: 1,
    ...geminiCache(0.3),
    ...NO_LONG_CONTEXT,
  },
  // 别名支持 dash 形式：gemini-3-5-flash-lite
  {
    id: 'gemini-3-5-flash-lite',
    provider: 'google-ai-studio',
    upstreamModelId: 'gemini-3.5-flash-lite',
    inputPrice: 0.3,
    outputPrice: 2.5,
    markupRate: 1,
    ...geminiCache(0.3),
    ...NO_LONG_CONTEXT,
  },
  // Gemini 3.1 Pro Preview：
  {
    id: 'gemini-3.1-pro-preview',
    provider: 'google-ai-studio',
    upstreamModelId: 'gemini-3.1-pro-preview',
    inputPrice: 2,
    outputPrice: 12,
    markupRate: 1,
    ...geminiCache(2),
    longContextThresholdTokens: 200_000,
    longContextInputPrice: 4,
    longContextCachedInputPrice: round(4 * 0.1),
    longContextCacheWritePrice: null,
    longContextOutputPrice: 18,
  },
  // 别名支持 dash 形式：gemini-3-1-pro-preview
  {
    id: 'gemini-3-1-pro-preview',
    provider: 'google-ai-studio',
    upstreamModelId: 'gemini-3.1-pro-preview',
    inputPrice: 2,
    outputPrice: 12,
    markupRate: 1,
    ...geminiCache(2),
    longContextThresholdTokens: 200_000,
    longContextInputPrice: 4,
    longContextCachedInputPrice: round(4 * 0.1),
    longContextCacheWritePrice: null,
    longContextOutputPrice: 18,
  },
  // Gemini 3.1 Flash-Lite：
  {
    id: 'gemini-3.1-flash-lite',
    provider: 'google-ai-studio',
    upstreamModelId: 'gemini-3.1-flash-lite',
    inputPrice: 0.25,
    outputPrice: 1.5,
    markupRate: 1,
    ...geminiCache(0.25),
    ...NO_LONG_CONTEXT,
  },
  // 别名支持 dash 形式：gemini-3-1-flash-lite
  {
    id: 'gemini-3-1-flash-lite',
    provider: 'google-ai-studio',
    upstreamModelId: 'gemini-3.1-flash-lite',
    inputPrice: 0.25,
    outputPrice: 1.5,
    markupRate: 1,
    ...geminiCache(0.25),
    ...NO_LONG_CONTEXT,
  },
  // Gemini 3 Flash：
  {
    id: 'gemini-3-flash',
    provider: 'google-ai-studio',
    upstreamModelId: 'gemini-3-flash-preview',
    inputPrice: 0.5,
    outputPrice: 3,
    markupRate: 1,
    ...geminiCache(0.5),
    ...NO_LONG_CONTEXT,
  },
];
