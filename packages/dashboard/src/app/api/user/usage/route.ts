import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { proxyToApi } from '@/lib/api-proxy';

/**
 * GET /api/user/usage — 获取当前用户的用量记录
 * 支持 query params: modelId, startDate, endDate, page, pageSize
 */
export async function GET(request: NextRequest) {
  const { user } = await getSession();
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  // 查找用户 userId
  const userRes = await proxyToApi(`/admin/user?email=${encodeURIComponent(user.email)}`);
  if (!userRes.ok) {
    return NextResponse.json({
      logs: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });
  }
  const userData = (await userRes.json()) as { user: { userId: string } };
  const userId = userData.user.userId;

  // 构建查询参数，强制限定 userId
  const searchParams = new URL(request.url).searchParams;
  const query = new URLSearchParams();
  query.set('userId', userId);
  if (searchParams.get('modelId')) query.set('modelId', searchParams.get('modelId')!);
  if (searchParams.get('startDate')) query.set('startDate', searchParams.get('startDate')!);
  if (searchParams.get('endDate')) query.set('endDate', searchParams.get('endDate')!);
  query.set('page', searchParams.get('page') || '1');
  query.set('pageSize', searchParams.get('pageSize') || '20');

  const response = await proxyToApi(`/admin/usage?${query}`);
  const data = await response.json();

  return NextResponse.json(data);
}
