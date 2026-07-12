'use client';

import {
  GROK_VIDEO_DEFAULT_ASPECT_RATIO,
  GROK_VIDEO_DEFAULT_RESOLUTION,
  getGrokVideoResolutions,
  isGrokVideoModelId,
} from '@muirouter/shared-db/grok-video';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { pollVideoGeneration, sendVideoGenerationRequest } from './playground-api';
import type { GrokVideoOptions, HistoryItem, VideoApiResponse, VideoResult, VideoStatus } from './playground-types';

const DEFAULT_OPTIONS: GrokVideoOptions = {
  duration: 5,
  aspectRatio: GROK_VIDEO_DEFAULT_ASPECT_RATIO,
  resolution: GROK_VIDEO_DEFAULT_RESOLUTION,
};

type UsePlaygroundVideoOptions = {
  onError: (message: string) => void;
  createHistory: (item: Omit<HistoryItem, 'id' | 'createdAt'>) => string;
  updateHistory: (id: string, patch: Partial<HistoryItem>) => void;
};

export function usePlaygroundVideo(callbacks: UsePlaygroundVideoOptions) {
  const t = useTranslations('playground');
  const te = useTranslations('errors');
  const [model, setModel] = useState('');
  const [options, setOptions] = useState<GrokVideoOptions>(DEFAULT_OPTIONS);
  const [image, setImage] = useState<File | null>(null);
  const [result, setResult] = useState<VideoResult | null>(null);
  const [status, setStatus] = useState<VideoStatus>('idle');
  const [progress, setProgress] = useState<number | null>(null);
  const [requestId, setRequestId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const historyIdRef = useRef<string | undefined>(undefined);

  function clearTask() {
    setResult(null);
    setStatus('idle');
    setProgress(null);
    setRequestId('');
    historyIdRef.current = undefined;
  }

  function selectModel(value: string) {
    stop();
    setModel(value);
    if (isGrokVideoModelId(value)) {
      const resolutions = getGrokVideoResolutions(value);
      if (!resolutions.includes(options.resolution)) {
        setOptions((current) => ({ ...current, resolution: resolutions[0] }));
      }
    }
    clearTask();
  }

  function changeOptions(value: GrokVideoOptions) {
    stop();
    setOptions(value);
    clearTask();
  }

  function changeImage(value: File | null) {
    stop();
    setImage(value);
    clearTask();
  }

  async function run(apiKey: string, prompt: string) {
    if (requestId && status === 'pending') {
      await resume(apiKey, requestId, historyIdRef.current);
      return;
    }
    if (model === 'grok-imagine-video-1.5' && !image) {
      callbacks.onError(t('videoImageRequired'));
      return;
    }

    const controller = startPolling();
    clearTask();
    try {
      const response = await sendVideoGenerationRequest({
        apiKey,
        model,
        prompt,
        image,
        options,
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(await readResponseError(response));
      const data = (await response.json()) as VideoApiResponse;
      if (!data.request_id) throw new Error(t('videoMissingRequestId'));

      setRequestId(data.request_id);
      setStatus('pending');
      const historyId = callbacks.createHistory({
        mode: 'video',
        model,
        prompt,
        videoRequestId: data.request_id,
        videoStatus: 'pending',
        videoOptions: options,
      });
      historyIdRef.current = historyId;
      await poll(apiKey, data.request_id, controller.signal, historyId);
    } catch (error) {
      reportError(error);
    } finally {
      setIsLoading(false);
    }
  }

  async function resume(apiKey: string, targetRequestId: string, historyId?: string) {
    const controller = startPolling();
    try {
      await poll(apiKey, targetRequestId, controller.signal, historyId);
    } catch (error) {
      reportError(error);
    } finally {
      setIsLoading(false);
    }
  }

  async function poll(apiKey: string, targetRequestId: string, signal: AbortSignal, historyId?: string) {
    const data = await pollVideoGeneration({
      apiKey,
      requestId: targetRequestId,
      signal,
      onUpdate: (update) => {
        if (update.status) setStatus(update.status);
        setProgress(typeof update.progress === 'number' ? update.progress : null);
        if (historyId && update.status) callbacks.updateHistory(historyId, { videoStatus: update.status });
      },
    });
    if (data.status === 'done' && data.video?.url) {
      setResult({ url: data.video.url, duration: data.video.duration });
      if (historyId) callbacks.updateHistory(historyId, { videoStatus: 'done', videoUrl: data.video.url });
    } else if (data.status === 'failed' || data.status === 'expired') {
      callbacks.onError(t(data.status === 'failed' ? 'videoStatusFailed' : 'videoStatusExpired'));
    }
  }

  function restore(item: HistoryItem, apiKey: string) {
    setModel(item.model);
    setOptions(item.videoOptions ?? DEFAULT_OPTIONS);
    setRequestId(item.videoRequestId ?? '');
    setStatus(item.videoStatus ?? 'idle');
    setResult(item.videoUrl ? { url: item.videoUrl } : null);
    setImage(null);
    historyIdRef.current = item.id;
    if (item.videoRequestId && item.videoStatus === 'pending') {
      if (apiKey) void resume(apiKey, item.videoRequestId, item.id);
      else callbacks.onError(t('noKeyError'));
    }
  }

  function stop() {
    abortRef.current?.abort();
    setIsLoading(false);
  }

  function startPolling() {
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);
    callbacks.onError('');
    return controller;
  }

  function reportError(error: unknown) {
    if ((error as Error).name !== 'AbortError') {
      callbacks.onError(error instanceof Error ? error.message : te('operationFailed'));
    }
  }

  return {
    model,
    options,
    image,
    result,
    status,
    progress,
    requestId,
    isLoading,
    setInitialModel: setModel,
    selectModel,
    changeOptions,
    changeImage,
    clearTask,
    run,
    restore,
    stop,
  };
}

async function readResponseError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  return data?.error?.message ?? `Request failed (${response.status})`;
}
