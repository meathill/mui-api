/**
 * 管理员权限检查
 */
import { NextResponse } from 'next/server';
import { getSession } from './session';

export async function requireAdmin() {
  const { user, isAdmin } = await getSession();
  if (!user) {
    return { error: NextResponse.json({ error: '未登录' }, { status: 401 }) };
  }
  if (!isAdmin) {
    return { error: NextResponse.json({ error: '无权限' }, { status: 403 }) };
  }
  return { user };
}
