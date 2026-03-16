import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { CloudflareBindings } from './types';
import { renderer } from './renderer';
import { loggerMiddleware } from './middleware/logger';
import admin from './routes/admin';
import openai from './routes/openai';
import providers from './routes/providers';

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

export default app;
