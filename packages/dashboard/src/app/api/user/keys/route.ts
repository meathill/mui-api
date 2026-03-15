import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getKV, listUserApiKeys, storeApiKey, deleteApiKey, getApiKeyMetadata } from '@/lib/kv';
import { generateApiKey, hashApiKey, getKeyPrefix } from '@/lib/crypto';

/**
 * GET /api/user/keys — 列出当前用户的所有 API Key
 */
export async function GET() {
  const { user } = await getSession();
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const kv = await getKV();
  const keys = await listUserApiKeys(kv, user.id);
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

  const rawKey = generateApiKey();
  const keyHash = await hashApiKey(rawKey);
  const keyPrefix = getKeyPrefix(rawKey);

  const kv = await getKV();
  await storeApiKey(kv, keyHash, user.id, keyPrefix);

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

  const kv = await getKV();
  const metadata = await getApiKeyMetadata(kv, body.keyId);
  if (!metadata || metadata.userId !== user.id) {
    return NextResponse.json({ error: '无权操作此 Key' }, { status: 403 });
  }

  await deleteApiKey(kv, body.keyId);
  return NextResponse.json({ success: true });
}
