/**
 * AWS Bedrock 直连服务
 * 使用 API Key (Bearer token) 认证，直接调用 Bedrock Runtime API
 *
 * - proxyCompat: OpenAI 格式 ↔ Bedrock Converse API
 * - proxyNative: Anthropic Messages 格式 ↔ Bedrock InvokeModel API
 */

import { parseAwsEventStream } from '../lib/aws-event-stream';

export class BedrockService {
  private baseUrl: string;

  constructor(
    private apiKey: string,
    region: string,
  ) {
    this.baseUrl = `https://bedrock-runtime.${region}.amazonaws.com`;
  }

  /**
   * 兼容模式：接收 OpenAI 格式，返回 OpenAI 格式
   * 内部调用 Bedrock Converse / ConverseStream API
   */
  async proxyCompat(body: Record<string, unknown>, upstreamModel: string, stream: boolean): Promise<Response> {
    const converseBody = openAIToConverse(body);
    const endpoint = stream ? 'converse-stream' : 'converse';
    const url = `${this.baseUrl}/model/${encodeURIComponent(upstreamModel)}/${endpoint}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(converseBody),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Bedrock 错误 (${response.status}): ${error}`);
    }

    if (stream) {
      return new Response(converseStreamToOpenAISSE(response.body!, upstreamModel), {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      });
    }

    const data = (await response.json()) as Record<string, unknown>;
    return Response.json(converseToOpenAI(data, upstreamModel));
  }

  /**
   * 原生模式：接收 Anthropic Messages 格式，返回 Anthropic Messages 格式
   * 内部调用 Bedrock InvokeModel / InvokeModelWithResponseStream API
   */
  async proxyNative(body: Record<string, unknown>, upstreamModel: string, stream: boolean): Promise<Response> {
    const bedrockBody: Record<string, unknown> = { ...body };
    delete bedrockBody.model;
    delete bedrockBody.stream;
    bedrockBody.anthropic_version = 'bedrock-2023-05-31';

    const endpoint = stream ? 'invoke-with-response-stream' : 'invoke';
    const url = `${this.baseUrl}/model/${encodeURIComponent(upstreamModel)}/${endpoint}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(bedrockBody),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Bedrock 错误 (${response.status}): ${error}`);
    }

    if (!stream) {
      // InvokeModel 返回的就是 Anthropic Messages 格式
      return response;
    }

    return new Response(invokeStreamToAnthropicSSE(response.body!), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  }
}

// ==================== OpenAI ↔ Bedrock Converse 格式转换 ====================

/**
 * OpenAI Chat Completions 请求 → Bedrock Converse 请求
 */
function openAIToConverse(body: Record<string, unknown>): Record<string, unknown> {
  const messages = body.messages as Array<Record<string, unknown>>;
  const converseMessages: Array<Record<string, unknown>> = [];
  const systemParts: Array<Record<string, string>> = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemParts.push({ text: String(msg.content ?? '') });
    } else {
      converseMessages.push({
        role: msg.role,
        content: normalizeContentToConverse(msg.content),
      });
    }
  }

  const result: Record<string, unknown> = { messages: converseMessages };
  if (systemParts.length > 0) {
    result.system = systemParts;
  }

  const inferenceConfig: Record<string, unknown> = {};
  if (body.max_tokens != null) inferenceConfig.maxTokens = body.max_tokens;
  if (body.temperature != null) inferenceConfig.temperature = body.temperature;
  if (body.top_p != null) inferenceConfig.topP = body.top_p;
  if (body.stop != null) {
    inferenceConfig.stopSequences = Array.isArray(body.stop) ? body.stop : [body.stop];
  }
  if (Object.keys(inferenceConfig).length > 0) {
    result.inferenceConfig = inferenceConfig;
  }

  return result;
}

/**
 * 标准化消息内容为 Bedrock Converse 格式
 * OpenAI: string | [{type: "text", text: "..."}]
 * Bedrock: [{text: "..."}]
 */
function normalizeContentToConverse(content: unknown): Array<Record<string, unknown>> {
  if (typeof content === 'string') {
    return [{ text: content }];
  }
  if (Array.isArray(content)) {
    return content.map((part: Record<string, unknown>) => {
      if (part.type === 'text') return { text: part.text };
      return { text: String(part.text ?? '') };
    });
  }
  return [{ text: String(content ?? '') }];
}

