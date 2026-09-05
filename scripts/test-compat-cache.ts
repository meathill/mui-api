/**
 * 只读实验脚本：验证 CF AI Gateway 的 compat 端点（OpenAI 兼容 → Anthropic 转译）能否透传
 * Anthropic prompt cache 标记。这是"判断 provider=anthropic 就自动加参数"方案的前提——
 * 该方案下我们 Worker 只能往 OpenAI 格式 body 里塞字段，能不能变成 Anthropic 侧的
 * cache_control 完全取决于 CF 的转译层，网上没有可靠结论，只能实测。
 *
 * 实验设计（全部请求共享同一段 >2048 token 的稳定前缀，user 消息尾部随机变化以绕开
 * CF 网关自身的响应缓存）：
 *  1. baseline：不带任何 cache 标记 → 预期无缓存
 *  2. 顶层 cache_control（Anthropic automatic caching 字段原样塞进 OpenAI body）
 *  3. 同 2 再发一次（不同 suffix）→ 若 2 建了缓存，3 应出现缓存读
 *  4. cache_control 嵌在 system 的 content part 里（断点写法）
 *
 * 判定关键：OpenAI 形 usage 的 prompt_tokens_details.cached_tokens（我们计费就读它）。
 * 若 Anthropic 侧真建了缓存但 CF 没把它映射回 OpenAI usage，客户账单同样享受不到
 * 缓存价——那样该方案对我们就没有意义。
 *
 * 用法（由你运行；CF_AIG_TOKEN 是 secret，脚本只从环境变量或 .env 读取）：
 *  CF_AIG_TOKEN=xxx node scripts/test-compat-cache.ts
 *  可选：--model claude-sonnet-4-6（默认 claude-haiku-4-5，门槛 2048 token 最省）
 *
 * 成本：5 个请求 × ~3.2k 输入 token 的 haiku，合计 < $0.02。
 */

import { readFileSync } from 'node:fs';

const TTL = { type: 'ephemeral' } as const;

function loadToken(): string {
  if (process.env.CF_AIG_TOKEN) return process.env.CF_AIG_TOKEN;
  for (const path of ['../packages/app/.env', '../../.env']) {
    try {
      const raw = readFileSync(new URL(path, import.meta.url), 'utf8');
      const line = raw.split('\n').find((l) => l.startsWith('CF_AIG_TOKEN='));
      if (line)
        return line
          .slice('CF_AIG_TOKEN='.length)
          .trim()
          .replace(/^["']|["']$/g, '');
    } catch {
      // 文件不存在则跳过
    }
  }
  console.error('缺少 CF_AIG_TOKEN：请设环境变量或在 packages/app/.env 中配置');
  process.exit(1);
}

function loadGatewayIds(): { accountId: string; gatewayId: string } {
  const raw = readFileSync(new URL('../packages/app/wrangler.jsonc', import.meta.url), 'utf8');
  const account = raw.match(/"CF_ACCOUNT_ID"\s*:\s*"([^"]+)"/)?.[1];
  const gateway = raw.match(/"CF_GATEWAY_ID"\s*:\s*"([^"]+)"/)?.[1];
  if (!account || !gateway) throw new Error('未在 wrangler.jsonc 找到 CF_ACCOUNT_ID / CF_GATEWAY_ID');
  return { accountId, gatewayId: gateway };
}

// 稳定前缀：重复段落拼到 ~3.2k token（haiku 缓存门槛 2048），所有请求逐字节一致
function buildPrefix(): string {
  const para =
    'You are reviewing source code for a large TypeScript monorepo. The build pipeline runs biome for lint and formatting, vitest for unit tests, and wrangler for deploying the API worker. ' +
    'Each package has its own tsconfig with strict mode enabled, and CI fails on any type error. Documentation lives in markdown files at the repository root. ';
  return para.repeat(40);
}

interface Attempt {
  name: string;
  body: Record<string, unknown>;
}

