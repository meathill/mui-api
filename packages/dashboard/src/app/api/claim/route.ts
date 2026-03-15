import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { claimTokens } from '@/db/app-schema';

/**
 * POST /api/claim — 兑换 Claim Token，获取 API Key
 * Body: { token: string }
 *
 * 校验 token 有效性（存在、未使用、未过期），成功后返回 rawKey 并标记已使用
 */
export async function POST(request: NextRequest) {
  try {
    const { token } = (await request.json()) as { token: string };
    if (!token) {
      return NextResponse.json({ error: '缺少 token' }, { status: 400 });
    }

    const db = await getDb();
    const row = await db.select().from(claimTokens).where(eq(claimTokens.token, token)).get();

    if (!row) {
      return NextResponse.json({ error: '无效的 Token' }, { status: 404 });
    }

    if (row.used) {
      return NextResponse.json({ error: '此 Token 已被使用' }, { status: 410 });
    }

    if (row.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Token 已过期，请联系管理员重新充值' }, { status: 410 });
    }

    // 标记 token 已使用，清空 rawKey（安全考虑）
    await db.update(claimTokens).set({ used: true, tempRawKey: '' }).where(eq(claimTokens.token, token));

    return NextResponse.json({
      success: true,
      rawKey: row.tempRawKey,
      message: 'API Key 领取成功，请妥善保管，此 Key 仅显示一次。',
    });
  } catch (error) {
    console.error('Claim API 错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
