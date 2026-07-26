/**
 * 模型的对外视图：把 models 表的一行翻译成客户端能自动发现的形状。
 *
 * 背景：Cherry Studio / LobeChat / Cline / Roo Code 这批客户端靠 GET /v1/models
 * 自动发现模型——只填 endpoint + key 就能用。此前我们只返回 id / object /
 * created: 0 / owned_by，客户端拿不到上下文长度和价格，只能当成一个光秃秃的名字。
 *
 * 字段命名跟随 OpenRouter 的事实标准（context_length / pricing.prompt 等），
 * 客户端识别率最高；OpenAI 官方 /v1/models 的四个字段原样保留，兼容性不破。
 *
 * 注：opencode 不吃这套——它的模型列表来自 models.dev，见
 * packages/app/scripts/gen-models-dev-toml.ts。
 */

import { type ModelMetadata, parseModelMetadata } from '@muirouter/shared-db/model-metadata';
import type { Model } from '../db/schema';

/** 网关自身的身份。不再回传内部 provider 枚举（'google-ai-studio' 这类既泄露路由细节又对客户端无意义）。 */
const OWNED_BY = 'muirouter';

const DEFAULT_MARKUP_RATE = 1.2;

export interface PublicModelPricing {
  /** 美元 / 输入 token。 */
  prompt: string;
  /** 美元 / 输出 token。 */
  completion: string;
  input_cache_read?: string;
  input_cache_write?: string;
}

export interface PublicModelCapabilities {
  vision: boolean;
  reasoning: boolean;
  tool_call: boolean;
  attachment: boolean;
}

export interface PublicModel {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
  display_name?: string;
  context_length?: number;
  max_output_tokens?: number;
  pricing?: PublicModelPricing;
  capabilities?: PublicModelCapabilities;
}

/**
 * 把 $/1M token 的标价换成 $/token 的字符串。
 *
 * 用字符串而非数字：这些值小到 1e-8 量级，JSON.stringify 会输出科学计数法
 * （5.1e-8），部分客户端的解析器不认。OpenRouter 同样用字符串。
 */
export function formatPerTokenPrice(pricePerMillion: number, markupRate: number): string {
  const perToken = (pricePerMillion * markupRate) / 1_000_000;
  if (perToken === 0) return '0';
  const fixed = perToken.toFixed(12);
  const trimmed = fixed.replace(/0+$/, '').replace(/\.$/, '');
  return trimmed === '' || trimmed === '0' ? '0' : trimmed;
}

/**
 * release date（YYYY-MM 或 YYYY-MM-DD）→ unix 秒。
 * 缺省返回 0，与此前行为一致——没有元数据的模型不会凭空多出一个假日期。
 */
export function releaseDateToUnix(releaseDate: string | undefined): number {
  if (!releaseDate) return 0;
  const parts = releaseDate.split('-').map(Number);
  const [year, month, day] = parts;
  if (!Number.isFinite(year) || !Number.isFinite(month)) return 0;
  return Math.floor(Date.UTC(year, month - 1, Number.isFinite(day) ? day : 1) / 1000);
}

function buildPricing(model: Model): PublicModelPricing | undefined {
  if (model.inputPrice == null || model.outputPrice == null) return undefined;

  // 与 billing-service 的 cost 公式一致：tokens × price / 1e6 × markupRate × rateMultiplier。
  // 这里发布的是 rateMultiplier = 1 的标价——按用户打折的倍率不属于公开模型列表。
  const markupRate = model.markupRate ?? DEFAULT_MARKUP_RATE;
  const pricing: PublicModelPricing = {
    prompt: formatPerTokenPrice(model.inputPrice, markupRate),
    completion: formatPerTokenPrice(model.outputPrice, markupRate),
  };
  if (model.cachedInputPrice != null) {
    pricing.input_cache_read = formatPerTokenPrice(model.cachedInputPrice, markupRate);
  }
  if (model.cacheWritePrice != null) {
    pricing.input_cache_write = formatPerTokenPrice(model.cacheWritePrice, markupRate);
  }
  return pricing;
}

function buildCapabilities(metadata: ModelMetadata): PublicModelCapabilities {
  return {
    vision: metadata.modalities?.input.includes('image') ?? false,
    reasoning: metadata.reasoning,
    tool_call: metadata.toolCall,
    attachment: metadata.attachment,
  };
}

/**
 * 单个模型的对外视图。元数据未录入时只返回 OpenAI 官方那四个字段，
 * 不塞空对象——客户端更容易判断「这个字段没有」而不是「这个字段是空的」。
 */
export function toPublicModel(model: Model): PublicModel {
  // 解析失败按未录入处理：一行脏元数据不该让整个 /v1/models 挂掉。
  const parsed = parseModelMetadata(model.metadataJson);
  const metadata = parsed.ok ? parsed.value : null;

  const view: PublicModel = {
    id: model.id,
    object: 'model',
    created: releaseDateToUnix(metadata?.releaseDate),
    owned_by: OWNED_BY,
  };

  if (model.displayName) view.display_name = model.displayName;
  if (model.contextLength != null) view.context_length = model.contextLength;
  if (model.maxOutputTokens != null) view.max_output_tokens = model.maxOutputTokens;

  const pricing = buildPricing(model);
  if (pricing) view.pricing = pricing;
  if (metadata) view.capabilities = buildCapabilities(metadata);

  return view;
}

/** 列表视图，按 id 排序，保证客户端每次拿到的顺序稳定。 */
export function toPublicModelList(models: Model[]): PublicModel[] {
  return models.map(toPublicModel).sort((a, b) => a.id.localeCompare(b.id));
}
