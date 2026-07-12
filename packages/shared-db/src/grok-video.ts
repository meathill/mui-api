import { convertUsdTicksToInternalTokens, convertUsdToInternalTokens } from './grok-image';

export const GROK_VIDEO_DURATION_MIN = 1;
export const GROK_VIDEO_DURATION_MAX = 15;
export const GROK_VIDEO_DEFAULT_RESOLUTION = '480p' as const;
export const GROK_VIDEO_DEFAULT_ASPECT_RATIO = '16:9' as const;

export const GROK_VIDEO_ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'] as const;
export type GrokVideoAspectRatio = (typeof GROK_VIDEO_ASPECT_RATIOS)[number];

export const GROK_VIDEO_RESOLUTIONS = ['480p', '720p', '1080p'] as const;
export type GrokVideoResolution = (typeof GROK_VIDEO_RESOLUTIONS)[number];

export type GrokVideoModelConfig = {
  requiresImage: boolean;
  inputImagePrice: number;
  outputSecondPrices: Partial<Record<GrokVideoResolution, number>>;
};

export const GROK_VIDEO_MODEL_CONFIGS = {
  'grok-imagine-video': {
    requiresImage: false,
    inputImagePrice: 0.002,
    outputSecondPrices: { '480p': 0.05, '720p': 0.07 },
  },
  'grok-imagine-video-1.5': {
    requiresImage: true,
    inputImagePrice: 0.01,
    outputSecondPrices: { '480p': 0.08, '720p': 0.14, '1080p': 0.25 },
  },
} as const satisfies Record<string, GrokVideoModelConfig>;

export type GrokVideoModelId = keyof typeof GROK_VIDEO_MODEL_CONFIGS;
export const GROK_VIDEO_MODEL_IDS = Object.keys(GROK_VIDEO_MODEL_CONFIGS) as GrokVideoModelId[];

export function isGrokVideoModelId(modelId: string): modelId is GrokVideoModelId {
  return modelId in GROK_VIDEO_MODEL_CONFIGS;
}

export function getGrokVideoResolutions(modelId: GrokVideoModelId): GrokVideoResolution[] {
  return Object.keys(GROK_VIDEO_MODEL_CONFIGS[modelId].outputSecondPrices) as GrokVideoResolution[];
}

export function calculateGrokVideoUpstreamCost(params: {
  model: GrokVideoModelId;
  duration: number;
  resolution?: GrokVideoResolution;
  hasImage?: boolean;
}): number {
  const config: GrokVideoModelConfig = GROK_VIDEO_MODEL_CONFIGS[params.model];
  const resolution = params.resolution ?? GROK_VIDEO_DEFAULT_RESOLUTION;
  const outputPrice = config.outputSecondPrices[resolution];
  if (outputPrice === undefined) {
    throw new Error(`模型 ${params.model} 不支持分辨率 ${resolution}`);
  }
  return params.duration * outputPrice + (params.hasImage ? config.inputImagePrice : 0);
}

export function calculateGrokVideoInternalTokens(params: {
  model: GrokVideoModelId;
  duration: number;
  resolution?: GrokVideoResolution;
  hasImage?: boolean;
  costInUsdTicks?: number;
}): number {
  if (params.costInUsdTicks !== undefined && Number.isFinite(params.costInUsdTicks) && params.costInUsdTicks >= 0) {
    return convertUsdTicksToInternalTokens(params.costInUsdTicks);
  }
  return convertUsdToInternalTokens(calculateGrokVideoUpstreamCost(params));
}
