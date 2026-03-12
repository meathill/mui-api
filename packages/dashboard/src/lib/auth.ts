import { betterAuth } from 'better-auth';

/**
 * 创建 better-auth 实例
 * 必须在请求上下文中调用，因为 D1 binding 只在请求时可用
 */
export function createAuth(
  db: D1Database,
  env: {
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL?: string;
  },
) {
  return betterAuth({
    database: {
      dialect: 'sqlite',
      type: 'd1',
      db,
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL || process.env.BETTER_AUTH_URL,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
    },
  });
}
