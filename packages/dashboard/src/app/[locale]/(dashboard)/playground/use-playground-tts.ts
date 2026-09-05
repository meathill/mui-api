'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { trackPlaygroundFirstRun } from '@/lib/analytics';
import { sendTtsRequest } from './playground-api';
import {
  buildTtsRequestBody,
  fileToTtsVoiceDataUrl,
  getDefaultTtsVoice,
  getTtsInputError,
  getTtsVoiceOptions,
  toAudioResult,
} from './playground-tts';
import type { AudioResult, HistoryItem, TokenInfo, TtsApiResponse } from './playground-types';
import { toTokenInfo } from './playground-utils';

const DEFAULT_TTS_VOICE = 'mimo_default';

type UsePlaygroundTtsOptions = {
  startRequest: () => AbortSignal;
  setRequestError: (res: Response) => Promise<void>;
  setError: (message: string) => void;
  setTokenInfo: (info: TokenInfo | null) => void;
  setLoading: (loading: boolean) => void;
  createHistory: (item: Omit<HistoryItem, 'id' | 'createdAt'>) => string;
};

export function usePlaygroundTts(callbacks: UsePlaygroundTtsOptions) {
  const t = useTranslations('playground');
  const te = useTranslations('errors');
  const [ttsModel, setTtsModel] = useState('');
  const [ttsStylePrompt, setTtsStylePrompt] = useState('');
  const [ttsVoice, setTtsVoice] = useState(DEFAULT_TTS_VOICE);
  const [voiceSample, setVoiceSample] = useState<File | null>(null);
  const [audioResult, setAudioResult] = useState<AudioResult | null>(null);

  useEffect(() => {
    if (!ttsModel) return;
    const voiceOptions = getTtsVoiceOptions(ttsModel);
    if (voiceOptions.length > 0 && !voiceOptions.some((option) => option.id === ttsVoice)) {
      setTtsVoice(voiceOptions[0].id);
    }
  }, [ttsModel, ttsVoice]);

  function setInitialModel(modelId: string) {
    setTtsModel(modelId);
    setTtsVoice(getDefaultTtsVoice(modelId) || DEFAULT_TTS_VOICE);
  }

  function validateInput(): boolean {
    const errorKey = getTtsInputError({ model: ttsModel, stylePrompt: ttsStylePrompt, voiceSample });
    if (errorKey) callbacks.setError(t(errorKey));
    return errorKey === null;
  }

  async function doGenerateSpeech(apiKey: string, prompt: string) {
    const signal = callbacks.startRequest();
    try {
      const voiceSampleDataUrl = voiceSample ? await fileToTtsVoiceDataUrl(voiceSample) : undefined;
      const body = buildTtsRequestBody({
        model: ttsModel,
        text: prompt,
        stylePrompt: ttsStylePrompt,
        voice: ttsVoice,
        voiceSampleDataUrl,
      });
      const res = await sendTtsRequest({ apiKey, body, signal });
      if (!res.ok) {
        await callbacks.setRequestError(res);
        return;
      }

      const data = (await res.json()) as TtsApiResponse;
      const result = toAudioResult(data, ttsModel);
      if (!result) {
        callbacks.setError(t('ttsNoAudioError'));
        return;
      }
      setAudioResult(result);
      const tokens = toTokenInfo(data.usage);
      if (tokens) callbacks.setTokenInfo(tokens);
      callbacks.createHistory({ mode: 'tts', model: ttsModel, prompt, ttsStylePrompt, audioFilename: result.filename });
      trackPlaygroundFirstRun('tts', ttsModel);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        callbacks.setError(e instanceof Error ? e.message : te('operationFailed'));
      }
    } finally {
      callbacks.setLoading(false);
    }
  }

  function reset() {
    setAudioResult(null);
  }

  function restore(item: HistoryItem) {
    setTtsModel(item.model);
    setTtsStylePrompt(item.ttsStylePrompt ?? '');
  }

  return {
    ttsModel,
    ttsStylePrompt,
    ttsVoice,
    voiceSample,
    audioResult,
    setInitialModel,
    setTtsModel,
    setTtsStylePrompt,
    setTtsVoice,
    setVoiceSample,
    validateInput,
    doGenerateSpeech,
    reset,
    restore,
  };
}
