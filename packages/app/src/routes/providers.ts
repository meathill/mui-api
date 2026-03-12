import { Hono } from 'hono';
import type { CloudflareBindings } from '../types';
import { authMiddleware } from '../middleware/auth';
import { createDb } from '../db';
import { KVService } from '../services/kv-service';
import { GatewayService } from '../services/gateway-service';
import { BillingService } from '../services/billing-service';
import { AlertService } from '../services/alert-service';
import { EmailService } from '../services/email-service';
import { extractNativeUsage, extractNativeStreamUsage } from '../services/usage-extractor';

const providers = new Hono<{ Bindings: CloudflareBindings }>();

// 支持的 provider 列表
const SUPPORTED_PROVIDERS = new Set(['openai', 'anthropic', 'google-ai-studio']);

// 应用认证中间件
providers.use('/*', authMiddleware);

/**
 * 原生 Provider API 透传代理
 * /providers/:provider/* → CF AI Gateway /{provider}/*
 */
providers.all('/:provider{.+}/*', async (c) => {
  const provider = c.req.param('provider');

  if (!SUPPORTED_PROVIDERS.has(provider)) {
    return c.json({ error: { message: `不支持的 provider: ${provider}`, type: 'invalid_request_error' } }, 400);
  }

  const userId = c.get('userId');
  const db = createDb(c.env.DB);
  const defaultMaxConcurrency = Number(c.env.DEFAULT_MAX_CONCURRENCY) || 3;
  const kvService = new KVService(c.env.KV, defaultMaxConcurrency);
  const billingService = new BillingService(kvService, db);
  const emailService = new EmailService({
    apiKey: c.env.RESEND_API_KEY,
    fromEmail: c.env.FROM_EMAIL,
  });
  const alertService = new AlertService(kvService, db, emailService, c.env.ADMIN_EMAIL);

  const gatewayService = new GatewayService(c.env.CF_ACCOUNT_ID, c.env.CF_GATEWAY_ID, {
    openai: c.env.OPENAI_API_KEY,
    anthropic: c.env.ANTHROPIC_API_KEY,
    'google-ai-studio': c.env.GOOGLE_API_KEY,
  });

  // 提取 provider 之后的路径
  const fullPath = c.req.path;
  const providerPrefix = `/providers/${provider}/`;
  const path = fullPath.startsWith(providerPrefix) ? fullPath.slice(providerPrefix.length) : fullPath;

  try {
    const response = await gatewayService.proxyNative(provider, path, c.req.raw);

    // 判断是否为流式响应
    const contentType = response.headers.get('content-type') ?? '';
    const isStream = contentType.includes('text/event-stream') || contentType.includes('stream');

    if (isStream) {
      // 流式：tee stream，一路给客户端，一路用于提取 usage
      const [clientStream, billingStream] = response.body!.tee();

      c.executionCtx.waitUntil(
        (async () => {
          const usage = await extractNativeStreamUsage(provider, new Response(billingStream));
          if (usage && (usage.inputTokens > 0 || usage.outputTokens > 0)) {
            const cost = await billingService.processUsage(userId, null, {
              model: usage.model,
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
            });
            await alertService.checkAfterBilling(userId, cost);
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
          const usage = extractNativeUsage(provider, data);
          if (usage && (usage.inputTokens > 0 || usage.outputTokens > 0)) {
            const cost = await billingService.processUsage(userId, null, {
              model: usage.model,
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
            });
            await alertService.checkAfterBilling(userId, cost);
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
      return c.json({ error: { message: error.message, type: 'api_error' } }, 502);
    }

    return c.json({ error: { message: '上游 API 调用失败', type: 'api_error' } }, 502);
  }
});

export default providers;
