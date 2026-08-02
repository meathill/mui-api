/**
 * 生成提交给 models.dev 的 provider / model TOML。
 *
 * 为什么需要这个：opencode 之类的客户端不调 provider 的 /v1/models，它们的模型列表
 * 来自 models.dev（开源 TOML 数据库，走 PR 收录）。MuiRouter 进了 models.dev，用户
 * 在 opencode 里就只需 `export MUIROUTER_API_KEY=...`，不用手写模型清单。
 *
 * 用法：
 *   node scripts/gen-models-dev-toml.ts --remote --models-dev ~/path/to/models.dev
 *     --remote      模型清单取自生产 D1（默认本地）
 *     --models-dev  models.dev 仓库 checkout 路径；给了才能生成 base_model 形式
 *
 * **优先生成 base_model 形式**。models.dev 对 MuiRouter 这种 wrapper/router provider
 * 明确要求「引用已有模型元数据，而不是复制一份」（README「Reuse Model Metadata with
 * base_model」一节），当前 requesty 等同类 provider 也已全部改用这个写法。所以只要
 * 顶层 models/<vendor>/<id>.toml 存在，我们就只写 base_model + 自己的 [cost]，
 * limit / modalities / 能力标记全部继承——上游更新我们自动跟上，也少一堆要维护的字段。
 * 顶层没抽出来的模型（如 qwen3-30b）才退回完整写法；个别产品 ID 顶层没有同名文件但有
 * 近似变体的（如 gpt-5.6 之于 gpt-5.6-sol），走 MANUAL_BASE_MODEL 手工映射——照抄上游
 * 自己 provider 条目的先例（openai 对同一产品 ID 就是这么处理的）。
 *
 * logo.svg 是手工资产，不是本脚本生成的，源文件在 scripts/models-dev-assets/logo.svg，
 * 每次运行原样拷进产物目录。
 *
 * 产物需要提 PR 到 https://github.com/anomalyco/models.dev（原 sst/models.dev），
 * 默认分支 dev。上游 CI 会跑 schema 校验。
 *
 * 维护：每次加模型 / 调价后重跑本脚本，diff 出变化的 TOML 再提一次 PR。
 * 这是 models.dev 生态的固有成本，它没有让 provider 自助同步的机制。
 */

import fs from 'node:fs';
import path from 'node:path';
import { type ModelMetadata, parseModelMetadata } from '@muirouter/shared-db/model-metadata';
import { type D1Model, appRoot, loadModelsFromD1, repoRoot } from './lib/d1-models.ts';

/** models.dev 上的 provider 身份。合并后改不了，别动。 */
const PROVIDER_ID = 'muirouter';

/**
 * 手工映射：base_model 目标不需要与我们的模型 ID 同名，只要指向一个真实存在的
 * `models/<vendor>/<id>.toml` 即可。索引匹配漏了这类情况——上游 openai 自己的
 * provider 条目就是这么处理 gpt-5.6 的（`base_model = "openai/gpt-5.6-sol"` +
 * `name` 覆盖），照抄这个先例。仅在自动索引匹配失败时查这张表。
 */
const MANUAL_BASE_MODEL: Record<string, string> = {
  'gpt-5.6': 'openai/gpt-5.6-sol',
};
const PROVIDER_TOML = `name = "MuiRouter"
env = ["MUIROUTER_API_KEY"]
npm = "@ai-sdk/openai-compatible"
api = "https://api.muirouter.com/v1"
doc = "https://muirouter.com/pricing"
`;

const DEFAULT_MARKUP_RATE = 1.2;

const argv = process.argv.slice(2);
const useRemote = argv.includes('--remote');
const modelsDevRepo = argv[argv.indexOf('--models-dev') + 1] ?? null;
const outRoot = path.join(repoRoot, 'packages', 'app', 'dist', 'models-dev');
const providerDir = path.join(outRoot, 'providers', PROVIDER_ID);

/**
 * 扫 models.dev 的顶层 models/<vendor>/<id>.toml，建「模型 ID → vendor/id」索引。
 * 同名跨 vendor 的条目直接丢弃：宁可退回完整写法，也不要 base_model 指错源模型。
 */
function loadBaseModelIndex(repoPath: string): Map<string, string> {
  const modelsRoot = path.join(repoPath, 'models');
  if (!fs.existsSync(modelsRoot)) {
    throw new Error(`${modelsRoot} 不存在——--models-dev 应指向 models.dev 仓库根目录`);
  }

  const seen = new Map<string, string[]>();
  for (const vendor of fs.readdirSync(modelsRoot)) {
    const vendorDir = path.join(modelsRoot, vendor);
    if (!fs.statSync(vendorDir).isDirectory()) continue;
    for (const file of fs.readdirSync(vendorDir)) {
      if (!file.endsWith('.toml')) continue;
      const id = file.slice(0, -'.toml'.length);
      seen.set(id, [...(seen.get(id) ?? []), `${vendor}/${id}`]);
    }
  }

  const index = new Map<string, string>();
  for (const [id, refs] of seen) {
    if (refs.length === 1) index.set(id, refs[0]);
  }
  return index;
}

