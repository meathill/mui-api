import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getKV, getUserData } from '@/lib/kv';
import { getWallet, setWalletMetadata } from '@/lib/wallet-do';

/**
 * POST /api/admin/set-concurrency — 设置用户最大并发数
 * Body: { userId: string, maxConcurrency: number }
 */
export async function POST(request: Request) {
  try {
    const result = await requireAdmin();
    if ('error' in result) return result.error;

    const { userId, maxConcurrency } = (await request.json()) as { userId: string; maxConcurrency: number };
    if (!userId || maxConcurrency == null) {
      return NextResponse.json({ error: 'userId 和 maxConcurrency 为必填' }, { status: 400 });
    }

    const kv = await getKV();
    const { data, metadata } = await getUserData(kv, userId);
    if (!data || !metadata) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    const wallet = await getWallet();
    await setWalletMetadata(wallet, userId, { maxConcurrency });

    return NextResponse.json({ success: true, userId, maxConcurrency });
  } catch (error) {
    console.error('POST /api/admin/set-concurrency 错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
