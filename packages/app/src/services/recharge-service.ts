import { eq, sql } from "drizzle-orm";
import type { Database } from "../db";
import { users, wallets, type NewUser } from "../db/schema";
import { generateId } from "../lib/crypto";

export interface RechargeResult {
  isNewUser: boolean;
  userId: string;
  newBalance: number;
}

/**
 * 充值服务：处理用户充值逻辑
 */
export class RechargeService {
  constructor(private db: Database) { }

  /**
   * 执行充值操作
   * - 新用户：创建用户和钱包
   * - 老用户：增加余额
   */
  async recharge(email: string, amount: number): Promise<RechargeResult> {
    // 查找用户
    const existingUser = await this.db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      // 老用户：增加余额
      const result = await this.db
        .update(wallets)
        .set({
          balance: sql`${wallets.balance} + ${amount}`,
          updatedAt: new Date(),
        })
        .where(eq(wallets.userId, existingUser.id))
        .returning({ balance: wallets.balance });

      return {
        isNewUser: false,
        userId: existingUser.id,
        newBalance: result[0]?.balance ?? amount,
      };
    }

    // 新用户：创建用户和钱包
    const userId = generateId();
    const newUser: NewUser = {
      id: userId,
      email,
    };

    await this.db.insert(users).values(newUser);
    await this.db.insert(wallets).values({
      userId,
      balance: amount,
      currency: "USD",
    });

    return {
      isNewUser: true,
      userId,
      newBalance: amount,
    };
  }

  /**
   * 获取用户余额
   */
  async getBalance(userId: string): Promise<number> {
    const wallet = await this.db.query.wallets.findFirst({
      where: eq(wallets.userId, userId),
    });
    return wallet?.balance ?? 0;
  }
}
