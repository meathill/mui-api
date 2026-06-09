/**
 * Provider 分发：按 provider 选 SDK 调上游，返回原始 Response 透传给客户端
 * - openai          → openai SDK + AI Gateway (CF_AIG_TOKEN 鉴权)
 * - google-ai-studio → @google/genai SDK + AI Gateway (CF_AIG_TOKEN 鉴权)
 * - xiaomi-mimo     → fetch + Xiaomi MiMo OpenAI 兼容接口（直连，不走 AI Gateway）
 * - anthropic       → fetch + AI Gateway compat 端点（Unified Billing 代付，返回 OpenAI 形）
 * - workers-ai      → env.AI.run + gateway option
 */

import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import type { CloudflareBindings } from '../types';

type AnyBody = Record<string, unknown>;
const XIAOMI_MIMO_DEFAULT_BASE_URL = 'https://api.xiaomimimo.com/v1';

function aiGatewayBase(env: CloudflareBindings, provider: string): string {
  return `https://gateway.ai.cloudflare.com/v1/${env.CF_ACCOUNT_ID}/${env.CF_GATEWAY_ID}/${provider}`;
}

export function openAIGatewayBase(env: CloudflareBindings): string {
  return aiGatewayBase(env, 'openai');
}

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

export function xiaomiMiMoBaseURL(env: CloudflareBindings): string {
  return trimTrailingSlashes(env.MIMO_BASE_URL ?? XIAOMI_MIMO_DEFAULT_BASE_URL);
}

/** OpenAI SDK 调用，通过 AI Gateway 转发，CF_AIG_TOKEN 鉴权 */
export async function callOpenAI(env: CloudflareBindings, body: AnyBody): Promise<Response> {
  const client = new OpenAI({
    apiKey: env.CF_AIG_TOKEN,
    baseURL: openAIGatewayBase(env),
  });
  return client.chat.completions.create(body as never).asResponse();
}

/** OpenAI 非 Chat 端点原样转发，用于 Images / Responses 等 SDK 不方便统一抽象的 API。 */
export async function callOpenAIEndpoint(
  env: CloudflareBindings,
  path: string,
  body: BodyInit,
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(`${openAIGatewayBase(env)}${path}`, {
    method: 'POST',
    headers: {
      ...headers,
      Authorization: `Bearer ${env.CF_AIG_TOKEN}`,
    },
    body,
  });
}

/** Xiaomi MiMo 直连 OpenAI 兼容 Chat Completions 接口，不经过 Cloudflare AI Gateway。 */
export async function callXiaomiMiMo(env: CloudflareBindings, body: AnyBody): Promise<Response> {
  if (!env.MIMO_API_KEY) {
    throw new Error('缺少 MIMO_API_KEY，无法调用 Xiaomi MiMo');
  }

  return fetch(`${xiaomiMiMoBaseURL(env)}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.MIMO_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

/**
 * Gemini @google/genai SDK 调用
 * 调用方需按 Gemini 原生 shape 发 body：{ contents, config?, stream? }
 * 返回 Response，流式为 SSE，非流式为 JSON
 */
export async function callGemini(env: CloudflareBindings, upstreamModel: string, body: AnyBody): Promise<Response> {
  const ai = new GoogleGenAI({
    apiKey: env.CF_AIG_TOKEN,
    httpOptions: {
      baseUrl: aiGatewayBase(env, 'google-ai-studio'),
    },
  });

  const isStream = body.stream === true;
  const args = {
    model: upstreamModel,
    contents: body.contents as never,
    config: body.config as never,
  };

  if (isStream) {
    const iter = await ai.models.generateContentStream(args);
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of iter) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
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
  return new Response(JSON.stringify(resp), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Anthropic via CF AI Gateway compat 端点（OpenAI 兼容）—— Unified Billing 代付。
 * 返回 OpenAI chat.completion 形（usage 用 prompt_tokens/completion_tokens）。
 * 鉴权：unified 仅 cf-aig-authorization；带 Authorization 会被 compat 当作 Anthropic key（→401）。
 * BYOK：按 OpenAI 兼容惯例用 Authorization: Bearer <ANTHROPIC_API_KEY>（当前组织被禁用，未实测）。
 */
export async function callAnthropicCompat(
  env: CloudflareBindings,
  upstreamModel: string,
  body: AnyBody,
): Promise<Response> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'cf-aig-authorization': `Bearer ${env.CF_AIG_TOKEN}`,
  };
  if (env.ANTHROPIC_CREDENTIAL_MODE === 'byok') {
    if (!env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_CREDENTIAL_MODE=byok 但缺少 ANTHROPIC_API_KEY');
    }
    headers.authorization = `Bearer ${env.ANTHROPIC_API_KEY}`;
  }
  return fetch(`${aiGatewayBase(env, 'compat')}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...body, model: `anthropic/${upstreamModel}` }),
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
