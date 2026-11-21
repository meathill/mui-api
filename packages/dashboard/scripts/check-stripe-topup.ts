/**
 * 只读核对：充值流失原因（issue #23）。
 *
 * 查询指定 UTC 时间窗内的 Checkout Sessions，核对取消成因线索：会话状态、
 * payment_status、会话内配置的支付方式、PaymentIntent 的 last_payment_error，
 * 并列出账户已启用的支付方式（判断 Alipay / 微信支付是否对 HK 用户可用）。
 *
 * 用法（packages/dashboard 目录下）：
 *   node --env-file=.env scripts/check-stripe-topup.ts
 *   node --env-file=.env scripts/check-stripe-topup.ts --from "2026-11-20T08:50:00Z" --to "2026-11-20T09:10:00Z"
 *
 * 密钥只从环境变量 STRIPE_SECRET_KEY 读取，脚本不接触 .env 文件本身。
 */

import Stripe from 'stripe';

// 默认窗口覆盖 Clarity 会话 167ty30 的两次充值尝试（2026-11-20 16:57 HKT ≈ 08:57 UTC）
const DEFAULT_FROM = '2026-11-20T08:50:00Z';
const DEFAULT_TO = '2026-11-20T09:10:00Z';

interface CliArgs {
  fromIso: string;
  toIso: string;
}

function parseArgs(argv: string[]): CliArgs {
  let fromIso = DEFAULT_FROM;
  let toIso = DEFAULT_TO;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--from' && argv[i + 1]) {
      fromIso = argv[i + 1];
      i++;
    } else if (argv[i] === '--to' && argv[i + 1]) {
      toIso = argv[i + 1];
      i++;
    }
  }

  return { fromIso, toIso };
}

function toUnixSeconds(iso: string, label: string): number {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) {
    console.error(`✗ --${label} 不是合法时间：${iso}`);
    process.exit(1);
  }
  return Math.floor(time / 1000);
}

function isEnabled(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const preference = (value as { display_preference?: { preference?: string } }).display_preference?.preference;
  return preference === undefined || preference !== 'none';
}

/** 支付方式子对象的最小形状判断，用于从配置对象里筛出支付方式字段（跳过 id/active 等元字段） */
function asPaymentMethodType(
  value: unknown,
): { available: boolean; display_preference: { preference?: string } } | null {
  if (value === null || typeof value !== 'object') {
    return null;
  }
  const candidate = value as { available?: unknown; display_preference?: unknown };
  if (typeof candidate.available !== 'boolean' || candidate.display_preference === null) {
    return null;
  }
  const preference = candidate.display_preference as { preference?: string } | undefined;
  return { available: candidate.available, display_preference: preference ?? {} };
}

async function main() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.error('✗ 未设置 STRIPE_SECRET_KEY。请运行：');
    console.error('    node --env-file=.env scripts/check-stripe-topup.ts');
    process.exit(1);
  }
  if (secretKey.startsWith('sk_test_')) {
    console.warn('⚠ 当前是测试模式密钥（sk_test_），查不到生产数据。');
  }

  const { fromIso, toIso } = parseArgs(process.argv.slice(2));
  const created = {
    gte: toUnixSeconds(fromIso, 'from'),
    lte: toUnixSeconds(toIso, 'to'),
  };

  const stripe = new Stripe(secretKey, {
    apiVersion: '2026-07-29.dahlia',
    appInfo: { name: 'mui-dashboard' },
    maxNetworkRetries: 2,
  });

  console.log(`\n=== Checkout Sessions（${fromIso} ~ ${toIso} UTC）===`);

  const sessions = await stripe.checkout.sessions.list({ created, limit: 100 });
  console.log(`共 ${sessions.data.length} 条${sessions.has_more ? '（还有更多，请加宽窗口分页查询）' : ''}`);

  for (const session of sessions.data) {
    const userEmail = session.metadata?.userEmail ?? '-';
    console.log(`\n· ${session.id}`);
    console.log(
      `  创建时间: ${new Date(session.created * 1000).toISOString()} | 状态: ${session.status} | payment_status: ${session.payment_status}`,
    );
    console.log(`  金额: ${(session.amount_total ?? 0) / 100} ${session.currency?.toUpperCase()}`);
    console.log(`  会话支付方式: ${session.payment_method_types.join(', ') || '(未显式配置，用账户默认)'}`);
    console.log(`  配置集: ${session.payment_method_configuration_details?.id ?? '(账户默认)'}`);
    console.log(`  用户: ${userEmail}（client_reference_id: ${session.client_reference_id ?? '-'}）`);

    if (typeof session.payment_intent === 'string') {
      const intent = await stripe.paymentIntents.retrieve(session.payment_intent);
      const error = intent.last_payment_error;
      console.log(
        `  PaymentIntent: ${intent.status}${error ? ` | 最后错误: [${error.type}/${error.code ?? '-'}] ${error.message ?? ''}` : ''}`,
      );
    }
  }

  console.log('\n=== 账户支付方式配置（payment_method_configurations）===');
  const configurations = await stripe.paymentMethodConfigurations.list();
  for (const config of configurations.data) {
    const available: string[] = [];
    const offered: string[] = [];
    const unavailable: string[] = [];
    for (const [key, value] of Object.entries(config)) {
      const method = asPaymentMethodType(value);
      if (!method) {
        continue;
      }
      if (method.available) {
        available.push(key);
      } else if (method.display_preference.preference === 'off') {
        unavailable.push(key);
      } else {
        offered.push(key);
      }
    }
    console.log(
      `\n· ${config.id}${config.name ? `（${config.name}）` : ''} ${config.active ? '[生效中]' : '[未生效]'}`,
    );
    console.log(`  可用（开通且能力激活）: ${available.join(', ') || '(无)'}`);
    console.log(`  展示但未激活: ${offered.join(', ') || '(无)'}`);
    console.log(`  关闭: ${unavailable.join(', ') || '(无)'}`);
  }

  console.log('\n=== 判读提示 ===');
  console.log('- status=expired / open 且 payment_status=unpaid：用户放弃结账（对应 ?topUp=cancelled 回跳）。');
  console.log('- 会话支付方式只有 card：说明账户未对 Checkout 开通支付宝/微信等本地方式，HK 用户只能刷卡。');
  console.log('- 有 last_payment_error：卡被拒，看 decline_code（insufficient_funds / card_declined 等）。');
}

main().catch((error: unknown) => {
  console.error('✗ 查询失败：', error instanceof Error ? error.message : error);
  process.exit(1);
});
