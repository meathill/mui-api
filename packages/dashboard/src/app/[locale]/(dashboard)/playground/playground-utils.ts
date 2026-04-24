import type { ModelInfo } from '@/lib/api';
import type { HistoryItem, ImageApiItem, ImageResult } from './playground-types';

export const MAX_HISTORY_ITEMS = 30;
export const BUILT_IN_IMAGE_MODELS: ModelInfo[] = [
  {
    id: 'gpt-image-2',
    provider: 'openai',
    upstreamModelId: 'gpt-image-2',
    inputPrice: 8,
    outputPrice: 30,
    markupRate: 1.2,
  },
];

export function getApiBase() {
  return process.env.NEXT_PUBLIC_API_BASE || '';
}

export function isImageModel(model: ModelInfo) {
  return model.id.includes('image') || Boolean(model.upstreamModelId?.includes('image'));
}

export function appendBuiltInImageModels(models: ModelInfo[]) {
  const mergedModels = [...models];
  for (const model of BUILT_IN_IMAGE_MODELS) {
    if (!mergedModels.some((item) => item.id === model.id)) {
      mergedModels.push(model);
    }
  }
  return mergedModels;
}

export function parseHistory(raw: string): HistoryItem[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY_ITEMS) : [];
  } catch {
    return [];
  }
}

export function toImageResult(item: ImageApiItem, index: number): ImageResult[] {
  const format = item.output_format ?? 'png';
  const mimeType = format === 'jpeg' ? 'image/jpeg' : `image/${format}`;
  if (item.b64_json) {
    return [
      {
        id: crypto.randomUUID(),
        src: `data:${mimeType};base64,${item.b64_json}`,
        mimeType,
        filename: `muirouter-image-${index + 1}.${format === 'jpeg' ? 'jpg' : format}`,
      },
    ];
  }
  if (item.url) {
    return [{ id: crypto.randomUUID(), src: item.url, mimeType, filename: `muirouter-image-${index + 1}.png` }];
  }
  return [];
}

export function downloadImage(image: ImageResult) {
  const anchor = document.createElement('a');
  anchor.href = image.src;
  anchor.download = image.filename;
  anchor.rel = 'noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function sendImageGenerationRequest(params: {
  apiKey: string;
  model: string;
  prompt: string;
  signal: AbortSignal;
}) {
  return fetch(`${getApiBase()}/v1/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      prompt: params.prompt,
      size: '1024x1024',
      quality: 'auto',
      moderation: 'low',
    }),
    signal: params.signal,
  });
}

export function sendImageEditRequest(params: {
  apiKey: string;
  model: string;
  prompt: string;
  images: File[];
  signal: AbortSignal;
}) {
  const form = new FormData();
  form.append('model', params.model);
  form.append('prompt', params.prompt);
  form.append('moderation', 'low');
  for (const file of params.images) {
    form.append('image[]', file, file.name);
  }

  return fetch(`${getApiBase()}/v1/images/edits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${params.apiKey}` },
    body: form,
    signal: params.signal,
  });
}
