import { env, SELF } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { seedApiKey } from './helpers';

async function waitForConcurrencyMirror(userId: string, expected: number): Promise<void> {
  for (let index = 0; index < 20; index += 1) {
    const userData = await env.KV.get<{ concurrency: number }>(`user:${userId}`, 'json');
    if (userData?.concurrency === expected) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  const userData = await env.KV.get<{ concurrency: number }>(`user:${userId}`, 'json');
  expect(userData?.concurrency).toBe(expected);
}

describe('并发限流', () => {
  let apiKey: string;
  let upstreamFetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    apiKey = await seedApiKey('test-user-concurrency', 10, { maxConcurrency: 1 });

    upstreamFetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = init?.body ? (JSON.parse(String(init.body)) as { stream?: boolean }) : {};
      const isStream = body.stream === true;
      const callCount = upstreamFetchMock.mock.calls.length;

      if (isStream && callCount === 1) {
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('data: {"id":"chatcmpl-test"}\n\n'));
              setTimeout(() => {
                controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
                controller.close();
              }, 150);
            },
          }),
          {
            headers: {
              'Content-Type': 'text/event-stream',
            },
          },
        );
      }

      if (isStream) {
        return new Response('data: [DONE]\n\n', {
          headers: {
            'Content-Type': 'text/event-stream',
          },
        });
      }

      return Response.json({
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: 1,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'ok' },
            finish_reason: 'stop',
          },
        ],
      });
    });

    vi.stubGlobal('fetch', upstreamFetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('同一用户活跃流未结束时后续请求命中 429，结束后恢复', async () => {
    const userId = 'test-user-concurrency';
    const firstResponse = await SELF.fetch('http://localhost/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'hello' }],
        stream: true,
      }),
    });

    expect(firstResponse.status).toBe(200);

    const secondResponse = await SELF.fetch('http://localhost/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'hello again' }],
        stream: false,
      }),
    });

    expect(secondResponse.status).toBe(429);
    const secondBody = await secondResponse.json<{ error: { type: string } }>();
    expect(secondBody.error.type).toBe('rate_limit_exceeded');

    await firstResponse.text();

    const thirdResponse = await SELF.fetch('http://localhost/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'hello after release' }],
        stream: false,
      }),
    });

    expect(thirdResponse.status).toBe(200);
    await thirdResponse.text();

    await waitForConcurrencyMirror(userId, 0);
  });
});
