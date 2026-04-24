import { SELF } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { seedApiKey } from './helpers';

describe('POST /v1/images/generations', () => {
  let apiKey: string;

  beforeAll(async () => {
    apiKey = await seedApiKey('test-user-images');
  });

  it('缺少 model 参数返回 400', async () => {
    const res = await SELF.fetch('http://localhost/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: 'a clean product photo' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json<{ error: { type: string } }>();
    expect(body.error.type).toBe('invalid_request_error');
  });

  it('缺少 prompt 参数返回 400', async () => {
    const res = await SELF.fetch('http://localhost/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'gpt-image-2' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json<{ error: { type: string } }>();
    expect(body.error.type).toBe('invalid_request_error');
  });

  it('未知图片模型返回 404', async () => {
    const res = await SELF.fetch('http://localhost/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'unknown-image-model', prompt: 'a clean product photo' }),
    });

    expect(res.status).toBe(404);
    const body = await res.json<{ error: { type: string } }>();
    expect(body.error.type).toBe('invalid_request_error');
  });
});

describe('POST /v1/images/edits', () => {
  let apiKey: string;

  beforeAll(async () => {
    apiKey = await seedApiKey('test-user-image-edits');
  });

  it('非 multipart 请求返回 400', async () => {
    const res = await SELF.fetch('http://localhost/v1/images/edits', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'gpt-image-2', prompt: 'make it brighter' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json<{ error: { type: string } }>();
    expect(body.error.type).toBe('invalid_request_error');
  });

  it('缺少 prompt 参数返回 400', async () => {
    const form = new FormData();
    form.append('model', 'gpt-image-2');

    const res = await SELF.fetch('http://localhost/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    expect(res.status).toBe(400);
    const body = await res.json<{ error: { type: string } }>();
    expect(body.error.type).toBe('invalid_request_error');
  });
});
