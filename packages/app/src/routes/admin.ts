import { Hono } from "hono";
import type { CloudflareBindings } from "../types";
import { createDb } from "../db";
import { RechargeService } from "../services/recharge-service";
import { KeyService } from "../services/key-service";
import { EmailService } from "../services/email-service";

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
 */
admin.post("/recharge", async (c) => {
  const body = await c.req.json<{ email: string; amount: number }>();
  const { email, amount } = body;

  if (!email || !amount || amount <= 0) {
    return c.json({ error: "参数错误：需要 email 和正数 amount" }, 400);
  }

  const db = createDb(c.env.DB);
  const rechargeService = new RechargeService(db);
  const keyService = new KeyService(db);
  const emailService = new EmailService({
    apiKey: c.env.RESEND_API_KEY,
    fromEmail: c.env.FROM_EMAIL,
  });

  try {
    // 执行充值
    const result = await rechargeService.recharge(email, amount);

    if (result.isNewUser) {
      // 新用户：生成 API Key 并发送 Claim 邮件
      const keyResult = await keyService.generateKey(result.userId);
      const claimResult = await keyService.createClaimToken(
        result.userId,
        keyResult.rawKey
      );

      const claimUrl = `${c.env.BASE_URL}/claim?token=${claimResult.token}`;
      await emailService.sendClaimEmail(email, claimUrl);

      return c.json({
        success: true,
        isNewUser: true,
        message: "新用户已创建，Claim 邮件已发送",
        userId: result.userId,
        balance: result.newBalance,
        claimUrl, // 仅调试用，生产环境可移除
      });
    }

    // 老用户：发送充值成功邮件
    await emailService.sendRechargeSuccessEmail(
      email,
      amount,
      result.newBalance
    );

    return c.json({
      success: true,
      isNewUser: false,
      message: "充值成功，通知邮件已发送",
      userId: result.userId,
      balance: result.newBalance,
    });
  } catch (error) {
    console.error("充值失败:", error);
    return c.json(
      { error: "充值失败", details: String(error) },
      500
    );
  }
});

export default admin;
