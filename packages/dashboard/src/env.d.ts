/**
 * 扩展 CloudflareEnv，声明通过 wrangler secret 设置的环境变量
 */
declare namespace Cloudflare {
  interface Env {
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
    ADMIN_SECRET: string;
    ADMIN_EMAILS: string;
  }
}
