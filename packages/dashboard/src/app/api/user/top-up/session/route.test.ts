import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STRIPE_CHECKOUT_SESSION_ID_PLACEHOLDER } from '@/lib/top-up';
import { GET } from './route';

const getSessionMock = vi.fn();
const getTopUpSessionStatusMock = vi.fn();

vi.mock('next/server', () => ({
  connection: vi.fn().mockResolvedValue(undefined),
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) =>
      new Response(JSON.stringify(body), {
        headers: { 'Content-Type': 'application/json' },
        status: init?.status ?? 200,
      }),
  },
}));

vi.mock('@/lib/session', () => ({
  getSession: () => getSessionMock(),
}));

vi.mock('@/lib/top-up-service', () => ({
  getTopUpSessionStatus: (params: unknown) => getTopUpSessionStatusMock(params),
}));

function makeRequest(sessionId?: string): NextRequest {
  const url = new URL('https://muirouter.com/api/user/top-up/session');
  if (sessionId !== undefined) {
    url.searchParams.set('sessionId', sessionId);
  }
  return { nextUrl: url } as unknown as NextRequest;
}

describe('GET /api/user/top-up/session', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    getTopUpSessionStatusMock.mockReset();
    getSessionMock.mockResolvedValue({ user: { id: 'user-1', email: 'user@example.com', name: 'User' } });
  });

  it('缺少 sessionId 时返回 400 且不请求 Stripe', async () => {
    const response = await GET(makeRequest());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: '缺少 sessionId' });
    expect(getTopUpSessionStatusMock).not.toHaveBeenCalled();
  });

  it.each([STRIPE_CHECKOUT_SESSION_ID_PLACEHOLDER, '{other}', '%7BCHECKOUT_SESSION_ID%7D'])(
    '传入占位符或无效 sessionId（%s）时返回 400 且不请求 Stripe',
    async (sessionId) => {
      const response = await GET(makeRequest(sessionId));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: '无效的 sessionId' });
      expect(getTopUpSessionStatusMock).not.toHaveBeenCalled();
    },
  );

  it('传入合法 sessionId 时正常查询并返回结果', async () => {
    getTopUpSessionStatusMock.mockResolvedValue({
      amount: 20,
      balanceAfter: 25,
      paymentStatus: 'paid',
      sessionId: 'cs_live_123',
      status: 'credited',
    });

    const response = await GET(makeRequest('cs_live_123'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      amount: 20,
      balanceAfter: 25,
      paymentStatus: 'paid',
      sessionId: 'cs_live_123',
      status: 'credited',
    });
    expect(getTopUpSessionStatusMock).toHaveBeenCalledExactlyOnceWith({
      checkoutSessionId: 'cs_live_123',
      userId: 'user-1',
    });
  });
});
