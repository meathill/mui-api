import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { Hono } from 'hono';
import type { CloudflareBindings } from '../types';
import { createDb } from '../db';
import { models, usageLogs, spendingLimits } from '../db/schema';
import { KVService } from '../services/kv-service';
import { KeyService } from '../services/key-service';
import { EmailService } from '../services/email-service';
import { generateId } from '../lib/crypto';
import {
  RechargeSchema,
  SetConcurrencySchema,
  GetUserSchema,
  ModelCreateSchema,
  ModelUpdateSchema,
  SpendingLimitSchema,
  GlobalConfigSchema,
  UsageQuerySchema,
} from '../lib/validators';
import { badRequest, notFound, internalError, unauthorized, zodErrorToApiError } from '../lib/errors';

const admin = new Hono<{ Bindings: CloudflareBindings }>();

/**
 * 管理员密钥验证中间件
 */
admin.use('/*', async (c, next) => {
  const adminSecret = c.req.header('X-Admin-Secret');
  if (!adminSecret || adminSecret !== c.env.ADMIN_SECRET) {
    return unauthorized(c, '管理员密钥无效');
  }
  await next();
});

// ==================== 用户管理 ====================

/**
 * GET /admin/users
 * 列出所有用户
 */
admin.get('/users', async (c) => {
  const cursor = c.req.query('cursor');
  const kvService = new KVService(c.env.KV);
  const defaultMaxConcurrency = Number(c.env.DEFAULT_MAX_CONCURRENCY) || 3;

  const list = await c.env.KV.list({
    prefix: 'user:',
    cursor: cursor || undefined,
    limit: 50,
  });

  const users = [];
  for (const key of list.keys) {
    const { data, metadata } = await kvService.getUser(key.name.replace('user:', ''));
    if (data && metadata) {
      users.push({
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
    users,
    cursor: list.list_complete ? null : list.cursor,
  });
});

/**
 * POST /admin/recharge
 * 充值接口：自动区分新老用户
 */
admin.post('/recharge', async (c) => {
  const body = await c.req.json();
  const result = RechargeSchema.safeParse(body);

  if (!result.success) {
    return c.json(zodErrorToApiError(result.error), 400);
  }

  const { email, amount } = result.data;
  const db = createDb(c.env.DB);
  const defaultMaxConcurrency = Number(c.env.DEFAULT_MAX_CONCURRENCY) || 3;
  const kvService = new KVService(c.env.KV, defaultMaxConcurrency);
  const keyService = new KeyService(db, kvService);
  const emailService = new EmailService({
    apiKey: c.env.RESEND_API_KEY,
    fromEmail: c.env.FROM_EMAIL,
  });

  try {
    let userId = await kvService.findUserByEmail(email);

    if (!userId) {
      userId = generateId();
      await kvService.createUser(userId, email, amount);

      const keyResult = await keyService.generateKey(userId);
      const claimResult = await keyService.createClaimToken(userId, keyResult.rawKey);
      const claimUrl = `${c.env.BASE_URL}/claim?token=${claimResult.token}`;
      await emailService.sendClaimEmail(email, claimUrl);

      return c.json({
        success: true,
        isNewUser: true,
        message: '新用户已创建，Claim 邮件已发送',
        userId,
        balance: amount,
        claimUrl,
      });
    }

    const newBalance = await kvService.addBalance(userId, amount);
    await emailService.sendRechargeSuccessEmail(email, amount, newBalance);

    return c.json({
      success: true,
      isNewUser: false,
      message: '充值成功，通知邮件已发送',
      userId,
      balance: newBalance,
    });
  } catch (error) {
    console.error('充值失败:', error);
    return internalError(c, '充值失败', String(error));
  }
});

/**
 * POST /admin/set-concurrency
 * 设置用户最大并发数
 */
admin.post('/set-concurrency', async (c) => {
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

  metadata.maxConcurrency = maxConcurrency;
  await kvService.setUser(userId, data, metadata);

  return c.json({ success: true, userId, maxConcurrency });
});

/**
 * GET /admin/user
 * 查询用户信息
 */
admin.get('/user', async (c) => {
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
    userId = await kvService.findUserByEmail(result.data.email);
    if (!userId) {
      return notFound(c, '用户不存在');
    }
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

// ==================== 消费限额 ====================

/**
 * POST /admin/set-spending-limit
 * 设置用户月度消费限额
 */
admin.post('/set-spending-limit', async (c) => {
  const body = await c.req.json();
  const result = SpendingLimitSchema.safeParse(body);

  if (!result.success) {
    return c.json(zodErrorToApiError(result.error), 400);
  }

  const { userId, monthlyLimit, alertThreshold } = result.data;
  const db = createDb(c.env.DB);

  await db
    .insert(spendingLimits)
    .values({
      userId,
      monthlyLimit,
      alertThreshold,
    })
    .onConflictDoUpdate({
      target: spendingLimits.userId,
      set: {
        monthlyLimit,
        alertThreshold,
        updatedAt: new Date(),
      },
    });

  return c.json({ success: true, userId, monthlyLimit, alertThreshold });
});

/**
 * POST /admin/unsuspend-user
 * 解除用户暂停
 */
admin.post('/unsuspend-user', async (c) => {
  const body = await c.req.json();
  const { userId } = body as { userId: string };

  if (!userId) {
    return badRequest(c, 'userId 不能为空');
  }

  const db = createDb(c.env.DB);
  const kvService = new KVService(c.env.KV);

  await kvService.unsuspendUser(userId);

  await db
    .update(spendingLimits)
    .set({ isSuspended: false, updatedAt: new Date() })
    .where(eq(spendingLimits.userId, userId));

  return c.json({ success: true, userId });
});

// ==================== 全局配置 ====================

/**
 * GET /admin/global-config
 * 获取全局配置
 */
admin.get('/global-config', async (c) => {
  const kvService = new KVService(c.env.KV);
  const config = await kvService.getGlobalConfig();

  return c.json({
    success: true,
    config: config ?? {
      dailySpendingCap: 0,
      monthlySpendingCap: 0,
      adminEmail: c.env.ADMIN_EMAIL ?? '',
      isServicePaused: false,
    },
  });
});

/**
 * POST /admin/global-config
 * 设置全局消费阈值
 */
admin.post('/global-config', async (c) => {
  const body = await c.req.json();
  const result = GlobalConfigSchema.safeParse(body);

  if (!result.success) {
    return c.json(zodErrorToApiError(result.error), 400);
  }

  const kvService = new KVService(c.env.KV);
  const config = {
    ...result.data,
    adminEmail: result.data.adminEmail ?? c.env.ADMIN_EMAIL ?? '',
  };
  await kvService.setGlobalConfig(config);

  return c.json({ success: true, config });
});

// ==================== 模型管理 ====================

/**
 * GET /admin/models
 * 列出所有模型
 */
admin.get('/models', async (c) => {
  const db = createDb(c.env.DB);
  const modelList = await db.select().from(models);
  return c.json({ success: true, models: modelList });
});

/**
 * POST /admin/models
 * 创建模型
 */
admin.post('/models', async (c) => {
  const body = await c.req.json();
  const result = ModelCreateSchema.safeParse(body);

  if (!result.success) {
    return c.json(zodErrorToApiError(result.error), 400);
  }

  const db = createDb(c.env.DB);

  try {
    await db.insert(models).values(result.data);
    return c.json({ success: true, model: result.data }, 201);
  } catch (error) {
    if (String(error).includes('UNIQUE')) {
      return badRequest(c, `模型 ${result.data.id} 已存在`);
    }
    throw error;
  }
});

/**
 * PUT /admin/models/:id
 * 更新模型
 */
admin.put('/models/:id', async (c) => {
  const modelId = c.req.param('id');
  const body = await c.req.json();
  const result = ModelUpdateSchema.safeParse(body);

  if (!result.success) {
    return c.json(zodErrorToApiError(result.error), 400);
  }

  const db = createDb(c.env.DB);
  const existing = await db.select().from(models).where(eq(models.id, modelId)).get();
  if (!existing) {
    return notFound(c, `模型 ${modelId} 不存在`);
  }

  await db.update(models).set(result.data).where(eq(models.id, modelId));

  return c.json({ success: true, model: { ...existing, ...result.data } });
});

/**
 * DELETE /admin/models/:id
 * 删除模型
 */
admin.delete('/models/:id', async (c) => {
  const modelId = c.req.param('id');
  const db = createDb(c.env.DB);

  const existing = await db.select().from(models).where(eq(models.id, modelId)).get();
  if (!existing) {
    return notFound(c, `模型 ${modelId} 不存在`);
  }

  await db.delete(models).where(eq(models.id, modelId));

  return c.json({ success: true, modelId });
});

// ==================== 用量统计 ====================

/**
 * GET /admin/usage
 * 查询用量日志
 */
admin.get('/usage', async (c) => {
  const query = {
    userId: c.req.query('userId'),
    modelId: c.req.query('modelId'),
    startDate: c.req.query('startDate'),
    endDate: c.req.query('endDate'),
    page: c.req.query('page'),
    pageSize: c.req.query('pageSize'),
  };

  const result = UsageQuerySchema.safeParse(query);
  if (!result.success) {
    return c.json(zodErrorToApiError(result.error), 400);
  }

  const { userId, modelId, startDate, endDate, page, pageSize } = result.data;
  const db = createDb(c.env.DB);

  const conditions = [];
  if (userId) conditions.push(eq(usageLogs.userId, userId));
  if (modelId) conditions.push(eq(usageLogs.modelId, modelId));
  if (startDate) conditions.push(gte(usageLogs.createdAt, new Date(startDate)));
  if (endDate) conditions.push(lte(usageLogs.createdAt, new Date(endDate)));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const countResult = await db.select({ count: sql<number>`count(*)` }).from(usageLogs).where(where).get();
  const total = countResult?.count ?? 0;

  const offset = (page - 1) * pageSize;
  const logs = await db
    .select()
    .from(usageLogs)
    .where(where)
    .orderBy(desc(usageLogs.createdAt))
    .limit(pageSize)
    .offset(offset);

  return c.json({
    success: true,
    logs,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

/**
 * GET /admin/spending-stats
 * 消费统计
 */
admin.get('/spending-stats', async (c) => {
  const kvService = new KVService(c.env.KV);

  const today = new Date().toISOString().slice(0, 10);
  const month = new Date().toISOString().slice(0, 7);

  const [dailySpending, monthlySpending, globalConfig] = await Promise.all([
    c.env.KV.get<number>(`stats:daily:${today}`, 'json'),
    c.env.KV.get<number>(`stats:monthly:${month}`, 'json'),
    kvService.getGlobalConfig(),
  ]);

  return c.json({
    success: true,
    stats: {
      dailySpending: dailySpending ?? 0,
      monthlySpending: monthlySpending ?? 0,
      dailySpendingCap: globalConfig?.dailySpendingCap ?? 0,
      monthlySpendingCap: globalConfig?.monthlySpendingCap ?? 0,
      isServicePaused: globalConfig?.isServicePaused ?? false,
    },
  });
});

export default admin;
