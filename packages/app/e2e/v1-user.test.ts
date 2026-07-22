import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { seedApiKey } from './helpers';

interface BalanceBody {
  currency: string;
  balance: string;
  balance_cents: number;
  lifetime_topped_up_cents: number;
  lifetime_spent_cents: number;
  updated_at: string;
}

interface SpecError {
  error: string;
  message: string;
}

describe('GET /v1/balance', () => {
  it('缺少 Authorization → 401 invalid_api_key', async () => {
    const res = await SELF.fetch('http://localhost/v1/balance');
    expect(res.status).toBe(401);
    const body = (await res.json()) as SpecError;
    expect(body.error).toBe('invalid_api_key');
  });

  it('错误前缀 → 401', async () => {
    const res = await SELF.fetch('http://localhost/v1/balance', {
      headers: { Authorization: 'Bearer mr_xxxx' },
    });
    expect(res.status).toBe(401);
  });

  it('合法 key 返回 spec 字段，金额 cents 一致', async () => {
    const userId = 'balance-user-1';
    const apiKey = await seedApiKey(userId, 12.34);
    await env.DB.prepare(
      "INSERT OR REPLACE INTO user (id, name, email, email_verified, image, created_at, updated_at) VALUES (?, 'x', ?, 1, NULL, unixepoch(), unixepoch())",
    )
      .bind(userId, `${userId}@test.com`)
      .run();
    await env.DB.prepare("INSERT INTO recharge_logs (id, user_id, amount, source) VALUES ('r1', ?, 50.00, 'admin')")
      .bind(userId)
      .run();
    await env.DB.prepare("INSERT INTO usage_logs (id, user_id, model_id, cost) VALUES ('u1', ?, 'gpt-4o', 37.66)")
      .bind(userId)
      .run();

    const res = await SELF.fetch('http://localhost/v1/balance', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as BalanceBody;
    expect(body.currency).toBe('USD');
    expect(body.balance).toBe('12.34');
    expect(body.balance_cents).toBe(1234);
    expect(body.lifetime_topped_up_cents).toBe(5000);
    expect(body.lifetime_spent_cents).toBe(3766);
    expect(typeof body.updated_at).toBe('string');
  });

  it('钱包记录缺失时返回 0', async () => {
    const userId = 'balance-user-empty';
    const apiKey = await seedApiKey(userId, 0);
    const res = await SELF.fetch('http://localhost/v1/balance', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as BalanceBody;
    expect(body.balance_cents).toBe(0);
    expect(body.lifetime_topped_up_cents).toBe(0);
  });
});

describe('GET /v1/usage', () => {
  it('返回当前用户用量', async () => {
    const userId = 'usage-user-1';
    const apiKey = await seedApiKey(userId, 10);
    await env.DB.prepare(
      "INSERT INTO usage_logs (id, user_id, model_id, input_tokens, output_tokens, cost) VALUES ('uu1', ?, 'gpt-4o', 100, 200, 0.5)",
    )
      .bind(userId)
      .run();
    const res = await SELF.fetch('http://localhost/v1/usage', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ id: string; cost_cents: number }> };
    const found = body.items.find((it) => it.id === 'uu1');
    expect(found).toBeDefined();
    expect(found?.cost_cents).toBe(50);
  });
});

describe('GET /v1/recharges', () => {
  it('返回当前用户充值记录', async () => {
    const userId = 'rech-user-1';
    const apiKey = await seedApiKey(userId, 10);
    await env.DB.prepare(
      "INSERT INTO recharge_logs (id, user_id, amount, source, note) VALUES ('rr1', ?, 7.00, 'admin', '初始')",
    )
      .bind(userId)
      .run();
    const res = await SELF.fetch('http://localhost/v1/recharges', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ id: string; amount_cents: number }> };
    expect(body.items.find((it) => it.id === 'rr1')?.amount_cents).toBe(700);
  });
});

describe('GET /v1/public-models', () => {
  it('无需鉴权返回模型列表', async () => {
    const res = await SELF.fetch('http://localhost/v1/public-models');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ id: string }> };
    expect(body.items.length).toBeGreaterThan(0);
  });
});