/** 我们的对外模型名优先，其次上游模型名（个别模型对外做过改名），最后查手工映射表。 */
function findBaseModel(index: Map<string, string> | null, model: D1Model): string | null {
  if (MANUAL_BASE_MODEL[model.id]) return MANUAL_BASE_MODEL[model.id];
  if (!index) return null;
  for (const key of [model.id, model.upstreamModelId]) {
    if (key && index.has(key)) return index.get(key) as string;
  }
  return null;
}

// ---- reasoning_options ----------------------------------------------------
//
// models.dev 的 schema 强制：reasoning = true 就必须给 reasoning_options，
// reasoning = false 就不许给。它描述的是「本 provider 怎么暴露推理控制」，
// 所以不能从 base_model 继承，得我们自己声明。
//
// 我们的规则：除 gemini 外，chat body 原样透传给上游（normalizeChatBody 只动
// max_tokens 和 grok 的三个不支持参数），所以上游第一方声明什么，我们就是什么。
// gemini 是唯一例外——gemini-compat.ts 的 translateChatRequest 只转发
// systemInstruction / maxOutputTokens / temperature / topP / stopSequences，
// 推理参数被丢弃，因此声明空数组（同 anyapi 对它的 Google 模型的处理）。

type ReasoningOption = { type: string; values?: string[]; min?: number; max?: number };

const FIRST_PARTY_FOR_REASONING = [
  'anthropic',
  'openai',
  'google',
  'deepseek',
  'xai',
  'moonshotai',
  'zhipuai',
  'xiaomi',
  'cloudflare-workers-ai',
  'alibaba',
];

/** 我们的翻译层会吃掉推理参数的 provider。 */
const REASONING_STRIPPED_PROVIDERS = new Set(['google-ai-studio']);

interface ModelsDevApiModel {
  reasoning?: boolean;
  reasoning_options?: ReasoningOption[];
}

async function loadReasoningOptions(): Promise<Map<string, ReasoningOption[]>> {
  const response = await fetch('https://models.dev/api.json');
  if (!response.ok) throw new Error(`拉取 models.dev api.json 失败：HTTP ${response.status}`);
  const api = (await response.json()) as Record<string, { models?: Record<string, ModelsDevApiModel> }>;

  const result = new Map<string, ReasoningOption[]>();
  for (const vendor of FIRST_PARTY_FOR_REASONING) {
    for (const [key, entry] of Object.entries(api[vendor]?.models ?? {})) {
      if (!entry.reasoning_options) continue;
      const bare = key.includes('/') ? (key.split('/').pop() as string) : key;
      // 先到先得：FIRST_PARTY_FOR_REASONING 已按可信度排序
      if (!result.has(bare)) result.set(bare, entry.reasoning_options);
      if (!result.has(key)) result.set(key, entry.reasoning_options);
    }
  }
  return result;
}

function resolveReasoningOptions(
  index: Map<string, ReasoningOption[]>,
  model: D1Model,
  metadata: ModelMetadata,
): ReasoningOption[] | null {
  if (!metadata.reasoning) return null; // reasoning=false 时给了反而报错
  if (REASONING_STRIPPED_PROVIDERS.has(model.provider)) return [];
  for (const key of [model.id, model.upstreamModelId]) {
    if (key && index.has(key)) return index.get(key) as ReasoningOption[];
  }
  // 查不到上游声明就不瞎猜，按「不暴露控制」处理
  return [];
}

function renderReasoningOptions(options: ReasoningOption[]): string {
  const inline = options.map((option) => {
    const parts = [`type = ${tomlString(option.type)}`];
    if (option.values) parts.push(`values = ${tomlStringArray(option.values)}`);
    if (option.min !== undefined) parts.push(`min = ${option.min}`);
    if (option.max !== undefined) parts.push(`max = ${option.max}`);
    return `{ ${parts.join(', ')} }`;
  });
  return `reasoning_options = [${inline.join(', ')}]`;
}

interface ReadyModel {
  model: D1Model;
  metadata: ModelMetadata;
  description: string;
  displayName: string;
  releaseDate: string;
  lastUpdated: string;
  contextLength: number;
  maxOutputTokens: number;
  inputPrice: number;
  outputPrice: number;
}

/** models.dev 的 cost 是用户实付价，所以要乘加价倍率。四舍五入吃掉浮点尾巴。 */
function retailPrice(pricePerMillion: number, markupRate: number): number {
  return Number((pricePerMillion * markupRate).toFixed(6));
}

