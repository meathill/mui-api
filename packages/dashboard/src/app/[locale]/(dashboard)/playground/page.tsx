'use client';

import { GROK_IMAGE_MAX_INPUTS } from '@muirouter/shared-db/grok-image';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { adminApi, type ModelInfo } from '@/lib/api';
import {
  readChatStream,
  sendChatRequest,
  sendImageEditRequest,
  sendImageGenerationRequest,
  sendTtsRequest,
} from './playground-api';
import type {
  AudioResult,
  GrokImageOptions,
  HistoryItem,
  ImageApiItem,
  ImageResult,
  PlaygroundMode,
  TokenInfo,
  TokenUsagePayload,
  TtsApiResponse,
} from './playground-types';
import {
  appendBuiltInPlaygroundModels,
  buildTtsRequestBody,
  fileToTtsVoiceDataUrl,
  getDefaultTtsVoice,
  getKimiImageInputError,
  getTtsVoiceOptions,
  getTtsInputError,
  isImageModel,
  isGrokImageModel,
  isTtsModel,
  isVideoModel,
  toAudioResult,
  toImageResult,
  toTokenInfo,
} from './playground-utils';
import { PlaygroundView } from './playground-view';
import { usePlaygroundStorage } from './use-playground-storage';
import { usePlaygroundVideo } from './use-playground-video';

const DEFAULT_TTS_VOICE = 'mimo_default';
const DEFAULT_GROK_IMAGE_OPTIONS: GrokImageOptions = { count: 1, aspectRatio: 'auto', resolution: '1k' };

