import { type Context, Hono } from 'hono';
import type { Model } from '../db/schema';
import { authMiddleware, MIN_BALANCE } from '../middleware/auth';
import type { ModelPricing } from '../services/billing-service';
import {
  callAiBinding,
  callGemini,
  callOpenAI,
  callOpenAIEndpoint,
  callXiaomiMiMo,
} from '../services/provider-dispatch';
import { createProxyServices, type ProxyServices } from '../services/service-factory';
import { extractStreamUsage, extractUsage } from '../services/usage-extractor';
import type { CloudflareBindings } from '../types';

const openai = new Hono<{ Bindings: CloudflareBindings }>();
type OpenAIContext = Context<{ Bindings: CloudflareBindings }>;
type JsonBody = Record<string, unknown>;
type MultipartValue = string | File;
type ModelLookup = {
  modelConfig: Model;
  upstreamModel: string;
  modelPricing: ModelPricing;
};

// 应用认证中间件（包含并发控制）
openai.use('/*', authMiddleware);

function invalidRequest(c: OpenAIContext, message: string) {
  return c.json({ error: { message, type: 'invalid_request_error' } }, 400);
}

async function readJsonBody(c: OpenAIContext): Promise<JsonBody | Response> {
  try {
    return await c.req.json<JsonBody>();
  } catch {
    return invalidRequest(c, '请求体必须是有效 JSON');
  }
}

