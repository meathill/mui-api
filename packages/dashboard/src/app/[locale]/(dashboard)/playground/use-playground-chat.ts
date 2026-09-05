'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { trackPlaygroundFirstRun } from '@/lib/analytics';
import { readChatStream, sendChatRequest } from './playground-api';
import type { HistoryItem, TokenInfo } from './playground-types';
import { getKimiImageInputError } from './playground-media-results';

type UsePlaygroundChatOptions = {
  startRequest: () => AbortSignal;
  setRequestError: (res: Response) => Promise<void>;
  setError: (message: string) => void;
  setTokenInfo: (info: TokenInfo | null) => void;
  setLoading: (loading: boolean) => void;
  createHistory: (item: Omit<HistoryItem, 'id' | 'createdAt'>) => string;
};

export function usePlaygroundChat(callbacks: UsePlaygroundChatOptions) {
  const t = useTranslations('playground');
  const te = useTranslations('errors');
  const [chatModel, setChatModel] = useState('');
  const [chatImages, setChatImages] = useState<File[]>([]);
  const [response, setResponse] = useState('');
  const [reasoning, setReasoning] = useState('');

  function selectModel(value: string) {
    setChatModel(value);
    if (value !== 'kimi-k3') setChatImages([]);
  }

  function handleChatFilesChange(files: FileList | null) {
    const nextFiles = files ? Array.from(files) : [];
    const inputError = getKimiImageInputError(nextFiles);
    if (inputError) {
      callbacks.setError(t(inputError));
      return;
    }
    callbacks.setError('');
    setChatImages(nextFiles);
  }

  function removeUpload(index: number) {
    setChatImages((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function clearUploads() {
    setChatImages([]);
  }

  async function doSendChat(apiKey: string, prompt: string) {
    const signal = callbacks.startRequest();
    try {
      const res = await sendChatRequest({ apiKey, model: chatModel, prompt, images: chatImages, signal });
      if (!res.ok) {
        await callbacks.setRequestError(res);
        return;
      }

      const result = await readChatStream(res, {
        onContent: setResponse,
        onReasoning: setReasoning,
        onUsage: callbacks.setTokenInfo,
      });
      callbacks.createHistory({ mode: 'chat', model: chatModel, prompt, response: result.content });
      trackPlaygroundFirstRun('chat', chatModel);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        callbacks.setError(e instanceof Error ? e.message : te('operationFailed'));
      }
    } finally {
      callbacks.setLoading(false);
    }
  }

  function reset() {
    setResponse('');
    setReasoning('');
  }

  function restore(item: HistoryItem) {
    setChatModel(item.model);
    setResponse(item.response ?? '');
    setReasoning('');
  }

  return {
    chatModel,
    chatImages,
    response,
    reasoning,
    selectModel,
    handleChatFilesChange,
    removeUpload,
    clearUploads,
    doSendChat,
    reset,
    restore,
  };
}
