import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getSession } from '@/lib/session';
import { proxyToApi } from '@/lib/api-proxy';
import { generateApiKey, hashApiKey, getKeyPrefix, generateId } from '@/lib/crypto';

/**
 * GET /api/user/keys — 列出当前用户的所有 API Key
 */
export async function GET() {
  const { user } = await getSession();
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  // 先找用户在 API Worker 中的 userId
  const userRes = await proxyToApi(`/admin/user?email=${encodeURIComponent(user.email)}`);
  if (!userRes.ok) {
    return NextResponse.json({ keys: [] });
  }
  const userData = (await userRes.json()) as { user: { userId: string } };
  const userId = userData.user.userId;

  // 从 KV 中列出该用户的 API Key
  const { env } = await getCloudflareContext();
  const kv = env.KV;
  const list = await kv.list({ prefix: `apikey:` });

  const keys: Array<{
    id: string;
    keyPrefix: string;
    isActive: boolean;
    createdAt: string;
  }> = [];

  for (const key of list.keys) {
    const metadata = key.metadata as Record<string, unknown> | null;
    if (metadata && metadata.userId === userId) {
      keys.push({
        id: key.name,
        keyPrefix: (metadata.keyPrefix as string) || 'sk-gw-...',
        isActive: (metadata.isActive as boolean) ?? true,
        createdAt: (metadata.createdAt as string) || '',
      });
    }
  }

  return NextResponse.json({ keys });
}

/**
 * POST /api/user/keys — 生成新的 API Key
 */
export async function POST() {
  const { user } = await getSession();
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  // 查找用户
  const userRes = await proxyToApi(`/admin/user?email=${encodeURIComponent(user.email)}`);
  if (!userRes.ok) {
    return NextResponse.json({ error: '尚未开通 API 服务，请联系管理员充值' }, { status: 400 });
  }
  const userData = (await userRes.json()) as { user: { userId: string } };
  const userId = userData.user.userId;

  // 生成新 Key
  const rawKey = generateApiKey();
  const keyHash = await hashApiKey(rawKey);
  const keyPrefix = getKeyPrefix(rawKey);

  // 写入 KV
  const { env } = await getCloudflareContext();
  const kv = env.KV;
  await kv.put(`apikey:${keyHash}`, userId, {
    metadata: {
      keyPrefix,
      isActive: true,
      userId,
      createdAt: new Date().toISOString(),
    },
  });

  return NextResponse.json({
    rawKey,
    keyPrefix,
    message: 'API Key 已生成，请妥善保管，此 Key 仅显示一次。',
  });
}

/**
 * DELETE /api/user/keys — 吊销 API Key
 * Body: { keyId: string }
 */
export async function DELETE(request: Request) {
  const { user } = await getSession();
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const body = (await request.json()) as { keyId: string };
  if (!body.keyId) {
    return NextResponse.json({ error: '缺少 keyId' }, { status: 400 });
  }

  // 验证这个 key 属于当前用户
  const { env } = await getCloudflareContext();
  const kv = env.KV;

  const userRes = await proxyToApi(`/admin/user?email=${encodeURIComponent(user.email)}`);
  if (!userRes.ok) {
    return NextResponse.json({ error: '用户不存在' }, { status: 404 });
  }
  const userData = (await userRes.json()) as { user: { userId: string } };

  const keyData = await kv.getWithMetadata(body.keyId);
  const metadata = keyData.metadata as Record<string, unknown> | null;

  if (!metadata || metadata.userId !== userData.user.userId) {
    return NextResponse.json({ error: '无权操作此 Key' }, { status: 403 });
  }

  // 标记为不活跃（删除 KV 条目即失效）
  await kv.delete(body.keyId);

  return NextResponse.json({ success: true });
}
