import type { Context } from 'hono';
import type { ProviderConnection } from '../services/provider-connection';
import { resolveProviderConnection } from '../services/provider-connection';
import type { Model } from '../db/schema';
import { badRequest, createErrorResponse, ErrorTypes, upstreamError } from '../lib/errors';
import { MIN_BALANCE } from '../middleware/auth';
import { GROK_NO_USAGE_BASE_COST, type ModelPricing } from '../services/billing-service';
import type { ProxyServices } from '../services/service-factory';
import { extractStreamUsage, extractUsage, type GrokImageUsageContext } from '../services/usage-extractor';
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
  /** 中心 provider 连接（显式建模才有）；缺省走既有 provider 分发。 */
  connection: ProviderConnection | null;
};

export async function readJsonBody(c: OpenAIContext): Promise<JsonBody | Response> {
  try {
    return await c.req.json<JsonBody>();
  } catch {
    return badRequest(c, '请求体必须是有效 JSON');
  }
}

export async function lookupModel(
  c: OpenAIContext,
  modelId: string,
  services: ProxyServices,
): Promise<ModelLookup | Response> {
  const modelConfig = await services.modelCatalog.getById(modelId);
  if (!modelConfig) {
    // OpenAI 兼容语义：未知模型是 404 但 type 仍为 invalid_request_error
    return c.json(createErrorResponse(`未知模型: ${modelId}`, ErrorTypes.INVALID_REQUEST), 404);
  }

  return {
    modelConfig,
    upstreamModel: modelConfig.upstreamModelId ?? modelId,
    modelPricing: toModelPricing(modelConfig),
    connection: (await resolveProviderConnection(services.db, modelConfig.id))?.connection ?? null,
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

function isGrokFallbackProvider(provider: string): boolean {
  return provider === 'grok' || provider === 'grok-image';
}

export async function processBilling(
  c: OpenAIContext,
  services: ProxyServices,
  provider: string,
  response: Response,
  modelId: string,
  modelPricing: ModelLookup['modelPricing'],
  grokImageContext?: GrokImageUsageContext,
) {
  const userId = c.get('userId');
  const apiKeyId = c.get('apiKeyId');
  const userRateMultiplier = c.get('rateMultiplier');

  try {
    const data = (await response.json()) as JsonBody;
    const usage = extractUsage(provider, data, grokImageContext);
    if (!usage || !hasAnyTokens(usage)) {
      if (isGrokFallbackProvider(provider)) {
        console.warn(
          `[billing] grok 非流式无 usage，兜底计费 $${GROK_NO_USAGE_BASE_COST}: provider=${provider} model=${modelId} keys=${Object.keys(data).slice(0, 10).join(',')}`,
        );
        const billing = await services.billingService.processFixedCost(
          userId,
          apiKeyId,
          modelId,
          GROK_NO_USAGE_BASE_COST,
          modelPricing,
          userRateMultiplier,
          { useFreeQuota: true },
        );
        console.log(
          `[billing] grok 兜底入账成功: user=${userId} model=${modelId} cost=${billing.totalCost} charged=${billing.chargedCost}`,
        );
        await services.alertService.checkAfterBilling(userId, billing.totalCost);
        return;
      }
      if (!usage) {
        console.warn(
          `[billing] 非流式 usage 抽取为 null: provider=${provider} model=${modelId} keys=${Object.keys(data).slice(0, 10).join(',')}`,
        );
      } else {
        console.warn(
          `[billing] 非流式 usage 全 0: provider=${provider} model=${modelId} usage=${JSON.stringify(usage)}`,
        );
      }
      return;
    }
    console.log(
      `[billing] 非流式抽取成功: provider=${provider} model=${modelId} it=${usage.inputTokens} ot=${usage.outputTokens} cit=${usage.cachedInputTokens} cwt=${usage.cacheWriteTokens}`,
    );
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
    console.log(
      `[billing] 非流式入账成功: user=${userId} model=${modelId} cost=${billing.totalCost} charged=${billing.chargedCost}`,
    );
    await services.alertService.checkAfterBilling(userId, billing.totalCost);
  } catch (error) {
    console.error(
      `[billing] 非流式计费失败: provider=${provider} model=${modelId} err=${String(error).slice(0, 500)}`,
      error,
    );
  }
}

/**
 * 流式计费：从 tee 出来的 billingStream 抽取 usage 并异步扣费。
 * openai.ts（/chat/completions）与 anthropic.ts（/messages）共用。
 */
export function processStreamBilling(
  c: OpenAIContext,
  services: ProxyServices,
  provider: string,
  billingStream: ReadableStream<Uint8Array>,
  modelId: string,
  modelPricing: ModelLookup['modelPricing'],
): void {
  const userId = c.get('userId');
  const apiKeyId = c.get('apiKeyId');
  const userRateMultiplier = c.get('rateMultiplier');
  const start = Date.now();
  c.executionCtx.waitUntil(
    (async () => {
      try {
        const usage = await extractStreamUsage(provider, new Response(billingStream));
        if (!usage || !hasAnyTokens(usage)) {
          if (isGrokFallbackProvider(provider)) {
            console.warn(
              `[billing] grok 流式无 usage，兜底计费 $${GROK_NO_USAGE_BASE_COST}: provider=${provider} model=${modelId} user=${userId} elapsed=${Date.now() - start}ms`,
            );
            const billing = await services.billingService.processFixedCost(
              userId,
              apiKeyId,
              modelId,
              GROK_NO_USAGE_BASE_COST,
              modelPricing,
              userRateMultiplier,
              { useFreeQuota: true },
            );
            console.log(
              `[billing] grok 流式兜底入账成功: user=${userId} model=${modelId} cost=${billing.totalCost} charged=${billing.chargedCost} tier=${billing.tier} elapsed=${Date.now() - start}ms`,
            );
            await services.alertService.checkAfterBilling(userId, billing.totalCost);
            return;
          }
          if (!usage) {
            console.warn(
              `[billing] 流式 usage 抽取为 null: provider=${provider} model=${modelId} user=${userId} elapsed=${Date.now() - start}ms`,
            );
          } else {
            console.warn(
              `[billing] 流式 usage 全 0: provider=${provider} model=${modelId} user=${userId} usage=${JSON.stringify(usage)}`,
            );
          }
          return;
        }
        console.log(
          `[billing] 流式抽取成功: provider=${provider} model=${modelId} user=${userId} it=${usage.inputTokens} ot=${usage.outputTokens} cit=${usage.cachedInputTokens} cwt=${usage.cacheWriteTokens}`,
        );
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
        console.log(
          `[billing] 流式入账成功: user=${userId} model=${modelId} cost=${billing.totalCost} charged=${billing.chargedCost} tier=${billing.tier} elapsed=${Date.now() - start}ms`,
        );
        await services.alertService.checkAfterBilling(userId, billing.totalCost);
      } catch (error) {
        console.error(
          `[billing] 流式计费失败: provider=${provider} model=${modelId} user=${userId} err=${String(error).slice(0, 1000)}`,
          error,
        );
      }
    })(),
  );
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
    createErrorResponse(`余额不足，当前余额: $${balance.toFixed(4)}${freeQuotaMessage}`, ErrorTypes.INSUFFICIENT_QUOTA),
    402,
  );
}

export async function proxyOpenAIImageResponse(
  c: OpenAIContext,
  services: ProxyServices,
  upstream: Response,
  modelId: string,
  modelPricing: ModelLookup['modelPricing'],
  billingProvider = 'openai',
  grokImageContext?: GrokImageUsageContext,
) {
  if (!upstream.ok) {
    const errText = await upstream.text();
    return upstreamError(c, upstream.status, `上游 ${billingProvider} 错误 (${upstream.status}): ${errText}`);
  }

  const [clientResp, billingResp] = [upstream.clone(), upstream];
  c.executionCtx.waitUntil(
    processBilling(c, services, billingProvider, billingResp, modelId, modelPricing, grokImageContext),
  );
  return clientResp;
}

export function appendFormEntry(form: FormData, key: string, value: MultipartValue) {
  if (typeof value === 'string') {
    form.append(key, value);
    return;
  }
  form.append(key, value, value.name);
}
