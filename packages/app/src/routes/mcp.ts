import { type ExecutionContext, Hono } from 'hono';
import type { Database } from '../db';
import { models } from '../db';
import { readAuthMiddleware } from '../middleware/read-auth';
import { getBalanceSnapshot, listRecharges, listUsage } from '../services/wallet-query-service';
import type { CloudflareBindings } from '../types';
import openai from './openai';

/**
 * 极简 MCP server (Streamable HTTP / JSON-RPC 2.0)
 * - 无状态：每个请求都是独立 JSON-RPC 调用
 * - 鉴权：复用 readAuthMiddleware（Bearer sk-gw-...）
 * - 暴露 5 个工具，全部沿用 service 层
 *
 * 不引入 @modelcontextprotocol/sdk 的 transport 实现，规避 Node 依赖；
 * 只实现 initialize/tools/list/tools/call 三个核心方法，足够覆盖
 * Claude Desktop/Code、Cursor 等主流 client 的 streamable-http 接入。
 */

const PROTOCOL_VERSION = '2025-06-18';
const SERVER_INFO = { name: 'muirouter', version: '1.0.0' };

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
  const userId = c.get('userId');
  const rawAuth = c.req.header('Authorization');
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
  }
  return c.json(await dispatch(c.env, c.get('db'), c.executionCtx as ExecutionContext, userId, rawAuth, body));
});

// MCP discovery endpoint (some clients GET /mcp first)
mcp.get('/', (c) =>
  c.json({
    name: SERVER_INFO.name,
    version: SERVER_INFO.version,
    protocol_version: PROTOCOL_VERSION,
    transport: 'streamable-http',
  }),
);

async function callImageGeneration(
  env: CloudflareBindings,
  ctx: ExecutionContext,
  rawAuth: string,
  args: any,
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

async function dispatch(
  env: CloudflareBindings,
  db: Database,
  ctx: ExecutionContext,
  userId: string,
  rawAuth: string | undefined,
  req: any,
): Promise<any> {
  const id = req?.id ?? null;
  const method = req?.method;

  const ok = (result: unknown) => ({ jsonrpc: '2.0', id, result });
  const err = (code: number, message: string) => ({ jsonrpc: '2.0', id, error: { code, message } });

  if (typeof method !== 'string') return err(-32600, 'Invalid Request');

  switch (method) {
    case 'initialize':
      return ok({
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
      });
    case 'notifications/initialized':
      return ok({});
    case 'ping':
      return ok({});
    case 'tools/list':
      return ok({
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      });
    case 'tools/call': {
      const name = req?.params?.name;
      const args = req?.params?.arguments ?? {};
      const tool = tools.find((t) => t.name === name);
      if (!tool) return err(-32601, `Unknown tool: ${name}`);
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
    default:
      return err(-32601, `Method not found: ${method}`);
  }
}

export default mcp;
