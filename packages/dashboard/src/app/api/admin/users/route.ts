import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getKV, listAllUsers } from '@/lib/kv';

/**
 * GET /api/admin/users — 列出所有用户
 */
export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin();
    if ('error' in result) return result.error;

    const cursor = new URL(request.url).searchParams.get('cursor') || undefined;
    const kv = await getKV();
    const data = await listAllUsers(kv, cursor);

    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    console.error('GET /api/admin/users 错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
