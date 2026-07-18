import { describe, expect, it } from 'vitest';
import type { ModelInfo } from '@/lib/api';
import { appendBuiltInPlaygroundModels, groupModelsByProvider } from './playground-model-catalog';

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

describe('playground 内置模型目录', () => {
  it('补齐内置图片和 MiMo TTS 模型且不重复添加', () => {
    const models = appendBuiltInPlaygroundModels([createModel('mimo-v2.5-tts')]);

    expect(models.filter((model) => model.id === 'mimo-v2.5-tts')).toHaveLength(1);
    expect(models.some((model) => model.id === 'gpt-image-2')).toBe(true);
    expect(models.some((model) => model.id === 'grok-imagine-image')).toBe(true);
    expect(models.some((model) => model.id === 'grok-imagine-image-quality')).toBe(true);
    expect(models.some((model) => model.id === 'grok-imagine-video')).toBe(true);
    expect(models.some((model) => model.id === 'grok-imagine-video-1.5')).toBe(true);
    expect(models.some((model) => model.id === 'mimo-v2.5-tts-voiceclone')).toBe(true);
    expect(models.some((model) => model.id === 'mimo-v2.5-tts-voicedesign')).toBe(true);
  });

  it('按 PROVIDER_ORDER 分组，未知 provider 追加到末尾', () => {
    const groups = groupModelsByProvider([
      makeModel('gpt-5', { provider: 'openai' }),
      makeModel('claude-x', { provider: 'anthropic' }),
      makeModel('mystery-1', { provider: 'mystery' }),
      makeModel('claude-y', { provider: 'anthropic' }),
      makeModel('kimi-k3', { provider: 'moonshot' }),
    ]);

    expect(groups.map((group) => group.provider)).toEqual(['anthropic', 'openai', 'moonshot', 'mystery']);
    expect(groups[0].items).toEqual(['claude-x', 'claude-y']);
    expect(groups[1].items).toEqual(['gpt-5']);
    expect(groups[2].items).toEqual(['kimi-k3']);
    expect(groups[3].items).toEqual(['mystery-1']);
  });
});
