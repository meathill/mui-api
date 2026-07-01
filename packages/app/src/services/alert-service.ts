import { eq } from 'drizzle-orm';
import type { Database } from '../db';
import { spendingLimits } from '../db/schema';
import type { FreeQuotaConfig } from '../types';
import type { EmailService } from './email-service';
import type { KVService } from './kv-service';
import type { WalletService } from './wallet-service';

// 告警冷却时间：24 小时内不重复发送
const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export interface GlobalConfig {
  dailySpendingCap: number;
  monthlySpendingCap: number;
  adminEmail: string;
  isServicePaused: boolean;
  freeQuota?: FreeQuotaConfig;
}

/**
 * 消费告警服务
 * 在每次计费完成后检查：
 * 1. 单用户月度消费限额
 * 2. 全局日/月消费上限
 */
export class AlertService {
  constructor(
    private kvService: KVService,
    private db: Database,
    private emailService: EmailService,
    private adminEmail: string,
    private walletService: WalletService,
  ) {}

  /**
   * 计费完成后调用，检查所有告警条件
   */
  async checkAfterBilling(userId: string, cost: number): Promise<void> {
    await Promise.all([this.checkUserSpending(userId, cost), this.checkGlobalSpending(cost)]);
  }

  /**
   * 检查单用户月度消费限额
   */
  private async checkUserSpending(userId: string, cost: number): Promise<void> {
    // 查询用户的消费限额配置
    const limit = await this.db.select().from(spendingLimits).where(eq(spendingLimits.userId, userId)).get();

    if (!limit?.monthlyLimit) return;

    // 累加 KV 中的月度消费
    const monthKey = this.getMonthKey();
    const totalSpending = await this.kvService.incrementUserMonthlySpending(userId, monthKey, cost);

    const threshold = limit.alertThreshold ?? 0.8;
    const ratio = totalSpending / limit.monthlyLimit;

    if (ratio >= 1) {
      // 到达 100%：暂停用户
      await this.suspendUser(userId, totalSpending, limit.monthlyLimit);
    } else if (ratio >= threshold) {
      // 到达告警阈值（默认 80%）：发邮件（有冷却期）
      await this.sendUserAlert(userId, limit.lastAlertAt, totalSpending, limit.monthlyLimit);
    }
  }

  /**
   * 检查全局消费阈值
   */
  private async checkGlobalSpending(cost: number): Promise<void> {
    const config = await this.kvService.getGlobalConfig();
    if (!config) return;

    const today = new Date().toISOString().slice(0, 10);
    const monthKey = this.getMonthKey();

    // 累加全局消费
    const [dailyTotal, monthlyTotal] = await Promise.all([
      this.kvService.incrementGlobalSpending(`daily:${today}`, cost, 48 * 3600),
      this.kvService.incrementGlobalSpending(`monthly:${monthKey}`, cost, 35 * 24 * 3600),
    ]);

    // 检查日消费上限
    if (config.dailySpendingCap > 0 && dailyTotal >= config.dailySpendingCap) {
      await this.kvService.setGlobalConfig({ ...config, isServicePaused: true });
      await this.sendGlobalAlert('日', dailyTotal, config.dailySpendingCap);
    }

    // 检查月消费上限
    if (config.monthlySpendingCap > 0 && monthlyTotal >= config.monthlySpendingCap) {
      await this.kvService.setGlobalConfig({ ...config, isServicePaused: true });
      await this.sendGlobalAlert('月', monthlyTotal, config.monthlySpendingCap);
    }
  }

  /**
   * 暂停用户并发送通知
   */
  private async suspendUser(userId: string, totalSpending: number, monthlyLimit: number): Promise<void> {
    // 更新 KV 中的 isSuspended 状态
    await this.walletService.suspend(userId);

    // 更新 DB 中的 isSuspended 状态
    await this.db
      .update(spendingLimits)
      .set({
        isSuspended: true,
        lastAlertAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(spendingLimits.userId, userId));

    // 发送邮件
    await this.emailService.sendAlertEmail(
      this.adminEmail,
      `[停服] 用户 ${userId} 已超出月度限额`,
      `用户 ${userId} 月度消费 $${totalSpending.toFixed(4)} 已超出限额 $${monthlyLimit.toFixed(2)}，已自动暂停服务。`,
    );
  }

  /**
   * 发送用户消费告警（有冷却期）
   */
  private async sendUserAlert(
    userId: string,
    lastAlertAt: Date | null,
    totalSpending: number,
    monthlyLimit: number,
  ): Promise<void> {
    // 检查冷却期
    if (lastAlertAt) {
      const timeSinceLastAlert = Date.now() - lastAlertAt.getTime();
      if (timeSinceLastAlert < ALERT_COOLDOWN_MS) return;
    }

    const percent = Math.round((totalSpending / monthlyLimit) * 100);

    // 更新告警时间
    await this.db
      .update(spendingLimits)
      .set({ lastAlertAt: new Date(), updatedAt: new Date() })
      .where(eq(spendingLimits.userId, userId));

    // 发送邮件
    await this.emailService.sendAlertEmail(
      this.adminEmail,
      `[告警] 用户 ${userId} 消费已达月度限额的 ${percent}%`,
      `用户 ${userId} 月度消费 $${totalSpending.toFixed(4)}，限额 $${monthlyLimit.toFixed(2)}（${percent}%）。`,
    );
  }

  /**
   * 发送全局消费告警
   */
  private async sendGlobalAlert(period: string, totalSpending: number, cap: number): Promise<void> {
    await this.emailService.sendAlertEmail(
      this.adminEmail,
      `[告警] 全局${period}消费已达上限`,
      `全局${period}消费 $${totalSpending.toFixed(4)} 已达上限 $${cap.toFixed(2)}，服务已自动暂停。`,
    );
  }

  private getMonthKey(): string {
    return new Date().toISOString().slice(0, 7); // YYYY-MM
  }
}
