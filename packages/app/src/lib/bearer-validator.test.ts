import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '../db';
import { KVService } from '../services/kv-service';
import { resolveAccessToken } from '../services/oauth-token-service';
import type { CloudflareBindings } from '../types';
import { validateBearer } from './bearer-validator';

// 只 mock 两条验证路径的出口，前缀分发逻辑走真实实现。
// oauth-token-service 保留原始导出（ACCESS_TOKEN_PREFIX 等），仅替换 resolveAccessToken。
vi.mock('../services/oauth-token-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/oauth-token-service')>()),
  resolveAccessToken: vi.fn(),
}));
vi.mock('../services/kv-service', () => ({
  KVService: vi.fn(),
}));

const mockResolveAccessToken = vi.mocked(resolveAccessToken);
const MockKVService = vi.mocked(KVService);

const env = { KV: {} } as unknown as CloudflareBindings;
// resolveAccessToken 被 mock，db 不会被解引用
const db = {} as Database;

const validateApiKey = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  // new KVService(...) 需要可构造的实现；普通 function 返回对象时 new 表达式采用该对象
  MockKVService.mockImplementation(function mockKvService() {
    return { validateApiKey } as unknown as KVService;
  });
});

describe('validateBearer：OAuth access_token 路径（mr_at_*）', () => {
  it('有效 token 返回 oauth_access 来源与 client/scope', async () => {
    mockResolveAccessToken.mockResolvedValue({
      userId: 'user-1',
      clientId: 'muicv',
      scope: 'balance usage',
      pairId: 'pair-1',
    });

    const result = await validateBearer(env, 'mr_at_valid-token', db);

    expect(result).not.toBeNull();
    expect(result?.userId).toBe('user-1');
    expect(result?.source).toBe('oauth_access');
    expect(result?.clientId).toBe('muicv');
    expect(result?.scope).toBe('balance usage');
    // keyHash 是 access_token 原文的 SHA-256 hex（64 位小写十六进制）
    expect(result?.keyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(validateApiKey).not.toHaveBeenCalled();
  });

  it('keyHash 与独立计算的 SHA-256 一致，保证 usage_logs 审计可关联', async () => {
    mockResolveAccessToken.mockResolvedValue({
      userId: 'user-1',
      clientId: 'muicv',
      scope: 'llm',
      pairId: 'pair-1',
    });
    const raw = 'mr_at_audit-token';

    const result = await validateBearer(env, raw, db);

    const bytes = new TextEncoder().encode(raw);
    const buf = await crypto.subtle.digest('SHA-256', bytes);
    const expected = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    expect(result?.keyHash).toBe(expected);
  });

  it('无效/过期 token 返回 null', async () => {
    mockResolveAccessToken.mockResolvedValue(null);

    expect(await validateBearer(env, 'mr_at_expired', db)).toBeNull();
  });
});

describe('validateBearer：PAT 路径（sk-gw-*）', () => {
  it('有效 key 返回 pat 来源，keyHash 取自 KV 校验结果', async () => {
    validateApiKey.mockResolvedValue({ userId: 'user-2', keyHash: 'kv-hash-abc' });

    const result = await validateBearer(env, 'sk-gw-valid-key', db);

    expect(result).toEqual({
      userId: 'user-2',
      keyHash: 'kv-hash-abc',
      source: 'pat',
      clientId: null,
      scope: null,
    });
    expect(validateApiKey).toHaveBeenCalledWith('sk-gw-valid-key');
    expect(mockResolveAccessToken).not.toHaveBeenCalled();
  });

  it('KV 校验失败返回 null', async () => {
    validateApiKey.mockResolvedValue(null);

    expect(await validateBearer(env, 'sk-gw-revoked', db)).toBeNull();
  });
});

describe('validateBearer：未知前缀', () => {
  it('一律返回 null 且不触碰任何验证路径', async () => {
    for (const raw of ['mui_something', 'sk-openai-style', 'mr_rt_refresh-not-access', '']) {
      expect(await validateBearer(env, raw, db)).toBeNull();
    }
    expect(mockResolveAccessToken).not.toHaveBeenCalled();
    expect(validateApiKey).not.toHaveBeenCalled();
  });
});
