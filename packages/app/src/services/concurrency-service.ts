import type { CloudflareBindings } from '../types';

export const DEFAULT_CONCURRENCY_LEASE_TTL_MS = 90_000;
export const DEFAULT_CONCURRENCY_REFRESH_INTERVAL_MS = 30_000;

interface AcquireLeasePayload {
  requestId: string;
  maxConcurrency: number;
  leaseTtlMs: number;
}

interface RefreshLeasePayload {
  leaseId: string;
  leaseTtlMs: number;
}

interface ReleaseLeasePayload {
  leaseId: string;
}

export interface AcquireLeaseResult {
  ok: boolean;
  leaseId?: string;
  activeCount: number;
  maxConcurrency: number;
}

export interface LeaseActionResult {
  ok: boolean;
  activeCount: number;
}

export class ConcurrencyService {
  constructor(private env: Pick<CloudflareBindings, 'CONCURRENCY_LIMITER'>) {}

  async acquire(userId: string, payload: AcquireLeasePayload): Promise<AcquireLeaseResult> {
    return this.request(userId, '/acquire', payload);
  }

  async refresh(userId: string, payload: RefreshLeasePayload): Promise<LeaseActionResult> {
    return this.request(userId, '/refresh', payload);
  }

  async release(userId: string, payload: ReleaseLeasePayload): Promise<LeaseActionResult> {
    return this.request(userId, '/release', payload);
  }

  private async request<TRequest, TResponse>(userId: string, path: string, payload: TRequest): Promise<TResponse> {
    const stub = this.getStub(userId);
    const url = new URL(`https://concurrency${path}`);
    for (const [key, value] of Object.entries(payload as Record<string, string | number | boolean | undefined>)) {
      if (value == null) {
        continue;
      }
      url.searchParams.set(key, String(value));
    }

    const response = await stub.fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`并发服务调用失败 (${response.status}): ${message}`);
    }

    return (await response.json()) as TResponse;
  }

  private getStub(userId: string): DurableObjectStub {
    const id = this.env.CONCURRENCY_LIMITER.idFromName(userId);
    return this.env.CONCURRENCY_LIMITER.get(id);
  }
}
