import type { Context, Next } from 'hono';
import { createLeaseHeartbeat, wrapResponseBodyWithFinalizer } from '../lib/concurrency-response';
import { generateId } from '../lib/crypto';
import {
  ConcurrencyService,
  DEFAULT_CONCURRENCY_LEASE_TTL_MS,
  DEFAULT_CONCURRENCY_REFRESH_INTERVAL_MS,
} from '../services/concurrency-service';
import { KVService } from '../services/kv-service';
import type { CloudflareBindings } from '../types';

const MIN_BALANCE = 0.01;

/**
 * API Key 认证 + 并发控制中间件
 */
export async function authMiddleware(c: Context<{ Bindings: CloudflareBindings }>, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: { message: '缺少 Authorization header', type: 'invalid_request_error' } }, 401);
  }

  const apiKey = authHeader.substring(7);

  if (!apiKey.startsWith('sk-gw-')) {
    return c.json({ error: { message: '无效的 API Key 格式', type: 'invalid_request_error' } }, 401);
  }

  const defaultMaxConcurrency = Number(c.env.DEFAULT_MAX_CONCURRENCY) || 3;
  const kvService = new KVService(c.env.KV, defaultMaxConcurrency);
  const concurrencyService = new ConcurrencyService(c.env);

  // 验证 API Key
  const keyResult = await kvService.validateApiKey(apiKey);
  if (!keyResult) {
    return c.json({ error: { message: '无效的 API Key', type: 'invalid_api_key' } }, 401);
  }
  const { userId, keyHash: apiKeyId } = keyResult;

  // 获取用户数据，如果 KV 中不存在则自动初始化（余额为 0）
  let { data, metadata } = await kvService.getUser(userId);
  if (!data) {
    data = { balance: 0, concurrency: 0, isSuspended: false };
    metadata = { email: '', createdAt: new Date().toISOString() };
    await kvService.setUser(userId, data, metadata);
  }

  // 检查全局服务暂停状态
  const globalConfig = await kvService.getGlobalConfig();
  if (globalConfig?.isServicePaused) {
    return c.json({ error: { message: '服务暂时不可用，请稍后重试', type: 'service_paused' } }, 503);
  }

  // 检查用户暂停状态
  if (data.isSuspended) {
    return c.json({ error: { message: '账户已因超出消费限额被暂停，请联系管理员', type: 'account_suspended' } }, 403);
  }

  // 检查余额
  if (data.balance < MIN_BALANCE) {
    return c.json(
      {
        error: {
          message: `余额不足，当前余额: $${data.balance.toFixed(4)}`,
          type: 'insufficient_quota',
        },
      },
      402,
    );
  }

  // 检查并发
  const requestId = generateId();
  const maxConcurrency = metadata?.maxConcurrency ?? defaultMaxConcurrency;
  const concurrencyLease = await concurrencyService.acquire(userId, {
    requestId,
    maxConcurrency,
    leaseTtlMs: DEFAULT_CONCURRENCY_LEASE_TTL_MS,
  });
  if (!concurrencyLease.ok || !concurrencyLease.leaseId) {
    return c.json(
      {
        error: {
          message: `并发请求超限，最大允许 ${maxConcurrency} 个并发请求`,
          type: 'rate_limit_exceeded',
        },
      },
      429,
    );
  }

  // 注入用户信息
  c.set('userId', userId);
  c.set('apiKeyId', apiKeyId);
  c.set('balance', data.balance);
  c.set('rateMultiplier', metadata?.rateMultiplier ?? 1);
  c.set('concurrencyLeaseId', concurrencyLease.leaseId);

  const heartbeat = createLeaseHeartbeat(
    DEFAULT_CONCURRENCY_REFRESH_INTERVAL_MS,
    async () => {
      const result = await concurrencyService.refresh(userId, {
        leaseId: concurrencyLease.leaseId!,
        leaseTtlMs: DEFAULT_CONCURRENCY_LEASE_TTL_MS,
      });
      if (!result.ok) {
        throw new Error(`续租失败: lease ${concurrencyLease.leaseId}`);
      }
    },
    (error) => {
      console.error('并发 lease 续租失败:', error);
    },
  );
  c.executionCtx.waitUntil(heartbeat.done);

  let finalized = false;

  async function finalizeLease() {
    if (finalized) {
      return;
    }
    finalized = true;
    heartbeat.stop();
    try {
      await concurrencyService.release(userId, {
        leaseId: concurrencyLease.leaseId!,
      });
    } catch (error) {
      console.error('并发 lease 释放失败:', error);
    }
  }

  try {
    await next();
    if (c.error) {
      await finalizeLease();
      return;
    }
    c.res = wrapResponseBodyWithFinalizer(c.res, finalizeLease);
  } catch (error) {
    await finalizeLease();
    throw error;
  }
}
