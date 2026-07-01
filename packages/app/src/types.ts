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
  MIMO_API_KEY?: string;
  MIMO_BASE_URL?: string;
  // Anthropic / Claude 接入（Cloudflare Unified Billing）
  // unified（默认）：经 CF AI Gateway 代付，扣 CF credits，无需自有 Anthropic 账号
  // byok：注入自有 ANTHROPIC_API_KEY 自付（注意：当前组织被禁用，BYOK 暂不可用）
  ANTHROPIC_CREDENTIAL_MODE?: 'unified' | 'byok';
  ANTHROPIC_API_KEY?: string;
  DEFAULT_MAX_CONCURRENCY?: string; // 默认 "3"
  // Stripe 充值
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_DEFAULT_SUCCESS_URL?: string;
  STRIPE_DEFAULT_CANCEL_URL?: string;
}

// KV 用户数据结构
export interface KVUserData {
  balance: number;
  concurrency: number; // Durable Object 同步回 KV 的并发展示镜像，不参与准入判断
  freeQuotaUsed?: number; // 已消耗的全局免费额度，单位 USD
  isSuspended?: boolean;
}

export interface KVUserMetadata {
  maxConcurrency?: number;
  rateMultiplier?: number; // 用户费率倍率，默认 1
  stripeCustomerId?: string; // dashboard 自助充值流程写入，与 stripe-service.ts 的独立充值渠道无关
  email: string;
  createdAt: string;
}

export interface FreeQuotaConfig {
  enabled: boolean;
  amount: number;
  modelIds: string[];
}

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
