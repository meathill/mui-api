import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { type GlobalConfig, getGlobalConfig, getKV, normalizeFreeQuotaConfig, setGlobalConfig } from '@/lib/kv';

function withDefaults(config: Partial<GlobalConfig> | null | undefined): GlobalConfig {
  return {
    dailySpendingCap: 0,
    monthlySpendingCap: 0,
    adminEmail: '',
    isServicePaused: false,
    ...config,
    freeQuota: normalizeFreeQuotaConfig(config?.freeQuota),
  };
}

/**
 * GET /api/admin/global-config — 获取全局配置
 */
export async function GET() {
  try {
    const result = await requireAdmin();
    if ('error' in result) return result.error;

    const kv = await getKV();
    const config = await getGlobalConfig(kv);

    return NextResponse.json({ success: true, config: withDefaults(config) });
  } catch (error) {
    console.error('GET /api/admin/global-config 错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

/**
 * POST /api/admin/global-config — 设置全局配置
 */
export async function POST(request: Request) {
  try {
    const result = await requireAdmin();
    if ('error' in result) return result.error;

    const body = (await request.json()) as Partial<GlobalConfig>;
    const kv = await getKV();

    // 先读取现有配置，合并后写入，避免部分字段覆盖导致数据丢失
    const existing = await getGlobalConfig(kv);
    const merged: GlobalConfig = withDefaults({
      ...existing,
      ...body,
      freeQuota: normalizeFreeQuotaConfig({
        ...existing?.freeQuota,
        ...body.freeQuota,
      }),
    });
    await setGlobalConfig(kv, merged);

    return NextResponse.json({ success: true, config: merged });
  } catch (error) {
    console.error('POST /api/admin/global-config 错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
