import {
  GROK_VIDEO_ASPECT_RATIOS,
  GROK_VIDEO_DEFAULT_ASPECT_RATIO,
  GROK_VIDEO_DEFAULT_RESOLUTION,
  GROK_VIDEO_DURATION_MAX,
  GROK_VIDEO_DURATION_MIN,
  GROK_VIDEO_MODEL_CONFIGS,
  type GrokVideoAspectRatio,
  type GrokVideoModelId,
  type GrokVideoResolution,
  getGrokVideoResolutions,
  isGrokVideoModelId,
} from '@muirouter/shared-db/grok-video';

export type GrokVideoGenerationBody = {
  model: GrokVideoModelId;
  prompt: string;
  duration: number;
  resolution: GrokVideoResolution;
  aspect_ratio: GrokVideoAspectRatio;
  image?: { url: string };
};

export function parseGrokVideoGenerationRequest(
  body: Record<string, unknown>,
  upstreamModel: string,
): { body: GrokVideoGenerationBody; hasImage: boolean } | { error: string } {
  if (!isGrokVideoModelId(upstreamModel)) return { error: `不支持的视频模型: ${upstreamModel}` };
  if (typeof body.prompt !== 'string' || !body.prompt.trim()) return { error: '缺少 prompt 参数' };
  if (
    !Number.isInteger(body.duration) ||
    Number(body.duration) < GROK_VIDEO_DURATION_MIN ||
    Number(body.duration) > GROK_VIDEO_DURATION_MAX
  ) {
    return { error: `duration 必须是 ${GROK_VIDEO_DURATION_MIN} 到 ${GROK_VIDEO_DURATION_MAX} 的整数` };
  }

  const resolution = (body.resolution ?? GROK_VIDEO_DEFAULT_RESOLUTION) as GrokVideoResolution;
  if (!getGrokVideoResolutions(upstreamModel).includes(resolution)) {
    return { error: `模型 ${upstreamModel} 不支持分辨率 ${resolution}` };
  }
  const aspectRatio = (body.aspect_ratio ?? GROK_VIDEO_DEFAULT_ASPECT_RATIO) as GrokVideoAspectRatio;
  if (!GROK_VIDEO_ASPECT_RATIOS.includes(aspectRatio)) {
    return { error: `aspect_ratio 必须是 ${GROK_VIDEO_ASPECT_RATIOS.join('、')} 之一` };
  }

  let image: { url: string } | undefined;
  if (body.image !== undefined) {
    if (!body.image || typeof body.image !== 'object' || typeof (body.image as { url?: unknown }).url !== 'string') {
      return { error: 'image 必须是包含非空 url 的对象' };
    }
    const url = (body.image as { url: string }).url.trim();
    if (!url) return { error: 'image.url 不能为空' };
    image = { url };
  }
  if (GROK_VIDEO_MODEL_CONFIGS[upstreamModel].requiresImage && !image) {
    return { error: `模型 ${upstreamModel} 必须提供 image` };
  }

  return {
    hasImage: Boolean(image),
    body: {
      model: upstreamModel,
      prompt: body.prompt.trim(),
      duration: Number(body.duration),
      resolution,
      aspect_ratio: aspectRatio,
      ...(image ? { image } : {}),
    },
  };
}
