import { z } from "zod";

// ==================== 管理员接口 ====================

export const RechargeSchema = z.object({
  email: z.string().email("邮箱格式无效"),
  amount: z.number().positive("金额必须大于 0"),
});
export type RechargeInput = z.infer<typeof RechargeSchema>;

export const SetConcurrencySchema = z.object({
  userId: z.string().min(1, "userId 不能为空"),
  maxConcurrency: z.number().int().min(1, "并发数至少为 1").max(100, "并发数最大 100"),
});
export type SetConcurrencyInput = z.infer<typeof SetConcurrencySchema>;

export const GetUserSchema = z.object({
  email: z.string().email("邮箱格式无效").optional(),
  userId: z.string().optional(),
}).refine(
  (data) => data.email || data.userId,
  "必须提供 email 或 userId"
);
export type GetUserInput = z.infer<typeof GetUserSchema>;

// ==================== Claim 接口 ====================

export const ClaimSchema = z.object({
  token: z.string().min(1, "token 不能为空"),
});
export type ClaimInput = z.infer<typeof ClaimSchema>;

// ==================== OpenAI 接口 ====================

export const ChatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "function"]),
  content: z.string().nullable(),
  name: z.string().optional(),
  function_call: z.object({
    name: z.string(),
    arguments: z.string(),
  }).optional(),
});

export const ChatCompletionSchema = z.object({
  model: z.string().min(1, "model 不能为空"),
  messages: z.array(ChatMessageSchema).min(1, "messages 不能为空"),
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
