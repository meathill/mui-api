import { Hono } from 'hono';
import { z } from 'zod';
import { authenticateControl, ControlError } from '../services/control-auth';
import { callControlTool } from '../services/control-tools';
import { installProjectKey, issueProjectKey } from '../services/control-projects';
import type { CloudflareBindings } from '../types';

const control = new Hono<{ Bindings: CloudflareBindings }>();
control.post('/:operation', async (c) => {
  try {
    const actor = await authenticateControl(c.env, c.get('db'), c.req.raw);
    const input: unknown = await c.req.json();
    const operation = c.req.param('operation');
    if (operation === 'install_project_key') {
      const parsed = z
        .object({
          projectId: z.string(),
          keyId: z.string().regex(/^[a-f0-9]{64}$/),
          keyPrefix: z.string().regex(/^sk-gw-[A-Za-z0-9_-]{6}\.\.\.$/),
        })
        .strict()
        .parse(input);
      c.header('cache-control', 'no-store');
      return c.json(await installProjectKey(c.env, c.get('db'), actor, parsed));
    }
    if (operation === 'issue_project_key') {
      const parsed = z.object({ projectId: z.string() }).strict().parse(input);
      c.header('cache-control', 'no-store');
      return c.json(await issueProjectKey(c.env, c.get('db'), actor, parsed.projectId));
    }
    return c.json(await callControlTool({ env: c.env, db: c.get('db'), actor }, operation, input));
  } catch (error) {
    if (error instanceof ControlError) return c.json({ error: error.code, message: error.message }, error.status);
    if (error instanceof z.ZodError) return c.json({ error: 'invalid_input', issues: error.issues }, 400);
    console.error('[control] 操作失败', error);
    return c.json({ error: 'operation_failed', message: '操作未完成，请查询当前状态后重试' }, 500);
  }
});
export default control;
