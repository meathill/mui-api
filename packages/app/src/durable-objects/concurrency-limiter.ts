import type { CloudflareBindings } from '../types';

const LEASE_PREFIX = 'lease:';
const REQUEST_PREFIX = 'request:';
const USER_ID_KEY = 'meta:userId';

interface LeaseRecord {
  leaseId: string;
  requestId: string;
  expiresAt: number;
  startedAt: number;
}

interface AcquireLeaseRequest {
  requestId: string;
  maxConcurrency: number;
  leaseTtlMs: number;
}

interface RefreshLeaseRequest {
  leaseId: string;
  leaseTtlMs: number;
}

interface ReleaseLeaseRequest {
  leaseId: string;
}

interface AcquireLeaseResponse {
  ok: boolean;
  leaseId?: string;
  activeCount: number;
  maxConcurrency: number;
}

interface LeaseActionResponse {
  ok: boolean;
  activeCount: number;
}

function createLeaseKey(leaseId: string): string {
  return `${LEASE_PREFIX}${leaseId}`;
}

function createRequestKey(requestId: string): string {
  return `${REQUEST_PREFIX}${requestId}`;
}

export class ConcurrencyLimiterDO {
  constructor(
    private ctx: DurableObjectState,
    private env: CloudflareBindings,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method !== 'POST') {
      return Response.json({ error: 'method_not_allowed' }, { status: 405 });
    }

    const userId = await this.resolveUserId(request);

