'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { adminApi, type ModelInfo } from '@/lib/api';
import { appendBuiltInPlaygroundModels } from './playground-model-catalog';
import type { HistoryItem, PlaygroundMode, TokenInfo } from './playground-types';
import { isGrokImageModel, isImageModel, isTtsModel, isVideoModel } from './playground-utils';
import { PlaygroundView } from './playground-view';
import { usePlaygroundChat } from './use-playground-chat';
import { usePlaygroundImage } from './use-playground-image';
import { usePlaygroundStorage } from './use-playground-storage';
import { usePlaygroundTts } from './use-playground-tts';
import { usePlaygroundVideo } from './use-playground-video';

export default function PlaygroundPage() {
  const t = useTranslations('playground');
  const te = useTranslations('errors');
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [mode, setMode] = useState<PlaygroundMode>('chat');
  const [prompt, setPrompt] = useState('');
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
  const chat = usePlaygroundChat({
    startRequest,
    setRequestError,
    setError,
    setTokenInfo,
    setLoading,
    createHistory: storage.createHistory,
  });
  const image = usePlaygroundImage({
    startRequest,
    setRequestError,
    setError,
    setTokenInfo,
    setLoading,
    createHistory: storage.createHistory,
  });
  const tts = usePlaygroundTts({
    startRequest,
    setRequestError,
    setError,
    setTokenInfo,
    setLoading,
    createHistory: storage.createHistory,
  });

  const chatModels = useMemo(
    () => models.filter((model) => !isImageModel(model) && !isVideoModel(model) && !isTtsModel(model)),
    [models],
  );
  const imageModels = useMemo(() => models.filter(isImageModel), [models]);
  const videoModels = useMemo(() => models.filter(isVideoModel), [models]);
  const ttsModels = useMemo(() => models.filter(isTtsModel), [models]);
  const selectedModel =
    mode === 'chat'
      ? chat.chatModel
      : mode === 'image'
        ? image.imageModel
        : mode === 'video'
          ? video.model
          : tts.ttsModel;
  const selectedImageModel = imageModels.find((model) => model.id === image.imageModel);
  const isSelectedKimiK3 = chat.chatModel === 'kimi-k3';
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

    if (chatDefault) chat.selectModel(chatDefault.id);
    if (imageDefault) image.setImageModel(imageDefault.id);
    if (ttsDefault) tts.setInitialModel(ttsDefault.id);
    if (videoDefault) video.setInitialModel(videoDefault.id);
  }

  function handleModeChange(value: string) {
    if (value === 'chat' || value === 'image' || value === 'video' || value === 'tts') {
      if (mode === 'video' && value !== 'video') video.stop();
      setMode(value);
      resetOutput();
    }
  }

  function handleModelChange(value: string) {
    if (mode === 'chat') chat.selectModel(value);
    if (mode === 'image') image.setImageModel(value);
    if (mode === 'video') video.selectModel(value);
    if (mode === 'tts') tts.setTtsModel(value);
  }

  function handleRunClick() {
    if (!prompt.trim() || !selectedModel) return;
    if (!storage.apiKey.trim()) {
      setError(t('noKeyError'));
      return;
    }
    if (mode === 'tts' && !tts.validateInput()) return;
    if (mode === 'chat') chat.doSendChat(storage.apiKey.trim(), prompt);
    if (mode === 'image') image.doGenerateImage(storage.apiKey.trim(), prompt, isSelectedGrokImage);
    if (mode === 'video') void video.run(storage.apiKey.trim(), prompt);
    if (mode === 'tts') tts.doGenerateSpeech(storage.apiKey.trim(), prompt);
  }

  function startRequest(): AbortSignal {
    setLoading(true);
    resetOutput();
    const controller = new AbortController();
    abortRef.current = controller;
    return controller.signal;
  }

  function resetOutput() {
    setError('');
    setTokenInfo(null);
    chat.reset();
    image.reset();
    tts.reset();
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
    setTokenInfo(null);
    chat.reset();
    image.reset();
    tts.reset();
    if (item.mode === 'chat') chat.restore(item);
    if (item.mode === 'image') image.restore(item);
    if (item.mode === 'tts') tts.restore(item);
    if (item.mode === 'video') video.restore(item, storage.apiKey.trim());
  }

  return (
    <PlaygroundView
      mode={mode}
      visibleModels={visibleModels}
      selectedModel={selectedModel}
      apiKey={storage.apiKey}
      prompt={prompt}
      ttsModel={tts.ttsModel}
      videoModel={video.model}
      ttsStylePrompt={tts.ttsStylePrompt}
      ttsVoice={tts.ttsVoice}
      voiceSample={tts.voiceSample}
      uploadedImages={image.uploadedImages}
      chatImages={chat.chatImages}
      isKimiK3={isSelectedKimiK3}
      isGrokImage={isSelectedGrokImage}
      grokImageOptions={image.grokImageOptions}
      grokVideoOptions={video.options}
      videoImage={video.image}
      loading={mode === 'video' ? video.isLoading : loading}
      error={error}
      response={chat.response}
      reasoning={chat.reasoning}
      imageResults={image.imageResults}
      audioResult={tts.audioResult}
      videoResult={video.result}
      videoStatus={video.status}
      videoProgress={video.progress}
      tokenInfo={tokenInfo}
      history={storage.history}
      onModeChange={handleModeChange}
      onModelChange={handleModelChange}
      onApiKeyChange={storage.changeApiKey}
      onPromptChange={handlePromptChange}
      onTtsStylePromptChange={tts.setTtsStylePrompt}
      onTtsVoiceChange={tts.setTtsVoice}
      onVoiceSampleChange={tts.setVoiceSample}
      onFilesChange={(files) => image.handleFilesChange(files, isSelectedGrokImage)}
      onChatFilesChange={chat.handleChatFilesChange}
      onRemoveChatUpload={chat.removeUpload}
      onClearChatUploads={chat.clearUploads}
      onRemoveUpload={image.removeUpload}
      onClearUploads={image.clearUploads}
      onGrokImageOptionsChange={image.setGrokImageOptions}
      onGrokVideoOptionsChange={video.changeOptions}
      onVideoImageChange={video.changeImage}
      onRun={handleRunClick}
      onStop={handleStop}
      onClearHistory={storage.clearHistory}
      onRestoreHistory={restoreHistoryItem}
    />
  );
}
