import { WorkerEntrypoint } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { CONTROL_SCOPES } from '@muirouter/shared-db/integration';
import { createDb, users } from './db';
import { ControlError } from './services/control-auth';
import { callControlTool } from './services/control-tools';
import type { CloudflareBindings } from './types';

// 仅通过同账号 service binding 暴露给 Dashboard，不挂载任何公网 HTTP 路由。
export class ControlEntrypoint extends WorkerEntrypoint<CloudflareBindings> {
  async execute(userId: string, operation: string, input: unknown) {
    const db = createDb(this.env.DB);
    try {
      const user = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).get();
      if (!user) throw new ControlError('unauthorized', '用户不存在', 401);
      const admins = `${this.env.ADMIN_EMAILS ?? ''},${this.env.ADMIN_EMAIL ?? ''}`
        .toLowerCase()
        .split(/[\s,]+/)
        .filter(Boolean);
      const actor = { userId, isAdmin: admins.includes(user.email.toLowerCase()), scopes: [...CONTROL_SCOPES] };
      return { status: 200, result: await callControlTool({ env: this.env, db, actor }, operation, input) };
    } catch (error) {
      if (error instanceof ControlError)
        return { status: error.status, result: { error: error.code, message: error.message } };
      if (error instanceof z.ZodError)
        return {
          status: 400,
          result: { error: 'invalid_input', message: '配置未通过 schema 校验', issues: error.issues },
        };
      console.error('[control-rpc] 操作失败', error);
      return { status: 500, result: { error: 'operation_failed', message: '操作失败，请检查当前配置版本后重试' } };
    }
  }
}
