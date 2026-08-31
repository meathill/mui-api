'use client';

import { useTranslations } from 'next-intl';
import { type FormEvent, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { toastManager } from '@/components/ui/toast';
import { api, type UserInfo } from '@/lib/api';

export interface UserBalanceAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserInfo | null;
  onSuccess: () => void;
}

export function UserBalanceAdjustDialog({ open, onOpenChange, user, onSuccess }: UserBalanceAdjustDialogProps) {
  const t = useTranslations('adminUserDetail');
  const tu = useTranslations('adminUsers');
  const te = useTranslations('errors');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount('');
      setNote('');
    }
  }, [open]);

  const numericAmount = Number(amount);
  const isNegative = Number.isFinite(numericAmount) && numericAmount < 0;
  const isZero = amount.trim() !== '' && numericAmount === 0;
  const canSubmit =
    amount.trim() !== '' &&
    Number.isFinite(numericAmount) &&
    numericAmount !== 0 &&
    (!isNegative || note.trim().length > 0) &&
    !pending;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !canSubmit) return;
    if (isNegative && !note.trim()) {
      toastManager.add({ title: '负数调整必须填写备注', type: 'error' });
      return;
    }
    setPending(true);
    try {
      const result = await api.recharge(user.email, numericAmount, note.trim() || undefined);
      toastManager.add({ title: te('rechargeSuccess', { balance: `$${result.balance.toFixed(4)}` }), type: 'success' });
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toastManager.add({ title: err instanceof Error ? err.message : te('rechargeFailed'), type: 'error' });
    } finally {
      setPending(false);
    }
  }

  const previewBalance =
    user && Number.isFinite(numericAmount) && numericAmount !== 0 ? user.balance + numericAmount : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogBackdrop />
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t('adjustBalance')}</DialogTitle>
          <DialogDescription>
            {user?.email} · {tu('colBalance')}: ${user?.balance.toFixed(4) ?? '-'}
          </DialogDescription>
        </DialogHeader>
        <form id="balance-adjust-form" onSubmit={handleSubmit} className="grid gap-4 px-6">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              {tu('amount')} <span className="text-destructive">*</span>
            </label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t('adjustAmountPlaceholder')}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">{t('adjustAmountHint')}</p>
            {isZero && <p className="text-xs text-destructive mt-1">{t('adjustAmountZeroError')}</p>}
            {isNegative && !note.trim() && (
              <p className="text-xs text-destructive mt-1">{t('adjustNegativeNoteRequired')}</p>
            )}
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              {tu('note')}{' '}
              {isNegative ? (
                <span className="text-destructive">*</span>
              ) : (
                <span className="text-muted-foreground">({tu('optional')})</span>
              )}
            </label>
            <Input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={isNegative ? t('adjustNoteRequiredPlaceholder') : tu('optional')}
              required={isNegative}
            />
          </div>
          {previewBalance !== null && (
            <p className="text-xs text-muted-foreground">
              {t('previewBalance', { balance: `$${previewBalance.toFixed(4)}` })}
            </p>
          )}
        </form>
        <DialogFooter variant="bare">
          <DialogClose
            render={
              <Button variant="outline" disabled={pending}>
                {tu('cancel')}
              </Button>
            }
          />
          <Button type="submit" form="balance-adjust-form" disabled={!canSubmit}>
            {pending && <Spinner className="mr-2 size-4" />}
            {t('confirmAdjust')}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
