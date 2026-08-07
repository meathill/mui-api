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

const MODERN_VERSION = '2026-07-28';

/** modern（2026-07-28 stateless）请求：带头 + body _meta */
async function modernRpc(
  apiKey: string,
  method: string,
  params?: any,
  id: number | string = 1,
  headers: Record<string, string> = {},
  version: string = MODERN_VERSION,
) {
  const body = { jsonrpc: '2.0', id, method, params };
  const meta = params?._meta ?? {};
  body.params = { ...params, _meta: { 'io.modelcontextprotocol/protocolVersion': version, ...meta } };
  return SELF.fetch('http://localhost/mcp', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'MCP-Protocol-Version': version,
      'Mcp-Method': method,
      ...(params?.name ? { 'Mcp-Name': params.name } : {}),
      ...headers,
    },
    body: JSON.stringify(body),
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

  it('legacy initialize 按客户端请求版本协商（2025-11-25）', async () => {
    const userId = 'mcp-user-legacy-1';
    const apiKey = await seedApiKey(userId, 10);
    const res = await rpc(apiKey, 'initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: {} });
    const body = (await res.json()) as any;
    expect(body.result.protocolVersion).toBe('2025-11-25');
  });

  it('legacy initialize 未知版本回退到最高 legacy 版本', async () => {
    const userId = 'mcp-user-legacy-2';
    const apiKey = await seedApiKey(userId, 10);
    const res = await rpc(apiKey, 'initialize', { protocolVersion: '2024-11-05' });
    const body = (await res.json()) as any;
    expect(body.result.protocolVersion).toBe('2025-11-25');
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

describe('MCP server modern（2026-07-28）', () => {
  it('GET /mcp 返回 405', async () => {
    const res = await SELF.fetch('http://localhost/mcp');
    expect(res.status).toBe(405);
  });

  it('server/discover 返回 supportedVersions 与 capabilities', async () => {
    const apiKey = await seedApiKey('mcp-modern-1', 10);
    const res = await modernRpc(apiKey, 'server/discover');
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.result.resultType).toBe('complete');
    expect(body.result.supportedVersions).toContain(MODERN_VERSION);
    expect(body.result.capabilities.tools).toBeDefined();
    expect(body.result._meta['io.modelcontextprotocol/serverInfo'].name).toBe('muirouter');
  });

  it('tools/list 返回 resultType、ttlMs、cacheScope 与 serverInfo', async () => {
    const apiKey = await seedApiKey('mcp-modern-2', 10);
    const res = await modernRpc(apiKey, 'tools/list');
    const body = (await res.json()) as any;
    expect(body.result.resultType).toBe('complete');
    expect(body.result.ttlMs).toBeTypeOf('number');
    expect(body.result.cacheScope).toBe('public');
    expect(body.result.tools).toHaveLength(5);
    expect(body.result._meta['io.modelcontextprotocol/serverInfo']).toBeDefined();
  });

  it('tools/call get_balance 带 Mcp-Name 正常返回', async () => {
    const userId = 'mcp-modern-3';
    const apiKey = await seedApiKey(userId, 5);
    await env.DB.prepare(
      "INSERT OR REPLACE INTO user (id, name, email, email_verified, image, created_at, updated_at) VALUES (?, 'x', ?, 1, NULL, unixepoch(), unixepoch())",
    )
      .bind(userId, `${userId}@test.com`)
      .run();
    const res = await modernRpc(apiKey, 'tools/call', { name: 'get_balance', arguments: {} });
    const body = (await res.json()) as any;
    expect(body.result.isError).toBe(false);
    expect(body.result.structuredContent.balance_cents).toBe(500);
    expect(body.result.resultType).toBe('complete');
  });

  it('不支持的协议版本 → 400 UnsupportedProtocolVersion', async () => {
    const apiKey = await seedApiKey('mcp-modern-4', 0);
    const res = await modernRpc(apiKey, 'tools/list', {}, 1, {}, '1900-01-01');
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe(-32022);
    expect(body.error.data.supported).toContain(MODERN_VERSION);
  });

  it('Mcp-Method 与 body 不一致 → 400 HeaderMismatch', async () => {
    const apiKey = await seedApiKey('mcp-modern-5', 0);
    const res = await modernRpc(apiKey, 'tools/list', {}, 1, { 'Mcp-Method': 'tools/call' });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe(-32020);
  });

  it('tools/call 缺 Mcp-Name → 400 HeaderMismatch', async () => {
    const apiKey = await seedApiKey('mcp-modern-6', 0);
    const res = await SELF.fetch('http://localhost/mcp', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        'MCP-Protocol-Version': MODERN_VERSION,
        'Mcp-Method': 'tools/call',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'get_balance',
          arguments: {},
          _meta: { 'io.modelcontextprotocol/protocolVersion': MODERN_VERSION },
        },
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe(-32020);
  });

  it('JSON-RPC notification → 202 空响应', async () => {
    const apiKey = await seedApiKey('mcp-modern-7', 0);
    const res = await SELF.fetch('http://localhost/mcp', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        'MCP-Protocol-Version': MODERN_VERSION,
        'Mcp-Method': 'notifications/cancelled',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/cancelled',
        params: { _meta: { 'io.modelcontextprotocol/protocolVersion': MODERN_VERSION } },
      }),
    });
    expect(res.status).toBe(202);
    expect(await res.text()).toBe('');
  });

  it('未知方法 → 404 + -32601', async () => {
    const apiKey = await seedApiKey('mcp-modern-8', 0);
    const res = await modernRpc(apiKey, 'ping');
    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe(-32601);
  });

  it('非法 Origin → 403', async () => {
    const apiKey = await seedApiKey('mcp-modern-9', 0);
    const res = await modernRpc(apiKey, 'tools/list', {}, 1, { Origin: 'http://evil.example.com' });
    expect(res.status).toBe(403);
  });
});
