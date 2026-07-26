// 实现在 @muirouter/shared-db/model-metadata（app 与 dashboard 共用）；
// 测试保留在 app 包运行，因为 shared-db 无独立测试基建（同 money.test.ts）。

import {
  emptyModelMetadata,
  parseModelMetadata,
  serializeModelMetadata,
  validateModelMetadata,
} from '@muirouter/shared-db/model-metadata';
import { describe, expect, it } from 'vitest';

describe('validateModelMetadata', () => {
  it('布尔位缺省时补 false，不报错', () => {
    const result = validateModelMetadata({});
    expect(result).toEqual({
      ok: true,
      value: { attachment: false, reasoning: false, toolCall: false, openWeights: false },
    });
  });

  it('完整元数据原样通过', () => {
    const input = {
      description: 'Fast multimodal model',
      family: 'gemini-flash',
      attachment: true,
      reasoning: true,
      toolCall: true,
      temperature: true,
      structuredOutput: true,
      openWeights: false,
      knowledge: '2025-01',
      releaseDate: '2025-06-17',
      lastUpdated: '2025-06-17',
      modalities: { input: ['text', 'image'], output: ['text'] },
    };
    const result = validateModelMetadata(input);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(input);
  });

  it('未知字段直接报错——与 models.dev 的 .strict() 对齐，录入阶段就抓拼写错误', () => {
    const result = validateModelMetadata({ tool_call: true });
    expect(result).toEqual({ ok: false, error: '未知字段 tool_call' });
  });

  it('拒绝非对象', () => {
    expect(validateModelMetadata(null).ok).toBe(false);
    expect(validateModelMetadata([]).ok).toBe(false);
    expect(validateModelMetadata('x').ok).toBe(false);
  });

  it('布尔字段类型错误报错', () => {
    expect(validateModelMetadata({ reasoning: 'yes' })).toEqual({
      ok: false,
      error: 'reasoning 必须是布尔值',
    });
  });

  it('空字符串不算合法 description', () => {
    expect(validateModelMetadata({ description: '  ' }).ok).toBe(false);
  });

  it('日期只接受 YYYY-MM 或 YYYY-MM-DD', () => {
    expect(validateModelMetadata({ releaseDate: '2025-06' }).ok).toBe(true);
    expect(validateModelMetadata({ releaseDate: '2025-06-17' }).ok).toBe(true);
    expect(validateModelMetadata({ releaseDate: '2025' }).ok).toBe(false);
    expect(validateModelMetadata({ releaseDate: '2025/06/17' }).ok).toBe(false);
  });

  describe('modalities', () => {
    it('拒绝非法取值并提示可选项', () => {
      const result = validateModelMetadata({ modalities: { input: ['text', 'hologram'], output: ['text'] } });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('modalities.input');
    });

    it('拒绝空数组', () => {
      expect(validateModelMetadata({ modalities: { input: [], output: ['text'] } }).ok).toBe(false);
    });

    it('拒绝重复取值', () => {
      const result = validateModelMetadata({ modalities: { input: ['text', 'text'], output: ['text'] } });
      expect(result).toEqual({ ok: false, error: 'modalities.input 含重复取值 text' });
    });

    it('input / output 取值集合相同（models.dev 的 output 里实测出现过 pdf）', () => {
      expect(validateModelMetadata({ modalities: { input: ['pdf'], output: ['text'] } }).ok).toBe(true);
      expect(validateModelMetadata({ modalities: { input: ['text'], output: ['pdf'] } }).ok).toBe(true);
      expect(validateModelMetadata({ modalities: { input: ['text'], output: ['hologram'] } }).ok).toBe(false);
    });

    it('拒绝多余字段', () => {
      const result = validateModelMetadata({ modalities: { input: ['text'], output: ['text'], extra: 1 } });
      expect(result).toEqual({ ok: false, error: 'modalities 不支持字段 extra' });
    });
  });
});

describe('parseModelMetadata', () => {
  it('null / 空串视为未录入，返回 null 而非报错', () => {
    expect(parseModelMetadata(null)).toEqual({ ok: true, value: null });
    expect(parseModelMetadata(undefined)).toEqual({ ok: true, value: null });
    expect(parseModelMetadata('   ')).toEqual({ ok: true, value: null });
  });

  it('非法 JSON 报错', () => {
    expect(parseModelMetadata('{oops')).toEqual({ ok: false, error: '元数据不是合法 JSON' });
  });

  it('合法 JSON 走字段校验', () => {
    const result = parseModelMetadata('{"reasoning":true}');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value?.reasoning).toBe(true);
  });
});

describe('serializeModelMetadata', () => {
  it('字段顺序固定，便于 diff', () => {
    const json = serializeModelMetadata({
      openWeights: false,
      attachment: true,
      reasoning: false,
      toolCall: true,
      description: 'x',
    });
    expect(json).toBe('{"description":"x","attachment":true,"reasoning":false,"toolCall":true,"openWeights":false}');
  });

  it('与 parse 往返一致', () => {
    const original = { ...emptyModelMetadata(), reasoning: true, releaseDate: '2025-06-17' };
    const result = parseModelMetadata(serializeModelMetadata(original));
    expect(result).toEqual({ ok: true, value: original });
  });

  it('undefined 字段不落进 JSON', () => {
    expect(serializeModelMetadata(emptyModelMetadata())).not.toContain('description');
  });
});
