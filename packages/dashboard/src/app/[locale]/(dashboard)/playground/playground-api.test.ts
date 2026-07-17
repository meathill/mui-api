import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fileToDataUrl,
  pollVideoGeneration,
  readChatStream,
  sendChatRequest,
  sendImageEditRequest,
  sendImageGenerationRequest,
  sendVideoGenerationRequest,
} from './playground-api';

const options = { count: 2, aspectRatio: '16:9', resolution: '2k' } as const;

describe('Playground Kimi K3 聊天请求', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('把多张图片转成标准 image_url parts，并设置 K3 默认推理参数', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response());
    vi.stubGlobal('fetch', fetchMock);

    await sendChatRequest({
      apiKey: 'test-key',
      model: 'kimi-k3',
      prompt: '比较两张图',
      images: [
        new File([new Uint8Array([1, 2])], 'one.png', { type: 'image/png' }),
        new File([new Uint8Array([3, 4])], 'two.gif', { type: 'image/gif' }),
      ],
      signal: new AbortController().signal,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/v1/chat/completions');
    expect(JSON.parse(String(init?.body))).toEqual({
      model: 'kimi-k3',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: 'data:image/png;base64,AQI=' } },
            { type: 'image_url', image_url: { url: 'data:image/gif;base64,AwQ=' } },
            { type: 'text', text: '比较两张图' },
          ],
        },
      ],
      stream: true,
      reasoning_effort: 'max',
      max_completion_tokens: 16_384,
    });
  });

  it('分别累积 reasoning_content 和最终 content，并读取嵌套 usage', async () => {
    const encoder = new TextEncoder();
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"reasoning_content":"先想"}}]}\n\n'));
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"答案"}}]}\n\n'));
          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"delta":{},"usage":{"prompt_tokens":1000,"completion_tokens":200,"cached_tokens":800}}]}\n\n',
            ),
          );
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      }),
    );
    const contents: string[] = [];
    const reasoning: string[] = [];
    const usage: Array<{ inputTokens: number; cachedInputTokens: number; outputTokens: number }> = [];

    const result = await readChatStream(response, {
      onContent: (value) => contents.push(value),
      onReasoning: (value) => reasoning.push(value),
      onUsage: (value) => usage.push(value),
    });

    expect(result).toEqual({ content: '答案', reasoning: '先想' });
    expect(contents).toEqual(['答案']);
    expect(reasoning).toEqual(['先想']);
    expect(usage).toEqual([{ inputTokens: 1000, cachedInputTokens: 800, outputTokens: 200 }]);
  });
});

describe('Playground Grok 图片请求', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('生成请求只发送 Grok 原生参数', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({ data: [] }));
    vi.stubGlobal('fetch', fetchMock);
    await sendImageGenerationRequest({
      apiKey: 'test-key',
      model: 'grok-imagine-image',
      prompt: 'a corgi',
      isGrok: true,
      grokOptions: options,
      signal: new AbortController().signal,
    });
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toEqual({
      model: 'grok-imagine-image',
      prompt: 'a corgi',
      n: 2,
      aspect_ratio: '16:9',
      resolution: '2k',
      response_format: 'b64_json',
    });
  });

  it('把多张上传图片转成 Grok JSON images', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({ data: [] }));
    vi.stubGlobal('fetch', fetchMock);
    await sendImageEditRequest({
      apiKey: 'test-key',
      model: 'grok-imagine-image-quality',
      prompt: 'combine them',
      images: [
        new File([new Uint8Array([1, 2])], 'one.png', { type: 'image/png' }),
        new File([new Uint8Array([3, 4])], 'two.png', { type: 'image/png' }),
      ],
      isGrok: true,
      grokOptions: options,
      signal: new AbortController().signal,
    });
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body));
    expect(body.images).toEqual([
      { type: 'image_url', url: 'data:image/png;base64,AQI=' },
      { type: 'image_url', url: 'data:image/png;base64,AwQ=' },
    ]);
    expect(body.resolution).toBe('2k');
  });

  it('文件转换保留 MIME type', async () => {
    await expect(fileToDataUrl(new File(['hi'], 'photo.webp', { type: 'image/webp' }))).resolves.toBe(
      'data:image/webp;base64,aGk=',
    );
  });
});

describe('Playground Grok 视频请求', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('提交视频时把单图转换为官方 image.url shape', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({ request_id: 'video-1' }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await sendVideoGenerationRequest({
      apiKey: 'test-key',
      model: 'grok-imagine-video-1.5',
      prompt: 'animate it',
      image: new File(['hi'], 'source.png', { type: 'image/png' }),
      options: { duration: 8, aspectRatio: '9:16', resolution: '1080p' },
      signal: new AbortController().signal,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/v1/videos/generations');
    expect(JSON.parse(String(init?.body))).toEqual({
      model: 'grok-imagine-video-1.5',
      prompt: 'animate it',
      duration: 8,
      aspect_ratio: '9:16',
      resolution: '1080p',
      image: { url: 'data:image/png;base64,aGk=' },
    });
  });

  it('轮询直到 done 并逐次上报状态', async () => {
    const updates: string[] = [];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ status: 'pending', progress: 50 }))
      .mockResolvedValueOnce(Response.json({ status: 'done', video: { url: 'https://example.test/video.mp4' } }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await pollVideoGeneration({
      apiKey: 'test-key',
      requestId: 'video-1',
      signal: new AbortController().signal,
      intervalMs: 0,
      onUpdate: (data) => updates.push(data.status ?? ''),
    });
    expect(updates).toEqual(['pending', 'done']);
    expect(result.video?.url).toBe('https://example.test/video.mp4');
  });
});
