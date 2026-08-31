import { getCloudflareContext } from '@opennextjs/cloudflare';
import { headers } from 'next/headers';
import { cache } from 'react';
import { getAuth } from './auth';

interface SessionUser {
  id: string;
  email: string;
  name: string;
  acceptedTermsAt?: Date | string | null;
  acceptedTermsVersion?: string | null;
  acceptedPrivacyVersion?: string | null;
}

interface SessionResult {
  user: SessionUser | null;
  isAdmin: boolean;
}

/**
 * 在服务端获取当前用户会话（同请求内去重，避免 layout 嵌套重复查 D1）
 */
export const getSession = cache(async (): Promise<SessionResult> => {
  try {
    const auth = await getAuth();
    const headerStore = await headers();
    const session = await auth.api.getSession({ headers: headerStore });

    if (!session?.user) {
      return { user: null, isAdmin: false };
    }

    const { env } = await getCloudflareContext({ async: true });
    const adminEmails = (env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const isAdmin = adminEmails.includes(session.user.email.toLowerCase());

    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        acceptedTermsAt: (session.user as Record<string, unknown>).acceptedTermsAt as Date | string | null | undefined,
        acceptedTermsVersion: (session.user as Record<string, unknown>).acceptedTermsVersion as
          | string
          | null
          | undefined,
        acceptedPrivacyVersion: (session.user as Record<string, unknown>).acceptedPrivacyVersion as
          | string
          | null
          | undefined,
      },
      isAdmin,
    };
  } catch (error) {
    console.error('[getSession] 获取会话失败:', error);
    return { user: null, isAdmin: false };
  }
});
