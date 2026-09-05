import { modelConnections, providerConnections } from '@muirouter/shared-db/business';
import { eq } from 'drizzle-orm';
import type { Database } from '../db';
import type { CloudflareBindings } from '../types';
import { validateConnectionAddress } from './control-configuration';

export type ProviderConnection = typeof providerConnections.$inferSelect;

export async function resolveProviderConnection(db: Database, modelId: string) {
  const route = await db.select().from(modelConnections).where(eq(modelConnections.modelId, modelId)).get();
  if (!route) return null;
  const connection = await db
    .select()
    .from(providerConnections)
    .where(eq(providerConnections.id, route.connectionId))
    .get();
  if (!connection?.enabled) throw new Error('模型的 provider connection 不可用');
  return { connection, upstreamModelId: route.upstreamModelId };
}

export function connectionCredential(env: CloudflareBindings, connection: ProviderConnection): string {
  const value: unknown = connection.credentialRef ? Reflect.get(env, connection.credentialRef) : undefined;
  if (typeof value !== 'string' || !value) throw new Error(`连接 ${connection.id} 缺少凭证`);
  return value;
}

export async function callConfiguredEndpoint(
  env: CloudflareBindings,
  connection: ProviderConnection,
  path: string,
  body: BodyInit,
  contentType?: string,
): Promise<Response> {
  if (!connection.baseUrl) throw new Error('连接缺少 base URL');
  validateConnectionAddress(connection.baseUrl);
  const headers = new Headers();
  if (contentType) headers.set('content-type', contentType);
  const credential = connectionCredential(env, connection);
  if (connection.protocol === 'anthropic') {
    headers.set('x-api-key', credential);
    headers.set('anthropic-version', '2023-06-01');
  } else if (connection.protocol === 'gemini') headers.set('x-goog-api-key', credential);
  else headers.set('authorization', `Bearer ${credential}`);
  return fetch(`${connection.baseUrl.replace(/\/+$/, '')}${path}`, {
    method: 'POST',
    headers,
    body,
    redirect: 'error',
  });
}
