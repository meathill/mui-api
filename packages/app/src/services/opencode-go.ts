import type { CloudflareBindings } from '../types';
import { openCodeGoBaseURL } from './provider-base-urls';

type AnyBody = Record<string, unknown>;

/**
 * 基于用户特征（如 userId、IP）确定性生成稳定的 UUID 格式 Session ID。
 */
export async function generateSessionIdFromTrait(trait: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`opencode-session:${trait}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/**
 * 解析或生成必须的 x-opencode-session 头部。
 * 若传入 headers 已含有该头（或常见别名 x-session-id）则直接复用；
 * 否则若提供了 userTrait 则基于用户特征确定性生成，无特征时回退到随机 UUID。
 */
export async function resolveOpenCodeSession(headers?: Record<string, string>, userTrait?: string): Promise<string> {
  const existing =
    headers?.['x-opencode-session'] ||
    headers?.['X-OpenCode-Session'] ||
    headers?.['x-session-id'] ||
    headers?.['X-Session-Id'];
  if (existing) return existing;

  if (userTrait) {
    return generateSessionIdFromTrait(userTrait);
  }
  return crypto.randomUUID();
}

/** OpenCode Go 订阅服务：直连 https://opencode.ai/zen/go/v1 端点 */
export async function callOpenCodeGo(
  env: CloudflareBindings,
  body: AnyBody,
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  if (!env.OPENCODE_GO_API_KEY) {
    throw new Error('缺少 OPENCODE_GO_API_KEY，无法调用 OpenCode Go');
  }

  const session = await resolveOpenCodeSession(extraHeaders);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${env.OPENCODE_GO_API_KEY}`,
    'Content-Type': 'application/json',
    'x-opencode-session': session,
    ...extraHeaders,
  };

  return fetch(`${openCodeGoBaseURL(env)}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}
