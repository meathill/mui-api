export type PlaygroundMode = 'chat' | 'image';

export type HistoryItem = {
  id: string;
  mode: PlaygroundMode;
  model: string;
  prompt: string;
  createdAt: string;
  response?: string;
  imageCount?: number;
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
};
