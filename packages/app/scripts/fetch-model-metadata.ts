/**
 * 从 models.dev 回填模型元数据，产出一份 UPDATE migration。
 *
 * 为什么能这么干：我们转售的绝大多数模型（claude-* / gpt-* / gemini-* / mimo-* …）
 * 在 models.dev 上都已有第一方条目，context 长度、能力标记、模态、发布日期都是现成的。
 * 抄元数据、价格用我们自己的，比手写 30+ 份规格靠谱得多。
 *
 * 用法：
 *   node scripts/fetch-model-metadata.ts --dry-run     # 只打印匹配情况，不写文件
 *   node scripts/fetch-model-metadata.ts               # 生成 0024 migration
 *   node scripts/fetch-model-metadata.ts --remote      # 模型清单取自生产 D1（默认本地）
 *
 * 只读外网 + 读 D1 + 写本地 SQL 文件，不写数据库；migration 由人工执行。
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  type ModelMetadata,
  emptyModelMetadata,
  serializeModelMetadata,
  validateModelMetadata,
} from '@muirouter/shared-db/model-metadata';
import { type D1Model, loadModelsFromD1, repoRoot } from './lib/d1-models.ts';

const MODELS_DEV_API = 'https://models.dev/api.json';
const MIGRATION_SLUG = 'backfill_model_metadata';

/**
 * 第一方 provider 优先级：同一个模型名在几十个转售商下都有条目，但只有原厂
 * （及 xiaomi 自营端点）的能力标记和上下文长度可信。按这个顺序取第一个命中。
 */
const FIRST_PARTY_PROVIDERS = [
  'anthropic',
  'openai',
  'google',
  'google-vertex',
  'xai',
  'moonshotai',
  'zhipuai',
  'xiaomi',
  'xiaomi-token-plan-sgp',
  'xiaomi-token-plan-cn',
  'xiaomi-token-plan-ams',
  'alibaba',
  // workers-ai 的模型由 Cloudflare 托管，这两个就是它的第一方条目
  'cloudflare-workers-ai',
  'cloudflare-ai-gateway',
];

/**
 * 人工覆盖表：models.dev 上没有条目的模型写在这里。
 * 键是我们的对外模型 ID。重跑脚本不会丢——先查 models.dev，未命中才落到这里。
 * 只填有据可查的数据，宁可留空让生成器跳过，也不要编造 context 长度和发布日期。
 *
 * 已知缺口：mimo-v2.5-flash —— models.dev 无此条目，小米公开文档也查不到它的
 * context 长度与发布日期（能查到的是 MiMo-V2.5 的 1M 和 MiMo-V2-Flash 的 256K，
 * 不能据此推断）。等拿到官方数据再补；在此之前生成器会跳过它，不影响其它模型。
 */
const MANUAL_METADATA: Record<string, Omit<Resolved, 'model' | 'source'>> = {};

interface ModelsDevEntry {
  name?: string;
  description?: string;
  family?: string;
  attachment?: boolean;
  reasoning?: boolean;
  tool_call?: boolean;
  temperature?: boolean;
  structured_output?: boolean;
  open_weights?: boolean;
  knowledge?: string;
  release_date?: string;
  last_updated?: string;
  modalities?: { input?: string[]; output?: string[] };
  limit?: { context?: number; output?: number };
}

interface Candidate {
  providerId: string;
  modelKey: string;
  entry: ModelsDevEntry;
}

interface Resolved {
  model: D1Model;
  source: string;
  displayName: string | null;
  contextLength: number | null;
  maxOutputTokens: number | null;
  metadata: ModelMetadata;
}

const args = new Set(process.argv.slice(2));
const isDryRun = args.has('--dry-run');
const useRemote = args.has('--remote');

/**
 * 建模型名索引。models.dev 的 key 形如 'google/gemini-2.5-flash'、'gpt-5.6' 或
 * '@cf/qwen/qwen3-30b-a3b-fp8'。同时按完整 key 和裸名（末段）建索引：
 * 我们的 workers-ai 模型 upstreamModelId 存的是完整的 '@cf/...' 名，只按裸名会漏。
 */
