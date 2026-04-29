import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDb } from '../../db';
import { rechargeLogs, spendingLimits, usageLogs } from '../../db/schema';
import { badRequest, zodErrorToApiError } from '../../lib/errors';
import { GlobalConfigSchema, SpendingLimitSchema, UsageQuerySchema } from '../../lib/validators';
import { KVService } from '../../services/kv-service';
import type { CloudflareBindings } from '../../types';

const spending = new Hono<{ Bindings: CloudflareBindings }>();

// ==================== 消费限额 ====================

/**
 * POST /admin/set-spending-limit
 * 设置用户月度消费限额
 */
spending.post('/set-spending-limit', async (c) => {
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
spending.post('/unsuspend-user', async (c) => {
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
spending.get('/global-config', async (c) => {
  const kvService = new KVService(c.env.KV);
  const config = await kvService.getGlobalConfig();

  return c.json({
    success: true,
    config: config ?? {
      dailySpendingCap: 0,
      monthlySpendingCap: 0,
      adminEmail: c.env.ADMIN_EMAIL ?? '',
      isServicePaused: false,
      freeQuota: {
        enabled: false,
        amount: 0,
        modelIds: [],
      },
    },
  });
});

/**
 * POST /admin/global-config
 * 设置全局消费阈值
 */
spending.post('/global-config', async (c) => {
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

// ==================== 用量统计 ====================

/**
 * GET /admin/usage
 * 查询用量日志
 */
spending.get('/usage', async (c) => {
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
spending.get('/spending-stats', async (c) => {
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

// ==================== 充值记录 ====================

/**
 * GET /admin/recharge-logs
 * 查询充值记录
 */
spending.get('/recharge-logs', async (c) => {
  const userId = c.req.query('userId');
  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(c.req.query('pageSize')) || 20));

  const db = createDb(c.env.DB);

  const conditions = [];
  if (userId) conditions.push(eq(rechargeLogs.userId, userId));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const countResult = await db.select({ count: sql<number>`count(*)` }).from(rechargeLogs).where(where).get();
  const total = countResult?.count ?? 0;

  const offset = (page - 1) * pageSize;
  const logs = await db
    .select()
    .from(rechargeLogs)
    .where(where)
    .orderBy(desc(rechargeLogs.createdAt))
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

export default spending;
