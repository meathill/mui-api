import { describe, expect, it } from 'vitest';
import {
  buildMethodNotFound,
  buildModernResult,
  decodeMcpHeaderValue,
  detectEra,
  isAllowedOrigin,
  LEGACY_VERSIONS,
  MCP_ERROR_CODES,
  MCP_META_KEYS,
  METHOD_HEADER,
  NAME_HEADER,
  negotiateLegacyVersion,
  PROTOCOL_VERSION_2025_11_25,
  PROTOCOL_VERSION_HEADER,
  SUPPORTED_VERSIONS,
  validateModernRequest,
} from './mcp-protocol';

describe('detectEra', () => {
  it('带 MCP-Protocol-Version 头 → modern', () => {
    expect(detectEra({ [PROTOCOL_VERSION_HEADER]: '2026-07-28' }, { method: 'tools/list' })).toBe('modern');
  });

  it('body _meta 带 protocolVersion → modern（缺头的畸形请求）', () => {
    expect(
      detectEra({}, { method: 'tools/list', params: { _meta: { [MCP_META_KEYS.protocolVersion]: '2026-07-28' } } }),
    ).toBe('modern');
  });

  it('initialize 等无头请求 → legacy', () => {
    expect(detectEra({}, { method: 'initialize' })).toBe('legacy');
  });
});

describe('validateModernRequest', () => {
  const body = (method = 'tools/list', meta = { [MCP_META_KEYS.protocolVersion]: '2026-07-28' }) => ({
    jsonrpc: '2.0',
    id: 1,
    method,
    params: { _meta: meta },
  });

  it('合法 modern 请求通过', () => {
    const result = validateModernRequest(
      { [PROTOCOL_VERSION_HEADER]: '2026-07-28', [METHOD_HEADER]: 'tools/list' },
      body(),
    );
    expect(result).toEqual({ ok: true, method: 'tools/list', name: undefined });
  });

  it('版本头与 body _meta 不一致 → 400 HeaderMismatch', () => {
    const result = validateModernRequest(
      { [PROTOCOL_VERSION_HEADER]: '2025-11-25', [METHOD_HEADER]: 'tools/list' },
      body(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      const error = (result.body as { error: { code: number } }).error;
      expect(error.code).toBe(MCP_ERROR_CODES.headerMismatch);
    }
  });

  it('不支持的版本 → 400 UnsupportedProtocolVersion（-32022）且带 supported 列表', () => {
    const result = validateModernRequest(
      { [PROTOCOL_VERSION_HEADER]: '1900-01-01', [METHOD_HEADER]: 'tools/list' },
      body('tools/list', { [MCP_META_KEYS.protocolVersion]: '1900-01-01' }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const error = (result.body as { error: { code: number; data: { supported: string[]; requested: string } } })
        .error;
      expect(error.code).toBe(MCP_ERROR_CODES.unsupportedProtocolVersion);
      expect(error.data.supported).toEqual([...SUPPORTED_VERSIONS]);
      expect(error.data.requested).toBe('1900-01-01');
    }
  });

  it('Mcp-Method 与 body method 不一致 → 400 HeaderMismatch', () => {
    const result = validateModernRequest(
      { [PROTOCOL_VERSION_HEADER]: '2026-07-28', [METHOD_HEADER]: 'tools/call' },
      body(),
    );
    expect(result.ok).toBe(false);
  });

  it('tools/call 缺 Mcp-Name → 400 HeaderMismatch', () => {
    const result = validateModernRequest(
      { [PROTOCOL_VERSION_HEADER]: '2026-07-28', [METHOD_HEADER]: 'tools/call' },
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'get_balance', _meta: { [MCP_META_KEYS.protocolVersion]: '2026-07-28' } },
      },
    );
    expect(result.ok).toBe(false);
  });

  it('Mcp-Name 支持 Base64 sentinel 解码后比对', () => {
    const encoded = `=?base64?${btoa('get_balance')}?=`;
    const result = validateModernRequest(
      { [PROTOCOL_VERSION_HEADER]: '2026-07-28', [METHOD_HEADER]: 'tools/call', [NAME_HEADER]: encoded },
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'get_balance', _meta: { [MCP_META_KEYS.protocolVersion]: '2026-07-28' } },
      },
    );
    expect(result).toEqual({ ok: true, method: 'tools/call', name: 'get_balance' });
  });
});

describe('decodeMcpHeaderValue', () => {
  it('普通值原样返回', () => {
    expect(decodeMcpHeaderValue('us-west1')).toBe('us-west1');
  });

  it('Base64 sentinel 解码', () => {
    expect(decodeMcpHeaderValue(`=?base64?${btoa('get_balance')}?=`)).toBe('get_balance');
  });

  it('非法 base64 保持原样', () => {
    expect(decodeMcpHeaderValue('=?base64?%%%?=')).toBe('=?base64?%%%?=');
  });
});

describe('negotiateLegacyVersion', () => {
  it('客户端请求版本在支持列表内 → 回该版本', () => {
    expect(negotiateLegacyVersion('2025-06-18')).toBe('2025-06-18');
    expect(negotiateLegacyVersion('2025-11-25')).toBe('2025-11-25');
  });

  it('不支持/未知版本 → 回最高 legacy 版本 2025-11-25', () => {
    expect(negotiateLegacyVersion('2024-11-05')).toBe(PROTOCOL_VERSION_2025_11_25);
    expect(negotiateLegacyVersion(undefined)).toBe(PROTOCOL_VERSION_2025_11_25);
  });

  it('modern 版本不属于 legacy 协商范围', () => {
    expect(negotiateLegacyVersion('2026-07-28')).toBe(PROTOCOL_VERSION_2025_11_25);
    expect(LEGACY_VERSIONS).not.toContain('2026-07-28');
  });
});

describe('buildModernResult / buildMethodNotFound', () => {
  it('结果带 resultType: complete 与 _meta.serverInfo', () => {
    const result = buildModernResult(1, { tools: [] }) as {
      jsonrpc: string;
      result: { resultType: string; tools: unknown[]; _meta: Record<string, unknown> };
    };
    expect(result.jsonrpc).toBe('2.0');
    expect(result.result.resultType).toBe('complete');
    expect(result.result._meta[MCP_META_KEYS.serverInfo]).toEqual({ name: 'muirouter', version: '1.0.0' });
  });

  it('未知方法错误码为 -32601', () => {
    const result = buildMethodNotFound(1, 'nope') as { error: { code: number } };
    expect(result.error.code).toBe(-32601);
  });
});

describe('isAllowedOrigin', () => {
  it('https 与本机地址放行', () => {
    expect(isAllowedOrigin('https://claude.ai')).toBe(true);
    expect(isAllowedOrigin('http://localhost:3000')).toBe(true);
    expect(isAllowedOrigin('http://127.0.0.1:5173')).toBe(true);
  });

  it('无 Origin 放行，非法或非 https 拒绝', () => {
    expect(isAllowedOrigin(null)).toBe(true);
    expect(isAllowedOrigin('http://evil.example.com')).toBe(false);
    expect(isAllowedOrigin('not-a-url')).toBe(false);
  });
});
