'use client';

import { useEffect, useState, useRef } from 'react';
import { userApi, adminApi, type ModelInfo } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function PlaygroundPage() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [keys, setKeys] = useState<Array<{ id: string; keyPrefix: string }>>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedKey, setSelectedKey] = useState('');
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tokenInfo, setTokenInfo] = useState<{
    inputTokens: number;
    outputTokens: number;
    cost: number;
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [modelsRes, keysRes] = await Promise.all([adminApi.getModels(), userApi.getKeys()]);
        setModels(modelsRes.models);
        const activeKeys = keysRes.keys.filter((k) => k.isActive);
        setKeys(activeKeys);
        if (modelsRes.models.length > 0) {
          setSelectedModel(modelsRes.models[0].id);
        }
        if (activeKeys.length > 0) {
          setSelectedKey(activeKeys[0].keyPrefix);
        }
      } catch {
        // 静默处理
      }
    }
    loadData();
  }, []);

  async function handleSend() {
    if (!prompt.trim() || !selectedModel) return;

    setLoading(true);
    setResponse('');
    setError('');
    setTokenInfo(null);

    const apiBase = process.env.NEXT_PUBLIC_API_BASE || '';

    // 注意：Playground 无法获取原始 API Key，需要用户手动输入
    // 这里提示用户需要自己的 API Key
    const apiKey = window.prompt('请输入你的 API Key（sk-gw-xxx）：');
    if (!apiKey) {
      setLoading(false);
      return;
    }

    abortRef.current = new AbortController();

    try {
      const res = await fetch(`${apiBase}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
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
        setError(errObj?.message || `请求失败 (${res.status})`);
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

              // 检查 usage 信息（通常在最后一个 chunk）
              if (parsed.usage) {
                setTokenInfo({
                  inputTokens: parsed.usage.prompt_tokens || 0,
                  outputTokens: parsed.usage.completion_tokens || 0,
                  cost: 0,
                });
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setError(e instanceof Error ? e.message : '请求失败');
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
      <h2 className="text-xl font-bold mb-4">API Demo</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 输入区 */}
        <Card className="p-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">模型</label>
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
              <label className="block text-sm font-medium mb-1">Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                placeholder="输入你的问题..."
                className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs transition-colors resize-none"
              />
            </div>

            <div className="flex gap-2">
              {loading ? (
                <Button variant="destructive" onClick={handleStop}>
                  停止
                </Button>
              ) : (
                <Button onClick={handleSend} disabled={!prompt.trim()}>
                  发送
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* 输出区 */}
        <Card className="p-4">
          <label className="block text-sm font-medium mb-2">响应</label>
          {error && <p className="text-destructive text-sm mb-2">{error}</p>}
          <div className="min-h-[200px] p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap font-mono">
            {response || <span className="text-muted-foreground">响应将显示在这里...</span>}
          </div>

          {tokenInfo && (
            <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
              <span>输入: {tokenInfo.inputTokens} tokens</span>
              <span>输出: {tokenInfo.outputTokens} tokens</span>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
