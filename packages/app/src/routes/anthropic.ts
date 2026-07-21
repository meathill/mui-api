import { Hono } from 'hono';
import { badRequest, gatewayError, upstreamError } from '../lib/errors';
import { authMiddleware } from '../middleware/auth';
import { createProxyServices } from '../services/service-factory';
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
 * POST /v1/messages —— Anthropic 原生 Messages API
 * 让客户端把 Anthropic SDK / Claude Code 的 base_url 直接指向本网关。
 * 仅服务 anthropic provider（Claude），经 CF AI Gateway 原生透传，默认 Unified Billing 代付。
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
  // 改写 model 为上游真实 ID；proxyNative 会注入网关认证与代付凭证（unified→CF_TOKEN / byok→x-api-key）
  const upstreamReq = new Request('https://gateway.internal/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...body, model: upstreamModel }),
  });

  try {
    const upstream = await services.gatewayService.proxyNative('anthropic', 'v1/messages', upstreamReq);

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
