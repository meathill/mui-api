declare namespace Cloudflare {
  interface Env {
    EMAIL: SendEmail;
    FROM_EMAIL: string;
  }
}

interface CloudflareEnv {
  EMAIL: SendEmail;
  FROM_EMAIL: string;
}
