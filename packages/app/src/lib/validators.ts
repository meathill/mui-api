import { z } from 'zod';

// ==================== 管理员接口 ====================

export const RechargeSchema = z.object({
  email: z.string().email('邮箱格式无效'),
  amount: z.number().positive('金额必须大于 0'),
  note: z.string().optional(),
});
export type RechargeInput = z.infer<typeof RechargeSchema>;

export const SetConcurrencySchema = z.object({
  userId: z.string().min(1, 'userId 不能为空'),
  maxConcurrency: z.number().int().min(1, '并发数至少为 1').max(100, '并发数最大 100'),
});
export type SetConcurrencyInput = z.infer<typeof SetConcurrencySchema>;

export const GetUserSchema = z
  .object({
    email: z.string().email('邮箱格式无效').optional(),
    userId: z.string().optional(),
  })
  .refine((data) => data.email || data.userId, '必须提供 email 或 userId');
export type GetUserInput = z.infer<typeof GetUserSchema>;

// ==================== 模型管理 ====================

export const ProviderSchema = z.enum([
  'openai',
  'anthropic',
  'google-ai-studio',
  'moonshot',
  'workers-ai',
  'xiaomi-mimo',
  'grok',
]);
export type ProviderInput = z.infer<typeof ProviderSchema>;

export const ModelCreateSchema = z.object({
  id: z.string().min(1, '模型 ID 不能为空'),
  provider: ProviderSchema,
  upstreamModelId: z.string().optional(),
  inputPrice: z.number().min(0, '价格不能为负'),
  outputPrice: z.number().min(0, '价格不能为负'),
  markupRate: z.number().min(1).default(1.2),
  // cache 单价：null / 缺省视为未启用，计费时回退基础 input 价
  cachedInputPrice: z.number().min(0, '价格不能为负').nullable().optional(),
  cacheWritePrice: z.number().min(0, '价格不能为负').nullable().optional(),
  // 长上下文档位：null / 缺省视为永远 standard 档
  longContextThresholdTokens: z.number().int().positive('阈值必须为正整数').nullable().optional(),
  longContextInputPrice: z.number().min(0, '价格不能为负').nullable().optional(),
  longContextCachedInputPrice: z.number().min(0, '价格不能为负').nullable().optional(),
  longContextCacheWritePrice: z.number().min(0, '价格不能为负').nullable().optional(),
  longContextOutputPrice: z.number().min(0, '价格不能为负').nullable().optional(),
});
export type ModelCreateInput = z.infer<typeof ModelCreateSchema>;

export const ModelUpdateSchema = ModelCreateSchema.partial().omit({ id: true });
export type ModelUpdateInput = z.infer<typeof ModelUpdateSchema>;

// ==================== 消费限额 ====================

export const SpendingLimitSchema = z.object({
  userId: z.string().min(1, 'userId 不能为空'),
  monthlyLimit: z.number().positive('限额必须大于 0'),
  alertThreshold: z.number().min(0).max(1).default(0.8),
});
export type SpendingLimitInput = z.infer<typeof SpendingLimitSchema>;

const DEFAULT_FREE_QUOTA = {
  enabled: false,
  amount: 0,
  modelIds: [] as string[],
};

export const FreeQuotaConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    amount: z.number().min(0, '免费额度不能为负').default(0),
    modelIds: z
      .array(z.string())
      .default([])
      .transform((modelIds) => Array.from(new Set(modelIds.map((id) => id.trim()).filter(Boolean)))),
  })
  .default(DEFAULT_FREE_QUOTA);
export type FreeQuotaConfigInput = z.infer<typeof FreeQuotaConfigSchema>;

export const GlobalConfigSchema = z.object({
  dailySpendingCap: z.number().min(0).default(0),
  monthlySpendingCap: z.number().min(0).default(0),
  adminEmail: z.string().email().optional(),
  isServicePaused: z.boolean().default(false),
  freeQuota: FreeQuotaConfigSchema,
});
export type GlobalConfigInput = z.infer<typeof GlobalConfigSchema>;

// ==================== 用量查询 ====================

export const UsageQuerySchema = z.object({
  userId: z.string().optional(),
  modelId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type UsageQueryInput = z.infer<typeof UsageQuerySchema>;

// ==================== OpenAI 接口 ====================

export const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'function']),
  content: z.string().nullable(),
  name: z.string().optional(),
  function_call: z
    .object({
      name: z.string(),
      arguments: z.string(),
    })
    .optional(),
});

export const ChatCompletionSchema = z.object({
  model: z.string().min(1, 'model 不能为空'),
  messages: z.array(ChatMessageSchema).min(1, 'messages 不能为空'),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  n: z.number().int().min(1).max(10).optional(),
  stream: z.boolean().optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  max_tokens: z.number().int().positive().optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
});
export type ChatCompletionInput = z.infer<typeof ChatCompletionSchema>;
