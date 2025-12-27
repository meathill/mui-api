import { Hono } from "hono";
import type { CloudflareBindings } from "../types";
import { createDb } from "../db";
import { KVService } from "../services/kv-service";
import { KeyService } from "../services/key-service";
import { EmailService } from "../services/email-service";
import { generateId } from "../lib/crypto";
import { RechargeSchema, SetConcurrencySchema, GetUserSchema } from "../lib/validators";
import { badRequest, notFound, internalError, unauthorized, zodErrorToApiError } from "../lib/errors";

const admin = new Hono<{ Bindings: CloudflareBindings }>();

/**
 * 管理员密钥验证中间件
 */
admin.use("/*", async (c, next) => {
  const adminSecret = c.req.header("X-Admin-Secret");
  if (!adminSecret || adminSecret !== c.env.ADMIN_SECRET) {
    return unauthorized(c, "管理员密钥无效");
  }
  await next();
});

/**
 * POST /admin/recharge
 * 充值接口：自动区分新老用户
 */
admin.post("/recharge", async (c) => {
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
      // 新用户
      userId = generateId();
      await kvService.createUser(userId, email, amount);

      const keyResult = await keyService.generateKey(userId);
      const claimResult = await keyService.createClaimToken(userId, keyResult.rawKey);
      const claimUrl = `${c.env.BASE_URL}/claim?token=${claimResult.token}`;
      await emailService.sendClaimEmail(email, claimUrl);

      return c.json({
        success: true,
        isNewUser: true,
        message: "新用户已创建，Claim 邮件已发送",
        userId,
        balance: amount,
        claimUrl,
      });
    }

    // 老用户
    const newBalance = await kvService.addBalance(userId, amount);
    await emailService.sendRechargeSuccessEmail(email, amount, newBalance);

    return c.json({
      success: true,
      isNewUser: false,
      message: "充值成功，通知邮件已发送",
      userId,
      balance: newBalance,
    });
  } catch (error) {
    console.error("充值失败:", error);
    return internalError(c, "充值失败", String(error));
  }
});

/**
 * POST /admin/set-concurrency
 * 设置用户最大并发数
 */
admin.post("/set-concurrency", async (c) => {
  const body = await c.req.json();
  const result = SetConcurrencySchema.safeParse(body);

  if (!result.success) {
    return c.json(zodErrorToApiError(result.error), 400);
  }

  const { userId, maxConcurrency } = result.data;
  const kvService = new KVService(c.env.KV);
  const { data, metadata } = await kvService.getUser(userId);

  if (!data || !metadata) {
    return notFound(c, "用户不存在");
  }

  metadata.maxConcurrency = maxConcurrency;
  await kvService.setUser(userId, data, metadata);

  return c.json({
    success: true,
    userId,
    maxConcurrency,
  });
});

/**
 * GET /admin/user
 * 查询用户信息
 */
admin.get("/user", async (c) => {
  const query = {
    email: c.req.query("email"),
    userId: c.req.query("userId"),
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
      return notFound(c, "用户不存在");
    }
  }

  const { data, metadata } = await kvService.getUser(userId!);
  if (!data || !metadata) {
    return notFound(c, "用户不存在");
  }

  return c.json({
    success: true,
    user: {
      userId,
      email: metadata.email,
      balance: data.balance,
      concurrency: data.concurrency,
      maxConcurrency: metadata.maxConcurrency ?? Number(c.env.DEFAULT_MAX_CONCURRENCY) || 3,
      createdAt: metadata.createdAt,
    },
  });
});

export default admin;
