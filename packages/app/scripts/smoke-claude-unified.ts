/**
 * Phase 0 Smoke Test —— 验证 Cloudflare Unified Billing 接入 Claude 是否真正跑通
 *
 * 本脚本只读环境变量、不读 .env。请在你已配置好 CF 凭证的环境里运行：
 *
 *   CF_AIG_TOKEN=xxx CF_TOKEN=xxx [ANTHROPIC_API_KEY=sk-ant-...] \
 *     node packages/app/scripts/smoke-claude-unified.ts
 *
 * 可选环境变量：
 *   CF_ACCOUNT_ID   默认取 wrangler.jsonc 里的值
 *   CF_GATEWAY_ID   默认 api-router
 *   MODEL           默认 claude-haiku-4-5（最便宜，省 credits）
 *
 * 跑 3 条腿，打印 HTTP 状态 + 原始 usage 字段，用来钉死端点/模型ID/计费来源：
 *   A. unified 原生透传    POST .../anthropic/v1/messages（cf-aig-authorization + Authorization: Bearer CF_TOKEN）
 *   B. unified OpenAI 兼容 POST .../compat/chat/completions（model=anthropic/<id>，仅 cf-aig-authorization）
 *   C. byok 原生透传       同 A，但用 x-api-key、不带 CF_TOKEN（仅当提供 ANTHROPIC_API_KEY）
 * 另外尽力拉一次 CF 模型目录，列出可用的 anthropic 模型 ID。
 *
 * 注意：会真实消耗少量 credits（haiku + max_tokens=16，约几厘）。跑前后可在
 * CF 后台 AI Gateway → Credits 核对余额，确认 A、B 扣 credits 而 C 不扣。
 */

const ACCOUNT_ID = process.env.CF_ACCOUNT_ID ?? 'fdc63eeea83ae8f5234357308b9a638b';
const GATEWAY_ID = process.env.CF_GATEWAY_ID ?? 'api-router';
const CF_AIG_TOKEN = process.env.CF_AIG_TOKEN ?? '';
const CF_TOKEN = process.env.CF_TOKEN ?? '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';
const MODEL = process.env.MODEL ?? 'claude-haiku-4-5';

const GATEWAY_BASE = `https://gateway.ai.cloudflare.com/v1/${ACCOUNT_ID}/${GATEWAY_ID}`;
const MESSAGES_BODY = {
  model: MODEL,
  max_tokens: 16,
  messages: [{ role: 'user', content: 'Reply with exactly one word: pong' }],
};

interface LegResult {
  ok: boolean;
  status: number;
  usage: unknown;
  bodySnippet?: string;
  note?: string;
}

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<LegResult> {
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    const text = await resp.text();
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { ok: false, status: resp.status, usage: null, bodySnippet: text.slice(0, 300) };
    }
    return {
      ok: resp.ok,
      status: resp.status,
      usage: (data as { usage?: unknown }).usage ?? null,
      bodySnippet: resp.ok ? undefined : JSON.stringify(data).slice(0, 400),
    };
  } catch (err) {
    return { ok: false, status: 0, usage: null, note: String(err) };
  }
}

function print(title: string, r: LegResult): void {
  console.log(`\n${r.ok ? '✅' : '❌'} ${title}  (HTTP ${r.status})`);
  if (r.usage) console.log('   usage:', JSON.stringify(r.usage));
  if (r.bodySnippet) console.log('   body :', r.bodySnippet);
  if (r.note) console.log('   note :', r.note);
}

async function main(): Promise<void> {
  console.log(`模型: ${MODEL} | account: ${ACCOUNT_ID} | gateway: ${GATEWAY_ID}`);
  if (!CF_AIG_TOKEN || !CF_TOKEN) {
    console.error('\n缺少 CF_AIG_TOKEN 或 CF_TOKEN，无法测 unified billing。请在环境变量里提供后重跑。');
    process.exitCode = 1;
    return;
  }

  // A. unified 原生透传（与 gateway-service.ts proxyNative 的 anthropic 路径一致）
  print(
    'A. unified 原生透传  POST /anthropic/v1/messages',
    await postJson(
      `${GATEWAY_BASE}/anthropic/v1/messages`,
      {
        'anthropic-version': '2023-06-01',
        'cf-aig-authorization': `Bearer ${CF_AIG_TOKEN}`,
        authorization: `Bearer ${CF_TOKEN}`,
      },
      MESSAGES_BODY,
    ),
  );

  // B. unified OpenAI 兼容（走 AI Gateway compat 端点；CF 负责 OpenAI↔Anthropic 翻译，返回 OpenAI 形 usage）
  print(
    'B. unified OpenAI 兼容  POST /compat/chat/completions  (model=anthropic/<id>)',
    await postJson(
      `${GATEWAY_BASE}/compat/chat/completions`,
      { 'cf-aig-authorization': `Bearer ${CF_AIG_TOKEN}`, authorization: `Bearer ${CF_TOKEN}` },
      { ...MESSAGES_BODY, model: `anthropic/${MODEL}` },
    ),
  );

  // C. byok 原生透传：x-api-key + 不带 CF_TOKEN —— 这是将来切 BYOK 的代码路径
  if (ANTHROPIC_API_KEY) {
    print(
      'C. byok 原生透传  POST /anthropic/v1/messages  (x-api-key, 无 CF_TOKEN)',
      await postJson(
        `${GATEWAY_BASE}/anthropic/v1/messages`,
        {
          'anthropic-version': '2023-06-01',
          'cf-aig-authorization': `Bearer ${CF_AIG_TOKEN}`,
          'x-api-key': ANTHROPIC_API_KEY,
        },
        MESSAGES_BODY,
      ),
    );
  } else {
    console.log('\n⏭  跳过 C（byok）：未提供 ANTHROPIC_API_KEY');
  }

  // 模型目录（尽力而为；失败就去后台看）
  try {
    const resp = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/v1/models`, {
      headers: { authorization: `Bearer ${CF_TOKEN}` },
    });
    if (resp.ok) {
      const data = (await resp.json()) as { data?: Array<{ id?: string }> };
      const ids = (data.data ?? [])
        .map((m) => m.id ?? '')
        .filter((id) => id.includes('anthropic') || id.includes('claude'));
      console.log(
        '\n📋 可用 anthropic 模型 ID：',
        ids.length ? ids.join(', ') : '(未匹配到，请去 CF 后台 AI Gateway 看 catalog)',
      );
    } else {
      console.log(
        `\n📋 模型目录拉取失败（HTTP ${resp.status}），请在 CF 后台 AI Gateway → Models 查看可用 anthropic 模型 ID。`,
      );
    }
  } catch (err) {
    console.log('\n📋 模型目录拉取异常：', String(err));
  }

  console.log(
    '\n完成。请核对：\n' +
      '  · A/C 的 usage 是否含 input_tokens / output_tokens（Anthropic 原生形）\n' +
      '  · B 的 usage 是否是 prompt_tokens / completion_tokens（OpenAI 形）\n' +
      '  · CF 后台 credits 是否因 A、B 扣减，而 C 不扣\n' +
      '  · 若 A/B 报 model 不存在，把上面「可用 anthropic 模型 ID」里的正确串告诉我',
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
