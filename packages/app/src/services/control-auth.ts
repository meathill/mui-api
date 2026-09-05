import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { Database } from '../db';
import { validateBearer } from '../lib/bearer-validator';
import { parseScopes, type ControlScope } from '@muirouter/shared-db/integration';
import type { CloudflareBindings } from '../types';

export interface ControlActor {
  userId: string;
  scopes: string[];
  isAdmin: boolean;
  projectId?: string;
}

export class ControlError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: 400 | 401 | 403 | 404 | 409 | 503 = 400,
  ) {
    super(message);
  }
}

export async function authenticateControl(
  env: CloudflareBindings,
  db: Database,
  request: Request,
): Promise<ControlActor> {
  const header = request.headers.get('authorization') ?? '';
  const token = /^Bearer\s+(\S+)$/i.exec(header)?.[1];
  if (!token) throw new ControlError('unauthorized', '请先通过 MuiRouter CLI 登录', 401);
  const auth = await validateBearer(env, token, db);
  if (!auth) throw new ControlError('unauthorized', '凭证已失效，请重新登录', 401);
  const user = await db.select({ email: users.email }).from(users).where(eq(users.id, auth.userId)).get();
  const admins = `${env.ADMIN_EMAILS ?? ''},${env.ADMIN_EMAIL ?? ''}`
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(Boolean);
  return {
    userId: auth.userId,
    scopes: auth.source === 'oauth_access' ? parseScopes(auth.scope) : ['balance', 'llm', 'projects:read'],
    isAdmin: auth.source === 'oauth_access' && Boolean(user && admins.includes(user.email.toLowerCase())),
    ...(auth.projectId ? { projectId: auth.projectId } : {}),
  };
}

export function requireScope(actor: ControlActor, scope: ControlScope, admin = false): void {
  if (!actor.scopes.includes(scope) || (admin && !actor.isAdmin)) {
    throw new ControlError('forbidden', `当前凭证缺少 ${scope}${admin ? ' 管理员' : ''} 权限`, 403);
  }
}
