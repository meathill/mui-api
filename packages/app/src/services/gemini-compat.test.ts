import { describe, expect, it } from 'vitest';
import {
  findUnsupportedChatFeature,
  toOpenAIChatChunks,
  toOpenAIChatCompletion,
  translateChatRequest,
} from './gemini-compat';

const META = { id: 'chatcmpl-test', created: 1700000000, model: 'gemini-2.5-flash' };

describe('findUnsupportedChatFeature', () => {
  it('标准文本请求返回 null', () => {
    expect(
      findUnsupportedChatFeature({
        messages: [
          { role: 'system', content: 'be nice' },
          { role: 'user', content: [{ type: 'text', text: 'hi' }] },
        ],
      }),
    ).toBeNull();
  });

  it('识别 tools / tool_choice / 图片 content / tool 消息', () => {
    expect(findUnsupportedChatFeature({ tools: [{}], messages: [] })).toBe('tools');
    expect(findUnsupportedChatFeature({ tool_choice: 'auto', messages: [] })).toBe('tool_choice');
    expect(
      findUnsupportedChatFeature({
        messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: 'x' } }] }],
      }),
    ).toBe('content 类型 image_url');
    expect(findUnsupportedChatFeature({ messages: [{ role: 'tool', content: 'x' }] })).toBe('role=tool 消息');
  });

  it('空 tools 数组不算不支持', () => {
    expect(findUnsupportedChatFeature({ tools: [], messages: [] })).toBeNull();
  });
});

describe('translateChatRequest', () => {
  it('messages 翻译为 contents，system 抽为 systemInstruction', () => {
    const { contents, config } = translateChatRequest({
      messages: [
        { role: 'system', content: 'be nice' },
        { role: 'user', content: 'hello' },
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'hi ' },
            { type: 'text', text: 'there' },
          ],
        },
        { role: 'user', content: 'bye' },
      ],
    });
    expect(config.systemInstruction).toBe('be nice');
    expect(contents).toEqual([
      { role: 'user', parts: [{ text: 'hello' }] },
      { role: 'model', parts: [{ text: 'hi there' }] },
      { role: 'user', parts: [{ text: 'bye' }] },
    ]);
  });

  it('参数映射：max_tokens/temperature/top_p/stop', () => {
    const { config } = translateChatRequest({
      messages: [],
      max_tokens: 1024,
      temperature: 0.7,
      top_p: 0.9,
      stop: '\n',
    });
    expect(config).toMatchObject({ maxOutputTokens: 1024, temperature: 0.7, topP: 0.9, stopSequences: ['\n'] });
  });

  it('max_completion_tokens 优先于 max_tokens；stop 数组原样保留', () => {
    const { config } = translateChatRequest({
      messages: [],
      max_tokens: 100,
      max_completion_tokens: 2048,
      stop: ['a', 'b'],
    });
    expect(config.maxOutputTokens).toBe(2048);
    expect(config.stopSequences).toEqual(['a', 'b']);
  });

  it('未传的参数不出现在 config', () => {
    const { config } = translateChatRequest({ messages: [{ role: 'user', content: 'hi' }] });
    expect(config).toEqual({});
  });
});

describe('toOpenAIChatCompletion', () => {
  it('翻译响应文本、finish_reason 与 usage', () => {
    const result = toOpenAIChatCompletion(
      {
        candidates: [
          {
            content: { parts: [{ text: 'think', thought: true }, { text: 'Hello ' }, { text: 'world' }] },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          cachedContentTokenCount: 4,
          candidatesTokenCount: 20,
          thoughtsTokenCount: 5,
          totalTokenCount: 35,
        },
      },
      META,
    );
    expect(result).toEqual({
      id: 'chatcmpl-test',
      object: 'chat.completion',
      created: 1700000000,
      model: 'gemini-2.5-flash',
      choices: [{ index: 0, message: { role: 'assistant', content: 'Hello world' }, finish_reason: 'stop' }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 25,
        total_tokens: 35,
        prompt_tokens_details: { cached_tokens: 4 },
        completion_tokens_details: { reasoning_tokens: 5 },
      },
    });
  });

  it('MAX_TOKENS → length，SAFETY → content_filter', () => {
    const lengthResult = toOpenAIChatCompletion({ candidates: [{ finishReason: 'MAX_TOKENS' }] }, META);
    expect((lengthResult.choices as { finish_reason: string }[])[0].finish_reason).toBe('length');
    const filterResult = toOpenAIChatCompletion({ candidates: [{ finishReason: 'SAFETY' }] }, META);
    expect((filterResult.choices as { finish_reason: string }[])[0].finish_reason).toBe('content_filter');
  });
});

describe('toOpenAIChatChunks', () => {
  it('首个 chunk 带 role，后续只带 content', () => {
    const geminiChunk = { candidates: [{ content: { parts: [{ text: 'Hi' }] } }] };
    const first = toOpenAIChatChunks(geminiChunk, META, true);
    expect(first).toHaveLength(1);
    expect(first[0].object).toBe('chat.completion.chunk');
    expect(first[0].choices).toEqual([{ index: 0, delta: { role: 'assistant', content: 'Hi' }, finish_reason: null }]);

    const next = toOpenAIChatChunks(geminiChunk, META, false);
    expect(next[0].choices).toEqual([{ index: 0, delta: { content: 'Hi' }, finish_reason: null }]);
  });

  it('带 finishReason 的 chunk 拆成文本 chunk + finish chunk（附 usage）', () => {
    const chunks = toOpenAIChatChunks(
      {
        candidates: [{ content: { parts: [{ text: 'end' }] }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 7, totalTokenCount: 10 },
      },
      META,
      false,
    );
    expect(chunks).toHaveLength(2);
    expect(chunks[0].choices).toEqual([{ index: 0, delta: { content: 'end' }, finish_reason: null }]);
    expect(chunks[1].choices).toEqual([{ index: 0, delta: {}, finish_reason: 'stop' }]);
    expect(chunks[1].usage).toMatchObject({ prompt_tokens: 3, completion_tokens: 7, total_tokens: 10 });
  });

  it('无文本且非首个 chunk 时不发空 delta', () => {
    const chunks = toOpenAIChatChunks({ candidates: [{ content: { parts: [] } }] }, META, false);
    expect(chunks).toHaveLength(0);
  });
});
