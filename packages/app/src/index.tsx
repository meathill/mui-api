import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createDb } from './db';
import { ConcurrencyLimiterDO } from './durable-objects/concurrency-limiter';
import { WalletDO } from './durable-objects/wallet';
import { d1SessionMiddleware } from './middleware/d1-session';
import { loggerMiddleware } from './middleware/logger';
import { renderer } from './renderer';
import admin from './routes/admin';
import anthropic from './routes/anthropic';
import mcp from './routes/mcp';
import oauth from './routes/oauth';
import openai from './routes/openai';
import providers from './routes/providers';
import responses from './routes/responses';
import v1User from './routes/v1-user';
import webhooks from './routes/webhooks';
import { aggregateDaily, aggregateHourly, aggregateMonthly, aggregateWeekly } from './services/stats-aggregator';
import type { CloudflareBindings } from './types';

const app = new Hono<{ Bindings: CloudflareBindings }>();

// 全局中间件
app.use('*', loggerMiddleware);
app.use('*', d1SessionMiddleware);
app.use(
  '*',
  cors({
    origin: (origin) => origin,
    allowHeaders: ['Content-Type', 'Authorization', 'X-Admin-Secret'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  }),
);
app.use(renderer);

// 挂载路由
app.route('/admin', admin);
// v1User 提供用户自助查询/充值端点（balance, usage, recharges, models, topup-sessions）
// 必须在 OpenAI 兼容路由之前挂载，否则 openai 上的 `/*` authMiddleware 会拦截
app.route('/v1', v1User);
// anthropic 原生 /v1/messages、responses 原生 /v1/responses：都挂在 openai 之前
// （openai 的 /* authMiddleware 会拦截同前缀路径）；两者都用 handler 级中间件、无 /*，
// 因此不会反向拦截 openai 路由，彼此之间也不用关心顺序
app.route('/v1', anthropic);
app.route('/v1', responses);
app.route('/v1', openai);
app.route('/providers', providers);
app.route('/webhooks', webhooks);
app.route('/mcp', mcp);
app.route('/oauth', oauth);
// 首页
app.get('/', (c) => {
  return c.render(
    <main>
      <span class="eyebrow">Meathill Studio · Mui Router</span>
      <h1>Uni-Gateway - AI API 统一网关</h1>
      <p>由柯基 Mui 监修。</p>
    </main>,
  );
});

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: CloudflareBindings, ctx: ExecutionContext) {
    const db = createDb(env.DB);
    const cron = event.cron;

    ctx.waitUntil(
      (async () => {
        try {
          if (cron === '5 * * * *') {
            await aggregateHourly(db);
          } else if (cron === '15 0 * * *') {
            await aggregateDaily(db);
          } else if (cron === '30 0 * * 1') {
            await aggregateWeekly(db);
          } else if (cron === '45 0 1 * *') {
            await aggregateMonthly(db);
          }
        } catch (err) {
          console.error(`[cron] 聚合失败 (${cron}):`, err);
        }
      })(),
    );
  },
};

export { ConcurrencyLimiterDO, WalletDO };
