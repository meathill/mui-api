/**
 * 客户端 API 调用层
 * 所有请求走 Next.js API Route，直接操作共享 D1/KV
 */

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
  getUsers: (cursor?: string) =>
    request<{ users: UserInfo[]; cursor: string | null }>(`/api/admin/users${cursor ? `?cursor=${cursor}` : ''}`),

  getUser: (params: { email?: string; userId?: string }) => {
    const query = new URLSearchParams();
    if (params.email) query.set('email', params.email);
    if (params.userId) query.set('userId', params.userId);
    return request<{ user: UserInfo }>(`/api/admin/user?${query}`);
  },

  recharge: (email: string, amount: number) =>
    request<{ success: boolean; userId: string; balance: number }>('/api/admin/recharge', {
      method: 'POST',
      body: JSON.stringify({ email, amount }),
    }),

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

  getUsage: (params: UsageQueryParams) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') query.set(key, String(value));
    }
    return request<{ logs: UsageLog[]; pagination: Pagination }>(`/api/admin/usage?${query}`);
  },

  getGlobalConfig: () => request<{ config: GlobalConfig }>('/api/admin/global-config'),

  setGlobalConfig: (config: Partial<GlobalConfig>) =>
    request('/api/admin/global-config', {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  getSpendingStats: () => request<{ stats: SpendingStats }>('/api/admin/spending-stats'),
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

  getUsage: (params: Omit<UsageQueryParams, 'userId'>) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') query.set(key, String(value));
    }
    return request<{ logs: UsageLog[]; pagination: Pagination }>(`/api/user/usage?${query}`);
  },
};

// 向后兼容，管理员页面使用
export const api = adminApi;

// ==================== 类型定义 ====================

export interface UserInfo {
  userId: string | null;
  email: string;
  balance: number;
  concurrency: number;
  isSuspended: boolean;
  maxConcurrency: number;
  createdAt: string | null;
}

export interface ModelInfo {
  id: string;
  provider: string;
  upstreamModelId: string | null;
  inputPrice: number | null;
  outputPrice: number | null;
  markupRate: number | null;
}

export interface ModelCreateInput {
  id: string;
  provider: string;
  upstreamModelId?: string;
  inputPrice: number;
  outputPrice: number;
  markupRate?: number;
}

export interface UsageLog {
  id: string;
  userId: string | null;
  apiKeyId: string | null;
  modelId: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
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

export interface GlobalConfig {
  dailySpendingCap: number;
  monthlySpendingCap: number;
  adminEmail: string;
  isServicePaused: boolean;
}

export interface SpendingStats {
  dailySpending: number;
  monthlySpending: number;
  dailySpendingCap: number;
  monthlySpendingCap: number;
  isServicePaused: boolean;
}
