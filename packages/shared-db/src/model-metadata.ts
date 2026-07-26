// 模型元数据：models 表 metadata_json 列的结构定义与校验。
//
// 为什么用 JSON blob 而不是逐列建模：这份元数据的字段集合由 models.dev 的 model schema
// 决定，而那个 schema 还在演进（reasoning_options / interleaved / experimental 都是近期
// 才加的）。逐列等于把外部 schema 焊进我们的 migration，上游每加一个字段就要一次迁移。
// blob 存原样，schema 变了只改这一个文件。
//
// 为什么不用 zod：shared-db 被 Worker(packages/app) 和 Next.js(packages/dashboard) 同时
// 消费，目前只依赖 drizzle-orm。dashboard 没有 zod，app 有 zod v4——与其为一个 11 字段的
// 对象给两个包各写一遍校验、或给 shared-db 引一个新依赖，不如在这里写一份零依赖实现，
// app 侧用 zod 的 superRefine 包一层复用它。
//
// 注意：context_length / max_output_tokens 不在这里——它们是 models 表的独立列。
// 那两个字段要出现在 GET /v1/models 响应里、要能被 SQL 排序筛选，属于高频字段。

/** models.dev 的输入模态取值。 */
export const MODALITY_INPUTS = ['text', 'image', 'audio', 'video', 'pdf'] as const;
export type ModalityInput = (typeof MODALITY_INPUTS)[number];

/**
 * models.dev 的输出模态取值。与 input 同集合——按 api.json 实测，output 里确实出现过
 * pdf（2 例，多半是上游录入笔误，但 schema 允许），收窄会让回填脚本无谓地炸掉。
 */
export const MODALITY_OUTPUTS = ['text', 'image', 'audio', 'video', 'pdf'] as const;
export type ModalityOutput = (typeof MODALITY_OUTPUTS)[number];

export interface ModelModalities {
  input: ModalityInput[];
  output: ModalityOutput[];
}

export interface ModelMetadata {
  /** 一句话描述，models.dev 必填。 */
  description?: string;
  /** 模型系列，如 'claude-opus' / 'gemini-flash'，用于分组展示。 */
  family?: string;
  /** 是否接受附件（图片 / PDF 等非文本输入）。 */
  attachment: boolean;
  /** 是否为推理模型。 */
  reasoning: boolean;
  /** 是否支持 function calling。 */
  toolCall: boolean;
  /** 是否接受 temperature 参数（部分推理模型不接受）。 */
  temperature?: boolean;
  /** 是否支持 structured output / JSON schema。 */
  structuredOutput?: boolean;
  /** 是否开放权重。 */
  openWeights: boolean;
  /** 知识截止，YYYY-MM 或 YYYY-MM-DD。 */
  knowledge?: string;
  /** 发布日期，YYYY-MM 或 YYYY-MM-DD。models.dev 必填。 */
  releaseDate?: string;
  /** 最后更新日期，YYYY-MM 或 YYYY-MM-DD。models.dev 必填。 */
  lastUpdated?: string;
  /** 输入 / 输出模态。models.dev 必填。 */
  modalities?: ModelModalities;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const DATE_PATTERN = /^\d{4}-\d{2}(-\d{2})?$/;

const BOOLEAN_KEYS_REQUIRED = ['attachment', 'reasoning', 'toolCall', 'openWeights'] as const;
const BOOLEAN_KEYS_OPTIONAL = ['temperature', 'structuredOutput'] as const;
const STRING_KEYS_OPTIONAL = ['description', 'family'] as const;
const DATE_KEYS_OPTIONAL = ['knowledge', 'releaseDate', 'lastUpdated'] as const;

const KNOWN_KEYS = new Set<string>([
  ...BOOLEAN_KEYS_REQUIRED,
  ...BOOLEAN_KEYS_OPTIONAL,
  ...STRING_KEYS_OPTIONAL,
  ...DATE_KEYS_OPTIONAL,
  'modalities',
]);

/** 空元数据：布尔位全 false，其余缺省。用于建对象时打底。 */
export function emptyModelMetadata(): ModelMetadata {
  return { attachment: false, reasoning: false, toolCall: false, openWeights: false };
}

/**
 * 校验一个已解析的对象是否为合法 ModelMetadata。
 * 未知字段一律报错——与 models.dev 的 .strict() 对齐，能在录入阶段就抓出拼写错误，
 * 而不是等到生成 TOML 提 PR 时被上游 CI 打回。
 */
export function validateModelMetadata(input: unknown): ParseResult<ModelMetadata> {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: '元数据必须是 JSON 对象' };
  }
  const raw = input as Record<string, unknown>;

  for (const key of Object.keys(raw)) {
    if (!KNOWN_KEYS.has(key)) {
      return { ok: false, error: `未知字段 ${key}` };
    }
  }

  const result = emptyModelMetadata();

  for (const key of BOOLEAN_KEYS_REQUIRED) {
    const value = raw[key];
    if (value === undefined) continue;
    if (typeof value !== 'boolean') return { ok: false, error: `${key} 必须是布尔值` };
    result[key] = value;
  }

  for (const key of BOOLEAN_KEYS_OPTIONAL) {
    const value = raw[key];
    if (value === undefined) continue;
    if (typeof value !== 'boolean') return { ok: false, error: `${key} 必须是布尔值` };
    result[key] = value;
  }

  for (const key of STRING_KEYS_OPTIONAL) {
    const value = raw[key];
    if (value === undefined) continue;
    if (typeof value !== 'string' || value.trim() === '') {
      return { ok: false, error: `${key} 必须是非空字符串` };
    }
    result[key] = value;
  }

  for (const key of DATE_KEYS_OPTIONAL) {
    const value = raw[key];
    if (value === undefined) continue;
    if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
      return { ok: false, error: `${key} 必须形如 YYYY-MM 或 YYYY-MM-DD` };
    }
    result[key] = value;
  }

  if (raw.modalities !== undefined) {
    const modalities = parseModalities(raw.modalities);
    if (!modalities.ok) return modalities;
    result.modalities = modalities.value;
  }

  return { ok: true, value: result };
}

