import { Hono } from 'hono';
import { badRequest, gatewayError } from '../lib/errors';
import { authMiddleware } from '../middleware/auth';
import { callOpenAIEndpoint } from '../services/provider-dispatch';
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

const responses = new Hono<{ Bindings: CloudflareBindings }>();

/**
 * POST /v1/responses —— OpenAI 原生 Responses API
 * 让 Codex CLI 等使用新版 wire format 的客户端把 base_url 指向本网关
 * （Codex 的 wire_api = "responses" 会对 base_url 自动追加 /responses）。
 * 仅服务 openai provider：Responses API 是 OpenAI 专属格式，不做跨 provider 转译。
 * 用 handler 级中间件（不用 use('/*')），避免与同前缀的 openai 路由互相拦截（同 anthropic.ts）。
 */
responses.post('/responses', authMiddleware, async (c) => {
  const body = await readJsonBody(c);
  if (isResponse(body)) return body;

  if (!body.model) {
    return badRequest(c, '缺少 model 参数');
  }
  // input 在 Responses API 里是可选字段（可仅靠 previous_response_id 续话），只在提供时校验类型
  if (body.input !== undefined && typeof body.input !== 'string' && !Array.isArray(body.input)) {
    return badRequest(c, 'input 参数必须是 string 或 array');
  }

  const modelId = body.model as string;
  const services = createProxyServices(c.env, c.get('db'));
  const lookup = await lookupModel(c, modelId, services);
  if (isResponse(lookup)) return lookup;
  const { modelConfig, upstreamModel, modelPricing } = lookup;

  // 仅服务 OpenAI；拒绝其它 provider，避免借道 /v1/responses 路由到不支持该 wire format 的上游
  if (modelConfig.provider !== 'openai') {
    return badRequest(c, `模型 ${modelId} 不是 openai 模型，/v1/responses 仅支持 OpenAI`);
  }

  const accessError = await assertBillableAccess(c, services, modelId);
  if (accessError) return accessError;

  const isStream = body.stream === true;

  try {
    // 原样转发，不注入默认字段：Codex 自行控制 tools/reasoning/store/previous_response_id 等
    const upstream = await callOpenAIEndpoint(c.env, '/responses', JSON.stringify({ ...body, model: upstreamModel }), {
      'content-type': 'application/json',
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      return gatewayError(c, `上游 openai 错误 (${upstream.status}): ${errText}`);
    }

    const contentType = upstream.headers.get('content-type') ?? '';
    const isSse = isStream || contentType.includes('text/event-stream');

    if (isSse && upstream.body) {
      const [clientStream, billingStream] = upstream.body.tee();
      processStreamBilling(c, services, 'openai', billingStream, modelId, modelPricing);
      return new Response(clientStream, { status: upstream.status, headers: upstream.headers });
    }

    const [clientResp, billingResp] = [upstream.clone(), upstream];
    c.executionCtx.waitUntil(processBilling(c, services, 'openai', billingResp, modelId, modelPricing));
    return clientResp;
  } catch (error) {
    console.error('[responses] 调用失败:', error);
    const message = error instanceof Error ? error.message : '上游调用失败';
    return gatewayError(c, message);
  }
});

export default responses;
