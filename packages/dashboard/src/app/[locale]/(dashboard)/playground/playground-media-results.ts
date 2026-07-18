import type { AudioResult, ImageApiItem, ImageResult } from './playground-types';

export const MAX_KIMI_IMAGE_BYTES = 50_000_000;

export function getKimiImageInputError(files: File[]): 'kimiImageUnsupportedError' | 'kimiImageTooLargeError' | null {
  if (files.some((file) => !isSupportedKimiImage(file))) return 'kimiImageUnsupportedError';
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  return totalBytes > MAX_KIMI_IMAGE_BYTES ? 'kimiImageTooLargeError' : null;
}

function isSupportedKimiImage(file: File): boolean {
  if (['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) return true;
  return /\.(png|jpe?g|webp|gif)$/i.test(file.name);
}

export function toImageResult(item: ImageApiItem, index: number): ImageResult[] {
  const format = item.output_format ?? item.mime_type?.split('/')[1] ?? 'png';
  const mimeType = item.mime_type ?? (format === 'jpeg' ? 'image/jpeg' : `image/${format}`);
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
  triggerDownload(image.src, image.filename);
}

export function downloadAudio(audio: AudioResult) {
  triggerDownload(audio.src, audio.filename);
}

export function downloadVideo(url: string) {
  triggerDownload(url, `muirouter-video-${Date.now()}.mp4`);
}

function triggerDownload(src: string, filename: string) {
  const anchor = document.createElement('a');
  anchor.href = src;
  anchor.download = filename;
  anchor.rel = 'noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
