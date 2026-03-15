import type { CloudflareBindings } from '../types';
import { createDb, type Database } from '../db';
import { KVService } from './kv-service';
import { BillingService } from './billing-service';
import { AlertService } from './alert-service';
import { EmailService } from './email-service';
import { GatewayService } from './gateway-service';

export interface ProxyServices {
  db: Database;
  kvService: KVService;
  billingService: BillingService;
  alertService: AlertService;
  gatewayService: GatewayService;
}

/**
 * 创建代理路由所需的全部服务实例
 * 用于 openai.ts 和 providers.ts
 */
export function createProxyServices(env: CloudflareBindings): ProxyServices {
  const db = createDb(env.DB);
  const defaultMaxConcurrency = Number(env.DEFAULT_MAX_CONCURRENCY) || 3;
  const kvService = new KVService(env.KV, defaultMaxConcurrency);
  const billingService = new BillingService(kvService, db);
  const emailService = new EmailService({
    apiKey: env.RESEND_API_KEY,
    fromEmail: env.FROM_EMAIL,
  });
  const alertService = new AlertService(kvService, db, emailService, env.ADMIN_EMAIL);
  const gatewayService = new GatewayService(env.CF_ACCOUNT_ID, env.CF_GATEWAY_ID, env.CF_AIG_TOKEN);

  return { db, kvService, billingService, alertService, gatewayService };
}
