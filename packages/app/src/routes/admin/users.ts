import { Hono } from 'hono';
import { internalError, notFound, zodErrorToApiError } from '../../lib/errors';
import { GetUserSchema, SetConcurrencySchema } from '../../lib/validators';
import { KVService } from '../../services/kv-service';
import { WalletService } from '../../services/wallet-service';
import type { CloudflareBindings } from '../../types';

const users = new Hono<{ Bindings: CloudflareBindings }>();

/**
 * GET /admin/users
 * 列出所有用户
 */
users.get('/', async (c) => {
  const cursor = c.req.query('cursor');
  const kvService = new KVService(c.env.KV);
  const defaultMaxConcurrency = Number(c.env.DEFAULT_MAX_CONCURRENCY) || 3;

  const list = await c.env.KV.list({
    prefix: 'user:',
    cursor: cursor || undefined,
    limit: 50,
  });

  const userList = [];
  for (const key of list.keys) {
    const { data, metadata } = await kvService.getUser(key.name.replace('user:', ''));
    if (data && metadata) {
      userList.push({
        userId: key.name.replace('user:', ''),
        email: metadata.email,
        balance: data.balance,
        concurrency: data.concurrency,
        isSuspended: data.isSuspended ?? false,
        maxConcurrency: metadata.maxConcurrency ?? defaultMaxConcurrency,
        createdAt: metadata.createdAt,
      });
    }
  }

  return c.json({
    success: true,
    users: userList,
    cursor: list.list_complete ? null : list.cursor,
  });
});

/**
 * POST /admin/sync-wallet-mirror
 * 把用户的 KV 展示镜像强制刷新为 WalletDO 权威账本当前值（运维用，
 * 修复镜像被旁路写脏的场景）。Body: { userId?: string, email?: string }
 */
users.post('/sync-wallet-mirror', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { userId?: string; email?: string };
  let userId = body.userId;

  if (!userId && body.email) {
    const kvService = new KVService(c.env.KV);
    userId = (await kvService.findUserByEmail(body.email)) ?? undefined;
  }
  if (!userId) {
    return notFound(c, '用户不存在（需提供 userId 或已注册的 email）');
  }

  try {
    const walletService = new WalletService(c.env);
    const { data } = await walletService.syncMirror(userId);
    return c.json({
      success: true,
      userId,
      balance: data.balance,
      concurrency: data.concurrency,
    });
  } catch (error) {
    console.error('同步钱包镜像失败:', error);
    return internalError(c, '同步钱包镜像失败', String(error));
  }
});

/**
 * POST /admin/set-concurrency
 * 设置用户最大并发数
 */
users.post('/set-concurrency', async (c) => {
  const body = await c.req.json();
  const result = SetConcurrencySchema.safeParse(body);

  if (!result.success) {
    return c.json(zodErrorToApiError(result.error), 400);
  }

  const { userId, maxConcurrency } = result.data;
  const kvService = new KVService(c.env.KV);
  const { data, metadata } = await kvService.getUser(userId);

  if (!data || !metadata) {
    return notFound(c, '用户不存在');
  }

  const walletService = new WalletService(c.env);
  await walletService.setMetadata(userId, { maxConcurrency });

  return c.json({ success: true, userId, maxConcurrency });
});

/**
 * GET /admin/user
 * 查询用户信息
 */
users.get('/user', async (c) => {
  const query = {
    email: c.req.query('email'),
    userId: c.req.query('userId'),
  };

  const result = GetUserSchema.safeParse(query);
  if (!result.success) {
    return c.json(zodErrorToApiError(result.error), 400);
  }

  const kvService = new KVService(c.env.KV);
  let userId = result.data.userId;

  if (!userId && result.data.email) {
    const found = await kvService.findUserByEmail(result.data.email);
    if (!found) {
      return notFound(c, '用户不存在');
    }
    userId = found;
  }

  const { data, metadata } = await kvService.getUser(userId!);
  if (!data || !metadata) {
    return notFound(c, '用户不存在');
  }

  return c.json({
    success: true,
    user: {
      userId,
      email: metadata.email,
      balance: data.balance,
      concurrency: data.concurrency,
      isSuspended: data.isSuspended ?? false,
      maxConcurrency: metadata.maxConcurrency ?? (Number(c.env.DEFAULT_MAX_CONCURRENCY) || 3),
      createdAt: metadata.createdAt,
    },
  });
});

export default users;
