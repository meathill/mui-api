import type { Context, Next } from 'hono';
import { validateBearer } from '../lib/bearer-validator';
import { createLeaseHeartbeat, wrapResponseBodyWithFinalizer } from '../lib/concurrency-response';
import { generateId } from '@muirouter/shared-db/crypto';
import { createErrorResponse, ErrorTypes, tooManyRequests } from '../lib/errors';
import {
  ConcurrencyService,
  DEFAULT_CONCURRENCY_LEASE_TTL_MS,
  DEFAULT_CONCURRENCY_REFRESH_INTERVAL_MS,
} from '../services/concurrency-service';
import { KVService } from '../services/kv-service';
import { WalletService } from '../services/wallet-service';
import type { CloudflareBindings, KVUserData } from '../types';

export const MIN_BALANCE = 0.01;

interface AuthMiddlewareOptions {
  allowFreeQuotaFallback?: boolean;
}

/**
 * API Key 认证 + 并发控制中间件
 */
export function createAuthMiddleware(options: AuthMiddlewareOptions = {}) {
  const allowFreeQuotaFallback = options.allowFreeQuotaFallback ?? true;

  return async function authMiddleware(c: Context<{ Bindings: CloudflareBindings }>, next: Next) {
    // 支持两种鉴权头：Authorization: Bearer（OpenAI 兼容客户端 / Claude Code 的 ANTHROPIC_AUTH_TOKEN）
    // 与 x-api-key（Anthropic 原生 SDK 默认头）。统一取出 sk-gw- / mr_at_ key。
    const authHeader = c.req.header('Authorization');
    const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : c.req.header('x-api-key');

    if (!apiKey) {
      // spec 语义：缺头是 401，但 type 仍为 invalid_request_error
      return c.json(createErrorResponse('缺少 Authorization header 或 x-api-key', ErrorTypes.INVALID_REQUEST), 401);
    }

    // 前缀校验：保留 spec 行为——格式不对返回 invalid_request_error，
    // 反之（前缀对但 KV/DB 查不到）算 invalid_api_key。两类区分对客户端友好。
    if (!apiKey.startsWith('sk-gw-') && !apiKey.startsWith('mr_at_')) {
      return c.json(createErrorResponse('无效的 API Key 格式', ErrorTypes.INVALID_REQUEST), 401);
    }

    const defaultMaxConcurrency = Number(c.env.DEFAULT_MAX_CONCURRENCY) || 3;
    const kvService = new KVService(c.env.KV, defaultMaxConcurrency);
    const concurrencyService = new ConcurrencyService(c.env);

    // 同时支持 PAT (sk-gw-*) 与 OAuth access_token (mr_at_*)。详见 bearer-validator.ts。
    const validation = await validateBearer(c.env, apiKey, c.get('db'));
    if (!validation) {
      return c.json(createErrorResponse('无效的 API Key', ErrorTypes.INVALID_API_KEY), 401);
    }
    const { userId, keyHash: apiKeyId } = validation;

    // 获取用户数据，如果 KV 中不存在则自动初始化（余额为 0）
    let { data, metadata } = await kvService.getUser(userId);
    if (!data) {
      const walletService = new WalletService(c.env);
      ({ data, metadata } = await walletService.create(userId, ''));
    }

    // 检查全局服务暂停状态
    const globalConfig = await kvService.getGlobalConfig();
    if (globalConfig?.isServicePaused) {
      return c.json(createErrorResponse('服务暂时不可用，请稍后重试', 'service_paused'), 503);
    }

    // 检查用户暂停状态
    if (data.isSuspended) {
      return c.json(createErrorResponse('账户已因超出消费限额被暂停，请联系管理员', 'account_suspended'), 403);
    }

    // 检查余额
    if (data.balance < MIN_BALANCE && !(allowFreeQuotaFallback && hasFreeQuotaFallback(globalConfig, data))) {
      return c.json(
        createErrorResponse(`余额不足，当前余额: $${data.balance.toFixed(4)}`, ErrorTypes.INSUFFICIENT_QUOTA),
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
      return tooManyRequests(c, `并发请求超限，最大允许 ${maxConcurrency} 个并发请求`);
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
  };
}

export const authMiddleware = createAuthMiddleware({ allowFreeQuotaFallback: true });
export const paidAuthMiddleware = createAuthMiddleware({ allowFreeQuotaFallback: false });

function hasFreeQuotaFallback(
  globalConfig: Awaited<ReturnType<KVService['getGlobalConfig']>>,
  userData: KVUserData,
): boolean {
  const freeQuota = globalConfig?.freeQuota;
  const modelIds = Array.isArray(freeQuota?.modelIds) ? freeQuota.modelIds : [];
  if (!freeQuota?.enabled || freeQuota.amount <= 0 || modelIds.length === 0) {
    return false;
  }

  return (userData.freeQuotaUsed ?? 0) < freeQuota.amount;
}
