import { Hono } from 'hono';
import type { Model } from '../db/schema';
import { badRequest, gatewayError } from '../lib/errors';
import { paidAuthMiddleware } from '../middleware/auth';
import { createProxyServices } from '../services/service-factory';
import type { ModelPricing } from '../services/billing-service';
import { extractStreamUsage, extractUsage } from '../services/usage-extractor';
import type { CloudflareBindings } from '../types';

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

const providers = new Hono<{ Bindings: CloudflareBindings }>();

// 支持的 provider 列表
const SUPPORTED_PROVIDERS = new Set(['openai', 'anthropic', 'google-ai-studio', 'workers-ai']);

// 应用认证中间件
providers.use('/*', paidAuthMiddleware);

/**
 * 原生 Provider API 透传代理
 * /providers/:provider/* → CF AI Gateway /{provider}/*
 */
providers.all('/:provider{.+}/*', async (c) => {
  const provider = c.req.param('provider');

  if (!SUPPORTED_PROVIDERS.has(provider)) {
    return badRequest(c, `不支持的 provider: ${provider}`);
  }

  const userId = c.get('userId');
  const apiKeyId = c.get('apiKeyId');
  const userRateMultiplier = c.get('rateMultiplier');
  const { billingService, alertService, gatewayService, modelCatalog } = createProxyServices(c.env, c.get('db'));

  try {
    const fullPath = c.req.path;
    const providerPrefix = `/providers/${provider}/`;
    const path = fullPath.startsWith(providerPrefix) ? fullPath.slice(providerPrefix.length) : fullPath;
    const response = await gatewayService.proxyNative(provider, path, c.req.raw);

    // 判断是否为流式响应
    const contentType = response.headers.get('content-type') ?? '';
    const isStream = contentType.includes('text/event-stream') || contentType.includes('stream');

    if (isStream && response.body) {
      // 流式：tee stream，一路给客户端，一路用于提取 usage
      const [clientStream, billingStream] = response.body.tee();

      c.executionCtx.waitUntil(
        (async () => {
          try {
            const usage = await extractStreamUsage(provider, new Response(billingStream));
            if (usage && hasAnyTokens(usage)) {
              let modelPricing: ModelPricing | null = null;
              if (usage.model && usage.model !== 'unknown') {
                const model = await modelCatalog.getById(usage.model);
                if (model) modelPricing = toModelPricing(model);
                else
                  console.warn(
                    `[billing] 原生代理流式: 模型 ${usage.model} 未在 models 表命中，将回退 gpt-4o-mini 兜底`,
                  );
              }
              const billing = await billingService.processUsage(
                userId,
                apiKeyId,
                {
                  model: usage.model,
                  inputTokens: usage.inputTokens,
                  cachedInputTokens: usage.cachedInputTokens,
                  cacheWriteTokens: usage.cacheWriteTokens,
                  outputTokens: usage.outputTokens,
                },
                modelPricing,
                userRateMultiplier,
              );
              await alertService.checkAfterBilling(userId, billing.totalCost);
            }
          } catch (error) {
            console.error('原生代理流式计费失败:', error);
          }
        })(),
      );

      return new Response(clientStream, {
        status: response.status,
        headers: response.headers,
      });
    }

    // 非流式：克隆响应，异步提取 usage
    const [clientResponse, billingResponse] = [response.clone(), response];

    c.executionCtx.waitUntil(
      (async () => {
        try {
          const data = (await billingResponse.json()) as Record<string, unknown>;
          const usage = extractUsage(provider, data);
          if (usage && hasAnyTokens(usage)) {
            let modelPricing: ModelPricing | null = null;
            if (usage.model && usage.model !== 'unknown') {
              const model = await modelCatalog.getById(usage.model);
              if (model) modelPricing = toModelPricing(model);
              else
                console.warn(
                  `[billing] 原生代理非流式: 模型 ${usage.model} 未在 models 表命中，将回退 gpt-4o-mini 兜底`,
                );
            }
            const billing = await billingService.processUsage(
              userId,
              apiKeyId,
              {
                model: usage.model,
                inputTokens: usage.inputTokens,
                cachedInputTokens: usage.cachedInputTokens,
                cacheWriteTokens: usage.cacheWriteTokens,
                outputTokens: usage.outputTokens,
              },
              modelPricing,
              userRateMultiplier,
            );
            await alertService.checkAfterBilling(userId, billing.totalCost);
          }
        } catch {
          console.warn('原生代理 usage 提取失败，跳过计费');
        }
      })(),
    );

    return clientResponse;
  } catch (error) {
    console.error(`原生代理调用失败 (${provider}):`, error);

    if (error instanceof Error) {
      return gatewayError(c, error.message);
    }

    return gatewayError(c, '上游 API 调用失败');
  }
});

function hasAnyTokens(usage: {
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
}) {
  return usage.inputTokens > 0 || usage.cachedInputTokens > 0 || usage.cacheWriteTokens > 0 || usage.outputTokens > 0;
}

export default providers;
