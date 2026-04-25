import { getCloudflareContext } from '@opennextjs/cloudflare';
import { headers } from 'next/headers';
import { getAuth } from './auth';

interface SessionUser {
  id: string;
  email: string;
  name: string;
}

interface SessionResult {
  user: SessionUser | null;
  isAdmin: boolean;
}

/**
 * 在服务端获取当前用户会话
 */
export async function getSession(): Promise<SessionResult> {
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
      },
      isAdmin,
    };
  } catch (error) {
    console.error('[getSession] 获取会话失败:', error);
    return { user: null, isAdmin: false };
  }
}
