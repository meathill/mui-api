import { drizzle } from 'drizzle-orm/d1';
import * as authSchema from '@/db/schema';
import * as appSchema from '@/db/app-schema';
import { getCloudflareContext } from '@opennextjs/cloudflare';

const schema = { ...authSchema, ...appSchema };

export async function getDb() {
  const { env } = await getCloudflareContext({ async: true });
  return drizzle(env.DB, { schema });
}

export type AppDb = Awaited<ReturnType<typeof getDb>>;