/**
 * Bedrock Converse 非流式响应 → OpenAI Chat Completions 格式
 */
function converseToOpenAI(data: Record<string, unknown>, model: string): Record<string, unknown> {
  const output = data.output as Record<string, unknown> | undefined;
  const message = output?.message as Record<string, unknown> | undefined;
  const contentBlocks = message?.content as Array<Record<string, string>> | undefined;
  const usage = data.usage as Record<string, number> | undefined;

  const text = contentBlocks?.map((c) => c.text).join('') ?? '';

  return {
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: text },
        finish_reason: mapStopReason(data.stopReason as string),
      },
    ],
    usage: {
      prompt_tokens: usage?.inputTokens ?? 0,
      completion_tokens: usage?.outputTokens ?? 0,
      total_tokens: (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0),
    },
  };
}

function mapStopReason(reason: string): string {
  switch (reason) {
    case 'end_turn':
    case 'stop_sequence':
      return 'stop';
    case 'max_tokens':
      return 'length';
    case 'tool_use':
      return 'tool_calls';
    case 'content_filtered':
      return 'content_filter';
    default:
      return 'stop';
  }
}

// ==================== 流式转换 ====================

/**
 * Bedrock ConverseStream 二进制事件流 → OpenAI SSE 文本流
 */
function converseStreamToOpenAISSE(body: ReadableStream<Uint8Array>, model: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const id = `chatcmpl-${Date.now()}`;

  return new ReadableStream({
    async start(controller) {
      let finishReason = 'stop';

      try {
        for await (const event of parseAwsEventStream(body)) {
          if (event.headers[':message-type'] === 'exception') {
            const payload = JSON.parse(new TextDecoder().decode(event.payload));
            controller.error(new Error(payload.message ?? 'Bedrock 流式异常'));
            return;
          }

          const eventType = event.headers[':event-type'];
          const payload = JSON.parse(new TextDecoder().decode(event.payload));

          if (eventType === 'messageStart') {
            enqueueSSE(controller, encoder, {
              id,
              object: 'chat.completion.chunk',
              model,
              choices: [{ index: 0, delta: { role: payload.role ?? 'assistant' }, finish_reason: null }],
            });
          } else if (eventType === 'contentBlockDelta') {
            const text = payload.delta?.text;
            if (text) {
              enqueueSSE(controller, encoder, {
                id,
                object: 'chat.completion.chunk',
                model,
                choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
              });
            }
          } else if (eventType === 'messageStop') {
            finishReason = mapStopReason(payload.stopReason ?? 'end_turn');
          } else if (eventType === 'metadata') {
            const usage = payload.usage;
            enqueueSSE(controller, encoder, {
              id,
              object: 'chat.completion.chunk',
              model,
              choices: [{ index: 0, delta: {}, finish_reason: finishReason }],
              usage: usage
                ? {
                    prompt_tokens: usage.inputTokens ?? 0,
                    completion_tokens: usage.outputTokens ?? 0,
                    total_tokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
                  }
                : undefined,
            });
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });
}

/**
 * Bedrock InvokeModelWithResponseStream 二进制事件流 → Anthropic SSE 文本流
 * 每个 chunk 事件的 payload 是 {"bytes": "base64string"}，解码后为 Anthropic 事件 JSON
 */
function invokeStreamToAnthropicSSE(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const event of parseAwsEventStream(body)) {
          if (event.headers[':message-type'] === 'exception') {
            const payload = JSON.parse(decoder.decode(event.payload));
            controller.error(new Error(payload.message ?? 'Bedrock 流式异常'));
            return;
          }

          if (event.headers[':event-type'] !== 'chunk') continue;

          const payload = JSON.parse(decoder.decode(event.payload));
          const decoded = atob(payload.bytes);
          const anthropicEvent = JSON.parse(decoded) as Record<string, unknown>;

          controller.enqueue(
            encoder.encode(`event: ${anthropicEvent.type}\ndata: ${JSON.stringify(anthropicEvent)}\n\n`),
          );
        }

        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });
}

function enqueueSSE(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  data: Record<string, unknown>,
): void {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
}
