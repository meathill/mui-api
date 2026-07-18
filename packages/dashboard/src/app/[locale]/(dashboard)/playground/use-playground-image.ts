'use client';

import { GROK_IMAGE_MAX_INPUTS } from '@muirouter/shared-db/grok-image';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { sendImageEditRequest, sendImageGenerationRequest } from './playground-api';
import { toImageResult } from './playground-media-results';
import type {
  GrokImageOptions,
  HistoryItem,
  ImageApiItem,
  ImageResult,
  TokenInfo,
  TokenUsagePayload,
} from './playground-types';
import { toTokenInfo } from './playground-utils';

const DEFAULT_GROK_IMAGE_OPTIONS: GrokImageOptions = { count: 1, aspectRatio: 'auto', resolution: '1k' };

type UsePlaygroundImageOptions = {
  startRequest: () => AbortSignal;
  setRequestError: (res: Response) => Promise<void>;
  setError: (message: string) => void;
  setTokenInfo: (info: TokenInfo | null) => void;
  setLoading: (loading: boolean) => void;
  createHistory: (item: Omit<HistoryItem, 'id' | 'createdAt'>) => string;
};

export function usePlaygroundImage(callbacks: UsePlaygroundImageOptions) {
  const t = useTranslations('playground');
  const te = useTranslations('errors');
  const [imageModel, setImageModel] = useState('');
  const [imageResults, setImageResults] = useState<ImageResult[]>([]);
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [grokImageOptions, setGrokImageOptions] = useState<GrokImageOptions>(DEFAULT_GROK_IMAGE_OPTIONS);

  function handleFilesChange(files: FileList | null, isGrokImage: boolean) {
    const nextFiles = files ? Array.from(files) : [];
    if (isGrokImage && nextFiles.length > GROK_IMAGE_MAX_INPUTS) {
      callbacks.setError(t('grokMaxImagesError', { count: GROK_IMAGE_MAX_INPUTS }));
      return;
    }
    callbacks.setError('');
    setUploadedImages(nextFiles);
  }

  function removeUpload(index: number) {
    setUploadedImages((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function clearUploads() {
    setUploadedImages([]);
  }

  async function doGenerateImage(apiKey: string, prompt: string, isGrokImage: boolean) {
    const signal = callbacks.startRequest();
    try {
      const res =
        uploadedImages.length > 0
          ? await sendImageEditRequest({
              apiKey,
              model: imageModel,
              prompt,
              images: uploadedImages,
              isGrok: isGrokImage,
              grokOptions: grokImageOptions,
              signal,
            })
          : await sendImageGenerationRequest({
              apiKey,
              model: imageModel,
              prompt,
              isGrok: isGrokImage,
              grokOptions: grokImageOptions,
              signal,
            });

      if (!res.ok) {
        await callbacks.setRequestError(res);
        return;
      }

      const data = (await res.json()) as { data?: ImageApiItem[]; usage?: TokenUsagePayload };
      const results = (data.data ?? []).flatMap(toImageResult);
      setImageResults(results);
      const tokens = toTokenInfo(data.usage);
      if (tokens) callbacks.setTokenInfo(tokens);
      callbacks.createHistory({
        mode: 'image',
        model: imageModel,
        prompt,
        imageCount: results.length,
        grokImageOptions: isGrokImage ? grokImageOptions : undefined,
      });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        callbacks.setError(e instanceof Error ? e.message : te('operationFailed'));
      }
    } finally {
      callbacks.setLoading(false);
    }
  }

  function reset() {
    setImageResults([]);
  }

  function restore(item: HistoryItem) {
    setImageModel(item.model);
    setGrokImageOptions(item.grokImageOptions ?? DEFAULT_GROK_IMAGE_OPTIONS);
  }

  return {
    imageModel,
    imageResults,
    uploadedImages,
    grokImageOptions,
    setImageModel,
    setGrokImageOptions,
    handleFilesChange,
    removeUpload,
    clearUploads,
    doGenerateImage,
    reset,
    restore,
  };
}
