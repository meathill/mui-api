import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import * as appSchema from '@/db/app-schema';
import * as authSchema from '@/db/schema';

const schema = { ...authSchema, ...appSchema };

export async function getDb() {
  const { env } = await getCloudflareContext({ async: true });
  return drizzle(env.DB, { schema });
}

export type AppDb = Awaited<ReturnType<typeof getDb>>;
