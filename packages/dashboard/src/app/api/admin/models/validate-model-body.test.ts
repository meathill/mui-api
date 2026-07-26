import { describe, expect, it } from 'vitest';
import { validateModelBody } from './route';

/** validateModelBody 合法时返回 null，否则返回一个 400 的 NextResponse。 */
async function errorOf(body: Parameters<typeof validateModelBody>[0]): Promise<string | null> {
  const res = validateModelBody(body);
  if (res === null) return null;
  const json = (await res.json()) as { error: string };
  return json.error;
}

describe('validateModelBody 元数据校验', () => {
  it('不带元数据的 body 照常通过', async () => {
    expect(await errorOf({ id: 'gpt-5', provider: 'openai', inputPrice: 1, outputPrice: 2 })).toBeNull();
  });

  it('metadataJson 为 null / 空串视为未录入', async () => {
    expect(await errorOf({ metadataJson: null })).toBeNull();
    expect(await errorOf({ metadataJson: '' })).toBeNull();
  });

  it('合法元数据通过', async () => {
    const metadataJson = JSON.stringify({
      reasoning: true,
      toolCall: true,
      modalities: { input: ['text'], output: ['text'] },
    });
    expect(await errorOf({ metadataJson })).toBeNull();
  });

  it('非法 JSON 被拦住', async () => {
    expect(await errorOf({ metadataJson: '{oops' })).toBe('模型元数据无效：元数据不是合法 JSON');
  });

  it('未知字段被拦住——拼错 tool_call 不该悄悄写进库', async () => {
    expect(await errorOf({ metadataJson: '{"tool_call":true}' })).toBe('模型元数据无效：未知字段 tool_call');
  });

  it('非法模态取值被拦住', async () => {
    const error = await errorOf({ metadataJson: '{"modalities":{"input":["hologram"],"output":["text"]}}' });
    expect(error).toContain('modalities.input');
  });
});

describe('validateModelBody 上下文字段校验', () => {
  it('正整数通过，null 视为未配置', async () => {
    expect(await errorOf({ contextLength: 200000, maxOutputTokens: 64000 })).toBeNull();
    expect(await errorOf({ contextLength: null, maxOutputTokens: null })).toBeNull();
  });

  it('拒绝小数', async () => {
    expect(await errorOf({ contextLength: 1.5 })).toBe('contextLength 必须为正整数');
  });

  it('拒绝 0 与负数', async () => {
    expect(await errorOf({ contextLength: 0 })).toBe('contextLength 必须为正整数');
    expect(await errorOf({ maxOutputTokens: -1 })).toBe('maxOutputTokens 必须为正整数');
  });
});
