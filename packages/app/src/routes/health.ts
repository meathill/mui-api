import { Hono } from 'hono';
import type { CloudflareBindings } from '../types';

const BUILD_VERSION = '2026-08-27T16:30:00Z-openai-direct-smart';
const BUILD_COMMIT = '63c0ad8+smart';

const health = new Hono<{ Bindings: CloudflareBindings }>();

health.get('/health', (c) => {
  const cf = (c.req.raw as unknown as { cf?: Record<string, unknown> }).cf;
  return c.json({
    status: 'ok',
    version: BUILD_VERSION,
    commit: BUILD_COMMIT,
    placement: 'smart',
    openai_direct: Boolean(c.env.OPENAI_API_KEY),
    openai_base_url: c.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    gateway: `${c.env.CF_ACCOUNT_ID}/${c.env.CF_GATEWAY_ID}`,
    cf: cf
      ? {
          colo: cf.colo,
          country: cf.country,
          city: cf.city,
          region: cf.region,
          timezone: cf.timezone,
          asn: cf.asn,
          asOrganization: cf.asOrganization,
        }
      : null,
    ray: c.req.header('cf-ray') ?? null,
    timestamp: new Date().toISOString(),
  });
});

health.get('/debug', async (c) => {
  const cf = (c.req.raw as unknown as { cf?: Record<string, unknown> }).cf;
  let egress: unknown = null;
  try {
    // 探测出口 IP 与 colo，超时 2s
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch('https://1.1.1.1/cdn-cgi/trace', { signal: controller.signal });
    clearTimeout(timeout);
    const text = await res.text();
    egress = Object.fromEntries(
      text
        .trim()
        .split('\n')
        .map((line) => line.split('=') as [string, string]),
    );
  } catch (e) {
    egress = { error: e instanceof Error ? e.message : String(e) };
  }

  return c.json({
    status: 'ok',
    version: BUILD_VERSION,
    commit: BUILD_COMMIT,
    inbound: {
      cf,
      ray: c.req.header('cf-ray'),
      ip: c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for'),
      userAgent: c.req.header('user-agent'),
    },
    egress,
    env: {
      CF_GATEWAY_ID: c.env.CF_GATEWAY_ID,
      OPENAI_BASE_URL: c.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
      has_OPENAI_API_KEY: Boolean(c.env.OPENAI_API_KEY),
    },
    timestamp: new Date().toISOString(),
  });
});

export default health;
