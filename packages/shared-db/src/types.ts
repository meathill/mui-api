// 共享 KV 数据形状。packages/app 与 packages/dashboard 共用同一个 KV namespace，
// 各记录的读写双方必须使用同一份类型定义，避免各自漂移。

// `user:{userId}` 记录的 data 部分。只读展示镜像，唯一写者是 WalletDO。
export interface KVUserData {
  balance: number;
  concurrency: number; // Durable Object 同步回 KV 的并发展示镜像，不参与准入判断
  freeQuotaUsed?: number; // 已消耗的全局免费额度，单位 USD
  isSuspended?: boolean;
}

// `user:{userId}` 记录的 metadata 部分。
export interface KVUserMetadata {
  maxConcurrency?: number;
  rateMultiplier?: number; // 用户费率倍率，默认 1
  stripeCustomerId?: string; // dashboard 自助充值流程写入
  email: string;
  createdAt: string;
}

// `config:global` 记录。
export interface FreeQuotaConfig {
  enabled: boolean;
  amount: number;
  modelIds: string[];
}

export interface GlobalConfig {
  dailySpendingCap: number;
  monthlySpendingCap: number;
  adminEmail: string;
  isServicePaused: boolean;
  freeQuota?: FreeQuotaConfig;
}

// 免费额度的用户侧状态（配置 + 消耗），dashboard 用户接口返回该形状。
export interface FreeQuotaStatus extends FreeQuotaConfig {
  used: number;
  remaining: number;
}
