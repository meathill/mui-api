'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { adminApi, type ModelInfo } from '@/lib/api';
import type {
  AudioResult,
  HistoryItem,
  ImageApiItem,
  ImageResult,
  PlaygroundMode,
  TokenInfo,
  TokenUsagePayload,
  TtsApiResponse,
} from './playground-types';
import { PlaygroundView } from './playground-view';
import {
  appendBuiltInPlaygroundModels,
  buildTtsRequestBody,
  fileToTtsVoiceDataUrl,
  getDefaultTtsVoice,
  getTtsVoiceOptions,
  getTtsVoiceSampleMimeType,
  isImageModel,
  isTtsModel,
  isTtsVoiceCloneModel,
  isTtsVoiceDesignModel,
  MAX_HISTORY_ITEMS,
  MAX_TTS_VOICE_SAMPLE_BYTES,
  parseHistory,
  readChatStream,
  sendChatRequest,
  sendImageEditRequest,
  sendImageGenerationRequest,
  sendTtsRequest,
  toAudioResult,
  toImageResult,
  toTokenInfo,
} from './playground-utils';

const API_KEY_STORAGE_KEY = 'playground_api_key';
const HISTORY_STORAGE_KEY = 'playground_history';
const DEFAULT_TTS_VOICE = 'mimo_default';

