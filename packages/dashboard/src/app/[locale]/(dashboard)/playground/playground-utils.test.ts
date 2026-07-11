import { describe, expect, it } from 'vitest';
import type { ModelInfo } from '@/lib/api';
import {
  appendBuiltInPlaygroundModels,
  buildTtsRequestBody,
  formatModelPrice,
  getGrokImagePrice,
  getModelCapabilityTagKeys,
  getModelPrice,
  getTtsVoiceSampleMimeType,
  groupModelsByProvider,
  isImageModel,
  isGrokImageModel,
  isTtsModel,
  toAudioResult,
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

describe('playground TTS helpers', () => {
  it('补齐内置图片和 MiMo TTS 模型且不重复添加', () => {
    const models = appendBuiltInPlaygroundModels([createModel('mimo-v2.5-tts')]);

    expect(models.filter((model) => model.id === 'mimo-v2.5-tts')).toHaveLength(1);
    expect(models.some((model) => model.id === 'gpt-image-2')).toBe(true);
    expect(models.some((model) => model.id === 'grok-imagine-image')).toBe(true);
    expect(models.some((model) => model.id === 'grok-imagine-image-quality')).toBe(true);
    expect(models.some((model) => model.id === 'mimo-v2.5-tts-voiceclone')).toBe(true);
    expect(models.some((model) => model.id === 'mimo-v2.5-tts-voicedesign')).toBe(true);
  });

  it('识别 TTS 模型且不会把 TTS 归入图片模型', () => {
    const model = createModel('mimo-v2.5-tts');

    expect(isTtsModel(model)).toBe(true);
    expect(isImageModel(model)).toBe(false);
  });

  it('为内置音色 TTS 构造 MiMo chat completions 请求体', () => {
    expect(
      buildTtsRequestBody({
        model: 'mimo-v2.5-tts',
        text: '今天会议开始了。',
        stylePrompt: '温暖、明亮，语速稍快。',
        voice: 'Chloe',
      }),
    ).toEqual({
      model: 'mimo-v2.5-tts',
      messages: [
        { role: 'user', content: '温暖、明亮，语速稍快。' },
        { role: 'assistant', content: '今天会议开始了。' },
      ],
      audio: { format: 'wav', voice: 'Chloe' },
      stream: false,
    });
  });

  it('音色设计模型不发送预设 voice', () => {
    const body = buildTtsRequestBody({
      model: 'mimo-v2.5-tts-voicedesign',
      text: 'Welcome back.',
      stylePrompt: 'Deep and steady male narrator.',
      voice: 'Mia',
    });

    expect(body.audio).toEqual({ format: 'wav' });
    expect(body.messages[0]).toEqual({ role: 'user', content: 'Deep and steady male narrator.' });
  });

  it('音色克隆模型使用上传样本作为 audio.voice', () => {
    const body = buildTtsRequestBody({
      model: 'mimo-v2.5-tts-voiceclone',
      text: 'Yes, I had a sandwich.',
      stylePrompt: '',
      voice: 'mimo_default',
      voiceSampleDataUrl: 'data:audio/mpeg;base64,AAAA',
    });

    expect(body.audio).toEqual({ format: 'wav', voice: 'data:audio/mpeg;base64,AAAA' });
    expect(body.messages).toEqual([
      { role: 'user', content: '' },
      { role: 'assistant', content: 'Yes, I had a sandwich.' },
    ]);
  });

  it('把 MiMo TTS 响应音频转成可播放结果', () => {
    const result = toAudioResult(
      {
        choices: [{ message: { audio: { data: 'UklGRg==', id: 'voice-1' } } }],
      },
      'mimo-v2.5-tts',
    );

    expect(result).toMatchObject({
      src: 'data:audio/wav;base64,UklGRg==',
      mimeType: 'audio/wav',
      filename: 'mimo-v2.5-tts-voice-1.wav',
    });
  });

  it('只接受 MiMo voiceclone 支持的音频样本格式', () => {
    expect(getTtsVoiceSampleMimeType(new File(['x'], 'voice.wav', { type: 'audio/x-wav' }))).toBe('audio/wav');
    expect(getTtsVoiceSampleMimeType(new File(['x'], 'voice.mp3', { type: 'audio/mp3' }))).toBe('audio/mpeg');
    expect(getTtsVoiceSampleMimeType(new File(['x'], 'voice.ogg', { type: 'audio/ogg' }))).toBeNull();
  });
});

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

describe('playground 模型展示元数据 helpers', () => {
  it('按 PROVIDER_ORDER 分组，未知 provider 追加到末尾', () => {
    const groups = groupModelsByProvider([
      makeModel('gpt-5', { provider: 'openai' }),
      makeModel('claude-x', { provider: 'anthropic' }),
      makeModel('mystery-1', { provider: 'mystery' }),
      makeModel('claude-y', { provider: 'anthropic' }),
    ]);

    expect(groups.map((group) => group.provider)).toEqual(['anthropic', 'openai', 'mystery']);
    expect(groups[0].items).toEqual(['claude-x', 'claude-y']);
    expect(groups[1].items).toEqual(['gpt-5']);
    expect(groups[2].items).toEqual(['mystery-1']);
  });

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
    expect(toTokenInfo({ cost_in_usd_ticks: 200_000_000 })).toEqual({ inputTokens: 0, outputTokens: 20_000 });
  });
});
