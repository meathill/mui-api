'use client';

import { ImageIcon, LoaderCircleIcon, MessageSquareIcon, SaveIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { adminApi, type ModelInfo } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs';
import { Field, HistoryList, ImageResults, ImageUpload, PromptField } from './playground-components';
import type { HistoryItem, ImageApiItem, ImageResult, PlaygroundMode } from './playground-types';
import {
  appendBuiltInImageModels,
  getApiBase,
  isImageModel,
  MAX_HISTORY_ITEMS,
  parseHistory,
  sendImageEditRequest,
  sendImageGenerationRequest,
  toImageResult,
} from './playground-utils';

const API_KEY_STORAGE_KEY = 'playground_api_key';
const HISTORY_STORAGE_KEY = 'playground_history';

export default function PlaygroundPage() {
  const t = useTranslations('playground');
  const te = useTranslations('errors');
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [mode, setMode] = useState<PlaygroundMode>('chat');
  const [chatModel, setChatModel] = useState('');
  const [imageModel, setImageModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [imageResults, setImageResults] = useState<ImageResult[]>([]);
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [tokenInfo, setTokenInfo] = useState<{ inputTokens: number; outputTokens: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const chatModels = useMemo(() => models.filter((model) => !isImageModel(model)), [models]);
  const imageModels = useMemo(() => models.filter(isImageModel), [models]);
  const selectedModel = mode === 'chat' ? chatModel : imageModel;

  useEffect(() => {
    const savedKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (savedKey) setApiKey(savedKey);
    if (savedHistory) setHistory(parseHistory(savedHistory));

    async function loadModels() {
      try {
        const modelsRes = await adminApi.getModels();
        const availableModels = appendBuiltInImageModels(modelsRes.models);
        setModels(availableModels);
        const imageDefault =
          availableModels.find((model) => model.id === 'gpt-image-2') ?? availableModels.find(isImageModel);
        const chatDefault = availableModels.find((model) => !isImageModel(model)) ?? availableModels[0];
        if (chatDefault) setChatModel(chatDefault.id);
        if (imageDefault) setImageModel(imageDefault.id);
      } catch {
        // 管理接口不可用时保持空列表，用户仍可手动刷新后重试。
      }
    }
    loadModels();
  }, []);

  function handleApiKeyChange(value: string) {
    setApiKey(value);
    if (value) {
      localStorage.setItem(API_KEY_STORAGE_KEY, value);
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  }

  function handleModeChange(value: string) {
    if (value === 'chat' || value === 'image') {
      setMode(value);
      setError('');
      setResponse('');
      setImageResults([]);
      setTokenInfo(null);
    }
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
    if (mode === 'chat') {
      doSendChat(apiKey.trim());
    } else {
      doGenerateImage(apiKey.trim());
    }
  }

  async function doSendChat(key: string) {
    setLoading(true);
    setResponse('');
    setImageResults([]);
    setError('');
    setTokenInfo(null);
    abortRef.current = new AbortController();

    try {
      const res = await fetch(`${getApiBase()}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: chatModel,
          messages: [{ role: 'user', content: prompt }],
          stream: true,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        await setRequestError(res);
        return;
      }

      const fullResponse = await readChatStream(res);
      saveHistoryItem({ mode: 'chat', model: chatModel, prompt, response: fullResponse });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError(e instanceof Error ? e.message : te('operationFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function doGenerateImage(key: string) {
    setLoading(true);
    setResponse('');
    setImageResults([]);
    setError('');
    setTokenInfo(null);
    abortRef.current = new AbortController();

    try {
      const res =
        uploadedImages.length > 0
          ? await sendImageEditRequest({
              apiKey: key,
              model: imageModel,
              prompt,
              images: uploadedImages,
              signal: abortRef.current.signal,
            })
          : await sendImageGenerationRequest({
              apiKey: key,
              model: imageModel,
              prompt,
              signal: abortRef.current.signal,
            });

      if (!res.ok) {
        await setRequestError(res);
        return;
      }

      const data = (await res.json()) as { data?: ImageApiItem[]; usage?: Record<string, number> };
      const results = (data.data ?? []).flatMap(toImageResult);
      setImageResults(results);
      if (data.usage) {
        setTokenInfo({
          inputTokens: data.usage.input_tokens ?? data.usage.prompt_tokens ?? 0,
          outputTokens: data.usage.output_tokens ?? data.usage.completion_tokens ?? 0,
        });
      }
      saveHistoryItem({ mode: 'image', model: imageModel, prompt, imageCount: results.length });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError(e instanceof Error ? e.message : te('operationFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function setRequestError(res: Response) {
    const data = (await res.json()) as Record<string, unknown>;
    const errObj = data.error as Record<string, string> | undefined;
    setError(errObj?.message || te('requestFailed', { status: String(res.status) }));
    setLoading(false);
  }

  async function readChatStream(res: Response) {
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';

    if (!reader) return fullResponse;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter((line) => line.startsWith('data: '));
      for (const line of lines) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            fullResponse += content;
            setResponse(fullResponse);
          }
          if (parsed.usage) {
            setTokenInfo({
              inputTokens: parsed.usage.prompt_tokens || 0,
              outputTokens: parsed.usage.completion_tokens || 0,
            });
          }
        } catch {
          // ignore parse errors
        }
      }
    }
    return fullResponse;
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
    setTokenInfo(null);
    if (item.mode === 'chat') {
      setChatModel(item.model);
    } else {
      setImageModel(item.model);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">{t('title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Tabs value={mode} onValueChange={handleModeChange}>
          <TabsList>
            <TabsTab value="chat">
              <MessageSquareIcon />
              {t('chatMode')}
            </TabsTab>
            <TabsTab value="image">
              <ImageIcon />
              {t('imageMode')}
            </TabsTab>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <Card className="p-4">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={t('model')}>
                <select
                  value={selectedModel}
                  onChange={(e) => (mode === 'chat' ? setChatModel(e.target.value) : setImageModel(e.target.value))}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors"
                >
                  {(mode === 'chat' ? chatModels : imageModels).map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.id} ({model.provider})
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t('apiKey')}>
                <Input
                  nativeInput
                  type="password"
                  value={apiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  placeholder={t('apiKeyPlaceholder')}
                  className="font-mono"
                />
                <p className="mt-1 text-xs text-muted-foreground">{t('apiKeyHint')}</p>
              </Field>
            </div>

            <Tabs value={mode} onValueChange={handleModeChange}>
              <TabsPanel value="chat">
                <PromptField
                  value={prompt}
                  onChange={setPrompt}
                  label={t('prompt')}
                  placeholder={t('promptPlaceholder')}
                />
              </TabsPanel>
              <TabsPanel value="image" className="space-y-4">
                <PromptField
                  value={prompt}
                  onChange={setPrompt}
                  label={t('imagePrompt')}
                  placeholder={t('imagePromptPlaceholder')}
                />
                <ImageUpload files={uploadedImages} onChange={handleFilesChange} onRemove={removeUpload} />
              </TabsPanel>
            </Tabs>

            <div className="flex flex-wrap gap-2">
              {loading ? (
                <Button variant="destructive" onClick={handleStop}>
                  {t('stop')}
                </Button>
              ) : (
                <Button onClick={handleRunClick} disabled={!prompt.trim() || !apiKey.trim() || !selectedModel}>
                  {mode === 'chat' ? t('send') : t('generateImage')}
                </Button>
              )}
              {loading && mode === 'image' && (
                <span className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                  <LoaderCircleIcon className="size-4 animate-spin" />
                  {t('generating')}
                </span>
              )}
              {mode === 'image' && uploadedImages.length > 0 && (
                <Button variant="outline" onClick={() => setUploadedImages([])}>
                  <XIcon />
                  {t('clearUploads')}
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <label className="text-sm font-medium">{mode === 'chat' ? t('response') : t('imageResult')}</label>
            {mode === 'image' && imageResults.length > 0 && (
              <span className="text-xs text-muted-foreground">
                <SaveIcon className="mr-1 inline size-3.5" />
                {t('imageSaveHint')}
              </span>
            )}
          </div>

          {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

          {mode === 'chat' ? (
            <div className="min-h-72 rounded-lg bg-muted p-3 font-mono text-sm whitespace-pre-wrap">
              {response || <span className="text-muted-foreground">{t('responsePlaceholder')}</span>}
            </div>
          ) : (
            <ImageResults results={imageResults} emptyLabel={t('imagePlaceholder')} saveLabel={t('saveImage')} />
          )}

          {tokenInfo && (
            <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
              <span>{t('inputTokens', { count: tokenInfo.inputTokens })}</span>
              <span>{t('outputTokens', { count: tokenInfo.outputTokens })}</span>
            </div>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <HistoryList history={history} onClear={clearHistory} onRestore={restoreHistoryItem} />
      </Card>
    </div>
  );
}
