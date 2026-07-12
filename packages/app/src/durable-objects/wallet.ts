import type { CloudflareBindings, KVUserData, KVUserMetadata } from '../types';

const USER_ID_KEY = 'meta:userId';
const DATA_KEY = 'data';
const METADATA_KEY = 'metadata';
const RESERVATION_PREFIX = 'reservation:';

interface CreateRequest {
  email: string;
  initialBalance?: number;
}

interface AmountRequest {
  amount: number;
}

interface ReservationRequest {
  reservationId: string;
  amount?: number;
  expiresAt?: number;
}

export interface WalletReservation {
  reservationId: string;
  amount: number;
  status: 'reserved' | 'settled' | 'released';
  expiresAt: number;
  settledAmount?: number;
}

type SetMetadataRequest = Pick<KVUserMetadata, 'maxConcurrency' | 'rateMultiplier' | 'stripeCustomerId'>;

interface WalletResponse {
  ok: boolean;
  error?: string;
  data?: KVUserData;
  metadata?: KVUserMetadata;
  reservation?: WalletReservation;
}

const notFound: WalletResponse = { ok: false, error: 'user_not_found' };

/**
 * 按 userId 分区，是 `user:{userId}` 这条 KV 记录（余额/免费额度/暂停状态/metadata）的唯一写者，
 * 替代原来 KVService 里对同一条记录的读-改-写（并发请求下会丢更新）。
 * KV 继续作为只读展示镜像，供 dashboard、/v1/balance、auth 预检读取。
 *
 * 并发正确性：D1/DO 文档明确指出——「storage 操作」之间才有自动的 input/output gate 互斥，
 * 一旦某个请求在两次 storage 操作之间 await 了外部 I/O（KV/fetch/R2），其它并发请求就可能
 * 插进来读到同一份旧值、最后写者覆盖前面所有写者。实测验证过：仅在首次 bootstrap 处加锁不够，
 * 稳态的读-改-写也会丢更新。所以这里把「读 storage → 改 → 写 storage」整体包进
 * blockConcurrencyWhile，且这段本身不触碰任何外部 I/O（KV 镜像同步放到锁外，失败也不影响
 * storage 里的权威账本）。
 *
 * 自愈式迁移：实例首次收到请求时若自身还没有数据，从当前 KV 镜像 adopt 一次再继续——
 * 不需要一次性 batch 迁移脚本。
 */
