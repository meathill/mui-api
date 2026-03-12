import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { proxyToApi } from '@/lib/api-proxy';

/**
 * GET /api/user — 获取当前登录用户的 API Gateway 信息
 * 通过 email 在 API Worker 中查找对应用户
 */
export async function GET() {
  const { user } = await getSession();
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const response = await proxyToApi(`/admin/user?email=${encodeURIComponent(user.email)}`);
  const data = await response.json();

  if (!response.ok) {
    // 用户在 API Worker 中不存在（尚未充值），返回空数据
    if (response.status === 404) {
      return NextResponse.json({
        user: {
          userId: null,
          email: user.email,
          balance: 0,
          concurrency: 0,
          isSuspended: false,
          maxConcurrency: 3,
          createdAt: null,
        },
      });
    }
    return NextResponse.json(data, { status: response.status });
  }

  return NextResponse.json(data);
}
