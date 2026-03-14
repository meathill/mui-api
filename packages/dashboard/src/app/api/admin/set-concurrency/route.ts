import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getKV, getUserData, setUserData } from '@/lib/kv';

/**
 * POST /api/admin/set-concurrency — 设置用户最大并发数
 * Body: { userId: string, maxConcurrency: number }
 */
export async function POST(request: Request) {
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

  metadata.maxConcurrency = maxConcurrency;
  await setUserData(kv, userId, data, metadata);

  return NextResponse.json({ success: true, userId, maxConcurrency });
}