export default function PlaygroundPage() {
  const t = useTranslations('playground');
  const te = useTranslations('errors');
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [mode, setMode] = useState<PlaygroundMode>('chat');
  const [chatModel, setChatModel] = useState('');
  const [imageModel, setImageModel] = useState('');
  const [ttsModel, setTtsModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [prompt, setPrompt] = useState('');
  const [ttsStylePrompt, setTtsStylePrompt] = useState('');
  const [ttsVoice, setTtsVoice] = useState(DEFAULT_TTS_VOICE);
  const [voiceSample, setVoiceSample] = useState<File | null>(null);
  const [response, setResponse] = useState('');
  const [imageResults, setImageResults] = useState<ImageResult[]>([]);
  const [audioResult, setAudioResult] = useState<AudioResult | null>(null);
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const chatModels = useMemo(() => models.filter((model) => !isImageModel(model) && !isTtsModel(model)), [models]);
  const imageModels = useMemo(() => models.filter(isImageModel), [models]);
  const ttsModels = useMemo(() => models.filter(isTtsModel), [models]);
  const selectedModel = mode === 'chat' ? chatModel : mode === 'image' ? imageModel : ttsModel;
  const visibleModels = mode === 'chat' ? chatModels : mode === 'image' ? imageModels : ttsModels;

  useEffect(() => {
    const savedKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (savedKey) setApiKey(savedKey);
    if (savedHistory) setHistory(parseHistory(savedHistory));

    async function loadModels() {
      try {
        const modelsRes = await adminApi.getModels();
        setAvailableModels(appendBuiltInPlaygroundModels(modelsRes.models));
      } catch {
        setAvailableModels(appendBuiltInPlaygroundModels([]));
      }
    }
    loadModels();
  }, []);

  function setAvailableModels(availableModels: ModelInfo[]) {
    setModels(availableModels);
    const imageDefault =
      availableModels.find((model) => model.id === 'gpt-image-2') ?? availableModels.find(isImageModel);
    const chatDefault = availableModels.find((model) => !isImageModel(model) && !isTtsModel(model));
    const ttsDefault =
      availableModels.find((model) => model.id === 'mimo-v2.5-tts') ?? availableModels.find(isTtsModel);

    if (chatDefault) setChatModel(chatDefault.id);
    if (imageDefault) setImageModel(imageDefault.id);
    if (ttsDefault) {
      setTtsModel(ttsDefault.id);
      setTtsVoice(getDefaultTtsVoice(ttsDefault.id) || DEFAULT_TTS_VOICE);
    }
  }

  useEffect(() => {
    if (!ttsModel) return;
    const voiceOptions = getTtsVoiceOptions(ttsModel);
    if (voiceOptions.length > 0 && !voiceOptions.some((option) => option.id === ttsVoice)) {
      setTtsVoice(voiceOptions[0].id);
    }
  }, [ttsModel, ttsVoice]);

  function handleApiKeyChange(value: string) {
    setApiKey(value);
    if (value) {
      localStorage.setItem(API_KEY_STORAGE_KEY, value);
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  }

  function handleModeChange(value: string) {
    if (value === 'chat' || value === 'image' || value === 'tts') {
      setMode(value);
      resetOutput();
    }
  }

  function handleModelChange(value: string) {
    if (mode === 'chat') setChatModel(value);
    if (mode === 'image') setImageModel(value);
    if (mode === 'tts') setTtsModel(value);
  }

  function handleFilesChange(files: FileList | null) {
    setUploadedImages(files ? Array.from(files) : []);
  }

  function removeUpload(index: number) {
    setUploadedImages((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function handleRunClick() {
    if (!prompt.trim() || !selectedModel) return;
    if (!apiKey.trim()) {
      setError(t('noKeyError'));
      return;
    }
    if (mode === 'tts' && !validateTtsInput()) return;
    if (mode === 'chat') doSendChat(apiKey.trim());
    if (mode === 'image') doGenerateImage(apiKey.trim());
    if (mode === 'tts') doGenerateSpeech(apiKey.trim());
  }

  function validateTtsInput() {
    if (isTtsVoiceDesignModel(ttsModel) && !ttsStylePrompt.trim()) {
      setError(t('ttsStyleRequired'));
      return false;
    }
    if (!isTtsVoiceCloneModel(ttsModel)) return true;
    if (!voiceSample) {
      setError(t('ttsVoiceSampleRequired'));
      return false;
    }
    if (voiceSample.size > MAX_TTS_VOICE_SAMPLE_BYTES) {
      setError(t('ttsVoiceSampleTooLarge'));
      return false;
    }
    if (!getTtsVoiceSampleMimeType(voiceSample)) {
      setError(t('ttsVoiceSampleInvalid'));
      return false;
    }
    return true;
  }

  async function doSendChat(key: string) {
    const signal = startRequest();
    try {
      const res = await sendChatRequest({
        apiKey: key,
        model: chatModel,
        prompt,
        signal,
      });
      if (!res.ok) {
        await setRequestError(res);
        return;
      }

      const fullResponse = await readChatStream(res, { onContent: setResponse, onUsage: setTokenInfo });
      saveHistoryItem({ mode: 'chat', model: chatModel, prompt, response: fullResponse });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError(e instanceof Error ? e.message : te('operationFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function doGenerateImage(key: string) {
    const signal = startRequest();
    try {
      const res =
        uploadedImages.length > 0
          ? await sendImageEditRequest({
              apiKey: key,
              model: imageModel,
              prompt,
              images: uploadedImages,
              signal,
            })
          : await sendImageGenerationRequest({
              apiKey: key,
              model: imageModel,
              prompt,
              signal,
            });

      if (!res.ok) {
        await setRequestError(res);
        return;
      }

      const data = (await res.json()) as { data?: ImageApiItem[]; usage?: TokenUsagePayload };
      const results = (data.data ?? []).flatMap(toImageResult);
      setImageResults(results);
      const tokens = toTokenInfo(data.usage);
      if (tokens) setTokenInfo(tokens);
      saveHistoryItem({ mode: 'image', model: imageModel, prompt, imageCount: results.length });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError(e instanceof Error ? e.message : te('operationFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function doGenerateSpeech(key: string) {
    const signal = startRequest();
    try {
      const voiceSampleDataUrl = voiceSample ? await fileToTtsVoiceDataUrl(voiceSample) : undefined;
      const body = buildTtsRequestBody({
        model: ttsModel,
        text: prompt,
        stylePrompt: ttsStylePrompt,
        voice: ttsVoice,
        voiceSampleDataUrl,
      });
      const res = await sendTtsRequest({ apiKey: key, body, signal });
      if (!res.ok) {
        await setRequestError(res);
        return;
      }

      const data = (await res.json()) as TtsApiResponse;
      const result = toAudioResult(data, ttsModel);
      if (!result) {
        setError(t('ttsNoAudioError'));
        return;
      }
      setAudioResult(result);
      const tokens = toTokenInfo(data.usage);
      if (tokens) setTokenInfo(tokens);
      saveHistoryItem({ mode: 'tts', model: ttsModel, prompt, ttsStylePrompt, audioFilename: result.filename });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError(e instanceof Error ? e.message : te('operationFailed'));
    } finally {
      setLoading(false);
    }
  }

  function startRequest(): AbortSignal {
    setLoading(true);
    resetOutput();
    const controller = new AbortController();
    abortRef.current = controller;
    return controller.signal;
  }

  function resetOutput() {
    setResponse('');
    setImageResults([]);
    setAudioResult(null);
    setError('');
    setTokenInfo(null);
  }

  async function setRequestError(res: Response) {
    const data = (await res.json()) as Record<string, unknown>;
    const errObj = data.error as Record<string, string> | undefined;
    setError(errObj?.message || te('requestFailed', { status: String(res.status) }));
    setLoading(false);
  }

  function handleStop() {
    abortRef.current?.abort();
    setLoading(false);
  }

  function saveHistoryItem(item: Omit<HistoryItem, 'id' | 'createdAt'>) {
    const nextItem = { ...item, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    setHistory((current) => {
      const next = [nextItem, ...current].slice(0, MAX_HISTORY_ITEMS);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function clearHistory() {
    setHistory([]);
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  }

  function restoreHistoryItem(item: HistoryItem) {
    setMode(item.mode);
    setPrompt(item.prompt);
    setResponse(item.response ?? '');
    setImageResults([]);
    setAudioResult(null);
    setTokenInfo(null);
    if (item.mode === 'chat') setChatModel(item.model);
    if (item.mode === 'image') setImageModel(item.model);
    if (item.mode === 'tts') {
      setTtsModel(item.model);
      setTtsStylePrompt(item.ttsStylePrompt ?? '');
    }
  }

  return (
    <PlaygroundView
      mode={mode}
      visibleModels={visibleModels}
      selectedModel={selectedModel}
      apiKey={apiKey}
      prompt={prompt}
      ttsModel={ttsModel}
      ttsStylePrompt={ttsStylePrompt}
      ttsVoice={ttsVoice}
      voiceSample={voiceSample}
      uploadedImages={uploadedImages}
      loading={loading}
      error={error}
      response={response}
      imageResults={imageResults}
      audioResult={audioResult}
      tokenInfo={tokenInfo}
      history={history}
      onModeChange={handleModeChange}
      onModelChange={handleModelChange}
      onApiKeyChange={handleApiKeyChange}
      onPromptChange={setPrompt}
      onTtsStylePromptChange={setTtsStylePrompt}
      onTtsVoiceChange={setTtsVoice}
      onVoiceSampleChange={setVoiceSample}
      onFilesChange={handleFilesChange}
      onRemoveUpload={removeUpload}
      onClearUploads={() => setUploadedImages([])}
      onRun={handleRunClick}
      onStop={handleStop}
      onClearHistory={clearHistory}
      onRestoreHistory={restoreHistoryItem}
    />
  );
}
