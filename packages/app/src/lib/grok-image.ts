import {
  GROK_IMAGE_ASPECT_RATIOS,
  GROK_IMAGE_MAX_INPUTS,
  GROK_IMAGE_MAX_OUTPUTS,
  GROK_IMAGE_RESOLUTIONS,
  type GrokImageAspectRatio,
  type GrokImageModelId,
  type GrokImageResolution,
  isGrokImageModelId,
} from '@muirouter/shared-db/grok-image';
import type { GrokImageUsageContext } from '../services/usage-extractor';

type JsonBody = Record<string, unknown>;
type GrokImageReference = { type: 'image_url'; url: string };

export type ParsedGrokImageRequest = {
  body: JsonBody;
  usageContext: GrokImageUsageContext;
};

export type GrokImageParseResult = ParsedGrokImageRequest | { error: string };

export function parseGrokImageGenerationRequest(body: JsonBody, upstreamModel: string): GrokImageParseResult {
  const common = parseCommon(body, upstreamModel);
  if ('error' in common) return common;

  const outputCount = body.n == null ? 1 : body.n;
  if (!Number.isInteger(outputCount) || Number(outputCount) < 1 || Number(outputCount) > GROK_IMAGE_MAX_OUTPUTS) {
    return { error: `n 必须是 1-${GROK_IMAGE_MAX_OUTPUTS} 的整数` };
  }

  return {
    body: compact({
      model: upstreamModel,
      prompt: body.prompt,
      n: Number(outputCount),
      aspect_ratio: common.aspectRatio,
      resolution: common.resolution,
      response_format: common.responseFormat,
    }),
    usageContext: {
      model: common.model,
      inputCount: 0,
      outputCount: Number(outputCount),
      resolution: common.resolution,
    },
  };
}

export function parseGrokImageEditRequest(body: JsonBody, upstreamModel: string): GrokImageParseResult {
  const common = parseCommon(body, upstreamModel);
  if ('error' in common) return common;

  const references = parseReferences(body);
  if ('error' in references) return references;

  const requestImages =
    references.images.length === 1 ? { image: references.images[0] } : { images: references.images };
  return {
    body: compact({
      model: upstreamModel,
      prompt: body.prompt,
      ...requestImages,
      aspect_ratio: common.aspectRatio,
      resolution: common.resolution,
      response_format: common.responseFormat,
    }),
    usageContext: {
      model: common.model,
      inputCount: references.images.length,
      outputCount: 1,
      resolution: common.resolution,
    },
  };
}

function parseCommon(
  body: JsonBody,
  upstreamModel: string,
):
  | {
      model: GrokImageModelId;
      resolution: GrokImageResolution;
      aspectRatio?: GrokImageAspectRatio;
      responseFormat: 'url' | 'b64_json';
    }
  | { error: string } {
  if (!isGrokImageModelId(upstreamModel)) {
    return { error: `不支持的 Grok 图片模型: ${upstreamModel}` };
  }

  const resolution = body.resolution ?? '1k';
  if (!GROK_IMAGE_RESOLUTIONS.includes(resolution as GrokImageResolution)) {
    return { error: `resolution 必须是 ${GROK_IMAGE_RESOLUTIONS.join(' 或 ')}` };
  }

  const aspectRatio = body.aspect_ratio;
  if (
    aspectRatio != null &&
    (typeof aspectRatio !== 'string' || !GROK_IMAGE_ASPECT_RATIOS.includes(aspectRatio as GrokImageAspectRatio))
  ) {
    return { error: 'aspect_ratio 不受支持' };
  }

  const responseFormat = body.response_format ?? 'url';
  if (responseFormat !== 'url' && responseFormat !== 'b64_json') {
    return { error: 'response_format 必须是 url 或 b64_json' };
  }

  return {
    model: upstreamModel,
    resolution: resolution as GrokImageResolution,
    aspectRatio: aspectRatio as GrokImageAspectRatio | undefined,
    responseFormat,
  };
}

function parseReferences(body: JsonBody): { images: GrokImageReference[] } | { error: string } {
  if (body.image != null && body.images != null) {
    return { error: 'image 和 images 不能同时提供' };
  }
  const rawImages = body.image != null ? [body.image] : body.images;
  if (!Array.isArray(rawImages) || rawImages.length === 0 || rawImages.length > GROK_IMAGE_MAX_INPUTS) {
    return { error: `Grok 图片编辑需要 1-${GROK_IMAGE_MAX_INPUTS} 张参考图` };
  }

  const images: GrokImageReference[] = [];
  for (const rawImage of rawImages) {
    if (!rawImage || typeof rawImage !== 'object') return { error: '参考图格式无效' };
    const image = rawImage as Record<string, unknown>;
    if (typeof image.url !== 'string' || !image.url) return { error: '参考图缺少 url' };
    if (image.type != null && image.type !== 'image_url') return { error: '参考图 type 必须是 image_url' };
    images.push({ type: 'image_url', url: image.url });
  }
  return { images };
}

function compact(body: JsonBody): JsonBody {
  return Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined));
}
