import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { requireAdmin } from '@/lib/admin';
import { getDb } from '@/lib/db';
import { getKV, resolveAppUserId, createUser, addBalance, storeApiKey } from '@/lib/kv';
import { appUsers, claimTokens } from '@/db/app-schema';
import { generateId, generateApiKey, generateClaimToken, hashApiKey, getKeyPrefix } from '@/lib/crypto';
import { createEmailService } from '@/lib/email';

/**
 * POST /api/admin/recharge — 充值
 * Body: { email: string, amount: number }
 *
 * 新用户：创建用户（D1 + KV）→ 生成 API Key → 创建 Claim Token → 发邮件
 * 老用户：增加余额（KV）→ 发通知邮件
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

  let userId = await resolveAppUserId(db, email);

  if (!userId) {
    // 新用户
    userId = generateId();

    // 写入 D1 users 表
    await db.insert(appUsers).values({ id: userId, email });

    // 写入 KV
    await createUser(kv, userId, email, amount);

    // 生成 API Key 并存入 KV
    const rawKey = generateApiKey();
    const keyHash = await hashApiKey(rawKey);
    const keyPrefix = getKeyPrefix(rawKey);
    await storeApiKey(kv, keyHash, userId, keyPrefix);

    // 创建 Claim Token（D1）
    const token = generateClaimToken();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await db.insert(claimTokens).values({
      token,
      userId,
      tempRawKey: rawKey,
      expiresAt,
      used: false,
    });

    // 发送 Claim 邮件
    const baseUrl = env.NEXT_PUBLIC_SITE_URL || 'https://muirouter.com';
    const claimUrl = `${baseUrl}/claim?token=${token}`;
    await emailService.sendClaimEmail(email, claimUrl);

    return NextResponse.json({
      success: true,
      isNewUser: true,
      message: '新用户已创建，Claim 邮件已发送',
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
