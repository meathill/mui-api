import type { GrokImageAspectRatio, GrokImageResolution } from '@muirouter/shared-db/grok-image';

export type PlaygroundMode = 'chat' | 'image' | 'tts';

export type GrokImageOptions = {
  count: number;
  aspectRatio: GrokImageAspectRatio;
  resolution: GrokImageResolution;
};

export type HistoryItem = {
  id: string;
  mode: PlaygroundMode;
  model: string;
  prompt: string;
  createdAt: string;
  response?: string;
  imageCount?: number;
  grokImageOptions?: GrokImageOptions;
  ttsStylePrompt?: string;
  audioFilename?: string;
};

export type ImageResult = {
  id: string;
  src: string;
  mimeType: string;
  filename: string;
};

export type ImageApiItem = {
  b64_json?: string;
  url?: string;
  output_format?: string;
  mime_type?: string;
};

export type AudioResult = {
  id: string;
  src: string;
  mimeType: string;
  filename: string;
};

export type TokenUsagePayload = {
  input_tokens?: number;
  output_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  cost_in_usd_ticks?: number;
};

export type TokenInfo = {
  inputTokens: number;
  outputTokens: number;
};

export type TtsRequestBody = {
  model: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  audio: {
    format: 'wav';
    voice?: string;
  };
  stream: false;
};

export type TtsApiResponse = {
  choices?: Array<{
    message?: {
      audio?: {
        data?: string;
        id?: string;
      };
    };
  }>;
  usage?: TokenUsagePayload;
};
