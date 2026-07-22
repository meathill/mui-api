import { getCloudflareContext } from '@opennextjs/cloudflare';
import { describe, expect, it, vi } from 'vitest';
import { TOP_UP_PROCESSING_STALE_SECONDS } from '@/lib/top-up';
import { claimTopUpProcessing } from './db';

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: vi.fn(),
}));

const getContextMock = vi.mocked(getCloudflareContext);

function createFakeDb(changes: number) {
  const run = vi.fn().mockResolvedValue({ meta: { changes } });
  const bind = vi.fn(() => ({ run }));
  const prepare = vi.fn((_sql: string) => ({ bind }));
  return { prepare, bind, run };
}

describe('claimTopUpProcessing', () => {
  it('允许回收超时的 processing 会话（worker 硬终止残留），超时阈值经 bind 传入', async () => {
    const db = createFakeDb(1);
    getContextMock.mockResolvedValue({ env: { DB: db } } as never);

    const claimed = await claimTopUpProcessing('cs_test_1', 'paid');

    expect(claimed).toBe(true);
    const sql = db.prepare.mock.calls[0][0];
    expect(sql).toContain(`status IN ('created', 'failed')`);
    expect(sql).toContain(`status = 'processing' AND updated_at <= unixepoch() - ?`);
    expect(db.bind).toHaveBeenCalledWith('paid', 'cs_test_1', TOP_UP_PROCESSING_STALE_SECONDS);
  });

  it('没有可 claim 的行时返回 false', async () => {
    const db = createFakeDb(0);
    getContextMock.mockResolvedValue({ env: { DB: db } } as never);

    await expect(claimTopUpProcessing('cs_test_2', 'paid')).resolves.toBe(false);
  });
});
