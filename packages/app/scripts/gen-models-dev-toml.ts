/**
 * 生成提交给 models.dev 的 provider / model TOML。
 *
 * 为什么需要这个：opencode 之类的客户端不调 provider 的 /v1/models，它们的模型列表
 * 来自 models.dev（开源 TOML 数据库，走 PR 收录）。MuiRouter 进了 models.dev，用户
 * 在 opencode 里就只需 `export MUIROUTER_API_KEY=...`，不用手写模型清单。
 *
 * 用法：
 *   node scripts/gen-models-dev-toml.ts            # 输出到 dist/models-dev/
 *   node scripts/gen-models-dev-toml.ts --remote   # 模型清单取自生产 D1（默认本地）
 *
 * 产物需要人工提 PR 到 https://github.com/sst/models.dev —— 往外部开源仓库推分支
 * 不是脚本该干的事。上游 CI 会跑 script/validate.ts 做 schema 校验。
 *
 * 维护：每次加模型 / 调价后重跑本脚本，diff 出变化的 TOML 再提一次 PR。
 * 这是 models.dev 生态的固有成本，它没有让 provider 自助同步的机制。
 */

import fs from 'node:fs';
import path from 'node:path';
import { type ModelMetadata, parseModelMetadata } from '@muirouter/shared-db/model-metadata';
import { type D1Model, loadModelsFromD1, repoRoot } from './lib/d1-models.ts';

/** models.dev 上的 provider 身份。合并后改不了，别动。 */
const PROVIDER_ID = 'muirouter';
const PROVIDER_TOML = `name = "MuiRouter"
env = ["MUIROUTER_API_KEY"]
npm = "@ai-sdk/openai-compatible"
api = "https://api.muirouter.com/v1"
doc = "https://muirouter.com/pricing"
`;

const DEFAULT_MARKUP_RATE = 1.2;

const useRemote = process.argv.includes('--remote');
const outRoot = path.join(repoRoot, 'packages', 'app', 'dist', 'models-dev');
const providerDir = path.join(outRoot, 'providers', PROVIDER_ID);

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

function renderModelToml(ready: ReadyModel): string {
  const { metadata, model } = ready;
  const markupRate = model.markupRate ?? DEFAULT_MARKUP_RATE;
  const lines: string[] = [`name = ${tomlString(ready.displayName)}`, `description = ${tomlString(ready.description)}`];
  if (metadata.family) lines.push(`family = ${tomlString(metadata.family)}`);
  lines.push(
    `attachment = ${metadata.attachment}`,
    `reasoning = ${metadata.reasoning}`,
    `tool_call = ${metadata.toolCall}`,
  );
  if (metadata.temperature !== undefined) lines.push(`temperature = ${metadata.temperature}`);
  if (metadata.structuredOutput !== undefined) lines.push(`structured_output = ${metadata.structuredOutput}`);
  lines.push(`open_weights = ${metadata.openWeights}`);
  if (metadata.knowledge) lines.push(`knowledge = ${tomlString(metadata.knowledge)}`);
  lines.push(`release_date = ${tomlString(ready.releaseDate)}`, `last_updated = ${tomlString(ready.lastUpdated)}`);

  lines.push('', '[cost]', `input = ${retailPrice(ready.inputPrice, markupRate)}`);
  lines.push(`output = ${retailPrice(ready.outputPrice, markupRate)}`);
  if (model.cachedInputPrice != null) lines.push(`cache_read = ${retailPrice(model.cachedInputPrice, markupRate)}`);
  if (model.cacheWritePrice != null) lines.push(`cache_write = ${retailPrice(model.cacheWritePrice, markupRate)}`);

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

function main(): void {
  const models = loadModelsFromD1(useRemote);

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
  for (const item of ready) {
    fs.writeFileSync(path.join(providerDir, 'models', `${item.model.id}.toml`), renderModelToml(item), 'utf8');
  }
  fs.writeFileSync(path.join(outRoot, 'opencode.json'), renderOpencodeConfig(ready), 'utf8');

  console.log(`共 ${models.length} 个模型，收录 ${ready.length}，跳过 ${skipped.length}`);
  if (skipped.length > 0) {
    console.log('\n跳过明细：');
    for (const item of skipped) console.log(`  ${item.id.padEnd(28)} ${item.reason}`);
  }
  console.log(`\n产物：${path.relative(repoRoot, outRoot)}`);
  console.log('  providers/muirouter/{provider.toml,models/*.toml}  → 提 PR 到 sst/models.dev');
  console.log('  opencode.json                                     → PR 合并前给用户的兜底配置');
  console.log('\n注意：models.dev 的 logo.svg 是可选项，本脚本不生成——品牌资产该由人来定。');
}

main();
