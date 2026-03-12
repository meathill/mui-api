import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { proxyToApi } from '@/lib/api-proxy';

/**
 * 管理员 API 代理 — 透传所有 /api/admin/* 请求到 API Worker
 * 仅允许管理员访问
 */
async function handleProxy(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { user, isAdmin } = await getSession();
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  if (!isAdmin) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  const { path } = await params;
  const adminPath = `/admin/${path.join('/')}`;
  const url = new URL(request.url);
  const queryString = url.search;

  let body: string | undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    body = await request.text();
  }

  const response = await proxyToApi(`${adminPath}${queryString}`, {
    method: request.method,
    body,
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const DELETE = handleProxy;
