export const GROK_IMAGE_RESOLUTIONS = ['1k', '2k'] as const;
export type GrokImageResolution = (typeof GROK_IMAGE_RESOLUTIONS)[number];

export const GROK_IMAGE_ASPECT_RATIOS = [
  'auto',
  '1:1',
  '16:9',
  '9:16',
  '4:3',
  '3:4',
  '3:2',
  '2:3',
  '2:1',
  '1:2',
  '19.5:9',
  '9:19.5',
  '20:9',
  '9:20',
] as const;
export type GrokImageAspectRatio = (typeof GROK_IMAGE_ASPECT_RATIOS)[number];

export const GROK_IMAGE_MAX_OUTPUTS = 10;
export const GROK_IMAGE_MAX_INPUTS = 3;
export const XAI_USD_TICKS_PER_INTERNAL_TOKEN = 10_000;

export type GrokImageModelConfig = {
  inputImagePrice: number;
  outputImagePrices: Record<GrokImageResolution, number>;
};

export const GROK_IMAGE_MODEL_CONFIGS = {
  'grok-imagine-image': {
    inputImagePrice: 0.002,
    outputImagePrices: { '1k': 0.02, '2k': 0.02 },
  },
  'grok-imagine-image-quality': {
    inputImagePrice: 0.01,
    outputImagePrices: { '1k': 0.05, '2k': 0.07 },
  },
} as const satisfies Record<string, GrokImageModelConfig>;

export type GrokImageModelId = keyof typeof GROK_IMAGE_MODEL_CONFIGS;
export const GROK_IMAGE_MODEL_IDS = Object.keys(GROK_IMAGE_MODEL_CONFIGS) as GrokImageModelId[];

export function isGrokImageModelId(modelId: string): modelId is GrokImageModelId {
  return modelId in GROK_IMAGE_MODEL_CONFIGS;
}

export function calculateGrokImageUpstreamCost(params: {
  model: GrokImageModelId;
  inputCount?: number;
  outputCount?: number;
  resolution?: GrokImageResolution;
}): number {
  const config = GROK_IMAGE_MODEL_CONFIGS[params.model];
  const resolution = params.resolution ?? '1k';
  return (
    (params.inputCount ?? 0) * config.inputImagePrice + (params.outputCount ?? 1) * config.outputImagePrices[resolution]
  );
}

export function convertUsdTicksToInternalTokens(costInUsdTicks: number): number {
  return Math.round(costInUsdTicks / XAI_USD_TICKS_PER_INTERNAL_TOKEN);
}

export function convertUsdToInternalTokens(costInUsd: number): number {
  return Math.round(costInUsd * 1_000_000);
}
