import { NextResponse } from 'next/server';
import { models } from '@/db/app-schema';
import { getDb } from '@/lib/db';

/**
 * GET /api/models — 公开模型列表（无需鉴权，供 Playground / 定价页使用）
 * 直接读 D1，复用 admin 的 models 表，避免 playground 因 requireAdmin 403 导致空列表。
 */
export async function GET() {
  try {
    const db = await getDb();
    const modelList = await db.select().from(models);
    return NextResponse.json({ success: true, models: modelList });
  } catch (error) {
    console.error('GET /api/models 错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
