import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(packageRoot, '..', '..');

export const sharedCloudflareStatePath = path.join(repoRoot, '.wrangler', 'state');
export const sharedCloudflareStateV3Path = path.join(sharedCloudflareStatePath, 'v3');
