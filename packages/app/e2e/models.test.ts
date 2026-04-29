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
    expect(modelIds).toContain('mimo-v2.5-tts');
    expect(modelIds).toContain('mimo-v2.5-tts-voiceclone');
    expect(modelIds).toContain('mimo-v2.5-tts-voicedesign');
  });
});
