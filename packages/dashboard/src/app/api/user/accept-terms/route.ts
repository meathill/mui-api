import { eq } from 'drizzle-orm';
import { connection, NextResponse } from 'next/server';
import { user } from '@/db/schema';
import { getDb } from '@/lib/db';
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from '@/lib/legal';
import { getSession } from '@/lib/session';

export async function POST() {
  await connection();
  const { user: sessionUser } = await getSession();
  if (!sessionUser) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  try {
    const db = await getDb();
    await db
      .update(user)
      .set({
        acceptedTermsAt: new Date(),
        acceptedTermsVersion: CURRENT_TERMS_VERSION,
        acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
        updatedAt: new Date(),
      })
      .where(eq(user.id, sessionUser.id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('POST /api/user/accept-terms 错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

export async function GET() {
  await connection();
  const { user: sessionUser } = await getSession();
  if (!sessionUser) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  return NextResponse.json({
    acceptedTermsAt: sessionUser.acceptedTermsAt ?? null,
    acceptedTermsVersion: sessionUser.acceptedTermsVersion ?? null,
    acceptedPrivacyVersion: sessionUser.acceptedPrivacyVersion ?? null,
    currentTermsVersion: CURRENT_TERMS_VERSION,
    currentPrivacyVersion: CURRENT_PRIVACY_VERSION,
    needsReconsent:
      !sessionUser.acceptedTermsAt ||
      sessionUser.acceptedTermsVersion !== CURRENT_TERMS_VERSION ||
      sessionUser.acceptedPrivacyVersion !== CURRENT_PRIVACY_VERSION,
  });
}
