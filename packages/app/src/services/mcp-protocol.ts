/**
 * MCP 协议纯逻辑层：协议版本常量、请求 era 检测、modern（2026-07-28）头校验与结果构造。
 * 不依赖 Hono / DB，便于单测；工具定义与传输层留在 routes/mcp.ts。
 *
 * 双 era 设计（规范 Versioning and Compatibility）：
 * - modern：请求带 MCP-Protocol-Version 头 + body `_meta`，无状态逐请求鉴权版本
 * - legacy：客户端发 initialize 握手，按协商的 legacy 版本（2025-11-25 / 2025-06-18）服务
 */

export const PROTOCOL_VERSION_2026_07_28 = '2026-07-28';
export const PROTOCOL_VERSION_2025_11_25 = '2025-11-25';
export const PROTOCOL_VERSION_2025_06_18 = '2025-06-18';

/** 服务器支持的全部协议版本（modern + legacy） */
export const SUPPORTED_VERSIONS = [
  PROTOCOL_VERSION_2026_07_28,
  PROTOCOL_VERSION_2025_11_25,
  PROTOCOL_VERSION_2025_06_18,
] as const;

/** legacy（initialize 握手）路径可协商的版本 */
export const LEGACY_VERSIONS = [PROTOCOL_VERSION_2025_11_25, PROTOCOL_VERSION_2025_06_18] as const;

export const SERVER_INFO = { name: 'muirouter', version: '1.0.0' } as const;

/** JSON-RPC / MCP 规范错误码（-32020 ~ -32099 为 MCP 保留段） */
export const MCP_ERROR_CODES = {
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  headerMismatch: -32020,
  missingRequiredClientCapability: -32021,
  unsupportedProtocolVersion: -32022,
} as const;

/** `_meta` 规范字段名（io.modelcontextprotocol/* 命名空间） */
export const MCP_META_KEYS = {
  protocolVersion: 'io.modelcontextprotocol/protocolVersion',
  clientCapabilities: 'io.modelcontextprotocol/clientCapabilities',
  clientInfo: 'io.modelcontextprotocol/clientInfo',
  serverInfo: 'io.modelcontextprotocol/serverInfo',
} as const;

/** Streamable HTTP 必填请求头（SEP-2243） */
export const PROTOCOL_VERSION_HEADER = 'mcp-protocol-version';
export const METHOD_HEADER = 'mcp-method';
export const NAME_HEADER = 'mcp-name';

export type McpEra = 'modern' | 'legacy';

/** MCP Header 值可能用 Base64 sentinel（=?base64?xxx?=）编码，按规范解码后再与 body 比对。 */
export function decodeMcpHeaderValue(value: string): string {
  const match = /^=\?base64\?(.+)\?=$/.exec(value);
  if (!match) {
    return value;
  }
  try {
    return atob(match[1]);
  } catch {
    return value;
  }
}

interface McpRequestBody {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  params?: unknown;
}

/**
 * 判断请求属于哪个 era：
 * - 带 MCP-Protocol-Version 头 → modern
 * - body params._meta 携带 protocolVersion → modern（缺头的畸形请求，由校验层拒绝）
 * - 其余（含 initialize）→ legacy
 */
export function detectEra(headers: Record<string, string | undefined>, body: McpRequestBody): McpEra {
  if (headers[PROTOCOL_VERSION_HEADER] !== undefined) {
    return 'modern';
  }
  const meta = (body.params as Record<string, unknown> | undefined)?.['_meta'];
  if (meta && typeof meta === 'object' && MCP_META_KEYS.protocolVersion in meta) {
    return 'modern';
  }
  return 'legacy';
}

export interface ModernValidationOk {
  ok: true;
  method: string;
  name?: string;
}

export interface ModernValidationError {
  ok: false;
  status: number;
  body: unknown;
}

