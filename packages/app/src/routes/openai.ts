import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { CloudflareBindings } from '../types';
import { authMiddleware } from '../middleware/auth';
import { createDb } from '../db';
import { models } from '../db/schema';
import { KVService } from '../services/kv-service';
import { GatewayService } from '../services/gateway-service';
import { BillingService } from '../services/billing-service';
import { AlertService } from '../services/alert-service';
import { EmailService } from '../services/email-service';
import { extractCompatStreamUsage } from '../services/usage-extractor';

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
  const db = createDb(c.env.DB);
  const defaultMaxConcurrency = Number(c.env.DEFAULT_MAX_CONCURRENCY) || 3;
  const kvService = new KVService(c.env.KV, defaultMaxConcurrency);
  const billingService = new BillingService(kvService, db);
  const emailService = new EmailService({
    apiKey: c.env.RESEND_API_KEY,
    fromEmail: c.env.FROM_EMAIL,
  });
  const alertService = new AlertService(kvService, db, emailService, c.env.ADMIN_EMAIL);

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

  const gatewayService = new GatewayService(c.env.CF_ACCOUNT_ID, c.env.CF_GATEWAY_ID, {
    openai: c.env.OPENAI_API_KEY,
    anthropic: c.env.ANTHROPIC_API_KEY,
    'google-ai-studio': c.env.GOOGLE_API_KEY,
  });

  const isStream = body.stream === true;

  try {
    const upstreamResponse = await gatewayService.proxyCompat(body, provider, upstreamModel, isStream);

    if (isStream) {
      // 流式响应：tee stream，一路给客户端，一路用于提取 usage
      const [clientStream, billingStream] = upstreamResponse.body!.tee();

      // 异步提取 usage + 计费
      c.executionCtx.waitUntil(
        (async () => {
          const usage = await extractCompatStreamUsage(new Response(billingStream));
          if (usage && (usage.inputTokens > 0 || usage.outputTokens > 0)) {
            const cost = await billingService.processUsage(
              userId,
              null,
              {
                model: modelId,
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
              },
              modelPricing,
            );
            await alertService.checkAfterBilling(userId, cost);
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
          const cost = await billingService.processUsage(
            userId,
            null,
            {
              model: modelId,
              inputTokens: usage.prompt_tokens ?? 0,
              outputTokens: usage.completion_tokens ?? 0,
            },
            modelPricing,
          );
          await alertService.checkAfterBilling(userId, cost);
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
      owned_by: m.provider,
    })),
  });
});

export default openai;
