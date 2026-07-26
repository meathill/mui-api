/**
 * 脚本共用：从 D1 读模型清单。
 *
 * 为什么不 import seed.ts：一来 D1 才是权威来源（seed 可能落后于线上），二来
 * seed.ts 经由 shared-db 的 extensionless 相对 import 链，裸 node 解析不了。
 * 这里跟 packages/shared-db/scripts/db-migrate.ts 一样 spawn wrangler。
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface D1Model {
  id: string;
  provider: string;
  upstreamModelId: string | null;
  displayName: string | null;
  contextLength: number | null;
  maxOutputTokens: number | null;
  metadataJson: string | null;
  inputPrice: number | null;
  outputPrice: number | null;
  markupRate: number | null;
  cachedInputPrice: number | null;
  cacheWritePrice: number | null;
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const appRoot = path.resolve(scriptDir, '..', '..');
export const repoRoot = path.resolve(appRoot, '..', '..');

/**
 * 两套投影。'basic' 只取 0023 之前就存在的列——回填脚本按定义要在元数据列
 * 还没建起来的库上跑（生产迁移是人工分步执行的），拿全投影会直接 SQLITE_ERROR。
 */
const COLUMN_SETS = {
  basic: 'id, provider, upstream_model_id',
  full: 'id, provider, upstream_model_id, display_name, context_length, max_output_tokens, metadata_json, input_price, output_price, markup_rate, cached_input_price, cache_write_price',
} as const;

export type ColumnSet = keyof typeof COLUMN_SETS;

interface RawRow {
  id: string;
  provider: string;
  upstream_model_id: string | null;
  display_name?: string | null;
  context_length?: number | null;
  max_output_tokens?: number | null;
  metadata_json?: string | null;
  input_price?: number | null;
  output_price?: number | null;
  markup_rate?: number | null;
  cached_input_price?: number | null;
  cache_write_price?: number | null;
}

export function loadModelsFromD1(useRemote: boolean, columnSet: ColumnSet = 'full'): D1Model[] {
  const sharedDbRoot = path.join(repoRoot, 'packages', 'shared-db');
  const columns = COLUMN_SETS[columnSet];
  const args = ['wrangler', 'd1', 'execute', 'DB', '--json', '--command', `SELECT ${columns} FROM models ORDER BY id`];
  args.push(useRemote ? '--remote' : '--local');
  if (!useRemote) args.push('--persist-to', path.join(repoRoot, '.wrangler', 'state'));

  const proc = spawnSync('npx', args, { cwd: sharedDbRoot, encoding: 'utf8' });
  if (proc.status !== 0) throw new Error(`查询 D1 失败：${proc.stderr || proc.stdout}`);

  // wrangler 会在 JSON 前后混入横幅文本，取第一个 '[' 到最后一个 ']'。
  const start = proc.stdout.indexOf('[');
  const end = proc.stdout.lastIndexOf(']');
  if (start < 0 || end < 0) throw new Error(`无法从 wrangler 输出中解析 JSON：${proc.stdout.slice(0, 400)}`);

  const parsed = JSON.parse(proc.stdout.slice(start, end + 1)) as Array<{ results?: RawRow[] }>;
  const rows = parsed[0]?.results ?? [];
  if (rows.length === 0) {
    throw new Error('models 表为空——本地 D1 可能没跑 seed，或换用 --remote');
  }

  return rows.map((row) => ({
    id: row.id,
    provider: row.provider,
    upstreamModelId: row.upstream_model_id,
    displayName: row.display_name ?? null,
    contextLength: row.context_length ?? null,
    maxOutputTokens: row.max_output_tokens ?? null,
    metadataJson: row.metadata_json ?? null,
    inputPrice: row.input_price ?? null,
    outputPrice: row.output_price ?? null,
    markupRate: row.markup_rate ?? null,
    cachedInputPrice: row.cached_input_price ?? null,
    cacheWritePrice: row.cache_write_price ?? null,
  }));
}
