import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLeaseHeartbeat, wrapResponseBodyWithFinalizer } from './concurrency-response';

describe('concurrency-response', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('响应读完后会执行 finalizer', async () => {
    const finalize = vi.fn(async () => {});
    const response = wrapResponseBodyWithFinalizer(new Response('ok'), finalize);

    await response.text();
    await Promise.resolve();

    expect(finalize).toHaveBeenCalledTimes(1);
  });

  it('流取消时会执行 finalizer', async () => {
    const finalize = vi.fn(async () => {});
    const response = wrapResponseBodyWithFinalizer(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('chunk-1'));
          },
        }),
      ),
      finalize,
    );

    const reader = response.body?.getReader();
    const firstChunk = await reader.read();
    expect(firstChunk.done).toBe(false);

    await reader.cancel('stop');
    await Promise.resolve();

    expect(finalize).toHaveBeenCalledTimes(1);
  });

  it('流读取报错时会执行 finalizer', async () => {
    const finalize = vi.fn(async () => {});
    const response = wrapResponseBodyWithFinalizer(
      new Response(
        new ReadableStream({
          pull() {
            throw new Error('boom');
          },
        }),
      ),
      finalize,
    );

    await expect(response.text()).rejects.toThrow('boom');
    await Promise.resolve();
    expect(finalize).toHaveBeenCalledTimes(1);
  });

  it('心跳会周期性续租，stop 后停止', async () => {
    vi.useFakeTimers();

    const refreshLease = vi.fn(async () => {});
    const onError = vi.fn();
    const heartbeat = createLeaseHeartbeat(1_000, refreshLease, onError);

    await vi.advanceTimersByTimeAsync(3_100);
    heartbeat.stop();
    await heartbeat.done;
    await vi.advanceTimersByTimeAsync(5_000);

    expect(refreshLease).toHaveBeenCalledTimes(3);
    expect(onError).not.toHaveBeenCalled();
  });
});
