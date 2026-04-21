// Cloudflare Worker Bindings
export interface CloudflareBindings {
  DB: D1Database;
  KV: KVNamespace;
  CONCURRENCY_LIMITER: DurableObjectNamespace;
  CF_AIG_TOKEN: string;
  RESEND_API_KEY: string;
  ADMIN_SECRET: string;
  ADMIN_EMAIL: string;
  BASE_URL: string;
  FROM_EMAIL?: string;
  CF_ACCOUNT_ID: string;
  CF_GATEWAY_ID: string;
  CF_TOKEN: string;
  DEFAULT_MAX_CONCURRENCY?: string; // 默认 "3"
}

// KV 用户数据结构
export interface KVUserData {
  balance: number;
  concurrency: number; // Durable Object 同步回 KV 的并发展示镜像，不参与准入判断
  isSuspended?: boolean;
}

export interface KVUserMetadata {
  maxConcurrency?: number;
  rateMultiplier?: number; // 用户费率倍率，默认 1
  email: string;
  createdAt: string;
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
