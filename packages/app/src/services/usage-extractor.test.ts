import { describe, expect, it } from 'vitest';
import { extractStreamUsage, extractUsage } from './usage-extractor';

const zeroCache = { cachedInputTokens: 0, cacheWriteTokens: 0 };

describe('extractUsage', () => {
  it('openai 提取 prompt/completion_tokens', () => {
    const data = { model: 'gpt-4o', usage: { prompt_tokens: 10, completion_tokens: 20 } };
    expect(extractUsage('openai', data)).toEqual({
      model: 'gpt-4o',
      inputTokens: 10,
      outputTokens: 20,
      ...zeroCache,
    });
  });

  it('openai 图片接口提取 input_tokens/output_tokens', () => {
    const data = { model: 'gpt-image-2', usage: { input_tokens: 35, output_tokens: 1056 } };
    expect(extractUsage('openai', data)).toEqual({
      model: 'gpt-image-2',
      inputTokens: 35,
      outputTokens: 1056,
      ...zeroCache,
    });
  });

  it('openai cached_tokens：prompt_tokens 拆出 cached 部分', () => {
    const data = {
      model: 'gpt-5.4',
      usage: {
        prompt_tokens: 1000,
        completion_tokens: 200,
        prompt_tokens_details: { cached_tokens: 800 },
      },
    };
    expect(extractUsage('openai', data)).toEqual({
      model: 'gpt-5.4',
      inputTokens: 200,
      cachedInputTokens: 800,
      cacheWriteTokens: 0,
      outputTokens: 200,
    });
  });

  it('openai Responses API 非流式：input_tokens_details.cached_tokens 拆出 cached 部分', () => {
    const data = {
      model: 'gpt-5.4',
      usage: {
        input_tokens: 1000,
        output_tokens: 200,
        input_tokens_details: { cached_tokens: 700 },
        output_tokens_details: { reasoning_tokens: 50 },
      },
    };
    expect(extractUsage('openai', data)).toEqual({
      model: 'gpt-5.4',
      inputTokens: 300,
      cachedInputTokens: 700,
      cacheWriteTokens: 0,
      outputTokens: 200, // 含 50 reasoning_tokens，已在 output_tokens 里，不额外累加
    });
  });

  it('anthropic 提取 input_tokens/output_tokens', () => {
    const data = { model: 'claude-opus-4.6', usage: { input_tokens: 30, output_tokens: 40 } };
    expect(extractUsage('anthropic', data)).toEqual({
      model: 'claude-opus-4.6',
      inputTokens: 30,
      outputTokens: 40,
      ...zeroCache,
    });
  });

  it('anthropic cache_read + cache_creation 同时提取', () => {
    const data = {
      model: 'claude-sonnet-4.6',
      usage: {
        input_tokens: 100,
        cache_read_input_tokens: 5000,
        cache_creation_input_tokens: 2000,
        output_tokens: 300,
      },
    };
    expect(extractUsage('anthropic', data)).toEqual({
      model: 'claude-sonnet-4.6',
      inputTokens: 100,
      cachedInputTokens: 5000,
      cacheWriteTokens: 2000,
      outputTokens: 300,
    });
  });

  it('google-ai-studio 提取 usageMetadata', () => {
    const data = {
      modelVersion: 'gemini-1.5-pro',
      usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 60 },
    };
    expect(extractUsage('google-ai-studio', data)).toEqual({
      model: 'gemini-1.5-pro',
      inputTokens: 50,
      outputTokens: 60,
      ...zeroCache,
    });
  });

  it('google-ai-studio cachedContentTokenCount：从 promptTokenCount 扣除 cached 部分', () => {
    const data = {
      modelVersion: 'gemini-3.1-pro-preview',
      usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 300, cachedContentTokenCount: 900 },
    };
    expect(extractUsage('google-ai-studio', data)).toEqual({
      model: 'gemini-3.1-pro-preview',
      inputTokens: 300,
      cachedInputTokens: 900,
      cacheWriteTokens: 0,
      outputTokens: 300,
    });
  });

  it('workers-ai 兼容 openai 风格 usage', () => {
    const data = { model: '@cf/qwen/qwen3-30b-a3b-fp8', usage: { prompt_tokens: 5, completion_tokens: 8 } };
    expect(extractUsage('workers-ai', data)).toEqual({
      model: '@cf/qwen/qwen3-30b-a3b-fp8',
      inputTokens: 5,
      outputTokens: 8,
      ...zeroCache,
    });
  });

  it('xiaomi-mimo 兼容 openai 风格 usage', () => {
    const data = { model: 'mimo-v2.5-pro', usage: { prompt_tokens: 11, completion_tokens: 13 } };
    expect(extractUsage('xiaomi-mimo', data)).toEqual({
      model: 'mimo-v2.5-pro',
      inputTokens: 11,
      outputTokens: 13,
      ...zeroCache,
    });
  });

  it('grok 兼容 openai 风格 usage', () => {
    const data = { model: 'grok-4.3', usage: { prompt_tokens: 17, completion_tokens: 23 } };
    expect(extractUsage('grok', data)).toEqual({
      model: 'grok-4.3',
      inputTokens: 17,
      outputTokens: 23,
      ...zeroCache,
    });
  });

  it('grok-image 无 usage 字段时按返回图片数量兜底计费', () => {
    const data = {
      model: 'grok-imagine-image',
      data: [{ url: 'https://example.test/1.png' }, { url: 'https://example.test/2.png' }],
    };
    expect(extractUsage('grok-image', data)).toEqual({
      model: 'grok-imagine-image',
      inputTokens: 0,
      outputTokens: 2,
      ...zeroCache,
    });
  });

  it('grok-image 若响应带 usage 则按标准 openai 形状解析', () => {
    const data = { model: 'grok-imagine-image', usage: { input_tokens: 12, output_tokens: 340 }, data: [{}] };
    expect(extractUsage('grok-image', data)).toEqual({
      model: 'grok-imagine-image',
      inputTokens: 12,
      outputTokens: 340,
      ...zeroCache,
    });
  });

  it('grok-image 返回空 data 数组时视为无用量', () => {
    expect(extractUsage('grok-image', { model: 'grok-imagine-image', data: [] })).toBeNull();
  });

  it('缺 usage 返回 null', () => {
    expect(extractUsage('openai', { model: 'gpt-4o' })).toBeNull();
  });

  it('未知 provider 返回 null', () => {
    expect(extractUsage('unknown-provider', {})).toBeNull();
  });
});

function createSSEResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(stream);
}

describe('extractStreamUsage', () => {
  it('openai：尾 chunk 带 usage', async () => {
    const response = createSSEResponse([
      'data: {"model":"gpt-4o","choices":[{"delta":{"content":"Hi"}}]}\n\n',
      'data: {"model":"gpt-4o","choices":[{"delta":{"content":"!"}}],"usage":{"prompt_tokens":10,"completion_tokens":5}}\n\n',
      'data: [DONE]\n\n',
    ]);
    const result = await extractStreamUsage('openai', response);
    expect(result).toEqual({ model: 'gpt-4o', inputTokens: 10, outputTokens: 5, ...zeroCache });
  });

  it('openai 流式：尾 chunk 带 cached_tokens', async () => {
    const response = createSSEResponse([
      'data: {"model":"gpt-5.4","choices":[{"delta":{"content":"Hi"}}]}\n\n',
      'data: {"model":"gpt-5.4","choices":[],"usage":{"prompt_tokens":1000,"completion_tokens":50,"prompt_tokens_details":{"cached_tokens":700}}}\n\n',
      'data: [DONE]\n\n',
    ]);
    const result = await extractStreamUsage('openai', response);
    expect(result).toEqual({
      model: 'gpt-5.4',
      inputTokens: 300,
      cachedInputTokens: 700,
      cacheWriteTokens: 0,
      outputTokens: 50,
    });
  });

  it('anthropic：message_start + message_delta 合并出 usage', async () => {
    const response = createSSEResponse([
      'data: {"type":"message_start","message":{"model":"claude-opus-4.6","usage":{"input_tokens":12}}}\n\n',
      'data: {"type":"content_block_delta","delta":{"text":"hi"}}\n\n',
      'data: {"type":"message_delta","usage":{"output_tokens":7}}\n\n',
      'data: {"type":"message_stop"}\n\n',
    ]);
    const result = await extractStreamUsage('anthropic', response);
    expect(result).toEqual({ model: 'claude-opus-4.6', inputTokens: 12, outputTokens: 7, ...zeroCache });
  });

  it('anthropic 流式：message_start 带 cache_read + cache_creation', async () => {
    const response = createSSEResponse([
      'data: {"type":"message_start","message":{"model":"claude-sonnet-4.6","usage":{"input_tokens":15,"cache_read_input_tokens":4000,"cache_creation_input_tokens":1500}}}\n\n',
      'data: {"type":"message_delta","usage":{"output_tokens":42}}\n\n',
      'data: {"type":"message_stop"}\n\n',
    ]);
    const result = await extractStreamUsage('anthropic', response);
    expect(result).toEqual({
      model: 'claude-sonnet-4.6',
      inputTokens: 15,
      cachedInputTokens: 4000,
      cacheWriteTokens: 1500,
      outputTokens: 42,
    });
  });

  it('google-ai-studio：每个 chunk 都有 usageMetadata，取最新', async () => {
    const response = createSSEResponse([
      'data: {"modelVersion":"gemini-2.5-flash","usageMetadata":{"promptTokenCount":8,"candidatesTokenCount":2}}\n\n',
      'data: {"modelVersion":"gemini-2.5-flash","usageMetadata":{"promptTokenCount":8,"candidatesTokenCount":15}}\n\n',
      'data: [DONE]\n\n',
    ]);
    const result = await extractStreamUsage('google-ai-studio', response);
    expect(result).toEqual({ model: 'gemini-2.5-flash', inputTokens: 8, outputTokens: 15, ...zeroCache });
  });

  it('xiaomi-mimo：按 openai SSE usage 提取', async () => {
    const response = createSSEResponse([
      'data: {"model":"mimo-v2.5-pro","choices":[{"delta":{"content":"Hi"}}]}\n\n',
      'data: {"model":"mimo-v2.5-pro","choices":[],"usage":{"prompt_tokens":21,"completion_tokens":34}}\n\n',
      'data: [DONE]\n\n',
    ]);
    const result = await extractStreamUsage('xiaomi-mimo', response);
    expect(result).toEqual({ model: 'mimo-v2.5-pro', inputTokens: 21, outputTokens: 34, ...zeroCache });
  });

  it('grok：按 openai SSE usage 提取', async () => {
    const response = createSSEResponse([
      'data: {"model":"grok-4.3","choices":[{"delta":{"content":"Hi"}}]}\n\n',
      'data: {"model":"grok-4.3","choices":[],"usage":{"prompt_tokens":19,"completion_tokens":27}}\n\n',
      'data: [DONE]\n\n',
    ]);
    const result = await extractStreamUsage('grok', response);
    expect(result).toEqual({ model: 'grok-4.3', inputTokens: 19, outputTokens: 27, ...zeroCache });
  });

  it('openai Responses API 流式：终态事件 response.completed 嵌套 usage', async () => {
    const response = createSSEResponse([
      'data: {"type":"response.created","response":{"id":"resp_1","status":"in_progress"}}\n\n',
      'data: {"type":"response.output_text.delta","delta":"Hi"}\n\n',
      'data: {"type":"response.completed","response":{"id":"resp_1","model":"gpt-5.4","usage":{"input_tokens":1000,"output_tokens":50,"input_tokens_details":{"cached_tokens":700},"output_tokens_details":{"reasoning_tokens":10}}}}\n\n',
    ]);
    const result = await extractStreamUsage('openai', response);
    expect(result).toEqual({
      model: 'gpt-5.4',
      inputTokens: 300,
      cachedInputTokens: 700,
      cacheWriteTokens: 0,
      outputTokens: 50,
    });
  });

  it('openai Responses API 流式：仅有非终态事件（无 usage）返回 null', async () => {
    const response = createSSEResponse([
      'data: {"type":"response.created","response":{"id":"resp_2","status":"in_progress"}}\n\n',
      'data: {"type":"response.in_progress","response":{"id":"resp_2","status":"in_progress"}}\n\n',
    ]);
    const result = await extractStreamUsage('openai', response);
    expect(result).toBeNull();
  });

  it('无 body 返回 null', async () => {
    const response = new Response(null);
    expect(await extractStreamUsage('openai', response)).toBeNull();
  });

  it('全程无 usage 返回 null', async () => {
    const response = createSSEResponse(['data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n', 'data: [DONE]\n\n']);
    expect(await extractStreamUsage('openai', response)).toBeNull();
  });

  it('忽略格式错误的 JSON 行', async () => {
    const response = createSSEResponse([
      'data: {invalid json}\n\n',
      'data: {"model":"gpt-4o","usage":{"prompt_tokens":5,"completion_tokens":3}}\n\n',
      'data: [DONE]\n\n',
    ]);
    const result = await extractStreamUsage('openai', response);
    expect(result).toEqual({ model: 'gpt-4o', inputTokens: 5, outputTokens: 3, ...zeroCache });
  });
});
