import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { CloudflareBindings } from '../types';
import { authMiddleware } from '../middleware/auth';
import { createDb } from '../db';
import { models } from '../db/schema';
import { createProxyServices } from '../services/service-factory';
import { extractCompatStreamUsage, extractCompatUsage } from '../services/usage-extractor';

const openai = new Hono<{ Bindings: CloudflareBindings }>();

// 应用认证中间件（包含并发控制）
openai.use('/*', authMiddleware);

// 根据模型名称前缀推断 provider
function inferProvider(model: string): string | null {
  if (model.startsWith('gpt-') || model.startsWith('o1-') || model.startsWith('o3-') || model.startsWith('o4-'))
    return 'openai';
  if (model.startsWith('claude-')) return 'anthropic';
  if (model.startsWith('gemini-')) return 'google-ai-studio';
  return null;
}

/**
 * POST /v1/chat/completions
 * OpenAI 兼容的 Chat Completions 接口，支持 OpenAI / Gemini / Claude
 */
openai.post('/chat/completions', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<Record<string, unknown>>();

  if (!body.model || !body.messages) {
    return c.json({ error: { message: '缺少 model 或 messages 参数', type: 'invalid_request_error' } }, 400);
  }

  const modelId = body.model as string;
  const userRateMultiplier = c.get('rateMultiplier');
  const { db, billingService, alertService, gatewayService, bedrockService } = createProxyServices(c.env);

  // 查 DB 获取 model 配置
  const modelConfig = await db.select().from(models).where(eq(models.id, modelId)).get();

  let provider: string;
  let upstreamModel: string;
  let modelPricing: { inputPrice: number; outputPrice: number; markupRate: number } | null = null;

  if (modelConfig) {
    provider = modelConfig.provider;
    upstreamModel = modelConfig.upstreamModelId ?? modelId;
    modelPricing = {
      inputPrice: modelConfig.inputPrice ?? 0,
      outputPrice: modelConfig.outputPrice ?? 0,
      markupRate: modelConfig.markupRate ?? 1.2,
    };
  } else {
    // fallback: 按前缀推断 provider
    const inferred = inferProvider(modelId);
    if (!inferred) {
      return c.json({ error: { message: `未知模型: ${modelId}`, type: 'invalid_request_error' } }, 404);
    }
    provider = inferred;
    upstreamModel = modelId;
  }

  const isStream = body.stream === true;

  try {
    // Anthropic 模型走 AWS Bedrock，其他走 CF AI Gateway
    const upstreamResponse =
      provider === 'anthropic'
        ? await bedrockService.proxyCompat(body, upstreamModel, isStream)
        : await gatewayService.proxyCompat(body, provider, upstreamModel, isStream);

    if (isStream) {
      // 流式响应：tee stream，一路给客户端，一路用于提取 usage
      const [clientStream, billingStream] = upstreamResponse.body!.tee();

      // 异步提取 usage + 计费
      c.executionCtx.waitUntil(
        (async () => {
          try {
            const usage = await extractCompatStreamUsage(new Response(billingStream));
            if (usage && (usage.inputTokens > 0 || usage.outputTokens > 0)) {
              const cost = await billingService.processUsage(
                userId,
                c.get('apiKeyId'),
                {
                  model: modelId,
                  inputTokens: usage.inputTokens,
                  outputTokens: usage.outputTokens,
                },
                modelPricing,
                userRateMultiplier,
              );
              await alertService.checkAfterBilling(userId, cost);
            }
          } catch (error) {
            console.error('流式计费失败:', error);
          }
        })(),
      );

      c.header('Content-Type', 'text/event-stream');
      c.header('Cache-Control', 'no-cache');
      c.header('Connection', 'keep-alive');
      return c.body(clientStream);
    }

    // 非流式响应
    const responseData = (await upstreamResponse.json()) as Record<string, unknown>;
    const usage = responseData.usage as Record<string, number> | undefined;

    if (usage) {
      c.executionCtx.waitUntil(
        (async () => {
          try {
            const cost = await billingService.processUsage(
              userId,
              c.get('apiKeyId'),
              {
                model: modelId,
                inputTokens: usage.prompt_tokens ?? 0,
                outputTokens: usage.completion_tokens ?? 0,
              },
              modelPricing,
              userRateMultiplier,
            );
            await alertService.checkAfterBilling(userId, cost);
          } catch (error) {
            console.error('非流式计费失败:', error);
          }
        })(),
      );
    }

    return c.json(responseData);
  } catch (error) {
    console.error('AI Gateway 调用失败:', error);

    if (error instanceof Error) {
      return c.json({ error: { message: error.message, type: 'api_error' } }, 502);
    }

    return c.json({ error: { message: '上游 API 调用失败', type: 'api_error' } }, 502);
  }
});

