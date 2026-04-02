import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createTopUpCheckoutSession } from '@/lib/top-up-service';

export async function POST(request: Request) {
  try {
    const { user } = await getSession();
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = (await request.json()) as { amount?: number; locale?: string };
    const result = await createTopUpCheckoutSession({
      amount: body.amount ?? 0,
      locale: body.locale,
      origin: new URL(request.url).origin,
      user,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('POST /api/user/top-up/checkout 错误:', error);
    const message = error instanceof Error ? error.message : '服务器内部错误';
    const status = message === '仅支持充值 $10、$20、$50' ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