export class WalletDO {
  constructor(
    private ctx: DurableObjectState,
    private env: CloudflareBindings,
  ) {}

  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return Response.json({ error: 'method_not_allowed' }, { status: 405 });
    }

    const userId = await this.resolveUserId(request);
    await this.ensureBootstrapped(userId);
    const url = new URL(request.url);

    switch (url.pathname) {
      case '/create':
        return this.handleCreate(userId, request);
      case '/deduct':
        return this.handleDeduct(userId, request);
      case '/add':
        return this.handleAdd(userId, request);
      case '/consume-free-quota':
        return this.handleConsumeFreeQuota(userId, request);
      case '/reserve':
        return this.handleReserve(request);
      case '/refresh-reservation':
        return this.handleRefreshReservation(request);
      case '/settle-reservation':
        return this.handleSettleReservation(userId, request);
      case '/release-reservation':
        return this.handleReleaseReservation(request);
      case '/suspend':
        return this.handleSetSuspended(userId, true);
      case '/unsuspend':
        return this.handleSetSuspended(userId, false);
      case '/set-metadata':
        return this.handleSetMetadata(userId, request);
      default:
        return Response.json({ error: 'not_found' }, { status: 404 });
    }
  }

  /**
   * 幂等：已存在则直接返回当前状态，不重置余额（懒初始化重复调用是预期行为）。
   */
  private async handleCreate(userId: string, request: Request): Promise<Response> {
    const body = (await request.json()) as CreateRequest;
    const result = await this.mutate(userId, (data, metadata, isNew) => {
      if (!isNew) {
        return; // 已存在：原样返回，不重置余额
      }
      Object.assign(data, { balance: body.initialBalance ?? 0, concurrency: 0 } satisfies KVUserData);
      Object.assign(metadata, { email: body.email, createdAt: new Date().toISOString() } satisfies KVUserMetadata);
    });
    return Response.json({ ok: true, ...result } satisfies WalletResponse);
  }

  private async handleDeduct(userId: string, request: Request): Promise<Response> {
    const { amount } = (await request.json()) as AmountRequest;
    const result = await this.mutateExisting(userId, (data) => {
      data.balance = Math.max(0, data.balance - amount);
    });
    if (!result) {
      return Response.json(notFound, { status: 404 });
    }
    return Response.json({ ok: true, ...result } satisfies WalletResponse);
  }

  private async handleAdd(userId: string, request: Request): Promise<Response> {
    const { amount } = (await request.json()) as AmountRequest;
    const result = await this.mutateExisting(userId, (data) => {
      data.balance += amount;
    });
    if (!result) {
      return Response.json(notFound, { status: 404 });
    }
    return Response.json({ ok: true, ...result } satisfies WalletResponse);
  }

  private async handleConsumeFreeQuota(userId: string, request: Request): Promise<Response> {
    const { amount } = (await request.json()) as AmountRequest;
    const result = await this.mutateExisting(userId, (data) => {
      if (amount > 0) {
        data.freeQuotaUsed = Math.max(0, (data.freeQuotaUsed ?? 0) + amount);
      }
    });
    if (!result) {
      return Response.json(notFound, { status: 404 });
    }
    return Response.json({ ok: true, ...result } satisfies WalletResponse);
  }

  private async handleReserve(request: Request): Promise<Response> {
    const { reservationId, amount, expiresAt } = (await request.json()) as ReservationRequest;
    if (!reservationId || !Number.isFinite(amount) || !Number.isFinite(expiresAt) || amount! <= 0) {
      return Response.json({ ok: false, error: 'invalid_reservation' } satisfies WalletResponse, { status: 400 });
    }

    const result = await this.ctx.blockConcurrencyWhile(async () => {
      const key = `${RESERVATION_PREFIX}${reservationId}`;
      const existing = await this.ctx.storage.get<WalletReservation>(key);
      if (existing) return { reservation: existing };

      const data = await this.ctx.storage.get<KVUserData>(DATA_KEY);
      if (!data) return { error: 'user_not_found' as const };

      const now = Date.now();
      const reservations = await this.ctx.storage.list<WalletReservation>({ prefix: RESERVATION_PREFIX });
      let activeTotal = 0;
      const expiredKeys: string[] = [];
      for (const [reservationKey, reservation] of reservations) {
        if (reservation.expiresAt <= now) {
          expiredKeys.push(reservationKey);
        } else if (reservation.status === 'reserved') {
          activeTotal += reservation.amount;
        }
      }
      if (expiredKeys.length > 0) await this.ctx.storage.delete(expiredKeys);

      if (data.balance - activeTotal + Number.EPSILON < amount!) {
        return { error: 'insufficient_balance' as const };
      }

      const reservation: WalletReservation = {
        reservationId,
        amount: amount!,
        expiresAt: expiresAt!,
        status: 'reserved',
      };
      await this.ctx.storage.put(key, reservation);
      return { reservation };
    });

    if ('error' in result) {
      return Response.json({ ok: false, error: result.error } satisfies WalletResponse, {
        status: result.error === 'insufficient_balance' ? 402 : 404,
      });
    }
    return Response.json({ ok: true, reservation: result.reservation } satisfies WalletResponse);
  }

  private async handleRefreshReservation(request: Request): Promise<Response> {
    const { reservationId, expiresAt } = (await request.json()) as ReservationRequest;
    if (!reservationId || !Number.isFinite(expiresAt)) {
      return Response.json({ ok: false, error: 'invalid_reservation' } satisfies WalletResponse, { status: 400 });
    }
    const reservation = await this.ctx.blockConcurrencyWhile(async () => {
      const key = `${RESERVATION_PREFIX}${reservationId}`;
      const current = await this.ctx.storage.get<WalletReservation>(key);
      if (!current) return null;
      if (current.status === 'reserved') {
        current.expiresAt = expiresAt!;
        await this.ctx.storage.put(key, current);
      }
      return current;
    });
    if (!reservation) return Response.json({ ok: false, error: 'reservation_not_found' }, { status: 404 });
    return Response.json({ ok: true, reservation } satisfies WalletResponse);
  }

  private async handleSettleReservation(userId: string, request: Request): Promise<Response> {
    const { reservationId, amount } = (await request.json()) as ReservationRequest;
    if (!reservationId || !Number.isFinite(amount) || amount! < 0) {
      return Response.json({ ok: false, error: 'invalid_reservation' } satisfies WalletResponse, { status: 400 });
    }

    const result = await this.ctx.blockConcurrencyWhile(async () => {
      const key = `${RESERVATION_PREFIX}${reservationId}`;
      const reservation = await this.ctx.storage.get<WalletReservation>(key);
      const data = await this.ctx.storage.get<KVUserData>(DATA_KEY);
      const metadata = await this.ctx.storage.get<KVUserMetadata>(METADATA_KEY);
      if (!reservation || !data || !metadata) return null;
      if (reservation.status === 'settled' || reservation.status === 'released') {
        return { reservation, data, metadata };
      }
      const settledAmount = Math.min(amount!, reservation.amount);
      data.balance = Math.max(0, data.balance - settledAmount);
      reservation.status = 'settled';
      reservation.settledAmount = settledAmount;
      await this.ctx.storage.put({ [DATA_KEY]: data, [key]: reservation });
      return { reservation, data, metadata };
    });
    if (!result) return Response.json({ ok: false, error: 'reservation_not_found' }, { status: 404 });
    await this.env.KV.put(`user:${userId}`, JSON.stringify(result.data), { metadata: result.metadata });
    return Response.json({ ok: true, ...result } satisfies WalletResponse);
  }

  private async handleReleaseReservation(request: Request): Promise<Response> {
    const { reservationId } = (await request.json()) as ReservationRequest;
    if (!reservationId) {
      return Response.json({ ok: false, error: 'invalid_reservation' } satisfies WalletResponse, { status: 400 });
    }
    const reservation = await this.ctx.blockConcurrencyWhile(async () => {
      const key = `${RESERVATION_PREFIX}${reservationId}`;
      const current = await this.ctx.storage.get<WalletReservation>(key);
      if (!current) return null;
      if (current.status === 'reserved') {
        current.status = 'released';
        await this.ctx.storage.put(key, current);
      }
      return current;
    });
    if (!reservation) {
      return Response.json({
        ok: true,
        reservation: { reservationId, amount: 0, expiresAt: 0, status: 'released' },
      } satisfies WalletResponse);
    }
    return Response.json({ ok: true, reservation } satisfies WalletResponse);
  }

  private async handleSetSuspended(userId: string, isSuspended: boolean): Promise<Response> {
    const result = await this.mutateExisting(userId, (data) => {
      data.isSuspended = isSuspended;
    });
    if (!result) {
      return Response.json(notFound, { status: 404 });
    }
    return Response.json({ ok: true, ...result } satisfies WalletResponse);
  }

  private async handleSetMetadata(userId: string, request: Request): Promise<Response> {
    const patch = (await request.json()) as SetMetadataRequest;
    const result = await this.mutateExisting(userId, (_data, metadata) => {
      if (patch.maxConcurrency !== undefined) {
        metadata.maxConcurrency = patch.maxConcurrency;
      }
      if (patch.rateMultiplier !== undefined) {
        metadata.rateMultiplier = patch.rateMultiplier;
      }
      if (patch.stripeCustomerId !== undefined) {
        metadata.stripeCustomerId = patch.stripeCustomerId;
      }
    });
    if (!result) {
      return Response.json(notFound, { status: 404 });
    }
    return Response.json({ ok: true, ...result } satisfies WalletResponse);
  }

  /**
   * 只执行一次的自愈迁移：storage 为空才进 blockConcurrencyWhile，进去后二次检查
   * （可能在排队等待期间已经被另一个并发请求 adopt 过了），确保 KV 读取 + storage 写入
   * 这段跨外部 I/O 的过程整体串行，不会被其它并发请求打断。
   */
  private async ensureBootstrapped(userId: string): Promise<void> {
    const alreadyBootstrapped = await this.ctx.storage.get<KVUserData>(DATA_KEY);
    if (alreadyBootstrapped) {
      return;
    }

    await this.ctx.blockConcurrencyWhile(async () => {
      const stillEmpty = !(await this.ctx.storage.get<KVUserData>(DATA_KEY));
      if (!stillEmpty) {
        return;
      }

      const mirror = await this.env.KV.getWithMetadata<KVUserData, KVUserMetadata>(`user:${userId}`, 'json');
      if (mirror.value && mirror.metadata) {
        await this.ctx.storage.put({ [DATA_KEY]: mirror.value, [METADATA_KEY]: mirror.metadata });
      }
      // KV 里也没有：真正的全新用户，还没调用过 /create。留空，交给 mutate()/mutateExisting()
      // 的 "not found" 分支处理。
    });
  }

  /**
   * 已存在才允许的变更（/deduct /add /consume-free-quota /suspend /unsuspend /set-metadata）。
   * 用户不存在时返回 null，调用方转成 404。
   */
  private async mutateExisting(
    userId: string,
    apply: (data: KVUserData, metadata: KVUserMetadata) => void,
  ): Promise<{ data: KVUserData; metadata: KVUserMetadata } | null> {
    const existing = await this.ctx.storage.get<KVUserData>(DATA_KEY);
    if (!existing) {
      return null;
    }
    return this.mutate(userId, (data, metadata) => apply(data, metadata));
  }

  /**
   * 核心并发安全原语：读 storage → 应用变更 → 写 storage，整体在 blockConcurrencyWhile 里
   * 执行（不含任何外部 I/O，符合「不要跨外部 I/O 持锁」的准则）。KV 镜像同步放锁外——
   * 那只是展示副本，即便偶尔与其它并发请求的镜像写交错也不影响 storage 里的权威账本。
   */
  private async mutate(
    userId: string,
    apply: (data: KVUserData, metadata: KVUserMetadata, isNew: boolean) => void,
  ): Promise<{ data: KVUserData; metadata: KVUserMetadata }> {
    const result = await this.ctx.blockConcurrencyWhile(async () => {
      const existingData = await this.ctx.storage.get<KVUserData>(DATA_KEY);
      const existingMetadata = await this.ctx.storage.get<KVUserMetadata>(METADATA_KEY);
      const isNew = !existingData || !existingMetadata;
      const data: KVUserData = existingData ?? { balance: 0, concurrency: 0 };
      const metadata: KVUserMetadata = existingMetadata ?? { email: '', createdAt: new Date().toISOString() };

      apply(data, metadata, isNew);
      await this.ctx.storage.put({ [DATA_KEY]: data, [METADATA_KEY]: metadata });
      return { data, metadata };
    });

    await this.env.KV.put(`user:${userId}`, JSON.stringify(result.data), { metadata: result.metadata });
    return result;
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
}
