import { type ExecutionContext, type Context, Hono } from 'hono';
import type { Database } from '../db';
import { models } from '../db';
import { readAuthMiddleware } from '../middleware/read-auth';
import { getBalanceSnapshot, listRecharges, listUsage } from '../services/wallet-query-service';
import {
  buildMethodNotFound,
  buildModernResult,
  detectEra,
  isAllowedOrigin,
  LEGACY_VERSIONS,
  MCP_ERROR_CODES,
  METHOD_HEADER,
  NAME_HEADER,
  negotiateLegacyVersion,
  PROTOCOL_VERSION_HEADER,
  SERVER_INFO,
  SUPPORTED_VERSIONS,
  validateModernRequest,
} from '../services/mcp-protocol';
import type { CloudflareBindings } from '../types';
import openai from './openai';

/**
 * MCP server（双 era，2026-07-28 规范）
 * - modern（2026-07-28）：stateless，请求带 MCP-Protocol-Version / Mcp-Method / Mcp-Name 头
 *   + body `_meta`；实现 server/discover、tools/list、tools/call
 * - legacy（2025-11-25 / 2025-06-18）：initialize 握手路径，兼容 Claude Desktop/Code、
 *   Cursor、Cline 等旧客户端
 * - 鉴权：复用 readAuthMiddleware（Bearer sk-gw-...）
 * - 不引入 @modelcontextprotocol/sdk 的 transport 实现，规避 Node 依赖
 */

interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (env: CloudflareBindings, db: Database, userId: string, args: any) => Promise<unknown>;
}

const tools: ToolDef[] = [
  {
    name: 'get_balance',
    description: '查询当前 API key 所属用户的钱包余额、累计充值与累计消费。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: async (env, db, userId) => getBalanceSnapshot(db, userId, env.KV),
  },
  {
    name: 'get_usage',
    description: '分页查询当前用户的 API 调用消耗明细。',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', minimum: 1, maximum: 100, description: '每页条数，默认 20' },
        cursor: { type: 'string', description: '上一页返回的 next_cursor' },
        model: { type: 'string', description: '按模型 id 过滤' },
        from: { type: 'string', description: 'ISO-8601 起始时间' },
        to: { type: 'string', description: 'ISO-8601 结束时间' },
      },
      additionalProperties: false,
    },
    handler: async (env, db, userId, args) =>
      listUsage(db, userId, {
        limit: args?.limit != null ? String(args.limit) : undefined,
        cursor: args?.cursor,
        model: args?.model,
        from: args?.from,
        to: args?.to,
      }),
  },
  {
    name: 'list_recharges',
    description: '分页查询当前用户的充值记录。',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', minimum: 1, maximum: 100 },
        cursor: { type: 'string' },
      },
      additionalProperties: false,
    },
    handler: async (env, db, userId, args) =>
      listRecharges(db, userId, {
        limit: args?.limit != null ? String(args.limit) : undefined,
        cursor: args?.cursor,
      }),
  },
  {
    name: 'list_models',
    description: '列出 muirouter 当前支持的所有模型及其计价。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: async (_env, db) => {
      const rows = await db.select().from(models);
      return {
        // context_length 让 agent 能自己判断某个模型塞不塞得下当前上下文。
        items: rows.map((m) => ({
          id: m.id,
          provider: m.provider,
          input_price: m.inputPrice,
          output_price: m.outputPrice,
          markup_rate: m.markupRate ?? 1.2,
          display_name: m.displayName,
          context_length: m.contextLength,
        })),
      };
    },
  },
  {
    name: 'image_generation',
    description:
      '通过 muirouter 调用 OpenAI 兼容的图像生成接口。注意：此工具会消耗钱包余额。直接调用 REST `/v1/images/generations` 也可以达到同等效果。',
    inputSchema: {
      type: 'object',
      required: ['model', 'prompt'],
      properties: {
        model: { type: 'string' },
        prompt: { type: 'string' },
        n: { type: 'integer', minimum: 1, maximum: 10 },
        size: { type: 'string' },
        response_format: { type: 'string', enum: ['url', 'b64_json'] },
      },
      additionalProperties: true,
    },
    handler: async () => {
      // 实际派发在 dispatch() 内特殊处理：需要原始 Bearer 转发到子应用，
      // 走完整 authMiddleware（并发 + 计费）。不会走到这里。
      throw new Error('handled in dispatch');
    },
  },
];

