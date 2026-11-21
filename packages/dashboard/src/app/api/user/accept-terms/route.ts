import { headers } from 'next/headers';
import { connection, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from '@/lib/legal';
import { getSession } from '@/lib/session';

export async function POST() {
  await connection();
  const { user: sessionUser } = await getSession();
  if (!sessionUser) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  try {
    // 走 better-auth updateUser 而非直接 drizzle update：它会同步 session 记录并刷新
    // cookieCache，避免同意后 60s 内刷新页面时 SSR 还拿到旧 session 重弹弹窗（issue #22）。
    const auth = await getAuth();
    await auth.api.updateUser({
      body: {
        acceptedTermsAt: new Date(),
        acceptedTermsVersion: CURRENT_TERMS_VERSION,
        acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
      },
      headers: await headers(),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('POST /api/user/accept-terms 错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
