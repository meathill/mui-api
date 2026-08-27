// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import { renderWithIntl } from '@/test/render-with-intl';
import { UserRechargeSection } from './user-recharge-section';

vi.mock('@/lib/api', () => ({
  api: {
    getRechargeLogs: vi.fn(),
    getUsers: vi.fn(),
  },
}));

// next-intl 的 Link 依赖 next/navigation 的 App Router context，纯 vitest 环境下无法解析；
// 这里换成纯 <a> 展示层 mock，不影响本测试要验证的加载/渲染/错误/分页逻辑。
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const getRechargeLogsMock = vi.mocked(api.getRechargeLogs);
const getUsersMock = vi.mocked(api.getUsers);

describe('UserRechargeSection', () => {
  it('数据加载完成前显示加载中', async () => {
    getRechargeLogsMock.mockReturnValue(new Promise(() => {}));
    getUsersMock.mockReturnValue(new Promise(() => {}));

    const { container } = renderWithIntl(<UserRechargeSection userId="user-1" />);

    expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
  });

  it('加载完成后渲染充值记录', async () => {
    getRechargeLogsMock.mockResolvedValue({
      logs: [
        {
          id: 'log-1',
          userId: 'user-1',
          operatorId: 'admin-1',
          amount: 10,
          balanceAfter: 20,
          note: '手动充值',
          createdAt: '2026-07-01T00:00:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });
    getUsersMock.mockResolvedValue({ users: [], cursor: null });

    renderWithIntl(<UserRechargeSection userId="user-1" />);

    await waitFor(() => expect(document.querySelector('[data-slot="skeleton"]')).not.toBeInTheDocument());
    expect(screen.getByText('手动充值')).toBeInTheDocument();
  });

  it('请求失败时显示错误信息', async () => {
    getRechargeLogsMock.mockRejectedValue(new Error('网络异常'));
    getUsersMock.mockResolvedValue({ users: [], cursor: null });

    renderWithIntl(<UserRechargeSection userId="user-1" />);

    expect(await screen.findByText('网络异常')).toBeInTheDocument();
  });

  it('总页数为 1 时不显示分页控件', async () => {
    getRechargeLogsMock.mockResolvedValue({
      logs: [],
      pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
    });
    getUsersMock.mockResolvedValue({ users: [], cursor: null });

    const { container } = renderWithIntl(<UserRechargeSection userId="user-1" />);

    await waitFor(() => expect(container.querySelector('[data-slot="skeleton"]')).not.toBeInTheDocument());
    expect(screen.queryByText('上一页')).not.toBeInTheDocument();
  });

  it('第一页时上一页按钮禁用，下一页按钮可用', async () => {
    getRechargeLogsMock.mockResolvedValue({
      logs: [],
      pagination: { page: 1, pageSize: 10, total: 25, totalPages: 3 },
    });
    getUsersMock.mockResolvedValue({ users: [], cursor: null });

    const { container } = renderWithIntl(<UserRechargeSection userId="user-1" />);

    await waitFor(() => expect(container.querySelector('[data-slot="skeleton"]')).not.toBeInTheDocument());
    expect(screen.getByText('上一页')).toBeDisabled();
    expect(screen.getByText('下一页')).not.toBeDisabled();
  });

  it('翻到最后一页后下一页按钮禁用', async () => {
    // 分页由组件内部的本地 page 计数驱动（不是服务端返回的 pagination.page），
    // 所以要通过实际点击"下一页"两次把本地 page 推到 3，而不是直接在 mock 里塞 page:3。
    getRechargeLogsMock.mockResolvedValue({
      logs: [],
      pagination: { page: 1, pageSize: 10, total: 25, totalPages: 3 },
    });
    getUsersMock.mockResolvedValue({ users: [], cursor: null });

    const user = userEvent.setup();
    const { container } = renderWithIntl(<UserRechargeSection userId="user-1" />);
    await waitFor(() => expect(container.querySelector('[data-slot="skeleton"]')).not.toBeInTheDocument());

    await user.click(screen.getByText('下一页'));
    await user.click(screen.getByText('下一页'));

    await waitFor(() => expect(screen.getByText('下一页')).toBeDisabled());
  });
});
