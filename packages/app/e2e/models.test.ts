import { SELF } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { seedApiKey } from './helpers';

describe('GET /v1/models', () => {
  let apiKey: string;

  beforeAll(async () => {
    apiKey = await seedApiKey('test-user-1');
  });

  it('返回模型列表', async () => {
    const res = await SELF.fetch('http://localhost/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ data: Array<{ id: string }> }>();
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.length).toBeGreaterThanOrEqual(2);
    const modelIds = body.data.map((m) => m.id);
    expect(modelIds).toContain('gpt-4o');
    expect(modelIds).toContain('gpt-image-2');
    expect(modelIds).toContain('claude-sonnet-4-20250514');
    expect(modelIds).toContain('mimo-v2.5-pro');
    expect(modelIds).toContain('kimi-k3');
    expect(modelIds).toContain('mimo-v2.5-tts');
    expect(modelIds).toContain('mimo-v2.5-tts-voiceclone');
    expect(modelIds).toContain('mimo-v2.5-tts-voicedesign');
    expect(modelIds).toContain('grok-4.6');
    expect(modelIds).toContain('deepseek-v4-pro');
  });

  // 这批增强字段是「客户端只填 endpoint + key 就能刷出模型」的关键：
  // Cherry Studio / LobeChat / Cline 靠它们拿到上下文长度和价格。
  it('已录入元数据的模型返回 context_length / pricing / capabilities', async () => {
    const res = await SELF.fetch('http://localhost/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const body = await res.json<{ data: Array<Record<string, unknown>> }>();
    const gpt4o = body.data.find((m) => m.id === 'gpt-4o');

    expect(gpt4o).toMatchObject({
      object: 'model',
      owned_by: 'muirouter',
      display_name: 'GPT-4o',
      context_length: 128000,
      max_output_tokens: 16384,
      // 0.0025 $/1M × 1.2 加价 ÷ 1e6
      pricing: { prompt: '0.000000003', completion: '0.000000012' },
      capabilities: { vision: true, reasoning: false, tool_call: true, attachment: true },
    });
    expect(gpt4o?.created).toBe(Date.UTC(2024, 4, 13) / 1000);
  });

  it('未录入元数据的模型仍返回 OpenAI 官方四字段，不塞空对象', async () => {
    const res = await SELF.fetch('http://localhost/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const body = await res.json<{ data: Array<Record<string, unknown>> }>();
    const bare = body.data.find((m) => m.id === 'grok-4.3');

    expect(bare).toMatchObject({ id: 'grok-4.3', object: 'model', created: 0, owned_by: 'muirouter' });
    expect(bare?.capabilities).toBeUndefined();
    expect(bare?.context_length).toBeUndefined();
  });

  it('owned_by 不再泄露内部 provider 枚举', async () => {
    const res = await SELF.fetch('http://localhost/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const body = await res.json<{ data: Array<{ owned_by: string }> }>();
    expect(new Set(body.data.map((m) => m.owned_by))).toEqual(new Set(['muirouter']));
  });
});