function tomlString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function tomlStringArray(values: readonly string[]): string {
  return `[${values.map(tomlString).join(', ')}]`;
}

/**
 * 只收 chat 模型：输出模态恰好是纯文本。
 * 图片 / TTS / 视频模型 models.dev 也收，但 opencode 用不上，而每多一条就多一份
 * 要长期维护的规格——等真有人要了再补。
 */
function isChatModel(metadata: ModelMetadata): boolean {
  const output = metadata.modalities?.output;
  return output?.length === 1 && output[0] === 'text';
}

/** models.dev 的 Model schema 是必填项齐全才通过，缺一个字段整个 PR 的 CI 就红。 */
function toReadyModel(model: D1Model): ReadyModel | { skip: string } {
  const parsed = parseModelMetadata(model.metadataJson);
  if (!parsed.ok) return { skip: `元数据非法：${parsed.error}` };
  const metadata = parsed.value;
  if (!metadata) return { skip: '未录入元数据' };
  if (!isChatModel(metadata)) return { skip: '非 chat 模型（输出模态不是纯文本）' };

  const missing: string[] = [];
  if (!metadata.description) missing.push('description');
  if (!metadata.releaseDate) missing.push('releaseDate');
  if (!metadata.lastUpdated) missing.push('lastUpdated');
  if (!metadata.modalities) missing.push('modalities');
  if (model.contextLength == null) missing.push('contextLength');
  if (model.maxOutputTokens == null) missing.push('maxOutputTokens');
  if (model.inputPrice == null) missing.push('inputPrice');
  if (model.outputPrice == null) missing.push('outputPrice');
  if (missing.length > 0) return { skip: `缺字段：${missing.join(', ')}` };

  return {
    model,
    metadata,
    description: metadata.description as string,
    displayName: model.displayName ?? model.id,
    releaseDate: metadata.releaseDate as string,
    lastUpdated: metadata.lastUpdated as string,
    contextLength: model.contextLength as number,
    maxOutputTokens: model.maxOutputTokens as number,
    inputPrice: model.inputPrice as number,
    outputPrice: model.outputPrice as number,
  };
}

/** [cost] 表：base_model 形式与完整形式共用。覆写嵌套表必须给全值，不能只补一半。 */
function renderCostTable(ready: ReadyModel): string[] {
  const { model } = ready;
  const markupRate = model.markupRate ?? DEFAULT_MARKUP_RATE;
  const lines = [
    '[cost]',
    `input = ${retailPrice(ready.inputPrice, markupRate)}`,
    `output = ${retailPrice(ready.outputPrice, markupRate)}`,
  ];
  if (model.cachedInputPrice != null) lines.push(`cache_read = ${retailPrice(model.cachedInputPrice, markupRate)}`);
  if (model.cacheWritePrice != null) lines.push(`cache_write = ${retailPrice(model.cacheWritePrice, markupRate)}`);
  return lines;
}

/**
 * base_model 形式：只声明源模型和我们自己的价格。
 * 不覆写 limit / modalities / 能力标记——那些本来就是从 models.dev 抄来的，继承等于
 * 白拿上游后续修正；覆写反而会让我们的副本随时间漂移。
 */
/**
 * `name` 总是显式覆盖，不依赖继承。base_model 目标文件的 name 字段不一定和我们
 * 的 displayName 一致——最明显的例子是 gpt-5.6 指向 openai/gpt-5.6-sol，那份文件
 * 的 name 是 "GPT-5.6 Sol"。生成器拿不到 base 文件内容做逐条比对，与其猜哪些一致
 * 哪些不一致，不如统一显式声明，行为可预测。
 */
function renderBaseModelToml(ready: ReadyModel, baseRef: string, reasoning: ReasoningOption[] | null): string {
  const head = [`base_model = ${tomlString(baseRef)}`, `name = ${tomlString(ready.displayName)}`];
  if (reasoning) head.push('', renderReasoningOptions(reasoning));
  return `${head.join('\n')}\n\n${renderCostTable(ready).join('\n')}\n`;
}

