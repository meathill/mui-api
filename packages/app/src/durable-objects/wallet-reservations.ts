import type { KVUserData, KVUserMetadata } from '../types';
import type { ReservationRequest, WalletReservation, WalletResponse } from './wallet-types';

// 预占（reservation）相关的四个 handler。从 wallet.ts 抽出以控制单文件长度；
// 并发语义不变：读-改-写整体在 blockConcurrencyWhile 里执行。

export const DATA_KEY = 'data';
export const METADATA_KEY = 'metadata';
const RESERVATION_PREFIX = 'reservation:';

export async function handleReserve(ctx: DurableObjectState, request: Request): Promise<Response> {
  const { reservationId, amount, expiresAt } = (await request.json()) as ReservationRequest;
  if (!reservationId || !Number.isFinite(amount) || !Number.isFinite(expiresAt) || amount! <= 0) {
    return Response.json({ ok: false, error: 'invalid_reservation' } satisfies WalletResponse, { status: 400 });
  }

  const result = await ctx.blockConcurrencyWhile(async () => {
    const key = `${RESERVATION_PREFIX}${reservationId}`;
    const existing = await ctx.storage.get<WalletReservation>(key);
    if (existing) return { reservation: existing };

    const data = await ctx.storage.get<KVUserData>(DATA_KEY);
    if (!data) return { error: 'user_not_found' as const };

    const now = Date.now();
    const reservations = await ctx.storage.list<WalletReservation>({ prefix: RESERVATION_PREFIX });
    let activeTotal = 0;
    const expiredKeys: string[] = [];
    for (const [reservationKey, reservation] of reservations) {
      if (reservation.expiresAt <= now) {
        expiredKeys.push(reservationKey);
      } else if (reservation.status === 'reserved') {
        activeTotal += reservation.amount;
      }
    }
    if (expiredKeys.length > 0) await ctx.storage.delete(expiredKeys);

    if (data.balance - activeTotal + Number.EPSILON < amount!) {
      return { error: 'insufficient_balance' as const };
    }

    const reservation: WalletReservation = {
      reservationId,
      amount: amount!,
      expiresAt: expiresAt!,
      status: 'reserved',
    };
    await ctx.storage.put(key, reservation);
    return { reservation };
  });

  if ('error' in result) {
    return Response.json({ ok: false, error: result.error } satisfies WalletResponse, {
      status: result.error === 'insufficient_balance' ? 402 : 404,
    });
  }
  return Response.json({ ok: true, reservation: result.reservation } satisfies WalletResponse);
}

export async function handleRefreshReservation(ctx: DurableObjectState, request: Request): Promise<Response> {
  const { reservationId, expiresAt } = (await request.json()) as ReservationRequest;
  if (!reservationId || !Number.isFinite(expiresAt)) {
    return Response.json({ ok: false, error: 'invalid_reservation' } satisfies WalletResponse, { status: 400 });
  }
  const reservation = await ctx.blockConcurrencyWhile(async () => {
    const key = `${RESERVATION_PREFIX}${reservationId}`;
    const current = await ctx.storage.get<WalletReservation>(key);
    if (!current) return null;
    if (current.status === 'reserved') {
      current.expiresAt = expiresAt!;
      await ctx.storage.put(key, current);
    }
    return current;
  });
  if (!reservation) return Response.json({ ok: false, error: 'reservation_not_found' }, { status: 404 });
  return Response.json({ ok: true, reservation } satisfies WalletResponse);
}

export async function handleSettleReservation(
  ctx: DurableObjectState,
  request: Request,
  syncMirror: () => Promise<void>,
): Promise<Response> {
  const { reservationId, amount } = (await request.json()) as ReservationRequest;
  if (!reservationId || !Number.isFinite(amount) || amount! < 0) {
    return Response.json({ ok: false, error: 'invalid_reservation' } satisfies WalletResponse, { status: 400 });
  }

  const result = await ctx.blockConcurrencyWhile(async () => {
    const key = `${RESERVATION_PREFIX}${reservationId}`;
    const reservation = await ctx.storage.get<WalletReservation>(key);
    const data = await ctx.storage.get<KVUserData>(DATA_KEY);
    const metadata = await ctx.storage.get<KVUserMetadata>(METADATA_KEY);
    if (!reservation || !data || !metadata) return null;
    if (reservation.status === 'settled' || reservation.status === 'released') {
      return { reservation, data, metadata };
    }
    const settledAmount = Math.min(amount!, reservation.amount);
    data.balance = Math.max(0, data.balance - settledAmount);
    reservation.status = 'settled';
    reservation.settledAmount = settledAmount;
    await ctx.storage.put({ [DATA_KEY]: data, [key]: reservation });
    return { reservation, data, metadata };
  });
  if (!result) return Response.json({ ok: false, error: 'reservation_not_found' }, { status: 404 });
  await syncMirror();
  return Response.json({ ok: true, ...result } satisfies WalletResponse);
}

export async function handleReleaseReservation(ctx: DurableObjectState, request: Request): Promise<Response> {
  const { reservationId } = (await request.json()) as ReservationRequest;
  if (!reservationId) {
    return Response.json({ ok: false, error: 'invalid_reservation' } satisfies WalletResponse, { status: 400 });
  }
  const reservation = await ctx.blockConcurrencyWhile(async () => {
    const key = `${RESERVATION_PREFIX}${reservationId}`;
    const current = await ctx.storage.get<WalletReservation>(key);
    if (!current) return null;
    if (current.status === 'reserved') {
      current.status = 'released';
      await ctx.storage.put(key, current);
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
