import { getCloudflareContext } from '@opennextjs/cloudflare';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { emailOTP } from 'better-auth/plugins';
import { and, eq, gt } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { getDb } from './db';
import { hasAuthEmailAlias, normalizeAuthEmail } from './auth-email';
import { createEmailService } from './email';
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from './legal';

const OTP_COOLDOWN_SECONDS = process.env.E2E_AUTH_OTP === '1' ? 0 : 60;

/**
 * 创建 better-auth 实例。
 * 必须在请求上下文中调用，因为 D1 binding 只在请求时可用。
 */
export async function getAuth() {
  const { env, ctx } = await getCloudflareContext({ async: true });
  const db = await getDb({ consistentReads: true });
  const emailService = createEmailService({
    sendEmail: (message) => env.EMAIL.send(message),
    fromEmail: env.FROM_EMAIL,
  });

  async function mapOAuthEmail(rawEmail: string | null): Promise<{ email: string } | Record<string, never>> {
    if (!rawEmail) return {};
    const email = normalizeAuthEmail(rawEmail);
    if (!hasAuthEmailAlias(rawEmail)) return { email };

    const existingUser = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.email, email))
      .get();
    if (existingUser) return { email };

    const aliasUser = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.email, rawEmail.trim().toLowerCase()))
      .get();
    if (!aliasUser) {
      throw new APIError('BAD_REQUEST', { message: 'An email alias can only sign in to an existing account' });
    }

    // OAuth 此时尚未签发新 session，可直接完成历史邮箱迁移；后续 session 与 cookieCache 会携带新邮箱。
    await db.update(schema.user).set({ email, updatedAt: new Date() }).where(eq(schema.user.id, aliasUser.id));
    return { email };
  }

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema,
    }),
    secret: env.BETTER_AUTH_SECRET,
    // session 校验结果缓存在签名 cookie 里，避免 OAuth 回调后首屏 4 个请求各自重复查 D1。
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 60,
      },
    },
    baseURL: process.env.NODE_ENV === 'development' ? 'http://localhost:3035' : env.BETTER_AUTH_URL,
    trustedOrigins: ['http://localhost:3035', env.NEXT_PUBLIC_SITE_URL].filter(Boolean),
    user: {
      additionalFields: {
        acceptedTermsAt: { type: 'date', required: false, fieldName: 'acceptedTermsAt' },
        acceptedTermsVersion: { type: 'string', required: false, fieldName: 'acceptedTermsVersion' },
        acceptedPrivacyVersion: { type: 'string', required: false, fieldName: 'acceptedPrivacyVersion' },
      },
    },
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        mapProfileToUser: async (profile) => mapOAuthEmail(profile.email),
      },
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        mapProfileToUser: async (profile) => mapOAuthEmail(profile.email),
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({
            data: {
              ...user,
              email: normalizeAuthEmail(user.email),
              acceptedTermsAt: new Date(),
              acceptedTermsVersion: CURRENT_TERMS_VERSION,
              acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
            },
          }),
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (!ctx.body || typeof ctx.body.email !== 'string') return;

        const isOtpSend = ctx.path === '/email-otp/send-verification-otp';
        const isOtpSignIn = ctx.path === '/sign-in/email-otp';
        const isLegacyEmailAuth = ctx.path === '/sign-up/email' || ctx.path === '/sign-in/email';
        if (!isOtpSend && !isOtpSignIn && !isLegacyEmailAuth) return;

        const rawEmail = ctx.body.email;
        const email = normalizeAuthEmail(rawEmail);
        const isAlias = hasAuthEmailAlias(rawEmail);
        let user = await ctx.context.internalAdapter.findUserByEmail(email);

        // 历史别名账号首次登录时懒迁移为主邮箱；若主账号也已存在，则保留主账号并走人工合并审计。
        if (!user && isAlias) {
          const aliasUser = await ctx.context.internalAdapter.findUserByEmail(rawEmail.trim().toLowerCase());
          if (aliasUser) {
            const migratedUser = await ctx.context.internalAdapter.updateUser(aliasUser.user.id, { email });
            user = { user: migratedUser, accounts: aliasUser.accounts };
          }
        }

        // 别名只能登录已有主账号；主账号不存在时不发码、不建档，响应与正常请求一致。
        if (isAlias && !user && isOtpSend) return ctx.json({ success: true });
        if (isAlias && !user && isOtpSignIn) {
          throw new APIError('BAD_REQUEST', { message: 'Invalid verification code' });
        }

        if (isOtpSend && ctx.body.type === 'sign-in') {
          const recentOtp = await db
            .select({ id: schema.verification.id })
            .from(schema.verification)
            .where(
              and(
                eq(schema.verification.identifier, `sign-in-otp-${email}`),
                gt(schema.verification.createdAt, new Date(Date.now() - OTP_COOLDOWN_SECONDS * 1000)),
              ),
            )
            .get();
          if (recentOtp) {
            throw new APIError('TOO_MANY_REQUESTS', { message: 'Please wait before requesting another code' });
          }
        }

        return {
          context: {
            ...ctx,
            body: { ...ctx.body, email },
          },
        };
      }),
    },
    rateLimit: {
      enabled: process.env.NODE_ENV === 'production',
      storage: 'database',
      modelName: 'rateLimit',
    },
    advanced: {
      ipAddress: {
        ipAddressHeaders: ['cf-connecting-ip'],
      },
      backgroundTasks: {
        handler: (promise) => ctx.waitUntil(promise),
      },
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 3,
        storeOTP: 'hashed',
        resendStrategy: 'rotate',
        rateLimit: { window: 60, max: 3 },
        generateOTP: process.env.E2E_AUTH_OTP === '1' ? () => '123456' : undefined,
        async sendVerificationOTP({ email, otp }, ctx) {
          if (process.env.E2E_AUTH_OTP === '1') return;
          try {
            await emailService.sendOtpEmail(email, otp);
          } catch (error) {
            await ctx?.context.internalAdapter.deleteVerificationByIdentifier(`sign-in-otp-${email}`);
            throw error;
          }
        },
      }),
      nextCookies(),
    ],
  });
}
