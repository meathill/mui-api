import {
  models,
  rechargeLogs,
  spendingLimits,
  stripeTopupSessions,
  usageLogs,
  usageStats,
  wallets,
  type Model,
  type NewModel,
  type NewRechargeLog,
  type NewSpendingLimit,
  type NewStripeTopupSession,
  type NewUsageLog,
  type NewUsageStat,
  type NewWallet,
  type RechargeLog,
  type SpendingLimit,
  type StripeTopupSession,
  type UsageLog,
  type UsageStat,
  type Wallet,
} from '@muirouter/shared-db/business';
import { user, type AuthUser as User, type NewAuthUser as NewUser } from '@muirouter/shared-db/auth';

// 向后兼容 app 侧既有命名；底层已切到 better-auth 的 user 表。
export const users = user;

export { models, rechargeLogs, spendingLimits, stripeTopupSessions, usageLogs, usageStats, wallets };

export type {
  Model,
  NewModel,
  NewRechargeLog,
  NewSpendingLimit,
  NewStripeTopupSession,
  NewUsageLog,
  NewUsageStat,
  NewWallet,
  RechargeLog,
  SpendingLimit,
  StripeTopupSession,
  UsageLog,
  UsageStat,
  User,
  NewUser,
  Wallet,
};