/**
 * GET /v1/models
 * 列出可用模型
 */
openai.get('/models', async (c) => {
  const db = createDb(c.env.DB);
  const modelList = await db.query.models.findMany();

  return c.json({
    object: 'list',
    data: modelList.map((m) => ({
      id: m.id,
      object: 'model',
      created: 0,
      owned_by: m.provider,
    })),
  });
});

/**
 * ALL /v1/*
 * 通用代理：将所有未匹配的 /v1/* 请求透传到 CF AI Gateway 的 OpenAI 端点
 * 支持 /v1/completions、/v1/embeddings、/v1/images/*、/v1/audio/* 等
 */
openai.all('/*', async (c) => {
  const userId = c.get('userId');
  const apiKeyId = c.get('apiKeyId');
  const userRateMultiplier = c.get('rateMultiplier');
  const { billingService, alertService, gatewayService } = createProxyServices(c.env);

  // 提取请求路径，转为 OpenAI API 路径
  const path = c.req.path.replace(/^\/v1\//, '');

  try {
    const response = await gatewayService.proxyNative('openai', `v1/${path}`, c.req.raw);

    // 判断是否为流式响应
    const contentType = response.headers.get('content-type') ?? '';
    const isStream = contentType.includes('text/event-stream');

    if (isStream) {
      const [clientStream, billingStream] = response.body!.tee();

      c.executionCtx.waitUntil(
        (async () => {
          try {
            const usage = await extractCompatStreamUsage(new Response(billingStream));
            if (usage && (usage.inputTokens > 0 || usage.outputTokens > 0)) {
              const cost = await billingService.processUsage(
                userId,
                apiKeyId,
                {
                  model: usage.model,
                  inputTokens: usage.inputTokens,
                  outputTokens: usage.outputTokens,
                },
                null,
                userRateMultiplier,
              );
              await alertService.checkAfterBilling(userId, cost);
            }
          } catch (error) {
            console.error('通用代理流式计费失败:', error);
          }
        })(),
      );

      return new Response(clientStream, {
        status: response.status,
        headers: response.headers,
      });
    }

    // 非流式：尝试提取 usage 计费
    const [clientResponse, billingResponse] = [response.clone(), response];

    c.executionCtx.waitUntil(
      (async () => {
        try {
          const data = (await billingResponse.json()) as Record<string, unknown>;
          const usage = extractCompatUsage(data);
          if (usage && (usage.inputTokens > 0 || usage.outputTokens > 0)) {
            const cost = await billingService.processUsage(
              userId,
              apiKeyId,
              {
                model: usage.model,
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
              },
              null,
              userRateMultiplier,
            );
            await alertService.checkAfterBilling(userId, cost);
          }
        } catch {
          // 非 JSON 响应或无 usage 字段，跳过计费（如 /v1/images 返回图片等）
        }
      })(),
    );

    return clientResponse;
  } catch (error) {
    console.error('通用代理调用失败:', error);

    if (error instanceof Error) {
      return c.json({ error: { message: error.message, type: 'api_error' } }, 502);
    }

    return c.json({ error: { message: '上游 API 调用失败', type: 'api_error' } }, 502);
  }
});

export default openai;
