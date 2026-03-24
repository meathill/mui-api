import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { requireAdmin } from '@/lib/admin';
import { getDb } from '@/lib/db';
import { getKV, createUser, addBalance, getUserData } from '@/lib/kv';
import { user as userTable } from '@/db/schema';
import { rechargeLogs } from '@/db/app-schema';
import { createEmailService } from '@/lib/email';

/**
 * POST /api/admin/recharge — 充值
 * Body: { email: string, amount: number }
 *
 * 用户已注册：增加余额（KV）→ 发充值成功邮件
 * 用户未注册：返回错误，要求用户先自行注册
 */
export async function POST(request: Request) {
  try {
    const result = await requireAdmin();
    if ('error' in result) return result.error;

    const { email, amount, note } = (await request.json()) as {
      email: string;
      amount: number;
      note?: string;
    };
    if (!email || !amount || amount <= 0) {
      return NextResponse.json({ error: 'email 和 amount（正数）为必填' }, { status: 400 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const emailService = env.RESEND_API_KEY
      ? createEmailService({ apiKey: env.RESEND_API_KEY, fromEmail: env.FROM_EMAIL })
      : null;

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

      await db.insert(rechargeLogs).values({
        id: crypto.randomUUID(),
        userId,
        operatorId: result.user.id,
        amount,
        balanceAfter: amount,
        note: note || null,
      });

      const emailSent = await emailService?.sendRechargeSuccessEmail(email, amount, amount);

      return NextResponse.json({
        success: true,
        isNewUser: true,
        message: emailSent ? '首次充值成功，通知邮件已发送' : '首次充值成功（邮件服务未配置）',
        userId,
        balance: amount,
      });
    }

    // 老用户充值
    const newBalance = await addBalance(kv, userId, amount);

    await db.insert(rechargeLogs).values({
      id: crypto.randomUUID(),
      userId,
      operatorId: result.user.id,
      amount,
      balanceAfter: newBalance,
      note: note || null,
    });

    const emailSent = await emailService?.sendRechargeSuccessEmail(email, amount, newBalance);

    return NextResponse.json({
      success: true,
      isNewUser: false,
      message: emailSent ? '充值成功，通知邮件已发送' : '充值成功',
      userId,
      balance: newBalance,
    });
  } catch (error) {
    console.error('POST /api/admin/recharge 错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
