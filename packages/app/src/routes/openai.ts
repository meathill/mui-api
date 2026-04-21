import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { CloudflareBindings } from '../types';
import { authMiddleware } from '../middleware/auth';
import { createDb } from '../db';
import { models } from '../db/schema';
import { createProxyServices } from '../services/service-factory';
import { callAiBinding, callGemini, callOpenAI } from '../services/provider-dispatch';
import { extractStreamUsage, extractUsage } from '../services/usage-extractor';

const openai = new Hono<{ Bindings: CloudflareBindings }>();

// 应用认证中间件（包含并发控制）
openai.use('/*', authMiddleware);

/**
 * POST /v1/chat/completions
 * 按 DB 记录的 provider 分发到对应 SDK / binding，响应原样透传
 * 调用方需按目标 provider 原生 shape 构造请求体（OpenAI / Anthropic Messages / Gemini generateContent / Workers AI）
 */
openai.post('/chat/completions', async (c) => {
  const userId = c.get('userId');
  const apiKeyId = c.get('apiKeyId');
  const userRateMultiplier = c.get('rateMultiplier');
  const body = await c.req.json<Record<string, unknown>>();

  if (!body.model) {
    return c.json({ error: { message: '缺少 model 参数', type: 'invalid_request_error' } }, 400);
  }

  const modelId = body.model as string;
  const { db, billingService, alertService } = createProxyServices(c.env);
  const modelConfig = await db.select().from(models).where(eq(models.id, modelId)).get();

  if (!modelConfig) {
    return c.json({ error: { message: `未知模型: ${modelId}`, type: 'invalid_request_error' } }, 404);
  }

  const provider = modelConfig.provider;
  const upstreamModel = modelConfig.upstreamModelId ?? modelId;
  const modelPricing = {
    inputPrice: modelConfig.inputPrice ?? 0,
    outputPrice: modelConfig.outputPrice ?? 0,
    markupRate: modelConfig.markupRate ?? 1.2,
  };
  const isStream = body.stream === true;

  // 上游的 model 字段应当用 upstreamModelId，dispatch 之前改写一次
  const upstreamBody = { ...body, model: upstreamModel };

  try {
    let upstream: Response;
    if (provider === 'openai') {
      upstream = await callOpenAI(c.env, upstreamBody);
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
            if (usage && (usage.inputTokens > 0 || usage.outputTokens > 0)) {
              const cost = await billingService.processUsage(
                userId,
                apiKeyId,
                { model: modelId, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens },
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
      return new Response(clientStream, {
        status: upstream.status,
        headers: upstream.headers,
      });
    }

    // 非流式：clone 一份用于 usage 提取
    const [clientResp, billingResp] = [upstream.clone(), upstream];
    c.executionCtx.waitUntil(
      (async () => {
        try {
          const data = (await billingResp.json()) as Record<string, unknown>;
          const usage = extractUsage(provider, data);
          if (usage && (usage.inputTokens > 0 || usage.outputTokens > 0)) {
            const cost = await billingService.processUsage(
              userId,
              apiKeyId,
              { model: modelId, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens },
              modelPricing,
              userRateMultiplier,
            );
            await alertService.checkAfterBilling(userId, cost);
          }
        } catch (error) {
          console.error('非流式计费失败:', error);
        }
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

export default openai;
