import { type NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getTopUpSessionStatus } from '@/lib/top-up-service';

export async function GET(request: NextRequest) {
  try {
    const { user } = await getSession();
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const sessionId = request.nextUrl.searchParams.get('sessionId');
    if (!sessionId) {
      return NextResponse.json({ error: '缺少 sessionId' }, { status: 400 });
    }

    const result = await getTopUpSessionStatus({
      checkoutSessionId: sessionId,
      userId: user.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/user/top-up/session 错误:', error);
    const message = error instanceof Error ? error.message : '服务器内部错误';
    const status = message === '充值会话不存在' ? 404 : message === '无权查看该充值会话' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