async function lookupModel(
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

function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

async function processBilling(
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

function hasAnyTokens(usage: {
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
}) {
  return usage.inputTokens > 0 || usage.cachedInputTokens > 0 || usage.cacheWriteTokens > 0 || usage.outputTokens > 0;
}

async function assertBillableAccess(
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

async function proxyOpenAIImageResponse(
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

function appendFormEntry(form: FormData, key: string, value: MultipartValue) {
  if (typeof value === 'string') {
    form.append(key, value);
    return;
  }
  form.append(key, value, value.name);
}

/**
 * POST /v1/chat/completions
 * 按 DB 记录的 provider 分发到对应 SDK / binding，响应原样透传
 * 调用方需按目标 provider 原生 shape 构造请求体（OpenAI / Xiaomi MiMo / Anthropic Messages / Gemini generateContent / Workers AI）
 */
openai.post('/chat/completions', async (c) => {
  const userId = c.get('userId');
  const apiKeyId = c.get('apiKeyId');
  const userRateMultiplier = c.get('rateMultiplier');
  const body = await readJsonBody(c);
  if (isResponse(body)) return body;

  if (!body.model) {
    return c.json({ error: { message: '缺少 model 参数', type: 'invalid_request_error' } }, 400);
  }
  if (!Array.isArray(body.messages)) {
    return c.json({ error: { message: '缺少 messages 参数', type: 'invalid_request_error' } }, 400);
  }

  const modelId = body.model as string;
  const services = createProxyServices(c.env);
  const lookup = await lookupModel(c, modelId, services);
  if (isResponse(lookup)) return lookup;
  const { modelConfig, upstreamModel, modelPricing } = lookup;
  const accessError = await assertBillableAccess(c, services, modelId);
  if (accessError) return accessError;
  const provider = modelConfig.provider;
  const isStream = body.stream === true;

  // 上游的 model 字段应当用 upstreamModelId，dispatch 之前改写一次
  const upstreamBody = { ...body, model: upstreamModel };

  try {
    let upstream: Response;
    if (provider === 'openai') {
      upstream = await callOpenAI(c.env, upstreamBody);
    } else if (provider === 'xiaomi-mimo') {
      upstream = await callXiaomiMiMo(c.env, upstreamBody);
    } else if (provider === 'google-ai-studio') {
      upstream = await callGemini(c.env, upstreamModel, upstreamBody);
    } else {
      upstream = await callAiBinding(c.env, upstreamModel, upstreamBody);
    }

    if (!upstream.ok) {
      const errText = await upstream.text();
      return c.json(
        {
          error: {
            message: `上游 ${provider} 错误 (${upstream.status}): ${errText}`,
            type: 'api_error',
          },
        },
        502,
      );
    }

    // 流式：tee，一路给客户端，一路抽 usage
    const contentType = upstream.headers.get('content-type') ?? '';
    const isSse = isStream || contentType.includes('text/event-stream');

    if (isSse && upstream.body) {
      const [clientStream, billingStream] = upstream.body.tee();
      c.executionCtx.waitUntil(
        (async () => {
          try {
            const usage = await extractStreamUsage(provider, new Response(billingStream));
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
            console.error('流式计费失败:', error);
          }
        })(),
      );
      return new Response(clientStream, {
        status: upstream.status,
        headers: upstream.headers,
      });
    }

    // 非流式：clone 一份用于 usage 提取
    const [clientResp, billingResp] = [upstream.clone(), upstream];
    c.executionCtx.waitUntil(
      (async () => {
        await processBilling(c, services, provider, billingResp, modelId, modelPricing);
      })(),
    );
    return clientResp;
  } catch (error) {
    console.error(`[${provider}] 调用失败:`, error);
    const message = error instanceof Error ? error.message : '上游调用失败';
    return c.json({ error: { message, type: 'api_error' } }, 502);
  }
});

/**
 * POST /v1/images/generations
 * OpenAI Image API 生成接口。请求体保持 OpenAI 原生 JSON shape，只按 DB 配置改写 model。
 */
openai.post('/images/generations', async (c) => {
  const body = await readJsonBody(c);
  if (isResponse(body)) return body;

  if (typeof body.model !== 'string' || !body.model) {
    return invalidRequest(c, '缺少 model 参数');
  }
  if (typeof body.prompt !== 'string' || !body.prompt) {
    return invalidRequest(c, '缺少 prompt 参数');
  }

  const modelId = body.model;
  const services = createProxyServices(c.env);
  const lookup = await lookupModel(c, modelId, services);
  if (isResponse(lookup)) return lookup;
  const { modelConfig, upstreamModel, modelPricing } = lookup;
  const accessError = await assertBillableAccess(c, services, modelId);
  if (accessError) return accessError;

  if (modelConfig.provider !== 'openai') {
    return invalidRequest(c, '图片生成接口目前仅支持 openai provider');
  }

  try {
    const upstream = await callOpenAIEndpoint(
      c.env,
      '/images/generations',
      JSON.stringify({
        quality: 'low',
        output_format: 'jpeg',
        output_compression: 80,
        moderation: 'low',
        ...body,
        model: upstreamModel,
      }),
      { 'content-type': 'application/json' },
    );
    return proxyOpenAIImageResponse(c, services, upstream, modelId, modelPricing);
  } catch (error) {
    console.error('[openai/images/generations] 调用失败:', error);
    const message = error instanceof Error ? error.message : '上游调用失败';
    return c.json({ error: { message, type: 'api_error' } }, 502);
  }
});

/**
 * POST /v1/images/edits
 * OpenAI Image API 编辑接口。该端点使用 multipart/form-data，需要重建表单以改写 model。
 */
openai.post('/images/edits', async (c) => {
  const contentType = c.req.header('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return invalidRequest(c, '图片编辑接口需要 multipart/form-data 请求体');
  }

  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return invalidRequest(c, '请求体必须是有效 multipart/form-data');
  }

  const modelValue = form.get('model');
  const promptValue = form.get('prompt');
  if (typeof modelValue !== 'string' || !modelValue) {
    return invalidRequest(c, '缺少 model 参数');
  }
  if (typeof promptValue !== 'string' || !promptValue) {
    return invalidRequest(c, '缺少 prompt 参数');
  }

  const services = createProxyServices(c.env);
  const lookup = await lookupModel(c, modelValue, services);
  if (isResponse(lookup)) return lookup;
  const { modelConfig, upstreamModel, modelPricing } = lookup;
  const accessError = await assertBillableAccess(c, services, modelValue);
  if (accessError) return accessError;

  if (modelConfig.provider !== 'openai') {
    return invalidRequest(c, '图片编辑接口目前仅支持 openai provider');
  }

  const upstreamForm = new FormData();
  for (const [key, value] of form.entries()) {
    appendFormEntry(upstreamForm, key, key === 'model' ? upstreamModel : value);
  }
  if (!upstreamForm.has('quality')) {
    upstreamForm.append('quality', 'low');
  }
  if (!upstreamForm.has('output_format')) {
    upstreamForm.append('output_format', 'jpeg');
  }
  if (!upstreamForm.has('output_compression')) {
    upstreamForm.append('output_compression', '80');
  }
  if (!upstreamForm.has('moderation')) {
    upstreamForm.append('moderation', 'low');
  }

  try {
    const upstream = await callOpenAIEndpoint(c.env, '/images/edits', upstreamForm);
    return proxyOpenAIImageResponse(c, services, upstream, modelValue, modelPricing);
  } catch (error) {
    console.error('[openai/images/edits] 调用失败:', error);
    const message = error instanceof Error ? error.message : '上游调用失败';
    return c.json({ error: { message, type: 'api_error' } }, 502);
  }
});

/**
 * GET /v1/models
 * 列出可用模型
 */
openai.get('/models', async (c) => {
  const services = createProxyServices(c.env);
  const all = await services.modelCatalog.getAll();
  return c.json({
    object: 'list',
    data: all.map((m) => ({
      id: m.id,
      object: 'model',
      created: 0,
      owned_by: m.provider,
    })),
  });
});

export default openai;
