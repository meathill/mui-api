// Cloudflare Worker Bindings
export interface CloudflareBindings {
  DB: D1Database;
  OPENAI_API_KEY: string;
  GOOGLE_API_KEY: string;
  RESEND_API_KEY: string;
  ADMIN_SECRET: string;
  BASE_URL: string;
  FROM_EMAIL?: string;
}

// Hono 类型扩展
declare module "hono" {
  interface ContextVariableMap {
    userId: string;
    db: import("./db").Database;
  }
}
