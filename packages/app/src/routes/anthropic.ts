import { Hono } from 'hono';
import { badRequest, gatewayError, upstreamError } from '../lib/errors';
import { authMiddleware } from '../middleware/auth';
import { createProxyServices } from '../services/service-factory';
import { callAnthropic } from '../services/provider-dispatch';
import type { CloudflareBindings } from '../types';
import {
  assertBillableAccess,
  isResponse,
  lookupModel,
  processBilling,
  processStreamBilling,
  readJsonBody,
} from './openai-helpers';

const anthropic = new Hono<{ Bindings: CloudflareBindings }>();

/**
 * 统计请求体中 cache_control 出现次数（顶层 automatic caching 字段与 system/tools/messages
 * 各 content block 上的断点都计入）。用于入站日志，排查 prompt cache 零命中时区分
 * "客户端没写断点" 与 "断点写了但没命中"。
 */
function countCacheControl(value: unknown): number {
  if (Array.isArray(value)) {
    return value.reduce<number>((sum, item) => sum + countCacheControl(item), 0);
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).reduce<number>(
      (sum, [key, val]) => sum + (key === 'cache_control' ? 1 : 0) + countCacheControl(val),
      0,
    );
  }
  return 0;
}

/**
 * POST /v1/messages —— Anthropic 原生 Messages API
 * 让客户端把 Anthropic SDK / Claude Code 的 base_url 直接指向本网关。
 * 仅服务 anthropic provider（Claude），经 CF AI Gateway + 官方 Anthropic SDK，Stored Keys 托管凭证。
 * 用 handler 级中间件（不用 use('/*')），避免与同前缀的 openai 路由互相拦截。
 */
anthropic.post('/messages', authMiddleware, async (c) => {
  const body = await readJsonBody(c);
  if (isResponse(body)) return body;

  if (!body.model) {
    return badRequest(c, '缺少 model 参数');
  }
  if (!Array.isArray(body.messages)) {
    return badRequest(c, '缺少 messages 参数');
  }

  const modelId = body.model as string;
  const services = createProxyServices(c.env, c.get('db'));
  const lookup = await lookupModel(c, modelId, services);
  if (isResponse(lookup)) return lookup;
  const { modelConfig, upstreamModel, modelPricing } = lookup;

  // 仅服务 Claude；拒绝其它 provider，避免借道 /v1/messages 路由到非 anthropic 上游或误用凭证
  if (modelConfig.provider !== 'anthropic') {
    return badRequest(c, `模型 ${modelId} 不是 anthropic 模型，/v1/messages 仅支持 Claude`);
  }

  const accessError = await assertBillableAccess(c, services, modelId);
  if (accessError) return accessError;

  const isStream = body.stream === true;

  // 对齐 openai.ts 的入站日志；cache_control 次数为 0 是缓存零命中的直接信号
  console.log(
    `[billing] 入站请求: model=${modelId} provider=anthropic stream=${isStream} cache_control=${countCacheControl(body)} messages=${Array.isArray(body.messages) ? (body.messages as unknown[]).length : 0} user=${c.get('userId')}`,
  );

  try {
    // 经官方 SDK + AI Gateway，apiKey=CF_AIG_TOKEN，baseURL=.../anthropic
    const anthropicBeta = c.req.header('anthropic-beta');
    const upstream = await callAnthropic(
      c.env,
      { ...body, model: upstreamModel },
      anthropicBeta ? { 'anthropic-beta': anthropicBeta } : undefined,
    );

    if (!upstream.ok) {
      const errText = await upstream.text();
      return upstreamError(c, upstream.status, `上游 anthropic 错误 (${upstream.status}): ${errText}`);
    }

    const contentType = upstream.headers.get('content-type') ?? '';
    const isSse = isStream || contentType.includes('text/event-stream');

    if (isSse && upstream.body) {
      const [clientStream, billingStream] = upstream.body.tee();
      processStreamBilling(c, services, 'anthropic', billingStream, modelId, modelPricing);
      return new Response(clientStream, { status: upstream.status, headers: upstream.headers });
    }

    const [clientResp, billingResp] = [upstream.clone(), upstream];
    c.executionCtx.waitUntil(processBilling(c, services, 'anthropic', billingResp, modelId, modelPricing));
    return clientResp;
  } catch (error) {
    console.error('[anthropic/messages] 调用失败:', error);
    const message = error instanceof Error ? error.message : '上游调用失败';
    return gatewayError(c, message);
  }
});

export default anthropic;
