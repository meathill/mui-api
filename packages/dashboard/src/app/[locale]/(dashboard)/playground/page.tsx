'use client';

import { useEffect, useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { adminApi, type ModelInfo } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const LOCAL_STORAGE_KEY = 'playground_api_key';

export default function PlaygroundPage() {
  const t = useTranslations('playground');
  const te = useTranslations('errors');
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tokenInfo, setTokenInfo] = useState<{
    inputTokens: number;
    outputTokens: number;
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      setApiKey(saved);
    }

    async function loadModels() {
      try {
        const modelsRes = await adminApi.getModels();
        setModels(modelsRes.models);
        if (modelsRes.models.length > 0) {
          setSelectedModel(modelsRes.models[0].id);
        }
      } catch {
        // silent
      }
    }
    loadModels();
  }, []);

  function handleApiKeyChange(value: string) {
    setApiKey(value);
    if (value) {
      localStorage.setItem(LOCAL_STORAGE_KEY, value);
    } else {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }

  function handleSendClick() {
    if (!prompt.trim() || !selectedModel) return;

    if (!apiKey.trim()) {
      setError(t('noKeyError'));
      return;
    }
    doSend(apiKey.trim());
  }

  async function doSend(key: string) {
    setLoading(true);
    setResponse('');
    setError('');
    setTokenInfo(null);

    const apiBase = process.env.NEXT_PUBLIC_API_BASE || '';
    abortRef.current = new AbortController();

    try {
      const res = await fetch(`${apiBase}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [{ role: 'user', content: prompt }],
          stream: true,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const data = (await res.json()) as Record<string, unknown>;
        const errObj = data.error as Record<string, string> | undefined;
        const errMsg = errObj?.message || te('requestFailed', { status: String(res.status) });
        setError(errMsg);
        setLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      if (reader) {
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
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setError(e instanceof Error ? e.message : te('operationFailed'));
      }
    } finally {
      setLoading(false);
    }
  }

  function handleStop() {
    abortRef.current?.abort();
    setLoading(false);
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">{t('title')}</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t('model')}</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id} ({m.provider})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">{t('apiKey')}</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder={t('apiKeyPlaceholder')}
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">{t('apiKeyHint')}</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">{t('prompt')}</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                placeholder={t('promptPlaceholder')}
                className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs transition-colors resize-none"
              />
            </div>

            <div className="flex gap-2">
              {loading ? (
                <Button variant="destructive" onClick={handleStop}>
                  {t('stop')}
                </Button>
              ) : (
                <Button onClick={handleSendClick} disabled={!prompt.trim() || !apiKey.trim()}>
                  {t('send')}
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <label className="block text-sm font-medium mb-2">{t('response')}</label>
          {error && <p className="text-destructive text-sm mb-2">{error}</p>}
          <div className="min-h-[200px] p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap font-mono">
            {response || <span className="text-muted-foreground">{t('responsePlaceholder')}</span>}
          </div>

          {tokenInfo && (
            <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
              <span>{t('inputTokens', { count: tokenInfo.inputTokens })}</span>
              <span>{t('outputTokens', { count: tokenInfo.outputTokens })}</span>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