function renderModelToml(ready: ReadyModel, reasoning: ReasoningOption[] | null): string {
  const { metadata } = ready;
  const lines: string[] = [`name = ${tomlString(ready.displayName)}`, `description = ${tomlString(ready.description)}`];
  if (metadata.family) lines.push(`family = ${tomlString(metadata.family)}`);
  lines.push(`attachment = ${metadata.attachment}`, `reasoning = ${metadata.reasoning}`);
  if (reasoning) lines.push(renderReasoningOptions(reasoning));
  lines.push(`tool_call = ${metadata.toolCall}`);
  if (metadata.temperature !== undefined) lines.push(`temperature = ${metadata.temperature}`);
  if (metadata.structuredOutput !== undefined) lines.push(`structured_output = ${metadata.structuredOutput}`);
  lines.push(`open_weights = ${metadata.openWeights}`);
  if (metadata.knowledge) lines.push(`knowledge = ${tomlString(metadata.knowledge)}`);
  lines.push(`release_date = ${tomlString(ready.releaseDate)}`, `last_updated = ${tomlString(ready.lastUpdated)}`);

  lines.push('', ...renderCostTable(ready));

  lines.push('', '[limit]', `context = ${ready.contextLength}`, `output = ${ready.maxOutputTokens}`);

  const modalities = metadata.modalities as NonNullable<ModelMetadata['modalities']>;
  lines.push(
    '',
    '[modalities]',
    `input = ${tomlStringArray(modalities.input)}`,
    `output = ${tomlStringArray(modalities.output)}`,
  );

  return `${lines.join('\n')}\n`;
}

/**
 * PR 合并前的兜底：opencode 自定义 provider 配置片段。
 * 收录之后用户只需设 MUIROUTER_API_KEY，这份片段降级为附录。
 */
function renderOpencodeConfig(models: ReadyModel[]): string {
  const entries = Object.fromEntries(models.map((item) => [item.model.id, { name: item.displayName }]));
  return `${JSON.stringify(
    {
      $schema: 'https://opencode.ai/config.json',
      provider: {
        muirouter: {
          npm: '@ai-sdk/openai-compatible',
          name: 'MuiRouter',
          options: { baseURL: 'https://api.muirouter.com/v1', apiKey: '{env:MUIROUTER_API_KEY}' },
          models: entries,
        },
      },
    },
    null,
    2,
  )}\n`;
}

async function main(): Promise<void> {
  const models = loadModelsFromD1(useRemote);
  const baseIndex = modelsDevRepo ? loadBaseModelIndex(modelsDevRepo) : null;
  const reasoningIndex = await loadReasoningOptions();

  const ready: ReadyModel[] = [];
  const skipped: Array<{ id: string; reason: string }> = [];
  for (const model of models) {
    const result = toReadyModel(model);
    if ('skip' in result) skipped.push({ id: model.id, reason: result.skip });
    else ready.push(result);
  }

  fs.rmSync(providerDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(providerDir, 'models'), { recursive: true });
  fs.writeFileSync(path.join(providerDir, 'provider.toml'), PROVIDER_TOML, 'utf8');
  fs.copyFileSync(path.join(appRoot, 'scripts', 'models-dev-assets', 'logo.svg'), path.join(providerDir, 'logo.svg'));

  const standalone: string[] = [];
  const noReasoningControl: string[] = [];
  for (const item of ready) {
    const baseRef = findBaseModel(baseIndex, item.model);
    if (!baseRef) standalone.push(item.model.id);
    const reasoning = resolveReasoningOptions(reasoningIndex, item.model, item.metadata);
    if (reasoning?.length === 0) noReasoningControl.push(item.model.id);
    const body = baseRef ? renderBaseModelToml(item, baseRef, reasoning) : renderModelToml(item, reasoning);
    fs.writeFileSync(path.join(providerDir, 'models', `${item.model.id}.toml`), body, 'utf8');
  }
  fs.writeFileSync(path.join(outRoot, 'opencode.json'), renderOpencodeConfig(ready), 'utf8');

  console.log(`共 ${models.length} 个模型，收录 ${ready.length}，跳过 ${skipped.length}`);
  if (skipped.length > 0) {
    console.log('\n跳过明细：');
    for (const item of skipped) console.log(`  ${item.id.padEnd(28)} ${item.reason}`);
  }
  if (!baseIndex) {
    console.log('\n⚠️  未给 --models-dev，全部生成完整写法。提 PR 前请带上该参数改用 base_model。');
  } else {
    console.log(`\nbase_model 形式 ${ready.length - standalone.length} 个，完整写法 ${standalone.length} 个`);
    if (standalone.length > 0) {
      console.log(`  顶层 models/ 未收录，只能写全量：${standalone.join(', ')}`);
    }
  }
  if (noReasoningControl.length > 0) {
    console.log(`\nreasoning_options = []（推理模型但我们不暴露控制）：${noReasoningControl.join(', ')}`);
  }
  console.log(`\n产物：${path.relative(repoRoot, outRoot)}`);
  console.log('  providers/muirouter/{provider.toml,models/*.toml}  → 提 PR 到 anomalyco/models.dev');
  console.log('  opencode.json                                     → PR 合并前给用户的兜底配置');
  console.log('  providers/muirouter/logo.svg                     → 拷自 scripts/models-dev-assets/logo.svg');
}

await main();
