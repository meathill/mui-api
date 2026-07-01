import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import * as appSchema from '@/db/app-schema';
import * as authSchema from '@/db/schema';

const schema = { ...authSchema, ...appSchema };

export async function getDb() {
  const { env } = await getCloudflareContext({ async: true });
  // D1DatabaseSession 在 prepare/batch 上与 D1Database 结构兼容，drizzle-orm 当前版本类型未收录，故 cast。
  const session = env.DB.withSession('first-unconstrained') as unknown as D1Database;
  return drizzle(session, { schema });
}

export type AppDb = Awaited<ReturnType<typeof getDb>>;
