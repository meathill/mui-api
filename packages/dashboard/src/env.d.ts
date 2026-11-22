/**
 * 可选 secrets（未加入 wrangler.jsonc 的 secrets.required，按需配置）
 */
declare namespace Cloudflare {
  interface Env {
    RESEND_API_KEY?: string;
    FROM_EMAIL?: string;
  }
}

interface CloudflareEnv {
  RESEND_API_KEY?: string;
  FROM_EMAIL?: string;
}
