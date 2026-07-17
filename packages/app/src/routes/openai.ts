import { Hono } from 'hono';
import { badRequest, gatewayError } from '../lib/errors';
import { parseGrokImageEditRequest, parseGrokImageGenerationRequest } from '../lib/grok-image';
import { authMiddleware } from '../middleware/auth';
import {
  callAiBinding,
  callAnthropicCompat,
  callGemini,
  callGrokEndpoint,
  callMoonshot,
  callOpenAI,
  callOpenAIEndpoint,
  callXiaomiMiMo,
} from '../services/provider-dispatch';
import { createProxyServices } from '../services/service-factory';
import type { CloudflareBindings } from '../types';
import {
  appendFormEntry,
  assertBillableAccess,
  isResponse,
  lookupModel,
  processBilling,
  processStreamBilling,
  proxyOpenAIImageResponse,
  readJsonBody,
} from './openai-helpers';

const openai = new Hono<{ Bindings: CloudflareBindings }>();

// 应用认证中间件（包含并发控制）
openai.use('/*', authMiddleware);

/**
 * POST /v1/chat/completions
 * 按 DB 记录的 provider 分发到对应 SDK / binding，响应原样透传
 * 调用方需按目标 provider 原生 shape 构造请求体（OpenAI / Xiaomi MiMo / Anthropic Messages / Gemini generateContent / Workers AI）
 */
openai.post('/chat/completions', async (c) => {
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
  const accessError = await assertBillableAccess(c, services, modelId);
  if (accessError) return accessError;
  const provider = modelConfig.provider;
  const isStream = body.stream === true;

  // 上游的 model 字段应当用 upstreamModelId，dispatch 之前改写一次
  const upstreamBody = { ...body, model: upstreamModel };

  try {
    let upstream: Response;
    // 计费/usage 解析用的 provider：anthropic 走 compat 端点返回 OpenAI 形 usage，故按 openai 解析
    let billingProvider = provider;
    if (provider === 'openai') {
      upstream = await callOpenAI(c.env, upstreamBody);
    } else if (provider === 'moonshot') {
      upstream = await callMoonshot(c.env, upstreamBody);
    } else if (provider === 'xiaomi-mimo') {
      upstream = await callXiaomiMiMo(c.env, upstreamBody);
    } else if (provider === 'google-ai-studio') {
      upstream = await callGemini(c.env, upstreamModel, upstreamBody);
    } else if (provider === 'anthropic') {
      upstream = await callAnthropicCompat(c.env, upstreamModel, upstreamBody);
      billingProvider = 'openai';
    } else if (provider === 'grok') {
      upstream = await callGrokEndpoint(c.env, '/v1/chat/completions', JSON.stringify(upstreamBody), {
        'content-type': 'application/json',
      });
    } else {
      upstream = await callAiBinding(c.env, upstreamModel, upstreamBody);
    }

    if (!upstream.ok) {
      const errText = await upstream.text();
      return gatewayError(c, `上游 ${provider} 错误 (${upstream.status}): ${errText}`);
    }

    // 流式：tee，一路给客户端，一路抽 usage
    const contentType = upstream.headers.get('content-type') ?? '';
    const isSse = isStream || contentType.includes('text/event-stream');

    if (isSse && upstream.body) {
      const [clientStream, billingStream] = upstream.body.tee();
      processStreamBilling(c, services, billingProvider, billingStream, modelId, modelPricing);
      return new Response(clientStream, {
        status: upstream.status,
        headers: upstream.headers,
      });
    }

    // 非流式：clone 一份用于 usage 提取
    const [clientResp, billingResp] = [upstream.clone(), upstream];
    c.executionCtx.waitUntil(
      (async () => {
        await processBilling(c, services, billingProvider, billingResp, modelId, modelPricing);
      })(),
    );
    return clientResp;
  } catch (error) {
    console.error(`[${provider}] 调用失败:`, error);
    const message = error instanceof Error ? error.message : '上游调用失败';
    return gatewayError(c, message);
  }
});

/**
 * POST /v1/images/generations
 * OpenAI / Grok Image 生成接口。OpenAI 注入默认参数；Grok 校验并透传原生参数。
 */
