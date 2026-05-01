import { createDb } from '../db';
import { KVService } from '../services/kv-service';
import { ACCESS_TOKEN_PREFIX, resolveAccessToken } from '../services/oauth-token-service';
import type { CloudflareBindings } from '../types';

/**
 * Bearer token 统一校验入口。中间件不再直接判断前缀；改为：
 *   sk-gw-* → KV 路径（PAT，存量 API key）
 *   mr_at_* → D1 oauth_tokens 路径（OAuth access_token）
 *
 * 返回值 keyHash 是后续 usage_logs.api_key_id 的来源，让 OAuth 用量也能被审计。
 * 失败一律返回 null，由调用方决定怎么响应（401 / OAuth 错误体）。
 */

export type BearerSource = 'pat' | 'oauth_access';

export type BearerValidation = {
  userId: string;
  /** PAT：API key 的 SHA-256 哈希；OAuth：access_token 的 SHA-256 哈希。 */
  keyHash: string;
  source: BearerSource;
  /** OAuth 时是 client_id（"muicv" 等）；PAT 时为 null。 */
  clientId: string | null;
  /** OAuth 时是授权 scope；PAT 时为 null。 */
  scope: string | null;
};

export async function validateBearer(env: CloudflareBindings, raw: string): Promise<BearerValidation | null> {
  if (raw.startsWith(ACCESS_TOKEN_PREFIX)) {
    const db = createDb(env.DB);
    const resolved = await resolveAccessToken(db, raw);
    if (!resolved) return null;
    const keyHash = await sha256Hex(raw);
    return {
      userId: resolved.userId,
      keyHash,
      source: 'oauth_access',
      clientId: resolved.clientId,
      scope: resolved.scope,
    };
  }
  if (raw.startsWith('sk-gw-')) {
    const kv = new KVService(env.KV);
    const result = await kv.validateApiKey(raw);
    if (!result) return null;
    return {
      userId: result.userId,
      keyHash: result.keyHash,
      source: 'pat',
      clientId: null,
      scope: null,
    };
  }
  return null;
}

async function sha256Hex(s: string): Promise<string> {
  const bytes = new TextEncoder().encode(s);
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
