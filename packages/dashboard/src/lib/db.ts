import { type D1RetryAttemptFailure, isRetryableD1Error, withD1Retry } from '@muirouter/shared-db/d1-retry';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import * as appSchema from '@/db/app-schema';
import * as authSchema from '@/db/schema';

const schema = { ...authSchema, ...appSchema };

// 生产间歇性登录失败（verification 表 INSERT 报错）已确认根因：真实样本是
// `D1_ERROR: Network connection lost.`，抛出点是 D1DatabaseSession._sendOrThrow——
// 只有走 Sessions API（env.DB.withSession，即 D1 read replication）才会碰到的
// 内部路径，和查询负载无关（wrangler d1 insights 显示生产查询量很低）。
// 见 DEV_NOTE.md「D1 Sessions API 网络瞬时错误」。继续保留诊断日志，方便观察
// 重试是否真的能把这类瞬时失败挡住。
export function logD1Failure(event: D1RetryAttemptFailure): void {
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
  const resilientSession = withD1Retry(session, { onAttemptFailure: logD1Failure });
  // D1DatabaseSession 在 prepare/batch 上与 D1Database 结构兼容，drizzle-orm 当前版本类型未收录，故 cast。
  return drizzle(resilientSession as unknown as D1Database, { schema });
}

export type AppDb = Awaited<ReturnType<typeof getDb>>;