function buildIndex(api: Record<string, { models?: Record<string, ModelsDevEntry> }>): Map<string, Candidate[]> {
  const index = new Map<string, Candidate[]>();
  const add = (key: string, candidate: Candidate): void => {
    const list = index.get(key) ?? [];
    list.push(candidate);
    index.set(key, list);
  };

  for (const [providerId, provider] of Object.entries(api)) {
    for (const [modelKey, entry] of Object.entries(provider.models ?? {})) {
      const candidate = { providerId, modelKey, entry };
      add(modelKey, candidate);
      const bare = modelKey.includes('/') ? (modelKey.split('/').pop() as string) : modelKey;
      if (bare !== modelKey) add(bare, candidate);
    }
  }
  return index;
}

function pickCandidate(candidates: Candidate[]): Candidate | null {
  for (const preferred of FIRST_PARTY_PROVIDERS) {
    const hit = candidates.find((candidate) => candidate.providerId === preferred);
    if (hit) return hit;
  }
  // 没有第一方条目时退回转售商——元数据仍比空着强，但会在报告里标出来供人工复核。
  return candidates[0] ?? null;
}

function toMetadata(entry: ModelsDevEntry): ModelMetadata {
  const draft: Record<string, unknown> = { ...emptyModelMetadata() };
  if (entry.description) draft.description = entry.description;
  if (entry.family) draft.family = entry.family;
  if (typeof entry.attachment === 'boolean') draft.attachment = entry.attachment;
  if (typeof entry.reasoning === 'boolean') draft.reasoning = entry.reasoning;
  if (typeof entry.tool_call === 'boolean') draft.toolCall = entry.tool_call;
  if (typeof entry.temperature === 'boolean') draft.temperature = entry.temperature;
  if (typeof entry.structured_output === 'boolean') draft.structuredOutput = entry.structured_output;
  if (typeof entry.open_weights === 'boolean') draft.openWeights = entry.open_weights;
  if (entry.knowledge) draft.knowledge = entry.knowledge;
  if (entry.release_date) draft.releaseDate = entry.release_date;
  if (entry.last_updated) draft.lastUpdated = entry.last_updated;
  if (entry.modalities?.input?.length && entry.modalities.output?.length) {
    draft.modalities = { input: entry.modalities.input, output: entry.modalities.output };
  }

  // 过一遍共用校验器：上游偶尔会出现我们不认的取值（新模态、非法日期格式），
  // 与其把脏数据写进 migration，不如在这里就炸掉。
  const result = validateModelMetadata(draft);
  if (!result.ok) throw new Error(`元数据校验失败：${result.error}\n${JSON.stringify(draft)}`);
  return result.value;
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function buildMigration(resolved: Resolved[]): string {
  const header = [
    '-- 回填模型对外元数据，数据来自 models.dev（第一方 provider 条目优先）。',
    '-- 由 packages/app/scripts/fetch-model-metadata.ts 生成，不要手改；',
    '-- 要更新请重跑脚本并 review diff。',
    '--',
    '-- 只回填 display_name / context_length / max_output_tokens / metadata_json 四列，',
    '-- 定价一律不动——models.dev 上的 cost 是别家的价格，我们的价格以本表为准。',
    '',
  ].join('\n');

  const statements = resolved.map((item) => {
    const fields = [
      `display_name = ${item.displayName === null ? 'NULL' : sqlString(item.displayName)}`,
      `context_length = ${item.contextLength ?? 'NULL'}`,
      `max_output_tokens = ${item.maxOutputTokens ?? 'NULL'}`,
      `metadata_json = ${sqlString(serializeModelMetadata(item.metadata))}`,
    ];
    return `-- ${item.model.id} ← ${item.source}\nUPDATE models SET ${fields.join(', ')} WHERE id = ${sqlString(item.model.id)};`;
  });

  return `${header}${statements.join('\n\n')}\n`;
}

/**
 * 找下一个可用的 migration 序号。之前这里是硬编码文件名——脚本设计上要能重跑
 * （见头部注释「维护：每次加模型/调价后重跑」），硬编码名字意味着第二次跑会原地
 * 覆盖第一次生成的文件；如果那个文件已经在生产跑过，覆盖了也不会被重新应用
 * （wrangler 按文件名去重），改动就这么静默丢失。扫目录取最大序号 + 1，
 * 每次重跑都是一份新 migration。
 */
function nextMigrationPath(): string {
  const drizzleDir = path.join(repoRoot, 'packages', 'shared-db', 'drizzle');
  const existing = fs
    .readdirSync(drizzleDir)
    .map((name) => name.match(/^(\d{4})_/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => Number(match[1]));
  const next = (existing.length > 0 ? Math.max(...existing) : 0) + 1;
  const fileName = `${String(next).padStart(4, '0')}_${MIGRATION_SLUG}.sql`;
  const target = path.join(drizzleDir, fileName);
  if (fs.existsSync(target)) throw new Error(`${target} 已存在，扫描逻辑有 bug，不能覆盖`);
  return target;
}

async function main(): Promise<void> {
  // 用 basic 投影：本脚本要在元数据列还没建起来的库上跑，也只需要这三列。
  const ourModels = loadModelsFromD1(useRemote, 'basic');

  const response = await fetch(MODELS_DEV_API);
  if (!response.ok) throw new Error(`拉取 models.dev 失败：HTTP ${response.status}`);
  const index = buildIndex((await response.json()) as Record<string, { models?: Record<string, ModelsDevEntry> }>);

  const resolved: Resolved[] = [];
  const missed: D1Model[] = [];
  const fallback: string[] = [];

  for (const model of ourModels) {
    // 先用对外模型名匹配，未命中再试上游模型名——两者通常相同，但个别模型对外做过改名。
    const keys = [model.id, model.upstreamModelId].filter((key): key is string => Boolean(key));
    const candidates = keys.flatMap((key) => index.get(key) ?? []);
    const picked = candidates.length > 0 ? pickCandidate(candidates) : null;
    if (!picked) {
      const manual = MANUAL_METADATA[model.id];
      if (manual) {
        resolved.push({ model, source: '人工录入', ...manual });
      } else {
        missed.push(model);
      }
      continue;
    }
    if (!FIRST_PARTY_PROVIDERS.includes(picked.providerId)) fallback.push(model.id);

    resolved.push({
      model,
      source: `${picked.providerId}/${picked.modelKey}`,
      displayName: picked.entry.name ?? null,
      contextLength: picked.entry.limit?.context ?? null,
      maxOutputTokens: picked.entry.limit?.output ?? null,
      metadata: toMetadata(picked.entry),
    });
  }

  console.log(`模型总数 ${ourModels.length}，命中 ${resolved.length}，未命中 ${missed.length}`);
  if (fallback.length > 0) {
    console.warn(`\n⚠️  以下模型只匹配到转售商条目，元数据需人工复核：\n  ${fallback.join('\n  ')}`);
  }
  if (missed.length > 0) {
    console.warn(`\n⚠️  以下模型在 models.dev 上没有同名条目，需人工补元数据：`);
    for (const model of missed) console.warn(`  ${model.id}  (provider: ${model.provider})`);
  }

  if (isDryRun) {
    console.log('\n--dry-run：未写入任何文件');
    return;
  }

  const target = nextMigrationPath();
  fs.writeFileSync(target, buildMigration(resolved), 'utf8');
  console.log(`\n已写入 ${path.relative(repoRoot, target)}（${resolved.length} 条 UPDATE）`);
  console.log('请 review 后执行：pnpm --filter @muirouter/shared-db db:migrate:local');
}

await main();
