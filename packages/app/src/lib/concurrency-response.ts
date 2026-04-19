export interface LeaseHeartbeat {
  stop: () => void;
  done: Promise<void>;
}

export function createLeaseHeartbeat(
  intervalMs: number,
  refreshLease: () => Promise<void>,
  onError: (error: unknown) => void,
): LeaseHeartbeat {
  let stopped = false;
  let wake: (() => void) | null = null;

  const done = (async () => {
    while (!stopped) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, intervalMs);
        wake = () => {
          clearTimeout(timer);
          resolve();
        };
      });
      wake = null;

      if (stopped) {
        break;
      }

      try {
        await refreshLease();
      } catch (error) {
        onError(error);
      }
    }
  })();

  return {
    stop() {
      if (stopped) {
        return;
      }
      stopped = true;
      wake?.();
      wake = null;
    },
    done,
  };
}

export function wrapResponseBodyWithFinalizer(response: Response, finalize: () => Promise<void>): Response {
  const finalizeOnce = createAsyncOnce(finalize);
  const queueFinalizer = createDeferredFinalizer(finalizeOnce);

  if (!response.body) {
    queueFinalizer();
    return response;
  }

  const reader = response.body.getReader();
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          queueFinalizer();
          return;
        }
        controller.enqueue(value);
      } catch (error) {
        controller.error(error);
        queueFinalizer();
      }
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } finally {
        queueFinalizer();
      }
    },
  });

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

function createAsyncOnce(fn: () => Promise<void>): () => Promise<void> {
  let promise: Promise<void> | null = null;

  return async function runOnce(): Promise<void> {
    if (!promise) {
      promise = fn();
    }

    await promise;
  };
}

function createDeferredFinalizer(finalizeOnce: () => Promise<void>): () => void {
  return function queueFinalizer() {
    queueMicrotask(() => {
      void finalizeOnce();
    });
  };
}
