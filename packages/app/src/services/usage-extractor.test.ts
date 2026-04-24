import { describe, expect, it } from 'vitest';
import { extractStreamUsage, extractUsage } from './usage-extractor';

describe('extractUsage', () => {
  it('openai 提取 prompt/completion_tokens', () => {
    const data = { model: 'gpt-4o', usage: { prompt_tokens: 10, completion_tokens: 20 } };
    expect(extractUsage('openai', data)).toEqual({ model: 'gpt-4o', inputTokens: 10, outputTokens: 20 });
  });

  it('openai 图片接口提取 input_tokens/output_tokens', () => {
    const data = { model: 'gpt-image-2', usage: { input_tokens: 35, output_tokens: 1056 } };
    expect(extractUsage('openai', data)).toEqual({ model: 'gpt-image-2', inputTokens: 35, outputTokens: 1056 });
  });

  it('anthropic 提取 input_tokens/output_tokens', () => {
    const data = { model: 'claude-opus-4.6', usage: { input_tokens: 30, output_tokens: 40 } };
    expect(extractUsage('anthropic', data)).toEqual({
      model: 'claude-opus-4.6',
      inputTokens: 30,
      outputTokens: 40,
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
    });
  });

  it('workers-ai 兼容 openai 风格 usage', () => {
    const data = { model: '@cf/qwen/qwen3-30b-a3b-fp8', usage: { prompt_tokens: 5, completion_tokens: 8 } };
    expect(extractUsage('workers-ai', data)).toEqual({
      model: '@cf/qwen/qwen3-30b-a3b-fp8',
      inputTokens: 5,
      outputTokens: 8,
    });
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
    expect(result).toEqual({ model: 'gpt-4o', inputTokens: 10, outputTokens: 5 });
  });

  it('anthropic：message_start + message_delta 合并出 usage', async () => {
    const response = createSSEResponse([
      'data: {"type":"message_start","message":{"model":"claude-opus-4.6","usage":{"input_tokens":12}}}\n\n',
      'data: {"type":"content_block_delta","delta":{"text":"hi"}}\n\n',
      'data: {"type":"message_delta","usage":{"output_tokens":7}}\n\n',
      'data: {"type":"message_stop"}\n\n',
    ]);
    const result = await extractStreamUsage('anthropic', response);
    expect(result).toEqual({ model: 'claude-opus-4.6', inputTokens: 12, outputTokens: 7 });
  });

  it('google-ai-studio：每个 chunk 都有 usageMetadata，取最新', async () => {
    const response = createSSEResponse([
      'data: {"modelVersion":"gemini-2.5-flash","usageMetadata":{"promptTokenCount":8,"candidatesTokenCount":2}}\n\n',
      'data: {"modelVersion":"gemini-2.5-flash","usageMetadata":{"promptTokenCount":8,"candidatesTokenCount":15}}\n\n',
      'data: [DONE]\n\n',
    ]);
    const result = await extractStreamUsage('google-ai-studio', response);
    expect(result).toEqual({ model: 'gemini-2.5-flash', inputTokens: 8, outputTokens: 15 });
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
    expect(result).toEqual({ model: 'gpt-4o', inputTokens: 5, outputTokens: 3 });
  });
});
