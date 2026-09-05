import type { ExecutionPolicy } from '@muirouter/shared-db/integration';
import type { Database } from '../db';
import type { CloudflareBindings } from '../types';
import { AlertService } from './alert-service';
import { BillingService } from './billing-service';
import { EmailService } from './email-service';
import { GatewayService } from './gateway-service';
import { KVService } from './kv-service';
import { ModelCatalogService } from './model-catalog-service';
import { WalletService } from './wallet-service';

export interface ProxyServices {
  db: Database;
  kvService: KVService;
  walletService: WalletService;
  billingService: BillingService;
  alertService: AlertService;
  gatewayService: GatewayService;
  modelCatalog: ModelCatalogService;
}

/**
 * 创建代理路由所需的全部服务实例
 * 用于 openai.ts 和 providers.ts
 * 中心项目请求透传 executionPolicy：BillingService 按项目计费模式（钱包/只计量）结算。
 */
export function createProxyServices(
  env: CloudflareBindings,
  db: Database,
  executionPolicy?: ExecutionPolicy,
): ProxyServices {
  const defaultMaxConcurrency = Number(env.DEFAULT_MAX_CONCURRENCY) || 3;
  const kvService = new KVService(env.KV, defaultMaxConcurrency);
  const walletService = new WalletService(env);
  const billingService = new BillingService(kvService, db, walletService, executionPolicy);
  const emailService = new EmailService({
    apiKey: env.RESEND_API_KEY,
    fromEmail: env.FROM_EMAIL,
  });
  const alertService = new AlertService(kvService, db, emailService, env.ADMIN_EMAIL, walletService);
  const gatewayService = new GatewayService(env.CF_ACCOUNT_ID, env.CF_GATEWAY_ID, env.CF_AIG_TOKEN);
  const modelCatalog = new ModelCatalogService(kvService, db);

  return { db, kvService, walletService, billingService, alertService, gatewayService, modelCatalog };
}
