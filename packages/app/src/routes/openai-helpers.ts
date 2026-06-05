import type { Context } from 'hono';
import type { Model } from '../db/schema';
import { MIN_BALANCE } from '../middleware/auth';
import type { ModelPricing } from '../services/billing-service';
import type { ProxyServices } from '../services/service-factory';
import { extractUsage } from '../services/usage-extractor';
import type { CloudflareBindings } from '../types';

/**
 * /v1 OpenAI 兼容路由的纯逻辑 helper：请求体解析、模型查找、计费、余额准入、
 * 图片响应代理等。从 openai.ts 抽出，让路由文件只保留 handler。
 */

export type OpenAIContext = Context<{ Bindings: CloudflareBindings }>;
export type JsonBody = Record<string, unknown>;
type MultipartValue = string | File;
export type ModelLookup = {
  modelConfig: Model;
  upstreamModel: string;
  modelPricing: ModelPricing;
};

export function invalidRequest(c: OpenAIContext, message: string) {
  return c.json({ error: { message, type: 'invalid_request_error' } }, 400);
}

export async function readJsonBody(c: OpenAIContext): Promise<JsonBody | Response> {
  try {
    return await c.req.json<JsonBody>();
  } catch {
    return invalidRequest(c, '请求体必须是有效 JSON');
  }
}

export async function lookupModel(
  c: OpenAIContext,
  modelId: string,
  services: ProxyServices,
): Promise<ModelLookup | Response> {
  const modelConfig = await services.modelCatalog.getById(modelId);
  if (!modelConfig) {
    return c.json({ error: { message: `未知模型: ${modelId}`, type: 'invalid_request_error' } }, 404);
  }

  return {
    modelConfig,
    upstreamModel: modelConfig.upstreamModelId ?? modelId,
    modelPricing: toModelPricing(modelConfig),
  };
}

function toModelPricing(model: Model): ModelPricing {
  return {
    inputPrice: model.inputPrice ?? 0,
    outputPrice: model.outputPrice ?? 0,
    markupRate: model.markupRate ?? 1.2,
    cachedInputPrice: model.cachedInputPrice,
    cacheWritePrice: model.cacheWritePrice,
    longContextThresholdTokens: model.longContextThresholdTokens,
    longContextInputPrice: model.longContextInputPrice,
    longContextCachedInputPrice: model.longContextCachedInputPrice,
    longContextCacheWritePrice: model.longContextCacheWritePrice,
    longContextOutputPrice: model.longContextOutputPrice,
  };
}

export function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

export async function processBilling(
  c: OpenAIContext,
  services: ProxyServices,
  provider: string,
  response: Response,
  modelId: string,
  modelPricing: ModelLookup['modelPricing'],
) {
  const userId = c.get('userId');
  const apiKeyId = c.get('apiKeyId');
  const userRateMultiplier = c.get('rateMultiplier');

  try {
    const data = (await response.json()) as JsonBody;
    const usage = extractUsage(provider, data);
    if (usage && hasAnyTokens(usage)) {
      const billing = await services.billingService.processUsage(
        userId,
        apiKeyId,
        {
          model: modelId,
          inputTokens: usage.inputTokens,
          cachedInputTokens: usage.cachedInputTokens,
          cacheWriteTokens: usage.cacheWriteTokens,
          outputTokens: usage.outputTokens,
        },
        modelPricing,
        userRateMultiplier,
        { useFreeQuota: true },
      );
      await services.alertService.checkAfterBilling(userId, billing.totalCost);
    }
  } catch (error) {
    console.error('非流式计费失败:', error);
  }
}

export function hasAnyTokens(usage: {
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
}) {
  return usage.inputTokens > 0 || usage.cachedInputTokens > 0 || usage.cacheWriteTokens > 0 || usage.outputTokens > 0;
}

export async function assertBillableAccess(
  c: OpenAIContext,
  services: ProxyServices,
  modelId: string,
): Promise<Response | null> {
  const balance = c.get('balance');
  if (balance >= MIN_BALANCE) {
    return null;
  }

  const freeQuota = await services.billingService.getFreeQuotaState(c.get('userId'), modelId);
  if (freeQuota.eligible && freeQuota.remaining > 0) {
    return null;
  }

  const freeQuotaMessage = freeQuota.enabled && !freeQuota.eligible ? `，模型 ${modelId} 不在免费额度范围内` : '';

  return c.json(
    {
      error: {
        message: `余额不足，当前余额: $${balance.toFixed(4)}${freeQuotaMessage}`,
        type: 'insufficient_quota',
      },
    },
    402,
  );
}

export async function proxyOpenAIImageResponse(
  c: OpenAIContext,
  services: ProxyServices,
  upstream: Response,
  modelId: string,
  modelPricing: ModelLookup['modelPricing'],
) {
  if (!upstream.ok) {
    const errText = await upstream.text();
    return c.json(
      {
        error: {
          message: `上游 openai 错误 (${upstream.status}): ${errText}`,
          type: 'api_error',
        },
      },
      502,
    );
  }

  const [clientResp, billingResp] = [upstream.clone(), upstream];
  c.executionCtx.waitUntil(processBilling(c, services, 'openai', billingResp, modelId, modelPricing));
  return clientResp;
}

export function appendFormEntry(form: FormData, key: string, value: MultipartValue) {
  if (typeof value === 'string') {
    form.append(key, value);
    return;
  }
  form.append(key, value, value.name);
}