openai.post('/images/generations', async (c) => {
  const body = await readJsonBody(c);
  if (isResponse(body)) return body;

  if (typeof body.model !== 'string' || !body.model) {
    return badRequest(c, '缺少 model 参数');
  }
  if (typeof body.prompt !== 'string' || !body.prompt) {
    return badRequest(c, '缺少 prompt 参数');
  }

  const modelId = body.model;
  const services = createProxyServices(c.env, c.get('db'));
  const lookup = await lookupModel(c, modelId, services);
  if (isResponse(lookup)) return lookup;
  const { modelConfig, upstreamModel, modelPricing } = lookup;
  const accessError = await assertBillableAccess(c, services, modelId);
  if (accessError) return accessError;

  if (modelConfig.provider !== 'openai' && modelConfig.provider !== 'grok') {
    return badRequest(c, '图片生成接口目前仅支持 openai / grok provider');
  }

  try {
    if (modelConfig.provider === 'grok') {
      const parsed = parseGrokImageGenerationRequest(body, upstreamModel);
      if ('error' in parsed) return badRequest(c, parsed.error);
      const upstream = await callGrokEndpoint(c.env, '/v1/images/generations', JSON.stringify(parsed.body), {
        'content-type': 'application/json',
      });
      return proxyOpenAIImageResponse(c, services, upstream, modelId, modelPricing, 'grok-image', parsed.usageContext);
    }

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
    return gatewayError(c, message);
  }
});

/**
 * POST /v1/images/edits
 * OpenAI 使用 multipart/form-data；Grok 使用 application/json。
 */
openai.post('/images/edits', async (c) => {
  const contentType = c.req.header('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = await readJsonBody(c);
    if (isResponse(body)) return body;
    if (typeof body.model !== 'string' || !body.model) return badRequest(c, '缺少 model 参数');
    if (typeof body.prompt !== 'string' || !body.prompt) return badRequest(c, '缺少 prompt 参数');

    const modelId = body.model;
    const services = createProxyServices(c.env, c.get('db'));
    const lookup = await lookupModel(c, modelId, services);
    if (isResponse(lookup)) return lookup;
    const { modelConfig, upstreamModel, modelPricing } = lookup;
    if (modelConfig.provider !== 'grok') return badRequest(c, 'JSON 图片编辑接口仅支持 grok provider');
    const accessError = await assertBillableAccess(c, services, modelId);
    if (accessError) return accessError;
    const parsed = parseGrokImageEditRequest(body, upstreamModel);
    if ('error' in parsed) return badRequest(c, parsed.error);

    try {
      const upstream = await callGrokEndpoint(c.env, '/v1/images/edits', JSON.stringify(parsed.body), {
        'content-type': 'application/json',
      });
      return proxyOpenAIImageResponse(c, services, upstream, modelId, modelPricing, 'grok-image', parsed.usageContext);
    } catch (error) {
      console.error('[grok/images/edits] 调用失败:', error);
      const message = error instanceof Error ? error.message : '上游调用失败';
      return gatewayError(c, message);
    }
  }

  if (!contentType.includes('multipart/form-data')) {
    return badRequest(c, '图片编辑接口需要 multipart/form-data 或 application/json 请求体');
  }

  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return badRequest(c, '请求体必须是有效 multipart/form-data');
  }

  const modelValue = form.get('model');
  const promptValue = form.get('prompt');
  if (typeof modelValue !== 'string' || !modelValue) {
    return badRequest(c, '缺少 model 参数');
  }
  if (typeof promptValue !== 'string' || !promptValue) {
    return badRequest(c, '缺少 prompt 参数');
  }

  const services = createProxyServices(c.env, c.get('db'));
  const lookup = await lookupModel(c, modelValue, services);
  if (isResponse(lookup)) return lookup;
  const { modelConfig, upstreamModel, modelPricing } = lookup;
  const accessError = await assertBillableAccess(c, services, modelValue);
  if (accessError) return accessError;

  if (modelConfig.provider !== 'openai') {
    return badRequest(c, '图片编辑接口目前仅支持 openai provider');
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
    return gatewayError(c, message);
  }
});

/**
 * GET /v1/models
 * 列出可用模型
 */
openai.get('/models', async (c) => {
  const services = createProxyServices(c.env, c.get('db'));
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
