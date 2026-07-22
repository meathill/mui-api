import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { seedApiKey } from './helpers';

async function rpc(apiKey: string | undefined, method: string, params?: any, id: number | string = 1) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return SELF.fetch('http://localhost/mcp', {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
}

describe('MCP server', () => {
  it('未鉴权返回 401', async () => {
    const res = await rpc(undefined, 'initialize');
    expect(res.status).toBe(401);
  });

  it('initialize 返回 protocolVersion 与 serverInfo', async () => {
    const userId = 'mcp-user-1';
    const apiKey = await seedApiKey(userId, 10);
    const res = await rpc(apiKey, 'initialize');
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.result.protocolVersion).toBeDefined();
    expect(body.result.serverInfo.name).toBe('muirouter');
  });

  it('tools/list 返回 5 个工具', async () => {
    const userId = 'mcp-user-2';
    const apiKey = await seedApiKey(userId, 10);
    const res = await rpc(apiKey, 'tools/list');
    const body = (await res.json()) as any;
    expect(body.result.tools).toHaveLength(5);
    const names = body.result.tools.map((t: any) => t.name).sort();
    expect(names).toContain('get_balance');
    expect(names).toContain('list_models');
    expect(names).toContain('image_generation');
  });

  it('tools/call get_balance 返回 spec 字段', async () => {
    const userId = 'mcp-user-3';
    const apiKey = await seedApiKey(userId, 5);
    await env.DB.prepare(
      "INSERT OR REPLACE INTO user (id, name, email, email_verified, image, created_at, updated_at) VALUES (?, 'x', ?, 1, NULL, unixepoch(), unixepoch())",
    )
      .bind(userId, `${userId}@test.com`)
      .run();
    const res = await rpc(apiKey, 'tools/call', { name: 'get_balance', arguments: {} });
    const body = (await res.json()) as any;
    expect(body.result.isError).toBe(false);
    expect(body.result.structuredContent.balance_cents).toBe(500);
  });

  it('tools/call 未知 tool 返回 error', async () => {
    const userId = 'mcp-user-4';
    const apiKey = await seedApiKey(userId, 0);
    const res = await rpc(apiKey, 'tools/call', { name: 'nope', arguments: {} });
    const body = (await res.json()) as any;
    expect(body.error).toBeDefined();
  });
});
