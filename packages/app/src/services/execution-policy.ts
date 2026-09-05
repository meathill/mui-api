import { integrationProjects } from '@muirouter/shared-db/business';
import { parseModelDefaults, type ExecutionPolicy } from '@muirouter/shared-db/integration';
import { and, eq } from 'drizzle-orm';
import type { Database } from '../db';

export async function getExecutionPolicy(
  db: Database,
  projectId: string,
  ownerId: string,
): Promise<ExecutionPolicy | null> {
  const project = await db
    .select()
    .from(integrationProjects)
    .where(
      and(
        eq(integrationProjects.id, projectId),
        eq(integrationProjects.ownerId, ownerId),
        eq(integrationProjects.isActive, true),
      ),
    )
    .get();
  if (!project) return null;
  return {
    projectId: project.id,
    billingMode: project.billingMode,
    defaults: parseModelDefaults(project.defaultsJson),
  };
}
