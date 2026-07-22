import { describe, expect, it } from 'vitest';
import {
  ChatCompletionSchema,
  GetUserSchema,
  GlobalConfigSchema,
  ModelCreateSchema,
  ModelUpdateSchema,
  SetConcurrencySchema,
  SpendingLimitSchema,
  UsageQuerySchema,
} from './validators';

describe('SetConcurrencySchema', () => {
  it('接受合法输入', () => {
    const result = SetConcurrencySchema.safeParse({ userId: 'u1', maxConcurrency: 5 });
    expect(result.success).toBe(true);
  });

  it('拒绝空 userId', () => {
    const result = SetConcurrencySchema.safeParse({ userId: '', maxConcurrency: 5 });
    expect(result.success).toBe(false);
  });

  it('拒绝超范围并发数', () => {
    expect(SetConcurrencySchema.safeParse({ userId: 'u1', maxConcurrency: 0 }).success).toBe(false);
    expect(SetConcurrencySchema.safeParse({ userId: 'u1', maxConcurrency: 101 }).success).toBe(false);
  });
});

describe('GetUserSchema', () => {
  it('接受 email', () => {
    expect(GetUserSchema.safeParse({ email: 'a@b.com' }).success).toBe(true);
  });

  it('接受 userId', () => {
    expect(GetUserSchema.safeParse({ userId: 'u1' }).success).toBe(true);
  });

  it('拒绝两者都不提供', () => {
    expect(GetUserSchema.safeParse({}).success).toBe(false);
  });
});

describe('ModelCreateSchema', () => {
  const validModel = {
    id: 'gpt-4o',
    provider: 'openai' as const,
    inputPrice: 2.5,
    outputPrice: 10,
  };

  it('接受合法输入（含默认 markupRate）', () => {
    const result = ModelCreateSchema.safeParse(validModel);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.markupRate).toBe(1.2);
    }
  });

  it('接受 xiaomi-mimo provider', () => {
    const result = ModelCreateSchema.safeParse({ ...validModel, id: 'mimo-v2.5-pro', provider: 'xiaomi-mimo' });
    expect(result.success).toBe(true);
  });

  it('接受 moonshot provider', () => {
    const result = ModelCreateSchema.safeParse({ ...validModel, id: 'kimi-k3', provider: 'moonshot' });
    expect(result.success).toBe(true);
  });

  it('拒绝空模型 ID', () => {
    expect(ModelCreateSchema.safeParse({ ...validModel, id: '' }).success).toBe(false);
  });

  it('拒绝无效 provider', () => {
    expect(ModelCreateSchema.safeParse({ ...validModel, provider: 'invalid' }).success).toBe(false);
  });

  it('拒绝负数价格', () => {
    expect(ModelCreateSchema.safeParse({ ...validModel, inputPrice: -1 }).success).toBe(false);
  });
});

describe('ModelUpdateSchema', () => {
  it('接受部分更新', () => {
    expect(ModelUpdateSchema.safeParse({ inputPrice: 3 }).success).toBe(true);
    expect(ModelUpdateSchema.safeParse({ provider: 'anthropic' }).success).toBe(true);
    expect(ModelUpdateSchema.safeParse({ provider: 'xiaomi-mimo' }).success).toBe(true);
    expect(ModelUpdateSchema.safeParse({ provider: 'moonshot' }).success).toBe(true);
  });

  it('接受空对象', () => {
    expect(ModelUpdateSchema.safeParse({}).success).toBe(true);
  });
});

describe('SpendingLimitSchema', () => {
  it('接受合法输入（含默认阈值）', () => {
    const result = SpendingLimitSchema.safeParse({ userId: 'u1', monthlyLimit: 100 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.alertThreshold).toBe(0.8);
    }
  });

  it('拒绝阈值超过 1', () => {
    expect(SpendingLimitSchema.safeParse({ userId: 'u1', monthlyLimit: 100, alertThreshold: 1.5 }).success).toBe(false);
  });
});

describe('GlobalConfigSchema', () => {
  it('使用默认值', () => {
    const result = GlobalConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dailySpendingCap).toBe(0);
      expect(result.data.isServicePaused).toBe(false);
      expect(result.data.freeQuota).toEqual({ enabled: false, amount: 0, modelIds: [] });
    }
  });

  it('接受免费额度配置并清理空模型 ID', () => {
    const result = GlobalConfigSchema.safeParse({
      freeQuota: {
        enabled: true,
        amount: 1,
        modelIds: ['mimo-v2.5-pro', ' ', 'mimo-v2.5-tts'],
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.freeQuota).toEqual({
        enabled: true,
        amount: 1,
        modelIds: ['mimo-v2.5-pro', 'mimo-v2.5-tts'],
      });
    }
  });
});

describe('UsageQuerySchema', () => {
  it('使用默认分页参数', () => {
    const result = UsageQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it('支持字符串数字 coerce', () => {
    const result = UsageQuerySchema.safeParse({ page: '3', pageSize: '50' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.pageSize).toBe(50);
    }
  });

  it('拒绝超限 pageSize', () => {
    expect(UsageQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
  });
});

describe('ChatCompletionSchema', () => {
  const validRequest = {
    model: 'gpt-4o',
    messages: [{ role: 'user' as const, content: 'Hello' }],
  };

  it('接受最小合法请求', () => {
    expect(ChatCompletionSchema.safeParse(validRequest).success).toBe(true);
  });

  it('拒绝空 model', () => {
    expect(ChatCompletionSchema.safeParse({ ...validRequest, model: '' }).success).toBe(false);
  });

  it('拒绝空 messages', () => {
    expect(ChatCompletionSchema.safeParse({ ...validRequest, messages: [] }).success).toBe(false);
  });

  it('接受完整参数', () => {
    const full = {
      ...validRequest,
      temperature: 0.7,
      top_p: 0.9,
      stream: true,
      max_tokens: 1000,
      presence_penalty: 0.5,
      frequency_penalty: -0.5,
    };
    expect(ChatCompletionSchema.safeParse(full).success).toBe(true);
  });

  it('拒绝超范围 temperature', () => {
    expect(ChatCompletionSchema.safeParse({ ...validRequest, temperature: 3 }).success).toBe(false);
  });

  it('接受 null content（assistant function_call）', () => {
    const msg = {
      model: 'gpt-4o',
      messages: [{ role: 'assistant', content: null, function_call: { name: 'fn', arguments: '{}' } }],
    };
    expect(ChatCompletionSchema.safeParse(msg).success).toBe(true);
  });
});
