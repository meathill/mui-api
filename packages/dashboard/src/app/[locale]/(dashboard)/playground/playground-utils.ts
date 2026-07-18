import {
  convertUsdTicksToInternalTokens,
  GROK_IMAGE_MODEL_CONFIGS,
  isGrokImageModelId,
} from '@muirouter/shared-db/grok-image';
import { isGrokVideoModelId } from '@muirouter/shared-db/grok-video';
import type { ModelInfo } from '@/lib/api';
import { isTtsModelId } from './playground-tts';
import type { HistoryItem, TokenInfo, TokenUsagePayload } from './playground-types';

// 内置模型目录已拆到 ./playground-model-catalog.ts
// TTS 相关 helpers 已拆到 ./playground-tts.ts
// 图片/下载结果转换已拆到 ./playground-media-results.ts
// 网络请求 / SSE 流读取已拆到 ./playground-api.ts

export const MAX_HISTORY_ITEMS = 30;

export function getApiBase() {
  return process.env.NEXT_PUBLIC_API_BASE || '';
}

// ---- 模型展示元数据（从已有字段派生，无需数据库新增字段）----

/** 返回模型能力标签的 i18n key 列表（成品文案由组件用 t() 渲染）。 */
export function getModelCapabilityTagKeys(model: ModelInfo): string[] {
  const keys: string[] = [];
  if (model.id === 'kimi-k3') {
    keys.push('tagMillionContext', 'tagVision', 'tagAlwaysThinking');
  } else if (model.longContextThresholdTokens != null) {
    keys.push('tagLongContext');
  }
  if (model.cachedInputPrice != null) {
    keys.push('tagCaching');
  }
  return keys;
}

/** 取基础输入/输出价（单位：美元/百万 tokens）；任一缺失返回 null。 */
export function getModelPrice(model: ModelInfo): { input: number; output: number } | null {
  if (model.inputPrice == null || model.outputPrice == null) {
    return null;
  }
  return { input: model.inputPrice, output: model.outputPrice };
}

export function getGrokImagePrice(model: ModelInfo) {
  if (model.provider !== 'grok' || !isGrokImageModelId(model.id)) return null;
  return GROK_IMAGE_MODEL_CONFIGS[model.id];
}

/** 价格数字格式化（JS 已天然去尾零：3 / 1.25 / 0.05）。 */
export function formatModelPrice(value: number): string {
  return `$${value}`;
}

export function isImageModel(model: ModelInfo) {
  return model.id.includes('image') || Boolean(model.upstreamModelId?.includes('image'));
}

export function isGrokImageModel(model: ModelInfo | undefined): boolean {
  return Boolean(model && model.provider === 'grok' && isGrokImageModelId(model.id));
}

export function isTtsModel(model: ModelInfo) {
  return isTtsModelId(model.id) || Boolean(model.upstreamModelId && isTtsModelId(model.upstreamModelId));
}

export function isVideoModel(model: ModelInfo) {
  return isGrokVideoModelId(model.id) || Boolean(model.upstreamModelId && isGrokVideoModelId(model.upstreamModelId));
}

export function parseHistory(raw: string): HistoryItem[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY_ITEMS) : [];
  } catch {
    return [];
  }
}

export function toTokenInfo(usage?: TokenUsagePayload): TokenInfo | null {
  if (!usage) return null;
  if (typeof usage.cost_in_usd_ticks === 'number' && usage.cost_in_usd_ticks > 0) {
    return {
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: convertUsdTicksToInternalTokens(usage.cost_in_usd_ticks),
    };
  }
  const details = usage.prompt_tokens_details ?? usage.input_tokens_details;
  return {
    inputTokens: usage.input_tokens ?? usage.prompt_tokens ?? 0,
    cachedInputTokens: details?.cached_tokens ?? usage.cached_tokens ?? 0,
    outputTokens: usage.output_tokens ?? usage.completion_tokens ?? 0,
  };
}
