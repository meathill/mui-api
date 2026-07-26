import { serializeModelMetadata } from '@muirouter/shared-db/model-metadata';
import { describe, expect, it } from 'vitest';
import type { Model } from '../db/schema';
import { formatPerTokenPrice, releaseDateToUnix, toPublicModel, toPublicModelList } from './model-public-view';

function makeModel(overrides: Partial<Model> = {}): Model {
  return {
    id: 'gpt-5',
    provider: 'openai',
    upstreamModelId: 'gpt-5',
    displayName: null,
    contextLength: null,
    maxOutputTokens: null,
    metadataJson: null,
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

describe('formatPerTokenPrice', () => {
  it('按 $/1M → $/token 换算并乘加价倍率', () => {
    // 1.25 美元/1M token，1.2 倍加价 → 1.5e-6
    expect(formatPerTokenPrice(1.25, 1.2)).toBe('0.0000015');
  });

  it('输出十进制字符串而非科学计数法——1e-8 量级用数字会被序列化成 5.1e-8', () => {
    const price = formatPerTokenPrice(0.051, 1);
    expect(price).toBe('0.000000051');
    expect(price).not.toContain('e');
  });

  it('免费模型返回 "0"', () => {
    expect(formatPerTokenPrice(0, 1.2)).toBe('0');
  });

  it('倍率为 1 时即上游标价', () => {
    expect(formatPerTokenPrice(3, 1)).toBe('0.000003');
  });
});

describe('releaseDateToUnix', () => {
  it('YYYY-MM-DD 取当天 UTC 零点', () => {
    expect(releaseDateToUnix('2025-06-17')).toBe(Date.UTC(2025, 5, 17) / 1000);
  });

  it('YYYY-MM 取当月 1 号', () => {
    expect(releaseDateToUnix('2025-06')).toBe(Date.UTC(2025, 5, 1) / 1000);
  });

  it('缺省返回 0——没有元数据的模型不该凭空多出一个假日期', () => {
    expect(releaseDateToUnix(undefined)).toBe(0);
    expect(releaseDateToUnix('')).toBe(0);
  });
});

describe('toPublicModel', () => {
  it('元数据未录入时只返回 OpenAI 官方那四个字段，不塞空对象', () => {
    expect(toPublicModel(makeModel())).toEqual({
      id: 'gpt-5',
      object: 'model',
      created: 0,
      owned_by: 'muirouter',
    });
  });

  it('owned_by 恒为 muirouter，不回传内部 provider 枚举', () => {
    const view = toPublicModel(makeModel({ provider: 'google-ai-studio' }));
    expect(view.owned_by).toBe('muirouter');
    expect(JSON.stringify(view)).not.toContain('google-ai-studio');
  });

  it('完整元数据展开成 context_length / pricing / capabilities', () => {
    const model = makeModel({
      id: 'claude-opus-5',
      displayName: 'Claude Opus 5',
      contextLength: 200000,
      maxOutputTokens: 64000,
      inputPrice: 5,
      outputPrice: 25,
      cachedInputPrice: 0.5,
      cacheWritePrice: 6.25,
      markupRate: 1.2,
      metadataJson: serializeModelMetadata({
        attachment: true,
        reasoning: true,
        toolCall: true,
        openWeights: false,
        releaseDate: '2026-05-20',
        modalities: { input: ['text', 'image'], output: ['text'] },
      }),
    });

    expect(toPublicModel(model)).toEqual({
      id: 'claude-opus-5',
      object: 'model',
      created: Date.UTC(2026, 4, 20) / 1000,
      owned_by: 'muirouter',
      display_name: 'Claude Opus 5',
      context_length: 200000,
      max_output_tokens: 64000,
      pricing: {
        prompt: '0.000006',
        completion: '0.00003',
        input_cache_read: '0.0000006',
        input_cache_write: '0.0000075',
      },
      capabilities: { vision: true, reasoning: true, tool_call: true, attachment: true },
    });
  });

  it('无 cache 单价时不输出 input_cache_* 字段', () => {
    const view = toPublicModel(makeModel({ inputPrice: 1, outputPrice: 2 }));
    expect(view.pricing).toEqual({ prompt: '0.0000012', completion: '0.0000024' });
  });

  it('价格缺一半就不给 pricing——半截价格比没有价格更危险', () => {
    expect(toPublicModel(makeModel({ inputPrice: 1, outputPrice: null })).pricing).toBeUndefined();
  });

  it('vision 由 modalities.input 是否含 image 决定，与 attachment 独立', () => {
    const model = makeModel({
      metadataJson: serializeModelMetadata({
        attachment: true,
        reasoning: false,
        toolCall: false,
        openWeights: false,
        modalities: { input: ['text'], output: ['text'] },
      }),
    });
    expect(toPublicModel(model).capabilities).toEqual({
      vision: false,
      reasoning: false,
      tool_call: false,
      attachment: true,
    });
  });

  it('脏元数据按未录入处理，不让整个 /v1/models 挂掉', () => {
    const view = toPublicModel(makeModel({ metadataJson: '{"bogus":1}' }));
    expect(view.capabilities).toBeUndefined();
    expect(view.created).toBe(0);
    expect(view.id).toBe('gpt-5');
  });
});

describe('toPublicModelList', () => {
  it('按 id 排序，保证客户端每次拿到的顺序稳定', () => {
    const list = toPublicModelList([makeModel({ id: 'zeta' }), makeModel({ id: 'alpha' }), makeModel({ id: 'mid' })]);
    expect(list.map((m) => m.id)).toEqual(['alpha', 'mid', 'zeta']);
  });
});
