import { Hono } from 'hono';
import type { CloudflareBindings } from '../../types';
import { unauthorized } from '../../lib/errors';
import users from './users';
import modelRoutes from './models';
import spending from './spending';

const admin = new Hono<{ Bindings: CloudflareBindings }>();

/**
 * 管理员密钥验证中间件
 */
admin.use('/*', async (c, next) => {
  const adminSecret = c.req.header('X-Admin-Secret');
  if (!adminSecret || adminSecret !== c.env.ADMIN_SECRET) {
    return unauthorized(c, '管理员密钥无效');
  }
  await next();
});

// 用户管理
admin.route('/', users);

// 模型管理
admin.route('/models', modelRoutes);

// 消费限额、全局配置、用量统计
admin.route('/', spending);

export default admin;
