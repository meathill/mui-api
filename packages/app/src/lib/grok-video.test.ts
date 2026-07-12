import {
  calculateGrokVideoInternalTokens,
  calculateGrokVideoUpstreamCost,
  getGrokVideoResolutions,
} from '@muirouter/shared-db/grok-video';
import { describe, expect, it } from 'vitest';
import { parseGrokVideoGenerationRequest } from './grok-video';

describe('Grok Video 配置与请求解析', () => {
  it('按模型、时长、分辨率和输入图估算成本', () => {
    expect(
      calculateGrokVideoUpstreamCost({ model: 'grok-imagine-video', duration: 10, resolution: '720p' }),
    ).toBeCloseTo(0.7);
    expect(
      calculateGrokVideoUpstreamCost({
        model: 'grok-imagine-video-1.5',
        duration: 12,
        resolution: '1080p',
        hasImage: true,
      }),
    ).toBeCloseTo(3.01);
    expect(getGrokVideoResolutions('grok-imagine-video')).toEqual(['480p', '720p']);
  });

  it('优先把官方美元 ticks 换算成内部 token', () => {
    expect(
      calculateGrokVideoInternalTokens({
        model: 'grok-imagine-video',
        duration: 10,
        costInUsdTicks: 500_000_000,
      }),
    ).toBe(50_000);
  });

  it('校验 duration、分辨率和 1.5 的必填图片', () => {
    expect(
      parseGrokVideoGenerationRequest({ prompt: 'animate', duration: 12, resolution: '1080p' }, 'grok-imagine-video'),
    ).toHaveProperty('error');
    expect(
      parseGrokVideoGenerationRequest({ prompt: 'animate', duration: 12 }, 'grok-imagine-video-1.5'),
    ).toHaveProperty('error');
    expect(
      parseGrokVideoGenerationRequest(
        { prompt: 'animate', duration: 12, image: { url: 'data:image/png;base64,AAAA' } },
        'grok-imagine-video-1.5',
      ),
    ).toMatchObject({
      body: { resolution: '480p', aspect_ratio: '16:9', duration: 12 },
      hasImage: true,
    });
  });
});