export default function PlaygroundPage() {
  const t = useTranslations('playground');
  const te = useTranslations('errors');
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [mode, setMode] = useState<PlaygroundMode>('chat');
  const [chatModel, setChatModel] = useState('');
  const [imageModel, setImageModel] = useState('');
  const [ttsModel, setTtsModel] = useState('');
  const [prompt, setPrompt] = useState('');
  const [ttsStylePrompt, setTtsStylePrompt] = useState('');
  const [ttsVoice, setTtsVoice] = useState(DEFAULT_TTS_VOICE);
  const [voiceSample, setVoiceSample] = useState<File | null>(null);
  const [response, setResponse] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [imageResults, setImageResults] = useState<ImageResult[]>([]);
  const [audioResult, setAudioResult] = useState<AudioResult | null>(null);
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [chatImages, setChatImages] = useState<File[]>([]);
  const [grokImageOptions, setGrokImageOptions] = useState<GrokImageOptions>(DEFAULT_GROK_IMAGE_OPTIONS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const storage = usePlaygroundStorage();
  const video = usePlaygroundVideo({
    onError: setError,
    createHistory: storage.createHistory,
    updateHistory: storage.updateHistory,
  });

  const chatModels = useMemo(
    () => models.filter((model) => !isImageModel(model) && !isVideoModel(model) && !isTtsModel(model)),
    [models],
  );
  const imageModels = useMemo(() => models.filter(isImageModel), [models]);
  const videoModels = useMemo(() => models.filter(isVideoModel), [models]);
  const ttsModels = useMemo(() => models.filter(isTtsModel), [models]);
  const selectedModel =
    mode === 'chat' ? chatModel : mode === 'image' ? imageModel : mode === 'video' ? video.model : ttsModel;
  const selectedImageModel = imageModels.find((model) => model.id === imageModel);
  const isSelectedKimiK3 = chatModel === 'kimi-k3';
  const isSelectedGrokImage = isGrokImageModel(selectedImageModel);
  const visibleModels =
    mode === 'chat' ? chatModels : mode === 'image' ? imageModels : mode === 'video' ? videoModels : ttsModels;

  useEffect(() => {
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
    const chatDefault = availableModels.find(
      (model) => !isImageModel(model) && !isVideoModel(model) && !isTtsModel(model),
    );
    const ttsDefault =
      availableModels.find((model) => model.id === 'mimo-v2.5-tts') ?? availableModels.find(isTtsModel);
    const videoDefault =
      availableModels.find((model) => model.id === 'grok-imagine-video') ?? availableModels.find(isVideoModel);

    if (chatDefault) setChatModel(chatDefault.id);
    if (imageDefault) setImageModel(imageDefault.id);
    if (ttsDefault) {
      setTtsModel(ttsDefault.id);
      setTtsVoice(getDefaultTtsVoice(ttsDefault.id) || DEFAULT_TTS_VOICE);
    }
    if (videoDefault) video.setInitialModel(videoDefault.id);
  }

  useEffect(() => {
    if (!ttsModel) return;
    const voiceOptions = getTtsVoiceOptions(ttsModel);
    if (voiceOptions.length > 0 && !voiceOptions.some((option) => option.id === ttsVoice)) {
      setTtsVoice(voiceOptions[0].id);
    }
  }, [ttsModel, ttsVoice]);

  function handleModeChange(value: string) {
    if (value === 'chat' || value === 'image' || value === 'video' || value === 'tts') {
      if (mode === 'video' && value !== 'video') video.stop();
      setMode(value);
      resetOutput();
    }
  }

  function handleModelChange(value: string) {
    if (mode === 'chat') {
      setChatModel(value);
      if (value !== 'kimi-k3') setChatImages([]);
    }
    if (mode === 'image') setImageModel(value);
    if (mode === 'video') video.selectModel(value);
    if (mode === 'tts') setTtsModel(value);
  }

  function handleFilesChange(files: FileList | null) {
    const nextFiles = files ? Array.from(files) : [];
    if (isSelectedGrokImage && nextFiles.length > GROK_IMAGE_MAX_INPUTS) {
      setError(t('grokMaxImagesError', { count: GROK_IMAGE_MAX_INPUTS }));
      return;
    }
    setError('');
    setUploadedImages(nextFiles);
  }

  function handleChatFilesChange(files: FileList | null) {
    const nextFiles = files ? Array.from(files) : [];
    const inputError = getKimiImageInputError(nextFiles);
    if (inputError) {
      setError(t(inputError));
      return;
    }
    setError('');
    setChatImages(nextFiles);
  }

  function handleRunClick() {
    if (!prompt.trim() || !selectedModel) return;
    if (!storage.apiKey.trim()) {
      setError(t('noKeyError'));
      return;
    }
    if (mode === 'tts' && !validateTtsInput()) return;
    if (mode === 'chat') doSendChat(storage.apiKey.trim());
    if (mode === 'image') doGenerateImage(storage.apiKey.trim());
    if (mode === 'video') void video.run(storage.apiKey.trim(), prompt);
    if (mode === 'tts') doGenerateSpeech(storage.apiKey.trim());
  }

  function validateTtsInput() {
    const errorKey = getTtsInputError({ model: ttsModel, stylePrompt: ttsStylePrompt, voiceSample });
    if (errorKey) setError(t(errorKey));
    return errorKey === null;
  }

  async function doSendChat(key: string) {
    const signal = startRequest();
    try {
      const res = await sendChatRequest({
        apiKey: key,
        model: chatModel,
        prompt,
        images: chatImages,
        signal,
      });
      if (!res.ok) {
        await setRequestError(res);
        return;
      }

      const result = await readChatStream(res, {
        onContent: setResponse,
        onReasoning: setReasoning,
        onUsage: setTokenInfo,
      });
      storage.createHistory({ mode: 'chat', model: chatModel, prompt, response: result.content });
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
              isGrok: isSelectedGrokImage,
              grokOptions: grokImageOptions,
              signal,
            })
          : await sendImageGenerationRequest({
              apiKey: key,
              model: imageModel,
              prompt,
              isGrok: isSelectedGrokImage,
              grokOptions: grokImageOptions,
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
      storage.createHistory({
        mode: 'image',
        model: imageModel,
        prompt,
        imageCount: results.length,
        grokImageOptions: isSelectedGrokImage ? grokImageOptions : undefined,
      });
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
      storage.createHistory({ mode: 'tts', model: ttsModel, prompt, ttsStylePrompt, audioFilename: result.filename });
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
    setReasoning('');
    setImageResults([]);
    setAudioResult(null);
    setError('');
    setTokenInfo(null);
    video.clearTask();
  }

  function handlePromptChange(value: string) {
    if (mode === 'video') {
      video.stop();
      video.clearTask();
    }
    setPrompt(value);
  }

  async function setRequestError(res: Response) {
    const data = (await res.json()) as Record<string, unknown>;
    const errObj = data.error as Record<string, string> | undefined;
    setError(errObj?.message || te('requestFailed', { status: String(res.status) }));
    setLoading(false);
  }

  function handleStop() {
    if (mode === 'video') {
      video.stop();
      return;
    }
    abortRef.current?.abort();
    setLoading(false);
  }

  function restoreHistoryItem(item: HistoryItem) {
    setMode(item.mode);
    setPrompt(item.prompt);
    setResponse(item.response ?? '');
    setReasoning('');
    setImageResults([]);
    setAudioResult(null);
    setTokenInfo(null);
    if (item.mode === 'chat') setChatModel(item.model);
    if (item.mode === 'image') {
      setImageModel(item.model);
      setGrokImageOptions(item.grokImageOptions ?? DEFAULT_GROK_IMAGE_OPTIONS);
    }
    if (item.mode === 'tts') {
      setTtsModel(item.model);
      setTtsStylePrompt(item.ttsStylePrompt ?? '');
    }
    if (item.mode === 'video') {
      video.restore(item, storage.apiKey.trim());
    }
  }

  return (
    <PlaygroundView
      mode={mode}
      visibleModels={visibleModels}
      selectedModel={selectedModel}
      apiKey={storage.apiKey}
      prompt={prompt}
      ttsModel={ttsModel}
      videoModel={video.model}
      ttsStylePrompt={ttsStylePrompt}
      ttsVoice={ttsVoice}
      voiceSample={voiceSample}
      uploadedImages={uploadedImages}
      chatImages={chatImages}
      isKimiK3={isSelectedKimiK3}
      isGrokImage={isSelectedGrokImage}
      grokImageOptions={grokImageOptions}
      grokVideoOptions={video.options}
      videoImage={video.image}
      loading={mode === 'video' ? video.isLoading : loading}
      error={error}
      response={response}
      reasoning={reasoning}
      imageResults={imageResults}
      audioResult={audioResult}
      videoResult={video.result}
      videoStatus={video.status}
      videoProgress={video.progress}
      tokenInfo={tokenInfo}
      history={storage.history}
      onModeChange={handleModeChange}
      onModelChange={handleModelChange}
      onApiKeyChange={storage.changeApiKey}
      onPromptChange={handlePromptChange}
      onTtsStylePromptChange={setTtsStylePrompt}
      onTtsVoiceChange={setTtsVoice}
      onVoiceSampleChange={setVoiceSample}
      onFilesChange={handleFilesChange}
      onChatFilesChange={handleChatFilesChange}
      onRemoveChatUpload={(index) => setChatImages((current) => current.filter((_, itemIndex) => itemIndex !== index))}
      onClearChatUploads={() => setChatImages([])}
      onRemoveUpload={(index) => setUploadedImages((current) => current.filter((_, itemIndex) => itemIndex !== index))}
      onClearUploads={() => setUploadedImages([])}
      onGrokImageOptionsChange={setGrokImageOptions}
      onGrokVideoOptionsChange={video.changeOptions}
      onVideoImageChange={video.changeImage}
      onRun={handleRunClick}
      onStop={handleStop}
      onClearHistory={storage.clearHistory}
      onRestoreHistory={restoreHistoryItem}
    />
  );
}
