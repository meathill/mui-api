interface CliOptions {
  accountId: string;
  apiToken: string;
  namespaceId: string;
  prefix: string;
  dryRun: boolean;
}

interface CloudflareEnvelope<T> {
  success: boolean;
  errors?: Array<{ code: number; message: string }>;
  result: T;
  result_info?: {
    cursor?: string;
  };
}

interface KVKeySummary {
  name: string;
  expiration?: number | null;
}

interface UserValue {
  balance: number;
  concurrency: number;
  isSuspended?: boolean;
}

interface ResetResult {
  scanned: number;
  updated: number;
  skipped: number;
}

class CloudflareKVClient {
  private accountId: string;
  private apiToken: string;
  private namespaceId: string;

  constructor(accountId: string, apiToken: string, namespaceId: string) {
    this.accountId = accountId;
    this.apiToken = apiToken;
    this.namespaceId = namespaceId;
  }

  async listKeys(prefix: string, cursor?: string): Promise<{ keys: KVKeySummary[]; cursor?: string }> {
    const url = this.createUrl('/keys');
    url.searchParams.set('prefix', prefix);
    if (cursor) {
      url.searchParams.set('cursor', cursor);
    }

    const response = await this.requestJson<KVKeySummary[]>(url, {
      method: 'GET',
    });

    return {
      keys: response.result,
      cursor: response.result_info?.cursor,
    };
  }

  async getUserValue(key: string): Promise<UserValue | null> {
    const url = this.createUrl(`/values/${encodeURIComponent(key)}`);
    const response = await fetch(url, {
      method: 'GET',
      headers: this.createHeaders(),
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`读取 KV value 失败 (${response.status}): ${await response.text()}`);
    }

    const text = await response.text();
    return JSON.parse(text) as UserValue;
  }

  async getMetadata(key: string): Promise<Record<string, unknown> | null> {
    const url = this.createUrl(`/metadata/${encodeURIComponent(key)}`);
    const response = await fetch(url, {
      method: 'GET',
      headers: this.createHeaders(),
    });

    if (response.status === 404) {
      return null;
    }

    const envelope = await this.readEnvelope<Record<string, unknown> | null>(response);
    return envelope.result;
  }

  async putUserValue(
    key: string,
    value: UserValue,
    metadata: Record<string, unknown>,
    expiration?: number | null,
  ): Promise<void> {
    const url = this.createUrl(`/values/${encodeURIComponent(key)}`);
    if (expiration != null) {
      url.searchParams.set('expiration', String(expiration));
    }

    const formData = new FormData();
    formData.set('value', new Blob([JSON.stringify(value)], { type: 'application/json' }), 'value.json');
    formData.set('metadata', JSON.stringify(metadata));

    const response = await fetch(url, {
      method: 'PUT',
      headers: this.createHeaders(),
      body: formData,
    });

    await this.readEnvelope(response);
  }

  private createUrl(path: string): URL {
    return new URL(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/storage/kv/namespaces/${this.namespaceId}${path}`,
    );
  }

  private createHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${this.apiToken}`,
    };
  }

  private async requestJson<T>(url: URL, init: RequestInit): Promise<CloudflareEnvelope<T>> {
    const response = await fetch(url, {
      ...init,
      headers: this.createHeaders(),
    });

    return this.readEnvelope<T>(response);
  }

  private async readEnvelope<T>(response: Response): Promise<CloudflareEnvelope<T>> {
    const text = await response.text();
    let payload: CloudflareEnvelope<T>;

    try {
      payload = JSON.parse(text) as CloudflareEnvelope<T>;
    } catch {
      throw new Error(`Cloudflare API 返回了非 JSON 响应 (${response.status}): ${text}`);
    }

    if (!response.ok || !payload.success) {
      const message = payload.errors?.map((error) => `${error.code}: ${error.message}`).join('; ') || text;
      throw new Error(`Cloudflare API 请求失败 (${response.status}): ${message}`);
    }

    return payload;
  }
}

function parseArgs(argv: string[]): CliOptions {
  const args = new Map<string, string>();
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      continue;
    }
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (!arg.startsWith('--')) {
      throw new Error(`不支持的参数: ${arg}`);
    }

    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      throw new Error(`参数缺少值: ${arg}`);
    }

    args.set(arg.slice(2), next);
    index += 1;
  }

  return {
    accountId: getRequiredValue(args.get('account-id'), 'CF_ACCOUNT_ID', '--account-id'),
    apiToken: getRequiredValue(args.get('api-token'), 'CF_API_TOKEN', '--api-token'),
    namespaceId: getRequiredValue(args.get('namespace-id'), 'KV_NAMESPACE_ID', '--namespace-id'),
    prefix: args.get('prefix') ?? 'user:',
    dryRun,
  };
}

function getRequiredValue(value: string | undefined, envName: string, flagName: string): string {
  const resolved = value ?? process.env[envName];
  if (!resolved) {
    throw new Error(`缺少 ${flagName}，也没有设置环境变量 ${envName}`);
  }
  return resolved;
}

async function resetConcurrencyMirror(options: CliOptions): Promise<ResetResult> {
  const client = new CloudflareKVClient(options.accountId, options.apiToken, options.namespaceId);
  let cursor: string | undefined;
  let scanned = 0;
  let updated = 0;
  let skipped = 0;

  do {
    const page = await client.listKeys(options.prefix, cursor);
    cursor = page.cursor;

    for (const key of page.keys) {
      scanned += 1;

      const value = await client.getUserValue(key.name);
      if (!value) {
        skipped += 1;
        continue;
      }

      if (typeof value.concurrency !== 'number') {
        console.warn(`跳过 ${key.name}: value 中缺少 concurrency`);
        skipped += 1;
        continue;
      }

      if (value.concurrency === 0) {
        skipped += 1;
        continue;
      }

      const metadata = await client.getMetadata(key.name);
      if (!metadata) {
        console.warn(`跳过 ${key.name}: metadata 缺失，为避免覆盖用户资料未执行写回`);
        skipped += 1;
        continue;
      }

      const nextValue: UserValue = {
        ...value,
        concurrency: 0,
      };

      if (options.dryRun) {
        console.log(`[dry-run] ${key.name}: ${value.concurrency} -> 0`);
        updated += 1;
        continue;
      }

      await client.putUserValue(key.name, nextValue, metadata, key.expiration);
      console.log(`已重置 ${key.name}: ${value.concurrency} -> 0`);
      updated += 1;
    }
  } while (cursor);

  return { scanned, updated, skipped };
}

function printUsage(): void {
  console.log('用法:');
  console.log(
    '  CF_ACCOUNT_ID=xxx CF_API_TOKEN=xxx KV_NAMESPACE_ID=xxx node scripts/reset-concurrency-mirror.ts [--prefix user:] [--dry-run]',
  );
  console.log();
  console.log('也可通过命令行显式传参:');
  console.log(
    '  node scripts/reset-concurrency-mirror.ts --account-id xxx --api-token xxx --namespace-id xxx [--prefix user:] [--dry-run]',
  );
}

async function main(): Promise<void> {
  try {
    if (process.argv.includes('--help')) {
      printUsage();
      return;
    }

    const options = parseArgs(process.argv.slice(2));
    const result = await resetConcurrencyMirror(options);
    console.log();
    console.log(`完成。扫描 ${result.scanned} 个 key，更新 ${result.updated} 个，跳过 ${result.skipped} 个。`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    console.log();
    printUsage();
    process.exitCode = 1;
  }
}

void main();
