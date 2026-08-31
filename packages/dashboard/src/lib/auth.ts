import { getCloudflareContext } from '@opennextjs/cloudflare';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import * as schema from '@/db/schema';
import { getDb } from './db';

/**
 * 创建 better-auth 实例
 * 必须在请求上下文中调用，因为 D1 binding 只在请求时可用
 */
export async function getAuth() {
  const { env } = await getCloudflareContext({ async: true });

  return betterAuth({
    database: drizzleAdapter(await getDb(), {
      provider: 'sqlite',
      schema,
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: process.env.NODE_ENV === 'development' ? 'http://localhost:3035' : env.BETTER_AUTH_URL,
    trustedOrigins: ['http://localhost:3035', env.NEXT_PUBLIC_SITE_URL].filter(Boolean),
    user: {
      additionalFields: {
        acceptedTermsAt: { type: 'date', required: false, fieldName: 'acceptedTermsAt' },
        acceptedTermsVersion: { type: 'string', required: false, fieldName: 'acceptedTermsVersion' },
        acceptedPrivacyVersion: { type: 'string', required: false, fieldName: 'acceptedPrivacyVersion' },
      },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
    },
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      },
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },
    plugins: [nextCookies()],
  });
}
