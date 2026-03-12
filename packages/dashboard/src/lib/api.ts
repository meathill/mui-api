const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

function getAdminSecret(): string {
  let secret = sessionStorage.getItem("adminSecret");
  if (!secret) {
    secret = prompt("请输入 Admin Secret:");
    if (!secret) throw new Error("需要 Admin Secret");
    sessionStorage.setItem("adminSecret", secret);
  }
  return secret;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Secret": getAdminSecret(),
      ...options.headers,
    },
  });

  if (response.status === 401) {
    sessionStorage.removeItem("adminSecret");
    throw new Error("Admin Secret 无效，请刷新页面重试");
  }

  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const err = data.error as Record<string, string> | undefined;
    throw new Error(err?.message || "请求失败");
  }
  return data as T;
}

export const api = {
  // 用户
  getUsers: (cursor?: string) =>
    request<{ users: UserInfo[]; cursor: string | null }>(
      `/admin/users${cursor ? `?cursor=${cursor}` : ""}`,
    ),

  getUser: (params: { email?: string; userId?: string }) => {
    const query = new URLSearchParams();
    if (params.email) query.set("email", params.email);
    if (params.userId) query.set("userId", params.userId);
    return request<{ user: UserInfo }>(`/admin/user?${query}`);
  },

  recharge: (email: string, amount: number) =>
    request<{ success: boolean; userId: string; balance: number }>(
      "/admin/recharge",
      { method: "POST", body: JSON.stringify({ email, amount }) },
    ),

  setConcurrency: (userId: string, maxConcurrency: number) =>
    request("/admin/set-concurrency", {
      method: "POST",
      body: JSON.stringify({ userId, maxConcurrency }),
    }),

  setSpendingLimit: (userId: string, monthlyLimit: number, alertThreshold?: number) =>
    request("/admin/set-spending-limit", {
      method: "POST",
      body: JSON.stringify({ userId, monthlyLimit, alertThreshold }),
    }),

  unsuspendUser: (userId: string) =>
    request("/admin/unsuspend-user", {
      method: "POST",
      body: JSON.stringify({ userId }),
    }),

  // 模型
  getModels: () => request<{ models: ModelInfo[] }>("/admin/models"),

  createModel: (model: ModelCreateInput) =>
    request("/admin/models", {
      method: "POST",
      body: JSON.stringify(model),
    }),

  updateModel: (id: string, data: Partial<ModelCreateInput>) =>
    request(`/admin/models/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteModel: (id: string) =>
    request(`/admin/models/${id}`, { method: "DELETE" }),

  // 用量
  getUsage: (params: UsageQueryParams) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") query.set(key, String(value));
    }
    return request<{ logs: UsageLog[]; pagination: Pagination }>(`/admin/usage?${query}`);
  },

  // 全局配置
  getGlobalConfig: () => request<{ config: GlobalConfig }>("/admin/global-config"),

  setGlobalConfig: (config: Partial<GlobalConfig>) =>
    request("/admin/global-config", {
      method: "POST",
      body: JSON.stringify(config),
    }),

  getSpendingStats: () => request<{ stats: SpendingStats }>("/admin/spending-stats"),
};

// 类型定义
export interface UserInfo {
  userId: string;
  email: string;
  balance: number;
  concurrency: number;
  isSuspended: boolean;
  maxConcurrency: number;
  createdAt: string;
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
