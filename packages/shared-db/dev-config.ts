import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(packageRoot, '..', '..');
const configuredCloudflareStatePath = process.env.MUI_API_STATE_PATH;

export const sharedCloudflareStatePath = configuredCloudflareStatePath
  ? path.resolve(repoRoot, configuredCloudflareStatePath)
  : path.join(repoRoot, '.wrangler', 'state');
export const sharedCloudflareStateV3Path = path.join(sharedCloudflareStatePath, 'v3');
