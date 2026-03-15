import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { requireAdmin } from '@/lib/admin';
import { getDb } from '@/lib/db';
import { getKV, createUser, addBalance, getUserData, storeApiKey } from '@/lib/kv';
import { claimTokens } from '@/db/app-schema';
import { user as userTable } from '@/db/schema';
import { generateApiKey, generateClaimToken, hashApiKey, getKeyPrefix } from '@/lib/crypto';
import { createEmailService } from '@/lib/email';

/**
 * POST /api/admin/recharge — 充值
 * Body: { email: string, amount: number }
 *
 * 用户已注册：增加余额（KV）→ 发通知邮件
 * 用户未注册：返回错误，要求用户先自行注册
 */
export async function POST(request: Request) {
  const result = await requireAdmin();
  if ('error' in result) return result.error;

  const { email, amount } = (await request.json()) as { email: string; amount: number };
  if (!email || !amount || amount <= 0) {
    return NextResponse.json({ error: 'email 和 amount（正数）为必填' }, { status: 400 });
  }

  const { env } = await getCloudflareContext({ async: true });
  const emailService = createEmailService({
    apiKey: env.RESEND_API_KEY,
    fromEmail: env.FROM_EMAIL,
  });

  const db = await getDb();
  const kv = await getKV();

  // 从 better-auth user 表查找用户
  const row = await db.select({ id: userTable.id }).from(userTable).where(eq(userTable.email, email)).get();

  if (!row) {
    return NextResponse.json({ error: '用户未注册，请让用户先注册账号' }, { status: 404 });
  }

  const userId = row.id;
  const { data } = await getUserData(kv, userId);

  if (!data) {
    // 用户已注册但 KV 中没有数据（首次充值），初始化 KV
    await createUser(kv, userId, email, amount);

    // 生成初始 API Key
    const rawKey = generateApiKey();
    const keyHash = await hashApiKey(rawKey);
    const keyPrefix = getKeyPrefix(rawKey);
    await storeApiKey(kv, keyHash, userId, keyPrefix);

    // 创建 Claim Token
    const token = generateClaimToken();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await db.insert(claimTokens).values({
      token,
      userId,
      tempRawKey: rawKey,
      expiresAt,
      used: false,
    });

    const baseUrl = env.NEXT_PUBLIC_SITE_URL || 'https://muirouter.com';
    const claimUrl = `${baseUrl}/claim?token=${token}`;
    await emailService.sendClaimEmail(email, claimUrl);

    return NextResponse.json({
      success: true,
      isNewUser: true,
      message: '首次充值，Claim 邮件已发送',
      userId,
      balance: amount,
      claimUrl,
    });
  }

  // 老用户充值
  const newBalance = await addBalance(kv, userId, amount);
  await emailService.sendRechargeSuccessEmail(email, amount, newBalance);

  return NextResponse.json({
    success: true,
    isNewUser: false,
    message: '充值成功，通知邮件已发送',
    userId,
    balance: newBalance,
  });
}
