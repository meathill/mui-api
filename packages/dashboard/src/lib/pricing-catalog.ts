export type PricingProvider = 'openai' | 'gemini';

export type PricingNoteKey = 'openaiLongContext' | 'gemini31ProPreview' | 'geminiPreview';

export interface PricingModel {
  name: string;
  modelId?: string;
  inputPrice: number;
  cachedInputPrice: number | null;
  outputPrice: number;
  noteKey?: PricingNoteKey;
}

export interface ProviderPricingSection {
  provider: PricingProvider;
  sourceUrl: string;
  updatedAt: string;
  models: PricingModel[];
}

export const PRICING_UPDATED_AT = '2026-04-01';

export const PRICING_CATALOG: ProviderPricingSection[] = [
  {
    provider: 'openai',
    sourceUrl: 'https://developers.openai.com/api/docs/pricing',
    updatedAt: PRICING_UPDATED_AT,
    models: [
      {
        name: 'GPT-5.4',
        modelId: 'gpt-5.4',
        inputPrice: 2.5,
        cachedInputPrice: 0.25,
        outputPrice: 15,
        noteKey: 'openaiLongContext',
      },
      {
        name: 'GPT-5.4 mini',
        modelId: 'gpt-5.4-mini',
        inputPrice: 0.75,
        cachedInputPrice: 0.075,
        outputPrice: 4.5,
      },
      {
        name: 'GPT-5.4 nano',
        modelId: 'gpt-5.4-nano',
        inputPrice: 0.2,
        cachedInputPrice: 0.02,
        outputPrice: 1.25,
      },
      {
        name: 'GPT-5.3 Codex',
        modelId: 'gpt-5.3-codex',
        inputPrice: 1.75,
        cachedInputPrice: 0.175,
        outputPrice: 14,
      },
    ],
  },
  {
    provider: 'gemini',
    sourceUrl: 'https://ai.google.dev/pricing',
    updatedAt: PRICING_UPDATED_AT,
    models: [
      {
        name: 'Gemini 3.1 Pro Preview',
        modelId: 'gemini-3.1-pro-preview',
        inputPrice: 2,
        cachedInputPrice: 0.2,
        outputPrice: 12,
        noteKey: 'gemini31ProPreview',
      },
      {
        name: 'Gemini 3.1 Flash-Lite Preview',
        modelId: 'gemini-3.1-flash-lite-preview',
        inputPrice: 0.25,
        cachedInputPrice: 0.025,
        outputPrice: 1.5,
        noteKey: 'geminiPreview',
      },
      {
        name: 'Gemini 3 Flash Preview',
        modelId: 'gemini-3-flash-preview',
        inputPrice: 0.5,
        cachedInputPrice: 0.05,
        outputPrice: 3,
        noteKey: 'geminiPreview',
      },
    ],
  },
];
