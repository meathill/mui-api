import { isGrokImageModelId } from '@muirouter/shared-db/grok-image';
import { asc } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { type Model, models } from '@/db/app-schema';
import { getDb } from '@/lib/db';
import { PRICING_MODELS_TAG, PUBLIC_CONTENT_REVALIDATE_SECONDS } from '@/lib/public-cache';
import { PROVIDER_DISPLAY, PROVIDER_ORDER } from './pricing-data';

export interface ProviderSection {
  provider: string;
  models: Model[];
}

export interface PricingSnapshot {
  sections: ProviderSection[];
  generatedAt: string;
}

async function queryPricingSnapshot(): Promise<PricingSnapshot> {
  const db = await getDb();
  const rows = await db.select().from(models).orderBy(asc(models.id));

  // 只展示在 PROVIDER_DISPLAY 名单内、且至少有 input 价的模型；过滤 TTS / 图片这类按次计价模型
  const grouped = new Map<string, Model[]>();
  for (const row of rows) {
    if (!(row.provider in PROVIDER_DISPLAY)) continue;
    if ((row.inputPrice ?? 0) <= 0 && (row.outputPrice ?? 0) <= 0) continue;
    // Grok 图片模型的 outputPrice 是内部 token 汇率，不是真实公开 token 单价。
    if (isGrokImageModelId(row.id)) continue;
    const list = grouped.get(row.provider) ?? [];
    list.push(row);
    grouped.set(row.provider, list);
  }

  return {
    sections: PROVIDER_ORDER.filter((provider) => grouped.has(provider)).map((provider) => ({
      provider,
      models: grouped.get(provider) ?? [],
    })),
    generatedAt: new Date().toISOString().slice(0, 10),
  };
}

export const loadPricingSnapshot = unstable_cache(queryPricingSnapshot, ['pricing-snapshot-v2'], {
  revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS,
  tags: [PRICING_MODELS_TAG],
});
