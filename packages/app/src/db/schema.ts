import { type NewAuthUser as NewUser, type AuthUser as User, user } from '@muirouter/shared-db/auth';
import {
  type Model,
  models,
  type NewModel,
  type NewRechargeLog,
  type NewSpendingLimit,
  type NewStripeTopupSession,
  type NewUsageLog,
  type NewUsageStat,
  type NewWallet,
  type RechargeLog,
  rechargeLogs,
  type SpendingLimit,
  type StripeTopupSession,
  spendingLimits,
  stripeTopupSessions,
  type UsageLog,
  type UsageStat,
  usageLogs,
  usageStats,
  type Wallet,
  wallets,
} from '@muirouter/shared-db/business';

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