/**
 * modern 请求头校验（规范 Streamable HTTP Server Validation）：
 * - MCP-Protocol-Version 必须存在且与 body `_meta.io.modelcontextprotocol/protocolVersion` 一致
 * - 版本必须在支持列表内，否则 UnsupportedProtocolVersionError（-32022）
 * - Mcp-Method 必须存在且等于 body.method
 * - tools/call 等带 name 的方法必须提供 Mcp-Name（含 base64 解码后比对）
 * 校验失败统一 400 + -32020 HeaderMismatch。
 */
export function validateModernRequest(
  headers: Record<string, string | undefined>,
  body: McpRequestBody,
): ModernValidationOk | ModernValidationError {
  const headerVersion = headers[PROTOCOL_VERSION_HEADER];
  const meta = (body.params as Record<string, unknown> | undefined)?.['_meta'] as Record<string, unknown> | undefined;
  const bodyVersion = meta?.[MCP_META_KEYS.protocolVersion];
  const method = body.method;
  const params = body.params as Record<string, unknown> | undefined;
  const name =
    typeof params?.name === 'string' ? params.name : typeof params?.uri === 'string' ? params.uri : undefined;

  const headerMismatch = (message: string): ModernValidationError => ({
    ok: false,
    status: 400,
    body: {
      jsonrpc: '2.0',
      id: body.id ?? null,
      error: { code: MCP_ERROR_CODES.headerMismatch, message },
    },
  });

  if (typeof headerVersion !== 'string' || headerVersion !== bodyVersion) {
    return headerMismatch('Header mismatch: MCP-Protocol-Version does not match body _meta');
  }
  if (!(SUPPORTED_VERSIONS as readonly string[]).includes(headerVersion)) {
    return {
      ok: false,
      status: 400,
      body: {
        jsonrpc: '2.0',
        id: body.id ?? null,
        error: {
          code: MCP_ERROR_CODES.unsupportedProtocolVersion,
          message: 'Unsupported protocol version',
          data: { supported: [...SUPPORTED_VERSIONS], requested: headerVersion },
        },
      },
    };
  }
  if (typeof method !== 'string' || headers[METHOD_HEADER] !== method) {
    return headerMismatch('Header mismatch: Mcp-Method does not match body method');
  }
  if (
    (method === 'tools/call' || method === 'resources/read' || method === 'prompts/get') &&
    typeof name === 'string' &&
    (typeof headers[NAME_HEADER] !== 'string' || decodeMcpHeaderValue(headers[NAME_HEADER] as string) !== name)
  ) {
    return headerMismatch('Header mismatch: Mcp-Name does not match body name');
  }

  return { ok: true, method, name };
}

/** modern 结果统一构造：resultType: 'complete' + 结果字段 + _meta.serverInfo。 */
export function buildModernResult(id: unknown, result: Record<string, unknown>): unknown {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    result: {
      resultType: 'complete',
      ...result,
      _meta: { [MCP_META_KEYS.serverInfo]: SERVER_INFO },
    },
  };
}

/** modern 未知方法：HTTP 404 + -32601，与 legacy 的 200 区分（规范明确要求）。 */
export function buildMethodNotFound(id: unknown, method: string): unknown {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    error: { code: MCP_ERROR_CODES.methodNotFound, message: `Method not found: ${method}` },
  };
}

/**
 * legacy initialize 版本协商：客户端请求的版本在支持列表内则回该版本，
 * 否则回服务器支持的最高 legacy 版本（2025-11-25）。
 */
export function negotiateLegacyVersion(requested: unknown): string {
  if (typeof requested === 'string' && (LEGACY_VERSIONS as readonly string[]).includes(requested)) {
    return requested;
  }
  return PROTOCOL_VERSION_2025_11_25;
}

/** Origin 校验（DNS rebinding 防护，规范 MUST）：https 或本机地址允许，其余拒绝。 */
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) {
    return true;
  }
  try {
    const url = new URL(origin);
    return (
      url.protocol === 'https:' ||
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '[::1]'
    );
  } catch {
    return false;
  }
}
