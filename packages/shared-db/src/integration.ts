export const INTEGRATION_VERSION = '1.0.0';
export const DEFAULT_CHAT_MODEL = 'deepseek-v4-flash';
export const API_BASE_URL = 'https://api.muirouter.com';
export const SITE_BASE_URL = 'https://muirouter.com';
export const CLI_CLIENT_ID = 'muirouter-cli';
export const CLI_REDIRECT_URI = 'http://127.0.0.1:18764/callback';

export const CONTROL_SCOPES = ['projects:read', 'projects:write', 'keys:write', 'configuration:write'] as const;
export type ControlScope = (typeof CONTROL_SCOPES)[number];
export type BillingMode = 'wallet' | 'meter_only';
export const MODEL_CAPABILITIES = ['chat', 'image', 'video', 'tts', 'stt'] as const;
export type ModelCapability = (typeof MODEL_CAPABILITIES)[number];
export type ModelDefaults = Partial<Record<ModelCapability, string>>;

export interface ExecutionPolicy {
  projectId: string;
  billingMode: BillingMode;
  defaults: ModelDefaults;
}

export interface IntegrationManifest {
  version: string;
  projectId: string;
  name: string;
  apiBaseUrl: string;
  models: ModelDefaults;
  capabilities: ModelCapability[];
}

export interface ApiKeyMetadata {
  keyPrefix: string;
  isActive: boolean;
  userId: string;
  createdAt?: string;
  label?: string;
  projectId?: string;
}

export function parseScopes(scope: string | null | undefined): string[] {
  return [...new Set((scope ?? '').split(/[\s,]+/).filter(Boolean))];
}

export function parseModelDefaults(raw: string | null | undefined): ModelDefaults {
  const parsed: unknown = JSON.parse(raw || '{}');
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('模型默认值必须是对象');
  const defaults: ModelDefaults = {};
  for (const capability of MODEL_CAPABILITIES) {
    const value = (parsed as Record<string, unknown>)[capability];
    if (typeof value === 'string' && value.trim()) defaults[capability] = value.trim();
  }
  return defaults;
}

export function resolveModelId(
  requested: unknown,
  capability: ModelCapability,
  project: ModelDefaults = {},
  global: ModelDefaults = {},
): string {
  if (requested !== undefined && requested !== null && typeof requested !== 'string') {
    throw new Error('model 必须是字符串');
  }
  const explicit = typeof requested === 'string' ? requested.trim() : '';
  if (explicit && explicit !== 'default') return explicit;
  const model = project[capability] || global[capability] || (capability === 'chat' ? DEFAULT_CHAT_MODEL : '');
  if (!model || model === 'default') throw new Error(`未配置 ${capability} 默认模型`);
  return model;
}
