/**
 * Provider 分发：按 provider 选 SDK 调上游，返回原始 Response 透传给客户端
 * - openai          → openai SDK 直连（OPENAI_API_KEY），跳过 AI Gateway；缺 key 时回退 Gateway
 * - google-ai-studio → @google/genai SDK + AI Gateway (CF_AIG_TOKEN 鉴权)
 * - moonshot        → fetch + Moonshot OpenAI 兼容接口（直连，不走 AI Gateway）
 * - xiaomi-mimo     → fetch + Xiaomi MiMo OpenAI 兼容接口（直连，不走 AI Gateway）
 * - anthropic       → @anthropic-ai/sdk + AI Gateway 原生端点（CF_AIG_TOKEN + Stored Keys，官方 SDK）
 * - grok            → fetch + AI Gateway 原生 grok 端点（xAI key 以 CF Gateway Stored Keys 形式配置，本服务不持有）
 * - workers-ai      → env.AI.run + gateway option
 */

import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import type { CloudflareBindings } from '../types';
import {
  type ChatCompletionMeta,
  toOpenAIChatChunks,
  toOpenAIChatCompletion,
  translateChatRequest,
} from './gemini-compat';

type AnyBody = Record<string, unknown>;
const MOONSHOT_DEFAULT_BASE_URL = 'https://api.moonshot.ai/v1';
const XIAOMI_MIMO_DEFAULT_BASE_URL = 'https://api.xiaomimimo.com/v1';
const DEEPSEEK_DEFAULT_BASE_URL = 'https://api.deepseek.com';
const OPENCODE_GO_DEFAULT_BASE_URL = 'https://opencode.ai/zen/go/v1';

function aiGatewayBase(env: CloudflareBindings, provider: string): string {
  return `https://gateway.ai.cloudflare.com/v1/${env.CF_ACCOUNT_ID}/${env.CF_GATEWAY_ID}/${provider}`;
}

export function openAIGatewayBase(env: CloudflareBindings): string {
  return aiGatewayBase(env, 'openai');
}

export function openAIDirectBaseURL(env: CloudflareBindings): string {
  return trimTrailingSlashes(env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1');
}

export function anthropicGatewayBase(env: CloudflareBindings): string {
  return aiGatewayBase(env, 'anthropic');
}

export function compatGatewayBase(env: CloudflareBindings): string {
  return aiGatewayBase(env, 'compat');
}

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

export function xiaomiMiMoBaseURL(env: CloudflareBindings): string {
  return trimTrailingSlashes(env.MIMO_BASE_URL ?? XIAOMI_MIMO_DEFAULT_BASE_URL);
}

export function moonshotBaseURL(env: CloudflareBindings): string {
  return trimTrailingSlashes(env.MOONSHOT_BASE_URL ?? MOONSHOT_DEFAULT_BASE_URL);
}

export function deepseekBaseURL(env: CloudflareBindings): string {
  return trimTrailingSlashes(env.DEEPSEEK_BASE_URL ?? DEEPSEEK_DEFAULT_BASE_URL);
}

export function openCodeGoBaseURL(env: CloudflareBindings): string {
  return trimTrailingSlashes(env.OPENCODE_GO_BASE_URL ?? OPENCODE_GO_DEFAULT_BASE_URL);
}

/** OpenAI SDK 调用，优先直连（OPENAI_API_KEY），缺 key 时回退 AI Gateway */
export async function callOpenAI(env: CloudflareBindings, body: AnyBody): Promise<Response> {
  if (env.OPENAI_API_KEY) {
    const client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      baseURL: openAIDirectBaseURL(env),
    });
    return client.chat.completions.create(body as never).asResponse();
  }
  const client = new OpenAI({
    apiKey: env.CF_AIG_TOKEN,
    baseURL: openAIGatewayBase(env),
  });
  return client.chat.completions.create(body as never).asResponse();
}

