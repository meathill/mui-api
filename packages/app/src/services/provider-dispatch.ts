/**
 * Provider 分发：按 provider 选 SDK 调上游，返回原始 Response 透传给客户端
 * - openai          → openai SDK + AI Gateway (baseURL)
 * - google-ai-studio → @google/genai SDK + AI Gateway (httpOptions.baseUrl)
 * - 其余 (anthropic / workers-ai / 将来新增) → env.AI.run + gateway option
 */

import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import type { CloudflareBindings } from '../types';

type AnyBody = Record<string, unknown>;

function aiGatewayBase(env: CloudflareBindings, provider: string): string {
  return `https://gateway.ai.cloudflare.com/v1/${env.CF_ACCOUNT_ID}/${env.CF_GATEWAY_ID}/${provider}`;
}

export function openAIGatewayBase(env: CloudflareBindings): string {
  return aiGatewayBase(env, 'openai');
}

/** OpenAI SDK 调用，AI Gateway BYOK 注入真实 key，cf-aig-authorization 鉴权网关 */
export async function callOpenAI(env: CloudflareBindings, body: AnyBody): Promise<Response> {
  const client = new OpenAI({
    apiKey: 'ai-gateway-byok',
    baseURL: openAIGatewayBase(env),
    defaultHeaders: { 'cf-aig-authorization': `Bearer ${env.CF_AIG_TOKEN}` },
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
      'cf-aig-authorization': `Bearer ${env.CF_AIG_TOKEN}`,
    },
    body,
  });
}

/**
 * Gemini @google/genai SDK 调用
 * 调用方需按 Gemini 原生 shape 发 body：{ contents, config?, stream? }
 * 返回 Response，流式为 SSE，非流式为 JSON
 */
export async function callGemini(env: CloudflareBindings, upstreamModel: string, body: AnyBody): Promise<Response> {
  const ai = new GoogleGenAI({
    apiKey: 'ai-gateway-byok',
    httpOptions: {
      baseUrl: aiGatewayBase(env, 'google-ai-studio'),
      headers: { 'cf-aig-authorization': `Bearer ${env.CF_AIG_TOKEN}` },
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
 * env.AI.run 调用（anthropic / workers-ai / 将来的其它 CF 代付费 provider）
 * 调用方需按上游原生 shape 发 body
 * - anthropic/*：{ messages, max_tokens, system?, stream? } — Anthropic Messages 格式
 * - @cf/*：Workers AI 各模型自己的 input schema
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