    switch (url.pathname) {
      case '/acquire':
        return this.handleAcquire(userId, request);
      case '/refresh':
        return this.handleRefresh(userId, request);
      case '/release':
        return this.handleRelease(userId, request);
      default:
        return Response.json({ error: 'not_found' }, { status: 404 });
    }
  }

  async alarm(): Promise<void> {
    const { activeLeases, didCleanup } = await this.cleanupExpiredLeases();
    if (didCleanup) {
      const userId = await this.ctx.storage.get<string>(USER_ID_KEY);
      if (userId) {
        await this.syncConcurrencyMirror(userId, activeLeases.length);
      }
    }
    await this.scheduleNextAlarm(activeLeases);
  }

  private async handleAcquire(userId: string, request: Request): Promise<Response> {
    const body = await this.readAcquireLeaseRequest(request);
    const { activeLeases, didCleanup } = await this.cleanupExpiredLeases();
    const requestKey = createRequestKey(body.requestId);
    const existingLeaseId = await this.ctx.storage.get<string>(requestKey);

    if (existingLeaseId) {
      const existingLease = await this.ctx.storage.get<LeaseRecord>(createLeaseKey(existingLeaseId));
      if (existingLease) {
        await this.scheduleNextAlarm(activeLeases);
        if (didCleanup) {
          await this.syncConcurrencyMirror(userId, activeLeases.length);
        }
        return Response.json({
          ok: true,
          leaseId: existingLease.leaseId,
          activeCount: activeLeases.length,
          maxConcurrency: body.maxConcurrency,
        } satisfies AcquireLeaseResponse);
      }
      await this.ctx.storage.delete(requestKey);
    }

    if (activeLeases.length >= body.maxConcurrency) {
      if (didCleanup) {
        await this.syncConcurrencyMirror(userId, activeLeases.length);
      }
      await this.scheduleNextAlarm(activeLeases);
      return Response.json({
        ok: false,
        activeCount: activeLeases.length,
        maxConcurrency: body.maxConcurrency,
      } satisfies AcquireLeaseResponse);
    }

    const now = Date.now();
    const leaseId = crypto.randomUUID();
    const lease: LeaseRecord = {
      leaseId,
      requestId: body.requestId,
      expiresAt: now + body.leaseTtlMs,
      startedAt: now,
    };
    const nextActiveLeases = [...activeLeases, lease];

    await this.ctx.storage.put({
      [createLeaseKey(leaseId)]: lease,
      [requestKey]: leaseId,
    });

    await this.syncConcurrencyMirror(userId, nextActiveLeases.length);
    await this.scheduleNextAlarm(nextActiveLeases);

    return Response.json({
      ok: true,
      leaseId,
      activeCount: nextActiveLeases.length,
      maxConcurrency: body.maxConcurrency,
    } satisfies AcquireLeaseResponse);
  }

  private async handleRefresh(userId: string, request: Request): Promise<Response> {
    const body = await this.readRefreshLeaseRequest(request);
    const { activeLeases, didCleanup } = await this.cleanupExpiredLeases();
    const leaseKey = createLeaseKey(body.leaseId);
    const lease = await this.ctx.storage.get<LeaseRecord>(leaseKey);

    if (!lease) {
      if (didCleanup) {
        await this.syncConcurrencyMirror(userId, activeLeases.length);
      }
      await this.scheduleNextAlarm(activeLeases);
      return Response.json({ ok: false, activeCount: activeLeases.length } satisfies LeaseActionResponse);
    }

    const refreshedLease: LeaseRecord = {
      ...lease,
      expiresAt: Date.now() + body.leaseTtlMs,
    };
    const refreshedLeases = activeLeases.map((item) =>
      item.leaseId === refreshedLease.leaseId ? refreshedLease : item,
    );

    await this.ctx.storage.put(leaseKey, refreshedLease);
    if (didCleanup) {
      await this.syncConcurrencyMirror(userId, refreshedLeases.length);
    }
    await this.scheduleNextAlarm(refreshedLeases);

    return Response.json({ ok: true, activeCount: refreshedLeases.length } satisfies LeaseActionResponse);
  }

  private async handleRelease(userId: string, request: Request): Promise<Response> {
    const body = await this.readReleaseLeaseRequest(request);
    const { activeLeases, didCleanup } = await this.cleanupExpiredLeases();
    const leaseKey = createLeaseKey(body.leaseId);
    const lease = await this.ctx.storage.get<LeaseRecord>(leaseKey);

    if (!lease) {
      if (didCleanup) {
        await this.syncConcurrencyMirror(userId, activeLeases.length);
      }
      await this.scheduleNextAlarm(activeLeases);
      return Response.json({ ok: true, activeCount: activeLeases.length } satisfies LeaseActionResponse);
    }

    await this.ctx.storage.delete([leaseKey, createRequestKey(lease.requestId)]);
    const remainingLeases = activeLeases.filter((item) => item.leaseId !== lease.leaseId);

    await this.syncConcurrencyMirror(userId, remainingLeases.length);
    await this.scheduleNextAlarm(remainingLeases);

    return Response.json({ ok: true, activeCount: remainingLeases.length } satisfies LeaseActionResponse);
  }

  private async resolveUserId(request: Request): Promise<string> {
    const requestUserId = request.headers.get('x-user-id');
    const storedUserId = await this.ctx.storage.get<string>(USER_ID_KEY);

    if (requestUserId) {
      if (storedUserId && storedUserId !== requestUserId) {
        throw new Error('Durable Object userId 不匹配');
      }
      if (!storedUserId) {
        await this.ctx.storage.put(USER_ID_KEY, requestUserId);
      }
      return requestUserId;
    }

    if (!storedUserId) {
      throw new Error('Durable Object 缺少 userId');
    }

    return storedUserId;
  }

  private async readAcquireLeaseRequest(request: Request): Promise<AcquireLeaseRequest> {
    const url = new URL(request.url);
    if (url.searchParams.size > 0) {
      return {
        requestId: url.searchParams.get('requestId') ?? '',
        maxConcurrency: Number(url.searchParams.get('maxConcurrency') ?? '0'),
        leaseTtlMs: Number(url.searchParams.get('leaseTtlMs') ?? '0'),
      };
    }
    return (await request.json()) as AcquireLeaseRequest;
  }

  private async readRefreshLeaseRequest(request: Request): Promise<RefreshLeaseRequest> {
    const url = new URL(request.url);
    if (url.searchParams.size > 0) {
      return {
        leaseId: url.searchParams.get('leaseId') ?? '',
        leaseTtlMs: Number(url.searchParams.get('leaseTtlMs') ?? '0'),
      };
    }
    return (await request.json()) as RefreshLeaseRequest;
  }

  private async readReleaseLeaseRequest(request: Request): Promise<ReleaseLeaseRequest> {
    const url = new URL(request.url);
    if (url.searchParams.size > 0) {
      return {
        leaseId: url.searchParams.get('leaseId') ?? '',
      };
    }
    return (await request.json()) as ReleaseLeaseRequest;
  }

  private async cleanupExpiredLeases(now: number = Date.now()): Promise<{
    activeLeases: LeaseRecord[];
    didCleanup: boolean;
  }> {
    const leaseEntries = await this.ctx.storage.list<LeaseRecord>({ prefix: LEASE_PREFIX });
    const expiredKeys: string[] = [];
    const activeLeases: LeaseRecord[] = [];

    for (const [key, lease] of leaseEntries.entries()) {
      if (lease.expiresAt <= now) {
        expiredKeys.push(key, createRequestKey(lease.requestId));
      } else {
        activeLeases.push(lease);
      }
    }

    if (expiredKeys.length > 0) {
      await this.ctx.storage.delete(expiredKeys);
    }

    return { activeLeases, didCleanup: expiredKeys.length > 0 };
  }

  private async scheduleNextAlarm(activeLeases: LeaseRecord[]): Promise<void> {
    if (activeLeases.length === 0) {
      await this.ctx.storage.deleteAlarm();
      return;
    }

    const nextExpiresAt = Math.min(...activeLeases.map((lease) => lease.expiresAt));
    await this.ctx.storage.setAlarm(nextExpiresAt);
  }

  /**
   * 并发数展示镜像经 WalletDO /set-concurrency 同步：`user:{userId}` KV 记录的唯一写者是
   * WalletDO，这里绝不能直接读-改-写 KV——旁路整条覆盖会把并发期间已变化的 balance
   * 用旧值写回（2026-07-21 充值"未到账"事故的根因）。
   * 并发数是纯展示字段（准入判断靠本 DO 的 lease 计数），同步失败不影响主流程。
   */
  private async syncConcurrencyMirror(userId: string, activeCount: number): Promise<void> {
    try {
      const stub = this.env.WALLET.get(this.env.WALLET.idFromName(userId));
      await stub.fetch('https://wallet/set-concurrency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ concurrency: activeCount }),
      });
    } catch (error) {
      console.warn(`同步并发数镜像失败 (userId=${userId}):`, error);
    }
  }
}
