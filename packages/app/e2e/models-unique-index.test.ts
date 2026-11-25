import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

const ADMIN_SECRET = 'test-admin-secret';

describe('models 归一化 ID 唯一约束（models_normalized_id_unique）', () => {
  it('直接插入 dot 形式的重复行被数据库拒绝', async () => {
    await expect(
      env.DB.prepare(
        "INSERT INTO models (id, provider, upstream_model_id) VALUES ('claude-haiku-5.5', 'anthropic', 'claude-haiku-5-5')",
      ).run(),
    ).rejects.toThrow(/UNIQUE constraint failed/);
  });

  it('共享同一 upstream 的合法短名 alias 不受影响', async () => {
    const rows = await env.DB.prepare("SELECT id FROM models WHERE id IN ('gpt-6.2', 'gpt-6.2-sol') ORDER BY id").all<{
      id: string;
    }>();

    expect(rows.results.map((row) => row.id)).toEqual(['gpt-6.2', 'gpt-6.2-sol']);
  });

  it('POST /admin/models 创建 dot 等价写法返回 400 并说明冲突原因', async () => {
    const res = await SELF.fetch('http://localhost/admin/models', {
      method: 'POST',
      headers: { 'X-Admin-Secret': ADMIN_SECRET, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'claude-haiku-5.5',
        provider: 'anthropic',
        upstreamModelId: 'claude-haiku-5-5',
        inputPrice: 0.1,
        outputPrice: 0.5,
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json<{ error: { message: string } }>();
    expect(body.error.message).toContain('点号/连字符');
  });
});
