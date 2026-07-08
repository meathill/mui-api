import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { isRetryableD1Error, type D1RetryAttemptFailure, withD1Retry } from '@muirouter/shared-db/d1-retry';
import * as appSchema from '@/db/app-schema';
import * as authSchema from '@/db/schema';

const schema = { ...authSchema, ...appSchema };

// 排查生产间歇性登录失败（verification 表 INSERT 报错，疑似和最近开启的 D1
// read replication 有关，未确认）：先只观测，不重试——maxAttempts: 1 保证行为
// 和之前完全一致（第一次失败照样立刻抛出），只是把完整的错误链路和我们的
// isRetryableD1Error 判断结果记下来，等真正拿到几次报错样本再决定要不要启用重试。
function logD1Failure(event: D1RetryAttemptFailure): void {
  const causeChain: string[] = [];
  let current: unknown = event.error;
  let depth = 0;
  while (current instanceof Error && depth < 5) {
    causeChain.push(`${current.name}: ${current.message}`);
    current = current.cause;
    depth += 1;
  }
  console.error(
    '[d1-diagnostic]',
    JSON.stringify({
      op: event.op,
      causeChain,
      wouldRetry: isRetryableD1Error(event.error),
      stack: event.error instanceof Error ? event.error.stack : undefined,
    }),
  );
}

export async function getDb() {
  const { env } = await getCloudflareContext({ async: true });
  const session = env.DB.withSession('first-unconstrained');
  const diagnosedSession = withD1Retry(session, { maxAttempts: 1, onAttemptFailure: logD1Failure });
  // D1DatabaseSession 在 prepare/batch 上与 D1Database 结构兼容，drizzle-orm 当前版本类型未收录，故 cast。
  return drizzle(diagnosedSession as unknown as D1Database, { schema });
}

export type AppDb = Awaited<ReturnType<typeof getDb>>;
