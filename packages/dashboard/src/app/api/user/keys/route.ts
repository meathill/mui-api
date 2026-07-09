import { generateApiKey, getKeyPrefix, hashApiKey } from '@muirouter/shared-db/crypto';
import { NextResponse } from 'next/server';
import { deleteApiKey, getApiKeyMetadata, getKV, getUserData, listUserApiKeys, storeApiKey } from '@/lib/kv';
import { getSession } from '@/lib/session';
import { createWalletUser, getWallet } from '@/lib/wallet-do';

/**
 * GET /api/user/keys — 列出当前用户的所有 API Key
 */
export async function GET() {
  try {
    const { user } = await getSession();
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const kv = await getKV();
    const keys = await listUserApiKeys(kv, user.id);
    return NextResponse.json({ keys });
  } catch (error) {
    console.error('GET /api/user/keys 错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

/**
 * POST /api/user/keys — 生成新的 API Key
 */
export async function POST() {
  try {
    const { user } = await getSession();
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const rawKey = generateApiKey();
    const keyHash = await hashApiKey(rawKey);
    const keyPrefix = getKeyPrefix(rawKey);

    const kv = await getKV();

    // 确保 KV 中有用户数据（否则 API Key 校验时会因 user 不存在返回 401）
    const { data } = await getUserData(kv, user.id);
    if (!data) {
      const wallet = await getWallet();
      await createWalletUser(wallet, user.id, user.email);
    }

    await storeApiKey(kv, keyHash, user.id, keyPrefix);

    return NextResponse.json({
      rawKey,
      keyPrefix,
      message: 'API Key 已生成，请妥善保管，此 Key 仅显示一次。',
    });
  } catch (error) {
    console.error('POST /api/user/keys 错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

/**
 * DELETE /api/user/keys — 吊销 API Key
 * Body: { keyId: string }
 */
export async function DELETE(request: Request) {
  try {
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
  } catch (error) {
    console.error('DELETE /api/user/keys 错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
