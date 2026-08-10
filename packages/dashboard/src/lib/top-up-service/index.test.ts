import { getCloudflareContext } from '@opennextjs/cloudflare';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TOP_UP_AMOUNT_ERROR_MESSAGE } from '@/lib/top-up';
import { createTopUpCheckoutSession } from './index';

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: vi.fn(),
}));

const user = {
  id: 'user-1',
  email: 'user@example.com',
  name: 'User',
};

describe('createTopUpCheckoutSession', () => {
  beforeEach(() => {
    vi.mocked(getCloudflareContext).mockReset();
  });

  it.each([0, -10, 9, 10.01, 30, Number.NaN])('在访问 Stripe 前拒绝非法充值金额 %s', async (amount) => {
    let thrownError: unknown;
    try {
      await createTopUpCheckoutSession({
        amount,
        locale: 'zh',
        origin: 'https://muirouter.com',
        user,
      });
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(Error);
    expect((thrownError as Error).message).toBe(TOP_UP_AMOUNT_ERROR_MESSAGE);

    expect(getCloudflareContext).not.toHaveBeenCalled();
  });
});