function parseModalities(input: unknown): ParseResult<ModelModalities> {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'modalities 必须是对象' };
  }
  const raw = input as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    if (key !== 'input' && key !== 'output') {
      return { ok: false, error: `modalities 不支持字段 ${key}` };
    }
  }

  const input_ = parseModalityList(raw.input, MODALITY_INPUTS, 'modalities.input');
  if (!input_.ok) return input_;
  const output = parseModalityList(raw.output, MODALITY_OUTPUTS, 'modalities.output');
  if (!output.ok) return output;

  return { ok: true, value: { input: input_.value as ModalityInput[], output: output.value as ModalityOutput[] } };
}

function parseModalityList(value: unknown, allowed: readonly string[], label: string): ParseResult<string[]> {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, error: `${label} 必须是非空数组` };
  }
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string' || !allowed.includes(item)) {
      return { ok: false, error: `${label} 含非法取值 ${JSON.stringify(item)}，可选：${allowed.join(' / ')}` };
    }
    if (seen.has(item)) return { ok: false, error: `${label} 含重复取值 ${item}` };
    seen.add(item);
  }
  return { ok: true, value: value as string[] };
}

/** 解析 metadata_json 列。null / 空串视为「未录入」，返回 null 而非报错。 */
export function parseModelMetadata(raw: string | null | undefined): ParseResult<ModelMetadata | null> {
  if (raw === null || raw === undefined || raw.trim() === '') return { ok: true, value: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: '元数据不是合法 JSON' };
  }
  return validateModelMetadata(parsed);
}

/** 序列化回 metadata_json 列。字段顺序固定，便于 diff。 */
export function serializeModelMetadata(metadata: ModelMetadata): string {
  const ordered: Record<string, unknown> = {};
  for (const key of [
    'description',
    'family',
    'attachment',
    'reasoning',
    'toolCall',
    'temperature',
    'structuredOutput',
    'openWeights',
    'knowledge',
    'releaseDate',
    'lastUpdated',
    'modalities',
  ] as const) {
    const value = metadata[key];
    if (value !== undefined) ordered[key] = value;
  }
  return JSON.stringify(ordered);
}
