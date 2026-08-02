// Cloudflare Worker Bindings
export interface CloudflareBindings {
  DB: D1Database;
  KV: KVNamespace;
  CONCURRENCY_LIMITER: DurableObjectNamespace;
  WALLET: DurableObjectNamespace;
  CF_AIG_TOKEN: string;
  RESEND_API_KEY: string;
  ADMIN_SECRET: string;
  ADMIN_EMAIL: string;
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
  // Anthropic / Claude 接入
  // unified：经 CF AI Gateway 代付，扣 CF credits，无需自有 Anthropic 账号
  // byok（生产现状，2026-07 起）：注入自有 ANTHROPIC_API_KEY 自付，不再经 CF Unified Billing
  ANTHROPIC_CREDENTIAL_MODE?: 'unified' | 'byok';
  ANTHROPIC_API_KEY?: string;
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
  }
}
