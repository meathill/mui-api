import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fileToDataUrl,
  pollVideoGeneration,
  sendImageEditRequest,
  sendImageGenerationRequest,
  sendVideoGenerationRequest,
} from './playground-api';

const options = { count: 2, aspectRatio: '16:9', resolution: '2k' } as const;

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
