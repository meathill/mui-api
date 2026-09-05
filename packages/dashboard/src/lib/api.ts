/**
 * 客户端 API 调用层
 * 所有请求走 Next.js API Route，直接操作共享 D1/KV
 */

import type { FreeQuotaStatus, GlobalConfig } from '@muirouter/shared-db/types';
import { buildQuery } from './query';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (response.status === 401) {
    window.location.href = '/login';
    throw new Error('登录已过期，请重新登录');
  }

  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const err = data.error as Record<string, string> | string | undefined;
    const message = typeof err === 'string' ? err : err?.message;
    throw new Error(message || '请求失败');
  }
  return data as T;
}

// ==================== 管理员 API ====================

export const adminApi = {
  getUsers: (params?: {
    page?: number;
    pageSize?: number;
    q?: string;
    cursor?: string;
    sortBy?: string;
    sortDir?: string;
    sortField?: string;
    sortDirection?: string;
  }) => {
    if (params?.cursor && !params?.q && !params?.page) {
      return request<{ users: UserInfo[]; cursor: string | null; pagination?: Pagination }>(
        `/api/admin/users?cursor=${encodeURIComponent(params.cursor)}`,
      );
    }
    const sortBy = params?.sortBy ?? params?.sortField;
    const sortDir = params?.sortDir ?? params?.sortDirection;
    const qs = buildQuery({
      page: params?.page,
      pageSize: params?.pageSize,
      q: params?.q,
      sortBy,
      sortDir,
    });
    const suffix = qs ? `?${qs}` : '';
    return request<{ users: UserInfo[]; cursor: string | null; pagination?: Pagination }>(`/api/admin/users${suffix}`);
  },

  getUser: (params: { email?: string; userId?: string }) =>
    request<{ user: UserInfo }>(`/api/admin/user?${buildQuery(params)}`),

  recharge: (email: string, amount: number, note?: string) =>
    request<{ success: boolean; userId: string; balance: number }>('/api/admin/recharge', {
      method: 'POST',
      body: JSON.stringify({ email, amount, note }),
    }),

  getRechargeLogs: (params: {
    userId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }) => request<{ logs: RechargeLogItem[]; pagination: Pagination }>(`/api/admin/recharge-logs?${buildQuery(params)}`),

  setConcurrency: (userId: string, maxConcurrency: number) =>
    request('/api/admin/set-concurrency', {
      method: 'POST',
      body: JSON.stringify({ userId, maxConcurrency }),
    }),

  setSpendingLimit: (userId: string, monthlyLimit: number, alertThreshold?: number) =>
    request('/api/admin/set-spending-limit', {
      method: 'POST',
      body: JSON.stringify({ userId, monthlyLimit, alertThreshold }),
    }),

  unsuspendUser: (userId: string) =>
    request('/api/admin/unsuspend-user', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  setRateMultiplier: (userId: string, rateMultiplier: number) =>
    request('/api/admin/set-rate-multiplier', {
      method: 'POST',
      body: JSON.stringify({ userId, rateMultiplier }),
    }),

  getModels: () => request<{ models: ModelInfo[] }>('/api/admin/models'),

  createModel: (model: ModelCreateInput) =>
    request('/api/admin/models', {
      method: 'POST',
      body: JSON.stringify(model),
    }),

  updateModel: (id: string, data: Partial<ModelCreateInput>) =>
    request(`/api/admin/models/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteModel: (id: string) => request(`/api/admin/models/${id}`, { method: 'DELETE' }),

  getUsage: (params: UsageQueryParams) =>
    request<{ logs: UsageLog[]; pagination: Pagination }>(`/api/admin/usage?${buildQuery(params)}`),

  getGlobalConfig: () => request<{ config: GlobalConfig }>('/api/admin/global-config'),

  setGlobalConfig: (config: Partial<GlobalConfig>) =>
    request('/api/admin/global-config', {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  getSpendingStats: () => request<{ stats: SpendingStats }>('/api/admin/spending-stats'),

  getUsageSummary: () => request<{ summary: UsageSummary }>('/api/admin/usage-summary'),

  getStatistics: (params: StatisticsParams) =>
    request<StatisticsResponse>(`/api/admin/statistics?${buildQuery(params)}`),
};

// ==================== 用户 API ====================

export const userApi = {
  getProfile: () => request<{ user: UserInfo }>('/api/user'),

  getKeys: () =>
    request<{
      keys: Array<{
        id: string;
        keyPrefix: string;
        isActive: boolean;
        createdAt: string;
      }>;
    }>('/api/user/keys'),

  createKey: () =>
    request<{ rawKey: string; keyPrefix: string; message: string }>('/api/user/keys', { method: 'POST' }),

  revokeKey: (keyId: string) =>
    request<{ success: boolean }>('/api/user/keys', {
      method: 'DELETE',
      body: JSON.stringify({ keyId }),
    }),

  getUsage: (params: Omit<UsageQueryParams, 'userId'>) =>
    request<{ logs: UsageLog[]; pagination: Pagination }>(`/api/user/usage?${buildQuery(params)}`),

  createTopUpCheckout: (amount: number, locale?: string) =>
    request<TopUpCheckoutResult>('/api/user/top-up/checkout', {
      method: 'POST',
      body: JSON.stringify({ amount, locale }),
    }),

  getTopUpSession: (sessionId: string) =>
    request<TopUpSessionResult>(`/api/user/top-up/session?${new URLSearchParams({ sessionId })}`),
};

// 向后兼容，管理员页面使用
export const api = adminApi;

// ==================== 类型定义 ====================

export interface UserInfo {
  userId: string;
  email: string;
  balance: number;
  concurrency: number;
  freeQuota?: FreeQuotaStatus;
  isSuspended: boolean;
  maxConcurrency: number;
  rateMultiplier: number;
  createdAt: string | null;
}

export interface ModelInfo {
  id: string;
  provider: string;
  upstreamModelId: string | null;
  displayName: string | null;
  contextLength: number | null;
  maxOutputTokens: number | null;
  metadataJson: string | null;
  inputPrice: number | null;
  outputPrice: number | null;
  markupRate: number | null;
  cachedInputPrice: number | null;
  cacheWritePrice: number | null;
  longContextThresholdTokens: number | null;
  longContextInputPrice: number | null;
  longContextCachedInputPrice: number | null;
  longContextCacheWritePrice: number | null;
  longContextOutputPrice: number | null;
}

export interface ModelCreateInput {
  id: string;
  provider: string;
  upstreamModelId?: string;
  inputPrice: number;
  outputPrice: number;
  markupRate?: number;
  displayName?: string | null;
  contextLength?: number | null;
  maxOutputTokens?: number | null;
  metadataJson?: string | null;
  cachedInputPrice?: number | null;
  cacheWritePrice?: number | null;
  longContextThresholdTokens?: number | null;
  longContextInputPrice?: number | null;
  longContextCachedInputPrice?: number | null;
  longContextCacheWritePrice?: number | null;
  longContextOutputPrice?: number | null;
}

export interface UsageLog {
  id: string;
  userId: string | null;
  apiKeyId: string | null;
  modelId: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cachedInputTokens: number | null;
  cacheWriteTokens: number | null;
  cost: number | null;
  createdAt: string | null;
}

export interface UsageQueryParams {
  userId?: string;
  modelId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// 数据形状定义已上移到 shared-db（app / dashboard 共用），此处转发保持既有 import 路径
export type { FreeQuotaConfig, FreeQuotaStatus, GlobalConfig } from '@muirouter/shared-db/types';

export interface RechargeLogItem {
  id: string;
  userId: string;
  operatorId: string | null;
  amount: number;
  balanceAfter: number | null;
  note: string | null;
  createdAt: string | null;
}

export interface UsageSummary {
  cost: number;
  inputTokens: number;
  outputTokens: number;
  requests: number;
}

export interface SpendingStats {
  dailySpending: number;
  monthlySpending: number;
  dailySpendingCap: number;
  monthlySpendingCap: number;
  isServicePaused: boolean;
}

export interface TopUpCheckoutResult {
  sessionId: string;
  url: string;
}

export interface TopUpSessionResult {
  amount: number;
  balanceAfter: number | null;
  paymentStatus: string | null;
  sessionId: string;
  status: 'open' | 'processing' | 'credited' | 'failed' | 'cancelled';
}

export interface StatisticsParams {
  startDate: string;
  endDate: string;
  granularity?: 'hourly' | 'daily' | 'weekly' | 'monthly';
  userId?: string;
}

export interface StatisticsResponse {
  success: boolean;
  overview: {
    totalCost: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    requestCount: number;
  };
  byModel: Array<{
    modelId: string | null;
    totalCost: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    requestCount: number;
  }>;
  byUser: Array<{
    userId: string | null;
    email: string | null;
    totalCost: number;
    requestCount: number;
  }>;
  timeSeries: Array<{
    periodStart: string | number | null;
    totalCost: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    requestCount: number;
  }>;
  source: 'aggregated' | 'realtime';
}