const mcp = new Hono<{ Bindings: CloudflareBindings }>();

mcp.post('/', readAuthMiddleware, async (c) => {
  if (!isAllowedOrigin(c.req.header('Origin') ?? null)) {
    return c.json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Origin' } }, 403);
  }

  const userId = c.get('userId');
  const rawAuth = c.req.header('Authorization');

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ jsonrpc: '2.0', id: null, error: { code: MCP_ERROR_CODES.parse, message: 'Parse error' } }, 400);
  }

  const headers = {
    [PROTOCOL_VERSION_HEADER]: c.req.header(PROTOCOL_VERSION_HEADER),
    [METHOD_HEADER]: c.req.header(METHOD_HEADER),
    [NAME_HEADER]: c.req.header(NAME_HEADER),
  };
  const req = body as { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown };

  if (detectEra(headers, req) === 'modern') {
    return handleModern(c, userId, rawAuth, req, headers);
  }
  return c.json(await dispatchLegacy(c.env, c.get('db'), c.executionCtx as ExecutionContext, userId, rawAuth, req));
});

// modern 规范：GET / DELETE 一律 405 Method Not Allowed（旧 HTTP+SSE 传输的 GET 端点已废弃）。
mcp.get('/', (c) => c.json({ error: 'Method Not Allowed' }, 405));
mcp.delete('/', (c) => c.json({ error: 'Method Not Allowed' }, 405));

// ---- modern（2026-07-28，stateless）----

const DISCOVER_INSTRUCTIONS =
  'MuiRouter MCP server: account tools (balance, usage, recharges, models, image generation) for the MuiRouter AI router.';

const TOOLS_TTL_MS = 3_600_000;

async function handleModern(
  c: Context<{ Bindings: CloudflareBindings }>,
  userId: string,
  rawAuth: string | undefined,
  req: { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown },
  headers: Record<string, string | undefined>,
): Promise<Response> {
  const validated = validateModernRequest(headers, req);
  if (!validated.ok) {
    return c.json(validated.body, validated.status as 400);
  }

  const id = req.id;
  // JSON-RPC notification（无 id 字段）：接受并返回 202 空响应。
  if (!('id' in req)) {
    return new Response(null, { status: 202 });
  }

  const method = validated.method;
  switch (method) {
    case 'server/discover':
      return c.json(
        buildModernResult(id, {
          supportedVersions: [...SUPPORTED_VERSIONS],
          capabilities: { tools: {} },
          instructions: DISCOVER_INSTRUCTIONS,
          ttlMs: TOOLS_TTL_MS,
          cacheScope: 'public',
        }),
      );
    case 'tools/list':
      return c.json(
        buildModernResult(id, {
          tools: tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
          ttlMs: TOOLS_TTL_MS,
          cacheScope: 'public',
        }),
      );
    case 'tools/call':
      return c.json(
        await callToolModern(c.env, c.get('db'), c.executionCtx as ExecutionContext, userId, rawAuth, id, req),
      );
    default:
      return c.json(buildMethodNotFound(id, method), 404);
  }
}

async function callToolModern(
  env: CloudflareBindings,
  db: Database,
  ctx: ExecutionContext,
  userId: string,
  rawAuth: string | undefined,
  id: unknown,
  req: { params?: unknown },
): Promise<unknown> {
  const params = req.params as { name?: unknown; arguments?: unknown };
  const name = params?.name;
  const args = (params?.arguments ?? {}) as Record<string, unknown>;
  const tool = tools.find((t) => t.name === name);

  const toResult = (result: unknown, isError: boolean) =>
    buildModernResult(id, {
      content: [{ type: 'text', text: JSON.stringify(result) }],
      structuredContent: result,
      isError,
    });

  if (!tool) {
    return toResult({ error: `Unknown tool: ${String(name)}` }, true);
  }
  try {
    if (tool.name === 'image_generation') {
      if (!rawAuth) {
        return toResult('需要 Authorization header', true);
      }
      const result = await callImageGeneration(env, ctx, rawAuth, args);
      return toResult(result.body, !result.ok);
    }
    const result = await tool.handler(env, db, userId, args);
    return toResult(result, false);
  } catch (e: any) {
    return toResult(e?.message ?? String(e), true);
  }
}

