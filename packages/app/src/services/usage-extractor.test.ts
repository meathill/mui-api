import { describe, expect, it } from 'vitest';
import {
  extractCompatUsage,
  extractCompatStreamUsage,
  extractNativeUsage,
  extractNativeStreamUsage,
} from './usage-extractor';

describe('extractCompatUsage', () => {
  it('提取 OpenAI 格式 usage', () => {
    const data = {
      model: 'gpt-4o',
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    };
    const result = extractCompatUsage(data);
    expect(result).toEqual({ model: 'gpt-4o', inputTokens: 100, outputTokens: 50 });
  });

  it('缺少 usage 返回 null', () => {
    expect(extractCompatUsage({ model: 'gpt-4o' })).toBeNull();
  });

  it('缺少 model 返回 null', () => {
    expect(extractCompatUsage({ usage: { prompt_tokens: 100 } })).toBeNull();
  });

  it('缺少 token 字段时默认 0', () => {
    const result = extractCompatUsage({ model: 'gpt-4o', usage: {} });
    expect(result).toEqual({ model: 'gpt-4o', inputTokens: 0, outputTokens: 0 });
  });
});

describe('extractNativeUsage', () => {
  it('openai 委托给 extractCompatUsage', () => {
    const data = { model: 'gpt-4o', usage: { prompt_tokens: 10, completion_tokens: 20 } };
    expect(extractNativeUsage('openai', data)).toEqual({ model: 'gpt-4o', inputTokens: 10, outputTokens: 20 });
  });

  it('anthropic 提取 input_tokens/output_tokens', () => {
    const data = { model: 'claude-3-opus', usage: { input_tokens: 30, output_tokens: 40 } };
    expect(extractNativeUsage('anthropic', data)).toEqual({
      model: 'claude-3-opus',
      inputTokens: 30,
      outputTokens: 40,
    });
  });

  it('google-ai-studio 提取 usageMetadata', () => {
    const data = {
      modelVersion: 'gemini-1.5-pro',
      usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 60 },
    };
    expect(extractNativeUsage('google-ai-studio', data)).toEqual({
      model: 'gemini-1.5-pro',
      inputTokens: 50,
      outputTokens: 60,
    });
  });

  it('google 缺少 modelVersion 时使用 unknown', () => {
    const data = { usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 } };
    expect(extractNativeUsage('google-ai-studio', data)?.model).toBe('unknown');
  });

  it('未知 provider 返回 null', () => {
    expect(extractNativeUsage('unknown-provider', {})).toBeNull();
  });
});

// 辅助函数：创建 SSE 流式 Response
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

describe('extractCompatStreamUsage', () => {
  it('从 SSE 流中提取最后一个 usage', async () => {
    const response = createSSEResponse([
      'data: {"model":"gpt-4o","choices":[{"delta":{"content":"Hi"}}]}\n\n',
      'data: {"model":"gpt-4o","choices":[{"delta":{"content":"!"}}],"usage":{"prompt_tokens":10,"completion_tokens":5}}\n\n',
      'data: [DONE]\n\n',
    ]);
    const result = await extractCompatStreamUsage(response);
    expect(result).toEqual({ model: 'gpt-4o', inputTokens: 10, outputTokens: 5 });
  });

  it('无 usage 数据返回 null', async () => {
    const response = createSSEResponse(['data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n', 'data: [DONE]\n\n']);
    const result = await extractCompatStreamUsage(response);
    expect(result).toBeNull();
  });

  it('无 body 返回 null', async () => {
    const response = new Response(null);
    const result = await extractCompatStreamUsage(response);
    expect(result).toBeNull();
  });

  it('忽略格式错误的 JSON 行', async () => {
    const response = createSSEResponse([
      'data: {invalid json}\n\n',
      'data: {"model":"gpt-4o","usage":{"prompt_tokens":5,"completion_tokens":3}}\n\n',
      'data: [DONE]\n\n',
    ]);
    const result = await extractCompatStreamUsage(response);
    expect(result).toEqual({ model: 'gpt-4o', inputTokens: 5, outputTokens: 3 });
  });
});

describe('extractNativeStreamUsage', () => {
  it('openai 委托给 extractCompatStreamUsage', async () => {
    const response = createSSEResponse([
      'data: {"model":"gpt-4o","usage":{"prompt_tokens":10,"completion_tokens":5}}\n\n',
      'data: [DONE]\n\n',
    ]);
    const result = await extractNativeStreamUsage('openai', response);
    expect(result).toEqual({ model: 'gpt-4o', inputTokens: 10, outputTokens: 5 });
  });

  it('anthropic 从流中提取 usage', async () => {
    const response = createSSEResponse([
      'data: {"model":"claude-3","usage":{"input_tokens":20,"output_tokens":30}}\n\n',
      'data: [DONE]\n\n',
    ]);
    const result = await extractNativeStreamUsage('anthropic', response);
    expect(result).toEqual({ model: 'claude-3', inputTokens: 20, outputTokens: 30 });
  });

  it('无 body 返回 null', async () => {
    const response = new Response(null);
    const result = await extractNativeStreamUsage('anthropic', response);
    expect(result).toBeNull();
  });
});
