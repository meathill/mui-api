// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import zhMessages from '../../messages/zh.json';
import { TopUpDialog } from './top-up-dialog';

function renderDialog(props: Partial<Parameters<typeof TopUpDialog>[0]> = {}) {
  const onOpenChange = vi.fn();
  const onTopUp = vi.fn();
  const view = render(
    <NextIntlClientProvider locale="zh" messages={zhMessages}>
      <TopUpDialog
        open={props.open ?? true}
        pendingAmount={props.pendingAmount ?? null}
        onOpenChange={onOpenChange}
        onTopUp={onTopUp}
      />
    </NextIntlClientProvider>,
  );
  return { onOpenChange, onTopUp, view };
}

describe('TopUpDialog（余额卡快速充值弹窗，issue #23）', () => {
  it('打开时展示标题与三个档位按钮，$20 为推荐档', () => {
    renderDialog();

    expect(screen.getByText('选择充值金额')).toBeInTheDocument();
    for (const amount of [10, 20, 50]) {
      expect(screen.getByRole('button', { name: `充值 $${amount}` })).toBeInTheDocument();
    }
  });

  it('选择档位后关闭弹窗并回调对应金额', async () => {
    const user = userEvent.setup();
    const { onOpenChange, onTopUp } = renderDialog();

    await user.click(screen.getByRole('button', { name: '充值 $20' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onTopUp).toHaveBeenCalledExactlyOnceWith(20);
  });

  it('跳转中：对应档位显示跳转文案，全部按钮禁用', () => {
    renderDialog({ pendingAmount: 10 });

    expect(screen.getByRole('button', { name: '跳转到 Stripe...' })).toBeInTheDocument();
    for (const name of ['充值 $20', '充值 $50']) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
  });

  it('关闭状态不渲染弹窗内容', () => {
    renderDialog({ open: false });

    expect(screen.queryByText('选择充值金额')).not.toBeInTheDocument();
  });
});
