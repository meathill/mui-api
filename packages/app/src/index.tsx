import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { CloudflareBindings } from './types';
import { renderer } from './renderer';
import { loggerMiddleware } from './middleware/logger';
import admin from './routes/admin';
import openai from './routes/openai';
import providers from './routes/providers';
import { createDb } from './db';
import { ConcurrencyLimiterDO } from './durable-objects/concurrency-limiter';
import { aggregateHourly, aggregateDaily, aggregateWeekly, aggregateMonthly } from './services/stats-aggregator';

const app = new Hono<{ Bindings: CloudflareBindings }>();

// 全局中间件
app.use('*', loggerMiddleware);
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
app.route('/v1', openai);
app.route('/providers', providers);
// 首页
app.get('/', (c) => {
  return c.render(<h1>Uni-Gateway - AI API 统一网关</h1>);
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

export { ConcurrencyLimiterDO };