/** OpenAI 非 Chat 端点原样转发，优先直连，缺 key 回退 Gateway */
export async function callOpenAIEndpoint(
  env: CloudflareBindings,
  path: string,
  body: BodyInit,
  headers: Record<string, string> = {},
): Promise<Response> {
  if (env.OPENAI_API_KEY) {
    return fetch(`${openAIDirectBaseURL(env)}${path}`, {
      method: 'POST',
      headers: {
        ...headers,
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body,
    });
  }
  return fetch(`${openAIGatewayBase(env)}${path}`, {
    method: 'POST',
    headers: {
      ...headers,
      Authorization: `Bearer ${env.CF_AIG_TOKEN}`,
    },
    body,
  });
}

type OpenAICompatDirectConfig = {
  apiKey: string | undefined;
  apiKeyEnvName: string;
  baseUrl: string;
  providerLabel: string;
  allowOpenCodeGoFallback?: boolean;
};

/** OpenCode Go 订阅服务：直连 https://opencode.ai/zen/go/v1 端点 */
export async function callOpenCodeGo(env: CloudflareBindings, body: AnyBody): Promise<Response> {
  if (!env.OPENCODE_GO_API_KEY) {
    throw new Error('缺少 OPENCODE_GO_API_KEY，无法调用 OpenCode Go');
  }

  return fetch(`${openCodeGoBaseURL(env)}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENCODE_GO_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

/** 直连 OpenAI 兼容 Chat Completions 接口的公共骨架（在配置了 OPENCODE_GO_API_KEY 时优先使用 OpenCode Go API 端点）。 */
async function callOpenAICompatDirect(
  env: CloudflareBindings,
  config: OpenAICompatDirectConfig,
  body: AnyBody,
): Promise<Response> {
  if (config.allowOpenCodeGoFallback !== false && env.OPENCODE_GO_API_KEY) {
    return callOpenCodeGo(env, body);
  }

  if (config.apiKey) {
    return fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  throw new Error(`缺少 ${config.apiKeyEnvName} 或 OPENCODE_GO_API_KEY，无法调用 ${config.providerLabel}`);
}

/** Xiaomi MiMo 直连 OpenAI 兼容 Chat Completions 接口，不经过 Cloudflare AI Gateway。 */
export async function callXiaomiMiMo(env: CloudflareBindings, body: AnyBody): Promise<Response> {
  return callOpenAICompatDirect(
    env,
    {
      apiKey: env.MIMO_API_KEY,
      apiKeyEnvName: 'MIMO_API_KEY',
      baseUrl: xiaomiMiMoBaseURL(env),
      providerLabel: 'Xiaomi MiMo',
    },
    body,
  );
}

/** Moonshot 直连 OpenAI 兼容 Chat Completions 接口，不经过 Cloudflare AI Gateway。 */
export async function callMoonshot(env: CloudflareBindings, body: AnyBody): Promise<Response> {
  return callOpenAICompatDirect(
    env,
    {
      apiKey: env.MOONSHOT_API_KEY,
      apiKeyEnvName: 'MOONSHOT_API_KEY',
      baseUrl: moonshotBaseURL(env),
      providerLabel: 'Moonshot AI',
    },
    body,
  );
}

/** DeepSeek 直连 OpenAI 兼容 Chat Completions 接口，不经过 Cloudflare AI Gateway。 */
export async function callDeepSeek(env: CloudflareBindings, body: AnyBody): Promise<Response> {
  return callOpenAICompatDirect(
    env,
    {
      apiKey: env.DEEPSEEK_API_KEY,
      apiKeyEnvName: 'DEEPSEEK_API_KEY',
      baseUrl: deepseekBaseURL(env),
      providerLabel: 'DeepSeek',
    },
    body,
  );
}

/** 通用 OpenCode Go 直连（chat/completions 经 Go 订阅，不暴露上游） */
async function callViaOpenCodeGo(env: CloudflareBindings, providerLabel: string, body: AnyBody): Promise<Response> {
  return callOpenAICompatDirect(
    env,
    {
      apiKey: undefined,
      apiKeyEnvName: 'OPENCODE_GO_API_KEY',
      baseUrl: openCodeGoBaseURL(env),
      providerLabel,
      allowOpenCodeGoFallback: true,
    },
    body,
  );
}

export async function callZai(env: CloudflareBindings, body: AnyBody): Promise<Response> {
  return callViaOpenCodeGo(env, 'Zhipu AI', body);
}
export async function callQwen(env: CloudflareBindings, body: AnyBody): Promise<Response> {
  return callViaOpenCodeGo(env, 'Qwen', body);
}
export async function callMinimax(env: CloudflareBindings, body: AnyBody): Promise<Response> {
  return callViaOpenCodeGo(env, 'MiniMax', body);
}
export async function callMeta(env: CloudflareBindings, body: AnyBody): Promise<Response> {
  return callViaOpenCodeGo(env, 'Meta', body);
}
export async function callLongcat(env: CloudflareBindings, body: AnyBody): Promise<Response> {
  return callViaOpenCodeGo(env, 'LongCat', body);
}
export async function callHy(env: CloudflareBindings, body: AnyBody): Promise<Response> {
  return callViaOpenCodeGo(env, 'Hy', body);
}

/**
 * Gemini @google/genai SDK 调用，接收标准 OpenAI chat body。
 * 请求经 gemini-compat 翻译为 { contents, config }，响应翻译回 OpenAI
 * chat.completion(.chunk) 形——本服务对外只有 OpenAI 兼容接口，没有任何调用方
 * 会构造 Gemini 原生 shape。usage 为 OpenAI 形，计费按 openai provider 解析。
 */
export async function callGemini(env: CloudflareBindings, upstreamModel: string, body: AnyBody): Promise<Response> {
  const ai = new GoogleGenAI({
    apiKey: env.CF_AIG_TOKEN,
    httpOptions: {
      baseUrl: aiGatewayBase(env, 'google-ai-studio'),
    },
  });

  const isStream = body.stream === true;
  const { contents, config } = translateChatRequest(body);
  const args = {
    model: upstreamModel,
    contents: contents as never,
    config: config as never,
  };
  const meta: ChatCompletionMeta = {
    id: `chatcmpl-${crypto.randomUUID()}`,
    created: Math.floor(Date.now() / 1000),
    model: upstreamModel,
  };

  if (isStream) {
    const iter = await ai.models.generateContentStream(args);
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          let isFirst = true;
          for await (const chunk of iter) {
            for (const openaiChunk of toOpenAIChatChunks(chunk as never, meta, isFirst)) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`));
            }
            isFirst = false;
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (err) {
          controller.error(err);
          return;
        }
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  }

  const resp = await ai.models.generateContent(args);
  return new Response(JSON.stringify(toOpenAIChatCompletion(resp as never, meta)), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Anthropic 原生 Messages API，经 CF AI Gateway + 官方 SDK（Anthropic JS SDK）。
 * 鉴权：apiKey = CF_AIG_TOKEN，baseURL = .../anthropic，Stored Keys 在网关侧注入真实 Anthropic Key。
 * 不再区分 unified / byok，Worker 不持有 Anthropic 凭证。
 */
export async function callAnthropic(
  env: CloudflareBindings,
  body: AnyBody,
  defaultHeaders?: Record<string, string>,
): Promise<Response> {
  const client = new Anthropic({
    apiKey: env.CF_AIG_TOKEN,
    baseURL: anthropicGatewayBase(env),
    // SDK 默认不带 anthropic-beta，客户端声明的 beta 能力（如 extended-cache-ttl 的 1h 缓存 TTL）
    // 若不透传会静默失效
    ...(defaultHeaders ? { defaultHeaders } : {}),
  });
  // 归一化：用户可能传 claude-haiku-4.5(dot)，上游 Anthropic 需 hyphen
  const normalizedBody = body.model ? { ...body, model: String(body.model).replace(/\./g, '-') } : body;
  return client.messages.create(normalizedBody as never).asResponse();
}

/**
 * Anthropic 经 CF AI Gateway compat 端点（OpenAI 兼容），供 POST /v1/chat/completions 的
 * provider=anthropic 保持兼容。使用 OpenAI SDK 经 gateway 的 compat 能力，返回 OpenAI 形。
 * 同样只靠 CF_AIG_TOKEN，不再注入 ANTHROPIC_API_KEY。
 */
export async function callAnthropicCompat(
  env: CloudflareBindings,
  upstreamModel: string,
  body: AnyBody,
): Promise<Response> {
  const client = new OpenAI({
    apiKey: env.CF_AIG_TOKEN,
    baseURL: compatGatewayBase(env),
  });
  const normalizedUpstream = upstreamModel.replace(/\./g, '-');
  return client.chat.completions.create({ ...body, model: `anthropic/${normalizedUpstream}` } as never).asResponse();
}

/**
 * xAI Grok，经 CF AI Gateway 原生透传（不走 compat 转译，直接转发 OpenAI 兼容 body）。
 * 鉴权：只带 cf-aig-authorization 网关凭证，不注入 Authorization——xAI key 以 CF AI Gateway
 * Stored Keys 形式配置在网关侧，本服务不持有真实 xAI key，与 openai/google-ai-studio 走 proxyNative()
 * 时的凭证模式一致（对照 gateway-service.ts 里非 UNIFIED_BILLING_PROVIDERS 的分支）。
 * path 需带 /v1 前缀（如 /v1/chat/completions、/v1/images/generations），
 * 与 openAIGatewayBase() 的路径约定不同——已用 CF 官方文档核实。
 */
export async function callGrokEndpoint(
  env: CloudflareBindings,
  path: string,
  body?: BodyInit,
  headers: Record<string, string> = {},
  method: 'GET' | 'POST' = 'POST',
): Promise<Response> {
  return fetch(`${aiGatewayBase(env, 'grok')}${path}`, {
    method,
    headers: {
      ...headers,
      'cf-aig-authorization': `Bearer ${env.CF_AIG_TOKEN}`,
    },
    body,
  });
}

/**
 * env.AI.run 调用（workers-ai；@cf/* 各模型自己的 input schema）
 * 注：anthropic 已改走 callAnthropicCompat（compat 端点 + Unified Billing），不再走这里
 */
export async function callAiBinding(env: CloudflareBindings, upstreamModel: string, body: AnyBody): Promise<Response> {
  const _isStream = body.stream === true;
  // biome-ignore lint/suspicious/noExplicitAny: env.AI.run 多态签名，TS 类型对 model 字段强约束
  const result = await (env.AI as any).run(upstreamModel, body, {
    gateway: { id: env.CF_GATEWAY_ID },
    returnRawResponse: true,
  });

  if (result instanceof Response) return result;
  if (result instanceof ReadableStream) {
    return new Response(result, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });
  }
  // 非流式对象结果
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  });
}
