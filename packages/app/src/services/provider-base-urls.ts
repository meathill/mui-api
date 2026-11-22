import type { CloudflareBindings } from '../types';

const MOONSHOT_DEFAULT_BASE_URL = 'https://api.moonshot.ai/v1';
const XIAOMI_MIMO_DEFAULT_BASE_URL = 'https://api.xiaomimimo.com/v1';
const DEEPSEEK_DEFAULT_BASE_URL = 'https://api.deepseek.com';
const OPENCODE_GO_DEFAULT_BASE_URL = 'https://opencode.ai/zen/go/v1';

export function aiGatewayBase(env: CloudflareBindings, provider: string): string {
  return `https://gateway.ai.cloudflare.com/v1/${env.CF_ACCOUNT_ID}/${env.CF_GATEWAY_ID}/${provider}`;
}

export function openAIGatewayBase(env: CloudflareBindings): string {
  return aiGatewayBase(env, 'openai');
}

export function openAIDirectBaseURL(env: CloudflareBindings): string {
  return trimTrailingSlashes(env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1');
}

export function anthropicGatewayBase(env: CloudflareBindings): string {
  return aiGatewayBase(env, 'anthropic');
}

export function compatGatewayBase(env: CloudflareBindings): string {
  return aiGatewayBase(env, 'compat');
}

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

export function xiaomiMiMoBaseURL(env: CloudflareBindings): string {
  return trimTrailingSlashes(env.MIMO_BASE_URL ?? XIAOMI_MIMO_DEFAULT_BASE_URL);
}

export function moonshotBaseURL(env: CloudflareBindings): string {
  return trimTrailingSlashes(env.MOONSHOT_BASE_URL ?? MOONSHOT_DEFAULT_BASE_URL);
}

export function deepseekBaseURL(env: CloudflareBindings): string {
  return trimTrailingSlashes(env.DEEPSEEK_BASE_URL ?? DEEPSEEK_DEFAULT_BASE_URL);
}

export function openCodeGoBaseURL(env: CloudflareBindings): string {
  return trimTrailingSlashes(env.OPENCODE_GO_BASE_URL ?? OPENCODE_GO_DEFAULT_BASE_URL);
}
