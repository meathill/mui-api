'use client';

import { useMemo, useState } from 'react';
import type { Model } from '@/db/app-schema';

interface ProviderSection {
  provider: string;
  models: Model[];
}

const providerLabels: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  deepseek: 'DeepSeek',
  moonshot: 'Moonshot AI',
  grok: 'xAI Grok',
  zai: 'Zhipu GLM',
  qwen: 'Qwen',
  minimax: 'MiniMax',
  meta: 'Meta',
  longcat: 'LongCat',
  hy: 'HY',
  'google-ai-studio': 'Gemini',
  'xiaomi-mimo': 'Xiaomi MiMo',
  'workers-ai': 'Workers AI',
};

const priceFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
});

function formatPrice(v: number | null): string {
  if (v == null) return '-';
  return priceFmt.format(v);
}

export function ModelsCatalog({ sections }: { sections: ProviderSection[] }) {
  const [query, setQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState<string>('all');

  const providers = useMemo(() => sections.map((s) => s.provider), [sections]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sections
      .filter((s) => providerFilter === 'all' || s.provider === providerFilter)
      .map((s) => ({
        ...s,
        models: s.models.filter((m) => {
          if (!q) return true;
          return (
            m.id.toLowerCase().includes(q) ||
            m.provider.toLowerCase().includes(q) ||
            (m.upstreamModelId ?? '').toLowerCase().includes(q)
          );
        }),
      }))
      .filter((s) => s.models.length > 0);
  }, [sections, query, providerFilter]);

  const total = filtered.reduce((a, s) => a + s.models.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索模型 ID / Provider"
            className="h-9 w-64 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">全部厂商</option>
            {providers.map((p) => (
              <option key={p} value={p}>
                {providerLabels[p] ?? p}
              </option>
            ))}
          </select>
        </div>
        <p className="text-sm text-muted-foreground">筛选结果：{total} 个模型</p>
      </div>

      <div className="space-y-8">
        {filtered.map((section) => (
          <div key={section.provider} className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3 flex items-center justify-between">
              <h2 className="font-semibold">
                {providerLabels[section.provider] ?? section.provider}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {section.models.length} models · {section.provider}
                </span>
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 font-medium">模型 ID</th>
                    <th className="px-4 py-2 font-medium text-right">输入 / 1M</th>
                    <th className="px-4 py-2 font-medium text-right">缓存输入</th>
                    <th className="px-4 py-2 font-medium text-right">输出 / 1M</th>
                    <th className="px-4 py-2 font-medium">上游 ID</th>
                  </tr>
                </thead>
                <tbody>
                  {section.models.map((m) => (
                    <tr key={m.id} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                      <td className="px-4 py-2 font-mono text-xs">{m.id}</td>
                      <td className="px-4 py-2 text-right">{formatPrice(m.inputPrice)}</td>
                      <td className="px-4 py-2 text-right">{formatPrice(m.cachedInputPrice)}</td>
                      <td className="px-4 py-2 text-right">{formatPrice(m.outputPrice)}</td>
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{m.upstreamModelId ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
