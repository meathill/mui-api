import { describe, expect, it } from 'vitest';
import { normalizeChatBody } from './chat-body-normalize';

describe('normalizeChatBody', () => {
  describe('openai', () => {
    it('把 max_tokens 改写为 max_completion_tokens', () => {
      const result = normalizeChatBody({ model: 'gpt-5', max_tokens: 1024 }, 'openai');
      expect(result).toEqual({ model: 'gpt-5', max_completion_tokens: 1024 });
    });

    it('两者都传时保留 max_completion_tokens 并删除 max_tokens', () => {
      const result = normalizeChatBody({ max_tokens: 1024, max_completion_tokens: 2048 }, 'openai');
      expect(result).toEqual({ max_completion_tokens: 2048 });
    });

    it('没有 max_tokens 时原样返回', () => {
      const body = { model: 'gpt-5', messages: [] };
      expect(normalizeChatBody(body, 'openai')).toBe(body);
    });
  });

  describe('grok', () => {
    it('删除推理模型不支持的 stop / presence_penalty / frequency_penalty', () => {
      const result = normalizeChatBody(
        { model: 'grok-4.5', stop: ['\n'], presence_penalty: 0.5, frequency_penalty: 0.5, max_tokens: 100 },
        'grok',
      );
      expect(result).toEqual({ model: 'grok-4.5', max_tokens: 100 });
    });

    it('没有不支持参数时原样返回', () => {
      const body = { model: 'grok-4.5', max_tokens: 100 };
      expect(normalizeChatBody(body, 'grok')).toBe(body);
    });
  });

  it('其他 provider 原样返回（含 max_tokens 与 stop）', () => {
    const body = { model: 'kimi-k3', max_tokens: 1024, stop: ['\n'] };
    expect(normalizeChatBody(body, 'moonshot')).toBe(body);
    expect(normalizeChatBody(body, 'workers-ai')).toBe(body);
  });
});
