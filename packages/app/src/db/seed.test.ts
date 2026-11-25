import { describe, expect, it } from 'vitest';
import { SEED_MODELS } from './seed';

/** dot/hyphen 归一化：models 表主键以点号为准（如 gemini-3.8-flash），连字符写法由 getById 兜底解析。 */
function normalizeDotHyphen(id: string): string {
  return id.replace(/\./g, '-');
}

describe('模型种子数据', () => {
  it('id 唯一', () => {
    const ids = SEED_MODELS.map((model) => model.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('归一化后的 id 唯一（与 models_normalized_id_unique 索引规则一致）', () => {
    // 真正的保障是 D1 上的唯一索引；这里只让种子错误在提交前暴露，报错能直接指出冲突的 id。
    // 规范化行不能用两种 dot/hyphen 写法同时落库，否则 Playground / 定价页 / GET /v1/models
    // 会把同一个模型显示两遍（2026-11-25 用户反馈）。合法短名 alias（gpt-6.2 → gpt-6.2-sol）
    // 归一化后 id 不同，不受影响。
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const model of SEED_MODELS) {
      const normalized = normalizeDotHyphen(model.id);
      const existing = seen.get(normalized);
      if (existing) {
        duplicates.push(`${existing} <-> ${model.id}`);
      } else {
        seen.set(normalized, model.id);
      }
    }

    expect(duplicates).toEqual([]);
  });
});
