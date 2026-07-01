import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getKV, getUserData } from '@/lib/kv';
import { getWallet, setWalletMetadata } from '@/lib/wallet-do';

/**
 * POST /api/admin/set-rate-multiplier — 设置用户费率倍率
 * Body: { userId: string, rateMultiplier: number }
 */
export async function POST(request: Request) {
  try {
    const result = await requireAdmin();
    if ('error' in result) return result.error;

    const { userId, rateMultiplier } = (await request.json()) as { userId: string; rateMultiplier: number };
    if (!userId || rateMultiplier == null) {
      return NextResponse.json({ error: 'userId 和 rateMultiplier 为必填' }, { status: 400 });
    }
    if (rateMultiplier < 0) {
      return NextResponse.json({ error: 'rateMultiplier 不能为负数' }, { status: 400 });
    }

    const kv = await getKV();
    const { data, metadata } = await getUserData(kv, userId);
    if (!data || !metadata) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    const wallet = await getWallet();
    await setWalletMetadata(wallet, userId, { rateMultiplier });

    return NextResponse.json({ success: true, userId, rateMultiplier });
  } catch (error) {
    console.error('POST /api/admin/set-rate-multiplier 错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
