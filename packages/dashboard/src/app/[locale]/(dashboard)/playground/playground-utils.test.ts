import { describe, expect, it } from 'vitest';
import type { ModelInfo } from '@/lib/api';
import {
  formatModelPrice,
  getGrokImagePrice,
  getModelCapabilityTagKeys,
  getModelPrice,
  isGrokImageModel,
  isImageModel,
  isTtsModel,
  isVideoModel,
  toTokenInfo,
} from './playground-utils';

function createModel(id: string, upstreamModelId: string | null = id): ModelInfo {
  return {
    id,
    provider: 'xiaomi-mimo',
    upstreamModelId,
    inputPrice: 0,
    outputPrice: 0,
    markupRate: 1.2,
    cachedInputPrice: null,
    cacheWritePrice: null,
    longContextThresholdTokens: null,
    longContextInputPrice: null,
    longContextCachedInputPrice: null,
    longContextCacheWritePrice: null,
    longContextOutputPrice: null,
  };
}

function makeModel(id: string, overrides: Partial<ModelInfo> = {}): ModelInfo {
  return {
    id,
    provider: 'openai',
    upstreamModelId: id,
    inputPrice: null,
    outputPrice: null,
    markupRate: 1.2,
    cachedInputPrice: null,
    cacheWritePrice: null,
    longContextThresholdTokens: null,
    longContextInputPrice: null,
    longContextCachedInputPrice: null,
    longContextCacheWritePrice: null,
    longContextOutputPrice: null,
    ...overrides,
  };
}

describe('playground 模型分类 helpers', () => {
  it('识别视频模型且不会归入图片或 TTS', () => {
    const model = createModel('grok-imagine-video');
    expect(isVideoModel(model)).toBe(true);
    expect(isImageModel(model)).toBe(false);
    expect(isTtsModel(model)).toBe(false);
  });

  it('识别 TTS 模型且不会把 TTS 归入图片模型', () => {
    const model = createModel('mimo-v2.5-tts');

    expect(isTtsModel(model)).toBe(true);
    expect(isImageModel(model)).toBe(false);
  });
});

describe('playground 模型展示元数据 helpers', () => {
  it('能力标签按字段派生：长上下文 / 缓存', () => {
    expect(getModelCapabilityTagKeys(makeModel('a'))).toEqual([]);
    expect(getModelCapabilityTagKeys(makeModel('b', { longContextThresholdTokens: 200000 }))).toEqual([
      'tagLongContext',
    ]);
    expect(getModelCapabilityTagKeys(makeModel('c', { cachedInputPrice: 0.3 }))).toEqual(['tagCaching']);
    expect(
      getModelCapabilityTagKeys(makeModel('d', { longContextThresholdTokens: 256000, cachedInputPrice: 0.1 })),
    ).toEqual(['tagLongContext', 'tagCaching']);
  });

  it('cachedInputPrice 为 0 也算支持缓存（区别于 null）', () => {
    expect(getModelCapabilityTagKeys(makeModel('zero', { cachedInputPrice: 0 }))).toEqual(['tagCaching']);
  });

  it('Kimi K3 显示 1M、视觉、始终推理和缓存能力', () => {
    expect(getModelCapabilityTagKeys(makeModel('kimi-k3', { provider: 'moonshot', cachedInputPrice: 0.3 }))).toEqual([
      'tagMillionContext',
      'tagVision',
      'tagAlwaysThinking',
      'tagCaching',
    ]);
  });

  it('getModelPrice 取基础价；任一缺失返回 null', () => {
    expect(getModelPrice(makeModel('p', { inputPrice: 3, outputPrice: 15 }))).toEqual({ input: 3, output: 15 });
    expect(getModelPrice(makeModel('free', { inputPrice: 0, outputPrice: 0 }))).toEqual({ input: 0, output: 0 });
    expect(getModelPrice(makeModel('partial', { inputPrice: 3, outputPrice: null }))).toBeNull();
  });

  it('formatModelPrice 去尾零并加美元符号', () => {
    expect(formatModelPrice(3)).toBe('$3');
    expect(formatModelPrice(1.25)).toBe('$1.25');
    expect(formatModelPrice(0.05)).toBe('$0.05');
  });

  it('识别 Grok 图片模型并返回真实按图价格', () => {
    const model = makeModel('grok-imagine-image-quality', { provider: 'grok', inputPrice: 0, outputPrice: 1 });
    expect(isGrokImageModel(model)).toBe(true);
    expect(getGrokImagePrice(model)).toEqual({
      inputImagePrice: 0.01,
      outputImagePrices: { '1k': 0.05, '2k': 0.07 },
    });
  });

  it('把 xAI 美元 ticks 显示为内部 output token', () => {
    expect(toTokenInfo({ cost_in_usd_ticks: 200_000_000 })).toEqual({
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 20_000,
    });
  });

  it('展示总输入、缓存输入和输出 token', () => {
    expect(toTokenInfo({ prompt_tokens: 1000, completion_tokens: 200, cached_tokens: 800 })).toEqual({
      inputTokens: 1000,
      cachedInputTokens: 800,
      outputTokens: 200,
    });
  });
});
