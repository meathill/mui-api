'use client';

import { useTranslations } from 'next-intl';
import type { FormEvent } from 'react';
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
import type { UserInfo } from '@/lib/api';

export interface EditFormData {
  maxConcurrency: string;
  rateMultiplier: string;
}

export function UserEditDialog({
  open,
  onOpenChange,
  editingUser,
  editForm,
  onChangeField,
  onSubmit,
  pending = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingUser: UserInfo | null;
  editForm: EditFormData;
  onChangeField: (field: keyof EditFormData, value: string) => void;
  onSubmit: (e: FormEvent) => void;
  pending?: boolean;
}) {
  const t = useTranslations('adminUsers');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogBackdrop />
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t('editUser')}</DialogTitle>
          <DialogDescription>{editingUser?.email}</DialogDescription>
        </DialogHeader>
        <form id="user-edit-form" onSubmit={onSubmit} className="grid grid-cols-2 gap-4 px-6">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">{t('maxConcurrency')}</label>
            <Input
              type="number"
              min="1"
              max="100"
              value={editForm.maxConcurrency}
              onChange={(e) => onChangeField('maxConcurrency', e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">{t('rateMultiplier')}</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={editForm.rateMultiplier}
              onChange={(e) => onChangeField('rateMultiplier', e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">{t('rateMultiplierHint')}</p>
          </div>
        </form>
        <DialogFooter variant="bare">
          <DialogClose
            render={
              <Button variant="outline" disabled={pending}>
                {t('cancel')}
              </Button>
            }
          />
          <Button type="submit" form="user-edit-form" disabled={pending}>
            {pending && <Spinner className="mr-2 size-4" />}
            {t('update')}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
