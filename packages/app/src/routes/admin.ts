import { Hono } from "hono";
import type { CloudflareBindings } from "../types";
import { createDb } from "../db";
import { KVService } from "../services/kv-service";
import { KeyService } from "../services/key-service";
import { EmailService } from "../services/email-service";
import { generateId } from "../lib/crypto";

const admin = new Hono<{ Bindings: CloudflareBindings }>();

/**
 * 管理员密钥验证中间件
 */
admin.use("/*", async (c, next) => {
  const adminSecret = c.req.header("X-Admin-Secret");
  if (!adminSecret || adminSecret !== c.env.ADMIN_SECRET) {
    return c.json({ error: "未授权" }, 401);
  }
  await next();
});

/**
 * POST /admin/recharge
 * 充值接口：自动区分新老用户
 * - 新用户：KV 创建用户 + 生成 API Key + 发送 Claim 邮件
 * - 老用户：KV 增加余额 + 发送充值通知邮件
 */
admin.post("/recharge", async (c) => {
  const body = await c.req.json<{ email: string; amount: number }>();
  const { email, amount } = body;

  if (!email || !amount || amount <= 0) {
    return c.json({ error: "参数错误：需要 email 和正数 amount" }, 400);
  }

  const db = createDb(c.env.DB);
  const defaultMaxConcurrency = Number(c.env.DEFAULT_MAX_CONCURRENCY) || 3;
  const kvService = new KVService(c.env.KV, defaultMaxConcurrency);
  const keyService = new KeyService(db, kvService);
  const emailService = new EmailService({
    apiKey: c.env.RESEND_API_KEY,
    fromEmail: c.env.FROM_EMAIL,
  });

  try {
    // 查找用户
    let userId = await kvService.findUserByEmail(email);
    let isNewUser = false;

    if (!userId) {
      // 新用户：创建用户
      userId = generateId();
      await kvService.createUser(userId, email, amount);
      isNewUser = true;

      // 生成 API Key 并发送 Claim 邮件
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

    // 老用户：增加余额
    const newBalance = await kvService.addBalance(userId, amount);

    // 发送充值成功邮件
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
    return c.json(
      { error: "充值失败", details: String(error) },
      500
    );
  }
});

/**
 * POST /admin/set-concurrency
 * 设置用户最大并发数
 */
admin.post("/set-concurrency", async (c) => {
  const body = await c.req.json<{ userId: string; maxConcurrency: number }>();
  const { userId, maxConcurrency } = body;

  if (!userId || !maxConcurrency || maxConcurrency < 1) {
    return c.json({ error: "参数错误：需要 userId 和正整数 maxConcurrency" }, 400);
  }

  const kvService = new KVService(c.env.KV);
  const { data, metadata } = await kvService.getUser(userId);

  if (!data || !metadata) {
    return c.json({ error: "用户不存在" }, 404);
  }

  metadata.maxConcurrency = maxConcurrency;
  await kvService.setUser(userId, data, metadata);

  return c.json({
    success: true,
    userId,
    maxConcurrency,
  });
});

export default admin;
