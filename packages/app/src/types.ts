// Cloudflare Worker Bindings
import type { ExecutionPolicy } from '@muirouter/shared-db/integration';

export interface CloudflareBindings {
  DB: D1Database;
  KV: KVNamespace;
  CONCURRENCY_LIMITER: DurableObjectNamespace;
  WALLET: DurableObjectNamespace;
  CF_AIG_TOKEN: string;
  RESEND_API_KEY: string;
  ADMIN_SECRET: string;
  ADMIN_EMAIL: string;
  /** 多管理员邮箱（逗号/空白分隔），与 ADMIN_EMAIL 并集判定。 */
  ADMIN_EMAILS?: string;
  BASE_URL: string;
  FROM_EMAIL?: string;
  CF_ACCOUNT_ID: string;
  CF_GATEWAY_ID: string;
  CF_TOKEN: string;
  AI: Ai;
  MOONSHOT_API_KEY?: string;
  MOONSHOT_BASE_URL?: string;
  MIMO_API_KEY?: string;
  MIMO_BASE_URL?: string;
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_BASE_URL?: string;
  OPENCODE_GO_API_KEY?: string;
  OPENCODE_GO_BASE_URL?: string;
  // 已废弃：Anthropic 统一经 CF AI Gateway Stored Keys + 官方 SDK，不再经 Worker 侧 BYOK/unified 分流
  ANTHROPIC_CREDENTIAL_MODE?: 'unified' | 'byok';
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  DEFAULT_MAX_CONCURRENCY?: string; // 默认 "3"
  // Stripe 充值
}

// KV 数据形状定义已上移到 shared-db（app / dashboard 共用），此处转发保持既有 import 路径
export type { FreeQuotaConfig, KVUserData, KVUserMetadata } from '@muirouter/shared-db/types';

// Hono 类型扩展
declare module 'hono' {
  interface ContextVariableMap {
    userId: string;
    apiKeyId: string;
    balance: number;
    rateMultiplier: number;
    concurrencyLeaseId: string;
    db: import('./db').Database;
    /** 中心项目 key 的执行策略（计费模式 + 模型默认值）；普通 key 为 undefined。 */
    executionPolicy?: ExecutionPolicy;
  }
}
