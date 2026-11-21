'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogHeader, DialogPopup, DialogTitle } from '@/components/ui/dialog';
import { TOP_UP_AMOUNTS, type TopUpAmount } from '@/lib/top-up';

interface TopUpDialogProps {
  open: boolean;
  /** 正在跳转 Stripe 的金额，null 表示空闲；用于展示跳转中状态并禁用按钮 */
  pendingAmount: number | null;
  onOpenChange(open: boolean): void;
  onTopUp(amount: TopUpAmount): void;
}

/**
 * 余额卡「充值」按钮弹出的金额选择框（issue #23）：
 * 余额旁的快速充值入口，选定档位后复用主页的 handleTopUp 跳转 Stripe Checkout。
 */
export function TopUpDialog({ open, pendingAmount, onOpenChange, onTopUp }: TopUpDialogProps) {
  const t = useTranslations('dashboard');

  function handleSelect(amount: TopUpAmount) {
    onOpenChange(false);
    onTopUp(amount);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t('topUp.dialogTitle')}</DialogTitle>
          <DialogDescription>{t('topUp.hint')}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 px-6 pb-6 sm:grid-cols-3">
          {TOP_UP_AMOUNTS.map((amount) => (
            <Button
              key={amount}
              onClick={() => handleSelect(amount)}
              disabled={pendingAmount !== null}
              size="lg"
              variant={amount === 20 ? 'press' : 'outline'}
            >
              {pendingAmount === amount ? t('topUp.redirecting') : t('topUp.button', { amount })}
            </Button>
          ))}
        </div>
      </DialogPopup>
    </Dialog>
  );
}
