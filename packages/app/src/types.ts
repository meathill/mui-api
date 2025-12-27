// Cloudflare Worker Bindings
export interface CloudflareBindings {
  DB: D1Database;
  KV: KVNamespace;
  OPENAI_API_KEY: string;
  GOOGLE_API_KEY: string;
  RESEND_API_KEY: string;
  ADMIN_SECRET: string;
  BASE_URL: string;
  FROM_EMAIL?: string;
  DEFAULT_MAX_CONCURRENCY?: string; // 默认 "3"
}

// KV 用户数据结构
export interface KVUserData {
  balance: number;
  concurrency: number;
}

export interface KVUserMetadata {
  maxConcurrency?: number;
  email: string;
  createdAt: string;
}

// Hono 类型扩展
declare module "hono" {
  interface ContextVariableMap {
    userId: string;
    balance: number;
    db: import("./db").Database;
  }
}