// ---- legacy（2025-11-25 / 2025-06-18，initialize 握手）----

function dispatchLegacy(
  env: CloudflareBindings,
  db: Database,
  ctx: ExecutionContext,
  userId: string,
  rawAuth: string | undefined,
  req: { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown },
): Promise<any> {
  const id = req.id ?? null;
  const method = req.method;

  const ok = (result: unknown) => ({ jsonrpc: '2.0', id, result });
  const err = (code: number, message: string) => ({ jsonrpc: '2.0', id, error: { code, message } });

  if (typeof method !== 'string') {
    return Promise.resolve(err(-32600, 'Invalid Request'));
  }

  switch (method) {
    case 'initialize': {
      const requested = (req.params as Record<string, unknown> | undefined)?.protocolVersion;
      return Promise.resolve(
        ok({
          protocolVersion: negotiateLegacyVersion(requested),
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
        }),
      );
    }
    case 'notifications/initialized':
      return Promise.resolve(ok({}));
    case 'ping':
      return Promise.resolve(ok({}));
    case 'tools/list':
      return Promise.resolve(
        ok({
          tools: tools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        }),
      );
    case 'tools/call':
      return callToolLegacy(env, db, ctx, userId, rawAuth, id, req);
    default:
      return Promise.resolve(err(-32601, `Method not found: ${method}`));
  }
}

async function callToolLegacy(
  env: CloudflareBindings,
  db: Database,
  ctx: ExecutionContext,
  userId: string,
  rawAuth: string | undefined,
  id: unknown,
  req: { params?: unknown },
): Promise<any> {
  const params = req.params as { name?: unknown; arguments?: unknown };
  const name = params?.name;
  const args = (params?.arguments ?? {}) as Record<string, unknown>;
  const tool = tools.find((t) => t.name === name);

  const ok = (result: unknown) => ({ jsonrpc: '2.0', id, result });
  const err = (code: number, message: string) => ({ jsonrpc: '2.0', id, error: { code, message } });

  if (!tool) {
    return err(-32601, `Unknown tool: ${name}`);
  }
  try {
    if (tool.name === 'image_generation') {
      if (!rawAuth) {
        return ok({
          content: [{ type: 'text', text: '需要 Authorization header' }],
          isError: true,
        });
      }
      const result = await callImageGeneration(env, ctx, rawAuth, args);
      return ok({
        content: [{ type: 'text', text: JSON.stringify(result.body) }],
        structuredContent: result.body,
        isError: !result.ok,
      });
    }
    const result = await tool.handler(env, db, userId, args);
    return ok({
      content: [{ type: 'text', text: JSON.stringify(result) }],
      structuredContent: result,
      isError: false,
    });
  } catch (e: any) {
    return ok({
      content: [{ type: 'text', text: e?.message ?? String(e) }],
      isError: true,
    });
  }
}

// ---- 共享 ----

async function callImageGeneration(
  env: CloudflareBindings,
  ctx: ExecutionContext,
  rawAuth: string,
  args: Record<string, unknown>,
): Promise<{ ok: boolean; body: unknown }> {
  // 复用 openai 子应用：内部 fetch 经过完整 authMiddleware（并发 + 计费）
  const req = new Request('http://internal/images/generations', {
    method: 'POST',
    headers: { Authorization: rawAuth, 'content-type': 'application/json' },
    body: JSON.stringify(args ?? {}),
  });
  const res = await openai.fetch(req, env, ctx);
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  return { ok: res.ok, body };
}

export default mcp;