function buildAttempts(model: string, prefix: string): Attempt[] {
  const base = { model, max_tokens: 16, stream: false };
  const ask = (tag: string) => ({
    role: 'user' as const,
    content: `用一句话概括上面的部署流程。(${tag})`,
  });
  return [
    { name: '1.baseline（无标记）', body: { ...base, messages: [{ role: 'system', content: prefix }, ask('a')] } },
    {
      name: '2.顶层 cache_control',
      body: { ...base, messages: [{ role: 'system', content: prefix }, ask('b')], cache_control: TTL },
    },
    {
      name: '3.顶层 cache_control 复读',
      body: { ...base, messages: [{ role: 'system', content: prefix }, ask('c')], cache_control: TTL },
    },
    {
      name: '4.system content part 内嵌断点',
      body: {
        ...base,
        messages: [{ role: 'system', content: [{ type: 'text', text: prefix, cache_control: TTL }] }, ask('d')],
      },
    },
  ];
}

async function main() {
  const args = process.argv.slice(2);
  const modelArg = args.includes('--model') ? args[args.indexOf('--model') + 1] : undefined;
  const model = `anthropic/${modelArg ?? 'claude-haiku-4-5'}`;
  const token = loadToken();
  const { accountId, gatewayId } = loadGatewayIds();
  const url = `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/compat/v1/chat/completions`;
  const prefix = buildPrefix();
  const attempts = buildAttempts(model, prefix);

  console.log(`目标: ${url}\n模型: ${model}\n前缀长度: ${prefix.length} 字符（约 3.2k token）\n`);

  const results: { name: string; status: number; usage: Record<string, unknown> | null }[] = [];
  for (const attempt of attempts) {
    let status = 0;
    let usage: Record<string, unknown> | null = null;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(attempt.body),
      });
      status = res.status;
      const text = await res.text();
      if (res.ok) {
        const json = JSON.parse(text) as { usage?: Record<string, unknown> };
        usage = json.usage ?? null;
      } else {
        console.log(`✗ ${attempt.name}: HTTP ${status} → ${text.slice(0, 300)}`);
      }
    } catch (e) {
      console.log(`✗ ${attempt.name}: 请求异常 → ${String(e)}`);
    }
    if (usage) {
      const details = (usage.prompt_tokens_details ?? usage.input_tokens_details ?? {}) as Record<string, unknown>;
      console.log(`✓ ${attempt.name}: usage=${JSON.stringify(usage)} → cached_tokens=${details.cached_tokens ?? 0}`);
    }
    results.push({ name: attempt.name, status, usage });
  }

  console.log('\n=== 判定 ===');
  const baseline = results[0];
  const cacheHinted = results.slice(1);
  const anyRejected = cacheHinted.some((r) => r.status !== 200);
  const anyCached = results.some((r) => {
    const details = (r.usage?.prompt_tokens_details ?? r.usage?.input_tokens_details ?? {}) as Record<string, unknown>;
    return typeof details.cached_tokens === 'number' && details.cached_tokens > 0;
  });

  if (baseline?.status !== 200) {
    console.log('baseline 都没跑通，先检查 CF_AIG_TOKEN / 网关配置');
  } else if (anyRejected) {
    console.log('→ CF compat 拒收带 cache_control 的 body：顶层注入方案不可行（除非自研转换层）');
  } else if (anyCached) {
    console.log('→ 可行！CF 透传且把缓存映射回了 OpenAI usage，"判断 provider=anthropic 自动加参数"成立');
    console.log('  下一步：在 normalizeChatBody 或 callAnthropicCompat 注入，并决定 opt-in / 默认开启');
  } else {
    console.log('→ 未观测到缓存：可能 CF 剥掉了字段，也可能建了缓存但没映射回 OpenAI usage');
    console.log('  两种情况对客户账单都无效（我们计费只认 usage 里的 cached_tokens），视为不可行；');
    console.log('  若想区分，可到 AI Gateway 后台 Logs 看 Anthropic 原生响应的 cache 字段');
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
