/**
 * 扩展 CloudflareEnv 类型
 * wrangler types 只生成 wrangler.jsonc 中的 vars
 * 这些 secret 通过 .dev.vars 和 CF dashboard secrets 提供
 */
declare namespace Cloudflare {
  interface Env {
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
    ADMIN_EMAILS: string;
    RESEND_API_KEY: string;
    FROM_EMAIL: string;
    NEXT_PUBLIC_SITE_URL: string;
    NEXT_PUBLIC_API_BASE: string;
    GITHUB_CLIENT_ID: string;
    GITHUB_CLIENT_SECRET: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
  }
}
