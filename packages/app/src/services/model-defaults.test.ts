import { describe, expect, it } from 'vitest';
import { resolveModelId } from '@muirouter/shared-db/integration';

describe('中心默认模型', () => {
  it('显式请求、项目、全局依次覆盖', () => {
    expect(resolveModelId('explicit', 'chat', { chat: 'project' }, { chat: 'global' })).toBe('explicit');
    expect(resolveModelId('default', 'chat', { chat: 'project' }, { chat: 'global' })).toBe('project');
    expect(resolveModelId(undefined, 'chat', {}, { chat: 'global' })).toBe('global');
  });
  it('媒体能力不会误用文本默认', () => {
    expect(() => resolveModelId('default', 'tts', {}, { chat: 'text-only' })).toThrow();
    expect(resolveModelId('default', 'tts', {}, { tts: 'speech' })).toBe('speech');
  });
  it('拒绝非法 model，而不是静默替换', () => {
    expect(() => resolveModelId(42, 'chat')).toThrow();
  });
});
